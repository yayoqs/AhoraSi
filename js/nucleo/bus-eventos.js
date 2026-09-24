/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/nucleo/bus-eventos.js
   Versión: 1.0.0
   Propósito: canal único de comunicación entre módulos.
              Cada suscripción devuelve función para desuscribir.
   ================================================================ */

import { crearLogger } from './logger.js';
const log = crearLogger('bus-eventos');

const suscriptores = new Map();

export function al(evento, manejador) {
  if (typeof manejador !== 'function') {
    throw new TypeError('al(): el manejador debe ser una función');
  }
  if (!suscriptores.has(evento)) suscriptores.set(evento, new Set());
  suscriptores.get(evento).add(manejador);

  return function desuscribir() {
    const conjunto = suscriptores.get(evento);
    if (!conjunto) return;
    conjunto.delete(manejador);
    if (conjunto.size === 0) suscriptores.delete(evento);
  };
}

export function emitir(evento, datos) {
  const conjunto = suscriptores.get(evento);
  if (!conjunto) return;
  for (const manejador of Array.from(conjunto)) {
    try {
      manejador(datos);
    } catch (e) {
      log.error(`Error en suscriptor de "${evento}":`, e);
    }
  }
}

export function suscriptoresDe(evento) {
  return suscriptores.get(evento)?.size ?? 0;
}

export function limpiarTodo() {
  suscriptores.clear();
}