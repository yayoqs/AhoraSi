/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/carta.js
   Versión: 1.2.0
   Propósito: acceso a ahorasi_carta.
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

const log = crearLogger('repo:carta');
const TABLA = 'ahorasi_carta';
const TIPOS = ['base', 'anexo'];

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    tipo: fila.tipo,
    titulo: fila.titulo,
    contenido: fila.contenido,
    autor: fila.autor,
    orden: fila.orden || 0,
    creadoEn: fila.creadoEn || fila.$createdAt,
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
        Query.orderAsc('orden'),
        Query.orderAsc('$createdAt'),
        Query.limit(200),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar carta: ${e.message}`);
  }
}

export async function listarBase() {
  const r = await listar();
  if (!r.exito) return r;
  return Resultado.ok(r.datos.filter((p) => p.tipo === 'base'));
}

export async function listarAnexos() {
  const r = await listar();
  if (!r.exito) return r;
  return Resultado.ok(r.datos.filter((p) => p.tipo === 'anexo'));
}

export async function crear(datos) {
  if (!datos?.titulo?.trim()) return Resultado.fallo('Falta título');
  if (!datos?.contenido?.trim()) return Resultado.fallo('Falta contenido');
  if (!TIPOS.includes(datos.tipo)) return Resultado.fallo(`Tipo inválido: ${datos.tipo}`);
  if (datos.titulo.length > 200) return Resultado.fallo('Título demasiado largo');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  try {
    const r = await obtenerTablesDB().createRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: generarId('carta'),
      data: {
        espacioId: ctx.datos.espacioId,
        tipo: datos.tipo,
        titulo: datos.titulo.trim(),
        contenido: datos.contenido.trim(),
        autor: ctx.datos.usuarioId,
        orden: typeof datos.orden === 'number' ? datos.orden : 0,
        creadoEn: new Date().toISOString(),
      },
    });
    const pieza = normalizar(r);
    emitir('carta:creado', pieza);
    return Resultado.ok(pieza);
  } catch (e) {
    log.error('crear:', e.message);
    return Resultado.fallo(`Error al crear pieza de carta: ${e.message}`);
  }
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id de la pieza');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('carta:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar pieza: ${e.message}`);
  }
}