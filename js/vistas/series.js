/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/series.js
   Versión: 1.0.0
   Propósito: vista de series y películas. Dos vistas (tarjeta y
              compacta) con toggle. Sección "Viendo ahora" para
              series en curso. Filtros por estado y tipo.
              Búsqueda de carátula por URL. Seguimiento de
              capítulos para series (temporada actual, capítulo
              actual, totales). Ranking arrastrable en vista
              compacta cuando no hay filtros activos.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoSeries from '../datos/repositorios/series.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, escaparHtml } from '../nucleo/utils.js';

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

const registro = {
  contenedor: null,
  raiz: null,
  abortador: null,
  desuscribir: [],
  items: [],
  vista: 'card',           // 'card' | 'fila'
  filtro: 'todas',
  formularioAbierto: false,
  editandoId: null,
  arrastrando: null,
};

/* ---------- Helpers -------------------------------------------- */

function etiquetaTipo(id) { return TIPOS.find((t) => t.id === id)?.etiqueta || id; }
function etiquetaEstado(id) { return ESTADOS.find((e) => e.id === id)?.etiqueta || id; }
function inicial(titulo) { return (titulo || '?').trim().charAt(0).toUpperCase(); }

function tieneSeguimiento(it) {
  return it.tipo === 'serie'
    && it.temporadaActual != null
    && it.capituloActual != null;
}

function etiquetaCapitulo(it) {
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

function fechaParaInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function itemsFiltrados() {
  let base = registro.items.slice();
  if (registro.filtro === 'en_curso') {
    base = base.filter((d) => d.tipo === 'serie' && d.estado === 'viendo');
  } else if (registro.filtro === 'serie' || registro.filtro === 'pelicula') {
    base = base.filter((d) => d.tipo === registro.filtro);
  } else if (registro.filtro !== 'todas') {
    base = base.filter((d) => d.estado === registro.filtro);
  }
  if (registro.vista === 'fila') {
    base.sort((a, b) => (a.posicion ?? 9999) - (b.posicion ?? 9999));
  } else {
    base.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
  }
  return base;
}

function enCurso() {
  return registro.items.filter((d) => d.tipo === 'serie' && d.estado === 'viendo');
}

/* ---------- Mensajes ------------------------------------------- */

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

/* ---------- Estructura raíz ------------------------------------ */

function montarEstructura() {
  const cont = registro.contenedor;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-series', class: 'vista vista--series' });
  cont.append(raiz);
  registro.raiz = raiz;

  raiz.append(
    h('header', { class: 'series__cabecera' },
      h('h1', {}, 'Series y películas'),
      h('p', { class: 'vista__lead' },
        'Lo que vimos, lo que estamos viendo y lo que queda por ver.')
    ),
    h('div', { class: 'series__toggle', role: 'group', 'aria-label': 'Cambiar vista' },
      h('button', {
        type: 'button', class: 'series__toggle-btn',
        'data-accion': 'vista-card',
      }, 'Tarjeta'),
      h('button', {
        type: 'button', class: 'series__toggle-btn',
        'data-accion': 'vista-fila',
      }, 'Compacta')
    ),
    h('div', { class: 'series__bloque-registro' }),
    h('div', { class: 'series__filtros' }),
    h('p', { class: 'series__progreso' }),
    h('div', { class: 'series__aviso' }),
    h('div', { class: 'series__en-curso' }),
    h('ul', { class: 'series__lista' })
  );

  registro.bloqueRegistroEl = raiz.querySelector('.series__bloque-registro');
  registro.filtrosEl = raiz.querySelector('.series__filtros');
  registro.progresoEl = raiz.querySelector('.series__progreso');
  registro.avisoEl = raiz.querySelector('.series__aviso');
  registro.enCursoEl = raiz.querySelector('.series__en-curso');
  registro.listaEl = raiz.querySelector('.series__lista');
  registro.toggleEl = raiz.querySelector('.series__toggle');
}

/* ---------- Toggle ---------------------------------------------- */

function pintarToggle() {
  const cont = registro.toggleEl;
  if (!cont) return;
  cont.querySelectorAll('.series__toggle-btn').forEach((btn) => {
    const activo = (btn.dataset.accion === 'vista-card' && registro.vista === 'card')
      || (btn.dataset.accion === 'vista-fila' && registro.vista === 'fila');
    btn.setAttribute('aria-pressed', String(activo));
    btn.classList.toggle('series__toggle-btn--activo', activo);
  });
}

/* ---------- Filtros --------------------------------------------- */

function pintarFiltros() {
  const cont = registro.filtrosEl;
  if (!cont) return;
  limpiarContenedor(cont);

  const opciones = [
    { id: 'todas', etiqueta: 'Todas' },
    { id: 'en_curso', etiqueta: 'Viendo ahora', destacado: true },
    { id: 'pendiente', etiqueta: 'Pendientes' },
    { id: 'vista', etiqueta: 'Vistas' },
    { id: 'serie', etiqueta: 'Series' },
    { id: 'pelicula', etiqueta: 'Películas' },
  ];

  for (const o of opciones) {
    cont.append(h('button', {
      type: 'button',
      class: 'chip' + (o.destacado ? ' chip--destacado' : ''),
      'data-accion': 'filtrar',
      'data-filtro': o.id,
      'aria-pressed': String(registro.filtro === o.id),
    }, o.etiqueta));
  }
}

/* ---------- Progreso -------------------------------------------- */

function pintarProgreso() {
  const p = registro.progresoEl;
  if (!p) return;
  const total = registro.items.length;
  if (total === 0) { p.textContent = ''; return; }
  const vistas = registro.items.filter((d) => d.estado === 'vista').length;
  p.textContent = `${vistas} de ${total} vistas`;
}

/* ---------- Aviso ranking --------------------------------------- */

function pintarAviso() {
  const cont = registro.avisoEl;
  if (!cont) return;
  limpiarContenedor(cont);
  if (registro.vista === 'fila' && registro.filtro !== 'todas') {
    cont.append(h('div', { class: 'aviso-ranking' },
      'Quita los filtros para poder reordenar el ranking.'));
  }
}

/* ---------- Bloque de registro ---------------------------------- */

function pintarBloqueRegistro() {
  const cont = registro.bloqueRegistroEl;
  if (!cont) return;
  limpiarContenedor(cont);

  if (!registro.formularioAbierto) {
    cont.append(h('button', {
      type: 'button',
      class: 'abrir-form',
      'data-accion': 'abrir-formulario',
    }, '+ Añadir serie o película'));
    return;
  }

  cont.append(pintarFormularioNuevo());
}

function pintarFormularioNuevo() {
  const inputTitulo = h('input', { name: 'titulo', placeholder: 'Título', required: true, maxlength: 200 });
  const selectTipo = h('select', { name: 'tipo' },
    ...TIPOS.map((t) => h('option', { value: t.id }, t.etiqueta)));
  const selectEstado = h('select', { name: 'estado' },
    ...ESTADOS.map((e) => h('option', { value: e.id }, e.etiqueta)));
  const selectDonde = h('select', { name: 'donde' },
    h('option', { value: '' }, '¿Dónde la vimos?'),
    ...DONDE.map((d) => h('option', { value: d }, d)));
  const inputPunt = h('input', { name: 'puntuacion', type: 'number', min: 1, max: 10, placeholder: '1-10' });
  const inputReco = h('input', { name: 'recomendadaPor', placeholder: '¿Quién la recomendó?', maxlength: 100 });
  const inputCaratula = h('input', { name: 'caratula', type: 'url', placeholder: 'URL de la carátula (opcional)' });
  const inputLink = h('input', { name: 'link', type: 'url', placeholder: 'Link externo (opcional)' });
  const textareaNota = h('textarea', { name: 'nota', placeholder: 'Nota corta (opcional)', maxlength: 500, rows: 3 });

  const inputTempActual = h('input', { name: 'temporadaActual', type: 'number', min: 1, placeholder: 'Ej. 2' });
  const inputCapActual = h('input', { name: 'capituloActual', type: 'number', min: 1, placeholder: 'Ej. 5' });
  const inputTotalTemp = h('input', { name: 'totalTemporadas', type: 'number', min: 1, placeholder: 'Ej. 3' });
  const inputTotalCap = h('input', { name: 'totalCapitulosTemporada', type: 'number', min: 1, placeholder: 'Ej. 10' });

  const seccionSeg = h('div', { class: 'series__seccion-seguimiento' },
    h('div', { class: 'series__seccion-titulo' }, 'Seguimiento de capítulos'),
    h('div', { class: 'series__fila-cuatro' },
      inputTempActual, inputCapActual, inputTotalTemp, inputTotalCap
    ),
    h('p', { class: 'series__ayuda' },
      'Temporada actual · Capítulo actual · Total temporadas · Capítulos por temporada. Todos opcionales.')
  );

  function actualizarSeccion() {
    if (selectTipo.value === 'serie') {
      seccionSeg.classList.remove('series__seccion--oculta');
    } else {
      seccionSeg.classList.add('series__seccion--oculta');
    }
  }
  selectTipo.addEventListener('change', actualizarSeccion);
  actualizarSeccion();

  return h('form', { class: 'series__form', 'data-accion': 'crear' },
    h('div', { class: 'series__fila-doble' }, inputTitulo, selectTipo),
    h('div', { class: 'series__fila-tres' }, selectEstado, selectDonde, inputPunt),
    inputReco,
    inputCaratula,
    inputLink,
    textareaNota,
    seccionSeg,
    h('div', { class: 'series__form-botones' },
      h('button', {
        type: 'button', class: 'btn-secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-primario' }, 'Añadir')
    )
  );
}

/* ---------- Tarjeta --------------------------------------------- */

function pintarCard(it, esEnCurso = false) {
  const puntaje = it.puntuacion;
  const pct = puntaje ? (puntaje / 10) * 100 : 0;
  const conSeg = tieneSeguimiento(it);

  const caratula = h('div', { class: 'card__caratula' });
  if (it.caratula) {
    caratula.append(h('img', {
      src: it.caratula, alt: '', loading: 'lazy',
      onerror: (ev) => {
        ev.target.remove();
        caratula.append(h('span', { class: 'card__caratula-vacia' }, inicial(it.titulo)));
      },
    }));
  } else {
    caratula.append(h('span', { class: 'card__caratula-vacia' }, inicial(it.titulo)));
  }
  if (puntaje != null) {
    caratula.append(h('span', { class: 'card__puntaje-flotante' }, String(puntaje)));
  }

  const cabecera = h('div', { class: 'card__cabecera' },
    h('span', { class: 'card__titulo' }, it.titulo),
    h('span', { class: `badge badge--${it.tipo}` }, etiquetaTipo(it.tipo)),
    conSeg && esEnCurso
      ? h('span', { class: 'badge-progreso' }, etiquetaCapitulo(it))
      : h('span', { class: `badge badge--estado-${it.estado}` }, etiquetaEstado(it.estado))
  );

  const cuerpo = h('div', { class: 'card__cuerpo' }, cabecera);

  if (it.donde || it.recomendadaPor || it.creadoPor) {
    cuerpo.append(h('div', { class: 'card__meta' },
      it.donde ? h('span', {}, it.donde) : null,
      it.recomendadaPor ? h('span', {}, 'Recomendada por ' + it.recomendadaPor) : null,
      distintivoAutor(it.creadoPor)
    ));
  }
  if (it.nota) cuerpo.append(h('p', { class: 'card__nota' }, it.nota));

  if (conSeg && esEnCurso && it.totalCapitulosTemporada) {
    const pctCap = Math.min(100, (it.capituloActual / it.totalCapitulosTemporada) * 100);
    cuerpo.append(h('div', { class: 'progreso-cap' },
      h('div', { class: 'progreso-cap__label' },
        h('span', {}, `Temporada ${it.temporadaActual} · capítulo ${it.capituloActual} de ${it.totalCapitulosTemporada}`),
        h('b', {}, Math.round(pctCap) + '%')
      ),
      h('div', { class: 'card__barra' }, h('i', { style: `width:${pctCap}%` }))
    ));
  } else if (puntaje != null) {
    cuerpo.append(h('div', { class: 'card__barra' }, h('i', { style: `width:${pct}%` })));
  }

  const acciones = h('div', { class: 'card__acciones' });
  if (it.link) {
    acciones.append(h('a', {
      class: 'btn-mini btn-link',
      href: it.link, target: '_blank', rel: 'noopener',
    }, 'Ver'));
  }
  if (conSeg && esEnCurso) {
    acciones.append(h('button', {
      class: 'btn-mini btn-cap', type: 'button',
      'data-accion': 'avanzar-cap', 'data-id': it.id,
    }, '+1 cap.'));
  }
  acciones.append(
    h('button', {
      class: 'btn-mini', type: 'button',
      'data-accion': 'estado', 'data-id': it.id,
    }, 'Estado'),
    h('button', {
      class: 'btn-mini', type: 'button',
      'data-accion': 'editar', 'data-id': it.id,
    }, 'Editar'),
    h('button', {
      class: 'btn-mini', type: 'button',
      'data-accion': 'eliminar', 'data-id': it.id,
    }, 'Quitar')
  );

  const clases = `card card--${it.estado}` + (esEnCurso ? ' card--en-curso' : '');
  return h('li', { class: clases, 'data-id': it.id }, caratula, cuerpo, acciones);
}

/* ---------- Fila compacta --------------------------------------- */

function pintarFila(it, esEnCurso = false) {
  const puntaje = it.puntuacion;
  const puedeArrastrar = registro.filtro === 'todas';
  const conSeg = tieneSeguimiento(it);

  const handle = h('div', {
    class: 'fila__handle',
    'aria-label': 'Arrastrar para reordenar',
    role: 'button',
    'data-accion': 'handle',
    'data-id': it.id,
  }, '⠿');
  if (!puedeArrastrar) {
    handle.classList.add('fila__handle--deshabilitado');
  }

  const meta = h('div', { class: 'fila__meta' },
    h('span', { class: `badge badge--${it.tipo}` }, etiquetaTipo(it.tipo)),
    conSeg && esEnCurso
      ? h('span', { class: 'badge-progreso' }, etiquetaCapitulo(it))
      : h('span', { class: `badge badge--estado-${it.estado}` }, etiquetaEstado(it.estado)),
    it.donde ? h('span', {}, it.donde) : null,
    it.recomendadaPor ? h('span', {}, '· ' + it.recomendadaPor) : null
  );

  const acciones = h('div', { class: 'fila__acciones' });
  if (it.link) {
    acciones.append(h('a', {
      class: 'btn-mini btn-link', href: it.link, target: '_blank', rel: 'noopener',
    }, 'Ver'));
  }
  if (conSeg && esEnCurso) {
    acciones.append(h('button', {
      class: 'btn-mini btn-cap', type: 'button',
      'data-accion': 'avanzar-cap', 'data-id': it.id,
    }, '+1'));
  }
  acciones.append(
    h('button', {
      class: 'btn-mini', type: 'button',
      'data-accion': 'estado', 'data-id': it.id,
    }, 'Estado'),
    h('button', {
      class: 'btn-mini', type: 'button',
      'data-accion': 'editar', 'data-id': it.id,
    }, 'Editar')
  );

  return h('li', { class: `fila fila--${it.estado}`, 'data-id': it.id },
    handle,
    h('span', { class: 'fila__puntaje' + (puntaje == null ? ' fila__puntaje--vacio' : '') },
      puntaje != null ? String(puntaje) : '—'),
    h('div', { class: 'fila__cuerpo' },
      h('span', { class: 'fila__titulo' }, it.titulo),
      meta
    ),
    acciones
  );
}

/* ---------- Formulario de edición ------------------------------ */

function pintarFormularioEdicion(it) {
  const inputTitulo = h('input', { value: it.titulo || '', name: 'titulo', required: true, maxlength: 200 });
  const selectTipo = h('select', { name: 'tipo' }, ...TIPOS.map((t) => {
    const o = h('option', { value: t.id }, t.etiqueta);
    if (t.id === it.tipo) o.setAttribute('selected', '');
    return o;
  }));
  const selectEstado = h('select', { name: 'estado' }, ...ESTADOS.map((e) => {
    const o = h('option', { value: e.id }, e.etiqueta);
    if (e.id === it.estado) o.setAttribute('selected', '');
    return o;
  }));
  const selectDonde = h('select', { name: 'donde' },
    h('option', { value: '' }, '¿Dónde la vimos?'),
    ...DONDE.map((d) => {
      const o = h('option', { value: d }, d);
      if (d === it.donde) o.setAttribute('selected', '');
      return o;
    })
  );
  const inputPunt = h('input', { name: 'puntuacion', type: 'number', min: 1, max: 10, value: it.puntuacion != null ? String(it.puntuacion) : '', placeholder: '1-10' });
  const inputReco = h('input', { name: 'recomendadaPor', value: it.recomendadaPor || '', placeholder: 'Recomendada por', maxlength: 100 });
  const inputCaratula = h('input', { name: 'caratula', type: 'url', value: it.caratula || '', placeholder: 'URL de la carátula' });
  const inputLink = h('input', { name: 'link', type: 'url', value: it.link || '', placeholder: 'Link externo' });
  const textareaNota = h('textarea', { name: 'nota', placeholder: 'Nota', maxlength: 500, rows: 3 }, it.nota || '');

  const inputTempActual = h('input', { name: 'temporadaActual', type: 'number', min: 1, value: it.temporadaActual != null ? String(it.temporadaActual) : '', placeholder: 'Temporada actual' });
  const inputCapActual = h('input', { name: 'capituloActual', type: 'number', min: 1, value: it.capituloActual != null ? String(it.capituloActual) : '', placeholder: 'Capítulo actual' });
  const inputTotalTemp = h('input', { name: 'totalTemporadas', type: 'number', min: 1, value: it.totalTemporadas != null ? String(it.totalTemporadas) : '', placeholder: 'Total temporadas' });
  const inputTotalCap = h('input', { name: 'totalCapitulosTemporada', type: 'number', min: 1, value: it.totalCapitulosTemporada != null ? String(it.totalCapitulosTemporada) : '', placeholder: 'Caps por temporada' });

  const seccionSeg = h('div', { class: 'series__seccion-seguimiento' },
    h('div', { class: 'series__seccion-titulo' }, 'Seguimiento de capítulos'),
    h('div', { class: 'series__fila-cuatro' },
      inputTempActual, inputCapActual, inputTotalTemp, inputTotalCap
    )
  );

  function actualizarSeg() {
    if (selectTipo.value === 'serie') seccionSeg.classList.remove('series__seccion--oculta');
    else seccionSeg.classList.add('series__seccion--oculta');
  }
  selectTipo.addEventListener('change', actualizarSeg);
  actualizarSeg();

  const preview = h('div', { class: 'series__preview-caratula' });
  function pintarPreview() {
    preview.replaceChildren();
    const url = inputCaratula.value.trim();
    if (url) {
      const img = h('img', { src: url, alt: '', onerror: () => {
        img.remove();
        preview.prepend(h('div', { class: 'vacia' }, inicial(inputTitulo.value)));
      }});
      preview.append(img);
    } else {
      preview.append(h('div', { class: 'vacia' }, inicial(inputTitulo.value)));
    }
    preview.append(h('span', { class: 'series__preview-texto' }, 'Vista previa'));
  }
  pintarPreview();
  inputCaratula.addEventListener('input', pintarPreview);
  inputTitulo.addEventListener('input', pintarPreview);

  const id = it.id;

  return h('li', { class: 'series__edit', 'data-id': id },
    h('div', { class: 'series__fila-doble' }, inputTitulo, selectTipo),
    h('div', { class: 'series__fila-tres' }, selectEstado, selectDonde, inputPunt),
    inputReco,
    preview,
    inputCaratula,
    inputLink,
    textareaNota,
    seccionSeg,
    h('div', { class: 'series__form-botones' },
      h('button', {
        type: 'button', class: 'btn-secundario',
        'data-accion': 'cancelar-edicion',
      }, 'Cancelar'),
      h('button', {
        type: 'button', class: 'btn-primario',
        onclick: () => guardarEdicion(id, {
          titulo: inputTitulo.value,
          tipo: selectTipo.value,
          estado: selectEstado.value,
          donde: selectDonde.value,
          puntuacion: inputPunt.value,
          recomendadaPor: inputReco.value,
          caratula: inputCaratula.value,
          link: inputLink.value,
          nota: textareaNota.value,
          temporadaActual: inputTempActual.value,
          capituloActual: inputCapActual.value,
          totalTemporadas: inputTotalTemp.value,
          totalCapitulosTemporada: inputTotalCap.value,
        }),
      }, 'Guardar')
    )
  );
}

/* ---------- Sección "Viendo ahora" ------------------------------ */

function pintarEnCurso() {
  const cont = registro.enCursoEl;
  if (!cont) return;
  limpiarContenedor(cont);

  if (registro.filtro !== 'todas') return;
  const lista = enCurso();
  if (lista.length === 0) return;

  cont.append(h('h2', { class: 'series__en-curso-titulo' }, 'Viendo ahora'));
  const ul = h('ul', { class: 'series__lista' });
  for (const it of lista) {
    ul.append(registro.vista === 'fila' ? pintarFila(it, true) : pintarCard(it, true));
  }
  cont.append(ul);
}

/* ---------- Pintar todo ----------------------------------------- */

function pintar() {
  pintarToggle();
  pintarBloqueRegistro();
  pintarFiltros();
  pintarProgreso();
  pintarAviso();
  pintarEnCurso();

  const lista = registro.listaEl;
  if (!lista) return;
  limpiarContenedor(lista);

  let items = itemsFiltrados();
  if (registro.filtro === 'todas') {
    items = items.filter((d) => !(d.tipo === 'serie' && d.estado === 'viendo'));
  }

  if (items.length === 0) {
    lista.append(h('li', { class: 'series__vacio' }, 'Sin títulos en este filtro.'));
    return;
  }

  for (const it of items) {
    if (registro.editandoId === it.id) {
      lista.append(pintarFormularioEdicion(it));
    } else if (registro.vista === 'fila') {
      lista.append(pintarFila(it));
    } else {
      lista.append(pintarCard(it));
    }
  }
}

/* ---------- Refresco -------------------------------------------- */

async function refrescar() {
  const r = await repoSeries.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.items = r.datos;
  pintar();
}

/* ---------- Submit y guardar ----------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const puntRaw = String(fd.get('puntuacion') || '').trim();
  const punt = puntRaw ? Number(puntRaw) : null;
  if (punt !== null && (punt < 1 || punt > 10)) {
    pintarError('La puntuación va de 1 a 10.');
    return;
  }

  const esSerie = String(fd.get('tipo')) === 'serie';
  const maxPos = registro.items.reduce((m, d) => Math.max(m, d.posicion || 0), 0);

  const r = await repoSeries.crear({
    titulo: fd.get('titulo'),
    tipo: fd.get('tipo'),
    estado: fd.get('estado'),
    donde: fd.get('donde'),
    puntuacion: punt,
    recomendadaPor: fd.get('recomendadaPor'),
    caratula: fd.get('caratula'),
    link: fd.get('link'),
    nota: fd.get('nota'),
    temporadaActual: esSerie ? intONull(fd.get('temporadaActual')) : null,
    capituloActual: esSerie ? intONull(fd.get('capituloActual')) : null,
    totalTemporadas: esSerie ? intONull(fd.get('totalTemporadas')) : null,
    totalCapitulosTemporada: esSerie ? intONull(fd.get('totalCapitulosTemporada')) : null,
    posicion: maxPos + 1,
  });

  if (r.exito) {
    registro.formularioAbierto = false;
    form.reset();
    await refrescar();
    pintarOk('Añadido.');
  } else {
    pintarError(r.error);
  }
}

async function guardarEdicion(id, valores) {
  const puntRaw = String(valores.puntuacion || '').trim();
  const punt = puntRaw ? Number(puntRaw) : null;
  if (punt !== null && (punt < 1 || punt > 10)) {
    pintarError('La puntuación va de 1 a 10.');
    return;
  }
  const esSerie = valores.tipo === 'serie';

  const r = await repoSeries.actualizar(id, {
    titulo: valores.titulo,
    tipo: valores.tipo,
    estado: valores.estado,
    donde: valores.donde,
    puntuacion: punt,
    recomendadaPor: valores.recomendadaPor,
    caratula: valores.caratula,
    link: valores.link,
    nota: valores.nota,
    temporadaActual: esSerie ? intONull(valores.temporadaActual) : null,
    capituloActual: esSerie ? intONull(valores.capituloActual) : null,
    totalTemporadas: esSerie ? intONull(valores.totalTemporadas) : null,
    totalCapitulosTemporada: esSerie ? intONull(valores.totalCapitulosTemporada) : null,
  });
  if (r.exito) {
    registro.editandoId = null;
    await refrescar();
  } else {
    pintarError(r.error);
  }
}

/* ---------- Avanzar capítulo ----------------------------------- */

async function avanzarCapitulo(id) {
  const it = registro.items.find((d) => d.id === id);
  if (!it || !tieneSeguimiento(it)) return;

  const cap = (it.capituloActual || 0) + 1;
  const total = it.totalCapitulosTemporada;

  if (total && cap > total) {
    const temp = it.temporadaActual || 1;
    const totalTemp = it.totalTemporadas;
    if (totalTemp && temp >= totalTemp) {
      const r = await repoSeries.actualizar(id, { estado: 'vista' });
      if (r.exito) {
        await refrescar();
        pintarOk('Última temporada terminada. Marcada como vista.');
      } else pintarError(r.error);
    } else {
      const ok = await mostrarConfirmacion(
        'Fin de temporada',
        `Terminaste la temporada ${temp} de "${it.titulo}". ¿Pasar a la temporada ${temp + 1}, capítulo 1?`,
        { textoConfirmar: 'Siguiente temporada', claseConfirmar: 'dialogo__boton--primario' }
      );
      if (!ok) return;
      const r = await repoSeries.actualizar(id, {
        temporadaActual: temp + 1,
        capituloActual: 1,
      });
      if (r.exito) {
        await refrescar();
        pintarOk(`Temporada ${temp + 1}, capítulo 1.`);
      } else pintarError(r.error);
    }
  } else {
    const r = await repoSeries.actualizar(id, { capituloActual: cap });
    if (r.exito) {
      await refrescar();
      pintarOk(`T${it.temporadaActual} · E${cap}`);
    } else pintarError(r.error);
  }
}

/* ---------- Cambiar estado ------------------------------------- */

async function cambiarEstado(id) {
  const it = registro.items.find((d) => d.id === id);
  if (!it) return;
  const orden = ['pendiente', 'viendo', 'vista', 'abandonada'];
  const i = orden.indexOf(it.estado);
  const nuevo = orden[(i + 1) % orden.length];
  const r = await repoSeries.actualizar(id, { estado: nuevo });
  if (r.exito) {
    await refrescar();
    pintarOk('Estado: ' + etiquetaEstado(nuevo));
  } else pintarError(r.error);
}

/* ---------- Drag & drop ---------------------------------------- */

function iniciarArrastre(ev, id) {
  if (registro.filtro !== 'todas') return;
  const fila = ev.target.closest('li.fila');
  if (!fila) return;
  ev.preventDefault();

  registro.arrastrando = { id, fila, pointerId: ev.pointerId };
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
  const otras = [...lista.querySelectorAll('li.fila:not(.fila--arrastrando)')];
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
  if (!insertado && lista.lastElementChild !== fila) lista.append(fila);
}

async function soltarArrastre(ev) {
  if (!registro.arrastrando) return;
  const { fila, pointerId } = registro.arrastrando;

  fila.classList.remove('fila--arrastrando');
  fila.removeEventListener('pointermove', manejarArrastre);
  fila.removeEventListener('pointerup', soltarArrastre);
  fila.removeEventListener('pointercancel', soltarArrastre);
  try { fila.releasePointerCapture(pointerId); } catch (e) { /* silencioso */ }

  const lista = fila.parentNode;
  const filas = [...lista.querySelectorAll('li.fila')];
  const ids = filas.map((el) => el.dataset.id).filter(Boolean);

  // Actualizar posiciones localmente primero para que la UI no
  // parpadee.
  ids.forEach((id, i) => {
    const d = registro.items.find((x) => x.id === id);
    if (d) d.posicion = i + 1;
  });

  registro.arrastrando = null;
  const r = await repoSeries.reordenar(ids);
  if (!r.exito) pintarError(r.error);
  else pintarOk('Ranking actualizado.');
}

/* ---------- Manejo de eventos ---------------------------------- */

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;
  const id = boton.dataset.id;

  if (accion === 'abrir-formulario') {
    registro.formularioAbierto = true;
    pintar();
    setTimeout(() => {
      const input = registro.bloqueRegistroEl.querySelector('input[name="titulo"]');
      if (input) input.focus();
    }, 60);
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'vista-card') {
    registro.vista = 'card';
    pintar();
  } else if (accion === 'vista-fila') {
    registro.vista = 'fila';
    pintar();
  } else if (accion === 'filtrar') {
    registro.filtro = boton.dataset.filtro;
    pintar();
  } else if (accion === 'estado') {
    await cambiarEstado(id);
  } else if (accion === 'avanzar-cap') {
    await avanzarCapitulo(id);
  } else if (accion === 'editar') {
    registro.editandoId = id;
    pintar();
    setTimeout(() => {
      const item = registro.listaEl.querySelector(`[data-id="${id}"], .series__en-curso [data-id="${id}"]`);
      if (item) item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  } else if (accion === 'cancelar-edicion') {
    registro.editandoId = null;
    pintar();
  } else if (accion === 'eliminar') {
    const it = registro.items.find((d) => d.id === id);
    const ok = await mostrarConfirmacion(
      'Quitar',
      `¿Seguro que quieres quitar "${it?.titulo || 'este título'}"?`,
      { textoConfirmar: 'Quitar' }
    );
    if (!ok) return;
    const r = await repoSeries.eliminar(id);
    if (r.exito) {
      registro.items = registro.items.filter((d) => d.id !== id);
      pintar();
    } else {
      pintarError(r.error);
    }
  }
}

function manejarPointerDown(ev) {
  const handle = ev.target.closest('[data-accion="handle"]');
  if (!handle) return;
  iniciarArrastre(ev, handle.dataset.id);
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.formularioAbierto = false;
  registro.editandoId = null;
  registro.arrastrando = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('pointerdown', manejarPointerDown, { signal });

  registro.desuscribir = [
    al('realtime:series:crear', refrescar),
    al('realtime:series:actualizar', refrescar),
    al('realtime:series:eliminar', refrescar),
  ];

  montarEstructura();
  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.items = [];
  registro.formularioAbierto = false;
  registro.editandoId = null;
  registro.arrastrando = null;
  registro.raiz = null;
  registro.listaEl = null;
  registro.bloqueRegistroEl = null;
  registro.filtrosEl = null;
  registro.progresoEl = null;
  registro.avisoEl = null;
  registro.enCursoEl = null;
  registro.toggleEl = null;
  registro.contenedor = null;
}