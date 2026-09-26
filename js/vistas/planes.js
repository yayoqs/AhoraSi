/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/planes.js
   Versión: 1.6.1
   Propósito: vista de planes. Lista coordinable de cosas para
              hacer juntos. Cada plan tiene título, descripción,
              cuándo y estado (Sí/Quizás/No/Pendiente).
              v1.6.1: se quita la sección de Ideas que se había
                      agregado en v1.6.0. La sección se mueve a
                      una vista propia (ideas.js). Sin cambios en
                      las firmas públicas ni en los eventos.
              v1.6.0: se agrega sección Ideas (revertido en 1.6.1).
              v1.3.1: usa mostrarConfirmacion().
              v1.3.0: activar() pinta primero.
              v1.2.0: distintivoAutor, clase .vista--planes.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoPlanes from '../datos/repositorios/planes.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
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

  const raiz = h('section', { class: 'vista vista--planes' });

  raiz.append(
    h('header', { class: 'vista__cabecera vista__cabecera--planes' },
      h('h1', {}, 'Planes'),
      h('p', { class: 'vista__lead' },
        'Lo que queremos hacer juntos. Marca con Sí, Quizás o No. Cualquier respuesta sirve.')
    )
  );

  const form = h('form', { class: 'vista__form', 'data-accion': 'crear' },
    h('input', { name: 'titulo', placeholder: 'Título del plan', required: true, maxlength: 200 }),
    h('input', { name: 'descripcion', placeholder: 'Descripción', maxlength: 500 }),
    h('input', { name: 'cuando', placeholder: 'Cuándo' }),
    h('button', { type: 'submit' }, 'Crear plan')
  );
  raiz.append(form);

  if (registro.planes.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' },
      'Todavía no hay planes. Crea el primero arriba.'));
  } else {
    const ul = h('ul', { class: 'vista__lista' });
    for (const p of registro.planes) {
      ul.append(h('li', { class: 'vista__item', 'data-id': p.id },
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
      ));
    }
    raiz.append(ul);
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
    esIdea: false,
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
    const ok = await mostrarConfirmacion(
      'Eliminar plan',
      '¿Seguro que quieres eliminar este plan? Esta acción no se puede deshacer.',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
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

  pintar();
  refrescar().catch((e) => log.error('Error al refrescar:', e));
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