/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/nucleo/almacen.js
   Versión: 1.2.0
   Propósito: estado en memoria, única fuente para la UI.
              Los módulos leen de acá. Las escrituras pasan por
              la capa de datos, que actualiza el almacén y emite
              eventos para que la UI reaccione.
              v1.2.0: se elimina la clave `perfiles` (plural), sin
                      uso. La clave vigente es `perfil` (singular),
                      poblada por sesion-inicial.js. Sin cambios
                      en las firmas públicas.
              v1.1.0: se agregan claves usuarioActual, perfil,
                      ritmos, carta, respuestas, fauna, flora.
              v1.0.0: versión inicial.
   ================================================================ */

import { emitir } from './bus-eventos.js';

const estado = {
  usuarioActual: null,
  perfil: null,
  espacio: null,
  planes: [],
  kit: [],
  hitos: [],
  ritmos: [],
  carta: [],
  respuestas: [],
  fauna: [],
  flora: [],
  cargando: false,
  error: null,
};

const suscriptores = new Set();

export function obtener(clave) {
  return estado[clave];
}

export function obtenerTodo() {
  return { ...estado };
}

export function establecer(clave, valor) {
  const anterior = estado[clave];
  estado[clave] = valor;
  notificar(clave, valor, anterior);
  emitir(`almacen:${clave}`, { valor, anterior });
}

export function actualizar(clave, fn) {
  const anterior = estado[clave];
  const nuevo = fn(anterior);
  estado[clave] = nuevo;
  notificar(clave, nuevo, anterior);
  emitir(`almacen:${clave}`, { valor: nuevo, anterior });
}

export function suscribir(fn) {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

function notificar(clave, valor, anterior) {
  for (const fn of suscriptores) {
    try {
      fn({ clave, valor, anterior });
    } catch (e) {
      console.error('[almacen] Error en suscriptor:', e);
    }
  }
}

export function reiniciar() {
  for (const k of Object.keys(estado)) {
    const actual = estado[k];
    if (Array.isArray(actual)) estado[k] = [];
    else if (typeof actual === 'boolean') estado[k] = false;
    else estado[k] = null;
  }
  emitir('almacen:reiniciado');
}