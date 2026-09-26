/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/nucleo/idempotencia.js
   Versión: 1.0.0
   Propósito: evitar duplicados por doble clic o retry rápido.
              Cada operación de escritura calcula una clave
              determinista a partir del usuario, la tabla y los
              datos. Si la misma clave se intenta dentro del TTL,
              se devuelve el resultado guardado sin tocar la red.
              El registro vive en memoria: no se persiste entre
              sesiones porque el TTL es corto y no lo vale.
   ================================================================ */

import { crearLogger } from './logger.js';

const log = crearLogger('idempotencia');

const TTL_MS = 30_000;
const MAX_ENTRADAS = 200;

const registro = new Map();

/**
 * Hash determinista de un texto. Basado en FNV-1a de 32 bits.
 * No necesita ser criptográfico: solo nos importa que dos strings
 * iguales den el mismo hash y que strings distintos casi siempre
 * den hashes distintos.
 */
function hashRapido(texto) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function generarClave(usuarioId, operacion, datos) {
  const serializado = JSON.stringify(datos ?? {});
  return `${operacion}:${usuarioId || 'anon'}:${hashRapido(serializado)}`;
}

function obtenerEntrada(clave) {
  const entrada = registro.get(clave);
  if (!entrada) return null;
  if (Date.now() - entrada.marca > TTL_MS) {
    registro.delete(clave);
    return null;
  }
  return entrada;
}

function marcarEnCurso(clave) {
  registro.set(clave, {
    estado: 'en-curso',
    marca: Date.now(),
    resultado: null,
    promesa: null,
  });
  podarSiEsNecesario();
}

function completar(clave, resultado) {
  const entrada = registro.get(clave);
  if (!entrada) return;
  entrada.estado = 'completada';
  entrada.resultado = resultado;
  entrada.marca = Date.now();
  entrada.promesa = null;
}

function fallar(clave) {
  registro.delete(clave);
}

function podarSiEsNecesario() {
  if (registro.size <= MAX_ENTRADAS) return;
  // Elimina las entradas más antiguas hasta dejar el tamaño bajo
  // el límite. Prioriza las completadas sobre las en-curso.
  const entradas = [...registro.entries()].sort((a, b) => a[1].marca - b[1].marca);
  const aEliminar = registro.size - MAX_ENTRADAS;
  for (let i = 0; i < aEliminar; i++) {
    const [clave, entrada] = entradas[i];
    if (entrada.estado === 'en-curso') continue;
    registro.delete(clave);
  }
}

/**
 * Envuelve una función asíncrona con idempotencia.
 * @param {string} clave
 * @param {() => Promise<any>} fn
 * @param {(resultado: any) => boolean} esExitoso - Decide si el
 *        resultado se cachea. Si devuelve false, la clave se
 *        libera para el próximo intento.
 */
export async function conIdempotencia(clave, fn, esExitoso = () => true) {
  const existente = obtenerEntrada(clave);

  if (existente) {
    if (existente.estado === 'completada') {
      log.info('Reutilizando resultado cacheado para', clave);
      return existente.resultado;
    }
    if (existente.estado === 'en-curso' && existente.promesa) {
      log.info('Esperando operación en curso para', clave);
      return existente.promesa;
    }
  }

  marcarEnCurso(clave);

  const promesa = (async () => {
    try {
      const resultado = await fn();
      if (esExitoso(resultado)) {
        completar(clave, resultado);
      } else {
        fallar(clave);
      }
      return resultado;
    } catch (e) {
      fallar(clave);
      throw e;
    }
  })();

  const entrada = registro.get(clave);
  if (entrada) entrada.promesa = promesa;

  return promesa;
}

export function limpiar() {
  registro.clear();
}

export function tamanio() {
  return registro.size;
}