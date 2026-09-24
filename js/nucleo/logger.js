/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/nucleo/logger.js
   Versión: 1.0.0
   Propósito: registro centralizado. Niveles info, warn, error.
              Cada módulo crea su logger con un prefijo propio.
   ================================================================ */

const NIVELES = { info: 1, warn: 2, error: 3 };
let nivelMinimo = NIVELES.info;

export function configurarNivel(nivel) {
  if (NIVELES[nivel]) nivelMinimo = NIVELES[nivel];
}

export function crearLogger(prefijo) {
  const emitir = (nivel, ...args) => {
    if (NIVELES[nivel] < nivelMinimo) return;
    const etiqueta = `[${prefijo}]`;
    if (nivel === 'error') console.error(etiqueta, ...args);
    else if (nivel === 'warn') console.warn(etiqueta, ...args);
    else console.log(etiqueta, ...args);
  };

  return {
    info: (...args) => emitir('info', ...args),
    warn: (...args) => emitir('warn', ...args),
    error: (...args) => emitir('error', ...args),
  };
}