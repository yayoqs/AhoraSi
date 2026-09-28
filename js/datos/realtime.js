/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/realtime.js
   Versión: 1.6.0
   Propósito: capa única sobre Realtime de Appwrite.
              v1.6.0: se agrega ahorasi_recetas.
              v1.5.0: ahorasi_chistes.
              v1.4.0: retos, penitencias, preguntas, apuestas.
              v1.3.0: ahorasi_series.
              v1.2.0: ahorasi_lugares.
              v1.1.0: ahorasi_fotos.
              v1.0.0: versión inicial.
   ================================================================ */

import {
  obtenerCliente,
  obtenerDatabaseId,
  Realtime,
  Channel,
  Query,
} from './cliente-appwrite.js';
import { emitir } from '../nucleo/bus-eventos.js';
import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('datos:realtime');

const TABLAS = {
  ahorasi_planes: 'planes',
  ahorasi_kit: 'kit',
  ahorasi_hitos: 'hitos',
  ahorasi_carta: 'carta',
  ahorasi_respuestas: 'respuestas',
  ahorasi_fauna: 'fauna',
  ahorasi_flora: 'flora',
  ahorasi_ritmos: 'ritmos',
  ahorasi_fotos: 'fotos',
  ahorasi_lugares: 'lugares',
  ahorasi_series: 'series',
  ahorasi_retos: 'retos',
  ahorasi_penitencias: 'penitencias',
  ahorasi_preguntas: 'preguntas',
  ahorasi_apuestas: 'apuestas',
  ahorasi_chistes: 'chistes',
  ahorasi_recetas: 'recetas',
};

let rt = null;
let suscripciones = [];
let espacioActivo = null;

function identificarAccion(eventos) {
  if (eventos.some((e) => e.endsWith('.create'))) return 'crear';
  if (eventos.some((e) => e.endsWith('.update'))) return 'actualizar';
  if (eventos.some((e) => e.endsWith('.delete'))) return 'eliminar';
  return 'desconocida';
}

function manejarEvento(clave, respuesta) {
  const eventos = respuesta.events || [];
  const fila = respuesta.payload;
  if (!fila) return;
  const accion = identificarAccion(eventos);
  log.info(`Realtime ${clave} ${accion}:`, fila.$id);
  emitir('realtime:cambio', { clave, accion, fila });
  emitir(`realtime:${clave}:${accion}`, fila);
}

export async function iniciar(espacio) {
  if (!espacio) {
    log.warn('iniciar(): sin espacio');
    return;
  }
  const espacioId = espacio.id || espacio.$id;
  if (!espacioId) {
    log.warn('iniciar(): sin espacioId');
    return;
  }
  if (rt && espacioActivo === espacioId) {
    log.info('Realtime ya estaba iniciado para', espacioId);
    return;
  }

  await detener();

  espacioActivo = espacioId;
  rt = new Realtime(obtenerCliente());
  const dbId = obtenerDatabaseId();

  for (const [tabla, clave] of Object.entries(TABLAS)) {
    try {
      const canal = Channel.tablesdb(dbId).table(tabla).row();
      const queries = [Query.equal('espacioId', espacioId)];
      const sub = await rt.subscribe(
        canal,
        (respuesta) => manejarEvento(clave, respuesta),
        queries
      );
      suscripciones.push(sub);
      log.info('Suscrito a', tabla);
    } catch (e) {
      log.error('Error al suscribir a', tabla, ':', e.message);
    }
  }

  log.info('Realtime iniciado para espacio', espacioId);
}

export async function detener() {
  for (const sub of suscripciones) {
    try {
      await sub.unsubscribe();
    } catch (e) {
      log.warn('Error al desuscribir:', e.message);
    }
  }
  suscripciones = [];

  if (rt) {
    try {
      await rt.disconnect();
    } catch (e) {
      log.warn('Error al desconectar Realtime:', e.message);
    }
    rt = null;
  }
  espacioActivo = null;
  log.info('Realtime detenido');
}

export function estaActivo() {
  return rt !== null && suscripciones.length > 0;
}