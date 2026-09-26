/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/planes.js
   Versión: 1.4.0
   Propósito: acceso a la tabla ahorasi_planes.
              v1.4.0: crear() y actualizar() usan idempotencia
                      automática. Un doble clic o un retry rápido
                      con los mismos datos no duplica la fila.
              v1.3.0: conIdempotencia opt-in (revertido, era más
                      simple hacerlo automático).
              v1.2.0: usa _contexto.js.
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

export async function crear(datos, opciones = {}) {
  const val = validarCrear(datos);
  if (!val.exito) return val;

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    titulo: datos.titulo.trim(),
    descripcion: (datos.descripcion || '').trim(),
    cuando: (datos.cuando || '').trim(),
    estado: datos.estado || 'pendiente',
    creadoPor: ctx.datos.usuarioId,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('plan'),
        data: payload,
      });
      const plan = normalizar(r);
      emitir('planes:creado', plan);
      log.info('Plan creado:', plan.id);
      return Resultado.ok(plan);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear plan: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
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

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.titulo !== undefined) data.titulo = cambios.titulo.trim();
  if (cambios.descripcion !== undefined) data.descripcion = cambios.descripcion.trim();
  if (cambios.cuando !== undefined) data.cuando = cambios.cuando.trim();
  if (cambios.estado !== undefined) data.estado = cambios.estado;

  if (Object.keys(data).length === 0) {
    return Resultado.fallo('No hay cambios válidos para aplicar');
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
        const plan = normalizar(r);
        emitir('planes:actualizado', plan);
        log.info('Plan actualizado:', id);
        return Resultado.ok(plan);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar plan: ${e.message}`);
      }
    }
  );
}

export async function cambiarEstado(id, estado, opciones = {}) {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return Resultado.fallo(`Estado inválido: ${estado}`);
  }
  return actualizar(id, { estado }, opciones);
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