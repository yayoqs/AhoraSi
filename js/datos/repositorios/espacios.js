/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/espacios.js
   Versión: 1.0.1
   Propósito: acceso a ahorasi_espacios. Expone listarDeUsuario,
              obtenerPorId, crear y eliminar. Un espacio contiene
              el array miembros con los userIds.
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

const log = crearLogger('repo:espacios');
const TABLA = 'ahorasi_espacios';

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    nombre: fila.nombre,
    miembros: Array.isArray(fila.miembros) ? fila.miembros : [],
    creadoEn: fila.creadoEn || fila.$createdAt,
  };
}

function permisosParaMiembros(miembros) {
  const permisos = new Set();
  for (const id of miembros) {
    permisos.add(Permission.read(Role.user(id)));
    permisos.add(Permission.update(Role.user(id)));
    permisos.add(Permission.delete(Role.user(id)));
  }
  return [...permisos];
}

export async function listarDeUsuario(userId) {
  if (!userId) return Resultado.fallo('Falta userId');
  try {
    const r = await obtenerTablesDB().listRows({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      queries: [
        Query.contains('miembros', [userId]),
        Query.limit(10),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listarDeUsuario:', e.message);
    return Resultado.fallo(`Error al listar espacios: ${e.message}`);
  }
}

export async function obtenerPorId(id) {
  if (!id) return Resultado.fallo('Falta el id del espacio');
  try {
    const r = await obtenerTablesDB().getRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    return Resultado.ok(normalizar(r));
  } catch (e) {
    log.error('obtenerPorId:', e.message);
    return Resultado.fallo(`Error al obtener espacio: ${e.message}`);
  }
}

export async function crear(datos) {
  if (!datos?.nombre || !datos.nombre.trim()) return Resultado.fallo('Falta nombre');
  if (!Array.isArray(datos.miembros) || datos.miembros.length === 0) {
    return Resultado.fallo('El espacio debe tener al menos un miembro');
  }

  const rowId = generarId('esp');
  try {
    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId,
      data: {
        nombre: datos.nombre.trim(),
        miembros: datos.miembros,
        creadoEn: new Date().toISOString(),
      },
      permissions: permisosParaMiembros(datos.miembros),
    });
    const espacio = normalizar(r);
    emitir('espacios:creado', espacio);
    log.info('Espacio creado:', espacio.id);
    return Resultado.ok(espacio);
  } catch (e) {
    log.error('crear:', e.message);
    return Resultado.fallo(`Error al crear espacio: ${e.message}`);
  }
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del espacio');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('espacios:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar espacio: ${e.message}`);
  }
}