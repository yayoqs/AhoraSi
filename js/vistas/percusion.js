/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/percusion.js
   Versión: 3.0.0
   Propósito: vista del secuenciador. Dos modos:
              - Simple: 4 filas intercambiables con 8 pasos. Cada
                fila elige un sonido de un catálogo de 12. Sonido
                inicial: rap 90 underground.
              - Extendido: 7 voces afro, 16 pasos, con 3 estilos
                preset, mezcla y efectos.
              v3.0.0: reescritura completa. Se abandonan las
                      familias Cumbia/Afro y se introduce el
                      selector de modo. Los ritmos guardados
                      distinguen modo.
              v2.0.0: beatmaker de 7 voces con familias.
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
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:percusion');

const COLORES_SIMPLE = ['#E3BC55', '#EBA9A2', '#8DB7D8', '#9BE0B5'];
const COLORES_EXT = ['#E3BC55','#EBA9A2','#8DB7D8','#9BE0B5','#F2C879','#C4AEEB','#F29E6B'];
const VOL_INICIAL = [1.0, 0.8, 0.8, 0.6, 0.55, 0.9, 0.55];

const registro = {
  contenedor: null,
  raiz: null,
  abortador: null,
  desuscribir: [],

  modo: 'simple',

  // Simple.
  filas: [],
  sonidoIdSeleccionado: null,   // para el modal de selección de sonido

  // Extendido.
  estilo: null,
  patron: [],
  volumen: VOL_INICIAL.slice(),
  silenciados: Array(7).fill(false),
  solistas: Array(7).fill(false),
  efectos: { reverb: 10, eco: 12, saturacion: 35, filtro: 100 },

  bpm: 90,
  swing: 0,

  // UI.
  pasoActual: -1,
  mezclaAbierta: false,
  efectosAbiertos: false,
  formularioGuardarAbierto: false,
  guardados: [],
  modalSonido: null,
};

/* ---------- Utilidades ----------------------------------------- */

function clonarFilas(filas) {
  return filas.map((f) => ({ sonidoId: f.sonidoId, pasos: f.pasos.slice() }));
}

function clonarPatron(p) {
  return p.map((fila) => fila.slice());
}

/* ---------- Mensajes ------------------------------------------ */

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

/* ---------- Estructura ---------------------------------------- */

function montarEstructura() {
  const cont = registro.contenedor;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-percusion', class: 'vista vista--percusion' });
  cont.append(raiz);
  registro.raiz = raiz;

  raiz.append(
    h('header', { class: 'perc__cabecera' },
      h('h1', {}, 'Percusión'),
      h('p', { class: 'vista__lead' }, 'Arma un ritmo. Toca una celda para cambiar su fuerza.')
    ),
    h('div', { class: 'perc__modos' },
      h('button', {
        type: 'button', class: 'perc__modo-btn',
        'data-accion': 'cambiar-modo', 'data-modo': 'simple',
      }, 'Simple'),
      h('button', {
        type: 'button', class: 'perc__modo-btn',
        'data-accion': 'cambiar-modo', 'data-modo': 'extendido',
      }, 'Extendido')
    ),
    h('div', { class: 'perc__cuerpo', id: 'perc-cuerpo' })
  );

  registro.cuerpoEl = raiz.querySelector('#perc-cuerpo');
}

/* ================================================================
   MODO SIMPLE
   ================================================================ */

function pintarSimple() {
  const cont = registro.cuerpoEl;
  limpiarContenedor(cont);

  cont.append(
    h('div', { class: 'perc__nota' },
      h('b', {}, 'Rápido y directo. '),
      document.createTextNode('Cuatro voces intercambiables, ocho pasos. Elige el sonido de cada fila.')
    ),
    h('div', { class: 'perc__grilla perc__grilla--simple', id: 'perc-grilla-simple' }),
    pintarControles(),
    h('div', { class: 'perc__controles perc__controles--fila' },
      h('button', {
        type: 'button', class: 'btn-sec', 'data-accion': 'reset-simple',
      }, 'Reset'),
      h('button', {
        type: 'button', class: 'btn-sec', 'data-accion': 'limpiar-simple',
      }, 'Limpiar'),
      h('button', {
        type: 'button', class: 'btn-sec btn-sec--principal', 'data-accion': 'abrir-guardar',
      }, 'Guardar ritmo')
    ),
    h('div', { class: 'perc__guardar-zona', id: 'perc-guardar-zona' }),
    h('h2', { class: 'vista__subtitulo' }, 'Ritmos guardados'),
    h('div', { class: 'perc__guardados', id: 'perc-guardados' })
  );

  registro.grillaSimpleEl = cont.querySelector('#perc-grilla-simple');
  registro.guardarZonaEl = cont.querySelector('#perc-guardar-zona');
  registro.guardadosEl = cont.querySelector('#perc-guardados');

  pintarGrillaSimple();
  pintarGuardarZona();
  pintarGuardados();
  pintarControles();
}

function pintarGrillaSimple() {
  const g = registro.grillaSimpleEl;
  if (!g) return;
  limpiarContenedor(g);

  registro.filas.forEach((fila, f) => {
    const bloque = h('div', { class: 'perc__voz perc__voz--simple' });

    const cab = h('div', { class: 'perc__voz-cab' });
    const num = h('span', { class: 'perc__voz-numero' });
    num.style.background = COLORES_SIMPLE[f];
    num.textContent = String(f + 1);
    cab.append(num);

    const sonido = motor.buscarSonidoSimple(fila.sonidoId);
    const selector = h('button', {
      type: 'button',
      class: 'perc__selector-sonido',
      'data-accion': 'abrir-sonidos',
      'data-fila': String(f),
    }, sonido ? sonido.nombre : 'Elegir sonido');
    cab.append(selector);

    const escuchar = h('button', {
      type: 'button', class: 'perc__escuchar',
      'data-accion': 'escuchar-simple', 'data-fila': String(f),
    }, 'Escuchar');
    cab.append(escuchar);

    bloque.append(cab);

    const pasos = h('div', { class: 'perc__pasos perc__pasos--simple' });
    for (let c = 0; c < motor.PASOS_SIMPLE; c++) {
      const celda = h('button', {
        type: 'button',
        class: 'perc__celda' + ((c === 0 || c === 4) ? ' perc__celda--marca' : ''),
        'data-fila': String(f),
        'data-col': String(c),
      });
      const nivel = fila.pasos[c];
      if (nivel) {
        const alpha = Math.round(Math.max(0.35, motor.FUERZAS[nivel]) * 255).toString(16).padStart(2, '0');
        celda.style.background = COLORES_SIMPLE[f] + alpha;
        celda.style.borderColor = COLORES_SIMPLE[f];
      }
      pasos.append(celda);
    }
    bloque.append(pasos);
    g.append(bloque);
  });
}

/* ================================================================
   MODAL DE SELECCIÓN DE SONIDO
   ================================================================ */

function abrirModalSonido(indiceFila) {
  cerrarModalSonido();
  const actual = registro.filas[indiceFila].sonidoId;

  const overlay = h('div', { class: 'perc__modal' });
  const tarjeta = h('div', { class: 'perc__modal-tarjeta' });

  tarjeta.append(h('h3', { class: 'perc__modal-titulo' }, 'Elegir sonido'));

  for (const cat of motor.CATEGORIAS_SIMPLES) {
    const grupo = h('div', { class: 'perc__modal-grupo' });
    grupo.append(h('p', { class: 'perc__modal-categoria' }, cat));
    const chips = h('div', { class: 'perc__modal-chips' });
    for (const s of motor.SONIDOS_SIMPLES.filter((x) => x.cat === cat)) {
      chips.append(h('button', {
        type: 'button',
        class: 'chip',
        'data-accion': 'elegir-sonido',
        'data-sonido': s.id,
        'data-fila': String(indiceFila),
        'aria-pressed': String(s.id === actual),
      }, s.nombre));
    }
    grupo.append(chips);
    tarjeta.append(grupo);
  }

  tarjeta.append(
    h('div', { class: 'perc__modal-pie' },
      h('button', {
        type: 'button', class: 'btn-sec', 'data-accion': 'cerrar-modal',
      }, 'Cerrar')
    )
  );

  overlay.append(tarjeta);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) cerrarModalSonido();
  });

  document.body.append(overlay);
  overlay.offsetWidth;
  overlay.classList.add('perc__modal--visible');
  registro.modalSonido = overlay;
}

function cerrarModalSonido() {
  const m = registro.modalSonido;
  if (!m) return;
  m.classList.remove('perc__modal--visible');
  setTimeout(() => {
    if (m.parentNode) m.remove();
  }, 200);
  registro.modalSonido = null;
}

function elegirSonido(indiceFila, sonidoId) {
  registro.filas[indiceFila].sonidoId = sonidoId;
  cerrarModalSonido();
  pintarGrillaSimple();
  // Escuchar el nuevo sonido al vuelo.
  motor.tocarSonidoSimple(sonidoId);
}

/* ================================================================
   MODO EXTENDIDO
   ================================================================ */

function pintarExtendido() {
  const cont = registro.cuerpoEl;
  limpiarContenedor(cont);

  cont.append(
    h('div', { class: 'perc__subtitulo' }, 'Estilo'),
    h('div', { class: 'perc__chips', id: 'perc-chips-estilo' }),
    h('div', { class: 'perc__info', id: 'perc-info' }),
    h('div', { class: 'perc__grilla', id: 'perc-grilla-ext' }),
    pintarControles(),
    h('div', { class: 'perc__controles perc__controles--fila' },
      h('button', {
        type: 'button', class: 'btn-sec', 'data-accion': 'toggle-mezcla',
        'aria-pressed': 'false',
      }, 'Mezcla'),
      h('button', {
        type: 'button', class: 'btn-sec', 'data-accion': 'toggle-efectos',
        'aria-pressed': 'false',
      }, 'Efectos'),
      h('button', {
        type: 'button', class: 'btn-sec', 'data-accion': 'reset-ext',
      }, 'Reset'),
      h('button', {
        type: 'button', class: 'btn-sec', 'data-accion': 'limpiar-ext',
      }, 'Limpiar'),
      h('button', {
        type: 'button', class: 'btn-sec btn-sec--principal', 'data-accion': 'abrir-guardar',
      }, 'Guardar ritmo')
    ),
    h('div', { class: 'perc__panel', id: 'perc-panel-mezcla', hidden: '' }),
    h('div', { class: 'perc__panel', id: 'perc-panel-efectos', hidden: '' }),
    h('div', { class: 'perc__guardar-zona', id: 'perc-guardar-zona' }),
    h('h2', { class: 'vista__subtitulo' }, 'Ritmos guardados'),
    h('div', { class: 'perc__guardados', id: 'perc-guardados' })
  );

  registro.chipsEstiloEl = cont.querySelector('#perc-chips-estilo');
  registro.infoEl = cont.querySelector('#perc-info');
  registro.grillaExtEl = cont.querySelector('#perc-grilla-ext');
  registro.panelMezclaEl = cont.querySelector('#perc-panel-mezcla');
  registro.panelEfectosEl = cont.querySelector('#perc-panel-efectos');
  registro.guardarZonaEl = cont.querySelector('#perc-guardar-zona');
  registro.guardadosEl = cont.querySelector('#perc-guardados');

  pintarChipsEstilo();
  pintarInfoExt();
  pintarGrillaExt();
  pintarMezcla();
  pintarEfectos();
  pintarGuardarZona();
  pintarGuardados();
  pintarControles();
}

function pintarChipsEstilo() {
  const cont = registro.chipsEstiloEl;
  if (!cont) return;
  limpiarContenedor(cont);
  for (const est of motor.ESTILOS_EXTENDIDOS) {
    cont.append(h('button', {
      type: 'button',
      class: 'chip',
      'data-accion': 'estilo-ext',
      'data-estilo': est.id,
      'aria-pressed': String(est.id === registro.estilo.id),
    }, est.nombre));
  }
}

function pintarInfoExt() {
  const cont = registro.infoEl;
  if (!cont) return;
  limpiarContenedor(cont);
  const escala = motor.ESCALAS[registro.estilo.escala];
  const tonica = motor.nombreNota(registro.estilo.raiz);
  cont.append(
    h('span', { class: 'perc__info-titulo' },
      `${registro.estilo.nombre} · ${registro.bpm} bpm.`),
    h('span', {}, ' ' + registro.estilo.descripcion),
    h('br'),
    h('span', { class: 'perc__info-detalle' },
      `Tónica: ${tonica} · Escala base: ${escala.nombre}`)
  );
}

function pintarGrillaExt() {
  const g = registro.grillaExtEl;
  if (!g) return;
  limpiarContenedor(g);

  const voces = motor.NOMBRES_VOCES_EXTENDIDO;

  for (let fila = 0; fila < motor.FILAS_EXTENDIDO; fila++) {
    const contenedor = h('div', {
      class: 'perc__voz' + (fila >= motor.VOCES_RITMICAS ? ' perc__voz--notas' : ''),
    });

    const nombre = h('div', { class: 'perc__voz-nombre' });
    nombre.style.color = COLORES_EXT[fila];
    nombre.append(h('span', {}, voces[fila]));
    if (fila >= motor.VOCES_RITMICAS) {
      nombre.append(h('small', {}, 'Click cambia nota'));
    }
    contenedor.append(nombre);

    contenedor.append(pintarFilaDePasosExt(fila, 0, voces));
    contenedor.append(pintarFilaDePasosExt(fila, 8, voces));

    g.append(contenedor);
  }
}

function pintarFilaDePasosExt(fila, inicio, voces) {
  const contenedor = h('div', { class: 'perc__pasos' });
  for (let i = 0; i < 8; i++) {
    const c = inicio + i;
    const celda = h('button', {
      type: 'button',
      class: 'perc__celda',
      'data-fila': String(fila),
      'data-col': String(c),
      'aria-label': `${voces[fila]}, paso ${c + 1}`,
    });

    if (fila < motor.VOCES_RITMICAS) {
      const nivel = registro.patron[fila][c];
      if (nivel) {
        const alpha = Math.round(Math.max(0.35, motor.FUERZAS[nivel]) * 255).toString(16).padStart(2, '0');
        celda.style.background = COLORES_EXT[fila] + alpha;
        celda.style.borderColor = COLORES_EXT[fila];
      }
    } else {
      const semitono = registro.patron[fila][c];
      if (semitono >= 0) {
        const offset = fila === 5 ? 12 : 24;
        const midi = registro.estilo.raiz + offset + semitono;
        celda.textContent = motor.nombreNota(midi);
        celda.style.background = COLORES_EXT[fila];
        celda.style.borderColor = COLORES_EXT[fila];
      }
    }
    contenedor.append(celda);
  }
  return contenedor;
}

/* ================================================================
   CONTROLES COMUNES
   ================================================================ */

function pintarControles() {
  const bpmMin = registro.modo === 'simple' ? 60 : 70;
  const bpmMax = registro.modo === 'simple' ? 160 : 140;

  return h('div', { class: 'perc__controles' },
    h('button', {
      type: 'button', class: 'perc__play', 'data-accion': 'play',
    }, motor.estaReproduciendo() ? 'Parar' : 'Tocar'),
    h('label', { class: 'perc__slider' }, 'Tempo',
      h('input', {
        type: 'range',
        min: String(bpmMin), max: String(bpmMax), step: '1',
        value: String(registro.bpm),
        'data-accion': 'bpm',
      }),
      h('b', { class: 'perc__slider-valor', id: 'perc-bpm-valor' }, String(registro.bpm))
    ),
    h('label', { class: 'perc__slider' }, 'Swing',
      h('input', {
        type: 'range',
        min: '0', max: '50', step: '1',
        value: String(registro.swing),
        'data-accion': 'swing',
      }),
      h('b', { class: 'perc__slider-valor', id: 'perc-swing-valor' }, registro.swing + '%')
    )
  );
}

function pintarControlesEstado() {
  const btnPlay = registro.raiz.querySelector('[data-accion="play"]');
  if (btnPlay) btnPlay.textContent = motor.estaReproduciendo() ? 'Parar' : 'Tocar';
}

/* ================================================================
   PANELES (EXTENDIDO)
   ================================================================ */

function pintarMezcla() {
  const cont = registro.panelMezclaEl;
  if (!cont) return;
  limpiarContenedor(cont);

  cont.append(h('div', { class: 'perc__panel-titulo' }, 'Volumen por voz'));

  motor.NOMBRES_VOCES_EXTENDIDO.forEach((nombre, i) => {
    const fila = h('div', { class: 'perc__mezcla-fila' });
    const label = h('label', {});
    label.style.color = COLORES_EXT[i];
    label.textContent = nombre;
    fila.append(label);

    fila.append(h('input', {
      type: 'range', min: '0', max: '100', step: '1',
      value: String(Math.round(registro.volumen[i] * 100)),
      'data-accion': 'volumen', 'data-fila': String(i),
    }));

    const acciones = h('span', { class: 'perc__mezcla-acciones' });
    acciones.append(h('button', {
      type: 'button',
      class: 'btn-mini' + (registro.silenciados[i] ? ' btn-mini--mute' : ''),
      'data-accion': 'silenciar', 'data-fila': String(i),
    }, 'M'));
    acciones.append(h('button', {
      type: 'button',
      class: 'btn-mini' + (registro.solistas[i] ? ' btn-mini--mute btn-mini--solo' : ''),
      'data-accion': 'solo', 'data-fila': String(i),
    }, 'S'));
    fila.append(acciones);

    cont.append(fila);
  });
}

function pintarEfectos() {
  const cont = registro.panelEfectosEl;
  if (!cont) return;
  limpiarContenedor(cont);

  const defs = [
    ['reverb', 'Reverb'],
    ['eco', 'Eco'],
    ['saturacion', 'Saturación'],
    ['filtro', 'Filtro'],
  ];

  cont.append(h('div', { class: 'perc__panel-titulo' }, 'Efectos globales'));

  for (const [clave, etiqueta] of defs) {
    const fila = h('div', { class: 'perc__mezcla-fila' });
    fila.append(h('label', {}, etiqueta));

    fila.append(h('input', {
      type: 'range', min: '0', max: '100', step: '1',
      value: String(registro.efectos[clave]),
      'data-accion': 'efecto', 'data-efecto': clave,
    }));

    fila.append(h('span', {
      class: 'perc__valor-efecto',
      id: 'perc-valor-' + clave,
    }, String(registro.efectos[clave])));

    cont.append(fila);
  }
}

/* ================================================================
   GUARDAR Y LISTAR
   ================================================================ */

function pintarGuardarZona() {
  const cont = registro.guardarZonaEl;
  if (!cont) return;
  limpiarContenedor(cont);
  if (!registro.formularioGuardarAbierto) return;

  const form = h('form', { class: 'perc__guardar', 'data-accion': 'guardar' },
    h('input', {
      type: 'text', name: 'nombre',
      placeholder: 'Nombre del ritmo (ej. Base del domingo)',
      maxlength: '100', required: true,
    }),
    h('div', { class: 'perc__guardar-botones' },
      h('button', {
        type: 'button', class: 'btn-sec', 'data-accion': 'cerrar-guardar',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'perc__guardar-enviar' }, 'Guardar')
    )
  );
  cont.append(form);
  setTimeout(() => {
    const input = form.querySelector('input[name="nombre"]');
    if (input) input.focus();
  }, 60);
}

function pintarGuardados() {
  const cont = registro.guardadosEl;
  if (!cont) return;
  limpiarContenedor(cont);

  if (registro.guardados.length === 0) {
    cont.append(h('p', { class: 'vista__vacio' }, 'Aún no hay ritmos guardados.'));
    return;
  }

  const ul = h('ul', { class: 'vista__lista' });
  for (const r of registro.guardados) {
    const etiquetaModo = r.modo === 'simple' ? 'Simple' : 'Extendido';
    const estilo = r.modo === 'extendido' && r.estiloId
      ? motor.buscarEstiloExtendido(r.estiloId)
      : null;
    const detalle = estilo ? estilo.nombre : etiquetaModo;

    ul.append(h('li', { class: 'vista__item', 'data-id': r.id },
      h('div', { class: 'vista__item-cabecera' },
        h('strong', {}, r.nombre),
        h('span', { class: 'perc__badge perc__badge--' + r.modo }, detalle),
        h('span', { class: 'meta' }, r.bpm + ' bpm'),
        distintivoAutor(r.creadoPor)
      ),
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', 'data-accion': 'cargar', 'data-id': r.id,
        }, 'Cargar'),
        h('button', {
          type: 'button', 'data-accion': 'eliminar', 'data-id': r.id,
        }, 'Eliminar')
      )
    ));
  }
  cont.append(ul);
}

async function refrescarGuardados() {
  const r = await repoRitmos.listar();
  if (r.exito) registro.guardados = r.datos;
  else log.error('Error al listar ritmos:', r.error);
}

/* ================================================================
   CARGAS
   ================================================================ */

function cargarInicialSimple() {
  registro.filas = clonarFilas(motor.PATRON_INICIAL_SIMPLE);
}

function cargarEstiloExtendido(id) {
  const estilo = motor.buscarEstiloExtendido(id);
  if (!estilo) return;
  motor.detener();

  registro.estilo = estilo;
  registro.patron = motor.normalizarPatronExtendido(estilo.patrones, estilo.escala);
  registro.bpm = estilo.bpm;
  registro.swing = estilo.swing;
  registro.efectos = { ...estilo.efectos };
  registro.volumen = VOL_INICIAL.slice();
  registro.silenciados = Array(7).fill(false);
  registro.solistas = Array(7).fill(false);
  registro.pasoActual = -1;

  pintarExtendido();
}

function limpiarSimple() {
  for (let f = 0; f < motor.FILAS_SIMPLE; f++) {
    registro.filas[f].pasos = Array(motor.PASOS_SIMPLE).fill(0);
  }
  pintarGrillaSimple();
}

function limpiarExtendido() {
  for (let f = 0; f < motor.FILAS_EXTENDIDO; f++) {
    if (f < motor.VOCES_RITMICAS) registro.patron[f] = Array(motor.PASOS_EXTENDIDO).fill(0);
    else registro.patron[f] = Array(motor.PASOS_EXTENDIDO).fill(-1);
  }
  pintarGrillaExt();
}

/* ================================================================
   CONFIG PARA EL MOTOR
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
   REPRODUCCIÓN
   ================================================================ */

function alternarReproduccion() {
  if (motor.estaReproduciendo()) {
    motor.detener();
    marcarPaso(-1);
    pintarControlesEstado();
    return;
  }
  const ok = motor.arrancar(armarConfig(), (paso) => marcarPaso(paso));
  if (ok) pintarControlesEstado();
}

function marcarPaso(c) {
  registro.pasoActual = c;
  registro.raiz.querySelectorAll('.perc__celda--actual').forEach((n) => {
    n.classList.remove('perc__celda--actual');
  });
  if (c < 0) return;
  registro.raiz.querySelectorAll(`.perc__celda[data-col="${c}"]`).forEach((n) => {
    n.classList.add('perc__celda--actual');
  });
}

/* ================================================================
   INTERACCIÓN CON CELDAS
   ================================================================ */

function ciclarSimple(fila, col, celda) {
  const f = registro.filas[fila];
  f.pasos[col] = (f.pasos[col] + 1) % 4;
  const nivel = f.pasos[col];
  if (nivel) {
    const alpha = Math.round(Math.max(0.35, motor.FUERZAS[nivel]) * 255).toString(16).padStart(2, '0');
    celda.style.background = COLORES_SIMPLE[fila] + alpha;
    celda.style.borderColor = COLORES_SIMPLE[fila];
    motor.tocarVozSimple(fila, motor.FUERZAS[nivel], armarConfig());
  } else {
    celda.style.background = '';
    celda.style.borderColor = '';
  }
}

function ciclarExtendido(fila, col, celda) {
  if (fila < motor.VOCES_RITMICAS) {
    registro.patron[fila][col] = (registro.patron[fila][col] + 1) % 4;
    const nivel = registro.patron[fila][col];
    if (nivel) {
      const alpha = Math.round(Math.max(0.35, motor.FUERZAS[nivel]) * 255).toString(16).padStart(2, '0');
      celda.style.background = COLORES_EXT[fila] + alpha;
      celda.style.borderColor = COLORES_EXT[fila];
      motor.tocarVozExtendida(fila, motor.FUERZAS[nivel], 0, armarConfig());
    } else {
      celda.style.background = '';
      celda.style.borderColor = '';
    }
    return;
  }
  // Melódica.
  const actual = registro.patron[fila][col];
  let siguiente;
  if (actual < 0) siguiente = 0;
  else if (actual >= 11) siguiente = -1;
  else siguiente = actual + 1;
  registro.patron[fila][col] = siguiente;
  if (siguiente >= 0) {
    const offset = fila === 5 ? 12 : 24;
    const midi = registro.estilo.raiz + offset + siguiente;
    celda.textContent = motor.nombreNota(midi);
    celda.style.background = COLORES_EXT[fila];
    celda.style.borderColor = COLORES_EXT[fila];
    motor.tocarVozExtendida(fila, 0.85, siguiente, armarConfig());
  } else {
    celda.textContent = '';
    celda.style.background = '';
    celda.style.borderColor = '';
  }
}

/* ================================================================
   MANEJO DE EVENTOS
   ================================================================ */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  if (form.dataset.accion !== 'guardar') return;

  const fd = new FormData(form);
  const nombre = String(fd.get('nombre') || '').trim();
  if (!nombre) return;

  motor.detener();
  pintarControlesEstado();

  let payload;
  if (registro.modo === 'simple') {
    payload = {
      nombre,
      bpm: registro.bpm,
      patron: registro.filas,
      modo: 'simple',
      estiloId: '',
      familia: '',
    };
  } else {
    payload = {
      nombre,
      bpm: registro.bpm,
      patron: registro.patron,
      modo: 'extendido',
      estiloId: registro.estilo.id,
      familia: 'afr',
    };
  }

  const r = await repoRitmos.crear(payload);
  if (r.exito) {
    registro.formularioGuardarAbierto = false;
    await refrescarGuardados();
    pintarGuardarZona();
    pintarGuardados();
    pintarOk(`Ritmo guardado: ${nombre}`);
  } else {
    pintarError(r.error);
  }
}

function manejarClick(ev) {
  const btn = ev.target.closest('button');
  if (!btn) return;

  // Celdas.
  if (btn.classList.contains('perc__celda')) {
    const fila = Number(btn.dataset.fila);
    const col = Number(btn.dataset.col);
    if (registro.modo === 'simple') ciclarSimple(fila, col, btn);
    else ciclarExtendido(fila, col, btn);
    return;
  }

  const accion = btn.dataset.accion;
  if (!accion) return;

  if (accion === 'cambiar-modo') {
    const nuevo = btn.dataset.modo;
    if (nuevo === registro.modo) return;
    motor.detener();
    registro.modo = nuevo;
    registro.formularioGuardarAbierto = false;
    registro.mezclaAbierta = false;
    registro.efectosAbiertos = false;
    registro.pasoActual = -1;
    if (nuevo === 'simple') {
      registro.bpm = 90;
      registro.swing = 0;
      cargarInicialSimple();
      pintarSimple();
    } else {
      cargarEstiloExtendido(registro.estilo.id || motor.ESTILOS_EXTENDIDOS[0].id);
    }
    pintarModos();
    return;
  }

  if (accion === 'play') { alternarReproduccion(); return; }

  // Simple.
  if (accion === 'abrir-sonidos') {
    abrirModalSonido(Number(btn.dataset.fila));
    return;
  }
  if (accion === 'elegir-sonido') {
    elegirSonido(Number(btn.dataset.fila), btn.dataset.sonido);
    return;
  }
  if (accion === 'cerrar-modal') {
    cerrarModalSonido();
    return;
  }
  if (accion === 'escuchar-simple') {
    const f = registro.filas[Number(btn.dataset.fila)];
    if (f) motor.tocarSonidoSimple(f.sonidoId);
    return;
  }
  if (accion === 'reset-simple') {
    cargarInicialSimple();
    pintarGrillaSimple();
    return;
  }
  if (accion === 'limpiar-simple') {
    limpiarSimple();
    return;
  }

  // Extendido.
  if (accion === 'estilo-ext') {
    cargarEstiloExtendido(btn.dataset.estilo);
    return;
  }
  if (accion === 'reset-ext') {
    cargarEstiloExtendido(registro.estilo.id);
    return;
  }
  if (accion === 'limpiar-ext') {
    limpiarExtendido();
    return;
  }
  if (accion === 'toggle-mezcla') {
    registro.mezclaAbierta = !registro.mezclaAbierta;
    if (registro.mezclaAbierta) registro.efectosAbiertos = false;
    pintarPaneles();
    return;
  }
  if (accion === 'toggle-efectos') {
    registro.efectosAbiertos = !registro.efectosAbiertos;
    if (registro.efectosAbiertos) registro.mezclaAbierta = false;
    pintarPaneles();
    return;
  }
  if (accion === 'silenciar') {
    const i = Number(btn.dataset.fila);
    registro.silenciados[i] = !registro.silenciados[i];
    motor.actualizar({ silenciados: registro.silenciados });
    pintarMezcla();
    return;
  }
  if (accion === 'solo') {
    const i = Number(btn.dataset.fila);
    registro.solistas[i] = !registro.solistas[i];
    motor.actualizar({ solistas: registro.solistas });
    pintarMezcla();
    return;
  }

  // Comunes.
  if (accion === 'abrir-guardar') {
    registro.formularioGuardarAbierto = true;
    pintarGuardarZona();
    return;
  }
  if (accion === 'cerrar-guardar') {
    registro.formularioGuardarAbierto = false;
    pintarGuardarZona();
    return;
  }
  if (accion === 'cargar') {
    cargarRitmo(btn.dataset.id);
    return;
  }
  if (accion === 'eliminar') {
    eliminarRitmo(btn.dataset.id);
    return;
  }
}

function manejarInput(ev) {
  const slider = ev.target.closest('input[data-accion]');
  if (!slider) return;
  const accion = slider.dataset.accion;

  if (accion === 'bpm') {
    registro.bpm = Number(slider.value);
    const valor = registro.raiz.querySelector('#perc-bpm-valor');
    if (valor) valor.textContent = String(registro.bpm);
    motor.actualizar({ bpm: registro.bpm });
    return;
  }
  if (accion === 'swing') {
    registro.swing = Number(slider.value);
    const valor = registro.raiz.querySelector('#perc-swing-valor');
    if (valor) valor.textContent = registro.swing + '%';
    motor.actualizar({ swing: registro.swing });
    return;
  }
  if (accion === 'volumen') {
    const i = Number(slider.dataset.fila);
    registro.volumen[i] = Number(slider.value) / 100;
    motor.actualizar({ volumen: registro.volumen });
    return;
  }
  if (accion === 'efecto') {
    const clave = slider.dataset.efecto;
    registro.efectos[clave] = Number(slider.value);
    const valor = registro.raiz.querySelector('#perc-valor-' + clave);
    if (valor) valor.textContent = String(registro.efectos[clave]);
    motor.actualizar({ efectos: registro.efectos });
    return;
  }
}

/* ================================================================
   CARGAR Y ELIMINAR RITMOS
   ================================================================ */

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
    registro.swing = 0;
    pintarModos();
    pintarSimple();
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
  registro.swing = estilo.swing;
  registro.efectos = { ...estilo.efectos };
  registro.volumen = VOL_INICIAL.slice();
  registro.silenciados = Array(7).fill(false);
  registro.solistas = Array(7).fill(false);
  pintarModos();
  pintarExtendido();
  pintarOk(`Cargado: ${ritmo.nombre}`);
}

async function eliminarRitmo(id) {
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
    pintarGuardados();
  } else {
    pintarError(r.error);
  }
}

/* ================================================================
   PINTAR PANELES Y MODOS
   ================================================================ */

function pintarPaneles() {
  if (!registro.panelMezclaEl) return;
  registro.panelMezclaEl.hidden = !registro.mezclaAbierta;
  registro.panelEfectosEl.hidden = !registro.efectosAbiertos;
  const btnM = registro.raiz.querySelector('[data-accion="toggle-mezcla"]');
  const btnE = registro.raiz.querySelector('[data-accion="toggle-efectos"]');
  if (btnM) btnM.setAttribute('aria-pressed', String(registro.mezclaAbierta));
  if (btnE) btnE.setAttribute('aria-pressed', String(registro.efectosAbiertos));
}

function pintarModos() {
  registro.raiz.querySelectorAll('[data-accion="cambiar-modo"]').forEach((b) => {
    const activo = b.dataset.modo === registro.modo;
    b.classList.toggle('perc__modo-btn--activo', activo);
    b.setAttribute('aria-pressed', String(activo));
  });
}

/* ================================================================
   CICLO DE VIDA
   ================================================================ */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.modo = 'simple';
  registro.pasoActual = -1;
  registro.mezclaAbierta = false;
  registro.efectosAbiertos = false;
  registro.formularioGuardarAbierto = false;
  registro.modalSonido = null;

  registro.bpm = 90;
  registro.swing = 0;
  registro.efectos = { reverb: 10, eco: 12, saturacion: 35, filtro: 100 };
  registro.volumen = VOL_INICIAL.slice();
  registro.silenciados = Array(7).fill(false);
  registro.solistas = Array(7).fill(false);

  registro.estilo = motor.ESTILOS_EXTENDIDOS[0];
  registro.patron = motor.normalizarPatronExtendido(
    registro.estilo.patrones,
    registro.estilo.escala
  );

  cargarInicialSimple();

  const { signal } = registro.abortador;
  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('input', manejarInput, { signal });

  registro.desuscribir = [
    al('realtime:ritmos:crear', async () => { await refrescarGuardados(); pintarGuardados(); }),
    al('realtime:ritmos:eliminar', async () => { await refrescarGuardados(); pintarGuardados(); }),
  ];

  montarEstructura();
  await refrescarGuardados();

  pintarModos();
  pintarSimple();
}

export function limpiar() {
  motor.detener();
  cerrarModalSonido();

  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;

  if (registro.contenedor) limpiarContenedor(registro.contenedor);

  registro.filas = [];
  registro.patron = [];
  registro.guardados = [];
  registro.pasoActual = -1;
  registro.mezclaAbierta = false;
  registro.efectosAbiertos = false;
  registro.formularioGuardarAbierto = false;
  registro.sonidoIdSeleccionado = null;
  registro.raiz = null;
  registro.cuerpoEl = null;
  registro.grillaSimpleEl = null;
  registro.grillaExtEl = null;
  registro.chipsEstiloEl = null;
  registro.infoEl = null;
  registro.panelMezclaEl = null;
  registro.panelEfectosEl = null;
  registro.guardarZonaEl = null;
  registro.guardadosEl = null;
  registro.modalSonido = null;
  registro.contenedor = null;
}