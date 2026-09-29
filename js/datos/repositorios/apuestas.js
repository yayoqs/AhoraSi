/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/apuestas.js
   Versión: 1.1.0
   Propósito: acceso a ahorasi_apuestas. Cada apuesta tiene texto,
              quien (apostador), contra (el otro), estado
              (pendiente, resuelta) y ganador opcional (userId
              de quien ganó, o la palabra "empate").
              v1.1.0: fix en resolver(). Antes validaba el ganador
                      contra una lista hardcodeada ['yayo', 'luci',
                      'empate'], pero el resto del repositorio
                      guarda los userIds reales de Appwrite
                      (Elyayo, ChicaLuci). Cualquier intento de
                      resolver una apuesta fallaba con "Ganador
                      inválido". Ahora se cargan los contendientes
                      reales de la fila y se valida contra ellos,
                      más "empate". Se elimina la constante
                      GANADORES_VALIDOS, que ya no tiene uso. Sin
                      cambios en las firmas públicas.
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

const log = crearLogger('repo:apuestas');
const TABLA = 'ahorasi_apuestas';
const ESTADOS = ['pendiente', 'resuelta'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    texto: fila.texto,
    quien: fila.quien,
    contra: fila.contra,
    estado: fila.estado || 'pendiente',
    ganador: fila.ganador || null,
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
    return Resultado.fallo(`Error al listar apuestas: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!datos?.texto?.trim()) return Resultado.fallo('Falta el texto de la apuesta');
  if (datos.texto.length > 300) return Resultado.fallo('Apuesta demasiado larga');
  if (!datos.quien) return Resultado.fallo('Falta quién apuesta');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  // Si "quien" es el usuario actual, "contra" es el otro. Si el
  // llamador no pasa "contra", se resuelve comparando con el
  // usuario del contexto.
  const contra = datos.contra
    || (datos.quien === ctx.datos.usuarioId ? null : ctx.datos.usuarioId);
  if (!contra) return Resultado.fallo('Falta el contrincante');

  const payload = {
    espacioId: ctx.datos.espacioId,
    texto: datos.texto.trim(),
    quien: datos.quien,
    contra,
    estado: 'pendiente',
    ganador: null,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('apuesta'),
        data: payload,
      });
      const item = normalizar(r);
      emitir('apuestas:creado', item);
      return Resultado.ok(item);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear apuesta: ${e.message}`);
    }
  });
}

export async function resolver(id, ganador, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id');
  if (!ganador) return Resultado.fallo('Falta el ganador');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  // Cargar la fila para saber quiénes son los contendientes reales.
  // Validamos contra esos userIds (más "empate"), no contra una
  // lista hardcodeada.
  let fila;
  try {
    fila = await obtenerTablesDB().getRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
  } catch (e) {
    log.error('resolver (cargar):', e.message);
    return Resultado.fallo(`Error al cargar la apuesta: ${e.message}`);
  }

  const validos = [fila.quien, fila.contra, 'empate'];
  if (!validos.includes(ganador)) {
    return Resultado.fallo(`Ganador inválido: ${ganador}`);
  }

  const data = { estado: 'resuelta', ganador };

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
        emitir('apuestas:actualizado', item);
        return Resultado.ok(item);
      } catch (e) {
        log.error('resolver:', e.message);
        return Resultado.fallo(`Error al resolver apuesta: ${e.message}`);
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
    emitir('apuestas:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar apuesta: ${e.message}`);
  }
}