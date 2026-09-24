/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/respuestas.js
   Versión: 1.2.0
   Propósito: acceso a ahorasi_respuestas.
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
import { obtenerContexto } from './_contexto.js';

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

export async function crear(datos) {
  if (!ELECCIONES.includes(datos?.eleccion)) {
    return Resultado.fallo(`Elección inválida: ${datos?.eleccion}`);
  }
  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  try {
    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: generarId('resp'),
      data: {
        espacioId: ctx.datos.espacioId,
        eleccion: datos.eleccion,
        nota: (datos.nota || '').trim(),
        enviadoPor: ctx.datos.usuarioId,
        enviadoEn: new Date().toISOString(),
      },
    });
    const respuesta = normalizar(r);
    emitir('respuestas:creada', respuesta);
    return Resultado.ok(respuesta);
  } catch (e) {
    log.error('crear:', e.message);
    return Resultado.fallo(`Error al registrar respuesta: ${e.message}`);
  }
}