/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/series.js
   Versión: 2.0.1
   Propósito: vista de series y películas. Dos modos (tarjeta y
              ranking) con toggle. Sección "Viendo ahora" arriba.
              Filtros con contador. Sheet de creación y edición.
              Reordenamiento por arrastre en modo ranking.
              v2.0.1: se reemplaza la función local autorHTML() por
                      distintivoAutor() del núcleo. La versión
                      anterior comparaba contra 'luci' y 'yayo',
                      pero los IDs reales de Appwrite son
                      'ChicaLuci' y 'Elyayo', así que caía siempre
                      en autor--ambos. Sin cambios visuales más
                      allá de la corrección del color.
              v2.0.0: rediseño. Se adopta el prototipo del equipo
                      de diseño. Barra superior integrada con
                      progreso + toggle. Chips de filtro con
                      contadores. Sección "Viendo ahora" separada.
                      Tarjeta con carátula 80×120 y badge de
                      puntaje con esquina pegada. Fila de ranking
                      con handle, número de posición y puntaje
                      grande. Handle deshabilitado cuando hay
                      filtro activo. Caja de vacío con mensaje
                      según contexto. Formulario en sheet al
                      estilo Fauna/Flora con cierre y guardado.
                      Sin cambios en el repositorio.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoSeries from '../datos/repositorios/series.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:series');

const TIPOS = [
  { id: 'serie', etiqueta: 'Serie' },
  { id: 'pelicula', etiqueta: 'Película' },
];

const ESTADOS = [
  { id: 'pendiente', etiqueta: 'Pendiente' },
  { id: 'viendo', etiqueta: 'Viendo' },
  { id: 'vista', etiqueta: 'Vista' },
  { id: 'abandonada', etiqueta: 'Abandonada' },
];

const DONDE = ['Netflix', 'Prime', 'Disney+', 'Max', 'Apple TV', 'Cine', 'YouTube', 'Otra'];

const ICONO_CERRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>';
const SVG_TARJETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>';
const SVG_RANKING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  datos: [],
  vista: 'tarjeta',
  filtro: 'todas',
  sheetActivo: null,
  abortadorSheet: null,
  arrastrando: null,
  pointerIdActivo: null,
};

/* ---------- Helpers ------------------------------------------- */

function etiquetaTipo(id) {
  return id === 'serie' ? 'Serie' : 'Película';
}

function etiquetaEstado(id) {
  const e = ESTADOS.find((x) => x.id === id);
  return e ? e.etiqueta : id;
}

function inicial(titulo) {
  return (titulo || '?').trim().charAt(0).toUpperCase();
}

function tieneSeguimiento(it) {
  return it.tipo === 'serie'
    && it.temporadaActual != null
    && it.capituloActual != null;
}

function etiquetaCap(it) {
  if (!tieneSeguimiento(it)) return '';
  return `T${it.temporadaActual} · E${it.capituloActual}`;
}

function intONull(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

/* ---------- Mensajes ------------------------------------------ */

function pintarError(mensaje) {
  const cont = registro.contenedor;
  if (!cont) return;
  const error = h('p', { class: 'vista__error', role: 'alert' }, mensaje);
  cont.prepend(error);
  setTimeout(() => error.remove(), 5000);
}

function pintarOk(mensaje) {
  const cont = registro.contenedor;
  if (!cont) return;
  const ok = h('p', { class: 'vista__ok', role: 'status' }, mensaje);
  cont.prepend(ok);
  setTimeout(() => ok.remove(), 3500);
}

/* ---------- Filtrado y ordenamiento --------------------------- */

function opcionesFiltro() {
  const d = registro.datos;
  return [
    { id: 'todas', etiqueta: 'Todas', num: d.length },
    { id: 'viendo', etiqueta: 'Viendo', num: d.filter((x) => x.estado === 'viendo').length },
    { id: 'pendiente', etiqueta: 'Pendientes', num: d.filter((x) => x.estado === 'pendiente').length },
    { id: 'vista', etiqueta: 'Vistas', num: d.filter((x) => x.estado === 'vista').length },
    { id: 'serie', etiqueta: 'Series', num: d.filter((x) => x.tipo === 'serie').length },
    { id: 'pelicula', etiqueta: 'Películas', num: d.filter((x) => x.tipo === 'pelicula').length },
  ];
}

function itemsFiltrados() {
  let base = registro.datos.slice();
  if (registro.filtro === 'serie' || registro.filtro === 'pelicula') {
    base = base.filter((d) => d.tipo === registro.filtro);
  } else if (registro.filtro !== 'todas') {
    base = base.filter((d) => d.estado === registro.filtro);
  }
  if (registro.vista === 'ranking') {
    base.sort((a, b) => (a.posicion ?? 9999) - (b.posicion ?? 9999));
  } else {
    base.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
  }
  return base;
}

function enCurso() {
  return registro.datos.filter((d) => d.tipo === 'serie' && d.estado === 'viendo');
}

/* ---------- Barra superior ------------------------------------ */

function pintarBarra() {
  const total = registro.datos.length;
  const vistas = registro.datos.filter((d) => d.estado === 'vista').length;

  const barra = h('div', { class: 'series-bar' },
    h('div', { class: 'series-bar__progreso' },
      h('span', { class: 'series-bar__num' },
        String(vistas),
        h('small', {}, `/${total}`)
      ),
      h('span', { class: 'series-bar__txt' }, 'vistas')
    ),
    h('div', { class: 'vista-toggle' },
      h('button', {
        type: 'button',
        class: registro.vista === 'tarjeta' ? 'is-active' : '',
        'data-vista': 'tarjeta',
        'aria-label': 'Vista tarjeta',
        onclick: () => { registro.vista = 'tarjeta'; pintar(); },
      }, h('span', { html: SVG_TARJETA }), 'Tarjeta'),
      h('button', {
        type: 'button',
        class: registro.vista === 'ranking' ? 'is-active' : '',
        'data-vista': 'ranking',
        'aria-label': 'Vista ranking',
        onclick: () => { registro.vista = 'ranking'; pintar(); },
      }, h('span', { html: SVG_RANKING }), 'Ranking')
    )
  );

  return barra;
}

/* ---------- Filtros ------------------------------------------- */

function pintarFiltros() {
  const cont = h('div', { class: 'filtros', role: 'group', 'aria-label': 'Filtros' });
  for (const f of opcionesFiltro()) {
    const chip = h('button', {
      type: 'button',
      class: 'chip' + (registro.filtro === f.id ? ' is-active' : ''),
      onclick: () => { registro.filtro = f.id; pintar(); },
    }, f.etiqueta, ' ', h('span', { class: 'chip__num' }, String(f.num)));
    cont.append(chip);
  }
  return cont;
}

/* ---------- Aviso ranking ------------------------------------- */

function pintarAviso() {
  if (registro.vista !== 'ranking' || registro.filtro === 'todas') return null;
  return h('div', { class: 'aviso-ranking' },
    'Quita los filtros para poder reordenar el ranking.');
}

/* ---------- Sección "Viendo ahora" ---------------------------- */

function pintarEnCurso() {
  if (registro.filtro !== 'todas') return null;
  const lista = enCurso();
  if (lista.length === 0) return null;

  const cont = h('div', {});

  cont.append(h('div', { class: 'seccion-cab' },
    h('span', { class: 'seccion-cab__titulo' },
      h('span', { class: 'seccion-cab__punto' }),
      'Viendo ahora'
    ),
    h('span', { class: 'seccion-cab__linea' }),
    h('span', { class: 'seccion-cab__count' }, String(lista.length))
  ));

  const contenedor = h('div', { class: 'en-curso-lista' });
  for (const it of lista) {
    contenedor.append(
      registro.vista === 'ranking' ? pintarFila(it, true) : pintarTarjeta(it, true)
    );
  }
  cont.append(contenedor);
  return cont;
}

/* ---------- Tarjeta ------------------------------------------- */

function pintarTarjeta(it, esEnCurso = false) {
  const conSeg = tieneSeguimiento(it);
  const pct = it.puntuacion ? (it.puntuacion / 10) * 100 : 0;

  const card = h('article', {
    class: 'tarjeta tarjeta--' + it.estado,
    'data-id': it.id,
  });

  // Carátula.
  const caratula = h('div', { class: 'tarjeta__caratula' });
  if (it.caratula) {
    const img = h('img', {
      src: it.caratula, alt: '', loading: 'lazy',
      onerror: () => {
        img.remove();
        caratula.append(h('span', { class: 'tarjeta__caratula-letra' }, inicial(it.titulo)));
      },
    });
    caratula.append(img);
  } else {
    caratula.append(h('span', { class: 'tarjeta__caratula-letra' }, inicial(it.titulo)));
  }
  if (it.puntuacion != null) {
    caratula.append(h('span', { class: 'tarjeta__puntaje' }, String(it.puntuacion)));
  }
  card.append(caratula);

  // Cuerpo.
  const cuerpo = h('div', { class: 'tarjeta__cuerpo' });

  cuerpo.append(h('h3', { class: 'tarjeta__titulo' }, it.titulo));

  // Badges.
  const badges = h('div', { class: 'tarjeta__badges' });
  badges.append(h('span', { class: `chip-tipo chip-tipo--${it.tipo}` }, etiquetaTipo(it.tipo)));
  if (conSeg && esEnCurso) {
    badges.append(h('span', { class: 'chip-cap' }, etiquetaCap(it)));
  } else {
    badges.append(h('span', { class: `chip-estado chip-estado--${it.estado}` }, etiquetaEstado(it.estado)));
  }
  cuerpo.append(badges);

  // Meta: dónde · recomendada por · autor.
  const meta = h('div', { class: 'tarjeta__meta' });
  if (it.donde) meta.append(h('span', {}, it.donde));
  if (it.donde && it.recomendadaPor) meta.append(h('span', { class: 'tarjeta__meta-sep' }, '·'));
  if (it.recomendadaPor) meta.append(h('span', {}, 'De ' + it.recomendadaPor));
  meta.append(distintivoAutor(it.creadoPor));
  cuerpo.append(meta);

  if (it.nota) {
    cuerpo.append(h('p', { class: 'tarjeta__nota' }, it.nota));
  }

  // Progreso de capítulo (solo si es en curso y tiene seguimiento).
  if (conSeg && esEnCurso && it.totalCapitulosTemporada) {
    const pctCap = Math.min(100, (it.capituloActual / it.totalCapitulosTemporada) * 100);
    cuerpo.append(h('div', { class: 'progreso-cap' },
      h('div', { class: 'progreso-cap__texto' },
        h('span', {}, `Temporada ${it.temporadaActual} · capítulo ${it.capituloActual} de ${it.totalCapitulosTemporada}`),
        h('b', {}, Math.round(pctCap) + '%')
      ),
      h('div', { class: 'progreso-cap__barra' },
        h('i', { style: `width:${pctCap}%` })
      )
    ));
  } else if (it.estado === 'vista' && it.puntuacion != null) {
    cuerpo.append(h('div', { class: 'progreso-cap' },
      h('div', { class: 'progreso-cap__barra', style: 'background: color-mix(in oklab, var(--musgo) 15%, var(--papel-2));' },
        h('i', { style: `width:${pct}%; background: var(--musgo);` })
      )
    ));
  }

  // Acciones.
  const acciones = h('div', { class: 'tarjeta__acciones' });
  if (it.link) {
    acciones.append(h('a', {
      class: 'btn-mini btn-mini--link',
      href: it.link, target: '_blank', rel: 'noopener',
    }, 'Ver'));
  }
  if (conSeg && esEnCurso) {
    acciones.append(h('button', {
      type: 'button', class: 'btn-mini btn-mini--cap',
      onclick: (ev) => { ev.stopPropagation(); avanzarCapitulo(it.id); },
    }, '+1 cap.'));
  }
  acciones.append(h('button', {
    type: 'button', class: 'btn-mini',
    onclick: (ev) => { ev.stopPropagation(); abrirFormulario(it); },
  }, 'Editar'));
  acciones.append(h('button', {
    type: 'button', class: 'btn-mini btn-mini--peligro',
    style: 'margin-left: auto;',
    onclick: (ev) => { ev.stopPropagation(); confirmarEliminar(it); },
  }, 'Quitar'));
  cuerpo.append(acciones);

  card.append(cuerpo);
  return card;
}

/* ---------- Fila ranking -------------------------------------- */

function pintarFila(it, esEnCurso = false) {
  const conSeg = tieneSeguimiento(it);
  const puedeArrastrar = registro.filtro === 'todas';

  const el = h('article', {
    class: 'fila fila--' + it.estado,
    'data-id': it.id,
  });

  // Handle.
  const handle = h('span', {
    class: 'fila__handle' + (puedeArrastrar ? '' : ' fila__handle--off'),
    'aria-hidden': 'true',
    title: puedeArrastrar ? 'Arrastrar para reordenar' : 'Quita los filtros para reordenar',
  }, '⠿');
  if (puedeArrastrar) {
    handle.addEventListener('pointerdown', (ev) => iniciarArrastre(ev, it.id));
  }
  el.append(handle);

  // Posición.
  el.append(h('span', { class: 'fila__pos' }, it.posicion != null ? String(it.posicion) : '—'));

  // Cuerpo.
  const cuerpo = h('div', { class: 'fila__cuerpo' });
  cuerpo.append(h('div', { class: 'fila__titulo' }, it.titulo));

  const meta = h('div', { class: 'fila__meta' });
  meta.append(h('span', { class: `chip-tipo chip-tipo--${it.tipo}` }, etiquetaTipo(it.tipo)));
  if (conSeg && esEnCurso) {
    meta.append(h('span', { class: 'chip-cap' }, etiquetaCap(it)));
  } else {
    meta.append(h('span', { class: `chip-estado chip-estado--${it.estado}` }, etiquetaEstado(it.estado)));
  }
  if (it.donde) meta.append(h('span', {}, it.donde));
  meta.append(distintivoAutor(it.creadoPor));
  cuerpo.append(meta);
  el.append(cuerpo);

  // Puntaje.
  el.append(h('span', {
    class: 'fila__puntaje' + (it.puntuacion == null ? ' fila__puntaje--vacio' : ''),
  }, it.puntuacion != null ? String(it.puntuacion) : '—'));

  // Acciones.
  const acciones = h('div', { class: 'fila__acciones' });
  if (conSeg && esEnCurso) {
    acciones.append(h('button', {
      type: 'button', class: 'btn-mini btn-mini--cap',
      onclick: (ev) => { ev.stopPropagation(); avanzarCapitulo(it.id); },
    }, '+1'));
  }
  el.append(acciones);

  return el;
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-series', class: 'vista vista--series' });

  raiz.append(pintarBarra());
  raiz.append(pintarFiltros());

  const aviso = pintarAviso();
  if (aviso) raiz.append(aviso);

  const enCursoBloque = pintarEnCurso();
  if (enCursoBloque) raiz.append(enCursoBloque);

  // Lista principal.
  let items = itemsFiltrados();
  if (registro.filtro === 'todas') {
    items = items.filter((d) => !(d.tipo === 'serie' && d.estado === 'viendo'));
  }

  if (items.length === 0) {
    raiz.append(pintarVacio());
  } else {
    for (const it of items) {
      raiz.append(registro.vista === 'ranking' ? pintarFila(it) : pintarTarjeta(it));
    }
  }

  cont.append(raiz);
}

function pintarVacio() {
  const esTodas = registro.filtro === 'todas';
  return h('div', { class: 'vacio-caja' },
    h('div', { class: 'vacio-caja__emoji' }, '🎬'),
    h('p', { class: 'vacio-caja__titulo' }, 'Sin títulos acá'),
    h('p', { class: 'vacio-caja__texto' },
      esTodas
        ? 'Todavía no hay nada anotado. Empieza por el botón + abajo.'
        : 'Este filtro no tiene títulos. Prueba con otro.'
    )
  );
}

/* ---------- Refresco ------------------------------------------ */

async function refrescar() {
  const r = await repoSeries.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.datos = r.datos;
  pintar();
}

/* ---------- Avanzar capítulo ---------------------------------- */

async function avanzarCapitulo(id) {
  const it = registro.datos.find((d) => d.id === id);
  if (!it || !tieneSeguimiento(it)) return;

  const cap = (it.capituloActual || 0) + 1;
  const total = it.totalCapitulosTemporada;

  if (total && cap > total) {
    const temp = it.temporadaActual || 1;
    const totalTemp = it.totalTemporadas;

    if (totalTemp && temp >= totalTemp) {
      // Última temporada terminada.
      const r = await repoSeries.actualizar(id, { estado: 'vista' });
      if (r.exito) {
        await refrescar();
        pintarOk('Última temporada terminada. Marcada como vista.');
      } else {
        pintarError(r.error);
      }
    } else {
      // Pasa a la siguiente temporada.
      const r = await repoSeries.actualizar(id, {
        temporadaActual: temp + 1,
        capituloActual: 1,
      });
      if (r.exito) {
        await refrescar();
        pintarOk(`Temporada ${temp + 1}, capítulo 1.`);
      } else {
        pintarError(r.error);
      }
    }
  } else {
    const r = await repoSeries.actualizar(id, { capituloActual: cap });
    if (r.exito) {
      await refrescar();
      pintarOk(`T${it.temporadaActual} · E${cap}.`);
    } else {
      pintarError(r.error);
    }
  }
}

/* ---------- Sheet: base --------------------------------------- */

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

function abrirSheet({ eyebrow, titulo, cuerpo, foot }) {
  cerrarSheet();
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const panel = h('div', { class: 'sheet__panel' });

  const head = h('div', { class: 'sheet__head' },
    h('div', { class: 'sheet__head-title' },
      eyebrow ? h('p', { class: 'sheet__eyebrow' }, eyebrow) : null,
      h('h2', { class: 'sheet__title' }, titulo)
    ),
    h('button', { type: 'button', class: 'sheet__cerrar', 'aria-label': 'Cerrar' }, h('span', { html: ICONO_CERRAR }))
  );

  const body = h('div', { class: 'sheet__body' }, cuerpo);
  const footEl = foot ? h('div', { class: 'sheet__foot' }, foot) : null;

  panel.append(h('div', { class: 'sheet__handle' }), head, body);
  if (footEl) panel.append(footEl);
  sheet.append(panel);
  document.body.append(sheet);

  const abortador = new AbortController();
  registro.abortadorSheet = abortador;
  const { signal } = abortador;

  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) cerrarSheet(); }, { signal });
  head.querySelector('.sheet__cerrar').addEventListener('click', cerrarSheet, { signal });
  body.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrarSheet, { signal }));

  requestAnimationFrame(() => sheet.classList.add('is-open'));
  registro.sheetActivo = sheet;
  return { sheet, body, footEl };
}

/* ---------- Sheet: formulario --------------------------------- */

function abrirFormulario(it) {
  const editando = !!it;

  // Campos.
  const inputTitulo = h('input', {
    type: 'text', value: it?.titulo || '',
    placeholder: 'Nombre del título', maxlength: 200, required: true,
  });
  const selectTipo = h('select', {},
    ...TIPOS.map((t) => {
      const op = h('option', { value: t.id }, t.etiqueta);
      if (it?.tipo === t.id || (!it && t.id === 'serie')) op.setAttribute('selected', '');
      return op;
    })
  );
  const selectEstado = h('select', {},
    ...ESTADOS.map((e) => {
      const op = h('option', { value: e.id }, e.etiqueta);
      if (it?.estado === e.id || (!it && e.id === 'pendiente')) op.setAttribute('selected', '');
      return op;
    })
  );
  const selectDonde = h('select', {},
    h('option', { value: '' }, '¿Dónde la vimos?'),
    ...DONDE.map((d) => {
      const op = h('option', { value: d }, d);
      if (it?.donde === d) op.setAttribute('selected', '');
      return op;
    })
  );
  const inputPunt = h('input', {
    type: 'number', min: '1', max: '10',
    value: it?.puntuacion != null ? String(it.puntuacion) : '',
    placeholder: '1-10',
  });
  const inputReco = h('input', {
    type: 'text', value: it?.recomendadaPor || '',
    placeholder: '¿Quién la recomendó?', maxlength: 100,
  });
  const inputCaratula = h('input', {
    type: 'url', value: it?.caratula || '',
    placeholder: 'URL de la carátula (opcional)',
  });
  const inputLink = h('input', {
    type: 'url', value: it?.link || '',
    placeholder: 'Link externo (opcional)',
  });
  const textareaNota = h('textarea', {
    placeholder: 'Nota corta (opcional)', maxlength: 500,
  }, it?.nota || '');

  // Seguimiento (solo si es serie).
  const inputTempActual = h('input', {
    type: 'number', min: '1',
    value: it?.temporadaActual != null ? String(it.temporadaActual) : '',
    placeholder: 'Actual',
  });
  const inputCapActual = h('input', {
    type: 'number', min: '1',
    value: it?.capituloActual != null ? String(it.capituloActual) : '',
    placeholder: 'Actual',
  });
  const inputTotalTemp = h('input', {
    type: 'number', min: '1',
    value: it?.totalTemporadas != null ? String(it.totalTemporadas) : '',
    placeholder: 'Total',
  });
  const inputTotalCap = h('input', {
    type: 'number', min: '1',
    value: it?.totalCapitulosTemporada != null ? String(it.totalCapitulosTemporada) : '',
    placeholder: 'Por temporada',
  });

  const seccionSeg = h('div', { class: 'series-seccion-seguimiento' },
    h('div', { class: 'series-seccion-titulo' }, 'Seguimiento de capítulos'),
    h('div', { class: 'series-fila-cuatro' },
      inputTempActual, inputCapActual, inputTotalTemp, inputTotalCap
    ),
    h('p', { class: 'series-ayuda' },
      'Temporada actual · Capítulo actual · Total temporadas · Caps por temporada. Todos opcionales.')
  );

  function actualizarSeccion() {
    if (selectTipo.value === 'serie') {
      seccionSeg.classList.remove('series-seccion--oculta');
    } else {
      seccionSeg.classList.add('series-seccion--oculta');
    }
  }
  selectTipo.addEventListener('change', actualizarSeccion);
  actualizarSeccion();

  // Estructura del formulario.
  const cuerpo = h('div', {},
    h('div', { class: 'series-fila-doble' }, inputTitulo, selectTipo),
    h('div', { class: 'series-fila-tres' }, selectEstado, selectDonde, inputPunt),
    inputReco,
    inputCaratula,
    inputLink,
    textareaNota,
    seccionSeg
  );

  const botonGuardar = h('button', { type: 'button', class: 'btn btn--primario' },
    editando ? 'Guardar' : 'Añadir');

  botonGuardar.addEventListener('click', async () => {
    const titulo = inputTitulo.value.trim();
    if (!titulo) { pintarError('Falta el título'); return; }

    const tipo = selectTipo.value;
    const esSerie = tipo === 'serie';
    const punt = inputPunt.value ? Number(inputPunt.value) : null;
    if (punt !== null && (punt < 1 || punt > 10)) {
      pintarError('La puntuación va de 1 a 10.');
      return;
    }

    // Posición para crear (max + 1).
    const maxPos = registro.datos.reduce((m, d) => Math.max(m, d.posicion || 0), 0);

    const datos = {
      titulo,
      tipo,
      estado: selectEstado.value,
      donde: selectDonde.value,
      puntuacion: punt,
      recomendadaPor: inputReco.value.trim(),
      caratula: inputCaratula.value.trim(),
      link: inputLink.value.trim(),
      nota: textareaNota.value.trim(),
      temporadaActual: esSerie ? intONull(inputTempActual.value) : null,
      capituloActual: esSerie ? intONull(inputCapActual.value) : null,
      totalTemporadas: esSerie ? intONull(inputTotalTemp.value) : null,
      totalCapitulosTemporada: esSerie ? intONull(inputTotalCap.value) : null,
    };

    let resultado;
    if (editando) {
      resultado = await repoSeries.actualizar(it.id, datos);
    } else {
      resultado = await repoSeries.crear({ ...datos, posicion: maxPos + 1 });
    }

    if (!resultado.exito) {
      pintarError(resultado.error);
      return;
    }

    cerrarSheet();
    await refrescar();
    pintarOk(editando ? 'Guardado.' : 'Añadido.');
  });

  const foot = h('div', { style: 'display:flex;gap:8px;width:100%' },
    h('button', { type: 'button', class: 'btn btn--secundario', onclick: cerrarSheet }, 'Cancelar'),
    botonGuardar
  );

  abrirSheet({
    eyebrow: 'Series',
    titulo: editando ? 'Editar' : 'Nuevo título',
    cuerpo,
    foot,
  });
}

/* ---------- Confirmar eliminar -------------------------------- */

async function confirmarEliminar(it) {
  const ok = await mostrarConfirmacion(
    'Quitar',
    `¿Seguro que quieres quitar "${it.titulo}"?`,
    { textoConfirmar: 'Quitar' }
  );
  if (!ok) return;
  const r = await repoSeries.eliminar(it.id);
  if (r.exito) {
    registro.datos = registro.datos.filter((d) => d.id !== it.id);
    pintar();
    pintarOk('Quitado.');
  } else {
    pintarError(r.error);
  }
}

/* ---------- Drag & drop --------------------------------------- */

function iniciarArrastre(ev, id) {
  if (registro.filtro !== 'todas' || registro.vista !== 'ranking') return;
  const fila = ev.target.closest('.fila');
  if (!fila) return;
  ev.preventDefault();

  registro.arrastrando = { id, fila };
  registro.pointerIdActivo = ev.pointerId;
  fila.classList.add('fila--arrastrando');
  fila.setPointerCapture(ev.pointerId);

  fila.addEventListener('pointermove', manejarArrastre);
  fila.addEventListener('pointerup', soltarArrastre);
  fila.addEventListener('pointercancel', soltarArrastre);
}

function manejarArrastre(ev) {
  if (!registro.arrastrando) return;
  const { fila } = registro.arrastrando;
  const lista = fila.parentNode;
  if (!lista) return;
  const y = ev.clientY;
  const otras = [...lista.querySelectorAll('.fila:not(.fila--arrastrando)')];
  let insertado = false;
  for (const otra of otras) {
    const rect = otra.getBoundingClientRect();
    const medio = rect.top + rect.height / 2;
    if (y < medio) {
      if (fila.nextElementSibling !== otra) lista.insertBefore(fila, otra);
      insertado = true;
      break;
    }
  }
  if (!insertado && lista.lastElementChild !== fila) lista.appendChild(fila);
}

async function soltarArrastre(ev) {
  if (!registro.arrastrando) return;
  const { fila } = registro.arrastrando;
  const pointerId = registro.pointerIdActivo;

  fila.classList.remove('fila--arrastrando');
  fila.removeEventListener('pointermove', manejarArrastre);
  fila.removeEventListener('pointerup', soltarArrastre);
  fila.removeEventListener('pointercancel', soltarArrastre);
  try { fila.releasePointerCapture(pointerId); } catch (e) { /* silencioso */ }

  const lista = fila.parentNode;
  const filas = [...lista.querySelectorAll('.fila')];
  const ids = filas.map((el) => el.dataset.id).filter(Boolean);

  // Actualización local para no parpadear.
  ids.forEach((id, i) => {
    const d = registro.datos.find((x) => x.id === id);
    if (d) d.posicion = i + 1;
    const el = filas[i];
    if (el) {
      const pos = el.querySelector('.fila__pos');
      if (pos) pos.textContent = String(i + 1);
    }
  });

  registro.arrastrando = null;
  registro.pointerIdActivo = null;

  const r = await repoSeries.reordenar(ids);
  if (!r.exito) {
    pintarError(r.error);
  } else {
    pintarOk('Ranking actualizado.');
  }
}

/* ---------- Ciclo de vida ------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.datos = [];
  registro.vista = 'tarjeta';
  registro.filtro = 'todas';
  registro.sheetActivo = null;
  registro.abortadorSheet = null;
  registro.arrastrando = null;
  registro.pointerIdActivo = null;

  // Botón oculto para que el FAB dispare el formulario.
  contenedor.append(h('button', {
    type: 'button',
    class: 'btn-fantasma',
    'data-accion': 'abrir-formulario',
    'aria-hidden': 'true',
    tabindex: '-1',
    style: 'display:none',
    onclick: () => abrirFormulario(null),
  }));

  registro.desuscribir = [
    al('realtime:series:crear', refrescar),
    al('realtime:series:actualizar', refrescar),
    al('realtime:series:eliminar', refrescar),
    al('realtime:series:reordenado', refrescar),
  ];

  pintar();
  await refrescar();
}

export function limpiar() {
  cerrarSheet();
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.datos = [];
  registro.vista = 'tarjeta';
  registro.filtro = 'todas';
  registro.sheetActivo = null;
  registro.abortadorSheet = null;
  registro.arrastrando = null;
  registro.pointerIdActivo = null;
  registro.contenedor = null;
}