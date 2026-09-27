/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/ideas.js
   Versión: 1.2.1
   Propósito: vista de ideas. Anotaciones sin fecha ni estado, con
              categoría. Formulario colapsable, chips de filtro,
              agrupación por categoría, edición inline.
              v1.2.1: se quita el datalist de sugerencias del
                      formulario de creación. El campo categoría
                      queda como texto libre, igual que en Kit.
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

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  ideas: [],
  categoriaActiva: null,
  editandoIdea: null,
  formularioAbierto: false,
};

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

function ideasPorCategoria(items) {
  const mapa = new Map();
  for (const it of items) {
    const cat = it.categoria || 'Sin categoría';
    if (!mapa.has(cat)) mapa.set(cat, []);
    mapa.get(cat).push(it);
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/* ---------- Bloque de registro (colapsable) ------------------- */

function pintarBloqueRegistro() {
  const cont = h('div', { class: 'bloque-registro' });

  if (!registro.formularioAbierto) {
    cont.append(
      h('button', {
        type: 'button',
        class: 'abrir-form',
        'data-accion': 'abrir-formulario',
      }, '+ Agregar idea')
    );
    return cont;
  }

  const form = h('form', { class: 'vista__form', 'data-accion': 'crear' },
    h('input', {
      name: 'categoria',
      placeholder: 'Categoría (Naturaleza, Electrónica…)',
      required: true,
      maxlength: 50,
    }),
    h('input', { name: 'titulo', placeholder: 'Título de la idea', required: true, maxlength: 200 }),
    h('textarea', { name: 'descripcion', placeholder: 'Descripción', maxlength: 500, rows: 3 }),
    h('div', { class: 'form-botones' },
      h('button', {
        type: 'button',
        class: 'btn-secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-primario' }, 'Agregar')
    )
  );

  cont.append(form);
  return cont;
}

/* ---------- Tarjeta de idea ----------------------------------- */

function pintarIdeaEnEdicion(it) {
  const inputCat = h('input', { value: it.categoria || '', placeholder: 'Categoría', maxlength: 50 });
  const inputTitulo = h('input', { value: it.titulo || '', placeholder: 'Título', maxlength: 200 });
  const textarea = h('textarea', { placeholder: 'Descripción' }, it.descripcion || '');
  return h('li', { class: 'pieza-edit', style: 'list-style:none;' },
    inputCat,
    inputTitulo,
    textarea,
    h('div', { class: 'pieza-edit__botones' },
      h('button', {
        type: 'button', class: 'btn-primario',
        onclick: () => guardarEdicion(it.id, inputCat.value, inputTitulo.value, textarea.value),
      }, 'Guardar'),
      h('button', {
        type: 'button', class: 'btn-secundario',
        onclick: () => {
          registro.editandoIdea = null;
          pintar();
        },
      }, 'Cancelar')
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
    registro.editandoIdea = null;
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

  const cats = categoriasDe(registro.ideas);

  const raiz = h('section', { id: 'vista-ideas', class: 'vista vista--ideas' });

  raiz.append(
    h('header', { class: 'ideas__cabecera' },
      h('h1', {}, 'Ideas'),
      h('p', { class: 'vista__lead' },
        'Cosas que se nos ocurren y quedan anotadas. Sin fecha, sin estado. Cuando alguna tenga sentido, la pasamos a planes.')
    )
  );

  raiz.append(pintarBloqueRegistro());

  if (cats.length > 0) {
    const chips = h('div', { class: 'chips-categoria', role: 'group', 'aria-label': 'Filtrar por categoría' });
    chips.append(h('button', {
      type: 'button',
      class: 'chip-categoria',
      'data-accion': 'filtrar-categoria',
      'data-categoria': '',
      'aria-pressed': String(!registro.categoriaActiva),
    }, 'Todas'));
    for (const c of cats) {
      chips.append(h('button', {
        type: 'button',
        class: 'chip-categoria',
        'data-accion': 'filtrar-categoria',
        'data-categoria': c,
        'aria-pressed': String(registro.categoriaActiva === c),
      }, c));
    }
    raiz.append(chips);
  }

  const items = ideasFiltradas();

  if (items.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' },
      registro.ideas.length === 0
        ? 'Todavía no hay ideas.'
        : 'No hay ideas en esta categoría.'));
  } else {
    const grupos = ideasPorCategoria(items);
    for (const [categoria, grupo] of grupos) {
      const seccion = h('section', { class: 'grupo-ideas' });
      seccion.append(h('h3', { class: 'grupo-ideas__titulo' }, categoria));
      const ul = h('ul', { class: 'lista-ideas' });
      for (const it of grupo) {
        if (registro.editandoIdea === it.id) {
          ul.append(pintarIdeaEnEdicion(it));
        } else {
          ul.append(h('li', { class: 'idea', 'data-id': it.id },
            h('div', { class: 'idea__cuerpo' },
              h('strong', {}, it.titulo),
              it.descripcion ? h('p', {}, it.descripcion) : null,
              h('div', { class: 'idea__meta' }, distintivoAutor(it.creadoPor))
            ),
            h('div', { class: 'idea__acciones' },
              h('button', {
                type: 'button',
                class: 'btn-sumar',
                'data-accion': 'sumar-a-planes',
                'data-id': it.id,
              }, 'Pasar a planes'),
              h('button', {
                type: 'button',
                class: 'btn-mini',
                'data-accion': 'editar-idea',
                'data-id': it.id,
              }, 'Editar'),
              h('button', {
                type: 'button',
                class: 'btn-mini',
                'data-accion': 'eliminar',
                'data-id': it.id,
              }, 'Eliminar')
            )
          ));
        }
      }
      seccion.append(ul);
      raiz.append(seccion);
    }
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
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;
  const id = boton.dataset.id;

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
  } else if (accion === 'sumar-a-planes') {
    const r = await repoPlanes.sumarAPlanes(id);
    if (r.exito) {
      registro.categoriaActiva = null;
      registro.ideas = registro.ideas.filter((x) => x.id !== id);
      pintar();
      pintarOk('Idea pasada a planes.');
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'editar-idea') {
    registro.editandoIdea = id;
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
      pintar();
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'filtrar-categoria') {
    const cat = boton.dataset.categoria || null;
    registro.categoriaActiva = cat;
    pintar();
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.categoriaActiva = null;
  registro.editandoIdea = null;
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
  registro.editandoIdea = null;
  registro.formularioAbierto = false;
  registro.contenedor = null;
}