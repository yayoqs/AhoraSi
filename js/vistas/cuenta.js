/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/cuenta.js
   Versión: 1.2.0
   Propósito: vista "Mi cuenta". Permite cambiar el nombre visible,
              cambiar la contraseña, activar el modo noche y cerrar
              sesión.
              v1.2.0: se agrega el toggle de modo noche y el botón
                      de cerrar sesión. El toggle lee y escribe
                      'modoNoche' en el almacén (que emite el
                      evento que app.js escucha para aplicar la
                      clase al body) y persiste en localStorage
                      con la clave ahorasi:modoNoche. El cierre de
                      sesión ejecuta el comando 'app:cerrar-sesion'
                      registrado en app.js, que muestra la
                      confirmación y cierra. Sin cambios en las
                      firmas públicas.
              v1.1.0: la sección raíz lleva id="vista-cuenta" para
                      el encapsulado de CSS. Sin cambios en la
                      lógica ni en las firmas públicas.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoPerfiles from '../datos/repositorios/perfiles.js';
import { cambiarContrasena } from '../datos/sesion.js';
import { obtener, establecer } from '../nucleo/almacen.js';
import { ejecutar as ejecutarComando } from '../nucleo/bus-comandos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:cuenta');

const CLAVE_MODO_NOCHE = 'ahorasi:modoNoche';

const registro = {
  contenedor: null,
  abortador: null,
  perfil: null,
};

/* ---------- Helpers -------------------------------------------- */

function usuarioActualId() {
  const u = obtener('usuarioActual');
  return u?.$id || u?.id || null;
}

function modoNocheActivo() {
  return obtener('modoNoche') === true;
}

function pintarMensaje(tipo, texto) {
  const cont = registro.contenedor;
  if (!cont) return;
  const clase = tipo === 'ok' ? 'vista__ok' : 'vista__error';
  const p = h('p', { class: clase, role: tipo === 'ok' ? 'status' : 'alert' }, texto);
  cont.prepend(p);
  setTimeout(() => p.remove(), 5000);
}

/* ---------- Modo noche ----------------------------------------- */

function alternarModoNoche() {
  const nuevo = !modoNocheActivo();
  establecer('modoNoche', nuevo);
  try {
    localStorage.setItem(CLAVE_MODO_NOCHE, nuevo ? '1' : '0');
  } catch (e) {
    // silencioso
  }
}

/* ---------- Secciones ------------------------------------------ */

function pintarToggleNoche() {
  const activo = modoNocheActivo();

  const toggle = h('button', {
    type: 'button',
    class: 'toggle',
    'data-accion': 'toggle-noche',
    'aria-pressed': String(activo),
    'aria-label': activo ? 'Desactivar modo noche' : 'Activar modo noche',
  });

  return h('section', { class: 'seccion' },
    h('div', { class: 'seccion__cab' },
      h('h2', { class: 'seccion__titulo' }, 'Modo noche')
    ),
    h('p', { class: 'seccion__nota' },
      'Se guarda en este navegador. Cambia el tono de toda la app.'
    ),
    h('div', { class: 'toggle-fila' },
      h('div', { class: 'toggle-fila__texto' },
        h('span', { class: 'toggle-fila__titulo' }, 'Papel oscuro'),
        h('span', { class: 'toggle-fila__sub' }, 'Ideal de noche o con poca luz')
      ),
      toggle
    )
  );
}

function pintarSeccionNombre() {
  const nombreActual = registro.perfil?.nombre || '';

  const form = h('form', { class: 'form', 'data-accion': 'guardar-nombre' },
    h('input', {
      type: 'text',
      name: 'nombre',
      placeholder: 'Tu nombre visible',
      required: true,
      maxlength: 60,
      value: nombreActual,
      autocomplete: 'name',
    }),
    h('button', { type: 'submit' },
      registro.perfil ? 'Guardar nombre' : 'Crear perfil')
  );

  return h('section', { class: 'seccion' },
    h('div', { class: 'seccion__cab' },
      h('h2', { class: 'seccion__titulo' }, 'Nombre visible')
    ),
    h('p', { class: 'seccion__nota' },
      'Es el nombre que aparece en los registros que tú creas.'
    ),
    form
  );
}

function pintarSeccionContrasena() {
  const form = h('form', { class: 'form', 'data-accion': 'cambiar-contrasena' },
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

  return h('section', { class: 'seccion' },
    h('div', { class: 'seccion__cab' },
      h('h2', { class: 'seccion__titulo' }, 'Contraseña')
    ),
    h('p', { class: 'seccion__nota' },
      'Tu contraseña es solo tuya. Puedes cambiarla cuando quieras.'
    ),
    form
  );
}

function pintarSeccionSalir() {
  const boton = h('button', {
    type: 'button',
    class: 'btn-salir',
    'data-accion': 'cerrar-sesion',
  });
  boton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>Cerrar sesión</span>';

  return h('section', { class: 'salir-bloque' },
    h('p', { class: 'salir-bloque__nota' },
      'Vas a volver a la pantalla de inicio de sesión. No se borra nada de lo que hay guardado.'
    ),
    boton
  );
}

/* ---------- Pintar --------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-cuenta', class: 'vista vista--cuenta' });

  raiz.append(
    pintarToggleNoche(),
    pintarSeccionNombre(),
    pintarSeccionContrasena(),
    pintarSeccionSalir()
  );

  cont.append(raiz);
}

/* ---------- Handlers ------------------------------------------- */

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

async function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;

  if (accion === 'toggle-noche') {
    alternarModoNoche();
    // Actualiza el toggle sin re-pintar, para no perder los valores
    // escritos en los formularios de nombre y contraseña.
    const activo = modoNocheActivo();
    btn.setAttribute('aria-pressed', String(activo));
    btn.setAttribute('aria-label', activo ? 'Desactivar modo noche' : 'Activar modo noche');
  } else if (accion === 'cerrar-sesion') {
    try {
      await ejecutarComando('app:cerrar-sesion');
    } catch (e) {
      log.error('Error al ejecutar cierre de sesión:', e.message);
      pintarMensaje('error', 'No se pudo cerrar la sesión.');
    }
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

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

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