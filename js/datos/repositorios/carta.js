/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/carta.js
   Versión: 1.4.1
   Propósito: acceso a ahorasi_carta.
              v1.4.1: se corrige el encabezado. La v1.4.0 anunciaba
                      una función guardarFirma() que nunca se
                      implementó. La vista Carta resuelve la firma
                      con repoCarta.crear({ tipo: 'firma', ... })
                      y repoCarta.actualizar() directamente, así que
                      no hace falta ningún wrapper. Se elimina la
                      mención del encabezado. Sin cambios en el
                      cuerpo del módulo.
              v1.4.0: se amplían los tipos a cinco: base, anexo,
                      compromiso, compromiso_compartido y firma.
                      Se agrega actualizar(id, cambios) para
                      editar piezas existentes. Emite
                      'carta:actualizado' al editar.
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

const log = crearLogger('repo:carta');
const TABLA = 'ahorasi_carta';
const TIPOS = ['base', 'anexo', 'compromiso', 'compromiso_compartido', 'firma'];

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

export async function crear(datos, opciones = {}) {
  if (!datos?.titulo?.trim()) return Resultado.fallo('Falta título');
  if (!datos?.contenido?.trim()) return Resultado.fallo('Falta contenido');
  if (!TIPOS.includes(datos.tipo)) return Resultado.fallo(`Tipo inválido: ${datos.tipo}`);
  if (datos.titulo.length > 200) return Resultado.fallo('Título demasiado largo');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    tipo: datos.tipo,
    titulo: datos.titulo.trim(),
    contenido: datos.contenido.trim(),
    autor: ctx.datos.usuarioId,
    orden: typeof datos.orden === 'number' ? datos.orden : 0,
    creadoEn: new Date().toISOString(),
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('carta'),
        data: payload,
      });
      const pieza = normalizar(r);
      emitir('carta:creado', pieza);
      return Resultado.ok(pieza);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear pieza de carta: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id de la pieza');
  if (!cambios || typeof cambios !== 'object') return Resultado.fallo('Cambios inválidos');

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.titulo !== undefined) {
    if (cambios.titulo.length > 200) return Resultado.fallo('Título demasiado largo');
    data.titulo = cambios.titulo.trim();
  }
  if (cambios.contenido !== undefined) {
    if (!cambios.contenido.trim()) return Resultado.fallo('El contenido no puede quedar vacío');
    data.contenido = cambios.contenido.trim();
  }
  if (cambios.orden !== undefined) data.orden = cambios.orden;

  if (Object.keys(data).length === 0) return Resultado.fallo('Sin cambios válidos');

  return conIdempotenciaParaActualizar(TABLA, ctx.datos.usuarioId, id, data, opciones, async () => {
    try {
      const r = await obtenerTablesDB().updateRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: id,
        data,
      });
      const pieza = normalizar(r);
      emitir('carta:actualizado', pieza);
      return Resultado.ok(pieza);
    } catch (e) {
      log.error('actualizar:', e.message);
      return Resultado.fallo(`Error al actualizar pieza: ${e.message}`);
    }
  });
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