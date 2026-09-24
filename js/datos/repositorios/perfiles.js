/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/perfiles.js
   Versión: 1.0.1
   Propósito: acceso a ahorasi_perfiles. Expone obtenerPorUsuarioId,
              crear, actualizar y eliminar. El perfil se crea una
              sola vez por usuario y se reutiliza siempre.
              v1.0.1: se agrega eliminar() para uso en tests.
              v1.0.0: versión inicial.
   ================================================================ */

import {
  obtenerTablesDB,
  obtenerDatabaseId,
  Query,
  Permission,
  Role,
} from '../cliente-appwrite.js';
import { Resultado } from '../../dominio/resultado.js';
import { emitir } from '../../nucleo/bus-eventos.js';
import { crearLogger } from '../../nucleo/logger.js';
import { generarId } from '../../nucleo/utils.js';

const log = crearLogger('repo:perfiles');
const TABLA = 'ahorasi_perfiles';

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    userId: fila.userId,
    nombre: fila.nombre,
    rol: fila.rol || 'miembro',
    creadoEn: fila.$createdAt,
    actualizadoEn: fila.$updatedAt,
  };
}

export async function obtenerPorUsuarioId(userId) {
  if (!userId) return Resultado.fallo('Falta userId');
  try {
    const r = await obtenerTablesDB().listRows({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      queries: [Query.equal('userId', userId), Query.limit(1)],
    });
    if (r.rows.length === 0) return Resultado.fallo('Perfil no encontrado');
    return Resultado.ok(normalizar(r.rows[0]));
  } catch (e) {
    log.error('obtenerPorUsuarioId:', e.message);
    return Resultado.fallo(`Error al obtener perfil: ${e.message}`);
  }
}

export async function crear(datos) {
  if (!datos?.userId) return Resultado.fallo('Falta userId');
  if (!datos?.nombre || !datos.nombre.trim()) return Resultado.fallo('Falta nombre');

  const rowId = generarId('perf');
  try {
    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId,
      data: {
        userId: datos.userId,
        nombre: datos.nombre.trim(),
        rol: datos.rol || 'miembro',
      },
      permissions: [
        Permission.read(Role.user(datos.userId)),
        Permission.update(Role.user(datos.userId)),
        Permission.delete(Role.user(datos.userId)),
      ],
    });
    const perfil = normalizar(r);
    emitir('perfiles:creado', perfil);
    return Resultado.ok(perfil);
  } catch (e) {
    log.error('crear:', e.message);
    return Resultado.fallo(`Error al crear perfil: ${e.message}`);
  }
}

export async function actualizar(id, cambios) {
  if (!id) return Resultado.fallo('Falta el id del perfil');
  if (!cambios || typeof cambios !== 'object') return Resultado.fallo('Cambios inválidos');

  const data = {};
  if (cambios.nombre !== undefined) {
    if (!cambios.nombre.trim()) return Resultado.fallo('El nombre no puede quedar vacío');
    data.nombre = cambios.nombre.trim();
  }
  if (cambios.rol !== undefined) data.rol = cambios.rol;

  if (Object.keys(data).length === 0) return Resultado.fallo('Sin cambios válidos');

  try {
    const r = await obtenerTablesDB().updateRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
      data,
    });
    const perfil = normalizar(r);
    emitir('perfiles:actualizado', perfil);
    return Resultado.ok(perfil);
  } catch (e) {
    log.error('actualizar:', e.message);
    return Resultado.fallo(`Error al actualizar perfil: ${e.message}`);
  }
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del perfil');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('perfiles:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar perfil: ${e.message}`);
  }
}