/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/app.js
   Versión: 2.5.0
   Propósito: punto de entrada. Arranca sesión, monta el shell
              de navegación por hash, monta/desmonta las vistas, y
              mantiene Realtime activo mientras hay sesión.
              v2.5.0: se inicia Realtime al arrancar y se detiene
                      al cerrar sesión.
              v2.4.1: import corregido de percusión.
              v2.4.0: se registra percusión.
              v2.3.0: carta y respuesta.
              v2.2.0: hitos, kit, fauna, flora, botón Salir.
              v2.1.0: login integrado.
              v2.0.0: shell con navegación.
              v1.0.0: verificación de arranque.
   ================================================================ */

import { CONFIG, validarConfig } from './config/config.js';
import { crearLogger } from './nucleo/logger.js';
import { arrancar as arrancarSesion } from './arranque/sesion-inicial.js';
import { iniciarSesion, cerrarSesion } from './datos/sesion.js';
import { iniciar as iniciarRealtime, detener as detenerRealtime } from './datos/realtime.js';
import { obtener } from './nucleo/almacen.js';
import { h, limpiarContenedor } from './nucleo/utils.js';

import * as vistaCarta from './vistas/carta.js';
import * as vistaPlanes from './vistas/planes.js';
import * as vistaHitos from './vistas/hitos.js';
import * as vistaKit from './vistas/kit.js';
import * as vistaFauna from './vistas/fauna.js';
import * as vistaFlora from './vistas/flora.js';
import * as vistaRespuesta from './vistas/respuesta.js';
import * as vistaPercusion from './vistas/percusion.js';

const log = crearLogger('app');

const VISTAS = {
  carta: { titulo: 'Carta', modulo: vistaCarta },
  planes: { titulo: 'Planes', modulo: vistaPlanes },
  hitos: { titulo: 'Hitos', modulo: vistaHitos },
  kit: { titulo: 'Kit', modulo: vistaKit },
  fauna: { titulo: 'Fauna', modulo: vistaFauna },
  flora: { titulo: 'Flora', modulo: vistaFlora },
  percusion: { titulo: 'Percusión', modulo: vistaPercusion },
  respuesta: { titulo: 'Respuesta', modulo: vistaRespuesta },
};

const RUTA_DEFECTO = 'carta';

const USUARIOS = [
  { id: 'yayo', nombre: 'Yayo', email: 'yayoqs@elisekai.com' },
  { id: 'luci', nombre: 'Luci', email: 'luciviteri@elisekai.com' },
];

let vistaActiva = null;
let navContenedor = null;
let vistasContenedor = null;

function rutaDesdeHash() {
  const hash = (location.hash || '').replace('#', '').trim();
  return VISTAS[hash] ? hash : RUTA_DEFECTO;
}

function construirNav() {
  limpiarContenedor(navContenedor);
  for (const [id, ruta] of Object.entries(VISTAS)) {
    navContenedor.append(h('a', {
      href: '#' + id,
      'data-ruta': id,
      class: 'nav__enlace',
    }, ruta.titulo));
  }
}

function marcarNavActiva(ruta) {
  navContenedor.querySelectorAll('.nav__enlace').forEach((a) => {
    a.classList.toggle('nav__enlace--activo', a.dataset.ruta === ruta);
  });
}

async function desmontarVistaActual() {
  if (!vistaActiva) return;
  try {
    vistaActiva.modulo.limpiar();
  } catch (e) {
    log.error('Error al limpiar vista:', vistaActiva.titulo, e.message);
  }
  vistaActiva = null;
  limpiarContenedor(vistasContenedor);
}

async function montarVista(ruta) {
  const config = VISTAS[ruta];
  if (!config) return;
  vistaActiva = config;
  try {
    await config.modulo.activar(vistasContenedor);
  } catch (e) {
    log.error('Error al montar vista:', ruta, e.message);
    limpiarContenedor(vistasContenedor);
    vistasContenedor.append(h('p', { class: 'vista-error' }, 'Error al cargar la vista: ' + e.message));
  }
}

async function navegar(ruta) {
  await desmontarVistaActual();
  await montarVista(ruta);
  marcarNavActiva(ruta);
}

function instalarNavegacion() {
  window.addEventListener('hashchange', () => navegar(rutaDesdeHash()));
}

async function manejarSalir() {
  if (!confirm('¿Cerrar sesión?')) return;
  try {
    await detenerRealtime();
    await cerrarSesion();
  } catch (e) {
    log.warn('Error al cerrar sesión:', e.message);
  }
  location.hash = '';
  location.reload();
}

function construirShell(estadoSesion) {
  const app = document.getElementById('app');
  limpiarContenedor(app);

  const encabezado = h('header', { class: 'shell__header' },
    h('div', { class: 'shell__marca' },
      h('span', { class: 'shell__nombre' }, CONFIG.app.nombre),
      estadoSesion?.usuario
        ? h('span', { class: 'shell__usuario' }, estadoSesion.usuario.email)
        : null
    ),
    h('nav', { class: 'nav', id: 'nav' }),
    h('button', {
      type: 'button',
      class: 'shell__salir',
      onclick: manejarSalir,
    }, 'Salir')
  );

  const main = h('main', { class: 'shell__main', id: 'vistas' });

  app.append(encabezado, main);

  navContenedor = encabezado.querySelector('#nav');
  vistasContenedor = main;
  construirNav();
}

function mostrarLogin() {
  const app = document.getElementById('app');
  limpiarContenedor(app);

  const estado = h('p', { class: 'login__estado', role: 'status' });
  const form = h('form', { class: 'login', id: 'form-login' },
    h('h1', { class: 'login__titulo' }, CONFIG.app.nombre),
    h('p', { class: 'login__lead' }, 'Entra para acceder al espacio compartido.'),
    h('label', { class: 'login__label' }, '¿Quién eres?'),
    h('select', { name: 'email', class: 'login__campo', required: true },
      ...USUARIOS.map((u) => h('option', { value: u.email }, u.nombre))
    ),
    h('label', { class: 'login__label' }, 'Contraseña'),
    h('input', {
      type: 'password',
      name: 'password',
      class: 'login__campo',
      required: true,
      autocomplete: 'current-password',
    }),
    h('button', { type: 'submit', class: 'login__boton' }, 'Entrar'),
    estado
  );

  app.append(form);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '');
    const password = String(fd.get('password') || '');
    if (!email || !password) {
      estado.textContent = 'Completa todos los campos.';
      return;
    }
    estado.textContent = 'Entrando…';
    try {
      await iniciarSesion(email, password);
      estado.textContent = 'Bienvenido. Cargando espacio…';
      setTimeout(() => location.reload(), 300);
    } catch (e) {
      log.error('Error de login:', e.message);
      estado.textContent = 'Error: ' + e.message;
    }
  });
}

async function principal() {
  try {
    validarConfig();
  } catch (e) {
    log.error('Config inválida:', e.message);
    document.getElementById('app').append(
      h('p', { class: 'error-fatal' }, 'Configuración inválida: ' + e.message)
    );
    return;
  }

  const estadoSesion = await arrancarSesion();

  if (!estadoSesion.exito) {
    log.warn('Sin sesión activa. Mostrando formulario de login.');
    mostrarLogin();
    return;
  }

  construirShell(estadoSesion);
  instalarNavegacion();
  await navegar(rutaDesdeHash());

  log.info('App lista. Espacio:', obtener('espacio')?.id);
  await iniciarRealtime(estadoSesion.espacio);
  log.info('Realtime activo');
}

principal().catch((e) => {
  log.error('Error fatal:', e);
  const app = document.getElementById('app');
  if (app) {
    limpiarContenedor(app);
    app.append(h('p', { class: 'error-fatal' }, 'Error fatal: ' + e.message));
  }
});