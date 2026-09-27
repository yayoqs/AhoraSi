/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/lugares.js
   Versión: 1.0.0
   Propósito: acceso a ahorasi_lugares. Cada lugar tiene nombre,
              coordenadas, región, notas, estado (visitado o
              pendiente) y fecha de visita opcional.
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
import {
  obtenerContexto,
  conIdempotenciaParaCrear,
  conIdempotenciaParaActualizar,
} from './_contexto.js';

const log = crearLogger('repo:lugares');
const TABLA = 'ahorasi_lugares';
const ESTADOS = ['pendiente', 'visitado'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    nombre: fila.nombre,
    latitud: Number(fila.latitud),
    longitud: Number(fila.longitud),
    region: fila.region || '',
    notas: fila.notas || '',
    estado: fila.estado || 'pendiente',
    fechaVisita: fila.fechaVisita || null,
    creadoPor: fila.creadoPor,
    creadoEn: fila.$createdAt,
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
        Query.limit(500),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar lugares: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!datos?.nombre?.trim()) return Resultado.fallo('Falta nombre');
  if (datos.nombre.length > 100) return Resultado.fallo('Nombre demasiado largo');
  if (typeof datos.latitud !== 'number' || Number.isNaN(datos.latitud)) {
    return Resultado.fallo('Latitud inválida');
  }
  if (typeof datos.longitud !== 'number' || Number.isNaN(datos.longitud)) {
    return Resultado.fallo('Longitud inválida');
  }
  if (datos.latitud < -90 || datos.latitud > 90) return Resultado.fallo('Latitud fuera de rango');
  if (datos.longitud < -180 || datos.longitud > 180) return Resultado.fallo('Longitud fuera de rango');
  if (datos.estado && !ESTADOS.includes(datos.estado)) {
    return Resultado.fallo(`Estado inválido: ${datos.estado}`);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const estado = datos.estado || 'pendiente';
  const payload = {
    espacioId: ctx.datos.espacioId,
    nombre: datos.nombre.trim(),
    latitud: datos.latitud,
    longitud: datos.longitud,
    region: (datos.region || '').trim(),
    notas: (datos.notas || '').trim(),
    estado,
    fechaVisita: estado === 'visitado' && datos.fechaVisita ? datos.fechaVisita : null,
    creadoPor: ctx.datos.usuarioId,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('lugar'),
        data: payload,
      });
      const lugar = normalizar(r);
      emitir('lugares:creado', lugar);
      return Resultado.ok(lugar);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear lugar: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id del lugar');
  if (!cambios || typeof cambios !== 'object') {
    return Resultado.fallo('Los cambios deben ser un objeto');
  }
  if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
    return Resultado.fallo('El nombre no puede quedar vacío');
  }
  if (cambios.estado !== undefined && !ESTADOS.includes(cambios.estado)) {
    return Resultado.fallo(`Estado inválido: ${cambios.estado}`);
  }
  if (cambios.latitud !== undefined && (typeof cambios.latitud !== 'number' || Number.isNaN(cambios.latitud))) {
    return Resultado.fallo('Latitud inválida');
  }
  if (cambios.longitud !== undefined && (typeof cambios.longitud !== 'number' || Number.isNaN(cambios.longitud))) {
    return Resultado.fallo('Longitud inválida');
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.nombre !== undefined) data.nombre = cambios.nombre.trim();
  if (cambios.latitud !== undefined) data.latitud = cambios.latitud;
  if (cambios.longitud !== undefined) data.longitud = cambios.longitud;
  if (cambios.region !== undefined) data.region = (cambios.region || '').trim();
  if (cambios.notas !== undefined) data.notas = (cambios.notas || '').trim();
  if (cambios.estado !== undefined) data.estado = cambios.estado;
  if (cambios.fechaVisita !== undefined) data.fechaVisita = cambios.fechaVisita || null;

  if (Object.keys(data).length === 0) {
    return Resultado.fallo('Sin cambios válidos');
  }

  return conIdempotenciaParaActualizar(
    TABLA,
    ctx.datos.usuarioId,
    id,
    data,
    opciones,
    async () => {
      try {
        const r = await obtenerTablesDB().updateRow({
          databaseId: obtenerDatabaseId(),
          tableId: TABLA,
          rowId: id,
          data,
        });
        const lugar = normalizar(r);
        emitir('lugares:actualizado', lugar);
        return Resultado.ok(lugar);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar lugar: ${e.message}`);
      }
    }
  );
}

export async function marcarVisitado(id, visitado, fecha, opciones = {}) {
  return actualizar(id, {
    estado: visitado ? 'visitado' : 'pendiente',
    fechaVisita: visitado ? (fecha || new Date().toISOString()) : null,
  }, opciones);
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del lugar');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('lugares:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar lugar: ${e.message}`);
  }
}