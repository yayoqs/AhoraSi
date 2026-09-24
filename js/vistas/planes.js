/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/planes.js
   Versión: 1.2.0
   Propósito: vista de planes.
              v1.2.0: usa distintivoAutor() de autores.js. Se
                      agrega clase .vista--planes al section.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoPlanes from '../datos/repositorios/planes.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:planes');

const ESTADOS = [
  { id: 'si', etiqueta: 'Sí' },
  { id: 'quiza', etiqueta: 'Quizás' },
  { id: 'no', etiqueta: 'No' },
  { id: 'pendiente', etiqueta: 'Pendiente' },
];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  planes: [],
};

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const form = h('form', { class: 'vista__form', 'data-accion': 'crear' },
    h('input', { name: 'titulo', placeholder: 'Título del plan', required: true, maxlength: 200 }),
    h('input', { name: 'descripcion', placeholder: 'Descripción', maxlength: 500 }),
    h('input', { name: 'cuando', placeholder: 'Cuándo' }),
    h('button', { type: 'submit' }, 'Crear plan')
  );

  const lista = registro.planes.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Todavía no hay planes. Crea el primero arriba.')
    : h('ul', { class: 'vista__lista' },
        ...registro.planes.map((p) => h('li', { class: 'vista__item', 'data-id': p.id },
          h('div', { class: 'vista__item-cabecera' },
            h('strong', {}, p.titulo),
            distintivoAutor(p.creadoPor)
          ),
          p.descripcion ? h('p', {}, p.descripcion) : null,
          p.cuando ? h('p', { class: 'meta' }, p.cuando) : null,
          h('div', { class: 'acciones' },
            ...ESTADOS.map((e) => h('button', {
              type: 'button',
              'data-accion': 'estado',
              'data-id': p.id,
              'data-estado': e.id,
              'aria-pressed': String(p.estado === e.id),
            }, e.etiqueta)),
            h('button', {
              type: 'button',
              'data-accion': 'eliminar',
              'data-id': p.id,
            }, 'Eliminar')
          )
        ))
      );

  cont.append(
    h('section', { class: 'vista vista--planes' },
      h('h1', {}, 'Planes'),
      h('p', { class: 'vista__lead' },
        'Lo que queremos hacer juntos. Marca con "Sí", "Quizás" o "No".'),
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
  const r = await repoPlanes.listar();
  if (r.exito) {
    registro.planes = r.datos;
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
  const r = await repoPlanes.crear({
    titulo: fd.get('titulo'),
    descripcion: fd.get('descripcion'),
    cuando: fd.get('cuando'),
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

  if (accion === 'estado') {
    const nuevo = boton.dataset.estado;
    const r = await repoPlanes.cambiarEstado(id, nuevo);
    if (r.exito) await refrescar();
    else pintarError(r.error);
  } else if (accion === 'eliminar') {
    if (!confirm('¿Eliminar este plan?')) return;
    const r = await repoPlanes.eliminar(id);
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
    al('realtime:planes:crear', refrescar),
    al('realtime:planes:actualizar', refrescar),
    al('realtime:planes:eliminar', refrescar),
  ];

  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.planes = [];
  registro.contenedor = null;
}