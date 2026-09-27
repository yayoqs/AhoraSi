/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/cuenta.js
   Versión: 1.1.0
   Propósito: vista "Mi cuenta". Permite cambiar el nombre visible
              y cambiar la contraseña.
              v1.1.0: la sección raíz lleva id="vista-cuenta" para
                      el encapsulado de CSS. Sin cambios en la
                      lógica ni en las firmas públicas.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoPerfiles from '../datos/repositorios/perfiles.js';
import { cambiarContrasena } from '../datos/sesion.js';
import { obtener, establecer } from '../nucleo/almacen.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:cuenta');

const registro = {
  contenedor: null,
  abortador: null,
  perfil: null,
};

function usuarioActualId() {
  const u = obtener('usuarioActual');
  return u?.$id || u?.id || null;
}

function pintarMensaje(tipo, texto) {
  const cont = registro.contenedor;
  if (!cont) return;
  const clase = tipo === 'ok' ? 'vista__ok' : 'vista__error';
  const p = h('p', { class: clase, role: tipo === 'ok' ? 'status' : 'alert' }, texto);
  cont.prepend(p);
  setTimeout(() => p.remove(), 5000);
}

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const nombreActual = registro.perfil?.nombre || '';

  const formNombre = h('form', { class: 'vista__form', 'data-accion': 'guardar-nombre' },
    h('input', {
      name: 'nombre',
      placeholder: 'Tu nombre visible',
      required: true,
      maxlength: 60,
      value: nombreActual,
    }),
    h('button', { type: 'submit' }, registro.perfil ? 'Guardar nombre' : 'Crear perfil')
  );

  const formContrasena = h('form', { class: 'vista__form', 'data-accion': 'cambiar-contrasena' },
    h('input', {
      type: 'password',
      name: 'actual',
      placeholder: 'Contraseña actual',
      required: true,
      autocomplete: 'current-password',
    }),
    h('input', {
      type: 'password',
      name: 'nueva',
      placeholder: 'Contraseña nueva (mínimo 8 caracteres)',
      required: true,
      minlength: 8,
      autocomplete: 'new-password',
    }),
    h('input', {
      type: 'password',
      name: 'confirmar',
      placeholder: 'Repetir contraseña nueva',
      required: true,
      minlength: 8,
      autocomplete: 'new-password',
    }),
    h('button', { type: 'submit' }, 'Cambiar contraseña')
  );

  cont.append(
    h('section', { id: 'vista-cuenta', class: 'vista vista--cuenta' },
      h('h1', {}, 'Mi cuenta'),
      h('p', { class: 'vista__lead' }, 'Cómo te ve el otro y cómo entras a la app.'),

      h('h2', { class: 'vista__subtitulo' }, 'Nombre visible'),
      h('p', { class: 'cuenta__nota' },
        'Es el nombre que aparece en los registros que tú creas.'),
      formNombre,

      h('h2', { class: 'vista__subtitulo' }, 'Contraseña'),
      h('p', { class: 'cuenta__nota' },
        'Tu contraseña es solo tuya. Puedes cambiarla cuando quieras.'),
      formContrasena
    )
  );
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const accion = form.dataset.accion;

  if (accion === 'guardar-nombre') {
    await guardarNombre(form);
  } else if (accion === 'cambiar-contrasena') {
    await procesarCambioContrasena(form);
  }
}

async function guardarNombre(form) {
  const fd = new FormData(form);
  const nombre = String(fd.get('nombre') || '').trim();
  if (!nombre) {
    pintarMensaje('error', 'El nombre no puede quedar vacío.');
    return;
  }

  const userId = usuarioActualId();
  if (!userId) {
    pintarMensaje('error', 'No hay usuario en sesión.');
    return;
  }

  let r;
  if (registro.perfil) {
    r = await repoPerfiles.actualizar(registro.perfil.id, { nombre });
  } else {
    r = await repoPerfiles.crear({ userId, nombre });
  }

  if (!r.exito) {
    pintarMensaje('error', r.error);
    return;
  }

  registro.perfil = r.datos;
  establecer('perfil', r.datos);
  pintarMensaje('ok', 'Nombre guardado.');
  pintar();
}

async function procesarCambioContrasena(form) {
  const fd = new FormData(form);
  const actual = String(fd.get('actual') || '');
  const nueva = String(fd.get('nueva') || '');
  const confirmar = String(fd.get('confirmar') || '');

  if (!actual || !nueva || !confirmar) {
    pintarMensaje('error', 'Completa los tres campos.');
    return;
  }
  if (nueva !== confirmar) {
    pintarMensaje('error', 'La contraseña nueva y su confirmación no coinciden.');
    return;
  }

  const r = await cambiarContrasena(actual, nueva);
  if (!r.exito) {
    pintarMensaje('error', r.error);
    return;
  }

  form.reset();
  pintarMensaje('ok', 'Contraseña cambiada.');
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });

  registro.perfil = obtener('perfil');

  if (!registro.perfil) {
    const userId = usuarioActualId();
    if (userId) {
      const r = await repoPerfiles.obtenerPorUsuarioId(userId);
      if (r.exito) {
        registro.perfil = r.datos;
        establecer('perfil', r.datos);
      } else {
        log.info('Sin perfil todavía para', userId);
      }
    }
  }

  pintar();
}

export function limpiar() {
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.perfil = null;
  registro.contenedor = null;
}