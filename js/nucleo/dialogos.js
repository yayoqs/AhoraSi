/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/nucleo/dialogos.js
   Versión: 1.0.0
   Propósito: diálogos nativos estilizados que reemplazan a
              window.confirm() y window.prompt(). Devuelven
              Promises para integrarse con el flujo asíncrono de
              las vistas. Sin dependencias del almacén ni del
              EventBus: solo DOM y promesas.
   ================================================================ */

import { h, limpiarContenedor } from './utils.js';

const ID_OVERLAY = 'dialogo-nucleo-overlay';

function cerrarOverlay(overlay) {
  if (!overlay || !overlay.parentNode) return;
  overlay.classList.remove('dialogo--visible');
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
  }, 180);
}

function crearOverlay() {
  // Por si quedó alguno de una llamada anterior.
  const existente = document.getElementById(ID_OVERLAY);
  if (existente) existente.remove();

  const overlay = h('div', {
    id: ID_OVERLAY,
    class: 'dialogo',
    role: 'dialog',
    'aria-modal': 'true',
  });
  document.body.append(overlay);
  // Fuerza al navegador a pintar antes de agregar la clase visible,
  // para que la transición CSS se dispare correctamente.
  // eslint-disable-next-line no-unused-expressions
  overlay.offsetWidth;
  overlay.classList.add('dialogo--visible');
  return overlay;
}

export function mostrarConfirmacion(titulo, mensaje, opciones = {}) {
  const {
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    claseConfirmar = 'dialogo__boton--peligro',
  } = opciones;

  return new Promise((resolve) => {
    const overlay = crearOverlay();
    const tarjeta = h('div', { class: 'dialogo__tarjeta' });

    let resuelto = false;
    const resolver = (valor) => {
      if (resuelto) return;
      resuelto = true;
      document.removeEventListener('keydown', manejarTecla);
      cerrarOverlay(overlay);
      resolve(valor);
    };

    const botonConfirmar = h('button', {
      type: 'button',
      class: `dialogo__boton ${claseConfirmar}`,
      onclick: () => resolver(true),
    }, textoConfirmar);

    const botonCancelar = h('button', {
      type: 'button',
      class: 'dialogo__boton dialogo__boton--secundario',
      onclick: () => resolver(false),
    }, textoCancelar);

    tarjeta.append(
      h('div', { class: 'dialogo__cabecera' },
        h('h3', { class: 'dialogo__titulo' }, titulo)
      ),
      h('div', { class: 'dialogo__cuerpo' },
        h('p', { class: 'dialogo__mensaje' }, mensaje)
      ),
      h('div', { class: 'dialogo__pie' },
        botonCancelar,
        botonConfirmar
      )
    );

    overlay.append(tarjeta);

    // Cierre al hacer clic fuera de la tarjeta.
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) resolver(false);
    });

    // Cierre con Escape.
    const manejarTecla = (ev) => {
      if (ev.key === 'Escape') resolver(false);
    };
    document.addEventListener('keydown', manejarTecla);

    // Foco en el botón de confirmación para que Enter funcione.
    setTimeout(() => botonConfirmar.focus(), 50);
  });
}

export function mostrarEntrada(titulo, mensaje, opciones = {}) {
  const {
    valorPredefinido = '',
    placeholder = '',
    tipo = 'text',
    textoAceptar = 'Aceptar',
    textoCancelar = 'Cancelar',
  } = opciones;

  return new Promise((resolve) => {
    const overlay = crearOverlay();
    const tarjeta = h('div', { class: 'dialogo__tarjeta' });

    let resuelto = false;
    const resolver = (valor) => {
      if (resuelto) return;
      resuelto = true;
      document.removeEventListener('keydown', manejarTecla);
      cerrarOverlay(overlay);
      resolve(valor);
    };

    const input = h('input', {
      type: tipo,
      class: 'dialogo__campo',
      placeholder,
      autocomplete: 'off',
    });
    input.value = valorPredefinido;

    const aceptar = h('button', {
      type: 'button',
      class: 'dialogo__boton dialogo__boton--primario',
      onclick: () => resolver(input.value),
    }, textoAceptar);

    const cancelar = h('button', {
      type: 'button',
      class: 'dialogo__boton dialogo__boton--secundario',
      onclick: () => resolver(null),
    }, textoCancelar);

    tarjeta.append(
      h('div', { class: 'dialogo__cabecera' },
        h('h3', { class: 'dialogo__titulo' }, titulo)
      ),
      h('div', { class: 'dialogo__cuerpo' },
        mensaje ? h('p', { class: 'dialogo__mensaje' }, mensaje) : null,
        input
      ),
      h('div', { class: 'dialogo__pie' },
        cancelar,
        aceptar
      )
    );

    overlay.append(tarjeta);

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) resolver(null);
    });

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        resolver(input.value);
      }
    });

    const manejarTecla = (ev) => {
      if (ev.key === 'Escape') resolver(null);
    };
    document.addEventListener('keydown', manejarTecla);

    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  });
}