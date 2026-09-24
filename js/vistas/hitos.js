/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/hitos.js
   Versión: 1.2.0
   Propósito: vista de hitos compartidos.
              v1.2.0: usa distintivoAutor(). Clase .vista--hitos.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoHitos from '../datos/repositorios/hitos.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:hitos');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  hitos: [],
};

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const form = h('form', { class: 'vista__form', 'data-accion': 'crear' },
    h('input', { name: 'titulo', placeholder: 'Título del hito', required: true, maxlength: 200 }),
    h('input', { type: 'date', name: 'fecha' }),
    h('button', { type: 'submit' }, 'Agregar hito')
  );

  const lista = registro.hitos.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Sin hitos todavía. Agrega el primero arriba.')
    : h('ul', { class: 'vista__lista' },
        ...registro.hitos.map((x) => h('li', { class: 'vista__item' + (x.cumplido ? ' vista__item--completo' : ''), 'data-id': x.id },
          h('div', { class: 'vista__item-cabecera' },
            h('strong', {}, x.titulo),
            distintivoAutor(x.registradoPor)
          ),
          x.fecha ? h('p', { class: 'meta' }, formatearFecha(x.fecha)) : null,
          h('div', { class: 'acciones' },
            h('button', {
              type: 'button',
              'data-accion': 'toggle',
              'data-id': x.id,
              'aria-pressed': String(x.cumplido),
            }, x.cumplido ? 'Cumplido' : 'Marcar cumplido'),
            h('button', {
              type: 'button',
              'data-accion': 'eliminar',
              'data-id': x.id,
            }, 'Eliminar')
          )
        ))
      );

  cont.append(
    h('section', { class: 'vista vista--hitos' },
      h('h1', {}, 'Hitos'),
      h('p', { class: 'vista__lead' }, 'Lo que ya pasó y lo que está por venir.'),
      form,
      lista
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
  const r = await repoHitos.listar();
  if (r.exito) {
    registro.hitos = r.datos;
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
  const fecha = fd.get('fecha');
  const r = await repoHitos.crear({
    titulo: fd.get('titulo'),
    fecha: fecha ? new Date(fecha + 'T12:00:00').toISOString() : null,
  });
  if (r.exito) {
    form.reset();
    await refrescar();
  } else {
    pintarError(r.error);
  }
}

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;
  const id = boton.dataset.id;
  const hito = registro.hitos.find((x) => x.id === id);
  if (!hito) return;

  if (accion === 'toggle') {
    const r = await repoHitos.marcar(id, !hito.cumplido);
    if (r.exito) await refrescar();
    else pintarError(r.error);
  } else if (accion === 'eliminar') {
    if (!confirm('¿Eliminar este hito?')) return;
    const r = await repoHitos.eliminar(id);
    if (r.exito) await refrescar();
    else pintarError(r.error);
  }
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:hitos:crear', refrescar),
    al('realtime:hitos:actualizar', refrescar),
    al('realtime:hitos:eliminar', refrescar),
  ];

  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.hitos = [];
  registro.contenedor = null;
}