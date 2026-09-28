/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/app.js
   Versión: 2.14.0
   Propósito: punto de entrada. Arranca sesión, monta el shell
              de navegación por hash, monta/desmonta las vistas, y
              mantiene Realtime activo mientras hay sesión.
              v2.14.0: se agrega la vista Recetas al nav, después
                      de Juegos.
              v2.13.0: vista Juegos. Typo "dialago" corregido.
              v2.12.0: vista Series.
              v2.11.0: vista Mapa.
              v2.10.0: vista Ideas.
              v2.9.0: hero como primera vista.
              v2.8.0: login rediseñado, Mi cuenta, nombre visible.
              v2.7.0: manejarSalir() con mostrarConfirmacion().
              v2.6.0: navegar() e iniciarRealtime() no bloquean.
              v2.5.x: Realtime al arrancar y al cerrar sesión.
              v2.4.x: percusión, carta, respuesta, hitos, kit,
                      fauna, flora, botón Salir.
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
import { al } from './nucleo/bus-eventos.js';
import { h, limpiarContenedor } from './nucleo/utils.js';
import { mostrarConfirmacion } from './nucleo/dialogos.js';

import * as vistaHero from './vistas/hero.js';
import * as vistaCarta from './vistas/carta.js';
import * as vistaPlanes from './vistas/planes.js';
import * as vistaIdeas from './vistas/ideas.js';
import * as vistaHitos from './vistas/hitos.js';
import * as vistaKit from './vistas/kit.js';
import * as vistaFauna from './vistas/fauna.js';
import * as vistaFlora from './vistas/flora.js';
import * as vistaMapa from './vistas/mapa.js';
import * as vistaSeries from './vistas/series.js';
import * as vistaJuegos from './vistas/juegos.js';
import * as vistaRecetas from './vistas/recetas.js';
import * as vistaRespuesta from './vistas/respuesta.js';
import * as vistaPercusion from './vistas/percusion.js';
import * as vistaCuenta from './vistas/cuenta.js';

const log = crearLogger('app');

const VISTAS = {
  hero: { titulo: 'Bienvenida', modulo: vistaHero, oculta: true },
  carta: { titulo: 'Carta', modulo: vistaCarta },
  planes: { titulo: 'Planes', modulo: vistaPlanes },
  ideas: { titulo: 'Ideas', modulo: vistaIdeas },
  hitos: { titulo: 'Hitos', modulo: vistaHitos },
  kit: { titulo: 'Kit', modulo: vistaKit },
  fauna: { titulo: 'Fauna', modulo: vistaFauna },
  flora: { titulo: 'Flora', modulo: vistaFlora },
  mapa: { titulo: 'Mapa', modulo: vistaMapa },
  series: { titulo: 'Series', modulo: vistaSeries },
  juegos: { titulo: 'Juegos', modulo: vistaJuegos },
  recetas: { titulo: 'Recetas', modulo: vistaRecetas },
  percusion: { titulo: 'Percusión', modulo: vistaPercusion },
  respuesta: { titulo: 'Respuesta', modulo: vistaRespuesta },
  cuenta: { titulo: 'Mi cuenta', modulo: vistaCuenta, oculta: true },
};

const RUTA_DEFECTO = 'carta';
const CLAVE_HERO_VISTO = 'ahorasi:heroVisto';

const USUARIOS = [
  {
    id: 'luci',
    nombre: 'Luci',
    email: 'luciviteri@elisekai.com',
    clase: 'login__usuario--luci',
    inicial: 'L',
  },
  {
    id: 'yayo',
    nombre: 'Yayo',
    email: 'yayoqs@elisekai.com',
    clase: 'login__usuario--yayo',
    inicial: 'Y',
  },
];

let vistaActiva = null;
let navContenedor = null;
let vistasContenedor = null;
let usuarioElegido = null;

function heroVisto() {
  try {
    return localStorage.getItem(CLAVE_HERO_VISTO) === '1';
  } catch (e) {
    return true;
  }
}

function marcarHeroVisto() {
  try {
    localStorage.setItem(CLAVE_HERO_VISTO, '1');
  } catch (e) {
    // silencioso
  }
}

function rutaInicial() {
  const hash = (location.hash || '').replace('#', '').trim();
  if (hash === 'hero' && heroVisto()) return RUTA_DEFECTO;
  if (VISTAS[hash]) return hash;
  if (!heroVisto()) return 'hero';
  return RUTA_DEFECTO;
}

function rutaDesdeHash() {
  const hash = (location.hash || '').replace('#', '').trim();
  return VISTAS[hash] ? hash : RUTA_DEFECTO;
}

function construirNav() {
  limpiarContenedor(navContenedor);
  for (const [id, ruta] of Object.entries(VISTAS)) {
    if (ruta.oculta) continue;
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

function navegar(ruta) {
  if (vistaActiva) {
    try {
      vistaActiva.modulo.limpiar();
    } catch (e) {
      log.error('Error al limpiar vista:', vistaActiva.titulo, e.message);
    }
    vistaActiva = null;
    limpiarContenedor(vistasContenedor);
  }

  if (ruta !== 'hero') {
    marcarHeroVisto();
  }

  montarVista(ruta).catch((e) => log.error('Error al montar vista:', e));
  marcarNavActiva(ruta);
}

function instalarNavegacion() {
  window.addEventListener('hashchange', () => navegar(rutaDesdeHash()));
}

async function manejarSalir() {
  const confirmado = await mostrarConfirmacion(
    'Cerrar sesión',
    '¿Seguro que quieres cerrar la sesión?',
    { textoConfirmar: 'Cerrar sesión', claseConfirmar: 'dialogo__boton--primario' }
  );
  if (!confirmado) return;
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
  if (!app) {
    log.warn('No existe #app en el DOM. Ignorando montaje del shell.');
    return;
  }
  limpiarContenedor(app);

  const nombreVisible = estadoSesion?.perfil?.nombre
    || estadoSesion?.usuario?.email
    || '';
  const spanUsuario = h('span', { class: 'shell__usuario' }, nombreVisible);

  const encabezado = h('header', { class: 'shell__header' },
    h('div', { class: 'shell__marca' },
      h('span', { class: 'shell__nombre' }, CONFIG.app.nombre),
      spanUsuario
    ),
    h('nav', { class: 'nav', id: 'nav' }),
    h('div', { class: 'shell__acciones' },
      h('button', {
        type: 'button',
        class: 'shell__cuenta',
        onclick: () => { location.hash = '#cuenta'; },
      }, 'Mi cuenta'),
      h('button', {
        type: 'button',
        class: 'shell__salir',
        onclick: manejarSalir,
      }, 'Salir')
    )
  );

  const main = h('main', { class: 'shell__main', id: 'vistas' });

  app.append(encabezado, main);

  navContenedor = encabezado.querySelector('#nav');
  vistasContenedor = main;
  construirNav();

  al('almacen:perfil', ({ valor }) => {
    if (valor?.nombre) spanUsuario.textContent = valor.nombre;
  });
}

function mostrarLogin() {
  const app = document.getElementById('app');
  if (!app) {
    log.warn('No existe #app para mostrar el login.');
    return;
  }
  limpiarContenedor(app);

  usuarioElegido = null;

  const estado = h('p', { class: 'login__estado', role: 'status' });

  const grupoCampo = h('div', { class: 'login__campo-grupo' });
  const campoPassword = h('input', {
    type: 'password',
    name: 'password',
    class: 'login__campo',
    placeholder: 'Contraseña',
    autocomplete: 'current-password',
  });
  const botonEntrar = h('button', {
    type: 'submit',
    class: 'login__boton',
  }, 'Entrar');
  grupoCampo.append(campoPassword, botonEntrar);

  const eleccion = h('div', { class: 'login__eleccion' });

  function pintarEleccion() {
    limpiarContenedor(eleccion);
    for (const u of USUARIOS) {
      eleccion.append(h('button', {
        type: 'button',
        class: `login__usuario ${u.clase}`,
        'data-usuario': u.id,
        'aria-pressed': String(usuarioElegido === u.id),
        onclick: () => {
          usuarioElegido = usuarioElegido === u.id ? null : u.id;
          pintarEleccion();
          grupoCampo.classList.toggle('login__campo-grupo--visible', !!usuarioElegido);
          if (usuarioElegido) setTimeout(() => campoPassword.focus(), 60);
        },
      },
        h('span', { class: 'login__inicial', 'aria-hidden': 'true' }, u.inicial),
        h('span', { class: 'login__usuario-nombre' }, u.nombre)
      ));
    }
  }
  pintarEleccion();

  const form = h('form', { class: 'login__caja' },
    h('header', { class: 'login__cabecera' },
      h('h1', { class: 'login__titulo' }, CONFIG.app.nombre),
      h('p', { class: 'login__lead' }, 'Un espacio de los dos.')
    ),
    h('div', { class: 'login__paso' },
      h('p', { class: 'login__etiqueta' }, '¿Quién eres?'),
      eleccion
    ),
    h('div', { class: 'login__paso' },
      grupoCampo
    ),
    estado
  );

  app.append(form);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const password = campoPassword.value;
    if (!usuarioElegido) {
      estado.textContent = 'Elige quién eres.';
      return;
    }
    if (!password) {
      estado.textContent = 'Escribe la contraseña.';
      return;
    }
    const usuario = USUARIOS.find((u) => u.id === usuarioElegido);
    if (!usuario) return;

    estado.textContent = 'Entrando…';
    try {
      await iniciarSesion(usuario.email, password);
      estado.textContent = 'Bienvenido. Cargando espacio…';
      setTimeout(() => location.reload(), 300);
    } catch (e) {
      log.error('Error de login:', e.message);
      estado.textContent = 'Contraseña incorrecta.';
    }
  });
}

async function principal() {
  const app = document.getElementById('app');
  if (!app) {
    log.warn('No existe #app. Ignorando arranque de la app.');
    return;
  }

  try {
    validarConfig();
  } catch (e) {
    log.error('Config inválida:', e.message);
    app.append(
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

  navegar(rutaInicial());

  log.info('App lista. Espacio:', obtener('espacio')?.id);

  iniciarRealtime(estadoSesion.espacio)
    .then(() => log.info('Realtime activo'))
    .catch((e) => log.error('Error al iniciar Realtime:', e.message));
}

principal().catch((e) => {
  log.error('Error fatal:', e);
  const app = document.getElementById('app');
  if (app) {
    limpiarContenedor(app);
    app.append(h('p', { class: 'error-fatal' }, 'Error fatal: ' + e.message));
  }
});