/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/nucleo/utils.js
   Versión: 1.1.0
   Propósito: utilidades comunes.
              v1.1.0: agrega h(), helper para crear elementos DOM.
              v1.0.0: versión inicial.
   ================================================================ */

export function generarId(prefijo = 'id') {
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${Date.now().toString(36)}_${aleatorio}`;
}

export function formatearFecha(fecha, opciones = {}) {
  const f = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(f.getTime())) return '';
  return f.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opciones,
  });
}

export function debounce(fn, espera = 300) {
  let temporizador = null;
  return function (...args) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn.apply(this, args), espera);
  };
}

export function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

export function vacio(valor) {
  return valor === null || valor === undefined || valor === '';
}

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  kids.flat().forEach((c) => {
    if (c == null || c === false) return;
    e.append(c.nodeType ? c : document.createTextNode(c));
  });
  return e;
}

export function limpiarContenedor(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}