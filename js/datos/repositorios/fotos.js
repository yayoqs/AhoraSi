/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/fotos.js
   Versión: 1.0.1
   Propósito: acceso a la tabla ahorasi_fotos y al bucket
              ahorasi_fotos de Storage.
              v1.0.1: urlPreview() ahora usa getFileView en lugar
                      de getFilePreview. Motivo: getFilePreview
                      es una característica de pago (transformación
                      de imágenes) y no está disponible en el plan
                      Free de Appwrite. Como las fotos se comprimen
                      en el cliente a 1200 px, el archivo completo
                      es suficientemente liviano para usarlo como
                      miniatura. Se elimina el parámetro de tamaño
                      en la URL resultante.
              v1.0.0: versión inicial.
   ================================================================ */

import {
  obtenerTablesDB,
  obtenerStorage,
  obtenerDatabaseId,
  Query,
} from '../cliente-appwrite.js';
import { Resultado } from '../../dominio/resultado.js';
import { emitir } from '../../nucleo/bus-eventos.js';
import { crearLogger } from '../../nucleo/logger.js';
import { generarId } from '../../nucleo/utils.js';
import { obtenerContexto } from './_contexto.js';

const log = crearLogger('repo:fotos');
const TABLA = 'ahorasi_fotos';
const BUCKET = 'ahorasi_fotos';
const MAX_POR_FILA = 10;

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    fileId: fila.fileId,
    tabla: fila.tabla,
    filaId: fila.filaId,
    espacioId: fila.espacioId,
    subidoPor: fila.subidoPor,
    creadoEn: fila.$createdAt,
  };
}

/**
 * Devuelve la URL de la foto original.
 * Usa getFileView, no getFilePreview.
 */
export function urlArchivo(fileId) {
  if (!fileId) return '';
  const storage = obtenerStorage();
  return String(storage.getFileView(BUCKET, fileId));
}

/**
 * Devuelve la URL para mostrar en la galería.
 * En plan Free no hay transformaciones, así que devuelve la
 * misma URL que urlArchivo. Se mantiene la función para no
 * romper los llamados existentes y para poder diferenciar en
 * el futuro si se migra a un plan con transformaciones.
 */
export function urlPreview(fileId) {
  if (!fileId) return '';
  const storage = obtenerStorage();
  return String(storage.getFileView(BUCKET, fileId));
}

export async function listarPorFila(tabla, filaId) {
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;
  if (!tabla || !filaId) return Resultado.fallo('Falta tabla o filaId');
  try {
    const r = await obtenerTablesDB().listRows({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      queries: [
        Query.equal('espacioId', ctx.datos.espacioId),
        Query.equal('tabla', tabla),
        Query.equal('filaId', filaId),
        Query.orderAsc('$createdAt'),
        Query.limit(MAX_POR_FILA),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listarPorFila:', e.message);
    return Resultado.fallo(`Error al listar fotos: ${e.message}`);
  }
}

export async function contarPorFila(tabla, filaId) {
  const r = await listarPorFila(tabla, filaId);
  if (!r.exito) return r;
  return Resultado.ok(r.datos.length);
}

export async function subir(tabla, filaId, blob, nombreArchivo, onProgreso) {
  if (!tabla || !filaId) return Resultado.fallo('Falta tabla o filaId');
  if (!blob) return Resultado.fallo('Falta el archivo');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const actuales = await contarPorFila(tabla, filaId);
  if (actuales.exito && actuales.datos >= MAX_POR_FILA) {
    return Resultado.fallo(`Máximo ${MAX_POR_FILA} fotos por registro`);
  }

  const fileId = generarId('foto');
  try {
    const storage = obtenerStorage();
    await storage.createFile({
      bucketId: BUCKET,
      fileId,
      file: new File([blob], nombreArchivo || 'foto.jpg', { type: blob.type || 'image/jpeg' }),
      onProgress: (p) => {
        if (typeof onProgreso === 'function') onProgreso(Math.round(p.progress || 0));
      },
    });

    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: generarId('fotos'),
      data: {
        fileId,
        tabla,
        filaId,
        espacioId: ctx.datos.espacioId,
        subidoPor: ctx.datos.usuarioId,
      },
    });
    const foto = normalizar(r);
    emitir('fotos:creada', foto);
    return Resultado.ok(foto);
  } catch (e) {
    log.error('subir:', e.message);
    try {
      const storage = obtenerStorage();
      await storage.deleteFile({ bucketId: BUCKET, fileId });
    } catch (_) {
      // silencioso
    }
    return Resultado.fallo(`Error al subir foto: ${e.message}`);
  }
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id');
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  try {
    const tables = obtenerTablesDB();
    const fila = await tables.getRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    const fileId = fila.fileId;

    await tables.deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });

    if (fileId) {
      try {
        const storage = obtenerStorage();
        await storage.deleteFile({ bucketId: BUCKET, fileId });
      } catch (e) {
        log.warn('No se pudo borrar el archivo en Storage:', e.message);
      }
    }

    emitir('fotos:eliminada', { id, fileId });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar foto: ${e.message}`);
  }
}

export async function eliminarPorFila(tabla, filaId) {
  const r = await listarPorFila(tabla, filaId);
  if (!r.exito) return r;
  for (const foto of r.datos) {
    await eliminar(foto.id);
  }
  return Resultado.ok({ cantidad: r.datos.length });
}