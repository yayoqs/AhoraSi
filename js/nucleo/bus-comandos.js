/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/nucleo/bus-comandos.js
   Versión: 1.0.0
   Propósito: bus de comandos síncronos. Un módulo registra un
              comando; otro lo ejecuta y recibe el resultado.
              Útil para consultas puntuales sin estado.
   ================================================================ */

import { crearLogger } from './logger.js';
const log = crearLogger('bus-comandos');

const comandos = new Map();

export function registrar(nombre, manejador) {
  if (typeof manejador !== 'function') {
    throw new TypeError('registrar(): el manejador debe ser una función');
  }
  if (comandos.has(nombre)) {
    log.warn(`Comando "${nombre}" ya registrado, se sobrescribe`);
  }
  comandos.set(nombre, manejador);
}

export function ejecutar(nombre, ...args) {
  const manejador = comandos.get(nombre);
  if (!manejador) {
    log.error(`Comando "${nombre}" no registrado`);
    throw new Error(`Comando no registrado: ${nombre}`);
  }
  return manejador(...args);
}

export function existe(nombre) {
  return comandos.has(nombre);
}

export function desregistrar(nombre) {
  comandos.delete(nombre);
}

export function limpiarTodo() {
  comandos.clear();
}