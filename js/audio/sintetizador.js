/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/audio/sintetizador.js
   Versión: 1.0.0
   Propósito: motor de audio del secuenciador. Cuatro voces
              sintetizadas (grave, abierto, slap, campana) y un
              scheduler con lookahead de 120 ms para evitar drift.
              Expone tocar(voz), arrancar(patron, bpm, onPaso) y
              detener(). El contexto de audio se crea lazy al
              primer uso.
   ================================================================ */

import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('audio:sintetizador');

const LOOKAHEAD_MS = 25;
const ANTICIPACION_S = 0.12;
const PASOS = 8;
const FILAS = 4;

const VOCES = [
  { id: 'grave', etiqueta: 'Grave' },
  { id: 'abierto', etiqueta: 'Abierto' },
  { id: 'slap', etiqueta: 'Slap' },
  { id: 'campana', etiqueta: 'Campana' },
];

export const PATRON_INICIAL = [
  [1, 0, 0, 1, 0, 0, 1, 0],
  [0, 0, 1, 0, 1, 0, 0, 1],
  [0, 1, 0, 0, 0, 1, 0, 0],
  [1, 0, 1, 1, 0, 1, 1, 0],
];

export const BPM_INICIAL = 96;

let ctx = null;
let master = null;
let bufferRuido = null;

let reproduciendo = false;
let pasoActual = 0;
let proximoTiempo = 0;
let temporizador = null;
let callbackPaso = null;
let patronActual = null;
let bpmActual = BPM_INICIAL;

function obtenerContexto() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      log.error('Web Audio API no disponible en este navegador');
      return null;
    }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    const muestras = ctx.sampleRate * 0.5;
    bufferRuido = ctx.createBuffer(1, muestras, ctx.sampleRate);
    const datos = bufferRuido.getChannelData(0);
    for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tono(t, f0, f1, dur, tipo, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function golpearGrave(t) {
  tono(t, 120, 52, 0.45, 'sine', 0.9);
}

function golpearAbierto(t) {
  tono(t, 260, 150, 0.28, 'triangle', 0.7);
}

function golpearSlap(t) {
  const s = ctx.createBufferSource();
  s.buffer = bufferRuido;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2200;
  f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t);
  s.stop(t + 0.1);
}

function golpearCampana(t) {
  tono(t, 880, 860, 0.2, 'square', 0.1);
  tono(t, 1320, 1300, 0.2, 'square', 0.06);
}

const GOLPES = [golpearGrave, golpearAbierto, golpearSlap, golpearCampana];

export function tocar(fila) {
  const c = obtenerContexto();
  if (!c) return;
  GOLPES[fila](c.currentTime + 0.01);
}

function programar() {
  if (!reproduciendo) return;
  while (proximoTiempo < ctx.currentTime + ANTICIPACION_S) {
    const paso = pasoActual;
    const t = proximoTiempo;
    for (let fila = 0; fila < FILAS; fila++) {
      if (patronActual[fila][paso]) {
        GOLPES[fila](t);
      }
    }
    const pasoParaCallback = paso;
    setTimeout(() => {
      if (reproduciendo && callbackPaso) callbackPaso(pasoParaCallback);
    }, Math.max(0, (t - ctx.currentTime) * 1000));
    proximoTiempo += 60 / bpmActual / 2;
    pasoActual = (pasoActual + 1) % PASOS;
  }
}

export function arrancar(patron, bpm, onPaso) {
  const c = obtenerContexto();
  if (!c) return false;
  if (reproduciendo) detener();

  patronActual = patron;
  bpmActual = bpm;
  pasoActual = 0;
  proximoTiempo = c.currentTime + 0.05;
  callbackPaso = onPaso;
  reproduciendo = true;

  programar();
  temporizador = setInterval(programar, LOOKAHEAD_MS);
  return true;
}

export function detener() {
  reproduciendo = false;
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
  callbackPaso = null;
  patronActual = null;
}

export function estaReproduciendo() {
  return reproduciendo;
}

export function actualizarBpm(nuevo) {
  bpmActual = nuevo;
}

export function actualizarPatron(nuevo) {
  patronActual = nuevo;
}

export function voces() {
  return VOCES;
}