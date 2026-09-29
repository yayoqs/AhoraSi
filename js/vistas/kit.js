/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/kit.js
   Versión: 3.0.0
   Propósito: vista del kit de campamento. Formulario colapsable
              para agregar items. Los items se agrupan por
              categoría con checkbox para marcar listo. Barra de
              progreso con el total. Edición inline.
              v3.0.0: rediseño al nuevo lenguaje visual. La vista
                      ya no emite h1 ni lead (los muestra el
                      shell). Estructura de clases ajustada.
              v1.5.0: edición inline.
              v1.4.0: categoría como select.
              v1.3.0: formulario colapsable.
              v1.2.1: mostrarConfirmacion().
              v1.1.0: distintivoAutor.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoKit from '../datos/repositorios/kit.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:kit');

const CATEGORIAS = [
  'Dormir',
  'Comer',
  'Cocina',
  'Ropa',
  'Herramientas',
  'Primeros auxilios',
  'Aseo',
  'Observación',
  'Energía',
  'Música',
];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  items: [],
  formularioAbierto: false,
  editandoId: null,
};

/* ---------- Utilidades ---------------------------------------- */

function agruparPorCategoria(items) {
  const mapa = new Map();
  for (const it of items) {
    if (!mapa.has(it.categoria)) mapa.set(it.categoria, []);
    mapa.get(it.categoria).push(it);
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/* ---------- Formulario ---------------------------------------- */

function pintarBloqueRegistro() {
  const cont = h('div', {});

  if (!registro.formularioAbierto) {
    cont.append(h('button', {
      type: 'button',
      class: 'btn-agregar-principal',
      'data-accion': 'abrir-formulario',
    }, '+ Añadir item'));
    return cont;
  }

  const form = h('form', { class: 'form-inline', 'data-accion': 'crear' },
    h('select', { name: 'categoria', required: true },
      ...CATEGORIAS.map((c) => h('option', { value: c }, c))
    ),
    h('input', {
      name: 'item',
      placeholder: 'Item',
      required: true,
      maxlength: 100,
    }),
    h('div', { class: 'form-inline__fila' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn btn--primario' }, 'Añadir')
    )
  );

  cont.append(form);
  return cont;
}

/* ---------- Edición inline ------------------------------------ */

function pintarItemEnEdicion(it) {
  const categorias = CATEGORIAS.includes(it.categoria)
    ? CATEGORIAS
    : [it.categoria, ...CATEGORIAS];

  const selectCategoria = h('select', { name: 'categoria', required: true },
    ...categorias.map((c) => {
      const op = h('option', { value: c }, c);
      if (c === it.categoria) op.setAttribute('selected', '');
      return op;
    })
  );

  const inputItem = h('input', {
    name: 'item',
    value: it.item || '',
    placeholder: 'Item',
    required: true,
    maxlength: 100,
  });

  return h('li', { class: 'pieza-edit', 'data-id': it.id },
    selectCategoria,
    inputItem,
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
        onclick: () => guardarEdicion(it.id, {
          categoria: selectCategoria.value,
          item: inputItem.value,
        }),
      }, 'Guardar')
    )
  );
}

async function guardarEdicion(id, valores) {
  const r = await repoKit.actualizar(id, {
    categoria: valores.categoria,
    item: valores.item,
  });
  if (r.exito) {
    const i = registro.items.findIndex((x) => x.id === id);
    if (i >= 0) registro.items[i] = r.datos;
    registro.editandoId = null;
    pintar();
  } else {
    pintarError(r.error);
  }
}

/* ---------- Item de lista ------------------------------------- */

function pintarItem(it) {
  if (registro.editandoId === it.id) {
    return pintarItemEnEdicion(it);
  }

  const li = h('li', {
    class: 'kit__item' + (it.listo ? ' kit__item--listo' : ''),
    'data-id': it.id,
  });

  li.append(
    h('label', { class: 'kit__check' },
      h('input', {
        type: 'checkbox',
        'data-accion': 'toggle',
        'data-id': it.id,
        checked: it.listo ? '' : null,
      }),
      h('span', { class: 'kit__item-texto' }, it.item)
    )
  );

  const acciones = h('div', { class: 'kit__item-acciones' });
  if (it.listo && it.marcadoPor) {
    acciones.append(distintivoAutor(it.marcadoPor));
  }
  acciones.append(
    h('button', {
      type: 'button',
      class: 'btn-mini',
      'data-accion': 'editar',
      'data-id': it.id,
    }, 'Editar'),
    h('button', {
      type: 'button',
      class: 'btn-mini btn-mini--peligro',
      'data-accion': 'eliminar',
      'data-id': it.id,
    }, 'Eliminar')
  );
  li.append(acciones);

  return li;
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-kit', class: 'vista vista--kit' });

  const totales = registro.items.length;
  const listos = registro.items.filter((x) => x.listo).length;

  // Barra de progreso (solo si hay items).
  if (totales > 0) {
    raiz.append(h('div', { class: 'kit__progreso' },
      h('span', { class: 'kit__progreso-texto' },
        `${listos} de ${totales} listos`),
      h('div', { class: 'kit__barra' },
        h('i', { style: `width: ${Math.round((listos / totales) * 100)}%` })
      )
    ));
  }

  raiz.append(pintarBloqueRegistro());

  if (totales === 0) {
    raiz.append(h('p', { class: 'vista__vacio' }, 'El kit está vacío. Añade el primer item.'));
  } else {
    const grupos = agruparPorCategoria(registro.items);
    const contenedorGrupos = h('div', { class: 'kit__grupos' });

    for (const [categoria, items] of grupos) {
      const seccion = h('section', { class: 'kit__grupo' });
      seccion.append(h('h2', { class: 'kit__grupo-titulo' }, categoria));
      const ul = h('ul', { class: 'kit__lista' });
      for (const it of items) {
        ul.append(pintarItem(it));
      }
      seccion.append(ul);
      contenedorGrupos.append(seccion);
    }
    raiz.append(contenedorGrupos);
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
  const r = await repoKit.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.items = r.datos;
  pintar();
}

/* ---------- Submit -------------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const r = await repoKit.crear({
    categoria: fd.get('categoria'),
    item: fd.get('item'),
  });
  if (r.exito) {
    registro.items = [...registro.items, r.datos];
    registro.formularioAbierto = false;
    form.reset();
    pintar();
    pintarOk('Item añadido.');
  } else {
    pintarError(r.error);
  }
}

/* ---------- Change -------------------------------------------- */

async function manejarChange(ev) {
  const check = ev.target.closest('input[data-accion="toggle"]');
  if (!check) return;
  const id = check.dataset.id;
  const r = await repoKit.marcar(id, check.checked);
  if (r.exito) {
    const i = registro.items.findIndex((x) => x.id === id);
    if (i >= 0) registro.items[i] = r.datos;
    pintar();
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
      const input = registro.contenedor.querySelector('input[name="item"]');
      if (input) input.focus();
    }, 60);
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'editar') {
    registro.editandoId = id;
    pintar();
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion(
      'Eliminar item del kit',
      '¿Seguro que quieres eliminar este item?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoKit.eliminar(id);
    if (r.exito) {
      registro.items = registro.items.filter((x) => x.id !== id);
      pintar();
    } else {
      pintarError(r.error);
    }
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.formularioAbierto = false;
  registro.editandoId = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('change', manejarChange, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:kit:crear', refrescar),
    al('realtime:kit:actualizar', refrescar),
    al('realtime:kit:eliminar', refrescar),
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
  registro.items = [];
  registro.formularioAbierto = false;
  registro.editandoId = null;
  registro.contenedor = null;
}