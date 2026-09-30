/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/retos.js
   Versión: 1.0.0
   Propósito: vista de retos. Lista de retos entre los dos, con
              estados propuesto, aceptado, cumplido, rechazado.
              Formulario colapsable para crear.
              v1.0.0: versión inicial, extraída del antiguo
                      juegos.js v1.2.0.
   ================================================================ */

import * as repoRetos from '../datos/repositorios/retos.js';
import { CONFIG } from '../config/config.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { obtener } from '../nucleo/almacen.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:retos');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  retos: [],
  formularioAbierto: false,
};

function usuarioActualId() {
  const u = obtener('usuarioActual');
  return u?.$id || u?.id || null;
}

function otroUsuarioId() {
  const yo = usuarioActualId();
  if (yo === CONFIG.usuarios.yayo) return CONFIG.usuarios.luci;
  if (yo === CONFIG.usuarios.luci) return CONFIG.usuarios.yayo;
  return null;
}

function nombreDe(id) {
  if (id === CONFIG.usuarios.yayo) return 'Yayo';
  if (id === CONFIG.usuarios.luci) return 'Luci';
  return 'Desconocido';
}

const ETIQUETAS_ESTADO = {
  propuesto: 'Propuesto',
  aceptado: 'Aceptado',
  cumplido: 'Cumplido',
  rechazado: 'Rechazado',
};

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-retos', class: 'vista vista--retos' });

  raiz.append(h('p', { class: 'subjuego__lead' },
    'Cosas que se tiran entre los dos. Proponer, aceptar, cumplir o dejar pasar.'));

  if (!registro.formularioAbierto) {
    raiz.append(h('button', {
      type: 'button', class: 'btn-agregar',
      style: '--tema-actual: var(--azul);',
      'data-accion': 'abrir-formulario',
    }, '+ Nuevo reto'));
  } else {
    raiz.append(pintarFormulario());
  }

  if (registro.retos.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' }, 'Sin retos todavía.'));
  } else {
    const lista = h('div', {});
    for (const r of registro.retos) lista.append(pintarReto(r));
    raiz.append(lista);
  }

  cont.append(raiz);
}

function pintarFormulario() {
  const otro = otroUsuarioId();
  const select = h('select', { name: 'destinatario' },
    h('option', { value: otro }, 'Para ' + nombreDe(otro))
  );

  return h('form', { class: 'form-linea-full', 'data-accion': 'crear' },
    h('input', { name: 'texto', placeholder: 'Reto (ej. Inventar un juego nuevo)', required: true, maxlength: 300 }),
    h('textarea', { name: 'contexto', placeholder: 'Detalles o reglas (opcional)', maxlength: 500, rows: 2 }),
    select,
    h('div', { class: 'form-linea-full__botones' },
      h('button', {
        type: 'button', class: 'btn-form btn-form--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-form btn-form--primario',
        style: 'background: var(--azul);' }, 'Proponer')
    )
  );
}

function pintarReto(r) {
  const item = h('article', {
    class: `lista-item lista-item--${r.estado}`,
    'data-id': r.id,
  });

  item.append(h('div', { class: 'lista-item__cab' },
    h('span', { class: `estado-chip estado-chip--${r.estado}` }, ETIQUETAS_ESTADO[r.estado]),
    distintivoAutor(r.autor),
    h('span', { style: 'color: var(--tinta-tenue); font-size: 12px;' }, '→'),
    distintivoAutor(r.destinatario)
  ));

  item.append(h('p', { class: 'lista-item__texto' }, r.texto));

  if (r.contexto) {
    item.append(h('p', { class: 'lista-item__contexto' }, r.contexto));
  }

  const acciones = h('div', { class: 'lista-item__acciones' });
  if (r.estado === 'propuesto') {
    acciones.append(
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--ok',
        'data-accion': 'cambiar-estado',
        'data-id': r.id, 'data-estado': 'aceptado',
      }, 'Aceptar'),
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'cambiar-estado',
        'data-id': r.id, 'data-estado': 'rechazado',
      }, 'Rechazar')
    );
  } else if (r.estado === 'aceptado') {
    acciones.append(h('button', {
      type: 'button', class: 'btn-mini btn-mini--ok',
      'data-accion': 'cambiar-estado',
      'data-id': r.id, 'data-estado': 'cumplido',
    }, 'Marcar cumplido'));
  }
  acciones.append(h('button', {
    type: 'button', class: 'btn-mini btn-mini--peligro',
    style: 'margin-left: auto;',
    'data-accion': 'eliminar',
    'data-id': r.id,
  }, 'Quitar'));
  item.append(acciones);

  return item;
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
  const r = await repoRetos.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.retos = r.datos;
  pintar();
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);

  const r = await repoRetos.crear({
    texto: fd.get('texto'),
    contexto: fd.get('contexto'),
    destinatario: fd.get('destinatario'),
  });

  if (!r.exito) {
    pintarError(r.error);
    return;
  }

  registro.formularioAbierto = false;
  await refrescar();
  pintarOk('Reto propuesto.');
}

async function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;

  if (accion === 'abrir-formulario') {
    registro.formularioAbierto = true;
    pintar();
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'cambiar-estado') {
    const estado = btn.dataset.estado;
    const r = await repoRetos.cambiarEstado(id, estado);
    if (r.exito) {
      await refrescar();
      pintarOk('Reto ' + ETIQUETAS_ESTADO[estado].toLowerCase() + '.');
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion('Quitar reto', '¿Seguro que quieres quitarlo?', { textoConfirmar: 'Quitar' });
    if (!ok) return;
    const r = await repoRetos.eliminar(id);
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
  registro.retos = [];
  registro.formularioAbierto = false;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:retos:crear', refrescar),
    al('realtime:retos:actualizar', refrescar),
    al('realtime:retos:eliminar', refrescar),
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
  registro.retos = [];
  registro.formularioAbierto = false;
  registro.contenedor = null;
}