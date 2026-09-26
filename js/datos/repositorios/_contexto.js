/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/_contexto.js
   Versión: 1.3.0
   Propósito: helper compartido por los repositorios. Resuelve
              el contexto (usuario, espacio) desde el almacén.
              v1.3.0: agrega conIdempotenciaParaCrear y
                      conIdempotenciaParaActualizar. Cada
                      repositorio los usa para envolver sus
                      escrituras con clave automática.
              v1.2.0: elimina permisosDeEspacio.
              v1.0.0: versión inicial.
   ================================================================ */

import { Resultado } from '../../dominio/resultado.js';
import { obtener } from '../../nucleo/almacen.js';
import { generarClave, conIdempotencia } from '../../nucleo/idempotencia.js';

export function obtenerContexto() {
  const usuario = obtener('usuarioActual');
  const espacio = obtener('espacio');
  const usuarioId = usuario?.$id || usuario?.id;
  const espacioId = espacio?.$id || espacio?.id;
  if (!usuarioId) return Resultado.fallo('No hay usuario autenticado');
  if (!espacioId) return Resultado.fallo('No hay espacio activo');
  return Resultado.ok({
    usuarioId,
    espacioId,
    miembros: Array.isArray(espacio?.miembros) ? espacio.miembros : [],
  });
}

/**
 * Envuelve una operación de creación con idempotencia.
 * - Si el llamador pasa `opciones.idOperacion`, se usa esa clave.
 * - Si no, se genera una automática a partir del usuario, la
 *   tabla y los datos. Dos llamadas con los mismos datos por el
 *   mismo usuario dentro del TTL devuelven el mismo resultado.
 *
 * @param {string} tabla
 * @param {string} usuarioId
 * @param {object} datos
 * @param {object} opciones - { idOperacion?: string }
 * @param {() => Promise<Resultado>} fn
 * @returns {Promise<Resultado>}
 */
export function conIdempotenciaParaCrear(tabla, usuarioId, datos, opciones, fn) {
  const clave = opciones?.idOperacion
    || generarClave(usuarioId, `${tabla}:crear`, datos);
  return conIdempotencia(clave, fn, (r) => r && r.exito === true);
}

/**
 * Envuelve una operación de actualización con idempotencia.
 * Ventana de TTL es la misma; como las actualizaciones suelen ser
 * idempotentes por naturaleza, la clave se calcula sobre la unión
 * de (id, cambios). Un doble clic sobre el mismo cambio en menos
 * de 30s devuelve el mismo resultado sin tocar la red.
 */
export function conIdempotenciaParaActualizar(tabla, usuarioId, id, cambios, opciones, fn) {
  const clave = opciones?.idOperacion
    || generarClave(usuarioId, `${tabla}:actualizar:${id}`, cambios);
  return conIdempotencia(clave, fn, (r) => r && r.exito === true);
}