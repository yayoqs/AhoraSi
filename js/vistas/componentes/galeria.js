/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/componentes/galeria.js
   Versión: 1.0.0
   Propósito: componente de galería de fotos. Autocontenido: se
              encarga de pintar miniaturas, abrir el lightbox,
              subir fotos (cámara o galería), eliminar fotos y
              avisar al padre cuando algo cambia. Se usa en
              cualquier vista que necesite fotos.
              v1.0.0: versión inicial. Nace de la galería que
                      estaba embebida en fauna.js v1.5.0.
   ================================================================ */

import * as repoFotos from '../../datos/repositorios/fotos.js';
import { comprimir } from '../../datos/subidor-fotos.js';
import { abrirCamara, camaraDisponible } from './camara.js';
import { mostrarConfirmacion } from '../../nucleo/dialogos.js';
import { crearLogger } from '../../nucleo/logger.js';
import { h } from '../../nucleo/utils.js';

const log = crearLogger('componente:galeria');

const MAX_FOTOS_DEFECTO = 10;

let lightboxActual = null;

/**
 * Pinta una galería de fotos.
 * @param {{
 *   fotos: Array<{id: string, fileId: string}>,
 *   tabla: string,
 *   filaId: string,
 *   max?: number,
 *   onCambio?: () => void,
 *   onMensaje?: (texto: string, tipo: 'ok'|'error') => void
 * }} opciones
 * @returns {HTMLElement}
 */
export function pintarGaleria(opciones = {}) {
  const {
    fotos = [],
    tabla,
    filaId,
    max = MAX_FOTOS_DEFECTO,
    onCambio,
    onMensaje,
  } = opciones;

  const cont = h('div', { class: 'galeria' });
  cont._tabla = tabla;
  cont._filaId = filaId;
  cont._onCambio = onCambio;
  cont._onMensaje = onMensaje;
  cont._subiendo = false;

  if (!tabla || !filaId) {
    log.warn('pintarGaleria() sin tabla o filaId');
    return cont;
  }

  for (const foto of fotos) {
    cont.append(h('div', { class: 'galeria__item' },
      h('button', {
        type: 'button',
        class: 'galeria__miniatura',
        'data-accion': 'abrir-foto',
        'data-file-id': foto.fileId,
        'aria-label': 'Ver foto',
      },
        h('img', {
          src: repoFotos.urlPreview(foto.fileId),
          alt: '',
          loading: 'lazy',
        })
      ),
      h('button', {
        type: 'button',
        class: 'galeria__eliminar',
        'data-accion': 'eliminar-foto',
        'data-id': foto.id,
        'aria-label': 'Eliminar foto',
      }, '×')
    ));
  }

  if (fotos.length < max) {
    const inputId = 'input-foto-' + filaId;
    const puedeCamara = camaraDisponible();
    cont.append(h('div', { class: 'galeria__acciones' },
      h('input', {
        type: 'file',
        id: inputId,
        accept: 'image/*',
        class: 'galeria__archivo',
        'data-accion': 'seleccionar-foto',
      }),
      h('label', {
        for: inputId,
        class: 'galeria__boton',
        role: 'button',
      }, fotos.length === 0 ? 'Galería' : 'Otra'),
      puedeCamara
        ? h('button', {
            type: 'button',
            class: 'galeria__boton galeria__boton--camara',
            'data-accion': 'tomar-foto',
          }, 'Cámara')
        : null
    ));
  }

  cont.addEventListener('click', manejarClick);
  cont.addEventListener('change', manejarChange);

  return cont;
}

async function manejarClick(ev) {
  const cont = ev.currentTarget;
  const boton = ev.target.closest('button[data-accion]');
  if (!boton || !cont.contains(boton)) return;
  const accion = boton.dataset.accion;

  // Solo detenemos la propagación si manejamos la acción.
  // Si el click cayó en zona vacía, el padre debe poder verlo.
  if (accion === 'abrir-foto') {
    ev.stopPropagation();
    abrirLightbox(boton.dataset.fileId);
  } else if (accion === 'eliminar-foto') {
    ev.stopPropagation();
    const ok = await mostrarConfirmacion(
      'Eliminar foto',
      '¿Seguro que quieres eliminar esta foto?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoFotos.eliminar(boton.dataset.id);
    if (r.exito) {
      mensaje(cont, 'Foto eliminada.', 'ok');
      cambio(cont);
    } else {
      mensaje(cont, r.error, 'error');
    }
  } else if (accion === 'tomar-foto') {
    ev.stopPropagation();
    await subirDesdeCamara(cont);
  }
}

async function manejarChange(ev) {
  const cont = ev.currentTarget;
  const input = ev.target.closest('input[type="file"][data-accion="seleccionar-foto"]');
  if (!input || !cont.contains(input)) return;
  ev.stopPropagation();
  const archivo = input.files && input.files[0];
  input.value = '';
  if (!archivo) return;
  await subirDesdeArchivo(cont, archivo);
}

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

/* ---------- Lightbox ------------------------------------------- */

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

/**
 * Limpieza global del componente. Las vistas lo llaman en su
 * limpiar() para cerrar cualquier lightbox abierto.
 */
export function limpiarGaleria() {
  cerrarLightbox();
}