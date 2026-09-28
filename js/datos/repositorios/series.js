/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/series.js
   Versión: 1.0.0
   Propósito: acceso a ahorasi_series. Series y películas con
              puntuación (1-10), estado, carátula, link externo,
              y seguimiento de capítulos para series. El campo
              posicion es un entero para el ranking manual en
              vista compacta, independiente de la puntuación.
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

const log = crearLogger('repo:series');
const TABLA = 'ahorasi_series';
const TIPOS = ['serie', 'pelicula'];
const ESTADOS = ['pendiente', 'viendo', 'vista', 'abandonada'];
const LIMITE = 500;

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    titulo: fila.titulo,
    tipo: fila.tipo || 'serie',
    estado: fila.estado || 'pendiente',
    puntuacion: fila.puntuacion != null ? Number(fila.puntuacion) : null,
    posicion: fila.posicion != null ? Number(fila.posicion) : null,
    temporadaActual: fila.temporadaActual != null ? Number(fila.temporadaActual) : null,
    capituloActual: fila.capituloActual != null ? Number(fila.capituloActual) : null,
    totalTemporadas: fila.totalTemporadas != null ? Number(fila.totalTemporadas) : null,
    totalCapitulosTemporada: fila.totalCapitulosTemporada != null ? Number(fila.totalCapitulosTemporada) : null,
    nota: fila.nota || '',
    donde: fila.donde || '',
    recomendadaPor: fila.recomendadaPor || '',
    caratula: fila.caratula || '',
    link: fila.link || '',
    creadoPor: fila.creadoPor,
    creadoEn: fila.$createdAt,
  };
}

function validar(datos, esCrear = true) {
  if (esCrear && !datos?.titulo?.trim()) return Resultado.fallo('Falta título');
  if (datos.titulo !== undefined && !datos.titulo.trim()) {
    return Resultado.fallo('El título no puede quedar vacío');
  }
  if (datos.titulo !== undefined && datos.titulo.length > 200) {
    return Resultado.fallo('Título demasiado largo');
  }
  if (datos.tipo !== undefined && !TIPOS.includes(datos.tipo)) {
    return Resultado.fallo(`Tipo inválido: ${datos.tipo}`);
  }
  if (datos.estado !== undefined && !ESTADOS.includes(datos.estado)) {
    return Resultado.fallo(`Estado inválido: ${datos.estado}`);
  }
  if (datos.puntuacion != null) {
    const p = Number(datos.puntuacion);
    if (!Number.isInteger(p) || p < 1 || p > 10) {
      return Resultado.fallo('La puntuación debe ser un entero entre 1 y 10');
    }
  }
  return Resultado.ok();
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
        Query.orderAsc('posicion'),
        Query.orderDesc('$createdAt'),
        Query.limit(LIMITE),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar series: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  const val = validar(datos, true);
  if (!val.exito) return val;

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    titulo: datos.titulo.trim(),
    tipo: datos.tipo || 'serie',
    estado: datos.estado || 'pendiente',
    puntuacion: datos.puntuacion != null ? Number(datos.puntuacion) : null,
    posicion: datos.posicion != null ? Number(datos.posicion) : null,
    temporadaActual: datos.temporadaActual != null ? Number(datos.temporadaActual) : null,
    capituloActual: datos.capituloActual != null ? Number(datos.capituloActual) : null,
    totalTemporadas: datos.totalTemporadas != null ? Number(datos.totalTemporadas) : null,
    totalCapitulosTemporada: datos.totalCapitulosTemporada != null ? Number(datos.totalCapitulosTemporada) : null,
    nota: (datos.nota || '').trim(),
    donde: (datos.donde || '').trim(),
    recomendadaPor: (datos.recomendadaPor || '').trim(),
    caratula: (datos.caratula || '').trim(),
    link: (datos.link || '').trim(),
    creadoPor: ctx.datos.usuarioId,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('serie'),
        data: payload,
      });
      const item = normalizar(r);
      emitir('series:creado', item);
      return Resultado.ok(item);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id');
  if (!cambios || typeof cambios !== 'object') {
    return Resultado.fallo('Los cambios deben ser un objeto');
  }

  const val = validar(cambios, false);
  if (!val.exito) return val;

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.titulo !== undefined) data.titulo = cambios.titulo.trim();
  if (cambios.tipo !== undefined) data.tipo = cambios.tipo;
  if (cambios.estado !== undefined) data.estado = cambios.estado;
  if (cambios.puntuacion !== undefined) {
    data.puntuacion = cambios.puntuacion != null ? Number(cambios.puntuacion) : null;
  }
  if (cambios.posicion !== undefined) {
    data.posicion = cambios.posicion != null ? Number(cambios.posicion) : null;
  }
  if (cambios.temporadaActual !== undefined) {
    data.temporadaActual = cambios.temporadaActual != null ? Number(cambios.temporadaActual) : null;
  }
  if (cambios.capituloActual !== undefined) {
    data.capituloActual = cambios.capituloActual != null ? Number(cambios.capituloActual) : null;
  }
  if (cambios.totalTemporadas !== undefined) {
    data.totalTemporadas = cambios.totalTemporadas != null ? Number(cambios.totalTemporadas) : null;
  }
  if (cambios.totalCapitulosTemporada !== undefined) {
    data.totalCapitulosTemporada = cambios.totalCapitulosTemporada != null ? Number(cambios.totalCapitulosTemporada) : null;
  }
  if (cambios.nota !== undefined) data.nota = (cambios.nota || '').trim();
  if (cambios.donde !== undefined) data.donde = (cambios.donde || '').trim();
  if (cambios.recomendadaPor !== undefined) data.recomendadaPor = (cambios.recomendadaPor || '').trim();
  if (cambios.caratula !== undefined) data.caratula = (cambios.caratula || '').trim();
  if (cambios.link !== undefined) data.link = (cambios.link || '').trim();

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
        emitir('series:actualizado', item);
        return Resultado.ok(item);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar: ${e.message}`);
      }
    }
  );
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('series:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar: ${e.message}`);
  }
}

/**
 * Guarda un nuevo orden de posiciones. Recibe un array de ids en
 * el orden deseado y actualiza posicion de cada uno.
 */
export async function reordenar(idsEnOrden, opciones = {}) {
  if (!Array.isArray(idsEnOrden) || idsEnOrden.length === 0) {
    return Resultado.fallo('Falta el orden');
  }
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const resultados = [];
  for (let i = 0; i < idsEnOrden.length; i++) {
    const id = idsEnOrden[i];
    const r = await actualizar(id, { posicion: i + 1 }, opciones);
    resultados.push(r);
    if (!r.exito) return r;
  }
  emitir('series:reordenado', { ids: idsEnOrden });
  return Resultado.ok({ cantidad: idsEnOrden.length });
}