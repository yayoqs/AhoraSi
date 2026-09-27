/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/hero.js
   Versión: 1.1.0
   Propósito: vista de bienvenida. Se muestra solo la primera vez
              por navegador. Título grande, línea dorada animada,
              párrafo de entrada, secuenciador jugable y botón
              "Entrar" que lleva a la carta.
              v1.1.0: la sección raíz lleva id="vista-hero" para
                      el encapsulado de CSS. Sin cambios en la
                      lógica ni en las firmas públicas.
              v1.0.0: versión inicial.
   ================================================================ */

import * as sintetizador from '../audio/sintetizador.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:hero');

/* ----------------------------------------------------------------
   EDITAR ACÁ: textos del hero.
   Cuando quieras ajustar el tono de la bienvenida, cambia estos
   tres valores. No requieren tocar ningún otro archivo.
   ---------------------------------------------------------------- */
const TEXTOS = {
  titulo: 'Ahora sí.',
  lead: 'Luci, esto es para ti. Un espacio de los dos: lo que queremos hacer, lo que ya pasó y lo que falta. Sin prisa, sin presión. Con las palabras claras y los planes a la vista.',
  entrar: 'Entrar',
};
/* ---------------------------------------------------------------- */

const registro = {
  contenedor: null,
  abortador: null,
  patron: sintetizador.PATRON_INICIAL.map((fila) => fila.slice()),
  bpm: sintetizador.BPM_INICIAL,
  pasoActivo: -1,
};

const VOCES = sintetizador.voces();

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const grid = h('div', { class: 'hero__grid', role: 'group', 'aria-label': 'Secuenciador de bienvenida' });
  VOCES.forEach((voz, fila) => {
    const filaEl = h('div', { class: 'hero__fila' },
      h('span', { class: 'hero__etiqueta' }, voz.etiqueta)
    );
    for (let col = 0; col < 8; col++) {
      const activa = !!registro.patron[fila][col];
      const esActual = registro.pasoActivo === col;
      filaEl.append(h('button', {
        type: 'button',
        class: 'hero__celda'
          + (activa ? ' hero__celda--activa' : '')
          + (esActual ? ' hero__celda--actual' : ''),
        'data-accion': 'toggle-celda',
        'data-fila': fila,
        'data-col': col,
        'aria-pressed': String(activa),
        'aria-label': `${voz.etiqueta}, paso ${col + 1}`,
      }));
    }
    grid.append(filaEl);
  });

  const botonPlay = h('button', {
    type: 'button',
    class: 'hero__play',
    'data-accion': 'play',
  }, sintetizador.estaReproduciendo() ? 'Parar' : 'Tocar');

  const sliderBpm = h('input', {
    type: 'range', min: 60, max: 160, step: 1,
    value: String(registro.bpm), 'data-accion': 'bpm', 'aria-label': 'Tempo',
  });

  const labelBpm = h('span', { class: 'hero__tempo-valor' }, registro.bpm + ' bpm');

  const botonReset = h('button', {
    type: 'button', class: 'hero__reset', 'data-accion': 'reset',
  }, 'Ritmo inicial');

  const controles = h('div', { class: 'hero__controles' },
    botonPlay,
    h('label', { class: 'hero__tempo' }, 'Tempo', sliderBpm, labelBpm),
    botonReset
  );

  const botonEntrar = h('button', {
    type: 'button',
    class: 'hero__entrar',
    'data-accion': 'entrar',
  }, TEXTOS.entrar);

  cont.append(
    h('section', { id: 'vista-hero', class: 'vista vista--hero' },
      h('div', { class: 'hero__wrap' },
        h('h1', { class: 'hero__titulo' }, TEXTOS.titulo),
        lineaAnimada(),
        h('p', { class: 'hero__lead' }, TEXTOS.lead),
        h('div', { class: 'hero__sec' }, grid, controles),
        botonEntrar
      )
    )
  );
}

function lineaAnimada() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'hero__linea');
  svg.setAttribute('viewBox', '0 0 560 14');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M2 7h520');
  const circle = document.createElementNS(NS, 'circle');
  circle.setAttribute('cx', '544');
  circle.setAttribute('cy', '7');
  circle.setAttribute('r', '7');
  svg.append(path, circle);
  return svg;
}

function pintarSoloGrilla() {
  const cont = registro.contenedor;
  if (!cont) return;
  const grid = cont.querySelector('.hero__grid');
  if (!grid) return;
  grid.querySelectorAll('.hero__celda').forEach((c) => {
    const fila = Number(c.dataset.fila);
    const col = Number(c.dataset.col);
    const activa = !!registro.patron[fila][col];
    const esActual = registro.pasoActivo === col;
    c.classList.toggle('hero__celda--activa', activa);
    c.classList.toggle('hero__celda--actual', esActual);
    c.setAttribute('aria-pressed', String(activa));
  });
}

function alternarPlay() {
  if (sintetizador.estaReproduciendo()) {
    sintetizador.detener();
    registro.pasoActivo = -1;
    pintar();
  } else {
    const ok = sintetizador.arrancar(
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

function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;

  if (accion === 'toggle-celda') {
    const fila = Number(boton.dataset.fila);
    const col = Number(boton.dataset.col);
    const anterior = registro.patron[fila][col];
    registro.patron[fila][col] = anterior ? 0 : 1;
    if (!anterior) sintetizador.tocar(fila);
    sintetizador.actualizarPatron(registro.patron);
    pintarSoloGrilla();
  } else if (accion === 'play') {
    alternarPlay();
  } else if (accion === 'reset') {
    sintetizador.detener();
    registro.patron = sintetizador.PATRON_INICIAL.map((f) => f.slice());
    registro.bpm = sintetizador.BPM_INICIAL;
    registro.pasoActivo = -1;
    pintar();
  } else if (accion === 'entrar') {
    location.hash = '#carta';
  }
}

function manejarInput(ev) {
  const slider = ev.target.closest('input[data-accion="bpm"]');
  if (!slider) return;
  registro.bpm = Number(slider.value);
  sintetizador.actualizarBpm(registro.bpm);
  const label = registro.contenedor.querySelector('.hero__tempo-valor');
  if (label) label.textContent = registro.bpm + ' bpm';
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  const { signal } = registro.abortador;

  registro.patron = sintetizador.PATRON_INICIAL.map((f) => f.slice());
  registro.bpm = sintetizador.BPM_INICIAL;
  registro.pasoActivo = -1;

  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('input', manejarInput, { signal });

  pintar();
  log.info('Hero montado');
}

export function limpiar() {
  sintetizador.detener();
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.pasoActivo = -1;
  registro.contenedor = null;
}