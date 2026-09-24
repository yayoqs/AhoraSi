/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/planes.js
   Versión: 1.2.0
   Propósito: acceso a la tabla ahorasi_planes.
              v1.2.0: se elimina el envío de permisos de fila. Con
                      Row Security desactivado, los permisos de
                      tabla se aplican a todas las filas. Esto evita
                      el error de Appwrite "Permissions must be one
                      of: ..." que ocurría al intentar otorgar
                      permisos de fila a otro usuario sin ser admin.
                      Se elimina construirPermisos. Los imports de
                      Permission y Role ya no son necesarios.
              v1.1.0: usa _contexto.js.
              v1.0.1: elimina import muerto de ID.
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

const log = crearLogger('repo:planes');
const TABLA = 'ahorasi_planes';
const ESTADOS_VALIDOS = ['pendiente', 'si', 'quiza', 'no'];

function validarCrear(datos) {
  if (!datos || typeof datos !== 'object') {
    return Resultado.fallo('Los datos del plan deben ser un objeto');
  }
  if (!datos.titulo || !datos.titulo.trim()) {
    return Resultado.fallo('Falta campo requerido: titulo');
  }
  if (datos.titulo.length > 200) {
    return Resultado.fallo('El título no puede exceder 200 caracteres');
  }
  if (datos.descripcion && datos.descripcion.length > 500) {
    return Resultado.fallo('La descripción no puede exceder 500 caracteres');
  }
  if (datos.estado && !ESTADOS_VALIDOS.includes(datos.estado)) {
    return Resultado.fallo(`Estado inválido: ${datos.estado}`);
  }
  return Resultado.ok();
}

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    titulo: fila.titulo,
    descripcion: fila.descripcion || '',
    cuando: fila.cuando || '',
    estado: fila.estado || 'pendiente',
    creadoPor: fila.creadoPor,
    creadoEn: fila.$createdAt,
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
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar planes: ${e.message}`);
  }
}

export async function crear(datos) {
  const val = validarCrear(datos);
  if (!val.exito) return val;

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  try {
    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: generarId('plan'),
      data: {
        espacioId: ctx.datos.espacioId,
        titulo: datos.titulo.trim(),
        descripcion: (datos.descripcion || '').trim(),
        cuando: (datos.cuando || '').trim(),
        estado: datos.estado || 'pendiente',
        creadoPor: ctx.datos.usuarioId,
      },
    });
    const plan = normalizar(r);
    emitir('planes:creado', plan);
    log.info('Plan creado:', plan.id);
    return Resultado.ok(plan);
  } catch (e) {
    log.error('crear:', e.message);
    return Resultado.fallo(`Error al crear plan: ${e.message}`);
  }
}

export async function actualizar(id, cambios) {
  if (!id) return Resultado.fallo('Falta el id del plan');
  if (!cambios || typeof cambios !== 'object') {
    return Resultado.fallo('Los cambios deben ser un objeto');
  }
  if (cambios.titulo !== undefined && (!cambios.titulo || !cambios.titulo.trim())) {
    return Resultado.fallo('El título no puede quedar vacío');
  }
  if (cambios.estado !== undefined && !ESTADOS_VALIDOS.includes(cambios.estado)) {
    return Resultado.fallo(`Estado inválido: ${cambios.estado}`);
  }

  const data = {};
  if (cambios.titulo !== undefined) data.titulo = cambios.titulo.trim();
  if (cambios.descripcion !== undefined) data.descripcion = cambios.descripcion.trim();
  if (cambios.cuando !== undefined) data.cuando = cambios.cuando.trim();
  if (cambios.estado !== undefined) data.estado = cambios.estado;

  if (Object.keys(data).length === 0) {
    return Resultado.fallo('No hay cambios válidos para aplicar');
  }

  try {
    const r = await obtenerTablesDB().updateRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
      data,
    });
    const plan = normalizar(r);
    emitir('planes:actualizado', plan);
    log.info('Plan actualizado:', id);
    return Resultado.ok(plan);
  } catch (e) {
    log.error('actualizar:', e.message);
    return Resultado.fallo(`Error al actualizar plan: ${e.message}`);
  }
}

export async function cambiarEstado(id, estado) {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return Resultado.fallo(`Estado inválido: ${estado}`);
  }
  return actualizar(id, { estado });
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del plan');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('planes:eliminado', { id });
    log.info('Plan eliminado:', id);
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar plan: ${e.message}`);
  }
}