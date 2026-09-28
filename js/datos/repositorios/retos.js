/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/retos.js
   Versión: 1.0.0
   Propósito: acceso a ahorasi_retos. Cada reto tiene texto,
              contexto opcional, autor, destinatario y estado
              (propuesto, aceptado, cumplido, rechazado).
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

const log = crearLogger('repo:retos');
const TABLA = 'ahorasi_retos';
const ESTADOS = ['propuesto', 'aceptado', 'cumplido', 'rechazado'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    texto: fila.texto,
    contexto: fila.contexto || '',
    autor: fila.autor,
    destinatario: fila.destinatario,
    estado: fila.estado || 'propuesto',
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
        Query.limit(200),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar retos: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!datos?.texto?.trim()) return Resultado.fallo('Falta el reto');
  if (datos.texto.length > 300) return Resultado.fallo('Reto demasiado largo');
  if (datos.contexto && datos.contexto.length > 500) {
    return Resultado.fallo('Contexto demasiado largo');
  }
  if (!datos.destinatario) return Resultado.fallo('Falta el destinatario');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    texto: datos.texto.trim(),
    contexto: (datos.contexto || '').trim(),
    autor: ctx.datos.usuarioId,
    destinatario: datos.destinatario,
    estado: 'propuesto',
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('reto'),
        data: payload,
      });
      const item = normalizar(r);
      emitir('retos:creado', item);
      return Resultado.ok(item);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear reto: ${e.message}`);
    }
  });
}

export async function cambiarEstado(id, estado, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id');
  if (!ESTADOS.includes(estado)) return Resultado.fallo(`Estado inválido: ${estado}`);

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = { estado };

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
        const item = normalizar(r);
        emitir('retos:actualizado', item);
        return Resultado.ok(item);
      } catch (e) {
        log.error('cambiarEstado:', e.message);
        return Resultado.fallo(`Error al actualizar reto: ${e.message}`);
      }
    }
  );
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('retos:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar reto: ${e.message}`);
  }
}