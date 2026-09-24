/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/hitos.js
   Versión: 1.2.0
   Propósito: acceso a ahorasi_hitos.
              v1.2.0: sin envío de permisos de fila. Row Security
                      desactivado.
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

export async function crear(datos) {
  if (!datos?.titulo?.trim()) return Resultado.fallo('Falta título');
  if (datos.titulo.length > 200) return Resultado.fallo('Título demasiado largo');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  try {
    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: generarId('hito'),
      data: {
        espacioId: ctx.datos.espacioId,
        titulo: datos.titulo.trim(),
        fecha: datos.fecha || null,
        cumplido: !!datos.cumplido,
        registradoPor: ctx.datos.usuarioId,
      },
    });
    const hito = normalizar(r);
    emitir('hitos:creado', hito);
    return Resultado.ok(hito);
  } catch (e) {
    log.error('crear:', e.message);
    return Resultado.fallo(`Error al crear hito: ${e.message}`);
  }
}

export async function marcar(id, cumplido) {
  if (!id) return Resultado.fallo('Falta el id del hito');
  try {
    const r = await obtenerTablesDB().updateRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
      data: { cumplido: !!cumplido },
    });
    const hito = normalizar(r);
    emitir('hitos:actualizado', hito);
    return Resultado.ok(hito);
  } catch (e) {
    log.error('marcar:', e.message);
    return Resultado.fallo(`Error al actualizar hito: ${e.message}`);
  }
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