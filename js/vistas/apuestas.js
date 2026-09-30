/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/apuestas.js
   Versión: 1.0.0
   Propósito: vista de apuestas. Lista de apuestas entre los dos,
              con estados pendiente y resuelta. Formulario
              colapsable. Al resolver, se elige ganador.
              v1.0.0: versión inicial, extraída del antiguo
                      juegos.js v1.2.0.
   ================================================================ */

import * as repoApuestas from '../datos/repositorios/apuestas.js';
import { CONFIG } from '../config/config.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { obtener } from '../nucleo/almacen.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:apuestas');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  apuestas: [],
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
  if (id === 'empate') return 'Empate';
  return 'Desconocido';
}

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  resuelta: 'Resuelta',
};

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-apuestas', class: 'vista vista--apuestas' });

  raiz.append(h('p', { class: 'subjuego__lead' },
    'Cosas que apuestan entre los dos. Con o sin empate.'));

  if (!registro.formularioAbierto) {
    raiz.append(h('button', {
      type: 'button', class: 'btn-agregar',
      style: '--tema-actual: var(--ciruela);',
      'data-accion': 'abrir-formulario',
    }, '+ Nueva apuesta'));
  } else {
    raiz.append(pintarFormulario());
  }

  if (registro.apuestas.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' }, 'Sin apuestas todavía.'));
  } else {
    const lista = h('div', {});
    for (const a of registro.apuestas) lista.append(pintarApuesta(a));
    raiz.append(lista);
  }

  cont.append(raiz);
}

function pintarFormulario() {
  const yo = usuarioActualId();
  const otro = otroUsuarioId();

  const select = h('select', { name: 'quien' },
    h('option', { value: yo }, nombreDe(yo) + ' apuesta a que…'),
    h('option', { value: otro }, nombreDe(otro) + ' apuesta a que…')
  );

  return h('form', { class: 'form-linea-full', 'data-accion': 'crear' },
    h('input', { name: 'texto', placeholder: 'Apuesta (ej. Mañana llueve antes del mediodía)', required: true, maxlength: 300 }),
    select,
    h('div', { class: 'form-linea-full__botones' },
      h('button', {
        type: 'button', class: 'btn-form btn-form--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-form btn-form--primario',
        style: 'background: var(--ciruela);' }, 'Apostar')
    )
  );
}

function pintarApuesta(a) {
  const item = h('article', {
    class: `lista-item lista-item--${a.estado}`,
    'data-id': a.id,
  });

  item.append(h('div', { class: 'lista-item__cab' },
    h('span', { class: `estado-chip estado-chip--${a.estado}` }, ETIQUETAS_ESTADO[a.estado]),
    distintivoAutor(a.quien),
    h('span', { style: 'color: var(--tinta-tenue); font-size: 12px;' }, 'vs'),
    distintivoAutor(a.contra)
  ));

  item.append(h('p', { class: 'lista-item__texto' }, a.texto));

  if (a.estado === 'resuelta' && a.ganador) {
    item.append(h('div', { class: 'lista-item__resultado' },
      h('span', {}, 'Ganó'),
      h('span', { class: 'lista-item__ganador' }, nombreDe(a.ganador))
    ));
  }

  const acciones = h('div', { class: 'lista-item__acciones' });
  if (a.estado === 'pendiente') {
    acciones.append(
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--ok',
        'data-accion': 'resolver',
        'data-id': a.id, 'data-ganador': a.quien,
      }, 'Ganó ' + nombreDe(a.quien)),
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--ok',
        'data-accion': 'resolver',
        'data-id': a.id, 'data-ganador': a.contra,
      }, 'Ganó ' + nombreDe(a.contra)),
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'resolver',
        'data-id': a.id, 'data-ganador': 'empate',
      }, 'Empate')
    );
  }
  acciones.append(h('button', {
    type: 'button', class: 'btn-mini btn-mini--peligro',
    style: 'margin-left: auto;',
    'data-accion': 'eliminar',
    'data-id': a.id,
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
  const r = await repoApuestas.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.apuestas = r.datos;
  pintar();
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);

  const r = await repoApuestas.crear({
    texto: fd.get('texto'),
    quien: fd.get('quien'),
  });

  if (!r.exito) {
    pintarError(r.error);
    return;
  }

  registro.formularioAbierto = false;
  await refrescar();
  pintarOk('Apuesta registrada.');
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
  } else if (accion === 'resolver') {
    const ganador = btn.dataset.ganador;
    const r = await repoApuestas.resolver(id, ganador);
    if (r.exito) {
      await refrescar();
      pintarOk('Ganó ' + nombreDe(ganador) + '.');
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion('Quitar apuesta', '¿Seguro que quieres quitarla?', { textoConfirmar: 'Quitar' });
    if (!ok) return;
    const r = await repoApuestas.eliminar(id);
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
  registro.apuestas = [];
  registro.formularioAbierto = false;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:apuestas:crear', refrescar),
    al('realtime:apuestas:actualizar', refrescar),
    al('realtime:apuestas:eliminar', refrescar),
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
  registro.apuestas = [];
  registro.formularioAbierto = false;
  registro.contenedor = null;
}