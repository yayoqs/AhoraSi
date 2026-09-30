/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/arranque/sesion-inicial.js
   Versión: 1.5.0
   Propósito: cargar la sesión al arrancar. Puebla el almacén con
              usuario, perfil y espacio activo.
              v1.5.0: se eliminan los sembrados iniciales
                      (carta de Yayo e ideas iniciales). Ya
                      cumplieron su función: el contenido está
                      en la base y se edita desde la UI. Se
                      eliminan las llamadas a asegurarCartaDeYayo
                      y asegurarIdeasIniciales, y los imports
                      correspondientes. Los archivos
                      carta-inicial.js e ideas-iniciales.js se
                      borran del repo. Sin cambios en las firmas
                      públicas ni en el retorno de arrancar().
              v1.4.0: se llama a asegurarIdeasIniciales().
              v1.3.0: se llama a asegurarCartaDeYayo().
              v1.2.0: perfil y espacio en paralelo con Promise.all.
              v1.1.0: retorna objeto con exito/usuario/espacio.
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

  const [rPerfil, rEspacio] = await Promise.all([
    obtenerPerfil(usuario.$id),
    asegurarEspacioCompartido(usuario.$id),
  ]);

  if (rPerfil.exito) {
    establecer('perfil', rPerfil.datos);
    log.info('Perfil cargado:', rPerfil.datos.id);
  } else {
    log.warn('Sin perfil:', rPerfil.error);
  }

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