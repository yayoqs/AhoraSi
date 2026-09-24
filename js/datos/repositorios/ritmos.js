/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/ritmos.js
   Versión: 1.2.0
   Propósito: acceso a ahorasi_ritmos.
              v1.2.0: sin envío de permisos de fila.
              v1.1.0: usa _contexto.js.
              v1.0.0: versión inicial.
   ================================================================ */

import {
  obtenerTablesDB,
  obtenerDatabaseId,
  Query,
} from '../cliente-appwrite.js';
import { Resultado } from '../../dominio/resultado.js';
import { emitir } from '../../nucleo/bus-eventos.js';
import { crearLogger } from '../../nucleo/logger.js';
import { generarId } from '../../nucleo/utils.js';
import { obtenerContexto } from './_contexto.js';

const log = crearLogger('repo:ritmos');
const TABLA = 'ahorasi_ritmos';

function normalizar(fila) {
  if (!fila) return null;
  let patron = [];
  try {
    patron = typeof fila.patron === 'string' ? JSON.parse(fila.patron) : (fila.patron || []);
  } catch (e) {
    log.warn('patron no parseable en', fila.$id);
    patron = [];
  }
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    nombre: fila.nombre,
    bpm: fila.bpm,
    patron,
    creadoPor: fila.creadoPor,
    creadoEn: fila.creadoEn || fila.$createdAt,
  };
}

export async function listar() {
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;
  try {
    const r = await obtenerTablesDB().listRows({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      queries: [
        Query.equal('espacioId', ctx.datos.espacioId),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar ritmos: ${e.message}`);
  }
}

export async function crear(datos) {
  if (!datos?.nombre?.trim()) return Resultado.fallo('Falta nombre');
  if (datos.nombre.length > 100) return Resultado.fallo('Nombre demasiado largo');
  if (typeof datos.bpm !== 'number' || datos.bpm < 40 || datos.bpm > 240) {
    return Resultado.fallo('BPM fuera de rango (40-240)');
  }
  if (!Array.isArray(datos.patron)) return Resultado.fallo('Patrón debe ser un array');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  try {
    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: generarId('ritmo'),
      data: {
        espacioId: ctx.datos.espacioId,
        nombre: datos.nombre.trim(),
        bpm: Math.round(datos.bpm),
        patron: JSON.stringify(datos.patron),
        creadoPor: ctx.datos.usuarioId,
        creadoEn: new Date().toISOString(),
      },
    });
    const ritmo = normalizar(r);
    emitir('ritmos:creado', ritmo);
    return Resultado.ok(ritmo);
  } catch (e) {
    log.error('crear:', e.message);
    return Resultado.fallo(`Error al crear ritmo: ${e.message}`);
  }
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del ritmo');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('ritmos:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar ritmo: ${e.message}`);
  }
}