/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/ritmos.js
   Versión: 1.6.0
   Propósito: acceso a ahorasi_ritmos. Cada ritmo guarda nombre,
              bpm, patrón, modo (simple o extendido) y ahora
              también el estado de mezcla y efectos del secuenciador.
              v1.6.0: se agregan cinco campos opcionales para no
                      perder el estado del instrumento al guardar:
                      efectos (objeto JSON), volumen (array JSON
                      0-1), silenciados (array JSON de bool),
                      solistas (array JSON de bool), swing (entero
                      0-50). Antes solo se guardaban patrón y BPM,
                      así que al recargar un ritmo se perdía la
                      mezcla y los efectos. Sin cambios en las
                      firmas públicas: crear() sigue recibiendo
                      un objeto de datos y opciones.
              v1.5.0: se agrega el campo modo.
              v1.4.0: estiloId y familia.
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
} from './_contexto.js';

const log = crearLogger('repo:ritmos');
const TABLA = 'ahorasi_ritmos';

const MODOS = ['simple', 'extendido'];
const FILAS_EXT = 7;
const PASOS_EXT = 16;
const FILAS_SIM = 4;
const PASOS_SIM = 8;

/* ---------- Parseo defensivo de JSON ---------- */

function parsearEfectos(crudo) {
  if (crudo == null || crudo === '') return null;
  try {
    const obj = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    return {
      reverb: Number(obj.reverb) || 0,
      eco: Number(obj.eco) || 0,
      saturacion: Number(obj.saturacion) || 0,
      filtro: obj.filtro != null ? Number(obj.filtro) : 100,
    };
  } catch (e) {
    log.warn('efectos no parseables:', e.message);
    return null;
  }
}

function parsearVolumen(crudo) {
  if (crudo == null || crudo === '') return null;
  try {
    const arr = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    if (!Array.isArray(arr)) return null;
    return arr.map((v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 1;
      return Math.max(0, Math.min(1, n));
    });
  } catch (e) {
    log.warn('volumen no parseable:', e.message);
    return null;
  }
}

function parsearBooleanos(crudo) {
  if (crudo == null || crudo === '') return null;
  try {
    const arr = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    if (!Array.isArray(arr)) return null;
    return arr.map((v) => !!v);
  } catch (e) {
    return null;
  }
}

function normalizar(fila) {
  if (!fila) return null;

  const modo = fila.modo || 'extendido';
  let patron = [];
  try {
    const crudo = typeof fila.patron === 'string' ? JSON.parse(fila.patron) : (fila.patron || []);
    patron = modo === 'simple'
      ? normalizarPatronSimple(crudo)
      : normalizarPatronExtendido(crudo);
  } catch (e) {
    log.warn('patron no parseable en', fila.$id);
    patron = [];
  }

  return {
    id: fila.$id,
    espacioId: fila.espacioId,
    nombre: fila.nombre,
    bpm: fila.bpm,
    patron,
    modo,
    estiloId: fila.estiloId || '',
    familia: fila.familia || '',
    efectos: parsearEfectos(fila.efectos),
    volumen: parsearVolumen(fila.volumen),
    silenciados: parsearBooleanos(fila.silenciados),
    solistas: parsearBooleanos(fila.solistas),
    swing: fila.swing != null ? Number(fila.swing) : 0,
    creadoPor: fila.creadoPor,
    creadoEn: fila.creadoEn || fila.$createdAt,
  };
}

function normalizarPatronSimple(crudo) {
  if (!Array.isArray(crudo) || crudo.length !== FILAS_SIM) return [];
  const filas = [];
  for (let i = 0; i < FILAS_SIM; i++) {
    const fila = crudo[i];
    if (!fila || typeof fila !== 'object') return [];
    const sonidoId = String(fila.sonidoId || '').trim();
    const pasos = Array.isArray(fila.pasos) ? fila.pasos : null;
    if (!pasos || pasos.length !== PASOS_SIM) return [];
    const limpio = pasos.map((v) => {
      const n = Number(v) || 0;
      if (n < 0 || n > 3) return 0;
      return n;
    });
    filas.push({ sonidoId, pasos: limpio });
  }
  return filas;
}

function normalizarPatronExtendido(crudo) {
  if (!Array.isArray(crudo) || crudo.length !== FILAS_EXT) return [];
  const filas = [];
  for (let i = 0; i < FILAS_EXT; i++) {
    const fila = crudo[i];
    if (!Array.isArray(fila) || fila.length !== PASOS_EXT) return [];
    if (i < 5) {
      filas.push(fila.map((v) => {
        const n = Number(v) || 0;
        if (n < 0 || n > 3) return 0;
        return n;
      }));
    } else {
      filas.push(fila.map((v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return -1;
        if (n < -1 || n > 11) return -1;
        return Math.round(n);
      }));
    }
  }
  return filas;
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
        Query.limit(100),
      ],
    });
    return Resultado.ok(r.rows.map(normalizar));
  } catch (e) {
    log.error('listar:', e.message);
    return Resultado.fallo(`Error al listar ritmos: ${e.message}`);
  }
}

/* ---------- Validaciones ---------- */

function validarPatronSimple(patron) {
  if (!Array.isArray(patron) || patron.length !== FILAS_SIM) {
    return `Patrón simple inválido: se esperaban ${FILAS_SIM} filas`;
  }
  for (let i = 0; i < FILAS_SIM; i++) {
    const f = patron[i];
    if (!f || typeof f !== 'object') return `Fila ${i} inválida`;
    if (!f.sonidoId || typeof f.sonidoId !== 'string') {
      return `Fila ${i} sin sonidoId`;
    }
    if (!Array.isArray(f.pasos) || f.pasos.length !== PASOS_SIM) {
      return `Fila ${i} inválida: se esperaban ${PASOS_SIM} pasos`;
    }
    for (const v of f.pasos) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 3) {
        return `Fila ${i} inválida: los valores deben ser 0-3`;
      }
    }
  }
  return null;
}

function validarPatronExtendido(patron) {
  if (!Array.isArray(patron) || patron.length !== FILAS_EXT) {
    return `Patrón extendido inválido: se esperaban ${FILAS_EXT} filas`;
  }
  for (let i = 0; i < FILAS_EXT; i++) {
    const fila = patron[i];
    if (!Array.isArray(fila) || fila.length !== PASOS_EXT) {
      return `Fila ${i} inválida: se esperaban ${PASOS_EXT} pasos`;
    }
    if (i < 5) {
      for (const v of fila) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 3) {
          return `Fila ${i} inválida: los valores deben ser 0-3`;
        }
      }
    } else {
      for (const v of fila) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < -1 || n > 11) {
          return `Fila ${i} inválida: los valores deben ser -1 a 11`;
        }
      }
    }
  }
  return null;
}

function validarEfectos(efectos) {
  if (efectos == null) return null;
  if (typeof efectos !== 'object' || Array.isArray(efectos)) {
    return 'efectos debe ser un objeto';
  }
  const claves = ['reverb', 'eco', 'saturacion', 'filtro'];
  for (const k of claves) {
    if (efectos[k] != null) {
      const n = Number(efectos[k]);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return `${k} fuera de rango (0-100)`;
      }
    }
  }
  return null;
}

function validarVolumen(volumen) {
  if (volumen == null) return null;
  if (!Array.isArray(volumen)) return 'volumen debe ser un array';
  for (const v of volumen) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      return 'volumen debe estar entre 0 y 1';
    }
  }
  return null;
}

function validarBooleanos(nombre, arr) {
  if (arr == null) return null;
  if (!Array.isArray(arr)) return `${nombre} debe ser un array`;
  for (const v of arr) {
    if (typeof v !== 'boolean') return `${nombre} debe contener booleanos`;
  }
  return null;
}

export async function crear(datos, opciones = {}) {
  if (!datos?.nombre?.trim()) return Resultado.fallo('Falta nombre');
  if (datos.nombre.length > 100) return Resultado.fallo('Nombre demasiado largo');
  if (typeof datos.bpm !== 'number' || datos.bpm < 40 || datos.bpm > 240) {
    return Resultado.fallo('BPM fuera de rango (40-240)');
  }
  if (!MODOS.includes(datos.modo)) {
    return Resultado.fallo(`Modo inválido: ${datos.modo}`);
  }
  if (datos.swing != null) {
    const s = Number(datos.swing);
    if (!Number.isInteger(s) || s < 0 || s > 50) {
      return Resultado.fallo('Swing debe ser un entero entre 0 y 50');
    }
  }

  const errEfectos = validarEfectos(datos.efectos);
  if (errEfectos) return Resultado.fallo(errEfectos);
  const errVolumen = validarVolumen(datos.volumen);
  if (errVolumen) return Resultado.fallo(errVolumen);
  const errSil = validarBooleanos('silenciados', datos.silenciados);
  if (errSil) return Resultado.fallo(errSil);
  const errSol = validarBooleanos('solistas', datos.solistas);
  if (errSol) return Resultado.fallo(errSol);

  const errPatron = datos.modo === 'simple'
    ? validarPatronSimple(datos.patron)
    : validarPatronExtendido(datos.patron);
  if (errPatron) return Resultado.fallo(errPatron);

  const ctx = obtenerContexto();
  if (!ctx.exito) return ctx;

  const payload = {
    espacioId: ctx.datos.espacioId,
    nombre: datos.nombre.trim(),
    bpm: Math.round(datos.bpm),
    patron: JSON.stringify(datos.patron),
    modo: datos.modo,
    estiloId: (datos.estiloId || '').trim(),
    familia: datos.familia || '',
    efectos: datos.efectos ? JSON.stringify(datos.efectos) : null,
    volumen: datos.volumen ? JSON.stringify(datos.volumen) : null,
    silenciados: datos.silenciados ? JSON.stringify(datos.silenciados) : null,
    solistas: datos.solistas ? JSON.stringify(datos.solistas) : null,
    swing: typeof datos.swing === 'number' ? Math.round(datos.swing) : 0,
    creadoPor: ctx.datos.usuarioId,
    creadoEn: new Date().toISOString(),
  };

  return conIdempotenciaParaCrear(TABLA, ctx.datos.usuarioId, payload, opciones, async () => {
    try {
      const r = await obtenerTablesDB().createRow({
        databaseId: obtenerDatabaseId(),
        tableId: TABLA,
        rowId: generarId('ritmo'),
        data: payload,
      });
      const ritmo = normalizar(r);
      emitir('ritmos:creado', ritmo);
      return Resultado.ok(ritmo);
    } catch (e) {
      log.error('crear:', e.message);
      return Resultado.fallo(`Error al crear ritmo: ${e.message}`);
    }
  });
}

export async function eliminar(id) {
  if (!id) return Resultado.fallo('Falta el id del ritmo');
  try {
    await obtenerTablesDB().deleteRow({
      databaseId: obtenerDatabaseId(),
      tableId: TABLA,
      rowId: id,
    });
    emitir('ritmos:eliminado', { id });
    return Resultado.ok({ id });
  } catch (e) {
    log.error('eliminar:', e.message);
    return Resultado.fallo(`Error al eliminar ritmo: ${e.message}`);
  }
}