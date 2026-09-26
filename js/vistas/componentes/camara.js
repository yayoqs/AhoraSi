/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/componentes/camara.js
   Versión: 1.0.0
   Propósito: componente de cámara. Abre la cámara del dispositivo
              con getUserMedia, muestra el video en vivo, permite
              capturar, ver la foto capturada, y aceptarla o
              repetirla. Devuelve un Blob JPEG o null si el usuario
              cancela. Requiere HTTPS o localhost.
              v1.0.0: versión inicial.
   ================================================================ */

import { crearLogger } from '../../nucleo/logger.js';
import { h } from '../../nucleo/utils.js';

const log = crearLogger('vista:camara');

const ANCHO_MAX_CAPTURA = 1920;

function soportaCamara() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Abre la cámara. Devuelve una Promise que resuelve con un Blob
 * (JPEG) si el usuario acepta la foto, o null si cancela.
 * Lanza excepción si el navegador no soporta la cámara o si
 * hay un error de permisos.
 */
export function abrirCamara() {
  return new Promise((resolve, reject) => {
    if (!soportaCamara()) {
      reject(new Error('Este navegador no soporta la cámara, o no estás en HTTPS'));
      return;
    }

    let stream = null;
    let fase = 'video'; // 'video' | 'previsualizacion'

    const overlay = h('div', { class: 'camara', role: 'dialog', 'aria-modal': 'true' });
    const tarjeta = h('div', { class: 'camara__tarjeta' });
    overlay.append(tarjeta);
    document.body.append(overlay);
    // Forzar reflow antes de aplicar la clase visible.
    overlay.offsetWidth;
    overlay.classList.add('camara--visible');

    const video = h('video', {
      class: 'camara__video',
      autoplay: '',
      playsinline: '',
      muted: '',
    });

    const imgPreview = h('img', { class: 'camara__foto', alt: '' });
    imgPreview.style.display = 'none';

    const barra = h('div', { class: 'camara__barra' });

    const mensaje = h('p', { class: 'camara__mensaje' });

    tarjeta.append(
      h('div', { class: 'camara__visor' }, video, imgPreview),
      mensaje,
      barra
    );

    let blobCapturado = null;

    function limpiarStream() {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
    }

    function cerrar(resultado) {
      limpiarStream();
      document.removeEventListener('keydown', alTeclado);
      overlay.classList.remove('camara--visible');
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
      }, 200);
      resolve(resultado);
    }

    function alTeclado(ev) {
      if (ev.key === 'Escape') {
        if (fase === 'previsualizacion') {
          repetir();
        } else {
          cerrar(null);
        }
      }
    }
    document.addEventListener('keydown', alTeclado);

    function pintarBarraVideo() {
      barra.replaceChildren(
        h('button', {
          type: 'button', class: 'camara__boton camara__boton--secundario',
          onclick: () => cerrar(null),
        }, 'Cancelar'),
        h('button', {
          type: 'button', class: 'camara__boton camara__boton--capturar',
          onclick: capturar,
        }, 'Capturar')
      );
    }

    function pintarBarraPreview() {
      barra.replaceChildren(
        h('button', {
          type: 'button', class: 'camara__boton camara__boton--secundario',
          onclick: () => cerrar(null),
        }, 'Cancelar'),
        h('button', {
          type: 'button', class: 'camara__boton camara__boton--secundario',
          onclick: repetir,
        }, 'Repetir'),
        h('button', {
          type: 'button', class: 'camara__boton camara__boton--capturar',
          onclick: () => cerrar(blobCapturado),
        }, 'Usar esta')
      );
    }

    function capturar() {
      const ancho = video.videoWidth;
      const alto = video.videoHeight;
      if (!ancho || !alto) {
        log.warn('El video no tiene dimensiones todavía');
        return;
      }
      const escala = Math.min(1, ANCHO_MAX_CAPTURA / ancho);
      const cw = Math.round(ancho * escala);
      const ch = Math.round(alto * escala);

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, cw, ch);

      canvas.toBlob((blob) => {
        if (!blob) {
          log.warn('No se pudo generar el blob de la captura');
          return;
        }
        blobCapturado = blob;
        imgPreview.src = URL.createObjectURL(blob);
        imgPreview.style.display = 'block';
        video.style.display = 'none';
        fase = 'previsualizacion';
        mensaje.textContent = 'Revisa la foto. Si te gusta, úsala. Si no, repítela.';
        pintarBarraPreview();
      }, 'image/jpeg', 0.92);
    }

    function repetir() {
      if (imgPreview.src) {
        URL.revokeObjectURL(imgPreview.src);
        imgPreview.src = '';
      }
      imgPreview.style.display = 'none';
      video.style.display = 'block';
      blobCapturado = null;
      fase = 'video';
      mensaje.textContent = '';
      pintarBarraVideo();
    }

    pintarBarraVideo();

    // Pedir la cámara trasera si está disponible.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        video.play().catch((e) => log.warn('No se pudo reproducir el video:', e.message));
      })
      .catch((e) => {
        log.error('Error al abrir la cámara:', e.message);
        limpiarStream();
        overlay.classList.remove('camara--visible');
        setTimeout(() => {
          if (overlay.parentNode) overlay.remove();
        }, 200);
        document.removeEventListener('keydown', alTeclado);
        reject(e);
      });
  });
}

export function camaraDisponible() {
  return soportaCamara();
}