/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/audio/beatmaker.js
   Versión: 1.1.0
   Propósito: motor de audio del secuenciador. Dos modos:
              - simple: 4 filas intercambiables, 8 pasos, cada
                fila elige un sonido de un catálogo de 12.
              - extendido: 7 voces fijas de una familia (afro),
                16 pasos, con efectos globales.
              La cadena de audio (compresor, saturación, filtro,
              reverb, eco) se mantiene activa en ambos modos.
              v1.1.0: se agrega el modo simple con catálogo de 12
                      sonidos. Se separa la síntesis: VOCES_AFRO
                      (extendido) y GOLPES_SIMPLES (simple).
                      La API pública recibe un objeto `modo` en
                      la config.
              v1.0.0: versión inicial. Solo extendido.
   ================================================================ */

import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('audio:beatmaker');

/* ================================================================
   CONSTANTES.
   ================================================================ */

export const ESCALAS = {
  menor:       { pasos: [0, 2, 3, 5, 7, 8, 10], nombre: 'menor natural' },
  mayor:       { pasos: [0, 2, 4, 5, 7, 9, 11], nombre: 'mayor natural' },
  pentatonica: { pasos: [0, 3, 5, 7, 10],       nombre: 'pentatónica menor' },
};

export const NOMBRES_NOTA = ['DO','DO#','RE','RE#','MI','FA','FA#','SOL','SOL#','LA','LA#','SI'];

export const FUERZAS = [0, 0.4, 0.72, 1];
export const CARACTERES = ['.', 'o', 'x', 'X'];

export const NOMBRES_VOCES_EXTENDIDO = [
  'Bombo', 'Slap djembé', 'Grave djembé', 'Shekere',
  'Gankogui', 'Log bajo', 'Kalimba',
];

export const PASOS_EXTENDIDO = 16;
export const FILAS_EXTENDIDO = 7;
export const VOCES_RITMICAS = 5;
export const PASOS_SIMPLE = 8;
export const FILAS_SIMPLE = 4;

/* ================================================================
   CATÁLOGO DE SONIDOS SIMPLES.
   12 sonidos repartidos en 4 categorías.
   ================================================================ */

export const SONIDOS_SIMPLES = [
  { id: 'bombo_seco',   nombre: 'Bombo seco',   cat: 'Graves' },
  { id: 'bombo_gordo',  nombre: 'Bombo gordo',  cat: 'Graves' },
  { id: 'djembe_grave', nombre: 'Djembé grave', cat: 'Graves' },
  { id: 'caja_seca',    nombre: 'Caja seca',    cat: 'Medios' },
  { id: 'caja_clasica', nombre: 'Caja clásica', cat: 'Medios' },
  { id: 'timbal',       nombre: 'Timbal',       cat: 'Medios' },
  { id: 'hh_cerrado',   nombre: 'HH cerrado',   cat: 'Agudos' },
  { id: 'hh_abierto',   nombre: 'HH abierto',   cat: 'Agudos' },
  { id: 'shaker',       nombre: 'Shaker',       cat: 'Agudos' },
  { id: 'guira',        nombre: 'Güira',        cat: 'Agudos' },
  { id: 'cencerro',     nombre: 'Cencerro',     cat: 'Metálicos' },
  { id: 'campana',      nombre: 'Campana',      cat: 'Metálicos' },
];

export const CATEGORIAS_SIMPLES = ['Graves', 'Medios', 'Agudos', 'Metálicos'];

export function buscarSonidoSimple(id) {
  return SONIDOS_SIMPLES.find((s) => s.id === id) || null;
}

/* ================================================================
   ESTILOS EXTENDIDOS. Solo afro.
   ================================================================ */

export const ESTILOS_EXTENDIDOS = [
  {
    id: 'tumbe',
    nombre: 'Afro Tumbé',
    descripcion: 'Polirritmia pura. Gankogui marcando clave cruzada contra el bombo.',
    bpm: 110, swing: 18,
    raiz: 40, escala: 'pentatonica',
    efectos: { reverb: 24, eco: 24, saturacion: 15, filtro: 100 },
    patrones: [
      'X...o...X..x....',
      '..x...X...x...X.',
      'x..x..o...x..x..',
      'X.x.X.x.X.x.X.x.',
      'X..X..x...X.X...',
      [1,0,0,0, 0,0,1,0, 0,0,0,0, 3,5,0,0],
      [0,0,0,0, 0,0,0,0, 3,0,0,0, 0,0,0,0],
    ],
  },
  {
    id: 'afrobeat',
    nombre: 'Afrobeat',
    descripcion: 'Groove cerrado. Backbeat firme, percusiones entretejidas y bajo melódico.',
    bpm: 114, swing: 15,
    raiz: 41, escala: 'pentatonica',
    efectos: { reverb: 20, eco: 20, saturacion: 15, filtro: 100 },
    patrones: [
      'X.......X..x....',
      '....X.......X...',
      '..x...x...x...x.',
      'x.x.x.x.x.x.x.x.',
      'x.x..x.x..x.x...',
      [1,0,0,1, 3,0,0,0, 0,0,1,0, 3,1,0,0],
      [0,0,0,0, 0,0,3,0, 0,0,0,0, 5,0,3,0],
    ],
  },
  {
    id: 'afro_house',
    nombre: 'Afro House',
    descripcion: 'Ritmo de club. Log bajo marcando el sub-grave, reverberación espaciosa.',
    bpm: 122, swing: 5,
    raiz: 43, escala: 'pentatonica',
    efectos: { reverb: 28, eco: 26, saturacion: 12, filtro: 100 },
    patrones: [
      'X...X...X...X...',
      '....x.......x...',
      '..x..o..x..o..x.',
      'oXoXoXoXoXoXoXoX',
      '..x..x..x..x..x.',
      [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,3,0],
      [0,0,0,0, 0,0,0,0, 3,0,0,0, 0,0,0,0],
    ],
  },
];

export function buscarEstiloExtendido(id) {
  return ESTILOS_EXTENDIDOS.find((e) => e.id === id) || null;
}

/* ================================================================
   PATRÓN INICIAL SIMPLE: rap underground 90 bpm.
   ================================================================ */

export const PATRON_INICIAL_SIMPLE = [
  { sonidoId: 'bombo_gordo', pasos: [3,0,2,0, 0,0,2,0] },
  { sonidoId: 'caja_seca',   pasos: [0,0,2,0, 0,0,2,0] },
  { sonidoId: 'hh_cerrado',  pasos: [2,2,2,2, 2,2,2,2] },
  { sonidoId: 'clap',        pasos: [0,0,3,0, 0,0,3,0] },
];

/* ================================================================
   HELPERS PÚBLICOS.
   ================================================================ */

export function nombreNota(midi) {
  return NOMBRES_NOTA[((midi % 12) + 12) % 12];
}

function frecuencia(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convierte la definición de un patrón extendido (caracteres +
 * grados de escala) a la estructura interna (niveles y
 * semitonos cromáticos).
 */
export function normalizarPatronExtendido(definicion, escala) {
  const pasos = ESCALAS[escala].pasos;
  const filas = [];
  for (let i = 0; i < FILAS_EXTENDIDO; i++) {
    const def = definicion[i];
    if (Array.isArray(def)) {
      const fila = Array(PASOS_EXTENDIDO).fill(-1);
      for (let c = 0; c < PASOS_EXTENDIDO && c < def.length; c++) {
        const grado = Number(def[c]) || 0;
        if (grado > 0) {
          const idx = grado - 1;
          const octava = Math.floor(idx / pasos.length);
          const semitono = (pasos[idx % pasos.length] + 12 * octava) % 12;
          fila[c] = semitono;
        }
      }
      filas.push(fila);
    } else {
      const s = String(def || '').padEnd(PASOS_EXTENDIDO, '.').slice(0, PASOS_EXTENDIDO);
      const fila = Array.from(s).map((ch) => Math.max(0, CARACTERES.indexOf(ch)));
      filas.push(fila);
    }
  }
  return filas;
}

/* ================================================================
   AUDIO.
   ================================================================ */

let ctx = null;
let bus = null;
let filtro = null;
let envioReverb = null;
let envioEco = null;
let delayEco = null;
let gananciaSaturada = null;
let gananciaSeca = null;
let saturador = null;
let bufferRuido = null;
let compresor = null;

let reproduciendo = false;
let pasoActual = 0;
let proximoTiempo = 0;
let temporizador = null;
let callbackPaso = null;
let config = null;

function iniciarAudio() {
  if (ctx) { ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();

  bus = ctx.createGain();

  filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 20000;

  compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -12;
  compresor.ratio.value = 5;
  compresor.attack.value = 0.002;
  compresor.release.value = 0.1;

  const salida = ctx.createGain();
  salida.gain.value = 0.9;

  gananciaSeca = ctx.createGain();
  gananciaSaturada = ctx.createGain();

  saturador = ctx.createWaveShaper();
  const curva = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) curva[i] = Math.tanh((i / 512 - 1) * 5);
  saturador.curve = curva;
  saturador.oversample = '2x';

  bus.connect(gananciaSeca);
  bus.connect(saturador);
  saturador.connect(gananciaSaturada);
  gananciaSeca.connect(filtro);
  gananciaSaturada.connect(filtro);
  filtro.connect(compresor);
  compresor.connect(salida);
  salida.connect(ctx.destination);

  const dur = 1.5;
  const muestras = ctx.sampleRate * dur;
  const impulso = ctx.createBuffer(2, muestras, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = impulso.getChannelData(c);
    for (let i = 0; i < muestras; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / muestras, 2.8);
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulso;
  envioReverb = ctx.createGain();
  const retornoReverb = ctx.createGain();
  bus.connect(envioReverb);
  envioReverb.connect(convolver);
  convolver.connect(retornoReverb);
  retornoReverb.connect(compresor);

  delayEco = ctx.createDelay(1.5);
  envioEco = ctx.createGain();
  const realim = ctx.createGain();
  realim.gain.value = 0.4;
  const filtroEco = ctx.createBiquadFilter();
  filtroEco.type = 'lowpass';
  filtroEco.frequency.value = 2200;
  bus.connect(envioEco);
  envioEco.connect(delayEco);
  delayEco.connect(filtroEco);
  filtroEco.connect(realim);
  realim.connect(delayEco);
  filtroEco.connect(compresor);

  const n = ctx.sampleRate;
  bufferRuido = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = bufferRuido.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

  return ctx;
}

function aplicarEfectos(efectos) {
  if (!ctx || !efectos) return;
  envioReverb.gain.value = efectos.reverb / 100 * 0.9;
  envioEco.gain.value = efectos.eco / 100 * 0.7;
  gananciaSaturada.gain.value = efectos.saturacion / 100 * 0.7;
  gananciaSeca.gain.value = 1 - efectos.saturacion / 250;
  filtro.frequency.value = 200 * Math.pow(100, efectos.filtro / 100);
  if (config) delayEco.delayTime.value = (60 / config.bpm) * 0.75;
}

/* ================================================================
   HELPERS DE SÍNTESIS.
   ================================================================ */

function envolvente(t, vol, dur) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function tono(salida, t, tipo, freq, freqFin, dur, vol) {
  const o = ctx.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  if (freqFin !== freq) {
    o.frequency.exponentialRampToValueAtTime(freqFin, t + Math.min(0.1, dur * 0.5));
  }
  const g = envolvente(t, vol, dur);
  o.connect(g); g.connect(salida);
  o.start(t); o.stop(t + dur + 0.02);
}

function ruido(salida, t, tipo, freq, q, vol, dur) {
  const s = ctx.createBufferSource();
  s.buffer = bufferRuido;
  const f = ctx.createBiquadFilter();
  f.type = tipo;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = envolvente(t, vol, dur);
  s.connect(f); f.connect(g); g.connect(salida);
  s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.02);
}

function banda(salida, freq, q) {
  const b = ctx.createBiquadFilter();
  b.type = 'bandpass';
  b.frequency.value = freq;
  b.Q.value = q;
  b.connect(salida);
  return b;
}

function pasoBajo(salida, freq, q) {
  const b = ctx.createBiquadFilter();
  b.type = 'lowpass';
  b.frequency.value = freq;
  b.Q.value = q || 0;
  b.connect(salida);
  return b;
}

/* ================================================================
   VOCES DEL MODO EXTENDIDO (AFRO).
   ================================================================ */

const VOCES_AFRO = [
  (salida, t, v) => {
    tono(salida, t, 'sine', 150, 42, 0.45, v * 1.1);
    ruido(salida, t, 'highpass', 2000, 0.7, 0.15 * v, 0.012);
  },
  (salida, t, v) => {
    ruido(salida, t, 'bandpass', 2500, 1.2, 0.8 * v, 0.12);
    tono(salida, t, 'triangle', 400, 280, 0.1, 0.4 * v);
  },
  (salida, t, v) => {
    tono(salida, t, 'sine', 160, 85, 0.35, v);
    ruido(salida, t, 'bandpass', 500, 1, 0.2 * v, 0.04);
  },
  (salida, t, v) => {
    const dur = v > 0.8 ? 0.12 : 0.04;
    ruido(salida, t, 'bandpass', 6000, 0.8, 0.5 * v, dur);
  },
  (salida, t, v) => {
    const bp = banda(salida, 2000, 1.5);
    tono(bp, t, 'triangle', 480, 480, 0.4, 0.8 * v);
    tono(bp, t, 'triangle', 710, 710, 0.3, 0.6 * v);
  },
  (salida, t, v, midi) => {
    if (!midi) return;
    const freq = frecuencia(midi);
    const dur = 0.45;
    const f = pasoBajo(salida, 500, 3);
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur * 0.4);
    tono(f, t, 'sine', freq, freq, dur, v);
    tono(f, t, 'sine', freq / 2, freq / 2, dur, 0.5 * v);
    tono(f, t, 'triangle', freq * 2, freq * 1.6, 0.12, 0.15 * v);
  },
  (salida, t, v, midi) => {
    if (!midi) return;
    const freq = frecuencia(midi);
    tono(salida, t, 'sine', freq, freq, 0.5, 0.6 * v);
    tono(salida, t, 'sine', freq * 5.2, freq * 5.2, 0.1, 0.2 * v);
    tono(salida, t, 'triangle', freq * 2, freq * 2, 0.3, 0.2 * v);
  },
];

/* ================================================================
   GOLPES DEL MODO SIMPLE.
   ================================================================ */

const GOLPES_SIMPLES = {
  bombo_seco: (o, t, v) => {
    tono(o, t, 'sine', 300, 45, 0.35, v * 1.2);
    ruido(o, t, 'lowpass', 1000, 0.7, 0.15 * v, 0.012);
  },
  bombo_gordo: (o, t, v) => {
    tono(o, t, 'sine', 250, 38, 0.5, v * 1.3);
    tono(o, t, 'sine', 125, 30, 0.5, 0.4 * v);
    ruido(o, t, 'lowpass', 800, 0.8, 0.2 * v, 0.014);
  },
  djembe_grave: (o, t, v) => {
    tono(o, t, 'sine', 160, 85, 0.35, v);
    ruido(o, t, 'bandpass', 500, 1, 0.2 * v, 0.04);
  },
  caja_seca: (o, t, v) => {
    tono(o, t, 'triangle', 220, 160, 0.14, 0.5 * v);
    ruido(o, t, 'bandpass', 3500, 1.5, 0.75 * v, 0.13);
    ruido(o, t, 'highpass', 6000, 0.6, 0.3 * v, 0.06);
  },
  caja_clasica: (o, t, v) => {
    tono(o, t, 'triangle', 240, 170, 0.2, 0.5 * v);
    ruido(o, t, 'bandpass', 2800, 1.0, 0.7 * v, 0.18);
    ruido(o, t, 'highpass', 5000, 0.5, 0.3 * v, 0.1);
  },
  timbal: (o, t, v) => {
    tono(o, t, 'sine', 380, 300, 0.25, 0.9 * v);
    tono(o, t, 'square', 800, 600, 0.05, 0.15 * v);
  },
  hh_cerrado: (o, t, v) => {
    ruido(o, t, 'highpass', 7500, 0.6, 0.4 * v, 0.035);
  },
  hh_abierto: (o, t, v) => {
    ruido(o, t, 'highpass', 6500, 0.6, 0.4 * v, 0.32);
  },
  shaker: (o, t, v) => {
    const dur = v > 0.8 ? 0.1 : 0.04;
    ruido(o, t, 'bandpass', 5000, 1.2, 0.5 * v, dur);
  },
  guira: (o, t, v) => {
    const dur = v > 0.8 ? 0.16 : 0.035;
    ruido(o, t, 'highpass', 5500, 0.8, 0.7 * v, dur);
    ruido(o, t, 'bandpass', 8000, 1.5, 0.3 * v, dur * 1.2);
  },
  cencerro: (o, t, v) => {
    const bp = banda(o, 1200, 1);
    tono(bp, t, 'square', 540, 540, 0.2, v);
    tono(bp, t, 'square', 780, 780, 0.2, v);
  },
  campana: (o, t, v) => {
    tono(o, t, 'square', 880, 880, 0.22, 0.4 * v);
    tono(o, t, 'square', 1320, 1320, 0.22, 0.2 * v);
    tono(o, t, 'square', 1760, 1760, 0.22, 0.1 * v);
  },
};

/* ================================================================
   DISPARO DE VOCES.
   ================================================================ */

function midiDeSemitono(fila, semitono, raiz) {
  const offset = fila === 5 ? 12 : 24;
  return raiz + offset + semitono;
}

function dispararSimple(indiceFila, t, fuerza, cfg) {
  const fila = cfg.filas[indiceFila];
  if (!fila) return;
  const golpe = GOLPES_SIMPLES[fila.sonidoId];
  if (!golpe) return;
  const salida = ctx.createGain();
  salida.gain.value = 1;
  salida.connect(bus);
  golpe(salida, t, fuerza);
}

function dispararExtendido(indiceFila, t, fuerza, semitono, cfg) {
  const voz = VOCES_AFRO[indiceFila];
  if (!voz) return;

  const silenciados = cfg.silenciados || [];
  const solistas = cfg.solistas || [];
  const volumen = cfg.volumen || [];

  if (silenciados[indiceFila]) return;
  if (solistas.some(Boolean) && !solistas[indiceFila]) return;
  if (volumen[indiceFila] === 0) return;

  const salida = ctx.createGain();
  salida.gain.value = volumen[indiceFila] != null ? volumen[indiceFila] : 1;
  salida.connect(bus);

  let midi = 0;
  if (indiceFila >= VOCES_RITMICAS) {
    if (semitono < 0) { salida.disconnect(); return; }
    midi = midiDeSemitono(indiceFila, semitono, cfg.raiz);
  }
  voz(salida, t, fuerza, midi);
}

/* ================================================================
   API PÚBLICA: tocar una voz suelta.
   ================================================================ */

export function tocarVozSimple(indiceFila, fuerza, cfg) {
  const c = iniciarAudio();
  dispararSimple(indiceFila, c.currentTime + 0.01, fuerza, cfg);
}

export function tocarVozExtendida(indiceFila, fuerza, semitono, cfg) {
  const c = iniciarAudio();
  dispararExtendido(indiceFila, c.currentTime + 0.01, fuerza, semitono, cfg);
}

export function tocarSonidoSimple(sonidoId) {
  const c = iniciarAudio();
  const golpe = GOLPES_SIMPLES[sonidoId];
  if (!golpe) return;
  const salida = c.createGain();
  salida.gain.value = 1;
  salida.connect(bus);
  golpe(salida, c.currentTime + 0.01, 1);
}

/* ================================================================
   SECUENCIADOR.
   ================================================================ */

function pulsar() {
  if (!reproduciendo || !config) return;

  const modo = config.modo;
  const pasos = modo === 'simple' ? PASOS_SIMPLE : PASOS_EXTENDIDO;

  while (proximoTiempo < ctx.currentTime + 0.12) {
    const c = pasoActual;
    const dur = 60 / config.bpm / (modo === 'simple' ? 2 : 4);
    const swingAplicado = (c % 2) ? (config.swing / 100) * dur : 0;
    const t = proximoTiempo + swingAplicado;

    if (modo === 'simple') {
      for (let f = 0; f < FILAS_SIMPLE; f++) {
        const v = config.filas[f].pasos[c];
        if (!v) continue;
        dispararSimple(f, t, FUERZAS[v], config);
      }
    } else {
      for (let f = 0; f < FILAS_EXTENDIDO; f++) {
        const v = config.patron[f][c];
        if (f < VOCES_RITMICAS) {
          if (!v) continue;
          dispararExtendido(f, t, FUERZAS[v], 0, config);
        } else {
          if (v < 0) continue;
          dispararExtendido(f, t, 0.85, v, config);
        }
      }
    }

    const pasoParaCallback = c;
    setTimeout(() => {
      if (reproduciendo && callbackPaso) callbackPaso(pasoParaCallback);
    }, Math.max(0, (t - ctx.currentTime) * 1000));

    proximoTiempo += dur;
    pasoActual = (pasoActual + 1) % pasos;
  }
}

export function arrancar(configInicial, onPaso) {
  const c = iniciarAudio();
  if (reproduciendo) detener();

  config = configInicial;
  callbackPaso = onPaso;

  if (config.efectos) aplicarEfectos(config.efectos);

  pasoActual = 0;
  proximoTiempo = c.currentTime + 0.05;
  reproduciendo = true;

  pulsar();
  temporizador = setInterval(pulsar, 25);
  log.info('Beatmaker arrancado:', config.modo, config.bpm, 'bpm');
  return true;
}

export function detener() {
  reproduciendo = false;
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
  callbackPaso = null;
  log.info('Beatmaker detenido');
}

export function estaReproduciendo() {
  return reproduciendo;
}

export function actualizar(parcial) {
  if (!config) return;
  Object.assign(config, parcial);
  if (parcial.efectos) aplicarEfectos(parcial.efectos);
  if (parcial.bpm && delayEco) {
    delayEco.delayTime.value = (60 / parcial.bpm) * 0.75;
  }
}

export function configActual() {
  return config;
}