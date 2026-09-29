/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/kit.js
   Versión: 1.5.0
   Propósito: acceso a ahorasi_kit.
              v1.5.0: se agrega el campo `notas` (opcional, texto
                      libre hasta 200 caracteres). El usuario lo
                      usa para detalles como cantidad, presentación
                      o marca del item. Se incluye en normalizar(),
                      crear() y actualizar().
              v1.4.0: actualizar() con idempotencia.
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

const log = crearLogger('repo:kit');
const TABLA = 'ahorasi_kit';
const LARGO_MAX_NOTAS = 200;

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    categoria: fila.categoria,
    item: fila.item,
    notas: fila.notas || '',
    listo: !!fila.listo,
    marcadoPor: fila.marcadoPor || null,
    actualizadoEn: fila.$updatedAt,
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
        Query.orderAsc('categoria'),
        Query.limit(200),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar kit: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!datos?.categoria?.trim()) return Resultado.fallo('Falta categoría');
  if (!datos?.item?.trim()) return Resultado.fallo('Falta nombre del item');
  if (datos.categoria.length > 50) return Resultado.fallo('Categoría demasiado larga');
  if (datos.item.length > 100) return Resultado.fallo('Item demasiado largo');
  if (datos.notas && datos.notas.length > LARGO_MAX_NOTAS) {
    return Resultado.fallo(`Las notas no pueden exceder ${LARGO_MAX_NOTAS} caracteres`);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    categoria: datos.categoria.trim(),
    item: datos.item.trim(),
    notas: (datos.notas || '').trim(),
    listo: false,
    marcadoPor: null,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('kit'),
        data: payload,
      });
      const item = normalizar(r);
      emitir('kit:creado', item);
      return Resultado.ok(item);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear item: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id del item');
  if (!cambios || typeof cambios !== 'object') {
    return Resultado.fallo('Los cambios deben ser un objeto');
  }
  if (cambios.categoria !== undefined && !cambios.categoria.trim()) {
    return Resultado.fallo('La categoría no puede quedar vacía');
  }
  if (cambios.categoria !== undefined && cambios.categoria.length > 50) {
    return Resultado.fallo('Categoría demasiado larga');
  }
  if (cambios.item !== undefined && !cambios.item.trim()) {
    return Resultado.fallo('El item no puede quedar vacío');
  }
  if (cambios.item !== undefined && cambios.item.length > 100) {
    return Resultado.fallo('Item demasiado largo');
  }
  if (cambios.notas !== undefined && cambios.notas.length > LARGO_MAX_NOTAS) {
    return Resultado.fallo(`Las notas no pueden exceder ${LARGO_MAX_NOTAS} caracteres`);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.categoria !== undefined) data.categoria = cambios.categoria.trim();
  if (cambios.item !== undefined) data.item = cambios.item.trim();
  if (cambios.notas !== undefined) data.notas = (cambios.notas || '').trim();

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
        const item = normalizar(r);
        emitir('kit:actualizado', item);
        return Resultado.ok(item);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar item: ${e.message}`);
      }
    }
  );
}

export async function marcar(id, listo, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id del item');
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {
    listo: !!listo,
    marcadoPor: listo ? ctx.datos.usuarioId : null,
  };

  return conIdempotenciaParaActualizar(TABLA, ctx.datos.usuarioId, id, data, opciones, async () => {
    try {
      const r = await obtenerTablesDB().updateRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: id,
        data,
      });
      const item = normalizar(r);
      emitir('kit:actualizado', item);
      return Resultado.ok(item);
    } catch (e) {
      log.error('marcar:', e.message);
      return Resultado.fallo(`Error al actualizar item: ${e.message}`);
    }
  });
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del item');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('kit:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar item: ${e.message}`);
  }
}