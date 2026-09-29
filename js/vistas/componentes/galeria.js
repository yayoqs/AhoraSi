/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/componentes/galeria.js
   Versión: 2.1.0
   Propósito: componente de galería de fotos. Autocontenido: se
              encarga de pintar miniaturas, abrir el lightbox,
              subir fotos y eliminar fotos. Dos modos:
              - compacto (para tarjetas): muestra hasta 3 fotos
                en grid. Si hay más, la última celda es "+N"
                que abre el detalle. Sin subir, sin eliminar.
              - detalle (por defecto): todas las fotos con botón
                de eliminar y el bloque de subida al final.
              v2.1.0: en modo compacto se quita el slot de
                      "añadir foto". La tarjeta ya no permite
                      subir. Todo el flujo de subida vive en el
                      detalle. Se quita también el caso vacío
                      (si no hay fotos, el componente no pinta
                      nada en compacto).
              v2.0.0: se agrega el modo compacto con slot
                      dividido "+N / + Añadir".
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoFotos from '../../datos/repositorios/fotos.js';
import { comprimir } from '../../datos/subidor-fotos.js';
import { abrirCamara, camaraDisponible } from './camara.js';
import { mostrarConfirmacion } from '../../nucleo/dialogos.js';
import { crearLogger } from '../../nucleo/logger.js';
import { h } from '../../nucleo/utils.js';

const log = crearLogger('componente:galeria');

const MAX_FOTOS_DEFECTO = 10;
const MAX_COMPACTO = 3;

let lightboxActual = null;

/**
 * Pinta una galería de fotos.
 * @param {{
 *   fotos: Array<{id: string, fileId: string}>,
 *   tabla: string,
 *   filaId: string,
 *   compacto?: boolean,
 *   max?: number,
 *   onCambio?: () => void,
 *   onMensaje?: (texto: string, tipo: 'ok'|'error') => void,
 *   onVerMas?: () => void
 * }} opciones
 * @returns {HTMLElement}
 */
export function pintarGaleria(opciones = {}) {
  const {
    fotos = [],
    tabla,
    filaId,
    compacto = false,
    max = MAX_FOTOS_DEFECTO,
    onCambio,
    onMensaje,
    onVerMas,
  } = opciones;

  if (!tabla || !filaId) {
    log.warn('pintarGaleria() sin tabla o filaId');
    return h('div');
  }

  const wrap = h('div', { class: 'galeria-wrap' });
  wrap._tabla = tabla;
  wrap._filaId = filaId;
  wrap._onCambio = onCambio;
  wrap._onMensaje = onMensaje;
  wrap._onVerMas = onVerMas;
  wrap._compacto = compacto;
  wrap._max = max;
  wrap._subiendo = false;

  // Modo compacto sin fotos: no pintamos nada.
  if (compacto && fotos.length === 0) {
    wrap.classList.add('galeria-wrap--vacia');
    return wrap;
  }

  const grid = h('div', {
    class: 'galeria' + (compacto ? ' galeria--compacta' : ''),
  });

  if (compacto) {
    const visibles = Math.min(fotos.length, MAX_COMPACTO);
    const restantes = fotos.length - visibles;

    // Fotos visibles.
    for (let i = 0; i < visibles; i++) {
      grid.append(pintarFoto(fotos[i], { compacto: true }));
    }

    // Si hay más fotos, la última celda es "+N".
    if (restantes > 0) {
      grid.append(pintarSlotMas(restantes));
    }
  } else {
    // Modo detalle: todas las fotos + botón de acciones.
    for (const foto of fotos) {
      grid.append(pintarFoto(foto, { compacto: false }));
    }
    if (fotos.length < max) {
      grid.append(pintarBloqueAcciones());
    }
  }

  wrap.append(grid);

  if (compacto) {
    // Solo escuchamos click (lightbox y "+N").
    wrap.addEventListener('click', manejarClickCompacto);
  } else {
    wrap.addEventListener('click', manejarClickDetalle);
    wrap.addEventListener('change', manejarChangeDetalle);
  }

  return wrap;
}

/* ---------- Piezas internas ----------------------------------- */

function pintarFoto(foto, { compacto }) {
  const item = h('button', {
    type: 'button',
    class: 'galeria__item',
    'data-accion': 'abrir-foto',
    'data-file-id': foto.fileId,
    'aria-label': 'Ver foto',
  });

  const fondo = h('span', {
    class: 'galeria__foto',
    style: `background-image: url('${repoFotos.urlPreview(foto.fileId)}')`,
  });
  item.append(fondo);

  if (!compacto) {
    item.append(h('span', {
      class: 'galeria__eliminar',
      'data-accion': 'eliminar-foto',
      'data-id': foto.id,
      'role': 'button',
      'aria-label': 'Eliminar foto',
      'title': 'Eliminar',
    }, '×'));
  }

  return item;
}

function pintarSlotMas(restantes) {
  return h('button', {
    type: 'button',
    class: 'galeria__mas',
    'data-accion': 'ver-mas-fotos',
    'aria-label': `Ver ${restantes} fotos más`,
  },
    `+${restantes}`,
    h('small', {}, 'fotos')
  );
}

function pintarBloqueAcciones() {
  const inputId = 'input-foto-' + Math.random().toString(36).slice(2, 8);
  const puedeCamara = camaraDisponible();

  const cont = h('div', { class: 'galeria__acciones' });

  cont.append(h('input', {
    type: 'file',
    id: inputId,
    accept: 'image/*',
    class: 'galeria__archivo',
    'data-accion': 'seleccionar-foto',
  }));

  cont.append(h('label', {
    for: inputId,
    class: 'galeria__boton',
    role: 'button',
  }, 'Galería'));

  if (puedeCamara) {
    cont.append(h('button', {
      type: 'button',
      class: 'galeria__boton galeria__boton--camara',
      'data-accion': 'tomar-foto',
    }, 'Cámara'));
  }

  return cont;
}

/* ---------- Eventos modo compacto ----------------------------- */

function manejarClickCompacto(ev) {
  const cont = ev.currentTarget;
  const btn = ev.target.closest('[data-accion]');
  if (!btn || !cont.contains(btn)) return;
  const accion = btn.dataset.accion;

  if (accion === 'abrir-foto') {
    ev.stopPropagation();
    abrirLightbox(btn.dataset.fileId);
  } else if (accion === 'ver-mas-fotos') {
    ev.stopPropagation();
    if (typeof cont._onVerMas === 'function') cont._onVerMas();
  }
}

/* ---------- Eventos modo detalle ------------------------------ */

async function manejarClickDetalle(ev) {
  const cont = ev.currentTarget;
  const btn = ev.target.closest('[data-accion]');
  if (!btn || !cont.contains(btn)) return;
  const accion = btn.dataset.accion;

  if (accion === 'abrir-foto') {
    ev.stopPropagation();
    abrirLightbox(btn.dataset.fileId);
  } else if (accion === 'eliminar-foto') {
    ev.stopPropagation();
    await eliminarFoto(cont, btn.dataset.id);
  } else if (accion === 'tomar-foto') {
    ev.stopPropagation();
    await subirDesdeCamara(cont);
  }
}

async function manejarChangeDetalle(ev) {
  const cont = ev.currentTarget;
  const input = ev.target.closest('input[type="file"][data-accion="seleccionar-foto"]');
  if (!input || !cont.contains(input)) return;
  ev.stopPropagation();
  const archivo = input.files && input.files[0];
  input.value = '';
  if (!archivo) return;
  await subirDesdeArchivo(cont, archivo);
}

/* ---------- Subidas ------------------------------------------- */

async function subirDesdeArchivo(cont, archivo) {
  if (cont._subiendo) return;
  cont._subiendo = true;
  try {
    mensaje(cont, 'Comprimiendo…', 'ok');
    const comprimida = await comprimir(archivo);
    mensaje(cont, 'Subiendo…', 'ok');
    const r = await repoFotos.subir(
      cont._tabla,
      cont._filaId,
      comprimida.blob,
      archivo.name,
      (p) => mensaje(cont, `Subiendo… ${p}%`, 'ok')
    );
    if (!r.exito) {
      mensaje(cont, r.error, 'error');
      return;
    }
    mensaje(cont, 'Foto agregada.', 'ok');
    cambio(cont);
  } catch (e) {
    log.error('Error al subir:', e.message);
    mensaje(cont, 'Error al subir foto: ' + e.message, 'error');
  } finally {
    cont._subiendo = false;
  }
}

async function subirDesdeCamara(cont) {
  if (cont._subiendo) return;
  try {
    const blob = await abrirCamara();
    if (!blob) return;
    cont._subiendo = true;
    mensaje(cont, 'Comprimiendo…', 'ok');
    const comprimida = await comprimir(blob, { maxAncho: 1200, calidad: 0.85 });
    mensaje(cont, 'Subiendo…', 'ok');
    const r = await repoFotos.subir(
      cont._tabla,
      cont._filaId,
      comprimida.blob,
      'camara.jpg',
      (p) => mensaje(cont, `Subiendo… ${p}%`, 'ok')
    );
    if (!r.exito) {
      mensaje(cont, r.error, 'error');
      return;
    }
    mensaje(cont, 'Foto agregada.', 'ok');
    cambio(cont);
  } catch (e) {
    log.error('Error al tomar foto:', e.message);
    mensaje(cont, 'No se pudo abrir la cámara: ' + e.message, 'error');
  } finally {
    cont._subiendo = false;
  }
}

async function eliminarFoto(cont, id) {
  const ok = await mostrarConfirmacion(
    'Eliminar foto',
    '¿Seguro que quieres eliminar esta foto?',
    { textoConfirmar: 'Eliminar' }
  );
  if (!ok) return;
  const r = await repoFotos.eliminar(id);
  if (r.exito) {
    mensaje(cont, 'Foto eliminada.', 'ok');
    cambio(cont);
  } else {
    mensaje(cont, r.error, 'error');
  }
}

function mensaje(cont, texto, tipo = 'ok') {
  if (typeof cont._onMensaje === 'function') {
    cont._onMensaje(texto, tipo);
  }
}

function cambio(cont) {
  if (typeof cont._onCambio === 'function') {
    cont._onCambio();
  }
}

/* ---------- Lightbox ------------------------------------------ */

export function abrirLightbox(fileId) {
  cerrarLightbox();
  const overlay = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true' },
    h('button', {
      type: 'button',
      class: 'lightbox__cerrar',
      'aria-label': 'Cerrar',
      onclick: cerrarLightbox,
    }, '×'),
    h('img', {
      class: 'lightbox__imagen',
      src: repoFotos.urlArchivo(fileId),
      alt: '',
    })
  );

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) cerrarLightbox();
  });

  document.body.append(overlay);
  overlay.offsetWidth;
  overlay.classList.add('lightbox--visible');
  lightboxActual = overlay;

  const alTeclado = (ev) => {
    if (ev.key === 'Escape') cerrarLightbox();
  };
  document.addEventListener('keydown', alTeclado);
  overlay._alTeclado = alTeclado;
}

export function cerrarLightbox() {
  const ov = lightboxActual;
  if (!ov) return;
  if (ov._alTeclado) document.removeEventListener('keydown', ov._alTeclado);
  ov.classList.remove('lightbox--visible');
  setTimeout(() => {
    if (ov.parentNode) ov.remove();
  }, 200);
  lightboxActual = null;
}

export function limpiarGaleria() {
  cerrarLightbox();
}