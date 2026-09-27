/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/planes.js
   Versión: 1.7.0
   Propósito: vista de planes. Lista coordinable de cosas para
              hacer juntos. Formulario colapsable, botones de estado
              (Sí/Quizás/No/Pendiente) por plan.
              v1.7.0: formulario colapsable, id="vista-planes" para
                      encapsulado de CSS. Sin cambios en las firmas
                      públicas.
              v1.6.1: se quita la sección Ideas (movida a ideas.js).
              v1.6.0: sección ideas (revertido).
              v1.3.1: mostrarConfirmacion().
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
  formularioAbierto: false,
};

/* ---------- Bloque de registro (colapsable) ------------------- */

function pintarBloqueRegistro() {
  const cont = h('div', { class: 'bloque-registro' });

  if (!registro.formularioAbierto) {
    cont.append(
      h('button', {
        type: 'button',
        class: 'abrir-form',
        'data-accion': 'abrir-formulario',
      }, '+ Crear plan')
    );
    return cont;
  }

  const form = h('form', { class: 'vista__form', 'data-accion': 'crear' },
    h('input', { name: 'titulo', placeholder: 'Título del plan', required: true, maxlength: 200 }),
    h('input', { name: 'descripcion', placeholder: 'Descripción', maxlength: 500 }),
    h('input', { name: 'cuando', placeholder: 'Cuándo' }),
    h('div', { class: 'form-botones' },
      h('button', {
        type: 'button',
        class: 'btn-secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-primario' }, 'Crear')
    )
  );

  cont.append(form);
  return cont;
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const lista = registro.planes.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Todavía no hay planes. Crea el primero.')
    : h('ul', { class: 'vista__lista' },
        ...registro.planes.map((p) => pintarPlan(p))
      );

  cont.append(
    h('section', { id: 'vista-planes', class: 'vista vista--planes' },
      h('header', { class: 'planes__cabecera' },
        h('h1', {}, 'Planes'),
        h('p', { class: 'vista__lead' },
          'Lo que queremos hacer juntos. Marca con Sí, Quizás o No. Cualquier respuesta sirve.')
      ),
      pintarBloqueRegistro(),
      lista
    )
  );
}

function pintarPlan(p) {
  return h('li', { class: 'vista__item', 'data-id': p.id },
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
  );
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
  const r = await repoPlanes.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.planes = r.datos;
  pintar();
}

/* ---------- Submit -------------------------------------------- */

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
    registro.planes = [r.datos, ...registro.planes];
    registro.formularioAbierto = false;
    form.reset();
    pintar();
    pintarOk('Plan creado.');
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
      const input = registro.contenedor.querySelector('input[name="titulo"]');
      if (input) input.focus();
    }, 60);
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'estado') {
    const nuevo = boton.dataset.estado;
    const r = await repoPlanes.cambiarEstado(id, nuevo);
    if (r.exito) {
      const i = registro.planes.findIndex((x) => x.id === id);
      if (i >= 0) registro.planes[i] = r.datos;
      pintar();
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion(
      'Eliminar plan',
      '¿Seguro que quieres eliminar este plan? Esta acción no se puede deshacer.',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoPlanes.eliminar(id);
    if (r.exito) {
      registro.planes = registro.planes.filter((x) => x.id !== id);
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
  registro.formularioAbierto = false;
  registro.contenedor = null;
}