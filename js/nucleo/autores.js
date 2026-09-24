/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/nucleo/autores.js
   Versión: 1.0.0
   Propósito: helper compartido para mostrar el distintivo visual
              del autor de un registro. Devuelve un elemento span
              con la inicial del usuario y una clase que le da
              color (dorado para Yayo, azul cielo para Luci).
              Se usa en todas las vistas que muestran autoría.
   ================================================================ */

import { CONFIG } from '../config/config.js';
import { h } from './utils.js';

const AUTORES = {
  [CONFIG.usuarios.yayo]: { nombre: 'Yayo', clase: 'autor--yayo', inicial: 'Y' },
  [CONFIG.usuarios.luci]: { nombre: 'Luci', clase: 'autor--luci', inicial: 'L' },
};

export function datosDeAutor(userId) {
  return AUTORES[userId] || { nombre: userId || 'Desconocido', clase: 'autor--desconocido', inicial: '?' };
}

export function etiquetaAutor(userId) {
  return datosDeAutor(userId).nombre;
}

export function distintivoAutor(userId) {
  const info = datosDeAutor(userId);
  return h('span', { class: `autor ${info.clase}`, 'aria-label': `Por ${info.nombre}` },
    h('span', { class: 'autor__inicial', 'aria-hidden': 'true' }, info.inicial),
    h('span', {}, info.nombre)
  );
}