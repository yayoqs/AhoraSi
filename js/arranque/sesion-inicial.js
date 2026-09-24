/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/arranque/sesion-inicial.js
   Versión: 1.1.0
   Propósito: cargar la sesión al arrancar. Puebla el almacén con
              usuario, perfil y espacio activo.
              v1.1.0: ahora retorna un objeto con exito, usuario,
                      espacio, motivo y detalle. El shell lo
                      consume directamente en vez de escuchar
                      eventos. Garantiza el espacio compartido.
              v1.0.0: versión inicial.
   ================================================================ */

import { cargarSesion } from '../datos/sesion.js';
import { obtenerPorUsuarioId as obtenerPerfil } from '../datos/repositorios/perfiles.js';
import { asegurarEspacioCompartido } from './espacio-inicial.js';
import { establecer } from '../nucleo/almacen.js';
import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('arranque:sesion-inicial');

export async function arrancar() {
  log.info('Iniciando arranque de sesión');

  const usuario = await cargarSesion();
  if (!usuario) {
    log.info('Sin sesión activa');
    return { exito: false, motivo: 'sin-sesion' };
  }
  establecer('usuarioActual', usuario);

  const rPerfil = await obtenerPerfil(usuario.$id);
  if (rPerfil.exito) {
    establecer('perfil', rPerfil.datos);
    log.info('Perfil cargado:', rPerfil.datos.id);
  } else {
    log.warn('Sin perfil:', rPerfil.error);
  }

  const rEspacio = await asegurarEspacioCompartido(usuario.$id);
  if (!rEspacio.exito) {
    log.error('Error al asegurar espacio:', rEspacio.error);
    return { exito: false, motivo: 'espacio', detalle: rEspacio.error, usuario };
  }

  establecer('espacio', rEspacio.datos);
  log.info('Espacio activo:', rEspacio.datos.id);

  return {
    exito: true,
    usuario,
    perfil: rPerfil.exito ? rPerfil.datos : null,
    espacio: rEspacio.datos,
  };
}