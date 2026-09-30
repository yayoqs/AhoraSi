/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/app.js
   Versión: 4.0.6
   Propósito: punto de entrada. Arranca sesión, monta el shell
              con topbar + chips + tabbar inferior, monta/desmonta
              las vistas, aplica el acento dinámico por vista,
              monta el botón flotante contextual, aplica el modo
              noche y mantiene Realtime activo mientras hay sesión.
              v4.0.6: login rediseñado (variante A minimalista).
                      Título terracota con punto, tarjetas de
                      usuario con check animado, campo de
                      contraseña colapsable, dedicatoria al pie.
                      Se renombran las clases internas:
                      login__caja → login__form,
                      login__inicial → login__avatar,
                      login__usuario-nombre → login__nombre,
                      se agrega login__marca y login__pie,
                      se elimina login__paso (ya no aplica).
              v4.0.5: el botón "⋮" del topbar ya no navega directo
                      a Cuenta. Ahora abre un menú con dos opciones:
                      "Mi cuenta" y "Anexos". Se cierra al tocar
                      fuera, al tocar de nuevo el botón, con Escape,
                      o al navegar. El botón se oculta cuando ya
                      estás en Cuenta o Anexos. Se registra la
                      sub-vista "anexos" con padre "cuenta". La
                      sección de anexos de la vista Carta se
                      elimina en carta.js v4.0.2.
              v4.0.4: se registra el comando 'app:cerrar-sesion'.
              v4.0.3: se agrega soporte de sub-vistas.
              v4.0.2: reubicación de vistas (Kit y Recetas).
              v4.0.1: primer grupo se llama Nido.
              v4.0.0: shell nuevo.
              v3.0.0: tabbar inferior.
              v2.14.0: vista Recetas.
              v2.13.0: vista Juegos.
              v2.12.0: vista Series.
              v2.11.0: vista Mapa.
              v2.10.0: vista Ideas.
              v2.9.0: hero como primera vista.
              v2.8.0: login rediseñado.
              v2.7.0: manejarSalir() con mostrarConfirmacion().
              v2.6.0: navegar() e iniciarRealtime() no bloquean.
              v1.0.0: verificación de arranque.
   ================================================================ */

import { CONFIG, validarConfig } from './config/config.js';
import { crearLogger } from './nucleo/logger.js';
import { arrancar as arrancarSesion } from './arranque/sesion-inicial.js';
import { iniciarSesion, cerrarSesion } from './datos/sesion.js';
import { iniciar as iniciarRealtime, detener as detenerRealtime } from './datos/realtime.js';
import { obtener, establecer } from './nucleo/almacen.js';
import { al } from './nucleo/bus-eventos.js';
import { registrar } from './nucleo/bus-comandos.js';
import { h, limpiarContenedor } from './nucleo/utils.js';
import { mostrarConfirmacion } from './nucleo/dialogos.js';

import * as vistaHero from './vistas/hero.js';
import * as vistaCarta from './vistas/carta.js';
import * as vistaPlanes from './vistas/planes.js';
import * as vistaIdeas from './vistas/ideas.js';
import * as vistaHitos from './vistas/hitos.js';
import * as vistaKit from './vistas/kit.js';
import * as vistaRecetas from './vistas/recetas.js';
import * as vistaMapa from './vistas/mapa.js';
import * as vistaFauna from './vistas/fauna.js';
import * as vistaFlora from './vistas/flora.js';
import * as vistaSeries from './vistas/series.js';
import * as vistaJuegos from './vistas/juegos.js';
import * as vistaChistes from './vistas/chistes.js';
import * as vistaRetos from './vistas/retos.js';
import * as vistaPenitencias from './vistas/penitencias.js';
import * as vistaPreguntas from './vistas/preguntas.js';
import * as vistaApuestas from './vistas/apuestas.js';
import * as vistaPercusion from './vistas/percusion.js';
import * as vistaCuenta from './vistas/cuenta.js';
import * as vistaAnexos from './vistas/anexos.js';

const log = crearLogger('app');

/* ----------------------------------------------------------------
   VISTAS.
   - padre: si está definido, la vista es sub-vista de otra y el
            shell muestra botón volver sin tocar los chips.
   ---------------------------------------------------------------- */

const VISTAS = {
  hero: {
    titulo: 'Bienvenida', grupo: null,
    modulo: vistaHero, oculta: true, acento: 'terracota',
  },
  carta: {
    titulo: 'Carta', grupo: 'nido',
    modulo: vistaCarta, acento: 'terracota',
  },
  recetas: {
    titulo: 'Recetas', grupo: 'vida',
    modulo: vistaRecetas, acento: 'terracota', flotante: true,
  },
  planes: {
    titulo: 'Planes', grupo: 'vida',
    modulo: vistaPlanes, acento: 'azul-piedra',
  },
  ideas: {
    titulo: 'Ideas', grupo: 'vida',
    modulo: vistaIdeas, acento: 'ciruela',
  },
  hitos: {
    titulo: 'Hitos', grupo: 'vida',
    modulo: vistaHitos, acento: 'mostaza',
  },
  mapa: {
    titulo: 'Mapa', grupo: 'afuera',
    modulo: vistaMapa, acento: 'azul-piedra',
  },
  kit: {
    titulo: 'Kit', grupo: 'afuera',
    modulo: vistaKit, acento: 'musgo',
  },
  fauna: {
    titulo: 'Fauna', grupo: 'afuera',
    modulo: vistaFauna, acento: 'musgo', flotante: true,
  },
  flora: {
    titulo: 'Flora', grupo: 'afuera',
    modulo: vistaFlora, acento: 'musgo', flotante: true,
  },
  series: {
    titulo: 'Series', grupo: 'juegos',
    modulo: vistaSeries, acento: 'ciruela', flotante: true,
  },
  juegos: {
    titulo: 'Juegos', grupo: 'juegos',
    modulo: vistaJuegos, acento: 'ciruela',
  },
  chistes: {
    titulo: 'Chistes', grupo: 'juegos', padre: 'juegos',
    modulo: vistaChistes, acento: 'mostaza',
  },
  retos: {
    titulo: 'Retos', grupo: 'juegos', padre: 'juegos',
    modulo: vistaRetos, acento: 'azul-piedra',
  },
  penitencias: {
    titulo: 'Penitencias', grupo: 'juegos', padre: 'juegos',
    modulo: vistaPenitencias, acento: 'terracota',
  },
  preguntas: {
    titulo: 'Preguntas', grupo: 'juegos', padre: 'juegos',
    modulo: vistaPreguntas, acento: 'musgo',
  },
  apuestas: {
    titulo: 'Apuestas', grupo: 'juegos', padre: 'juegos',
    modulo: vistaApuestas, acento: 'ciruela',
  },
  percusion: {
    titulo: 'Percusión', grupo: 'juegos',
    modulo: vistaPercusion, acento: 'mostaza',
  },
  cuenta: {
    titulo: 'Mi cuenta', grupo: 'mas',
    modulo: vistaCuenta, acento: 'terracota',
  },
  anexos: {
    titulo: 'Anexos', grupo: 'mas', padre: 'cuenta',
    modulo: vistaAnexos, acento: 'terracota',
  },
};

/* ----------------------------------------------------------------
   GRUPOS.
   ---------------------------------------------------------------- */

const ICONO_NIDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
const ICONO_VIDA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M4 17a3 3 0 0 1 3-3h11"/></svg>';
const ICONO_AFUERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18L14 8l-3 5-2-3-6 10z"/></svg>';
const ICONO_JUEGOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/></svg>';
const ICONO_MAS = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';

const ICONO_PERSONA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6"/></svg>';
const ICONO_ANEXO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
const ICONO_MENU = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';

const GRUPOS = {
  nido:   { titulo: 'Nido',   icono: ICONO_NIDO,   vistas: ['carta'] },
  vida:   { titulo: 'Vida',   icono: ICONO_VIDA,   vistas: ['recetas', 'planes', 'ideas', 'hitos'] },
  afuera: { titulo: 'Afuera', icono: ICONO_AFUERA, vistas: ['mapa', 'kit', 'fauna', 'flora'] },
  juegos: { titulo: 'Juegos', icono: ICONO_JUEGOS, vistas: ['series', 'juegos', 'percusion'] },
  mas:    { titulo: 'Más',    icono: ICONO_MAS,    vistas: ['cuenta'] },
};

const ORDEN_GRUPOS = ['nido', 'vida', 'afuera', 'juegos', 'mas'];

const RUTA_DEFECTO = 'carta';
const CLAVE_HERO_VISTO = 'ahorasi:heroVisto';
const CLAVE_MODO_NOCHE = 'ahorasi:modoNoche';

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
let vistaActivaId = null;
let headerContenedor = null;
let chipsContenedor = null;
let vistasContenedor = null;
let tabbarContenedor = null;
let botonFlotanteEl = null;
let menuEl = null;
let botonMenuEl = null;
let usuarioElegido = null;

/* ----------------------------------------------------------------
   Utilidades.
   ---------------------------------------------------------------- */

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

function leerModoNocheDeDisco() {
  try {
    return localStorage.getItem(CLAVE_MODO_NOCHE) === '1';
  } catch (e) {
    return false;
  }
}

function aplicarModoNoche(activo) {
  document.body.classList.toggle('modo-noche', !!activo);
}

function rutaInicial() {
  const hash = (location.hash || '').replace('#', '').trim();
  if (hash === 'hero' && heroVisto()) return RUTA_DEFECTO;
  if (VISTAS[hash] && !VISTAS[hash].oculta) return hash;
  if (!heroVisto()) return 'hero';
  return RUTA_DEFECTO;
}

function rutaDesdeHash() {
  const hash = (location.hash || '').replace('#', '').trim();
  if (VISTAS[hash] && !VISTAS[hash].oculta) return hash;
  return RUTA_DEFECTO;
}

function grupoDe(vistaId) {
  return VISTAS[vistaId]?.grupo || null;
}

function padreDe(vistaId) {
  return VISTAS[vistaId]?.padre || null;
}

function aplicarAcento(vistaId) {
  const v = VISTAS[vistaId];
  if (!v || !v.acento) return;
  document.documentElement.style.setProperty('--accent', `var(--${v.acento})`);
}

/* ----------------------------------------------------------------
   Menú del botón "⋮".
   ---------------------------------------------------------------- */

function abrirMenu() {
  if (!menuEl) return;
  menuEl.classList.add('is-open');
}

function cerrarMenu() {
  if (!menuEl) return;
  menuEl.classList.remove('is-open');
}

function menuEstaAbierto() {
  return menuEl && menuEl.classList.contains('is-open');
}

function alternarMenu() {
  if (menuEstaAbierto()) cerrarMenu();
  else abrirMenu();
}

function construirMenu() {
  const menu = h('div', { class: 'shell__menu', role: 'menu' });

  menu.append(
    h('button', {
      type: 'button',
      class: 'shell__menu-item',
      'data-destino': 'cuenta',
      role: 'menuitem',
      onclick: () => { cerrarMenu(); navegar('cuenta'); },
    },
      h('span', { class: 'shell__menu-icono', html: ICONO_PERSONA }),
      h('span', {}, 'Mi cuenta')
    ),
    h('button', {
      type: 'button',
      class: 'shell__menu-item',
      'data-destino': 'anexos',
      role: 'menuitem',
      onclick: () => { cerrarMenu(); navegar('anexos'); },
    },
      h('span', { class: 'shell__menu-icono', html: ICONO_ANEXO }),
      h('span', {}, 'Anexos')
    )
  );

  return menu;
}

/* ----------------------------------------------------------------
   Header.
   ---------------------------------------------------------------- */

function construirHeader(estadoSesion) {
  limpiarContenedor(headerContenedor);

  const nombreVisible = estadoSesion?.perfil?.nombre
    || estadoSesion?.usuario?.email
    || '';

  const botonVolver = h('button', {
    type: 'button',
    class: 'shell__btn-volver',
    'aria-label': 'Volver',
    hidden: '',
  });
  botonVolver.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M15 6l-6 6 6 6"/></svg>';
  botonVolver.addEventListener('click', () => {
    const padre = padreDe(vistaActivaId);
    if (padre) navegar(padre);
  });

  const eyebrow = h('p', { class: 'shell__eyebrow' }, '');
  const titulo = h('h1', { class: 'shell__titulo' }, '');

  const izquierda = h('div', { class: 'shell__header-izq' }, botonVolver, h('div', {}, eyebrow, titulo));

  const botonMenu = h('button', {
    type: 'button',
    class: 'shell__btn-cuenta',
    title: nombreVisible,
    'aria-label': 'Opciones',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
    onclick: (ev) => {
      ev.stopPropagation();
      alternarMenu();
      botonMenu.setAttribute('aria-expanded', String(menuEstaAbierto()));
    },
  });
  botonMenu.innerHTML = ICONO_MENU;

  const menu = construirMenu();

  const acciones = h('div', { class: 'shell__acciones-cuenta' }, botonMenu, menu);

  const topbarRow = h('div', { class: 'shell__topbar-row' }, izquierda, acciones);
  const topbar = h('div', { class: 'shell__topbar' }, topbarRow);

  const chips = h('nav', { class: 'shell__chips', id: 'chips' });

  headerContenedor.append(topbar, chips);
  chipsContenedor = chips;
  headerContenedor._botonVolver = botonVolver;
  botonMenuEl = botonMenu;
  menuEl = menu;
}

function pintarHeader(vistaId) {
  const vista = VISTAS[vistaId];
  if (!vista) return;

  const grupo = grupoDe(vistaId);
  const padre = padreDe(vistaId);
  const grupoTitulo = grupo ? GRUPOS[grupo].titulo : '';

  const eyebrow = headerContenedor.querySelector('.shell__eyebrow');
  const titulo = headerContenedor.querySelector('.shell__titulo');
  const botonVolver = headerContenedor._botonVolver;

  if (padre) {
    // Sub-vista: eyebrow dice "Grupo · Vista".
    if (eyebrow) eyebrow.textContent = `${grupoTitulo} · ${vista.titulo}`;
    if (titulo) titulo.textContent = vista.titulo;
    if (botonVolver) botonVolver.hidden = false;
  } else {
    if (eyebrow) eyebrow.textContent = grupoTitulo;
    if (titulo) titulo.textContent = vista.titulo;
    if (botonVolver) botonVolver.hidden = true;
  }

  // El botón "⋮" se oculta cuando la vista activa ya es Cuenta o Anexos.
  const ocultarMenu = vistaId === 'cuenta' || vistaId === 'anexos';
  if (botonMenuEl) botonMenuEl.hidden = ocultarMenu;

  // Chips del grupo. Nunca se muestran para sub-vistas.
  limpiarContenedor(chipsContenedor);
  if (padre || !grupo) {
    chipsContenedor.hidden = true;
    return;
  }

  const vistasDelGrupo = GRUPOS[grupo].vistas;
  if (vistasDelGrupo.length <= 1) {
    chipsContenedor.hidden = true;
    return;
  }

  chipsContenedor.hidden = false;
  for (const id of vistasDelGrupo) {
    chipsContenedor.append(h('button', {
      type: 'button',
      class: 'shell__chip' + (id === vistaId ? ' activo' : ''),
      'data-vista': id,
      onclick: () => navegar(id),
    }, VISTAS[id].titulo));
  }
}

/* ----------------------------------------------------------------
   Tabbar.
   ---------------------------------------------------------------- */

function pintarTabbar(vistaId) {
  limpiarContenedor(tabbarContenedor);

  const grupoActivo = grupoDe(vistaId);

  for (const grupoId of ORDEN_GRUPOS) {
    const grupo = GRUPOS[grupoId];
    const boton = h('button', {
      type: 'button',
      class: 'tabbar__item' + (grupoId === grupoActivo ? ' activo' : ''),
      'data-grupo': grupoId,
      'aria-label': grupo.titulo,
      onclick: () => navegarAlGrupo(grupoId),
    });
    boton.innerHTML = grupo.icono + `<span class="tabbar__label">${grupo.titulo}</span>`;
    tabbarContenedor.append(boton);
  }
}

function navegarAlGrupo(grupoId) {
  const grupo = GRUPOS[grupoId];
  if (!grupo) return;
  if (grupoDe(vistaActivaId) === grupoId) return;
  const primera = grupo.vistas[0];
  if (primera) navegar(primera);
}

/* ----------------------------------------------------------------
   Botón flotante.
   ---------------------------------------------------------------- */

function crearBotonFlotante() {
  const btn = h('button', {
    type: 'button',
    class: 'boton-flotante',
    'aria-label': 'Añadir',
    onclick: () => dispararAbrirFormulario(),
  });
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  return btn;
}

function montarBotonFlotante() {
  quitarBotonFlotante();
  const v = VISTAS[vistaActivaId];
  if (!v?.flotante) return;
  botonFlotanteEl = crearBotonFlotante();
  document.body.append(botonFlotanteEl);
}

function quitarBotonFlotante() {
  if (botonFlotanteEl && botonFlotanteEl.parentNode) {
    botonFlotanteEl.remove();
  }
  botonFlotanteEl = null;
}

function dispararAbrirFormulario() {
  if (!vistasContenedor) return;
  const btn = vistasContenedor.querySelector('[data-accion="abrir-formulario"]');
  if (btn) {
    btn.click();
  } else {
    log.warn('La vista', vistaActivaId, 'no tiene botón [data-accion="abrir-formulario"]');
  }
}

/* ----------------------------------------------------------------
   Montaje y navegación.
   ---------------------------------------------------------------- */

async function montarVista(ruta) {
  const config = VISTAS[ruta];
  if (!config) return;
  vistaActiva = config;
  vistaActivaId = ruta;
  try {
    await config.modulo.activar(vistasContenedor);
  } catch (e) {
    log.error('Error al montar vista:', ruta, e.message);
    limpiarContenedor(vistasContenedor);
    vistasContenedor.append(h('p', { class: 'vista-error' }, 'Error al cargar la vista: ' + e.message));
  }
}

function navegar(ruta) {
  if (!VISTAS[ruta] || VISTAS[ruta].oculta) ruta = RUTA_DEFECTO;

  cerrarMenu();

  if (vistaActiva) {
    try {
      vistaActiva.modulo.limpiar();
    } catch (e) {
      log.error('Error al limpiar vista:', vistaActiva.titulo, e.message);
    }
    vistaActiva = null;
    limpiarContenedor(vistasContenedor);
  }

  if (ruta !== 'hero') marcarHeroVisto();
  aplicarAcento(ruta);
  montarVista(ruta).catch((e) => log.error('Error al montar vista:', e));

  pintarHeader(ruta);
  pintarTabbar(ruta);
  montarBotonFlotante();
}

function instalarNavegacion() {
  window.addEventListener('hashchange', () => navegar(rutaDesdeHash()));
}

/* ----------------------------------------------------------------
   Shell.
   ---------------------------------------------------------------- */

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

  const header = h('header', { class: 'shell__header' });
  const main = h('main', { class: 'shell__main', id: 'vistas' });
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Navegación principal' });

  const shell = h('div', { class: 'shell' }, header, main, tabbar);
  app.append(shell);

  headerContenedor = header;
  vistasContenedor = main;
  tabbarContenedor = tabbar;

  construirHeader(estadoSesion);

  al('almacen:perfil', ({ valor }) => {
    if (valor?.nombre && botonMenuEl) {
      botonMenuEl.title = valor.nombre;
    }
  });

  // Cierre del menú al tocar fuera o con Escape.
  document.addEventListener('click', (ev) => {
    if (!menuEstaAbierto()) return;
    if (ev.target.closest('.shell__menu')) return;
    if (ev.target.closest('.shell__btn-cuenta')) return;
    cerrarMenu();
    if (botonMenuEl) botonMenuEl.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && menuEstaAbierto()) {
      cerrarMenu();
      if (botonMenuEl) botonMenuEl.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ----------------------------------------------------------------
   Modo noche.
   ---------------------------------------------------------------- */

function inicializarModoNoche() {
  const activo = leerModoNocheDeDisco();
  establecer('modoNoche', activo);
  aplicarModoNoche(activo);
  al('almacen:modoNoche', ({ valor }) => aplicarModoNoche(valor));
}

/* ----------------------------------------------------------------
   Login.
   ---------------------------------------------------------------- */

function mostrarLogin() {
  const app = document.getElementById('app');
  if (!app) {
    log.warn('No existe #app para mostrar el login.');
    return;
  }
  limpiarContenedor(app);

  usuarioElegido = null;

  const estado = h('p', { class: 'login__estado', role: 'status' });

  const formCampo = h('div', { class: 'login__campo-grupo' });
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
  formCampo.append(campoPassword, botonEntrar);

  const eleccion = h('div', { class: 'login__eleccion' });

  function pintarEleccion() {
    limpiarContenedor(eleccion);
    for (const u of USUARIOS) {
      const marca = h('span', { class: 'login__marca', 'aria-hidden': 'true' });
      marca.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';

      eleccion.append(h('button', {
        type: 'button',
        class: `login__usuario ${u.clase}`,
        'data-usuario': u.id,
        'aria-pressed': String(usuarioElegido === u.id),
        onclick: () => {
          usuarioElegido = usuarioElegido === u.id ? null : u.id;
          pintarEleccion();
          formCampo.classList.toggle('login__campo-grupo--visible', !!usuarioElegido);
          if (usuarioElegido) setTimeout(() => campoPassword.focus(), 320);
        },
      },
        marca,
        h('span', { class: 'login__avatar', 'aria-hidden': 'true' }, u.inicial),
        h('span', { class: 'login__nombre' }, u.nombre)
      ));
    }
  }
  pintarEleccion();

  const form = h('form', { class: 'login__form' },
    h('header', { class: 'login__cabecera' },
      h('h1', { class: 'login__titulo' }, CONFIG.app.nombre),
      h('p', { class: 'login__lead' }, 'Un espacio para los dos.')
    ),
    h('span', { class: 'login__etiqueta' }, '¿Quién eres?'),
    eleccion,
    formCampo,
    estado
  );

  const pie = h('div', { class: 'login__pie' }, 'de mí, para ti, para nosotros');

  const wrap = h('div', { class: 'login' }, form, pie);
  app.append(wrap);

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

/* ----------------------------------------------------------------
   Arranque.
   ---------------------------------------------------------------- */

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

  inicializarModoNoche();

  // Comando de cierre de sesión. Lo usa la vista Cuenta.
  registrar('app:cerrar-sesion', manejarSalir);

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