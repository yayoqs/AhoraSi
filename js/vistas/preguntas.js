/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/preguntas.js
   Versión: 1.0.0
   Propósito: vista de preguntas. Muestra una pregunta al azar
              arriba y un formulario para agregar. Botones para
              pasar a la siguiente o sacar una al azar. Botón para
              ver todas y eliminar.
              v1.0.0: versión inicial, extraída del antiguo
                      juegos.js v1.2.0.
   ================================================================ */

import * as repoPreguntas from '../datos/repositorios/preguntas.js';
import { al } from '../nucleo/bus-eventos.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:preguntas');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  preguntas: [],
  preguntaActual: 0,
  listaVisible: false,
};

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-preguntas', class: 'vista vista--preguntas' });

  const total = registro.preguntas.length;
  const idx = total ? registro.preguntaActual % total : 0;
  const pregunta = total ? registro.preguntas[idx].texto : 'Agrega preguntas para empezar.';

  const caja = h('div', { class: 'dicho dicho--pregunta' });
  if (total > 0) {
    caja.append(h('span', { class: 'dicho__eyebrow' }, 'Al azar'));
  }
  caja.append(document.createTextNode(pregunta));
  raiz.append(caja);

  if (total > 0) {
    raiz.append(h('div', { class: 'acciones-centro' },
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'siguiente',
      }, 'Siguiente'),
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'azar',
      }, 'Al azar')
    ));
  }

  if (total > 0) {
    raiz.append(h('div', { class: 'acciones-centro' },
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'toggle-lista',
      }, registro.listaVisible ? 'Ocultar preguntas' : 'Ver todas las preguntas')
    ));

    if (registro.listaVisible) {
      const lista = h('div', {});
      registro.preguntas.forEach((p, i) => {
        lista.append(h('article', {
          class: 'lista-item',
          style: 'border-left-color: var(--musgo);',
        },
          h('div', { style: 'display: flex; gap: 10px; align-items: flex-start;' },
            h('span', { class: 'dicho__eyebrow', style: 'margin: 0; color: var(--tinta-tenue); min-width: 20px;' }, String(i + 1)),
            h('p', { class: 'lista-item__texto', style: 'flex: 1; margin: 0;' }, p.texto),
            h('button', {
              type: 'button', class: 'btn-mini btn-mini--peligro',
              'data-accion': 'eliminar',
              'data-id': p.id,
            }, 'Quitar')
          )
        ));
      });
      raiz.append(lista);
    }
  }

  const textarea = h('textarea', {
    placeholder: 'Agregar pregunta nueva',
    maxlength: 300,
    rows: 2,
  });

  const form = h('form', { class: 'form-linea', 'data-accion': 'crear' },
    textarea,
    h('button', { type: 'submit', style: 'background: var(--musgo);' }, 'Agregar')
  );

  raiz.append(form);
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
  const r = await repoPreguntas.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.preguntas = r.datos;
  pintar();
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const texto = form.querySelector('textarea')?.value?.trim() || '';
  if (!texto) return;

  const r = await repoPreguntas.crear({ texto });
  if (!r.exito) {
    pintarError(r.error);
    return;
  }
  form.reset();
  await refrescar();
  pintarOk('Pregunta agregada.');
}

async function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;

  if (accion === 'siguiente') {
    const total = registro.preguntas.length;
    if (total === 0) return;
    registro.preguntaActual = (registro.preguntaActual + 1) % total;
    pintar();
  } else if (accion === 'azar') {
    const total = registro.preguntas.length;
    if (total === 0) return;
    registro.preguntaActual = Math.floor(Math.random() * total);
    pintar();
  } else if (accion === 'toggle-lista') {
    registro.listaVisible = !registro.listaVisible;
    pintar();
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion('Quitar pregunta', '¿Seguro que quieres quitarla?', { textoConfirmar: 'Quitar' });
    if (!ok) return;
    const r = await repoPreguntas.eliminar(id);
    if (r.exito) {
      await refrescar();
    } else {
      pintarError(r.error);
    }
  }
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.preguntas = [];
  registro.preguntaActual = 0;
  registro.listaVisible = false;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:preguntas:crear', refrescar),
    al('realtime:preguntas:eliminar', refrescar),
  ];

  pintar();
  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.preguntas = [];
  registro.preguntaActual = 0;
  registro.listaVisible = false;
  registro.contenedor = null;
}