/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/hitos.js
   Versión: 1.5.0
   Propósito: acceso a ahorasi_hitos.
              v1.5.0: se agrega actualizar(id, cambios, opciones)
                      con idempotencia. Se amplía para poder editar
                      titulo y fecha. marcar() ahora delega en
                      actualizar() internamente.
              v1.4.0: se mantiene la firma de marcar().
              v1.3.0: crear() y marcar() con idempotencia.
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
import {
  obtenerContexto,
  conIdempotenciaParaCrear,
  conIdempotenciaParaActualizar,
} from './_contexto.js';

const log = crearLogger('repo:hitos');
const TABLA = 'ahorasi_hitos';

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    titulo: fila.titulo,
    fecha: fila.fecha || null,
    cumplido: !!fila.cumplido,
    registradoPor: fila.registradoPor,
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
        Query.limit(100),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar hitos: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!datos?.titulo?.trim()) return Resultado.fallo('Falta título');
  if (datos.titulo.length > 200) return Resultado.fallo('Título demasiado largo');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    titulo: datos.titulo.trim(),
    fecha: datos.fecha || null,
    cumplido: !!datos.cumplido,
    registradoPor: ctx.datos.usuarioId,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('hito'),
        data: payload,
      });
      const hito = normalizar(r);
      emitir('hitos:creado', hito);
      return Resultado.ok(hito);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear hito: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id del hito');
  if (!cambios || typeof cambios !== 'object') {
    return Resultado.fallo('Los cambios deben ser un objeto');
  }
  if (cambios.titulo !== undefined && !cambios.titulo.trim()) {
    return Resultado.fallo('El título no puede quedar vacío');
  }
  if (cambios.titulo !== undefined && cambios.titulo.length > 200) {
    return Resultado.fallo('Título demasiado largo');
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.titulo !== undefined) data.titulo = cambios.titulo.trim();
  if (cambios.fecha !== undefined) data.fecha = cambios.fecha || null;
  if (cambios.cumplido !== undefined) data.cumplido = !!cambios.cumplido;

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
        const hito = normalizar(r);
        emitir('hitos:actualizado', hito);
        return Resultado.ok(hito);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar hito: ${e.message}`);
      }
    }
  );
}

export async function marcar(id, cumplido, opciones = {}) {
  return actualizar(id, { cumplido: !!cumplido }, opciones);
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del hito');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('hitos:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar hito: ${e.message}`);
  }
}