/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/fauna.js
   Versión: 1.2.0
   Propósito: vista de fauna.
              v1.2.0: usa distintivoAutor(). Clase .vista--fauna.
                      Tipo como etiqueta visual.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoFauna from '../datos/repositorios/fauna.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:fauna');

const TIPOS = [
  { id: 'ave', etiqueta: 'Ave' },
  { id: 'mamifero', etiqueta: 'Mamífero' },
  { id: 'reptil', etiqueta: 'Reptil' },
  { id: 'anfibio', etiqueta: 'Anfibio' },
  { id: 'pez', etiqueta: 'Pez' },
  { id: 'insecto', etiqueta: 'Insecto' },
  { id: 'otro', etiqueta: 'Otro' },
];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  registros: [],
};

function etiquetaTipo(id) {
  const t = TIPOS.find((x) => x.id === id);
  return t ? t.etiqueta : id;
}

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const form = h('form', { class: 'vista__form', 'data-accion': 'crear' },
    h('input', { name: 'nombre', placeholder: 'Nombre o descripción', required: true, maxlength: 100 }),
    h('select', { name: 'tipo' },
      ...TIPOS.map((t) => h('option', { value: t.id }, t.etiqueta))
    ),
    h('input', { name: 'lugar', placeholder: 'Lugar', maxlength: 200 }),
    h('input', { type: 'date', name: 'fecha' }),
    h('button', { type: 'submit' }, 'Registrar')
  );

  const lista = registro.registros.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Aún sin registros. Anota el primero arriba.')
    : h('ul', { class: 'vista__lista' },
        ...registro.registros.map((x) => h('li', { class: 'vista__item', 'data-id': x.id },
          h('div', { class: 'vista__item-cabecera' },
            h('strong', {}, x.nombre),
            h('span', { class: 'tipo-etiqueta' }, etiquetaTipo(x.tipo)),
            distintivoAutor(x.registradoPor)
          ),
          h('div', { class: 'meta' },
            x.lugar ? h('span', {}, x.lugar) : null,
            x.fecha ? h('span', {}, formatearFecha(x.fecha)) : null
          ),
          h('div', { class: 'acciones' },
            h('button', {
              type: 'button',
              'data-accion': 'eliminar',
              'data-id': x.id,
            }, 'Eliminar')
          )
        ))
      );

  cont.append(
    h('section', { class: 'vista vista--fauna' },
      h('h1', {}, 'Fauna'),
      h('p', { class: 'vista__lead' }, 'Lo que vimos y escuchamos en el camino.'),
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
  const r = await repoFauna.listar();
  if (r.exito) {
    registro.registros = r.datos;
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
  const fecha = fd.get('fecha');
  const r = await repoFauna.crear({
    nombre: fd.get('nombre'),
    tipo: fd.get('tipo'),
    lugar: fd.get('lugar'),
    fecha: fecha ? new Date(fecha + 'T12:00:00').toISOString() : null,
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
  if (!confirm('¿Eliminar este registro?')) return;
  const r = await repoFauna.eliminar(id);
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
    al('realtime:fauna:crear', refrescar),
    al('realtime:fauna:actualizar', refrescar),
    al('realtime:fauna:eliminar', refrescar),
  ];

  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.registros = [];
  registro.contenedor = null;
}