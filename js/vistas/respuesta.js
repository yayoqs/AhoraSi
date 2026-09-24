/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/respuesta.js
   Versión: 1.2.0
   Propósito: panel de respuesta con historial.
              v1.2.0: usa distintivoAutor(). Clase .vista--respuesta.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoRespuestas from '../datos/repositorios/respuestas.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:respuesta');

const ELECCIONES = [
  { id: 'paso_a_paso', etiqueta: 'Quiero ir paso a paso', ayuda: 'Sin etiquetas. Un plan a la vez.' },
  { id: 'hablar', etiqueta: 'Quiero que hablemos', ayuda: 'Con calma, cuando podamos.' },
  { id: 'tiempo', etiqueta: 'Necesito más tiempo', ayuda: 'Y está bien.' },
];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  eleccion: '',
  nota: '',
  historial: [],
  enviado: false,
};

function etiquetaEleccion(id) {
  const e = ELECCIONES.find((x) => x.id === id);
  return e ? e.etiqueta : id;
}

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const choices = h('div', { class: 'vista__choices' },
    ...ELECCIONES.map((e) => h('button', {
      type: 'button',
      class: 'vista__choice',
      'data-accion': 'elegir',
      'data-id': e.id,
      'aria-pressed': String(registro.eleccion === e.id),
    },
      h('strong', {}, e.etiqueta),
      h('small', {}, e.ayuda)
    ))
  );

  const textarea = h('textarea', {
    class: 'vista__textarea',
    'data-accion': 'nota',
    placeholder: 'Si quieres agregar algo…',
    rows: 4,
  });
  textarea.value = registro.nota;

  const botonEnviar = h('button', {
    type: 'button',
    class: 'vista__boton-enviar',
    'data-accion': 'enviar',
    disabled: registro.eleccion ? null : '',
  }, 'Enviar respuesta');

  const mensaje = registro.enviado
    ? h('p', { class: 'vista__ok' }, 'Respuesta guardada. Gracias por tomarte el tiempo.')
    : null;

  const historial = registro.historial.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Sin respuestas previas.')
    : h('ul', { class: 'vista__lista' },
        ...registro.historial.map((r) => h('li', { class: 'vista__item' },
          h('div', { class: 'vista__item-cabecera' },
            h('strong', {}, etiquetaEleccion(r.eleccion)),
            distintivoAutor(r.enviadoPor)
          ),
          r.nota ? h('p', {}, r.nota) : null,
          h('p', { class: 'meta' }, formatearFecha(r.enviadoEn))
        ))
      );

  cont.append(
    h('section', { class: 'vista vista--respuesta' },
      h('h1', {}, 'Tu respuesta'),
      h('p', { class: 'vista__lead' }, 'No hace falta contestar hoy. Las tres opciones son válidas.'),
      choices,
      textarea,
      botonEnviar,
      mensaje,
      h('h2', { class: 'vista__subtitulo' }, 'Historial'),
      historial
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

async function refrescarHistorial() {
  const r = await repoRespuestas.listar();
  if (r.exito) registro.historial = r.datos;
  else log.error('Error al listar respuestas:', r.error);
}

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;

  if (accion === 'elegir') {
    registro.eleccion = boton.dataset.id;
    registro.enviado = false;
    pintar();
  } else if (accion === 'enviar') {
    if (!registro.eleccion) return;
    const r = await repoRespuestas.crear({
      eleccion: registro.eleccion,
      nota: registro.nota,
    });
    if (r.exito) {
      registro.enviado = true;
      registro.eleccion = '';
      registro.nota = '';
      await refrescarHistorial();
      pintar();
    } else {
      pintarError(r.error);
    }
  }
}

function manejarInput(ev) {
  const ta = ev.target.closest('textarea[data-accion="nota"]');
  if (!ta) return;
  registro.nota = ta.value;
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  const { signal } = registro.abortador;
  registro.eleccion = '';
  registro.nota = '';
  registro.enviado = false;
  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('input', manejarInput, { signal });

  registro.desuscribir = [
    al('realtime:respuestas:crear', async () => {
      await refrescarHistorial();
      pintar();
    }),
  ];

  await refrescarHistorial();
  pintar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.eleccion = '';
  registro.nota = '';
  registro.enviado = false;
  registro.historial = [];
  registro.contenedor = null;
}