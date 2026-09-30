/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/penitencias.js
   Versión: 1.0.0
   Propósito: vista de penitencias. Lista de cosas que uno le debe
              al otro, con estados pendiente y cumplida. Formulario
              colapsable.
              v1.0.0: versión inicial, extraída del antiguo
                      juegos.js v1.2.0.
   ================================================================ */

import * as repoPenitencias from '../datos/repositorios/penitencias.js';
import { CONFIG } from '../config/config.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { obtener } from '../nucleo/almacen.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:penitencias');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  penitencias: [],
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
  pendiente: 'Pendiente',
  cumplida: 'Cumplida',
};

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-penitencias', class: 'vista vista--penitencias' });

  raiz.append(h('p', { class: 'subjuego__lead' },
    'Cosas que uno le debe al otro. Se asignan, se cumplen, se agradecen.'));

  if (!registro.formularioAbierto) {
    raiz.append(h('button', {
      type: 'button', class: 'btn-agregar',
      style: '--tema-actual: var(--terracota);',
      'data-accion': 'abrir-formulario',
    }, '+ Nueva penitencia'));
  } else {
    raiz.append(pintarFormulario());
  }

  if (registro.penitencias.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' }, 'Sin penitencias todavía.'));
  } else {
    const lista = h('div', {});
    for (const p of registro.penitencias) lista.append(pintarPenitencia(p));
    raiz.append(lista);
  }

  cont.append(raiz);
}

function pintarFormulario() {
  const otro = otroUsuarioId();
  const select = h('select', { name: 'paraQuien' },
    h('option', { value: otro }, 'Para ' + nombreDe(otro))
  );

  return h('form', { class: 'form-linea-full', 'data-accion': 'crear' },
    h('input', { name: 'texto', placeholder: 'Penitencia (ej. Hacer el desayuno el domingo)', required: true, maxlength: 300 }),
    h('input', { name: 'razon', placeholder: 'Por qué (opcional)', maxlength: 300 }),
    select,
    h('div', { class: 'form-linea-full__botones' },
      h('button', {
        type: 'button', class: 'btn-form btn-form--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-form btn-form--primario',
        style: 'background: var(--terracota);' }, 'Asignar')
    )
  );
}

function pintarPenitencia(p) {
  const item = h('article', {
    class: `lista-item lista-item--${p.estado}`,
    'data-id': p.id,
  });

  item.append(h('div', { class: 'lista-item__cab' },
    h('span', { class: `estado-chip estado-chip--${p.estado}` }, ETIQUETAS_ESTADO[p.estado]),
    distintivoAutor(p.asignadaPor),
    h('span', { style: 'color: var(--tinta-tenue); font-size: 12px;' }, '→'),
    distintivoAutor(p.paraQuien)
  ));

  item.append(h('p', { class: 'lista-item__texto' }, p.texto));

  if (p.razon) {
    item.append(h('p', { class: 'lista-item__contexto' }, p.razon));
  }

  const acciones = h('div', { class: 'lista-item__acciones' });
  if (p.estado === 'pendiente') {
    acciones.append(h('button', {
      type: 'button', class: 'btn-mini btn-mini--ok',
      'data-accion': 'cambiar-estado',
      'data-id': p.id, 'data-estado': 'cumplida',
    }, 'Marcar cumplida'));
  }
  acciones.append(h('button', {
    type: 'button', class: 'btn-mini btn-mini--peligro',
    style: 'margin-left: auto;',
    'data-accion': 'eliminar',
    'data-id': p.id,
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
  const r = await repoPenitencias.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.penitencias = r.datos;
  pintar();
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);

  const r = await repoPenitencias.crear({
    texto: fd.get('texto'),
    razon: fd.get('razon'),
    paraQuien: fd.get('paraQuien'),
  });

  if (!r.exito) {
    pintarError(r.error);
    return;
  }

  registro.formularioAbierto = false;
  await refrescar();
  pintarOk('Penitencia asignada.');
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
    const r = await repoPenitencias.cambiarEstado(id, estado);
    if (r.exito) {
      await refrescar();
      pintarOk('Penitencia ' + ETIQUETAS_ESTADO[estado].toLowerCase() + '.');
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion('Quitar penitencia', '¿Seguro que quieres quitarla?', { textoConfirmar: 'Quitar' });
    if (!ok) return;
    const r = await repoPenitencias.eliminar(id);
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
  registro.penitencias = [];
  registro.formularioAbierto = false;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:penitencias:crear', refrescar),
    al('realtime:penitencias:actualizar', refrescar),
    al('realtime:penitencias:eliminar', refrescar),
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
  registro.penitencias = [];
  registro.formularioAbierto = false;
  registro.contenedor = null;
}