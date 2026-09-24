/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/carta.js
   Versión: 1.2.0
   Propósito: vista de la carta. Manifiesto y anexos.
              v1.2.0: usa distintivoAutor() de autores.js.
                      Se agrega clase .vista--carta al section
                      para que el CSS modular la ubique.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoCarta from '../datos/repositorios/carta.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:carta');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  base: [],
  anexos: [],
};

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const seccionBase = registro.base.length === 0
    ? h('div', { class: 'vista__vacio' },
        h('p', {}, 'Aún no hay carta base.'),
        h('form', { class: 'vista__form', 'data-accion': 'crear-base' },
          h('input', { name: 'titulo', placeholder: 'Título del manifiesto', required: true, maxlength: 200 }),
          h('textarea', { name: 'contenido', placeholder: 'Contenido', required: true, rows: 6 }),
          h('button', { type: 'submit' }, 'Fijar carta base')
        )
      )
    : h('div', { class: 'vista__carta-base' },
        ...registro.base.map((p) => h('article', { class: 'vista__pieza', 'data-id': p.id },
          h('h3', {}, p.titulo),
          h('p', { class: 'vista__pieza-contenido' }, p.contenido),
          h('p', { class: 'meta' },
            distintivoAutor(p.autor),
            h('span', {}, ' · ' + formatearFecha(p.creadoEn))
          )
        ))
      );

  const formAnexo = h('form', { class: 'vista__form', 'data-accion': 'crear-anexo' },
    h('input', { name: 'titulo', placeholder: 'Título del anexo', required: true, maxlength: 200 }),
    h('textarea', { name: 'contenido', placeholder: 'Contenido', required: true, rows: 4 }),
    h('button', { type: 'submit' }, 'Agregar anexo')
  );

  const listaAnexos = registro.anexos.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Aún sin anexos.')
    : h('ul', { class: 'vista__lista' },
        ...registro.anexos.map((p) => h('li', { class: 'vista__item', 'data-id': p.id },
          h('div', { class: 'vista__item-cabecera' }, h('strong', {}, p.titulo)),
          h('p', {}, p.contenido),
          h('p', { class: 'meta' },
            distintivoAutor(p.autor),
            h('span', {}, ' · ' + formatearFecha(p.creadoEn))
          ),
          h('div', { class: 'acciones' },
            h('button', {
              type: 'button',
              'data-accion': 'eliminar',
              'data-id': p.id,
            }, 'Eliminar')
          )
        ))
      );

  cont.append(
    h('section', { class: 'vista vista--carta' },
      h('h1', {}, 'Carta'),
      h('p', { class: 'vista__lead' }, 'El manifiesto y lo que se suma con el tiempo.'),
      h('h2', { class: 'vista__subtitulo' }, 'Manifiesto'),
      seccionBase,
      h('h2', { class: 'vista__subtitulo' }, 'Anexos'),
      formAnexo,
      listaAnexos
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
  const rBase = await repoCarta.listarBase();
  const rAnexos = await repoCarta.listarAnexos();
  if (rBase.exito && rAnexos.exito) {
    registro.base = rBase.datos;
    registro.anexos = rAnexos.datos;
    pintar();
  } else {
    const err = !rBase.exito ? rBase.error : rAnexos.error;
    log.error('Error al listar:', err);
    pintarError(err);
  }
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const accion = form.dataset.accion;
  const fd = new FormData(form);
  const tipo = accion === 'crear-base' ? 'base' : 'anexo';
  const orden = tipo === 'base'
    ? registro.base.length
    : registro.base.length + registro.anexos.length + 1;

  const r = await repoCarta.crear({
    tipo,
    titulo: fd.get('titulo'),
    contenido: fd.get('contenido'),
    orden,
  });

  if (r.exito) {
    form.reset();
    await refrescar();
  } else {
    pintarError(r.error);
  }
}

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion="eliminar"]');
  if (!boton) return;
  const id = boton.dataset.id;
  if (!confirm('¿Eliminar este anexo?')) return;
  const r = await repoCarta.eliminar(id);
  if (r.exito) await refrescar();
  else pintarError(r.error);
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:carta:crear', refrescar),
    al('realtime:carta:actualizar', refrescar),
    al('realtime:carta:eliminar', refrescar),
  ];

  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.base = [];
  registro.anexos = [];
  registro.contenedor = null;
}