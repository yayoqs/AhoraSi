/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/sesion.js
   Versión: 1.2.0
   Propósito: manejo de sesión con Appwrite. Login, logout, carga
              de sesión existente, obtención del usuario actual y
              cambio de contraseña.
              v1.2.0: se agrega cambiarContrasena(actual, nueva).
                      Devuelve { exito, error }. Requiere la
                      contraseña actual para que Appwrite acepte el
                      cambio. Sin cambios en las firmas previas.
              v1.1.0: import del cliente por cambio de SDK (UMD).
              v1.0.1: cerrarTodasLasSesiones, manejo de error al
                      cerrar sin sesión.
              v1.0.0: versión inicial.
   ================================================================ */

import { obtenerAccount } from './cliente-appwrite.js';
import { crearLogger } from '../nucleo/logger.js';
import { emitir } from '../nucleo/bus-eventos.js';

const log = crearLogger('sesion');

const LARGO_MINIMO_CONTRASENA = 8;

let usuarioActual = null;

export async function iniciarSesion(email, password) {
  try {
    await obtenerAccount().createEmailPasswordSession({ email, password });
    usuarioActual = await obtenerAccount().get();
    log.info('Sesión iniciada:', usuarioActual.$id);
    emitir('sesion:iniciada', usuarioActual);
    return usuarioActual;
  } catch (e) {
    log.error('Error al iniciar sesión:', e.message);
    throw e;
  }
}

export async function cerrarSesion() {
  try {
    await obtenerAccount().deleteSession({ sessionId: 'current' });
    log.info('Sesión cerrada');
  } catch (e) {
    log.warn('No se pudo cerrar sesión:', e.message);
  } finally {
    usuarioActual = null;
    emitir('sesion:cerrada');
  }
}

export async function cerrarTodasLasSesiones() {
  try {
    await obtenerAccount().deleteSessions();
    log.info('Todas las sesiones cerradas');
  } catch (e) {
    log.warn('No se pudieron cerrar todas las sesiones:', e.message);
  } finally {
    usuarioActual = null;
    emitir('sesion:cerrada');
  }
}

export async function cargarSesion() {
  try {
    usuarioActual = await obtenerAccount().get();
    log.info('Sesión activa:', usuarioActual.$id);
    emitir('sesion:cargada', usuarioActual);
    return usuarioActual;
  } catch (e) {
    usuarioActual = null;
    return null;
  }
}

export function obtenerUsuarioActual() {
  return usuarioActual;
}

export function estaAutenticado() {
  return usuarioActual !== null;
}

export function limpiarCache() {
  usuarioActual = null;
}

/**
 * Cambia la contraseña del usuario autenticado.
 * Appwrite exige la contraseña actual para aceptar el cambio.
 * @param {string} actual
 * @param {string} nueva
 * @returns {Promise<{exito: boolean, error: string|null}>}
 */
export async function cambiarContrasena(actual, nueva) {
  if (!actual) return { exito: false, error: 'Falta la contraseña actual' };
  if (!nueva) return { exito: false, error: 'Falta la contraseña nueva' };
  if (nueva.length < LARGO_MINIMO_CONTRASENA) {
    return {
      exito: false,
      error: `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres`,
    };
  }
  if (nueva === actual) {
    return { exito: false, error: 'La contraseña nueva no puede ser igual a la actual' };
  }
  try {
    await obtenerAccount().updatePassword({ password: nueva, oldPassword: actual });
    log.info('Contraseña actualizada');
    return { exito: true, error: null };
  } catch (e) {
    log.error('Error al cambiar contraseña:', e.message);
    return { exito: false, error: e.message };
  }
}