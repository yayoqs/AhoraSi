/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/anexos.js
   Versión: 1.0.0
   Propósito: vista de anexos. Recados cortos entre los dos, al
              estilo bitácora informal. Reutiliza la tabla
              ahorasi_carta con tipo 'anexo'. Antes vivía como
              sección dentro de Carta; ahora tiene su propia
              sub-vista bajo Cuenta.
              v1.0.0: versión inicial. Sub-vista de Cuenta.
   ================================================================ */

import * as repoCarta from '../datos/repositorios/carta.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:anexos');

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  anexos: [],
  formularioAbierto: false,
  editandoId: null,
};

/* ---------- Helpers ------------------------------------------- */

function ordenarPorFechaDesc(items) {
  return items.slice().sort((a, b) => {
    const fa = a.creadoEn ? new Date(a.creadoEn).getTime() : 0;
    const fb = b.creadoEn ? new Date(b.creadoEn).getTime() : 0;
    return fb - fa;
  });
}

function pintarMensaje(tipo, texto) {
  const cont = registro.contenedor;
  if (!cont) return;
  const clase = tipo === 'ok' ? 'vista__ok' : 'vista__error';
  const p = h('p', { class: clase, role: tipo === 'ok' ? 'status' : 'alert' }, texto);
  cont.prepend(p);
  setTimeout(() => p.remove(), 5000);
}

/* ---------- Formulario ---------------------------------------- */

function pintarBloqueFormulario() {
  const cont = h('div', {});

  if (!registro.formularioAbierto) {
    cont.append(h('button', {
      type: 'button',
      class: 'anexos__btn-agregar',
      'data-accion': 'abrir-formulario',
    }, '+ Nuevo anexo'));
    return cont;
  }

  const inputTitulo = h('input', {
    type: 'text',
    name: 'titulo',
    placeholder: 'Título',
    required: true,
    maxlength: 200,
  });
  const textarea = h('textarea', {
    name: 'contenido',
    placeholder: 'Texto del anexo',
    required: true,
    maxlength: 2000,
    rows: 4,
  });

  const form = h('form', { class: 'anexos__form', 'data-accion': 'crear' },
    inputTitulo,
    textarea,
    h('div', { class: 'anexos__form-fila' },
      h('button', {
        type: 'button',
        class: 'anexos__btn anexos__btn--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', {
        type: 'submit',
        class: 'anexos__btn anexos__btn--primario',
      }, 'Guardar')
    )
  );

  cont.append(form);
  return cont;
}

/* ---------- Anexo -------------------------------------------- */

function pintarAnexo(a) {
  if (registro.editandoId === a.id) {
    return pintarAnexoEnEdicion(a);
  }

  const card = h('article', { class: 'anexo', 'data-id': a.id });

  card.append(h('h3', { class: 'anexo__titulo' }, a.titulo));
  card.append(h('p', { class: 'anexo__contenido' }, a.contenido));

  card.append(h('div', { class: 'anexo__meta' },
    distintivoAutor(a.autor),
    h('span', { class: 'anexo__fecha' }, formatearFecha(a.creadoEn)),
    h('div', { class: 'anexo__acciones' },
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'editar', 'data-id': a.id,
      }, 'Editar'),
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--peligro',
        'data-accion': 'eliminar', 'data-id': a.id,
      }, 'Eliminar')
    )
  ));

  return card;
}

function pintarAnexoEnEdicion(a) {
  const inputTitulo = h('input', {
    type: 'text',
    value: a.titulo || '',
    placeholder: 'Título',
    required: true,
    maxlength: 200,
  });
  const textarea = h('textarea', {
    placeholder: 'Texto del anexo',
    required: true,
    maxlength: 2000,
    rows: 4,
  }, a.contenido || '');

  const btnGuardar = h('button', {
    type: 'button', class: 'anexos__btn anexos__btn--primario',
  }, 'Guardar');

  btnGuardar.addEventListener('click', () => {
    guardarEdicion(a.id, inputTitulo.value, textarea.value);
  });

  return h('article', { class: 'anexo anexo--edicion', 'data-id': a.id },
    h('div', { class: 'anexos__form' },
      inputTitulo,
      textarea,
      h('div', { class: 'anexos__form-fila' },
        h('button', {
          type: 'button',
          class: 'anexos__btn anexos__btn--secundario',
          onclick: () => {
            registro.editandoId = null;
            pintar();
          },
        }, 'Cancelar'),
        btnGuardar
      )
    )
  );
}

async function guardarEdicion(id, titulo, contenido) {
  const t = (titulo || '').trim();
  const c = (contenido || '').trim();
  if (!t) { pintarMensaje('error', 'Falta el título.'); return; }
  if (!c) { pintarMensaje('error', 'Falta el texto.'); return; }

  const r = await repoCarta.actualizar(id, { titulo: t, contenido: c });
  if (r.exito) {
    const i = registro.anexos.findIndex((x) => x.id === id);
    if (i >= 0) registro.anexos[i] = r.datos;
    registro.editandoId = null;
    pintar();
    pintarMensaje('ok', 'Guardado.');
  } else {
    pintarMensaje('error', r.error);
  }
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-anexos', class: 'vista vista--anexos' });

  raiz.append(pintarBloqueFormulario());

  if (registro.anexos.length === 0) {
    raiz.append(h('div', { class: 'anexos__vacio' },
      h('p', { class: 'anexos__vacio-emoji' }, '📎'),
      h('p', { class: 'anexos__vacio-titulo' }, 'Sin anexos todavía'),
      h('p', { class: 'anexos__vacio-texto' },
        'Un lugar para dejar recados cortos, más sueltos que la carta.')
    ));
  } else {
    const lista = h('div', { class: 'anexos__lista' });
    for (const a of registro.anexos) lista.append(pintarAnexo(a));
    raiz.append(lista);
  }

  cont.append(raiz);
}

/* ---------- Refresco ----------------------------------------- */

async function refrescar() {
  const r = await repoCarta.listarAnexos();
  if (!r.exito) {
    log.error('Error al listar anexos:', r.error);
    pintarMensaje('error', r.error);
    return;
  }
  registro.anexos = ordenarPorFechaDesc(r.datos);
  pintar();
}

/* ---------- Handlers ----------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  if (form.dataset.accion !== 'crear') return;

  const fd = new FormData(form);
  const titulo = String(fd.get('titulo') || '').trim();
  const contenido = String(fd.get('contenido') || '').trim();

  if (!titulo) { pintarMensaje('error', 'Falta el título.'); return; }
  if (!contenido) { pintarMensaje('error', 'Falta el texto.'); return; }

  const r = await repoCarta.crear({
    tipo: 'anexo',
    titulo,
    contenido,
    orden: registro.anexos.length,
  });

  if (!r.exito) {
    pintarMensaje('error', r.error);
    return;
  }

  registro.formularioAbierto = false;
  await refrescar();
  pintarMensaje('ok', 'Anexo guardado.');
}

async function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;

  if (accion === 'abrir-formulario') {
    registro.formularioAbierto = true;
    registro.editandoId = null;
    pintar();
    setTimeout(() => {
      const input = registro.contenedor.querySelector('input[name="titulo"]');
      if (input) input.focus();
    }, 60);
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'editar') {
    registro.editandoId = id;
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion(
      'Eliminar anexo',
      '¿Seguro que quieres eliminar este anexo?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoCarta.eliminar(id);
    if (r.exito) {
      registro.anexos = registro.anexos.filter((x) => x.id !== id);
      pintar();
      pintarMensaje('ok', 'Eliminado.');
    } else {
      pintarMensaje('error', r.error);
    }
  }
}

/* ---------- Ciclo de vida ------------------------------------ */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.anexos = [];
  registro.formularioAbierto = false;
  registro.editandoId = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:carta:crear', (fila) => { if (fila?.tipo === 'anexo') refrescar(); }),
    al('realtime:carta:actualizar', (fila) => { if (fila?.tipo === 'anexo') refrescar(); }),
    al('realtime:carta:eliminar', () => refrescar()),
  ];

  pintar();
  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.anexos = [];
  registro.formularioAbierto = false;
  registro.editandoId = null;
  registro.contenedor = null;
}