/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/recetas.js
   Versión: 1.0.0
   Propósito: acceso a ahorasi_recetas. Cada receta tiene título,
              categoría, ingredientes (JSON), pasos (JSON), nota
              y fotos (JSON de URLs). Los ingredientes pueden ser
              simples (texto libre) o sub-recetas (referencia por
              id a otra receta + cantidad + unidad).
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

const log = crearLogger('repo:recetas');
const TABLA = 'ahorasi_recetas';
const CATEGORIAS = ['Desayuno', 'Almuerzo', 'Cena', 'Postre', 'Snack', 'Bebida', 'Salsa'];
const LARGO_MAX_TITULO = 100;
const LARGO_MAX_NOTA = 500;
const LARGO_MAX_INGREDIENTE = 150;
const LARGO_MAX_PASO = 500;

/* ---------- Parseo defensivo de JSON ---------- */

function parsearIngredientes(crudo) {
  try {
    const arr = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    if (!Array.isArray(arr)) return [];
    return arr.map((i) => {
      if (!i || typeof i !== 'object') return null;
      if (i.tipo === 'simple') {
        return { tipo: 'simple', texto: String(i.texto || '').trim() };
      }
      if (i.tipo === 'sub') {
        return {
          tipo: 'sub',
          recetaId: String(i.recetaId || '').trim(),
          cantidad: Number(i.cantidad) || 0,
          unidad: String(i.unidad || '').trim(),
        };
      }
      return null;
    }).filter(Boolean);
  } catch (e) {
    log.warn('ingredientes no parseables:', e.message);
    return [];
  }
}

function parsearPasos(crudo) {
  try {
    const arr = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => String(p || '').trim()).filter(Boolean);
  } catch (e) {
    log.warn('pasos no parseables:', e.message);
    return [];
  }
}

function parsearFotos(crudo) {
  try {
    const arr = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    if (!Array.isArray(arr)) return [];
    return arr.map((f) => String(f || '').trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function normalizar(fila) {
  if (!fila) return null;
  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    titulo: fila.titulo,
    categoria: fila.categoria,
    ingredientes: parsearIngredientes(fila.ingredientes),
    pasos: parsearPasos(fila.pasos),
    nota: fila.nota || '',
    fotos: parsearFotos(fila.fotos),
    creadoPor: fila.creadoPor,
    creadoEn: fila.$createdAt,
  };
}

/* ---------- Validaciones ---------- */

function validarIngredientes(ingredientes) {
  if (!Array.isArray(ingredientes) || ingredientes.length === 0) {
    return 'La receta debe tener al menos un ingrediente';
  }
  for (let i = 0; i < ingredientes.length; i++) {
    const ing = ingredientes[i];
    if (ing.tipo === 'simple') {
      if (!ing.texto || !ing.texto.trim()) {
        return `Ingrediente ${i + 1}: falta el texto`;
      }
      if (ing.texto.length > LARGO_MAX_INGREDIENTE) {
        return `Ingrediente ${i + 1}: texto demasiado largo`;
      }
    } else if (ing.tipo === 'sub') {
      if (!ing.recetaId) return `Ingrediente ${i + 1}: falta la sub-receta`;
      if (typeof ing.cantidad !== 'number' || ing.cantidad <= 0) {
        return `Ingrediente ${i + 1}: cantidad inválida`;
      }
    } else {
      return `Ingrediente ${i + 1}: tipo inválido`;
    }
  }
  return null;
}

function validarPasos(pasos) {
  if (!Array.isArray(pasos) || pasos.length === 0) {
    return 'La receta debe tener al menos un paso';
  }
  for (let i = 0; i < pasos.length; i++) {
    if (!pasos[i] || !pasos[i].trim()) {
      return `Paso ${i + 1}: no puede estar vacío`;
    }
    if (pasos[i].length > LARGO_MAX_PASO) {
      return `Paso ${i + 1}: demasiado largo`;
    }
  }
  return null;
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
        Query.orderAsc('categoria'),
        Query.orderAsc('titulo'),
        Query.limit(300),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar recetas: ${e.message}`);
  }
}

export async function crear(datos, opciones = {}) {
  if (!datos?.titulo?.trim()) return Resultado.fallo('Falta el título');
  if (datos.titulo.length > LARGO_MAX_TITULO) {
    return Resultado.fallo('Título demasiado largo');
  }
  if (!CATEGORIAS.includes(datos.categoria)) {
    return Resultado.fallo(`Categoría inválida: ${datos.categoria}`);
  }
  if (datos.nota && datos.nota.length > LARGO_MAX_NOTA) {
    return Resultado.fallo('Nota demasiado larga');
  }

  const errIng = validarIngredientes(datos.ingredientes);
  if (errIng) return Resultado.fallo(errIng);

  const errPasos = validarPasos(datos.pasos);
  if (errPasos) return Resultado.fallo(errPasos);

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  // Limpiar ingredientes para guardar solo campos permitidos.
  const ingredientesLimpios = datos.ingredientes.map((i) => {
    if (i.tipo === 'simple') {
      return { tipo: 'simple', texto: i.texto.trim() };
    }
    return {
      tipo: 'sub',
      recetaId: i.recetaId,
      cantidad: Number(i.cantidad),
      unidad: String(i.unidad || '').trim(),
    };
  });

  const payload = {
    espacioId: ctx.datos.espacioId,
    titulo: datos.titulo.trim(),
    categoria: datos.categoria,
    ingredientes: JSON.stringify(ingredientesLimpios),
    pasos: JSON.stringify(datos.pasos.map((p) => p.trim())),
    nota: (datos.nota || '').trim(),
    fotos: JSON.stringify(Array.isArray(datos.fotos) ? datos.fotos : []),
    creadoPor: ctx.datos.usuarioId,
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('receta'),
        data: payload,
      });
      const receta = normalizar(r);
      emitir('recetas:creado', receta);
      return Resultado.ok(receta);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear receta: ${e.message}`);
    }
  });
}

export async function actualizar(id, cambios, opciones = {}) {
  if (!id) return Resultado.fallo('Falta el id de la receta');
  if (!cambios || typeof cambios !== 'object') {
    return Resultado.fallo('Los cambios deben ser un objeto');
  }
  if (cambios.titulo !== undefined) {
    if (!cambios.titulo.trim()) return Resultado.fallo('El título no puede quedar vacío');
    if (cambios.titulo.length > LARGO_MAX_TITULO) return Resultado.fallo('Título demasiado largo');
  }
  if (cambios.categoria !== undefined && !CATEGORIAS.includes(cambios.categoria)) {
    return Resultado.fallo(`Categoría inválida: ${cambios.categoria}`);
  }
  if (cambios.nota !== undefined && cambios.nota.length > LARGO_MAX_NOTA) {
    return Resultado.fallo('Nota demasiado larga');
  }
  if (cambios.ingredientes !== undefined) {
    const errIng = validarIngredientes(cambios.ingredientes);
    if (errIng) return Resultado.fallo(errIng);
  }
  if (cambios.pasos !== undefined) {
    const errPasos = validarPasos(cambios.pasos);
    if (errPasos) return Resultado.fallo(errPasos);
  }

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const data = {};
  if (cambios.titulo !== undefined) data.titulo = cambios.titulo.trim();
  if (cambios.categoria !== undefined) data.categoria = cambios.categoria;
  if (cambios.nota !== undefined) data.nota = (cambios.nota || '').trim();
  if (cambios.ingredientes !== undefined) {
    data.ingredientes = JSON.stringify(cambios.ingredientes.map((i) => {
      if (i.tipo === 'simple') {
        return { tipo: 'simple', texto: i.texto.trim() };
      }
      return {
        tipo: 'sub',
        recetaId: i.recetaId,
        cantidad: Number(i.cantidad),
        unidad: String(i.unidad || '').trim(),
      };
    }));
  }
  if (cambios.pasos !== undefined) {
    data.pasos = JSON.stringify(cambios.pasos.map((p) => p.trim()));
  }
  if (cambios.fotos !== undefined) {
    data.fotos = JSON.stringify(Array.isArray(cambios.fotos) ? cambios.fotos : []);
  }

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
        const receta = normalizar(r);
        emitir('recetas:actualizado', receta);
        return Resultado.ok(receta);
      } catch (e) {
        log.error('actualizar:', e.message);
        return Resultado.fallo(`Error al actualizar receta: ${e.message}`);
      }
    }
  );
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id de la receta');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('recetas:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar receta: ${e.message}`);
  }
}

export { CATEGORIAS };