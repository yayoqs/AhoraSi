/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/sesion.js
   Versión: 1.1.0
   Propósito: manejo de sesión con Appwrite. Login, logout, carga
              de sesión existente y obtención del usuario actual.
              Cachea el usuario en memoria.
              v1.1.0: se ajusta import del cliente por cambio de
                      origen del SDK (ahora UMD local). Sin cambios
                      de comportamiento.
              v1.0.1: agrega cerrarTodasLasSesiones y manejo de
                      error al cerrar sin sesión activa.
              v1.0.0: versión inicial.
   ================================================================ */

import { obtenerAccount } from './cliente-appwrite.js';
import { crearLogger } from '../nucleo/logger.js';
import { emitir } from '../nucleo/bus-eventos.js';

const log = crearLogger('sesion');

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