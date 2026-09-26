/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/planes.js
   Versión: 1.5.0
   Propósito: acceso a la tabla ahorasi_planes. La misma tabla
              almacena planes y ideas, distinguidos por el campo
              esIdea (boolean).
              v1.5.0: se agregan campos esIdea y categoria. listar()
                      ahora filtra por esIdea = false (planes
                      reales), para no romper la vista Planes que
                      espera solo planes. Se agrega listarIdeas()
                      para la sección de ideas. Se agrega
                      sumarAPlanes(id) que invierte esIdea de true
                      a false. crear() acepta esIdea y categoria.
              v1.4.0: crear() y actualizar() con idempotencia.
              v1.3.0: conIdempotencia opt-in (revertido).
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
const LARGO_MAX_CATEGORIA = 50;

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
  if (datos.categoria && datos.categoria.length > LARGO_MAX_CATEGORIA) {
    return Resultado.fallo(`La categoría no puede exceder ${LARGO_MAX_CATEGORIA} caracteres`);
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
    esIdea: !!fila.esIdea,
    categoria: fila.categoria || '',
    creadoPor: fila.creadoPor,
    creadoEn: fila.$createdAt,
    actualizadoEn: fila.$updatedAt,
  };
}

async function listarConFiltro(esIdea) {
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;
  try {
    const r = await obtenerTablesDB().listRows({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      queries: [
        Query.equal('espacioId', ctx.datos.espacioId),
        Query.equal('esIdea', esIdea),
        Query.orderDesc('$createdAt'),
        Query.limit(200),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar planes: ${e.message}`);
  }
}

/**
 * Lista planes reales (esIdea = false).
 * Cambio de comportamiento respecto a v1.4.0: antes listaba todo,
 * ahora filtra. Motivo: la tabla ahorasi_planes pasó a alojar
 * también ideas (esIdea = true), y la vista Planes debe seguir
 * mostrando solo planes.
 */
export async function listar() {
  return listarConFiltro(false);
}

export async function listarIdeas() {
  return listarConFiltro(true);
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
    esIdea: !!datos.esIdea,
    categoria: (datos.categoria || '').trim(),
    creadoPor: ctx.datos.usuarioId,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId(datos.esIdea ? 'idea' : 'plan'),
        data: payload,
      });
      const plan = normalizar(r);
      emitir('planes:creado', plan);
      log.info(datos.esIdea ? 'Idea creada:' : 'Plan creado:', plan.id);
      return Resultado.ok(plan);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear: ${e.message}`);
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
  if (cambios.categoria !== undefined && cambios.categoria.length > LARGO_MAX_CATEGORIA) {
    return Resultado.fallo(`La categoría no puede exceder ${LARGO_MAX_CATEGORIA} caracteres`);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.titulo !== undefined) data.titulo = cambios.titulo.trim();
  if (cambios.descripcion !== undefined) data.descripcion = cambios.descripcion.trim();
  if (cambios.cuando !== undefined) data.cuando = cambios.cuando.trim();
  if (cambios.estado !== undefined) data.estado = cambios.estado;
  if (cambios.esIdea !== undefined) data.esIdea = !!cambios.esIdea;
  if (cambios.categoria !== undefined) data.categoria = (cambios.categoria || '').trim();

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
        log.info('Actualizado:', id);
        return Resultado.ok(plan);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar: ${e.message}`);
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

/**
 * Convierte una idea en un plan: invierte esIdea de true a false.
 * La fila se mantiene; solo cambia de sección en la UI.
 */
export async function sumarAPlanes(id, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id de la idea');
  return actualizar(id, { esIdea: false }, opciones);
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
    log.info('Eliminado:', id);
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar: ${e.message}`);
  }
}