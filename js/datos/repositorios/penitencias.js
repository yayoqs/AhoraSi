/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/penitencias.js
   Versión: 1.0.0
   Propósito: acceso a ahorasi_penitencias. Cada penitencia tiene
              texto, razón opcional, asignadaPor, paraQuien y
              estado (pendiente, cumplida).
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

const log = crearLogger('repo:penitencias');
const TABLA = 'ahorasi_penitencias';
const ESTADOS = ['pendiente', 'cumplida'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    texto: fila.texto,
    razon: fila.razon || '',
    asignadaPor: fila.asignadaPor,
    paraQuien: fila.paraQuien,
    estado: fila.estado || 'pendiente',
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
    return Resultado.fallo(`Error al listar penitencias: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!datos?.texto?.trim()) return Resultado.fallo('Falta la penitencia');
  if (datos.texto.length > 300) return Resultado.fallo('Penitencia demasiado larga');
  if (datos.razon && datos.razon.length > 300) {
    return Resultado.fallo('Razón demasiado larga');
  }
  if (!datos.paraQuien) return Resultado.fallo('Falta el destinatario');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    texto: datos.texto.trim(),
    razon: (datos.razon || '').trim(),
    asignadaPor: ctx.datos.usuarioId,
    paraQuien: datos.paraQuien,
    estado: 'pendiente',
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('penitencia'),
        data: payload,
      });
      const item = normalizar(r);
      emitir('penitencias:creado', item);
      return Resultado.ok(item);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear penitencia: ${e.message}`);
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
        emitir('penitencias:actualizado', item);
        return Resultado.ok(item);
      } catch (e) {
        log.error('cambiarEstado:', e.message);
        return Resultado.fallo(`Error al actualizar penitencia: ${e.message}`);
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
    emitir('penitencias:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar penitencia: ${e.message}`);
  }
}