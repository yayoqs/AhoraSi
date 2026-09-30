/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/apuestas.js
   Versión: 1.0.1
   Propósito: acceso a ahorasi_apuestas. Cada apuesta tiene texto,
              quien (apostador), contra (el otro), estado
              (pendiente, resuelta) y ganador opcional (yayo,
              luci, empate).
              v1.0.1: se arregla la resolución del contrincante.
                      El ternario anterior dejaba `contra` en null
                      cuando quien coincidía con el usuario actual,
                      lo que hacía fallar la creación siempre con
                      "Falta el contrincante". Ahora se usa un mapa
                      fijo de contrincantes porque el espacio tiene
                      dos usuarios (yayo ↔ luci). Si algún día se
                      agrega un tercer usuario, el mapa no lo cubre
                      y el guard avisa.
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
import { CONFIG } from '../../config/config.js';
import {
  obtenerContexto,
  conIdempotenciaParaCrear,
  conIdempotenciaParaActualizar,
} from './_contexto.js';

const log = crearLogger('repo:apuestas');
const TABLA = 'ahorasi_apuestas';
const ESTADOS = ['pendiente', 'resuelta'];
const GANADORES_VALIDOS = ['yayo', 'luci', 'empate'];

/**
 * Mapa fijo de contrincantes. Como el espacio tiene exactamente
 * dos usuarios, el "otro" de cada uno es siempre el mismo. Si
 * algún día se agrega un tercer usuario, este mapa se queda
 * corto y el guard de crear() lo avisa con "Falta el contrincante".
 */
const CONTRINCANTES = {
  [CONFIG.usuarios.yayo]: CONFIG.usuarios.luci,
  [CONFIG.usuarios.luci]: CONFIG.usuarios.yayo,
};

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

  // El contrincante es el otro usuario. Si el llamador pasa
  // "contra" explícito, se respeta; si no, se resuelve por el
  // mapa fijo (dos usuarios). Si el mapa no cubre a `quien`, el
  // guard corta y devuelve el error.
  const contra = datos.contra || CONTRINCANTES[datos.quien];
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
  if (!GANADORES_VALIDOS.includes(ganador)) {
    return Resultado.fallo(`Ganador inválido: ${ganador}`);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

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