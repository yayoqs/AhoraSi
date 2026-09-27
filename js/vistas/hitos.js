/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/hitos.js
   Versión: 1.4.0
   Propósito: vista de hitos. Línea de tiempo de cosas que ya
              pasaron o están por venir. Formulario colapsable,
              edición inline de título y fecha, marcar cumplido.
              Sin fotos.
              v1.4.0: formulario colapsable, edición inline,
                      id="vista-hitos" para encapsulado de CSS.
                      Sin cambios en las firmas públicas.
              v1.3.0: activar() pinta primero, carga en background.
              v1.2.1: mostrarConfirmacion().
              v1.2.0: activar() pinta primero.
              v1.1.0: distintivoAutor, clase .vista--hitos.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoHitos from '../datos/repositorios/hitos.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:hitos');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  hitos: [],
  editandoId: null,
  formularioAbierto: false,
};

function fechaParaInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
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
      }, '+ Añadir hito')
    );
    return cont;
  }

  cont.append(pintarFormulario());
  return cont;
}

function pintarFormulario() {
  const form = h('form', { class: 'vista__form', 'data-accion': 'crear' },
    h('input', {
      name: 'titulo',
      placeholder: 'Título del hito',
      required: true,
      maxlength: 200,
    }),
    h('input', { type: 'date', name: 'fecha' }),
    h('div', { class: 'form-botones' },
      h('button', {
        type: 'button',
        class: 'btn-secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-primario' }, 'Añadir')
    )
  );
  return form;
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const lista = registro.hitos.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Sin hitos todavía. Añade el primero.')
    : h('ol', { class: 'linea-tiempo' },
        ...registro.hitos.map((x) => pintarHito(x))
      );

  cont.append(
    h('section', { id: 'vista-hitos', class: 'vista vista--hitos' },
      h('h1', {}, 'Hitos'),
      h('p', { class: 'vista__lead' }, 'Lo que ya pasó y lo que está por venir.'),
      pintarBloqueRegistro(),
      lista
    )
  );
}

function pintarHito(x) {
  if (registro.editandoId === x.id) {
    return pintarHitoEnEdicion(x);
  }

  return h('li', {
    class: 'hito' + (x.cumplido ? ' hito--cumplido' : ''),
    'data-id': x.id,
  },
    h('div', { class: 'hito__marca', 'aria-hidden': 'true' }),
    h('div', { class: 'hito__cuerpo' },
      h('div', { class: 'hito__cabecera' },
        h('span', { class: 'hito__fecha' }, x.fecha ? formatearFecha(x.fecha) : 'Pendiente'),
        distintivoAutor(x.registradoPor)
      ),
      h('h3', { class: 'hito__titulo' }, x.titulo),
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button',
          'data-accion': 'toggle',
          'data-id': x.id,
          'aria-pressed': String(x.cumplido),
        }, x.cumplido ? 'Cumplido' : 'Marcar cumplido'),
        h('button', {
          type: 'button',
          'data-accion': 'editar',
          'data-id': x.id,
        }, 'Editar'),
        h('button', {
          type: 'button',
          'data-accion': 'eliminar',
          'data-id': x.id,
        }, 'Eliminar')
      )
    )
  );
}

function pintarHitoEnEdicion(x) {
  const inputTitulo = h('input', { value: x.titulo || '', placeholder: 'Título', maxlength: 200, required: true });
  const inputFecha = h('input', { type: 'date', value: fechaParaInput(x.fecha) });

  return h('li', { class: 'hito pieza-edit', 'data-id': x.id },
    h('div', { class: 'pieza-edit__cuerpo' },
      inputTitulo,
      inputFecha,
      h('div', { class: 'pieza-edit__botones' },
        h('button', {
          type: 'button', class: 'btn-primario',
          onclick: () => guardarEdicion(x.id, {
            titulo: inputTitulo.value,
            fecha: inputFecha.value,
          }),
        }, 'Guardar'),
        h('button', {
          type: 'button', class: 'btn-secundario',
          onclick: () => {
            registro.editandoId = null;
            pintar();
          },
        }, 'Cancelar')
      )
    )
  );
}

async function guardarEdicion(id, valores) {
  const fecha = valores.fecha ? new Date(valores.fecha + 'T12:00:00').toISOString() : null;
  const r = await repoHitos.actualizar(id, {
    titulo: valores.titulo,
    fecha,
  });
  if (r.exito) {
    const i = registro.hitos.findIndex((x) => x.id === id);
    if (i >= 0) registro.hitos[i] = r.datos;
    registro.editandoId = null;
    pintar();
  } else {
    pintarError(r.error);
  }
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
  const r = await repoHitos.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.hitos = r.datos;
  pintar();
}

/* ---------- Submit -------------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const fecha = fd.get('fecha');

  const r = await repoHitos.crear({
    titulo: fd.get('titulo'),
    fecha: fecha ? new Date(fecha + 'T12:00:00').toISOString() : null,
  });

  if (!r.exito) {
    pintarError(r.error);
    return;
  }

  registro.hitos = [r.datos, ...registro.hitos];
  registro.formularioAbierto = false;
  form.reset();
  pintar();
  pintarOk('Hito añadido.');
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
  } else if (accion === 'toggle') {
    const hito = registro.hitos.find((x) => x.id === id);
    if (!hito) return;
    const r = await repoHitos.marcar(id, !hito.cumplido);
    if (r.exito) {
      const i = registro.hitos.findIndex((x) => x.id === id);
      if (i >= 0) registro.hitos[i] = r.datos;
      pintar();
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'editar') {
    registro.editandoId = id;
    pintar();
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion(
      'Eliminar hito',
      '¿Seguro que quieres eliminar este hito?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoHitos.eliminar(id);
    if (r.exito) {
      registro.hitos = registro.hitos.filter((x) => x.id !== id);
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
  registro.editandoId = null;
  registro.formularioAbierto = false;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:hitos:crear', refrescar),
    al('realtime:hitos:actualizar', refrescar),
    al('realtime:hitos:eliminar', refrescar),
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
  registro.hitos = [];
  registro.editandoId = null;
  registro.formularioAbierto = false;
  registro.contenedor = null;
}