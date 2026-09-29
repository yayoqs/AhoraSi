/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/ideas.js
   Versión: 4.0.0
   Propósito: vista de ideas. Anotaciones sin fecha ni estado, con
              categoría. Cada idea es una línea que se expande al
              toque para mostrar la descripción y las acciones.
              Solo una abierta a la vez.
              v4.0.0: variante D del prototipo. Se reemplaza la
                      lista agrupada por categoría (v3.0.0) por
                      una lista plana de líneas expandibles. El
                      chip de categoría va en la cabecera de cada
                      línea. Al tocar la línea, se abre y muestra
                      descripción, autor y botones. Solo una
                      abierta a la vez. Filtros con color propio.
                      Colores de categoría: las conocidas tienen
                      color fijo, las nuevas rotan entre 5
                      acentos según hash del nombre.
              v3.0.0: rediseño al nuevo lenguaje visual.
              v1.2.1: se quita datalist de sugerencias.
              v1.2.0: formulario colapsable, id="vista-ideas".
              v1.1.0: edición inline de ideas.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoPlanes from '../datos/repositorios/planes.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:ideas');

/* Colores fijos para categorías conocidas. Las que no están
   en este mapa rotan entre los 5 colores base según un hash. */
const CATEGORIA_COLOR = {
  'Percusión': 'mostaza',
  'Electrónica': 'azul',
  'Naturaleza': 'musgo',
  'Viajes': 'ciruela',
  'Trabajo': 'terracota',
  'Manualidades': 'terracota-clara',
  'Escalada': 'gris',
};

const COLORES_FALLBACK = ['terracota', 'mostaza', 'musgo', 'azul', 'ciruela'];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  ideas: [],
  categoriaActiva: null,
  abiertaId: null,
  editandoId: null,
  formularioAbierto: false,
};

/* ---------- Colores de categoría ------------------------------- */

function colorDeCategoria(nombre) {
  if (!nombre) return 'terracota';
  if (CATEGORIA_COLOR[nombre]) return CATEGORIA_COLOR[nombre];
  // Hash simple para asignar un color estable.
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  }
  return COLORES_FALLBACK[hash % COLORES_FALLBACK.length];
}

/* ---------- Utilidades ----------------------------------------- */

function categoriasDe(items) {
  const set = new Set();
  for (const it of items) {
    if (it.categoria) set.add(it.categoria);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function ideasFiltradas() {
  if (!registro.categoriaActiva) return registro.ideas;
  return registro.ideas.filter((i) => i.categoria === registro.categoriaActiva);
}

/* ---------- Formulario de creación ----------------------------- */

function pintarBloqueRegistro() {
  const cont = h('div', {});

  if (!registro.formularioAbierto) {
    cont.append(h('button', {
      type: 'button',
      class: 'btn-agregar-principal',
      'data-accion': 'abrir-formulario',
    }, '+ Agregar idea'));
    return cont;
  }

  const form = h('form', { class: 'form-inline', 'data-accion': 'crear' },
    h('input', {
      name: 'categoria',
      placeholder: 'Categoría (Percusión, Trabajo…)',
      required: true,
      maxlength: 50,
    }),
    h('input', { name: 'titulo', placeholder: 'Título de la idea', required: true, maxlength: 200 }),
    h('textarea', { name: 'descripcion', placeholder: 'Descripción', maxlength: 500, rows: 3 }),
    h('div', { class: 'form-inline__fila' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn btn--primario' }, 'Agregar')
    )
  );

  cont.append(form);
  return cont;
}

/* ---------- Filtros por categoría ------------------------------ */

function pintarFiltros() {
  const cats = categoriasDe(registro.ideas);
  if (cats.length === 0) return null;

  const cont = h('div', { class: 'filtros', role: 'group', 'aria-label': 'Filtrar por categoría' });

  cont.append(h('button', {
    type: 'button',
    class: 'filtro' + (registro.categoriaActiva === null ? ' is-active' : ''),
    'data-accion': 'filtrar',
    'data-categoria': '',
    'aria-pressed': String(registro.categoriaActiva === null),
  }, 'Todas'));

  for (const c of cats) {
    const color = colorDeCategoria(c);
    cont.append(h('button', {
      type: 'button',
      class: 'filtro' + (registro.categoriaActiva === c ? ' is-active' : ''),
      'data-accion': 'filtrar',
      'data-categoria': c,
      'data-color': color,
      'aria-pressed': String(registro.categoriaActiva === c),
    }, c));
  }

  return cont;
}

/* ---------- Línea de idea -------------------------------------- */

function pintarLinea(it) {
  if (registro.editandoId === it.id) {
    return pintarLineaEnEdicion(it);
  }

  const abierta = registro.abiertaId === it.id;
  const color = colorDeCategoria(it.categoria);

  const linea = h('div', {
    class: 'linea' + (abierta ? ' is-abierta' : ''),
    'data-id': it.id,
  });

  // Cabecera: clickeable para abrir/cerrar.
  const cab = h('button', {
    type: 'button',
    class: 'linea__cab',
    'data-accion': 'toggle-linea',
    'data-id': it.id,
    'aria-expanded': String(abierta),
  });

  const flecha = h('span', { class: 'linea__flecha', 'aria-hidden': 'true' });
  flecha.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%"><path d="M9 6l6 6-6 6"/></svg>';
  cab.append(flecha);

  cab.append(h('span', { class: 'linea__titulo' }, it.titulo));

  if (it.categoria) {
    cab.append(h('span', { class: `cat cat--${color} linea__cat` }, it.categoria));
  }

  linea.append(cab);

  // Cuerpo: solo se muestra cuando está abierta.
  if (abierta) {
    const cuerpo = h('div', { class: 'linea__cuerpo' });

    if (it.descripcion) {
      cuerpo.append(h('p', { class: 'linea__desc' }, it.descripcion));
    }

    cuerpo.append(
      h('div', { class: 'linea__pie' },
        distintivoAutor(it.creadoPor),
        h('div', { class: 'linea__acciones' },
          h('button', {
            type: 'button', class: 'btn-mini btn-mini--sumar',
            'data-accion': 'sumar-a-planes',
            'data-id': it.id,
          }, 'Pasar a planes'),
          h('button', {
            type: 'button', class: 'btn-mini',
            'data-accion': 'editar-idea',
            'data-id': it.id,
          }, 'Editar'),
          h('button', {
            type: 'button', class: 'btn-mini btn-mini--peligro',
            'data-accion': 'eliminar',
            'data-id': it.id,
          }, 'Eliminar')
        )
      )
    );

    linea.append(cuerpo);
  }

  return linea;
}

function pintarLineaEnEdicion(it) {
  const inputCat = h('input', { value: it.categoria || '', placeholder: 'Categoría', maxlength: 50 });
  const inputTitulo = h('input', { value: it.titulo || '', placeholder: 'Título', maxlength: 200 });
  const textarea = h('textarea', { placeholder: 'Descripción' }, it.descripcion || '');

  return h('div', { class: 'linea is-abierta pieza-edit', 'data-id': it.id },
    h('div', { class: 'pieza-edit__cuerpo' },
      inputCat,
      inputTitulo,
      textarea
    ),
    h('div', { class: 'pieza-edit__botones' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        onclick: () => {
          registro.editandoId = null;
          pintar();
        },
      }, 'Cancelar'),
      h('button', {
        type: 'button', class: 'btn btn--primario',
        onclick: () => guardarEdicion(it.id, inputCat.value, inputTitulo.value, textarea.value),
      }, 'Guardar')
    )
  );
}

async function guardarEdicion(id, categoria, titulo, descripcion) {
  if (!titulo.trim()) {
    pintarError('El título no puede quedar vacío.');
    return;
  }
  const r = await repoPlanes.actualizar(id, {
    titulo: titulo.trim(),
    descripcion: (descripcion || '').trim(),
    categoria: (categoria || '').trim(),
  });
  if (r.exito) {
    const i = registro.ideas.findIndex((x) => x.id === id);
    if (i >= 0) registro.ideas[i] = r.datos;
    registro.editandoId = null;
    registro.abiertaId = id;
    pintar();
  } else {
    pintarError(r.error);
  }
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-ideas', class: 'vista vista--ideas' });

  raiz.append(pintarBloqueRegistro());

  const filtros = pintarFiltros();
  if (filtros) raiz.append(filtros);

  const items = ideasFiltradas();

  if (items.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' },
      registro.ideas.length === 0
        ? 'Todavía no hay ideas.'
        : 'No hay ideas en esta categoría.'));
  } else {
    const lista = h('div', { class: 'lista-ideas' });
    for (const it of items) {
      lista.append(pintarLinea(it));
    }
    raiz.append(lista);
  }

  cont.append(raiz);
}

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

async function refrescar() {
  const r = await repoPlanes.listarIdeas();
  if (r.exito) {
    registro.ideas = r.datos;
    pintar();
  } else {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
  }
}

/* ---------- Submit -------------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const r = await repoPlanes.crear({
    titulo: fd.get('titulo'),
    descripcion: fd.get('descripcion'),
    categoria: fd.get('categoria'),
    esIdea: true,
  });
  if (r.exito) {
    registro.ideas = [r.datos, ...registro.ideas];
    registro.formularioAbierto = false;
    form.reset();
    pintar();
    pintarOk('Idea agregada.');
  } else {
    pintarError(r.error);
  }
}

/* ---------- Click --------------------------------------------- */

async function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;

  if (accion === 'abrir-formulario') {
    registro.formularioAbierto = true;
    pintar();
    setTimeout(() => {
      const input = registro.contenedor.querySelector('input[name="categoria"]');
      if (input) input.focus();
    }, 60);
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'toggle-linea') {
    if (registro.abiertaId === id) {
      registro.abiertaId = null;
    } else {
      registro.abiertaId = id;
      registro.editandoId = null;
    }
    pintar();
  } else if (accion === 'sumar-a-planes') {
    const r = await repoPlanes.sumarAPlanes(id);
    if (r.exito) {
      registro.categoriaActiva = null;
      registro.abiertaId = null;
      registro.ideas = registro.ideas.filter((x) => x.id !== id);
      pintar();
      pintarOk('Idea pasada a planes.');
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'editar-idea') {
    registro.editandoId = id;
    registro.abiertaId = id;
    pintar();
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion(
      'Eliminar idea',
      '¿Seguro que quieres eliminar esta idea?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoPlanes.eliminar(id);
    if (r.exito) {
      registro.ideas = registro.ideas.filter((x) => x.id !== id);
      if (registro.abiertaId === id) registro.abiertaId = null;
      pintar();
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'filtrar') {
    const cat = btn.dataset.categoria || null;
    registro.categoriaActiva = cat;
    // Si la idea abierta no está en el filtro, cerramos.
    if (registro.abiertaId) {
      const abierta = registro.ideas.find((x) => x.id === registro.abiertaId);
      if (abierta && cat && abierta.categoria !== cat) {
        registro.abiertaId = null;
      }
    }
    pintar();
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.categoriaActiva = null;
  registro.abiertaId = null;
  registro.editandoId = null;
  registro.formularioAbierto = false;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:planes:crear', refrescar),
    al('realtime:planes:actualizar', refrescar),
    al('realtime:planes:eliminar', refrescar),
  ];

  pintar();
  refrescar().catch((e) => log.error('Error al refrescar:', e));
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.ideas = [];
  registro.categoriaActiva = null;
  registro.abiertaId = null;
  registro.editandoId = null;
  registro.formularioAbierto = false;
  registro.contenedor = null;
}