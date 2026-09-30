/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/percusion.js
   Versión: 4.1.0
   Propósito: vista del secuenciador. Dos modos:
              - Simple: 4 filas intercambiables con 8 pasos. Cada
                fila elige un sonido de un catálogo de 13. Sonido
                inicial: rap 90 underground.
              - Extendido: 7 voces afro, 16 pasos, con chips de
                estilo y efectos globales.
              La caja usa los mismos tokens del shell: cambia de
              papel claro a oscuro cuando el body tiene
              modo-noche. Sin colores separados.
              v4.1.0: guardarRitmo() ahora incluye los cinco campos
                      de estado del instrumento: efectos, volumen,
                      silenciados, solistas y swing. cargarRitmo()
                      los restaura. Antes solo se guardaban patrón
                      y BPM, así que al recargar un ritmo se
                      perdían la mezcla y los efectos silenciosamente.
                      Si un ritmo guardado no trae esos campos
                      (formato anterior), se aplican los defaults
                      del estilo sin romper.
              v4.0.0: rediseño al patrón caja + sheets.
              v3.0.0: reescritura completa. Modo simple + extendido.
              v1.4.0: id="vista-percusion".
              v1.3.1: mostrarConfirmacion().
              v1.3.0: activar() pinta primero.
              v1.2.0: distintivoAutor.
              v1.1.0: Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as motor from '../audio/beatmaker.js';
import * as repoRitmos from '../datos/repositorios/ritmos.js';
import { al } from '../nucleo/bus-eventos.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:percusion');

const VOL_INICIAL = [1.0, 0.8, 0.8, 0.6, 0.55, 0.9, 0.55];
const VOL_SIMPLE_INICIAL = [1.0, 0.8, 0.7, 0.9];

const ICONO_CERRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>';
const ICONO_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICONO_PARAR = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const ICONO_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const ICONO_MEZCLA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
const ICONO_EFECTOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>';
const ICONO_GUARDADOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

const registro = {
  contenedor: null,
  raiz: null,
  abortador: null,
  desuscribir: [],
  sheetActivo: null,
  abortadorSheet: null,

  modo: 'simple',
  pasoActual: -1,

  // Simple.
  filas: [],

  // Extendido.
  estilo: null,
  patron: [],
  volumen: VOL_INICIAL.slice(),
  silenciados: Array(7).fill(false),
  solistas: Array(7).fill(false),
  efectos: { reverb: 10, eco: 12, saturacion: 35, filtro: 100 },

  bpm: 90,
  swing: 0,

  guardados: [],
};

/* ================================================================
   Utilidades
   ================================================================ */

function clonarFilas(filas) {
  return filas.map((f) => ({ sonidoId: f.sonidoId, pasos: f.pasos.slice() }));
}

function clonarPatron(p) {
  return p.map((fila) => fila.slice());
}

function pintarError(mensaje) {
  const raiz = registro.raiz;
  if (!raiz) return;
  const error = h('p', { class: 'vista__error', role: 'alert' }, mensaje);
  raiz.prepend(error);
  setTimeout(() => error.remove(), 5000);
}

function pintarOk(mensaje) {
  const raiz = registro.raiz;
  if (!raiz) return;
  const ok = h('p', { class: 'vista__ok', role: 'status' }, mensaje);
  raiz.prepend(ok);
  setTimeout(() => ok.remove(), 3500);
}

/* ================================================================
   Celdas
   ================================================================ */

function pintarCeldaSimple(fila, col, valor) {
  const celda = h('button', {
    type: 'button',
    class: 'perc-celda' + ((col === 0 || col === 4) ? ' perc-celda--marca' : ''),
    'data-fila': String(fila),
    'data-col': String(col),
    'aria-label': `Paso ${col + 1}`,
  });
  if (valor) {
    celda.classList.add(`perc-celda--n${valor}`);
  }
  return celda;
}

function pintarCeldaExtendida(fila, col, valor, esMelodica) {
  const celda = h('button', {
    type: 'button',
    class: 'perc-celda',
    'data-fila': String(fila),
    'data-col': String(col),
  });

  if (esMelodica) {
    if (valor >= 0) {
      const offset = fila === 5 ? 12 : 24;
      const midi = registro.estilo.raiz + offset + valor;
      celda.textContent = motor.nombreNota(midi);
      celda.classList.add('perc-celda--nota');
      celda.style.background = `var(--mostaza)`;
      celda.style.color = '#1a1410';
    }
  } else {
    if (valor) {
      celda.classList.add(`perc-celda--n${valor}`);
    }
  }
  return celda;
}

/* ================================================================
   Pintar grilla
   ================================================================ */

function pintarGrillaSimple() {
  const g = h('div', { class: 'perc-grilla' });

  registro.filas.forEach((fila, f) => {
    const sonido = motor.buscarSonidoSimple(fila.sonidoId);

    const selector = h('button', {
      type: 'button',
      class: 'perc-voz__selector',
      'data-fila': String(f),
    },
      h('span', { class: 'perc-voz__selector-texto' }, sonido ? sonido.nombre : 'Elegir'),
      h('span', { class: 'perc-voz__selector-flecha', html: ICONO_CHEVRON })
    );

    const pasos = h('div', { class: 'perc-pasos' });
    for (let c = 0; c < motor.PASOS_SIMPLE; c++) {
      pasos.append(pintarCeldaSimple(f, c, fila.pasos[c]));
    }

    g.append(h('div', { class: 'perc-voz' }, selector, pasos));
  });

  return g;
}

function pintarGrillaExtendida() {
  const g = h('div', { class: 'perc-grilla perc-grilla--extendida' });
  const nombres = motor.NOMBRES_VOCES_EXTENDIDO;

  for (let fila = 0; fila < motor.FILAS_EXTENDIDO; fila++) {
    const esMelodica = fila >= motor.VOCES_RITMICAS;

    const label = h('div', { class: 'perc-voz__label' },
      h('span', { class: 'perc-voz__label-nombre' }, nombres[fila])
    );

    const pasos = h('div', { class: 'perc-pasos' });
    const bloqueA = h('div', { class: 'perc-pasos__bloque' });
    const bloqueB = h('div', { class: 'perc-pasos__bloque' });

    for (let c = 0; c < 8; c++) {
      bloqueA.append(pintarCeldaExtendida(fila, c, registro.patron[fila][c], esMelodica));
    }
    for (let c = 8; c < 16; c++) {
      bloqueB.append(pintarCeldaExtendida(fila, c, registro.patron[fila][c], esMelodica));
    }

    pasos.append(bloqueA, bloqueB);
    g.append(h('div', { class: 'perc-voz' + (esMelodica ? ' perc-voz--melodica' : '') }, label, pasos));
  }

  return g;
}

/* ================================================================
   Controles comunes
   ================================================================ */

function pintarControles() {
  const bpmMin = registro.modo === 'simple' ? 60 : 70;
  const bpmMax = registro.modo === 'simple' ? 160 : 140;

  const btnPlay = h('button', {
    type: 'button',
    class: 'perc-play',
    'data-accion': 'play',
    'aria-label': motor.estaReproduciendo() ? 'Parar' : 'Reproducir',
  });
  btnPlay.innerHTML = motor.estaReproduciendo() ? ICONO_PARAR : ICONO_PLAY;

  return h('div', { class: 'perc-controles' },
    btnPlay,
    h('div', { class: 'perc-sliders' },
      h('span', { class: 'perc-slider__label' }, 'Tempo'),
      h('div', { class: 'perc-slider__fila' },
        h('input', {
          type: 'range', min: String(bpmMin), max: String(bpmMax), step: '1',
          value: String(registro.bpm),
          'data-accion': 'bpm',
          class: 'perc-slider__input',
        }),
        h('span', { class: 'perc-slider__valor' }, String(registro.bpm))
      ),
      h('span', { class: 'perc-slider__label', style: 'margin-top: 4px;' }, 'Swing'),
      h('div', { class: 'perc-slider__fila' },
        h('input', {
          type: 'range', min: '0', max: '50', step: '1',
          value: String(registro.swing),
          'data-accion': 'swing',
          class: 'perc-slider__input',
        }),
        h('span', { class: 'perc-slider__valor' }, registro.swing + '%')
      )
    )
  );
}

/* ================================================================
   Botones de sheets
   ================================================================ */

function pintarBotonesSheets() {
  return h('div', { class: 'perc-botones' },
    h('button', {
      type: 'button', class: 'perc-boton',
      'data-sheet': 'mezcla',
    }, h('span', { html: ICONO_MEZCLA }), 'Mezcla'),
    h('button', {
      type: 'button', class: 'perc-boton',
      'data-sheet': 'efectos',
    }, h('span', { html: ICONO_EFECTOS }), 'Efectos'),
    h('button', {
      type: 'button', class: 'perc-boton',
      'data-sheet': 'guardados',
    }, h('span', { html: ICONO_GUARDADOS }), 'Guardados')
  );
}

function pintarAccionesInferiores() {
  return h('div', { class: 'botones-fila' },
    h('button', {
      type: 'button', class: 'boton-accion',
      'data-accion': 'reset',
    }, 'Reset'),
    h('button', {
      type: 'button', class: 'boton-accion',
      'data-accion': 'limpiar',
    }, 'Limpiar'),
    h('button', {
      type: 'button', class: 'boton-accion boton-accion--principal',
      'data-accion': 'abrir-guardar',
    }, 'Guardar')
  );
}

/* ================================================================
   Cuerpo según modo
   ================================================================ */

function pintarModoSimple() {
  const cuerpo = h('div', {});

  cuerpo.append(pintarGrillaSimple());
  cuerpo.append(pintarControles());
  cuerpo.append(pintarBotonesSheets());
  cuerpo.append(pintarAccionesInferiores());

  return cuerpo;
}

function pintarModoExtendido() {
  const cuerpo = h('div', {});

  // Chips de estilo.
  const chips = h('div', { class: 'perc-chips-estilo' });
  for (const est of motor.ESTILOS_EXTENDIDOS) {
    chips.append(h('button', {
      type: 'button',
      class: 'chip-estilo' + (est.id === registro.estilo.id ? ' is-active' : ''),
      'data-accion': 'estilo',
      'data-estilo': est.id,
    }, est.nombre));
  }
  cuerpo.append(chips);

  // Info del estilo.
  cuerpo.append(h('div', { class: 'perc-info' },
    h('span', { class: 'perc-info__nombre' }, registro.estilo.nombre + ' · ' + registro.bpm + ' bpm'),
    h('span', { class: 'perc-info__desc' }, ' ' + registro.estilo.descripcion)
  ));

  cuerpo.append(pintarGrillaExtendida());
  cuerpo.append(pintarControles());
  cuerpo.append(pintarBotonesSheets());
  cuerpo.append(pintarAccionesInferiores());

  return cuerpo;
}

/* ================================================================
   Pintar vista completa
   ================================================================ */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-percusion', class: 'vista vista--percusion' });
  cont.append(raiz);
  registro.raiz = raiz;

  // Selector de modo.
  const modoSelector = h('div', { class: 'perc-modo' },
    h('button', {
      type: 'button',
      class: 'perc-modo-btn' + (registro.modo === 'simple' ? ' is-active' : ''),
      'data-accion': 'cambiar-modo',
      'data-modo': 'simple',
    }, 'Simple'),
    h('button', {
      type: 'button',
      class: 'perc-modo-btn' + (registro.modo === 'extendido' ? ' is-active' : ''),
      'data-accion': 'cambiar-modo',
      'data-modo': 'extendido',
    }, 'Extendido')
  );

  // Caja del instrumento.
  const caja = h('div', { class: 'perc-caja' },
    modoSelector,
    registro.modo === 'simple' ? pintarModoSimple() : pintarModoExtendido()
  );

  raiz.append(caja);
}

/* ================================================================
   Sheets
   ================================================================ */

function cerrarSheet() {
  const s = registro.sheetActivo;
  if (!s) return;
  if (registro.abortadorSheet) {
    registro.abortadorSheet.abort();
    registro.abortadorSheet = null;
  }
  registro.sheetActivo = null;
  s.classList.remove('is-open');
  setTimeout(() => { if (s.parentNode) s.remove(); }, 320);
}

function abrirSheet({ titulo, cuerpo, onAbrir }) {
  cerrarSheet();
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const panel = h('div', { class: 'sheet__panel' });

  const cab = h('div', { class: 'sheet__cab' },
    h('span', { class: 'sheet__titulo' }, titulo),
    h('button', { type: 'button', class: 'sheet__cerrar', 'aria-label': 'Cerrar' }, h('span', { html: ICONO_CERRAR }))
  );

  const body = h('div', { class: 'sheet__cuerpo' }, cuerpo);

  panel.append(h('div', { class: 'sheet__handle' }), cab, body);
  sheet.append(panel);
  document.body.append(sheet);

  const abortador = new AbortController();
  registro.abortadorSheet = abortador;
  const { signal } = abortador;

  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) cerrarSheet(); }, { signal });
  cab.querySelector('.sheet__cerrar').addEventListener('click', cerrarSheet, { signal });

  requestAnimationFrame(() => sheet.classList.add('is-open'));
  registro.sheetActivo = sheet;

  if (typeof onAbrir === 'function') onAbrir(sheet);
  return sheet;
}

/* ── Sheet: elegir sonido (modo simple) ── */
function abrirSheetSonido(indiceFila) {
  const actual = registro.filas[indiceFila].sonidoId;

  const cuerpo = h('div', {});
  for (const cat of motor.CATEGORIAS_SIMPLES) {
    const grupo = h('div', { class: 'categoria-sonidos' });
    grupo.append(h('p', { class: 'categoria-sonidos__titulo' }, cat));

    const grid = h('div', { class: 'sonidos-grid' });
    for (const s of motor.SONIDOS_SIMPLES.filter((x) => x.cat === cat)) {
      grid.append(h('button', {
        type: 'button',
        class: 'sonido-chip' + (s.id === actual ? ' is-active' : ''),
        'data-sonido': s.id,
      }, s.nombre));
    }
    grupo.append(grid);
    cuerpo.append(grupo);
  }

  abrirSheet({
    titulo: 'Elegir sonido',
    cuerpo,
    onAbrir(sheet) {
      sheet.querySelectorAll('.sonido-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          registro.filas[indiceFila].sonidoId = chip.dataset.sonido;
          cerrarSheet();
          pintar();
          motor.tocarSonidoSimple(chip.dataset.sonido);
        });
      });
    },
  });
}

/* ── Sheet: mezcla ── */
function abrirSheetMezcla() {
  const cuerpo = h('div', {});
  cuerpo.append(h('p', { class: 'sheet-bloque-titulo' }, 'Volumen por voz'));

  if (registro.modo === 'simple') {
    registro.filas.forEach((fila, i) => {
      const sonido = motor.buscarSonidoSimple(fila.sonidoId);
      cuerpo.append(filaSlider(
        sonido ? sonido.nombre : `Fila ${i + 1}`,
        Math.round(VOL_SIMPLE_INICIAL[i] * 100),
        { indice: i, esSimple: true }
      ));
    });
  } else {
    motor.NOMBRES_VOCES_EXTENDIDO.forEach((nombre, i) => {
      cuerpo.append(filaSlider(
        nombre,
        Math.round(registro.volumen[i] * 100),
        { indice: i, esSimple: false }
      ));
    });
  }

  abrirSheet({
    titulo: 'Mezcla',
    cuerpo,
    onAbrir(sheet) {
      sheet.querySelectorAll('[data-accion="silenciar"]').forEach((b) => {
        b.addEventListener('click', () => {
          const i = Number(b.dataset.indice);
          registro.silenciados[i] = !registro.silenciados[i];
          motor.actualizar({ silenciados: registro.silenciados });
          b.classList.toggle('is-active', registro.silenciados[i]);
        });
      });
      sheet.querySelectorAll('[data-accion="solo"]').forEach((b) => {
        b.addEventListener('click', () => {
          const i = Number(b.dataset.indice);
          registro.solistas[i] = !registro.solistas[i];
          motor.actualizar({ solistas: registro.solistas });
          b.classList.toggle('is-active', registro.solistas[i]);
        });
      });
      sheet.querySelectorAll('[data-accion="volumen"]').forEach((s) => {
        s.addEventListener('input', () => {
          const i = Number(s.dataset.indice);
          const v = Number(s.value) / 100;
          registro.volumen[i] = v;
          motor.actualizar({ volumen: registro.volumen });
          const val = s.parentNode.querySelector('.valor');
          if (val) val.textContent = String(s.value);
        });
      });
    },
  });
}

function filaSlider(nombre, valor, { indice, esSimple }) {
  const sl = h('input', {
    type: 'range', min: '0', max: '100', step: '1',
    value: String(valor),
    'data-accion': 'volumen',
    'data-indice': String(indice),
  });

  const acciones = h('div', { class: 'fila-slider__acciones' });
  if (!esSimple) {
    acciones.append(
      h('button', {
        type: 'button', class: 'mini-btn' + (registro.silenciados[indice] ? ' is-active' : ''),
        'data-accion': 'silenciar', 'data-indice': String(indice),
      }, 'M'),
      h('button', {
        type: 'button', class: 'mini-btn' + (registro.solistas[indice] ? ' is-active' : ''),
        'data-accion': 'solo', 'data-indice': String(indice),
      }, 'S')
    );
  }

  return h('div', { class: 'fila-slider' },
    h('label', {}, nombre),
    sl,
    esSimple
      ? h('span', { class: 'valor' }, String(valor))
      : acciones
  );
}

/* ── Sheet: efectos ── */
function abrirSheetEfectos() {
  const cuerpo = h('div', {});
  cuerpo.append(h('p', { class: 'sheet-bloque-titulo' }, 'Efectos globales'));

  const defs = [
    ['reverb', 'Reverb'],
    ['eco', 'Eco'],
    ['saturacion', 'Saturación'],
    ['filtro', 'Filtro'],
  ];

  for (const [clave, etiqueta] of defs) {
    const sl = h('input', {
      type: 'range', min: '0', max: '100', step: '1',
      value: String(registro.efectos[clave]),
      'data-accion': 'efecto',
      'data-efecto': clave,
    });
    cuerpo.append(h('div', { class: 'fila-slider' },
      h('label', {}, etiqueta),
      sl,
      h('span', { class: 'valor' }, String(registro.efectos[clave]))
    ));
  }

  abrirSheet({
    titulo: 'Efectos',
    cuerpo,
    onAbrir(sheet) {
      sheet.querySelectorAll('[data-accion="efecto"]').forEach((s) => {
        s.addEventListener('input', () => {
          const clave = s.dataset.efecto;
          registro.efectos[clave] = Number(s.value);
          motor.actualizar({ efectos: registro.efectos });
          const val = s.parentNode.querySelector('.valor');
          if (val) val.textContent = String(s.value);
        });
      });
    },
  });
}

/* ── Sheet: guardados ── */
async function abrirSheetGuardados() {
  await refrescarGuardados();
  const cuerpo = h('div', {});

  if (registro.guardados.length === 0) {
    cuerpo.append(h('p', { class: 'perc-vacio' }, 'Aún no hay ritmos guardados.'));
  } else {
    const lista = h('div', { class: 'guardados-lista' });
    for (const r of registro.guardados) {
      const etiquetaModo = r.modo === 'simple' ? 'Simple' : 'Extendido';
      const detalle = r.modo === 'extendido' && r.estiloId
        ? (motor.buscarEstiloExtendido(r.estiloId)?.nombre || etiquetaModo)
        : etiquetaModo;

      lista.append(h('div', { class: 'ritmo-item' },
        h('div', { class: 'ritmo-item__cuerpo' },
          h('div', { class: 'ritmo-item__nombre' }, r.nombre),
          h('div', { class: 'ritmo-item__meta' }, `${detalle} · ${r.bpm} bpm`)
        ),
        h('div', { class: 'ritmo-item__acciones' },
          h('button', {
            type: 'button', class: 'mini-btn',
            'data-accion': 'cargar', 'data-id': r.id,
          }, 'Cargar'),
          h('button', {
            type: 'button', class: 'mini-btn',
            'data-accion': 'eliminar-ritmo', 'data-id': r.id,
          }, '×')
        )
      ));
    }
    cuerpo.append(lista);
  }

  abrirSheet({
    titulo: 'Ritmos guardados',
    cuerpo,
    onAbrir(sheet) {
      sheet.querySelectorAll('[data-accion="cargar"]').forEach((b) => {
        b.addEventListener('click', () => {
          cargarRitmo(b.dataset.id);
          cerrarSheet();
        });
      });
      sheet.querySelectorAll('[data-accion="eliminar-ritmo"]').forEach((b) => {
        b.addEventListener('click', async () => {
          const id = b.dataset.id;
          const ritmo = registro.guardados.find((r) => r.id === id);
          const ok = await mostrarConfirmacion(
            'Eliminar ritmo',
            `¿Seguro que quieres eliminar "${ritmo ? ritmo.nombre : 'este ritmo'}"?`,
            { textoConfirmar: 'Eliminar' }
          );
          if (!ok) return;
          const r = await repoRitmos.eliminar(id);
          if (r.exito) {
            await refrescarGuardados();
            cerrarSheet();
            setTimeout(() => abrirSheetGuardados(), 340);
            pintarOk('Ritmo eliminado.');
          } else {
            pintarError(r.error);
          }
        });
      });
    },
  });
}

/* ── Sheet: guardar nombre ── */
function abrirSheetGuardar() {
  const input = h('input', {
    type: 'text',
    class: 'campo-nombre',
    placeholder: 'Nombre del ritmo',
    maxlength: '100',
  });

  const botonGuardar = h('button', {
    type: 'button', class: 'boton-accion boton-accion--principal',
    style: 'flex: 2;',
  }, 'Guardar');

  botonGuardar.addEventListener('click', async () => {
    const nombre = input.value.trim();
    if (!nombre) {
      input.focus();
      return;
    }
    await guardarRitmo(nombre);
    cerrarSheet();
  });

  const cuerpo = h('div', {},
    input,
    h('div', { style: 'display: flex; gap: 8px;' },
      h('button', {
        type: 'button', class: 'boton-accion',
        style: 'flex: 1;',
        onclick: () => cerrarSheet(),
      }, 'Cancelar'),
      botonGuardar
    )
  );

  abrirSheet({
    titulo: 'Guardar ritmo',
    cuerpo,
    onAbrir() {
      setTimeout(() => input.focus(), 100);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') botonGuardar.click();
      });
    },
  });
}

/* ================================================================
   Guardar / cargar / refrescar
   ================================================================ */

async function guardarRitmo(nombre) {
  motor.detener();
  sincronizarPlay();

  const comunes = {
    nombre,
    bpm: registro.bpm,
    swing: registro.swing,
  };

  let payload;
  if (registro.modo === 'simple') {
    payload = {
      ...comunes,
      patron: registro.filas,
      modo: 'simple',
      estiloId: '',
      familia: '',
      efectos: null,
      volumen: null,
      silenciados: null,
      solistas: null,
    };
  } else {
    payload = {
      ...comunes,
      patron: registro.patron,
      modo: 'extendido',
      estiloId: registro.estilo.id,
      familia: 'afr',
      efectos: registro.efectos,
      volumen: registro.volumen,
      silenciados: registro.silenciados,
      solistas: registro.solistas,
    };
  }

  const r = await repoRitmos.crear(payload);
  if (r.exito) {
    await refrescarGuardados();
    pintarOk(`Ritmo guardado: ${nombre}`);
  } else {
    pintarError(r.error);
  }
}

function cargarRitmo(id) {
  const ritmo = registro.guardados.find((r) => r.id === id);
  if (!ritmo) return;

  if (!ritmo.patron || ritmo.patron.length === 0) {
    pintarError('Ese ritmo tiene un formato antiguo que no se puede cargar.');
    return;
  }

  motor.detener();
  registro.pasoActual = -1;

  if (ritmo.modo === 'simple') {
    registro.modo = 'simple';
    registro.filas = clonarFilas(ritmo.patron);
    registro.bpm = ritmo.bpm;
    registro.swing = ritmo.swing != null ? ritmo.swing : 0;
    pintar();
    pintarOk(`Cargado: ${ritmo.nombre}`);
    return;
  }

  const estilo = motor.buscarEstiloExtendido(ritmo.estiloId);
  if (!estilo) {
    pintarError('Ese ritmo apunta a un estilo que ya no existe.');
    return;
  }
  registro.modo = 'extendido';
  registro.estilo = estilo;
  registro.patron = clonarPatron(ritmo.patron);
  registro.bpm = ritmo.bpm;
  registro.swing = ritmo.swing != null ? ritmo.swing : estilo.swing;

  // Restaurar estado del instrumento. Si el ritmo no trae estos
  // campos (formato anterior a v1.6.0), se aplican los defaults
  // del estilo sin romper.
  registro.efectos = ritmo.efectos || { ...estilo.efectos };
  registro.volumen = Array.isArray(ritmo.volumen) && ritmo.volumen.length === 7
    ? ritmo.volumen.slice()
    : VOL_INICIAL.slice();
  registro.silenciados = Array.isArray(ritmo.silenciados) && ritmo.silenciados.length === 7
    ? ritmo.silenciados.slice()
    : Array(7).fill(false);
  registro.solistas = Array.isArray(ritmo.solistas) && ritmo.solistas.length === 7
    ? ritmo.solistas.slice()
    : Array(7).fill(false);

  pintar();
  pintarOk(`Cargado: ${ritmo.nombre}`);
}

async function refrescarGuardados() {
  const r = await repoRitmos.listar();
  if (r.exito) {
    registro.guardados = r.datos;
  } else {
    log.error('Error al listar ritmos:', r.error);
  }
}

/* ================================================================
   Config para el motor
   ================================================================ */

function armarConfig() {
  if (registro.modo === 'simple') {
    return {
      modo: 'simple',
      bpm: registro.bpm,
      swing: registro.swing,
      filas: registro.filas,
    };
  }
  return {
    modo: 'extendido',
    bpm: registro.bpm,
    swing: registro.swing,
    raiz: registro.estilo.raiz,
    escala: registro.estilo.escala,
    patron: registro.patron,
    efectos: registro.efectos,
    volumen: registro.volumen,
    silenciados: registro.silenciados,
    solistas: registro.solistas,
  };
}

/* ================================================================
   Reproducción
   ================================================================ */

function alternarReproduccion() {
  if (motor.estaReproduciendo()) {
    motor.detener();
    marcarPaso(-1);
    sincronizarPlay();
    return;
  }
  const ok = motor.arrancar(armarConfig(), (paso) => marcarPaso(paso));
  if (ok) sincronizarPlay();
}

function marcarPaso(c) {
  registro.pasoActual = c;
  if (!registro.raiz) return;
  registro.raiz.querySelectorAll('.perc-celda--actual').forEach((n) => {
    n.classList.remove('perc-celda--actual');
  });
  if (c < 0) return;
  registro.raiz.querySelectorAll(`.perc-celda[data-col="${c}"]`).forEach((n) => {
    n.classList.add('perc-celda--actual');
  });
}

function sincronizarPlay() {
  if (!registro.raiz) return;
  const btn = registro.raiz.querySelector('[data-accion="play"]');
  if (!btn) return;
  btn.innerHTML = motor.estaReproduciendo() ? ICONO_PARAR : ICONO_PLAY;
}

/* ================================================================
   Ciclado de celdas
   ================================================================ */

function ciclarSimple(fila, col) {
  const f = registro.filas[fila];
  f.pasos[col] = (f.pasos[col] + 1) % 4;
  if (f.pasos[col]) {
    motor.tocarVozSimple(fila, motor.FUERZAS[f.pasos[col]], armarConfig());
  }
  pintar();
}

function ciclarExtendido(fila, col) {
  if (fila < motor.VOCES_RITMICAS) {
    registro.patron[fila][col] = (registro.patron[fila][col] + 1) % 4;
    if (registro.patron[fila][col]) {
      motor.tocarVozExtendida(fila, motor.FUERZAS[registro.patron[fila][col]], 0, armarConfig());
    }
  } else {
    const actual = registro.patron[fila][col];
    let siguiente;
    if (actual < 0) siguiente = 0;
    else if (actual >= 11) siguiente = -1;
    else siguiente = actual + 1;
    registro.patron[fila][col] = siguiente;
    if (siguiente >= 0) {
      motor.tocarVozExtendida(fila, 0.85, siguiente, armarConfig());
    }
  }
  pintar();
}

/* ================================================================
   Manejo de eventos
   ================================================================ */

function manejarClick(ev) {
  const btn = ev.target.closest('button');
  if (!btn) return;

  // Celda.
  if (btn.classList.contains('perc-celda')) {
    const fila = Number(btn.dataset.fila);
    const col = Number(btn.dataset.col);
    if (registro.modo === 'simple') ciclarSimple(fila, col);
    else ciclarExtendido(fila, col);
    return;
  }

  // Selector de sonido.
  if (btn.classList.contains('perc-voz__selector')) {
    abrirSheetSonido(Number(btn.dataset.fila));
    return;
  }

  // Chips de estilo.
  if (btn.dataset.accion === 'estilo') {
    cargarEstiloExtendido(btn.dataset.estilo);
    return;
  }

  const accion = btn.dataset.accion;

  if (accion === 'cambiar-modo') {
    const nuevo = btn.dataset.modo;
    if (nuevo === registro.modo) return;
    motor.detener();
    registro.modo = nuevo;
    registro.pasoActual = -1;
    if (nuevo === 'simple') {
      registro.bpm = 90;
      registro.swing = 0;
      cargarInicialSimple();
    } else {
      if (!registro.estilo) registro.estilo = motor.ESTILOS_EXTENDIDOS[0];
      cargarEstiloExtendido(registro.estilo.id);
      return;
    }
    pintar();
    return;
  }

  if (accion === 'play') { alternarReproduccion(); return; }

  if (accion === 'reset') {
    if (registro.modo === 'simple') {
      cargarInicialSimple();
    } else {
      cargarEstiloExtendido(registro.estilo.id);
      return;
    }
    pintar();
    return;
  }

  if (accion === 'limpiar') {
    if (registro.modo === 'simple') {
      for (let f = 0; f < motor.FILAS_SIMPLE; f++) {
        registro.filas[f].pasos = Array(motor.PASOS_SIMPLE).fill(0);
      }
    } else {
      for (let f = 0; f < motor.FILAS_EXTENDIDO; f++) {
        if (f < motor.VOCES_RITMICAS) {
          registro.patron[f] = Array(motor.PASOS_EXTENDIDO).fill(0);
        } else {
          registro.patron[f] = Array(motor.PASOS_EXTENDIDO).fill(-1);
        }
      }
    }
    pintar();
    return;
  }

  if (accion === 'abrir-guardar') {
    abrirSheetGuardar();
    return;
  }

  if (btn.dataset.sheet === 'mezcla') { abrirSheetMezcla(); return; }
  if (btn.dataset.sheet === 'efectos') { abrirSheetEfectos(); return; }
  if (btn.dataset.sheet === 'guardados') { abrirSheetGuardados(); return; }
}

function manejarInput(ev) {
  const slider = ev.target.closest('input[data-accion]');
  if (!slider) return;
  const accion = slider.dataset.accion;

  if (accion === 'bpm') {
    registro.bpm = Number(slider.value);
    motor.actualizar({ bpm: registro.bpm });
    const val = slider.parentNode.querySelector('.perc-slider__valor');
    if (val) val.textContent = String(registro.bpm);
    return;
  }
  if (accion === 'swing') {
    registro.swing = Number(slider.value);
    motor.actualizar({ swing: registro.swing });
    const val = slider.parentNode.querySelector('.perc-slider__valor');
    if (val) val.textContent = registro.swing + '%';
    return;
  }
}

/* ================================================================
   Cargar estilo / inicial
   ================================================================ */

function cargarInicialSimple() {
  registro.filas = clonarFilas(motor.PATRON_INICIAL_SIMPLE);
  registro.bpm = 90;
  registro.swing = 0;
}

function cargarEstiloExtendido(id) {
  const estilo = motor.buscarEstiloExtendido(id);
  if (!estilo) return;
  motor.detener();
  registro.pasoActual = -1;

  registro.estilo = estilo;
  registro.patron = motor.normalizarPatronExtendido(estilo.patrones, estilo.escala);
  registro.bpm = estilo.bpm;
  registro.swing = estilo.swing;
  registro.efectos = { ...estilo.efectos };
  registro.volumen = VOL_INICIAL.slice();
  registro.silenciados = Array(7).fill(false);
  registro.solistas = Array(7).fill(false);

  pintar();
}

/* ================================================================
   Ciclo de vida
   ================================================================ */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.modo = 'simple';
  registro.pasoActual = -1;
  registro.sheetActivo = null;
  registro.abortadorSheet = null;

  // Estado por defecto del modo simple.
  cargarInicialSimple();

  // Estado por defecto del modo extendido (no visible hasta cambiar).
  if (!registro.estilo) {
    registro.estilo = motor.ESTILOS_EXTENDIDOS[0];
    registro.patron = motor.normalizarPatronExtendido(
      registro.estilo.patrones,
      registro.estilo.escala
    );
  }
  registro.volumen = VOL_INICIAL.slice();
  registro.silenciados = Array(7).fill(false);
  registro.solistas = Array(7).fill(false);
  registro.efectos = { eco: 12, reverb: 10, saturacion: 35, filtro: 100 };

  const { signal } = registro.abortador;
  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('input', manejarInput, { signal });

  registro.desuscribir = [
    al('realtime:ritmos:crear', async () => { await refrescarGuardados(); }),
    al('realtime:ritmos:eliminar', async () => { await refrescarGuardados(); }),
  ];

  await refrescarGuardados();
  pintar();
}

export function limpiar() {
  motor.detener();
  cerrarSheet();

  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;

  if (registro.contenedor) limpiarContenedor(registro.contenedor);

  registro.contenedor = null;
  registro.raiz = null;
  registro.sheetActivo = null;
  registro.abortadorSheet = null;
  registro.filas = [];
  registro.patron = [];
  registro.guardados = [];
  registro.pasoActual = -1;
}