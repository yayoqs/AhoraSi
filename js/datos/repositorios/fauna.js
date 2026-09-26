/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/fauna.js
   Versión: 1.5.0
   Propósito: acceso a ahorasi_fauna.
              v1.5.0: se agregan tres campos opcionales:
                      nombrePropio (nombre del animal si tiene),
                      perteneceA (relación: silvestre, doméstico,
                      de alguien), notas (texto libre). Se incluyen
                      en normalizar(), crear() y actualizar().
              v1.4.0: actualizar(id, cambios) con idempotencia.
              v1.3.0: crear() con idempotencia automática.
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

const log = crearLogger('repo:fauna');
const TABLA = 'ahorasi_fauna';
const TIPOS = ['ave', 'mamifero', 'reptil', 'anfibio', 'pez', 'insecto', 'otro'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    nombre: fila.nombre,
    nombrePropio: fila.nombrePropio || '',
    tipo: fila.tipo || 'otro',
    perteneceA: fila.perteneceA || '',
    lugar: fila.lugar || '',
    fecha: fila.fecha || null,
    notas: fila.notas || '',
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
        Query.limit(200),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar fauna: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!datos?.nombre?.trim()) return Resultado.fallo('Falta nombre');
  if (datos.nombre.length > 100) return Resultado.fallo('Nombre demasiado largo');
  if (datos.tipo && !TIPOS.includes(datos.tipo)) {
    return Resultado.fallo(`Tipo inválido: ${datos.tipo}`);
  }
  if (datos.nombrePropio && datos.nombrePropio.length > 100) {
    return Resultado.fallo('Nombre propio demasiado largo');
  }
  if (datos.perteneceA && datos.perteneceA.length > 100) {
    return Resultado.fallo('El campo "pertenece a" es demasiado largo');
  }
  if (datos.notas && datos.notas.length > 500) {
    return Resultado.fallo('Notas demasiado largas');
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    nombre: datos.nombre.trim(),
    nombrePropio: (datos.nombrePropio || '').trim(),
    tipo: datos.tipo || 'otro',
    perteneceA: (datos.perteneceA || '').trim(),
    lugar: (datos.lugar || '').trim(),
    fecha: datos.fecha || null,
    notas: (datos.notas || '').trim(),
    registradoPor: ctx.datos.usuarioId,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('fauna'),
        data: payload,
      });
      const reg = normalizar(r);
      emitir('fauna:creado', reg);
      return Resultado.ok(reg);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al registrar fauna: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id del registro');
  if (!cambios || typeof cambios !== 'object') {
    return Resultado.fallo('Los cambios deben ser un objeto');
  }
  if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
    return Resultado.fallo('El nombre no puede quedar vacío');
  }
  if (cambios.nombre !== undefined && cambios.nombre.length > 100) {
    return Resultado.fallo('Nombre demasiado largo');
  }
  if (cambios.tipo !== undefined && !TIPOS.includes(cambios.tipo)) {
    return Resultado.fallo(`Tipo inválido: ${cambios.tipo}`);
  }
  if (cambios.nombrePropio !== undefined && cambios.nombrePropio.length > 100) {
    return Resultado.fallo('Nombre propio demasiado largo');
  }
  if (cambios.perteneceA !== undefined && cambios.perteneceA.length > 100) {
    return Resultado.fallo('El campo "pertenece a" es demasiado largo');
  }
  if (cambios.notas !== undefined && cambios.notas.length > 500) {
    return Resultado.fallo('Notas demasiado largas');
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.nombre !== undefined) data.nombre = cambios.nombre.trim();
  if (cambios.nombrePropio !== undefined) data.nombrePropio = (cambios.nombrePropio || '').trim();
  if (cambios.tipo !== undefined) data.tipo = cambios.tipo;
  if (cambios.perteneceA !== undefined) data.perteneceA = (cambios.perteneceA || '').trim();
  if (cambios.lugar !== undefined) data.lugar = (cambios.lugar || '').trim();
  if (cambios.fecha !== undefined) data.fecha = cambios.fecha || null;
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
        const reg = normalizar(r);
        emitir('fauna:actualizado', reg);
        return Resultado.ok(reg);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar registro: ${e.message}`);
      }
    }
  );
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del registro');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('fauna:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar registro: ${e.message}`);
  }
}