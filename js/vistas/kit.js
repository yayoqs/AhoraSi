/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/kit.js
   Versión: 1.2.0
   Propósito: vista del kit de campamento.
              v1.2.0: usa distintivoAutor() cuando el item está
                      marcado. Clase .vista--kit. Progreso como
                      etiqueta destacada.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoKit from '../datos/repositorios/kit.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:kit');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  items: [],
};

function agruparPorCategoria(items) {
  const mapa = new Map();
  for (const it of items) {
    if (!mapa.has(it.categoria)) mapa.set(it.categoria, []);
    mapa.get(it.categoria).push(it);
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const form = h('form', { class: 'vista__form', 'data-accion': 'crear' },
    h('input', { name: 'categoria', placeholder: 'Categoría', required: true, maxlength: 50 }),
    h('input', { name: 'item', placeholder: 'Item', required: true, maxlength: 100 }),
    h('button', { type: 'submit' }, 'Agregar item')
  );

  const totales = registro.items.length;
  const listos = registro.items.filter((x) => x.listo).length;

  const progreso = h('p', { class: 'vista__progreso' }, `${listos} de ${totales} listos`);

  const grupos = agruparPorCategoria(registro.items);

  const contenido = totales === 0
    ? h('p', { class: 'vista__vacio' }, 'El kit está vacío. Agrega el primer item arriba.')
    : h('div', { class: 'vista__grupos' },
        ...grupos.map(([categoria, items]) =>
          h('section', { class: 'vista__grupo' },
            h('h3', {}, categoria),
            h('ul', { class: 'vista__lista' },
              ...items.map((it) => h('li', { class: 'vista__item' + (it.listo ? ' vista__item--completo' : ''), 'data-id': it.id },
                h('label', { class: 'vista__check' },
                  h('input', {
                    type: 'checkbox',
                    'data-accion': 'toggle',
                    'data-id': it.id,
                    checked: it.listo ? '' : null,
                  }),
                  h('span', {}, it.item)
                ),
                h('div', { class: 'acciones' },
                  it.listo && it.marcadoPor ? distintivoAutor(it.marcadoPor) : null,
                  h('button', {
                    type: 'button',
                    'data-accion': 'eliminar',
                    'data-id': it.id,
                  }, 'Eliminar')
                )
              ))
            )
          )
        )
      );

  cont.append(
    h('section', { class: 'vista vista--kit' },
      h('h1', {}, 'Kit de campamento'),
      h('p', { class: 'vista__lead' }, 'Lo que llevamos cuando salimos.'),
      progreso,
      form,
      contenido
    )
  );
}

function pintarError(mensaje) {
  const cont = registro.contenedor;
  if (!cont) return;
  const error = h('p', { class: 'vista__error', role: 'alert' }, mensaje);
  cont.prepend(error);
  setTimeout(() => error.remove(), 5000);
}

async function refrescar() {
  const r = await repoKit.listar();
  if (r.exito) {
    registro.items = r.datos;
    pintar();
  } else {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
  }
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const r = await repoKit.crear({
    categoria: fd.get('categoria'),
    item: fd.get('item'),
  });
  if (r.exito) {
    form.reset();
    await refrescar();
  } else {
    pintarError(r.error);
  }
}

async function manejarChange(ev) {
  const check = ev.target.closest('input[data-accion="toggle"]');
  if (!check) return;
  const id = check.dataset.id;
  const r = await repoKit.marcar(id, check.checked);
  if (r.exito) await refrescar();
  else pintarError(r.error);
}

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion="eliminar"]');
  if (!boton) return;
  const id = boton.dataset.id;
  if (!confirm('¿Eliminar este item del kit?')) return;
  const r = await repoKit.eliminar(id);
  if (r.exito) await refrescar();
  else pintarError(r.error);
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('change', manejarChange, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:kit:crear', refrescar),
    al('realtime:kit:actualizar', refrescar),
    al('realtime:kit:eliminar', refrescar),
  ];

  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.items = [];
  registro.contenedor = null;
}