/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/respuestas.js
   Versión: 1.4.0
   Propósito: acceso a ahorasi_respuestas.
              v1.4.0: se agrega actualizar(id, cambios). Cada
                      usuario tiene como máximo una respuesta
                      vigente. Cambiar de opinión ya no acumula
                      filas: la vista Carta usa actualizar() en
                      vez de crear() cuando ya existe una
                      respuesta propia. Se emite el evento
                      'respuestas:actualizada' al modificar. La
                      fecha enviadoEn se refresca al actualizar
                      para que el historial muestre la fecha
                      del último cambio, no la original.
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

const log = crearLogger('repo:respuestas');
const TABLA = 'ahorasi_respuestas';
const ELECCIONES = ['paso_a_paso', 'hablar', 'tiempo'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    eleccion: fila.eleccion,
    nota: fila.nota || '',
    enviadoPor: fila.enviadoPor,
    enviadoEn: fila.enviadoEn || fila.$createdAt,
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
        Query.orderDesc('enviadoEn'),
        Query.limit(100),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar respuestas: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!ELECCIONES.includes(datos?.eleccion)) {
    return Resultado.fallo(`Elección inválida: ${datos?.eleccion}`);
  }
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    eleccion: datos.eleccion,
    nota: (datos.nota || '').trim(),
    enviadoPor: ctx.datos.usuarioId,
    enviadoEn: new Date().toISOString(),
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('resp'),
        data: payload,
      });
      const respuesta = normalizar(r);
      emitir('respuestas:creada', respuesta);
      return Resultado.ok(respuesta);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al registrar respuesta: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id de la respuesta');
  if (!cambios || typeof cambios !== 'object') {
    return Resultado.fallo('Cambios inválidos');
  }
  if (cambios.eleccion !== undefined && !ELECCIONES.includes(cambios.eleccion)) {
    return Resultado.fallo(`Elección inválida: ${cambios.eleccion}`);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.eleccion !== undefined) data.eleccion = cambios.eleccion;
  if (cambios.nota !== undefined) data.nota = (cambios.nota || '').trim();

  if (Object.keys(data).length === 0) {
    return Resultado.fallo('Sin cambios válidos');
  }

  // Al actualizar la respuesta, se refresca la fecha de envío.
  // Así el historial muestra la fecha del último cambio, no la
  // original.
  data.enviadoEn = new Date().toISOString();

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
        const respuesta = normalizar(r);
        emitir('respuestas:actualizada', respuesta);
        return Resultado.ok(respuesta);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar respuesta: ${e.message}`);
      }
    }
  );
}