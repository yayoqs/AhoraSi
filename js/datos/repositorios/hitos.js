/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/hitos.js
   Versión: 1.7.0
   Propósito: acceso a ahorasi_hitos. Un hito es un hecho
              biográfico, no un pendiente. Tiene título, fecha
              y un color elegido por el usuario que da contexto
              emocional al punto en la línea de tiempo.
              v1.7.0: se reemplaza el campo `tipo` por `color`.
                      El usuario elige el color al crear/editar.
                      Paleta: terracota, musgo, mostaza, azul,
                      ciruela, gris. Se elimina la validación por
                      tipos (encuentro/salida/distancia/...).
                      La columna `cumplido` sigue en la tabla pero
                      se ignora. La columna `tipo` se deja de usar.
              v1.6.0: se agrega tipo.
              v1.5.0: se agrega actualizar() con idempotencia.
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
const COLORES = ['terracota', 'musgo', 'mostaza', 'azul', 'ciruela', 'gris'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    titulo: fila.titulo,
    fecha: fila.fecha || null,
    color: COLORES.includes(fila.color) ? fila.color : 'gris',
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
        Query.orderDesc('fecha'),
        Query.orderDesc('$createdAt'),
        Query.limit(200),
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
  if (!datos.color || !COLORES.includes(datos.color)) {
    return Resultado.fallo('Falta el color del hito');
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    titulo: datos.titulo.trim(),
    fecha: datos.fecha || null,
    color: datos.color,
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
  if (cambios.color !== undefined && !COLORES.includes(cambios.color)) {
    return Resultado.fallo(`Color inválido: ${cambios.color}`);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.titulo !== undefined) data.titulo = cambios.titulo.trim();
  if (cambios.fecha !== undefined) data.fecha = cambios.fecha || null;
  if (cambios.color !== undefined) data.color = cambios.color;

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

/**
 * Se mantiene por compatibilidad con código viejo. La vista actual
 * ya no lo usa.
 */
export async function marcar(id, cumplido, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id del hito');
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = { cumplido: !!cumplido };

  return conIdempotenciaParaActualizar(TABLA, ctx.datos.usuarioId, id, data, opciones, async () => {
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
      log.error('marcar:', e.message);
      return Resultado.fallo(`Error al actualizar hito: ${e.message}`);
    }
  });
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