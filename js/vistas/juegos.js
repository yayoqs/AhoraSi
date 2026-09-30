/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/juegos.js
   Versión: 2.0.0
   Propósito: hub del grupo Juegos. Muestra cinco cards que
              llevan a las sub-vistas: Chistes, Retos,
              Penitencias, Preguntas, Apuestas.
              v2.0.0: se reescribe por completo. La vista ya no
                      contiene los cinco mini-juegos. Ahora es
                      solo un hub que muestra tarjetas con
                      contador. Cada tarjeta navega a la
                      sub-vista correspondiente. Se eliminan
                      todos los imports de repositorios (los
                      consume cada sub-vista).
              v1.2.0: Chistes va primero en los tabs y es la
                      sección por defecto.
              v1.1.0: se agrega el tab Chistes.
              v1.0.0: versión inicial con cuatro secciones.
   ================================================================ */

import * as repoRetos from '../datos/repositorios/retos.js';
import * as repoPenitencias from '../datos/repositorios/penitencias.js';
import * as repoPreguntas from '../datos/repositorios/preguntas.js';
import * as repoApuestas from '../datos/repositorios/apuestas.js';
import * as repoChistes from '../datos/repositorios/chistes.js';
import { al } from '../nucleo/bus-eventos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:juegos');

const SUBS = [
  {
    id: 'chistes',
    emoji: '😄',
    titulo: 'Chistes',
    descripcion: 'Fomes, cortos, para repetir.',
    tema: 'chiste',
  },
  {
    id: 'retos',
    emoji: '🎯',
    titulo: 'Retos',
    descripcion: 'Cosas que se tiran entre los dos.',
    tema: 'reto',
  },
  {
    id: 'penitencias',
    emoji: '✋',
    titulo: 'Penitencias',
    descripcion: 'Cosas que uno le debe al otro.',
    tema: 'penitencia',
  },
  {
    id: 'preguntas',
    emoji: '💭',
    titulo: 'Preguntas',
    descripcion: 'Para sacar del sombrero.',
    tema: 'pregunta',
  },
  {
    id: 'apuestas',
    emoji: '🎲',
    titulo: 'Apuestas',
    descripcion: 'Quién tiene razón, quién paga.',
    tema: 'apuesta',
  },
];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  conteos: {
    chistes: 0,
    retos: 0,
    penitencias: 0,
    preguntas: 0,
    apuestas: 0,
  },
  pendientesRetos: 0,
  pendientesPenitencias: 0,
  sinResolverApuestas: 0,
};

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-juegos', class: 'vista vista--juegos' });

  raiz.append(h('p', { class: 'hub-lead' },
    'Cinco mini-cosas entre los dos. Entra a cualquiera cuando quieras.'));

  const hub = h('div', { class: 'hub' });

  for (const sub of SUBS) {
    const card = h('button', {
      type: 'button',
      class: `hub-card hub-card--${sub.tema}`,
      'data-accion': 'ir-a',
      'data-vista': sub.id,
    });

    card.append(h('span', { class: 'hub-card__emoji' }, sub.emoji));
    card.append(h('span', { class: 'hub-card__titulo' }, sub.titulo));
    card.append(h('span', { class: 'hub-card__cuenta' }, textoCuenta(sub.id)));

    // Badge de pendientes para retos, penitencias y apuestas.
    if (sub.id === 'retos' && registro.pendientesRetos > 0) {
      card.append(h('span', { class: 'hub-card__pendientes' },
        `${registro.pendientesRetos} pendientes`));
    }
    if (sub.id === 'penitencias' && registro.pendientesPenitencias > 0) {
      card.append(h('span', { class: 'hub-card__pendientes' },
        `${registro.pendientesPenitencias} pendiente${registro.pendientesPenitencias > 1 ? 's' : ''}`));
    }
    if (sub.id === 'apuestas' && registro.sinResolverApuestas > 0) {
      card.append(h('span', { class: 'hub-card__pendientes' },
        `${registro.sinResolverApuestas} sin resolver`));
    }

    // Apuestas ocupa todo el ancho por ser el último.
    if (sub.id === 'apuestas') card.classList.add('hub-card--ancho');

    hub.append(card);
  }

  raiz.append(hub);
  cont.append(raiz);
}

function textoCuenta(id) {
  const n = registro.conteos[id];
  if (n === 0) return 'vacío';
  if (n === 1) return '1 guardado';
  return `${n} guardados`;
}

function manejarClick(ev) {
  const btn = ev.target.closest('[data-accion="ir-a"]');
  if (!btn) return;
  const id = btn.dataset.vista;
  if (!id) return;
  // Navega cambiando el hash, que dispara el listener del shell.
  location.hash = '#' + id;
}

/* ---------- Refresco de conteos ------------------------------- */

async function refrescarConteos() {
  const [rCh, rRe, rPe, rPr, rAp] = await Promise.all([
    repoChistes.listar(),
    repoRetos.listar(),
    repoPenitencias.listar(),
    repoPreguntas.listar(),
    repoApuestas.listar(),
  ]);

  registro.conteos.chistes = rCh.exito ? rCh.datos.length : 0;
  registro.conteos.retos = rRe.exito ? rRe.datos.length : 0;
  registro.conteos.penitencias = rPe.exito ? rPe.datos.length : 0;
  registro.conteos.preguntas = rPr.exito ? rPr.datos.length : 0;
  registro.conteos.apuestas = rAp.exito ? rAp.datos.length : 0;

  registro.pendientesRetos = rRe.exito
    ? rRe.datos.filter((x) => x.estado === 'propuesto').length
    : 0;

  registro.pendientesPenitencias = rPe.exito
    ? rPe.datos.filter((x) => x.estado === 'pendiente').length
    : 0;

  registro.sinResolverApuestas = rAp.exito
    ? rAp.datos.filter((x) => x.estado === 'pendiente').length
    : 0;

  pintar();
}

/* ---------- Ciclo de vida ------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();

  const { signal } = registro.abortador;
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:chistes:crear', refrescarConteos),
    al('realtime:chistes:eliminar', refrescarConteos),
    al('realtime:retos:crear', refrescarConteos),
    al('realtime:retos:actualizar', refrescarConteos),
    al('realtime:retos:eliminar', refrescarConteos),
    al('realtime:penitencias:crear', refrescarConteos),
    al('realtime:penitencias:actualizar', refrescarConteos),
    al('realtime:penitencias:eliminar', refrescarConteos),
    al('realtime:preguntas:crear', refrescarConteos),
    al('realtime:preguntas:eliminar', refrescarConteos),
    al('realtime:apuestas:crear', refrescarConteos),
    al('realtime:apuestas:actualizar', refrescarConteos),
    al('realtime:apuestas:eliminar', refrescarConteos),
  ];

  pintar();
  await refrescarConteos();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.conteos = { chistes: 0, retos: 0, penitencias: 0, preguntas: 0, apuestas: 0 };
  registro.pendientesRetos = 0;
  registro.pendientesPenitencias = 0;
  registro.sinResolverApuestas = 0;
  registro.contenedor = null;
}