/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/flora.js
   Versión: 1.2.0
   Propósito: acceso a ahorasi_flora.
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

const log = crearLogger('repo:flora');
const TABLA = 'ahorasi_flora';
const TIPOS = ['arbol', 'arbusto', 'hierba', 'flor', 'helecho', 'musgo', 'hongo', 'otro'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    nombre: fila.nombre,
    tipo: fila.tipo || 'otro',
    lugar: fila.lugar || '',
    fecha: fila.fecha || null,
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
    return Resultado.fallo(`Error al listar flora: ${e.message}`);
  }
}

export async function crear(datos) {
  if (!datos?.nombre?.trim()) return Resultado.fallo('Falta nombre');
  if (datos.nombre.length > 100) return Resultado.fallo('Nombre demasiado largo');
  if (datos.tipo && !TIPOS.includes(datos.tipo)) {
    return Resultado.fallo(`Tipo inválido: ${datos.tipo}`);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  try {
    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: generarId('flora'),
      data: {
        espacioId: ctx.datos.espacioId,
        nombre: datos.nombre.trim(),
        tipo: datos.tipo || 'otro',
        lugar: (datos.lugar || '').trim(),
        fecha: datos.fecha || null,
        registradoPor: ctx.datos.usuarioId,
      },
    });
    const reg = normalizar(r);
    emitir('flora:creado', reg);
    return Resultado.ok(reg);
  } catch (e) {
    log.error('crear:', e.message);
    return Resultado.fallo(`Error al registrar flora: ${e.message}`);
  }
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del registro');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('flora:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar registro: ${e.message}`);
  }
}