/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/repositorios/_contexto.js
   Versión: 1.2.0
   Propósito: helper compartido por los repositorios. Resuelve
              el contexto (usuario, espacio) desde el almacén.
              v1.2.0: se elimina permisosDeEspacio. Ya no se usa
                      con Row Security desactivado.
              v1.1.0: permisosDeEspacio sin uso.
              v1.0.0: versión inicial.
   ================================================================ */

import { Resultado } from '../../dominio/resultado.js';
import { obtener } from '../../nucleo/almacen.js';

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