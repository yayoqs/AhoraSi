/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/percusion.js
   Versión: 1.2.0
   Propósito: vista del secuenciador de percusión.
              v1.2.0: usa distintivoAutor() en la lista de ritmos
                      guardados. Clase .vista--percusion.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoSintetizador from '../audio/sintetizador.js';
import * as repoRitmos from '../datos/repositorios/ritmos.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:percusion');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  patron: repoSintetizador.PATRON_INICIAL.map((fila) => fila.slice()),
  bpm: repoSintetizador.BPM_INICIAL,
  guardados: [],
  pasoActivo: -1,
  formularioGuardarAbierto: false,
};

const VOCES = repoSintetizador.voces();

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const celdaGrid = h('div', { class: 'perc__grid', role: 'group', 'aria-label': 'Secuenciador' });
  VOCES.forEach((voz, fila) => {
    const filaEl = h('div', { class: 'perc__fila' },
      h('span', { class: 'perc__etiqueta' }, voz.etiqueta)
    );
    for (let col = 0; col < 8; col++) {
      const activa = !!registro.patron[fila][col];
      const esActual = registro.pasoActivo === col;
      filaEl.append(h('button', {
        type: 'button',
        class: 'perc__celda'
          + (activa ? ' perc__celda--activa' : '')
          + (esActual ? ' perc__celda--actual' : ''),
        'data-accion': 'toggle-celda',
        'data-fila': fila,
        'data-col': col,
        'aria-pressed': String(activa),
        'aria-label': `${voz.etiqueta}, paso ${col + 1}`,
      }));
    }
    celdaGrid.append(filaEl);
  });

  const botonPlay = h('button', {
    type: 'button',
    class: 'perc__play',
    'data-accion': 'play',
  }, repoSintetizador.estaReproduciendo() ? 'Parar' : 'Tocar');

  const sliderBpm = h('input', {
    type: 'range', min: 60, max: 160, step: 1,
    value: String(registro.bpm), 'data-accion': 'bpm', 'aria-label': 'Tempo',
  });

  const labelBpm = h('span', { class: 'perc__bpm-valor' }, String(registro.bpm) + ' bpm');

  const botonReset = h('button', {
    type: 'button', class: 'perc__secundario', 'data-accion': 'reset',
  }, 'Ritmo inicial');

  const botonGuardar = h('button', {
    type: 'button', class: 'perc__secundario', 'data-accion': 'abrir-guardar',
  }, 'Guardar ritmo');

  const controles = h('div', { class: 'perc__controles' },
    botonPlay,
    h('label', { class: 'perc__bpm' }, 'Tempo', sliderBpm, labelBpm),
    botonReset,
    botonGuardar
  );

  let bloqueGuardar = null;
  if (registro.formularioGuardarAbierto) {
    bloqueGuardar = h('form', { class: 'perc__guardar', 'data-accion': 'guardar' },
      h('input', {
        type: 'text', name: 'nombre',
        placeholder: 'Nombre del ritmo (ej. Ritmo cordillera)',
        maxlength: 100, required: true,
      }),
      h('div', { class: 'perc__guardar-botones' },
        h('button', { type: 'submit' }, 'Guardar'),
        h('button', { type: 'button', 'data-accion': 'cerrar-guardar' }, 'Cancelar')
      )
    );
  }

  const listaGuardados = registro.guardados.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Aún no hay ritmos guardados.')
    : h('ul', { class: 'vista__lista' },
        ...registro.guardados.map((r) => h('li', { class: 'vista__item', 'data-id': r.id },
          h('div', { class: 'vista__item-cabecera' },
            h('strong', {}, r.nombre),
            h('span', { class: 'meta' }, r.bpm + ' bpm'),
            distintivoAutor(r.creadoPor)
          ),
          h('div', { class: 'acciones' },
            h('button', { type: 'button', 'data-accion': 'cargar', 'data-id': r.id }, 'Cargar'),
            h('button', { type: 'button', 'data-accion': 'eliminar', 'data-id': r.id }, 'Eliminar')
          )
        ))
      );

  cont.append(
    h('section', { class: 'vista vista--percusion' },
      h('h1', {}, 'Percusión'),
      h('p', { class: 'vista__lead' },
        'Tumbe y afro sintetizados. Activa o apaga los cuadros, ajusta el tempo y guarda tus ritmos.'),
      celdaGrid,
      controles,
      bloqueGuardar,
      h('h2', { class: 'vista__subtitulo' }, 'Ritmos guardados'),
      listaGuardados
    )
  );
}

function pintarSoloGrilla() {
  const cont = registro.contenedor;
  if (!cont) return;
  const grid = cont.querySelector('.perc__grid');
  if (!grid) return;
  grid.querySelectorAll('.perc__celda').forEach((c) => {
    const fila = Number(c.dataset.fila);
    const col = Number(c.dataset.col);
    const activa = !!registro.patron[fila][col];
    const esActual = registro.pasoActivo === col;
    c.classList.toggle('perc__celda--activa', activa);
    c.classList.toggle('perc__celda--actual', esActual);
    c.setAttribute('aria-pressed', String(activa));
  });
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

async function refrescarGuardados() {
  const r = await repoRitmos.listar();
  if (r.exito) registro.guardados = r.datos;
  else log.error('Error al listar ritmos:', r.error);
}

async function refrescarGuardadosYPintar() {
  await refrescarGuardados();
  pintar();
}

function alternarPlay() {
  if (repoSintetizador.estaReproduciendo()) {
    repoSintetizador.detener();
    registro.pasoActivo = -1;
    pintar();
  } else {
    const ok = repoSintetizador.arrancar(
      registro.patron.map((f) => f.slice()),
      registro.bpm,
      (paso) => {
        registro.pasoActivo = paso;
        pintarSoloGrilla();
      }
    );
    if (ok) pintar();
  }
}

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;

  if (accion === 'toggle-celda') {
    const fila = Number(boton.dataset.fila);
    const col = Number(boton.dataset.col);
    const anterior = registro.patron[fila][col];
    registro.patron[fila][col] = anterior ? 0 : 1;
    if (!anterior) repoSintetizador.tocar(fila);
    repoSintetizador.actualizarPatron(registro.patron);
    pintarSoloGrilla();
  } else if (accion === 'play') {
    alternarPlay();
  } else if (accion === 'reset') {
    repoSintetizador.detener();
    registro.patron = repoSintetizador.PATRON_INICIAL.map((f) => f.slice());
    registro.bpm = repoSintetizador.BPM_INICIAL;
    registro.pasoActivo = -1;
    pintar();
  } else if (accion === 'abrir-guardar') {
    registro.formularioGuardarAbierto = true;
    pintar();
    const input = registro.contenedor.querySelector('input[name="nombre"]');
    if (input) input.focus();
  } else if (accion === 'cerrar-guardar') {
    registro.formularioGuardarAbierto = false;
    pintar();
  } else if (accion === 'cargar') {
    const id = boton.dataset.id;
    const ritmo = registro.guardados.find((r) => r.id === id);
    if (!ritmo) return;
    repoSintetizador.detener();
    registro.patron = ritmo.patron.map((f) => (Array.isArray(f) ? f.slice() : []));
    registro.bpm = ritmo.bpm;
    registro.pasoActivo = -1;
    pintar();
    pintarOk(`Cargado: ${ritmo.nombre}`);
  } else if (accion === 'eliminar') {
    const id = boton.dataset.id;
    if (!confirm('¿Eliminar este ritmo guardado?')) return;
    const r = await repoRitmos.eliminar(id);
    if (r.exito) {
      await refrescarGuardados();
      pintar();
    } else {
      pintarError(r.error);
    }
  }
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  if (form.dataset.accion !== 'guardar') return;
  const fd = new FormData(form);
  const nombre = String(fd.get('nombre') || '').trim();
  if (!nombre) return;

  const r = await repoRitmos.crear({
    nombre,
    bpm: registro.bpm,
    patron: registro.patron,
  });
  if (r.exito) {
    registro.formularioGuardarAbierto = false;
    await refrescarGuardados();
    pintar();
    pintarOk(`Guardado: ${nombre}`);
  } else {
    pintarError(r.error);
  }
}

function manejarInput(ev) {
  const slider = ev.target.closest('input[data-accion="bpm"]');
  if (!slider) return;
  registro.bpm = Number(slider.value);
  repoSintetizador.actualizarBpm(registro.bpm);
  const label = registro.contenedor.querySelector('.perc__bpm-valor');
  if (label) label.textContent = registro.bpm + ' bpm';
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  const { signal } = registro.abortador;
  registro.formularioGuardarAbierto = false;
  registro.pasoActivo = -1;

  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('input', manejarInput, { signal });

  registro.desuscribir = [
    al('realtime:ritmos:crear', refrescarGuardadosYPintar),
    al('realtime:ritmos:eliminar', refrescarGuardadosYPintar),
  ];

  await refrescarGuardados();
  pintar();
}

export function limpiar() {
  repoSintetizador.detener();
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.contenedor = null;
  registro.pasoActivo = -1;
  registro.formularioGuardarAbierto = false;
  registro.guardados = [];
}