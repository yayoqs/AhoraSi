/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/juegos.js
   Versión: 1.2.0
   Propósito: vista de juegos. Cinco secciones con tabs: Chistes,
              Retos, Penitencias, Preguntas, Apuestas.
              v1.2.0: Chistes va primero en los tabs y es la
                      sección por defecto. Se quita el contador
                      y la lista de chistes: solo vive el chiste
                      al azar y el formulario para agregar. Las
                      preguntas pierden el contador "Pregunta X
                      de Y" y la lista queda oculta hasta pulsar
                      "Ver todas las preguntas".
              v1.1.0: se agrega el tab Chistes.
              v1.0.0: versión inicial con cuatro secciones.
   ================================================================ */

import * as repoRetos from '../datos/repositorios/retos.js';
import * as repoPenitencias from '../datos/repositorios/penitencias.js';
import * as repoPreguntas from '../datos/repositorios/preguntas.js';
import * as repoApuestas from '../datos/repositorios/apuestas.js';
import * as repoChistes from '../datos/repositorios/chistes.js';
import { CONFIG } from '../config/config.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { obtener } from '../nucleo/almacen.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:juegos');

const TABS = [
  { id: 'chistes', etiqueta: 'Chistes' },
  { id: 'retos', etiqueta: 'Retos' },
  { id: 'penitencias', etiqueta: 'Penitencias' },
  { id: 'preguntas', etiqueta: 'Preguntas' },
  { id: 'apuestas', etiqueta: 'Apuestas' },
];

const registro = {
  contenedor: null,
  raiz: null,
  abortador: null,
  desuscribir: [],
  tab: 'chistes',
  formularioAbierto: false,
  retos: [],
  penitencias: [],
  preguntas: [],
  apuestas: [],
  chistes: [],
  preguntaActual: 0,
  chisteActualId: null,
  preguntasListaVisible: false,
};

function usuarioActualId() {
  const u = obtener('usuarioActual');
  return u?.$id || u?.id || null;
}

function otroUsuarioId() {
  const yo = usuarioActualId();
  if (yo === CONFIG.usuarios.yayo) return CONFIG.usuarios.luci;
  if (yo === CONFIG.usuarios.luci) return CONFIG.usuarios.yayo;
  return null;
}

function nombreDe(id) {
  if (id === CONFIG.usuarios.yayo) return 'Yayo';
  if (id === CONFIG.usuarios.luci) return 'Luci';
  if (id === 'empate') return 'Empate';
  return 'Desconocido';
}

/* ---------- Mensajes ------------------------------------------- */

function pintarError(mensaje) {
  const raiz = registro.raiz;
  if (!raiz) return;
  const error = h('p', { class: 'vista__error', role: 'alert' }, mensaje);
  raiz.prepend(error);
  setTimeout(() => error.remove(), 5000);
}

function pintarOk(mensaje) {
  const raiz = registro.raiz;
  if (!raiz) return;
  const ok = h('p', { class: 'vista__ok', role: 'status' }, mensaje);
  raiz.prepend(ok);
  setTimeout(() => ok.remove(), 3500);
}

/* ---------- Estructura ----------------------------------------- */

function montarEstructura() {
  const cont = registro.contenedor;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-juegos', class: 'vista vista--juegos' });
  raiz.append(
    h('header', { class: 'juegos__cabecera' },
      h('h1', {}, 'Juegos'),
      h('p', { class: 'vista__lead' },
        'Cosas que nos tiramos, nos debemos y nos preguntamos.')
    ),
    h('div', { class: 'juegos__tabs', role: 'tablist' }),
    h('div', { class: 'juegos__contenido' })
  );
  cont.append(raiz);
  registro.raiz = raiz;
  registro.tabsEl = raiz.querySelector('.juegos__tabs');
  registro.contenidoEl = raiz.querySelector('.juegos__contenido');
}

function pintarTabs() {
  const cont = registro.tabsEl;
  if (!cont) return;
  limpiarContenedor(cont);
  for (const t of TABS) {
    cont.append(h('button', {
      type: 'button',
      class: 'juegos__tab',
      'data-tab': t.id,
      'aria-pressed': String(registro.tab === t.id),
    }, t.etiqueta));
  }
}

/* ---------- Sección: Chistes ----------------------------------- */

function pintarChistes(cont) {
  const total = registro.chistes.length;
  const actual = chisteActual();
  const texto = actual
    ? actual.texto
    : 'Sin chistes todavía. Agrega el primero — mientras más fome, mejor.';

  cont.append(
    h('div', { class: 'juegos__chiste-caja' },
      h('p', { class: 'juegos__chiste-actual' }, texto),
      total > 1
        ? h('div', { class: 'juegos__preguntas-botones' },
            h('button', {
              type: 'button', class: 'btn-primario',
              'data-accion': 'otro-chiste',
            }, 'Otro chiste')
          )
        : null
    )
  );

  const input = h('input', { name: 'texto', placeholder: '¿Sabes uno? Cuéntalo aquí.', required: true, maxlength: 500 });
  cont.append(h('form', { class: 'juegos__form', 'data-accion': 'crear-chiste' },
    input,
    h('div', { class: 'juegos__form-botones' },
      h('button', { type: 'submit', class: 'btn-primario' }, 'Agregar')
    )
  ));
}

/**
 * Devuelve el chiste a mostrar. Si hay un id activo, lo busca.
 * Si no, elige uno al azar.
 */
function chisteActual() {
  const total = registro.chistes.length;
  if (total === 0) return null;

  if (registro.chisteActualId) {
    const actual = registro.chistes.find((c) => c.id === registro.chisteActualId);
    if (actual) return actual;
  }

  const elegido = registro.chistes[Math.floor(Math.random() * total)];
  registro.chisteActualId = elegido.id;
  return elegido;
}

function otroChiste() {
  const total = registro.chistes.length;
  if (total === 0) return;
  if (total === 1) {
    registro.chisteActualId = registro.chistes[0].id;
    pintar();
    return;
  }
  let nuevo;
  do {
    nuevo = registro.chistes[Math.floor(Math.random() * total)];
  } while (nuevo.id === registro.chisteActualId && total > 1);
  registro.chisteActualId = nuevo.id;
  pintar();
}

/* ---------- Sección: Retos ------------------------------------- */

function pintarRetos(cont) {
  if (registro.formularioAbierto) {
    cont.append(pintarFormReto());
  } else {
    cont.append(h('button', {
      type: 'button', class: 'juegos__abrir-form',
      'data-accion': 'abrir-form',
    }, '+ Nuevo reto'));
  }

  if (registro.retos.length === 0) {
    cont.append(h('p', { class: 'juegos__vacio' }, 'Sin retos todavía.'));
    return;
  }

  const ul = h('ul', { class: 'juegos__lista' });
  for (const r of registro.retos) {
    ul.append(pintarItemReto(r));
  }
  cont.append(ul);
}

function pintarItemReto(r) {
  const item = h('li', { class: `juegos__item juegos__item--${r.estado}`, 'data-id': r.id });

  item.append(
    h('div', { class: 'juegos__item-cabecera' },
      h('span', { class: `badge badge--${r.estado}` }, r.estado),
      distintivoAutor(r.autor),
      h('span', { class: 'juegos__flecha' }, '→'),
      distintivoAutor(r.destinatario)
    ),
    h('p', { class: 'juegos__texto' }, r.texto)
  );

  if (r.contexto) {
    item.append(h('p', { class: 'juegos__contexto' }, r.contexto));
  }

  const acciones = h('div', { class: 'juegos__acciones' });
  if (r.estado === 'propuesto') {
    acciones.append(
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--ok',
        'data-accion': 'reto-estado', 'data-id': r.id, 'data-estado': 'aceptado',
      }, 'Aceptar'),
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'reto-estado', 'data-id': r.id, 'data-estado': 'rechazado',
      }, 'Rechazar')
    );
  } else if (r.estado === 'aceptado') {
    acciones.append(
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--ok',
        'data-accion': 'reto-estado', 'data-id': r.id, 'data-estado': 'cumplido',
      }, 'Marcar cumplido')
    );
  }
  acciones.append(
    h('button', {
      type: 'button', class: 'btn-mini',
      'data-accion': 'eliminar-reto', 'data-id': r.id,
    }, 'Quitar')
  );
  item.append(acciones);
  return item;
}

function pintarFormReto() {
  const inputTexto = h('input', { name: 'texto', placeholder: 'Reto (ej. Inventar un juego nuevo)', required: true, maxlength: 300 });
  const inputContexto = h('textarea', { name: 'contexto', placeholder: 'Detalles o reglas (opcional)', maxlength: 500, rows: 2 });

  const otro = otroUsuarioId();
  const selectPara = h('select', { name: 'destinatario' },
    h('option', { value: otro }, 'Para ' + nombreDe(otro))
  );

  return h('form', { class: 'juegos__form', 'data-accion': 'crear-reto' },
    inputTexto,
    inputContexto,
    selectPara,
    h('div', { class: 'juegos__form-botones' },
      h('button', { type: 'button', class: 'btn-secundario', 'data-accion': 'cerrar-form' }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-primario' }, 'Proponer')
    )
  );
}

/* ---------- Sección: Penitencias ------------------------------- */

function pintarPenitencias(cont) {
  if (registro.formularioAbierto) {
    cont.append(pintarFormPenitencia());
  } else {
    cont.append(h('button', {
      type: 'button', class: 'juegos__abrir-form',
      'data-accion': 'abrir-form',
    }, '+ Nueva penitencia'));
  }

  if (registro.penitencias.length === 0) {
    cont.append(h('p', { class: 'juegos__vacio' }, 'Sin penitencias todavía.'));
    return;
  }

  const ul = h('ul', { class: 'juegos__lista' });
  for (const p of registro.penitencias) {
    ul.append(pintarItemPenitencia(p));
  }
  cont.append(ul);
}

function pintarItemPenitencia(p) {
  const item = h('li', { class: `juegos__item juegos__item--${p.estado}`, 'data-id': p.id });

  item.append(
    h('div', { class: 'juegos__item-cabecera' },
      h('span', { class: `badge badge--${p.estado}` }, p.estado),
      distintivoAutor(p.asignadaPor),
      h('span', { class: 'juegos__flecha' }, '→'),
      distintivoAutor(p.paraQuien)
    ),
    h('p', { class: 'juegos__texto' }, p.texto)
  );
  if (p.razon) {
    item.append(h('p', { class: 'juegos__contexto' }, p.razon));
  }

  const acciones = h('div', { class: 'juegos__acciones' });
  if (p.estado === 'pendiente') {
    acciones.append(
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--ok',
        'data-accion': 'penitencia-estado', 'data-id': p.id, 'data-estado': 'cumplida',
      }, 'Marcar cumplida')
    );
  }
  acciones.append(
    h('button', {
      type: 'button', class: 'btn-mini',
      'data-accion': 'eliminar-penitencia', 'data-id': p.id,
    }, 'Quitar')
  );
  item.append(acciones);
  return item;
}

function pintarFormPenitencia() {
  const inputTexto = h('input', { name: 'texto', placeholder: 'Penitencia (ej. Hacer el desayuno el domingo)', required: true, maxlength: 300 });
  const inputRazon = h('input', { name: 'razon', placeholder: 'Por qué (opcional)', maxlength: 300 });

  const otro = otroUsuarioId();
  const selectPara = h('select', { name: 'paraQuien' },
    h('option', { value: otro }, 'Para ' + nombreDe(otro))
  );

  return h('form', { class: 'juegos__form', 'data-accion': 'crear-penitencia' },
    inputTexto,
    inputRazon,
    selectPara,
    h('div', { class: 'juegos__form-botones' },
      h('button', { type: 'button', class: 'btn-secundario', 'data-accion': 'cerrar-form' }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-primario' }, 'Asignar')
    )
  );
}

/* ---------- Sección: Preguntas --------------------------------- */

function pintarPreguntas(cont) {
  const total = registro.preguntas.length;
  const idx = total ? registro.preguntaActual % total : 0;
  const pregunta = total ? registro.preguntas[idx].texto : 'Agrega preguntas para empezar.';

  cont.append(
    h('div', { class: 'juegos__preguntas-caja' },
      h('p', { class: 'juegos__pregunta-actual' }, pregunta),
      h('div', { class: 'juegos__preguntas-botones' },
        h('button', {
          type: 'button', class: 'btn-primario',
          'data-accion': 'siguiente-pregunta',
        }, 'Siguiente'),
        h('button', {
          type: 'button', class: 'btn-secundario',
          'data-accion': 'pregunta-azar',
        }, 'Al azar')
      )
    )
  );

  if (total > 0) {
    cont.append(h('div', { class: 'juegos__toggle-lista' },
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'toggle-preguntas-lista',
      }, registro.preguntasListaVisible ? 'Ocultar preguntas' : 'Ver todas las preguntas')
    ));

    if (registro.preguntasListaVisible) {
      const ul = h('ul', { class: 'juegos__lista' });
      registro.preguntas.forEach((p, i) => {
        ul.append(h('li', { class: 'juegos__item juegos__item--pregunta', 'data-id': p.id },
          h('span', { class: 'juegos__num' }, String(i + 1)),
          h('p', { class: 'juegos__texto', style: 'flex:1;margin:0;' }, p.texto),
          h('button', {
            type: 'button', class: 'btn-mini',
            'data-accion': 'eliminar-pregunta', 'data-id': p.id,
          }, 'Quitar')
        ));
      });
      cont.append(ul);
    }
  }

  const input = h('input', { name: 'texto', placeholder: 'Agregar pregunta nueva', required: true, maxlength: 300 });
  cont.append(h('form', { class: 'juegos__form', 'data-accion': 'crear-pregunta' },
    input,
    h('div', { class: 'juegos__form-botones' },
      h('button', { type: 'submit', class: 'btn-primario' }, 'Agregar')
    )
  ));
}

/* ---------- Sección: Apuestas ---------------------------------- */

function pintarApuestas(cont) {
  if (registro.formularioAbierto) {
    cont.append(pintarFormApuesta());
  } else {
    cont.append(h('button', {
      type: 'button', class: 'juegos__abrir-form',
      'data-accion': 'abrir-form',
    }, '+ Nueva apuesta'));
  }

  if (registro.apuestas.length === 0) {
    cont.append(h('p', { class: 'juegos__vacio' }, 'Sin apuestas todavía.'));
    return;
  }

  const ul = h('ul', { class: 'juegos__lista' });
  for (const a of registro.apuestas) {
    ul.append(pintarItemApuesta(a));
  }
  cont.append(ul);
}

function pintarItemApuesta(a) {
  const item = h('li', { class: `juegos__item juegos__item--${a.estado}`, 'data-id': a.id });

  item.append(
    h('div', { class: 'juegos__item-cabecera' },
      h('span', { class: `badge badge--${a.estado}` }, a.estado),
      distintivoAutor(a.quien),
      h('span', { class: 'juegos__flecha' }, 'vs'),
      distintivoAutor(a.contra)
    ),
    h('p', { class: 'juegos__texto' }, a.texto)
  );

  if (a.estado === 'resuelta' && a.ganador) {
    item.append(
      h('div', { class: 'juegos__resultado' },
        h('span', {}, 'Ganó'),
        h('span', { class: 'juegos__ganador' }, nombreDe(a.ganador))
      )
    );
  }

  const acciones = h('div', { class: 'juegos__acciones' });
  if (a.estado === 'pendiente') {
    acciones.append(
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--ok',
        'data-accion': 'resolver-apuesta', 'data-id': a.id, 'data-ganador': a.quien,
      }, 'Ganó ' + nombreDe(a.quien)),
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--ok',
        'data-accion': 'resolver-apuesta', 'data-id': a.id, 'data-ganador': a.contra,
      }, 'Ganó ' + nombreDe(a.contra)),
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'resolver-apuesta', 'data-id': a.id, 'data-ganador': 'empate',
      }, 'Empate')
    );
  }
  acciones.append(
    h('button', {
      type: 'button', class: 'btn-mini',
      'data-accion': 'eliminar-apuesta', 'data-id': a.id,
    }, 'Quitar')
  );
  item.append(acciones);
  return item;
}

function pintarFormApuesta() {
  const inputTexto = h('input', { name: 'texto', placeholder: 'Apuesta (ej. Mañana llueve antes del mediodía)', required: true, maxlength: 300 });
  const yo = usuarioActualId();
  const otro = otroUsuarioId();
  const selectQuien = h('select', { name: 'quien' },
    h('option', { value: yo }, nombreDe(yo) + ' apuesta a que…'),
    h('option', { value: otro }, nombreDe(otro) + ' apuesta a que…')
  );

  return h('form', { class: 'juegos__form', 'data-accion': 'crear-apuesta' },
    inputTexto,
    selectQuien,
    h('div', { class: 'juegos__form-botones' },
      h('button', { type: 'button', class: 'btn-secundario', 'data-accion': 'cerrar-form' }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-primario' }, 'Apostar')
    )
  );
}

/* ---------- Pintar todo ---------------------------------------- */

function pintar() {
  pintarTabs();
  const cont = registro.contenidoEl;
  if (!cont) return;
  limpiarContenedor(cont);

  if (registro.tab === 'chistes') pintarChistes(cont);
  else if (registro.tab === 'retos') pintarRetos(cont);
  else if (registro.tab === 'penitencias') pintarPenitencias(cont);
  else if (registro.tab === 'preguntas') pintarPreguntas(cont);
  else if (registro.tab === 'apuestas') pintarApuestas(cont);
}

/* ---------- Refrescos ------------------------------------------ */

async function refrescarRetos() {
  const r = await repoRetos.listar();
  if (r.exito) registro.retos = r.datos;
  else log.error('Error al listar retos:', r.error);
}

async function refrescarPenitencias() {
  const r = await repoPenitencias.listar();
  if (r.exito) registro.penitencias = r.datos;
  else log.error('Error al listar penitencias:', r.error);
}

async function refrescarPreguntas() {
  const r = await repoPreguntas.listar();
  if (r.exito) registro.preguntas = r.datos;
  else log.error('Error al listar preguntas:', r.error);
}

async function refrescarChistes() {
  const r = await repoChistes.listar();
  if (r.exito) {
    registro.chistes = r.datos;
    if (registro.chisteActualId && !registro.chistes.some((c) => c.id === registro.chisteActualId)) {
      registro.chisteActualId = null;
    }
  } else log.error('Error al listar chistes:', r.error);
}

async function refrescarApuestas() {
  const r = await repoApuestas.listar();
  if (r.exito) registro.apuestas = r.datos;
  else log.error('Error al listar apuestas:', r.error);
}

async function refrescarTodo() {
  await Promise.all([
    refrescarRetos(),
    refrescarPenitencias(),
    refrescarPreguntas(),
    refrescarChistes(),
    refrescarApuestas(),
  ]);
  pintar();
}

/* ---------- Submit --------------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const accion = form.dataset.accion;
  const fd = new FormData(form);

  if (accion === 'crear-reto') {
    const r = await repoRetos.crear({
      texto: fd.get('texto'),
      contexto: fd.get('contexto'),
      destinatario: fd.get('destinatario'),
    });
    if (r.exito) {
      registro.formularioAbierto = false;
      form.reset();
      await refrescarRetos();
      pintar();
      pintarOk('Reto propuesto.');
    } else pintarError(r.error);
  } else if (accion === 'crear-penitencia') {
    const r = await repoPenitencias.crear({
      texto: fd.get('texto'),
      razon: fd.get('razon'),
      paraQuien: fd.get('paraQuien'),
    });
    if (r.exito) {
      registro.formularioAbierto = false;
      form.reset();
      await refrescarPenitencias();
      pintar();
      pintarOk('Penitencia asignada.');
    } else pintarError(r.error);
  } else if (accion === 'crear-pregunta') {
    const r = await repoPreguntas.crear({ texto: fd.get('texto') });
    if (r.exito) {
      form.reset();
      await refrescarPreguntas();
      pintar();
      pintarOk('Pregunta agregada.');
    } else pintarError(r.error);
  } else if (accion === 'crear-chiste') {
    const r = await repoChistes.crear({ texto: fd.get('texto') });
    if (r.exito) {
      form.reset();
      registro.chisteActualId = r.datos.id;
      await refrescarChistes();
      pintar();
      pintarOk('Chiste agregado.');
    } else pintarError(r.error);
  } else if (accion === 'crear-apuesta') {
    const r = await repoApuestas.crear({
      texto: fd.get('texto'),
      quien: fd.get('quien'),
    });
    if (r.exito) {
      registro.formularioAbierto = false;
      form.reset();
      await refrescarApuestas();
      pintar();
      pintarOk('Apuesta registrada.');
    } else pintarError(r.error);
  }
}

/* ---------- Click ---------------------------------------------- */

async function manejarClick(ev) {
  const btn = ev.target.closest('button');
  if (!btn) return;

  if (btn.classList.contains('juegos__tab')) {
    registro.tab = btn.dataset.tab;
    registro.formularioAbierto = false;
    pintar();
    return;
  }

  const accion = btn.dataset.accion;
  const id = btn.dataset.id;

  if (accion === 'abrir-form') {
    registro.formularioAbierto = true;
    pintar();
  } else if (accion === 'cerrar-form') {
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'otro-chiste') {
    otroChiste();
  } else if (accion === 'reto-estado') {
    const r = await repoRetos.cambiarEstado(id, btn.dataset.estado);
    if (r.exito) {
      await refrescarRetos();
      pintar();
      pintarOk('Reto ' + btn.dataset.estado + '.');
    } else pintarError(r.error);
  } else if (accion === 'eliminar-reto') {
    const ok = await mostrarConfirmacion('Quitar reto', '¿Seguro que quieres quitarlo?', { textoConfirmar: 'Quitar' });
    if (!ok) return;
    const r = await repoRetos.eliminar(id);
    if (r.exito) { await refrescarRetos(); pintar(); }
    else pintarError(r.error);
  } else if (accion === 'penitencia-estado') {
    const r = await repoPenitencias.cambiarEstado(id, btn.dataset.estado);
    if (r.exito) {
      await refrescarPenitencias();
      pintar();
      pintarOk('Penitencia ' + btn.dataset.estado + '.');
    } else pintarError(r.error);
  } else if (accion === 'eliminar-penitencia') {
    const ok = await mostrarConfirmacion('Quitar penitencia', '¿Seguro que quieres quitarla?', { textoConfirmar: 'Quitar' });
    if (!ok) return;
    const r = await repoPenitencias.eliminar(id);
    if (r.exito) { await refrescarPenitencias(); pintar(); }
    else pintarError(r.error);
  } else if (accion === 'siguiente-pregunta') {
    const total = registro.preguntas.length;
    if (total === 0) return;
    registro.preguntaActual = (registro.preguntaActual + 1) % total;
    pintar();
  } else if (accion === 'pregunta-azar') {
    const total = registro.preguntas.length;
    if (total === 0) return;
    registro.preguntaActual = Math.floor(Math.random() * total);
    pintar();
  } else if (accion === 'toggle-preguntas-lista') {
    registro.preguntasListaVisible = !registro.preguntasListaVisible;
    pintar();
  } else if (accion === 'eliminar-pregunta') {
    const ok = await mostrarConfirmacion('Quitar pregunta', '¿Seguro que quieres quitarla?', { textoConfirmar: 'Quitar' });
    if (!ok) return;
    const r = await repoPreguntas.eliminar(id);
    if (r.exito) { await refrescarPreguntas(); pintar(); }
    else pintarError(r.error);
  } else if (accion === 'resolver-apuesta') {
    const r = await repoApuestas.resolver(id, btn.dataset.ganador);
    if (r.exito) {
      await refrescarApuestas();
      pintar();
      pintarOk('Ganó ' + nombreDe(btn.dataset.ganador) + '.');
    } else pintarError(r.error);
  } else if (accion === 'eliminar-apuesta') {
    const ok = await mostrarConfirmacion('Quitar apuesta', '¿Seguro que quieres quitarla?', { textoConfirmar: 'Quitar' });
    if (!ok) return;
    const r = await repoApuestas.eliminar(id);
    if (r.exito) { await refrescarApuestas(); pintar(); }
    else pintarError(r.error);
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.tab = 'chistes';
  registro.formularioAbierto = false;
  registro.preguntaActual = 0;
  registro.chisteActualId = null;
  registro.preguntasListaVisible = false;

  const { signal } = registro.abortador;
  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('submit', manejarSubmit, { signal });

  registro.desuscribir = [
    al('realtime:retos:crear', async () => { await refrescarRetos(); pintar(); }),
    al('realtime:retos:actualizar', async () => { await refrescarRetos(); pintar(); }),
    al('realtime:retos:eliminar', async () => { await refrescarRetos(); pintar(); }),
    al('realtime:penitencias:crear', async () => { await refrescarPenitencias(); pintar(); }),
    al('realtime:penitencias:actualizar', async () => { await refrescarPenitencias(); pintar(); }),
    al('realtime:penitencias:eliminar', async () => { await refrescarPenitencias(); pintar(); }),
    al('realtime:preguntas:crear', async () => { await refrescarPreguntas(); pintar(); }),
    al('realtime:preguntas:eliminar', async () => { await refrescarPreguntas(); pintar(); }),
    al('realtime:chistes:crear', async () => { await refrescarChistes(); pintar(); }),
    al('realtime:chistes:eliminar', async () => { await refrescarChistes(); pintar(); }),
    al('realtime:apuestas:crear', async () => { await refrescarApuestas(); pintar(); }),
    al('realtime:apuestas:actualizar', async () => { await refrescarApuestas(); pintar(); }),
    al('realtime:apuestas:eliminar', async () => { await refrescarApuestas(); pintar(); }),
  ];

  montarEstructura();
  await refrescarTodo();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.retos = [];
  registro.penitencias = [];
  registro.preguntas = [];
  registro.apuestas = [];
  registro.chistes = [];
  registro.formularioAbierto = false;
  registro.preguntaActual = 0;
  registro.chisteActualId = null;
  registro.preguntasListaVisible = false;
  registro.raiz = null;
  registro.tabsEl = null;
  registro.contenidoEl = null;
  registro.contenedor = null;
}