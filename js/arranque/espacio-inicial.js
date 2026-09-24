/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/arranque/espacio-inicial.js
   Versión: 1.0.0
   Propósito: garantiza que existe el espacio compartido. Si el
              usuario pertenece a un espacio, lo devuelve. Si no,
              crea uno nuevo con los dos miembros configurados en
              config.js. Idempotente: no crea duplicados.
   ================================================================ */

import { CONFIG } from '../config/config.js';
import { listarDeUsuario, crear } from '../datos/repositorios/espacios.js';
import { Resultado } from '../dominio/resultado.js';
import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('arranque:espacio-inicial');

export async function asegurarEspacioCompartido(usuarioId) {
  if (!usuarioId) return Resultado.fallo('Falta el userId');

  const rLista = await listarDeUsuario(usuarioId);
  if (!rLista.exito) return rLista;

  if (rLista.datos.length > 0) {
    log.info('Espacio existente:', rLista.datos[0].id);
    return Resultado.ok(rLista.datos[0]);
  }

  const miembros = [CONFIG.usuarios.yayo, CONFIG.usuarios.luci];
  const rCrear = await crear({
    nombre: CONFIG.espacio.nombre,
    miembros,
  });
  if (!rCrear.exito) return rCrear;

  log.info('Espacio creado:', rCrear.datos.id);
  return Resultado.ok(rCrear.datos);
}