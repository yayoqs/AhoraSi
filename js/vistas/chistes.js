/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/chistes.js
   Versión: 1.0.0
   Propósito: vista de chistes. Muestra un chiste al azar arriba y
              un formulario para agregar. Botón "Otro" saca otro
              chiste al azar. Sin lista.
              v1.0.0: versión inicial, extraída del antiguo
                      juegos.js v1.2.0.
   ================================================================ */

import * as repoChistes from '../datos/repositorios/chistes.js';
import { al } from '../nucleo/bus-eventos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:chistes');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  chistes: [],
  chisteActualId: null,
};

/* ---------- Helpers ------------------------------------------- */

function chisteActual() {
  const total = registro.chistes.length;
  if (total === 0) return null;

  if (registro.chisteActualId) {
    const actual = registro.chistes.find((c) => c.id === registro.chisteActualId);
    if (actual) return actual;
  }

  const elegido = registro.chistes[Math.floor(Math.random() * total)];
  registro.chisteActualId = elegido.id;
  return elegido;
}

function otroChiste() {
  const total = registro.chistes.length;
  if (total === 0) return;
  if (total === 1) {
    registro.chisteActualId = registro.chistes[0].id;
    pintar();
    return;
  }
  let nuevo;
  do {
    nuevo = registro.chistes[Math.floor(Math.random() * total)];
  } while (nuevo.id === registro.chisteActualId && total > 1);
  registro.chisteActualId = nuevo.id;
  pintar();
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-chistes', class: 'vista vista--chistes' });

  const actual = chisteActual();
  const texto = actual
    ? actual.texto
    : 'Sin chistes todavía. Agrega el primero — mientras más fome, mejor.';

  const caja = h('div', { class: 'dicho dicho--chiste' });
  if (actual) {
    caja.append(h('span', { class: 'dicho__eyebrow' }, 'Del sombrero'));
  }
  caja.append(document.createTextNode(texto));
  raiz.append(caja);

  if (registro.chistes.length > 1) {
    raiz.append(h('div', { class: 'acciones-centro' },
      h('button', {
        type: 'button',
        class: 'btn-mini',
        'data-accion': 'otro',
      }, 'Otro chiste')
    ));
  }

  const textarea = h('textarea', {
    placeholder: '¿Sabes uno? Cuéntalo aquí. Mientras más fome, mejor.',
    maxlength: 500,
    rows: 2,
  });

  const form = h('form', { class: 'form-linea', 'data-accion': 'crear' },
    textarea,
    h('button', { type: 'submit' }, 'Agregar')
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
  const r = await repoChistes.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.chistes = r.datos;
  if (registro.chisteActualId && !registro.chistes.some((c) => c.id === registro.chisteActualId)) {
    registro.chisteActualId = null;
  }
  pintar();
}

/* ---------- Eventos ------------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const texto = String(fd.get('texto') || form.querySelector('textarea')?.value || '').trim();
  if (!texto) return;

  const r = await repoChistes.crear({ texto });
  if (!r.exito) {
    pintarError(r.error);
    return;
  }
  form.reset();
  registro.chisteActualId = r.datos.id;
  await refrescar();
  pintarOk('Agregado.');
}

function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (!btn) return;
  if (btn.dataset.accion === 'otro') {
    otroChiste();
  }
}

/* ---------- Ciclo de vida ------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.chistes = [];
  registro.chisteActualId = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:chistes:crear', refrescar),
    al('realtime:chistes:eliminar', refrescar),
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
  registro.chistes = [];
  registro.chisteActualId = null;
  registro.contenedor = null;
}