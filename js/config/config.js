/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/config/config.js
   Versión: 1.1.0
   Propósito: configuración global de la app.
              v1.1.0: agrega bloque usuarios con los userIds de
                      Elyayo y ChicaLuci, y nombre del espacio
                      compartido. Los usa el módulo espacio-inicial
                      para crear el espacio la primera vez.
              v1.0.1: databaseId real.
              v1.0.0: versión inicial.
   ================================================================ */

export const CONFIG = Object.freeze({
  app: {
    nombre: 'Ahora Sí',
    subdominio: 'ahorasi.elisekai.com',
    version: '1.0.0',
  },
  appwrite: {
    endpoint: 'https://tor.cloud.appwrite.io/v1',
    organizationId: '6a0252ef002b258c5458',
    projectId: '6a025322001f24c57d1d',
    databaseId: '6a0275cb0022ebf7d30d',
  },
  sdk: {
    version: '25',
    rutaLocal: 'js/appwrite.min.js',
  },
  usuarios: Object.freeze({
    yayo: 'Elyayo',
    luci: 'ChicaLuci',
  }),
  espacio: Object.freeze({
    nombre: 'Ahora Sí',
  }),
  breakpoints: Object.freeze({
    movilChico: 480,
    tablet: 768,
    desktop: 1024,
    desktopGrande: 1280,
  }),
  realtime: Object.freeze({
    reconexionMaxima: 5,
    reconexionBaseMs: 1000,
  }),
});

export function validarConfig() {
  const faltantes = [];
  if (!CONFIG.appwrite.projectId) faltantes.push('appwrite.projectId');
  if (!CONFIG.appwrite.endpoint) faltantes.push('appwrite.endpoint');
  if (!CONFIG.appwrite.databaseId) faltantes.push('appwrite.databaseId');
  if (!CONFIG.usuarios.yayo) faltantes.push('usuarios.yayo');
  if (!CONFIG.usuarios.luci) faltantes.push('usuarios.luci');
  if (faltantes.length > 0) {
    throw new Error(`Config incompleta: faltan ${faltantes.join(', ')}`);
  }
  return true;
}