/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/datos/subidor-fotos.js
   Versión: 1.0.0
   Propósito: compresión de imágenes en el cliente antes de
              subirlas. Reduce a un ancho máximo y calidad JPEG
              para que una foto de celular pase de ~4 MB a
              ~250 KB. Sin dependencias externas: usa canvas.
              v1.0.0: versión inicial.
   ================================================================ */

import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('datos:subidor-fotos');

const ANCHO_MAX_DEFECTO = 1200;
const CALIDAD_DEFECTO = 0.85;

function leerImagen(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

function canvasABlob(canvas, tipo, calidad) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo exportar la imagen'));
        return;
      }
      resolve(blob);
    }, tipo, calidad);
  });
}

/**
 * Comprime una imagen a un blob JPEG.
 * Si la imagen original ya es más pequeña que el resultado
 * comprimido, devuelve el archivo original.
 * @param {File} archivo
 * @param {{ maxAncho?: number, calidad?: number }} opciones
 * @returns {Promise<{ blob: Blob, ancho: number, alto: number, peso: number }>}
 */
export async function comprimir(archivo, opciones = {}) {
  const maxAncho = opciones.maxAncho || ANCHO_MAX_DEFECTO;
  const calidad = opciones.calidad || CALIDAD_DEFECTO;

  if (!archivo) throw new Error('Falta el archivo');
  if (!archivo.type || !archivo.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen');
  }

  const img = await leerImagen(archivo);
  const escala = Math.min(1, maxAncho / img.width);
  const ancho = Math.round(img.width * escala);
  const alto = Math.round(img.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, ancho, alto);

  const blobComprimido = await canvasABlob(canvas, 'image/jpeg', calidad);

  // Si el original ya pesaba menos que el comprimido, devolvemos
  // el original para no ganar peso.
  const usarOriginal = archivo.size < blobComprimido.size;
  const blob = usarOriginal ? archivo : blobComprimido;

  return {
    blob,
    ancho: usarOriginal ? img.width : ancho,
    alto: usarOriginal ? img.height : alto,
    peso: blob.size,
  };
}