/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/hitos.js
   Versión: 4.1.0
   Propósito: vista de hitos. Línea biográfica de la historia
              compartida. Del más reciente al más viejo. Cada hito
              tiene título, fecha y color elegido por el usuario.
              El color da contexto emocional al punto en el
              timeline. El año solo se muestra cuando cambia.
              v4.1.0: se elimina el campo `tipo` (con etiqueta y
                      colores fijos) y se reemplaza por `color`
                      elegible. Se elimina el distintivo de autor:
                      los hitos son de los dos, no individuales.
                      El año se muestra solo cuando cambia respecto
                      al hito anterior. El selector de color es
                      obligatorio: el botón de crear/guardar queda
                      deshabilitado hasta elegir uno.
              v4.0.0: rediseño a línea biográfica.
              v3.0.0: rediseño al nuevo lenguaje visual.
              v1.4.0: formulario colapsable, edición inline.
              v1.3.0: activar() pinta primero.
              v1.2.1: mostrarConfirmacion().
              v1.1.0: distintivoAutor, clase .vista--hitos.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoHitos from '../datos/repositorios/hitos.js';
import { al } from '../nucleo/bus-eventos.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:hitos');

const COLORES = [
  { id: 'terracota', etiqueta: 'Terracota' },
  { id: 'musgo', etiqueta: 'Musgo' },
  { id: 'mostaza', etiqueta: 'Mostaza' },
  { id: 'azul', etiqueta: 'Azul' },
  { id: 'ciruela', etiqueta: 'Ciruela' },
  { id: 'gris', etiqueta: 'Gris' },
];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  hitos: [],
  editandoId: null,
  formularioAbierto: false,
  colorFormulario: null,
  colorEdicion: null,
};

/* ---------- Utilidades ----------------------------------------- */

function fechaParaInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function anioDe(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getFullYear());
}

/* ---------- Selector de color ---------------------------------- */

function pintarSelectorColor(colorActual, onElegir, nombreGrupo) {
  const cont = h('div', {
    class: 'color-picker',
    role: 'radiogroup',
    'aria-label': nombreGrupo,
  });

  for (const c of COLORES) {
    const boton = h('button', {
      type: 'button',
      class: `color-picker__opcion color-picker__opcion--${c.id}` +
        (colorActual === c.id ? ' is-active' : ''),
      role: 'radio',
      'aria-checked': String(colorActual === c.id),
      'aria-label': c.etiqueta,
      title: c.etiqueta,
      'data-color': c.id,
    });
    boton.addEventListener('click', () => onElegir(c.id));
    cont.append(boton);
  }

  return cont;
}

/* ---------- Formulario de creación ----------------------------- */

function pintarBloqueRegistro() {
  const cont = h('div', {});

  if (!registro.formularioAbierto) {
    cont.append(h('button', {
      type: 'button',
      class: 'btn-agregar-principal',
      'data-accion': 'abrir-formulario',
    }, '+ Añadir hito'));
    return cont;
  }

  const inputTitulo = h('input', {
    name: 'titulo',
    placeholder: 'Qué pasó',
    required: true,
    maxlength: 200,
  });
  const inputFecha = h('input', { type: 'date', name: 'fecha', required: true });

  const btnEnviar = h('button', {
    type: 'submit',
    class: 'btn btn--primario',
  }, 'Añadir');
  if (!registro.colorFormulario) btnEnviar.disabled = true;

  const selector = pintarSelectorColor(
    registro.colorFormulario,
    (color) => {
      registro.colorFormulario = color;
      pintar();
    },
    'Color del hito'
  );

  const form = h('form', { class: 'form-inline', 'data-accion': 'crear' },
    inputTitulo,
    h('label', { class: 'campo-inline' },
      h('span', { class: 'campo-inline__etiqueta' }, 'Fecha'),
      inputFecha
    ),
    h('div', { class: 'campo-inline' },
      h('span', { class: 'campo-inline__etiqueta' }, 'Color'),
      selector
    ),
    h('div', { class: 'form-inline__fila' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      btnEnviar
    )
  );

  cont.append(form);
  return cont;
}

/* ---------- Hito ---------------------------------------------- */

function pintarHito(x, anioPrevio) {
  if (registro.editandoId === x.id) {
    return pintarHitoEnEdicion(x, anioPrevio);
  }

  const anio = anioDe(x.fecha);
  const mostrarAnio = anio && anio !== anioPrevio;

  const li = h('li', {
    class: `hito hito--${x.color}`,
    'data-id': x.id,
  });

  if (mostrarAnio) {
    li.append(h('div', { class: 'hito__anio' }, anio));
  }

  li.append(h('span', { class: 'hito__marca', 'aria-hidden': 'true' }));

  const cuerpo = h('div', { class: 'hito__cuerpo' });
  if (x.fecha) {
    cuerpo.append(h('p', { class: 'hito__fecha-mini' }, formatearFecha(x.fecha)));
  }
  cuerpo.append(h('h3', { class: 'hito__titulo' }, x.titulo));

  cuerpo.append(
    h('div', { class: 'hito__acciones' },
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'editar', 'data-id': x.id,
      }, 'Editar'),
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--peligro',
        'data-accion': 'eliminar', 'data-id': x.id,
      }, 'Eliminar')
    )
  );

  li.append(cuerpo);
  return li;
}

function pintarHitoEnEdicion(x, anioPrevio) {
  const anio = anioDe(x.fecha);
  const mostrarAnio = anio && anio !== anioPrevio;

  const inputTitulo = h('input', {
    type: 'text', value: x.titulo || '',
    placeholder: 'Qué pasó', maxlength: 200, required: true,
  });
  const inputFecha = h('input', {
    type: 'date', value: fechaParaInput(x.fecha), required: true,
  });

  const btnGuardar = h('button', {
    type: 'button', class: 'btn btn--primario',
  }, 'Guardar');
  if (!registro.colorEdicion) btnGuardar.disabled = true;
  btnGuardar.addEventListener('click', () => {
    guardarEdicion(x.id, {
      titulo: inputTitulo.value,
      fecha: inputFecha.value,
      color: registro.colorEdicion,
    });
  });

  const selector = pintarSelectorColor(
    registro.colorEdicion,
    (color) => {
      registro.colorEdicion = color;
      pintar();
    },
    'Color del hito'
  );

  const li = h('li', { class: `hito pieza-edit hito--${registro.colorEdicion || x.color}`, 'data-id': x.id });
  if (mostrarAnio) {
    li.append(h('div', { class: 'hito__anio' }, anio));
  }
  li.append(h('span', { class: 'hito__marca', 'aria-hidden': 'true' }));

  li.append(
    h('div', { class: 'hito__cuerpo pieza-edit__cuerpo' },
      inputTitulo,
      h('label', { class: 'campo-inline' },
        h('span', { class: 'campo-inline__etiqueta' }, 'Fecha'),
        inputFecha
      ),
      h('div', { class: 'campo-inline' },
        h('span', { class: 'campo-inline__etiqueta' }, 'Color'),
        selector
      ),
      h('div', { class: 'pieza-edit__botones' },
        h('button', {
          type: 'button', class: 'btn btn--secundario',
          onclick: () => {
            registro.editandoId = null;
            registro.colorEdicion = null;
            pintar();
          },
        }, 'Cancelar'),
        btnGuardar
      )
    )
  );

  return li;
}

async function guardarEdicion(id, valores) {
  if (!valores.titulo.trim()) {
    pintarError('El título no puede quedar vacío.');
    return;
  }
  if (!valores.color) {
    pintarError('Elige un color.');
    return;
  }
  const fecha = valores.fecha ? new Date(valores.fecha + 'T12:00:00').toISOString() : null;
  const r = await repoHitos.actualizar(id, {
    titulo: valores.titulo.trim(),
    fecha,
    color: valores.color,
  });
  if (r.exito) {
    const i = registro.hitos.findIndex((x) => x.id === id);
    if (i >= 0) registro.hitos[i] = r.datos;
    registro.editandoId = null;
    registro.colorEdicion = null;
    pintar();
  } else {
    pintarError(r.error);
  }
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-hitos', class: 'vista vista--hitos' });

  raiz.append(pintarBloqueRegistro());

  if (registro.hitos.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' }, 'Aún no hay hitos. Anota el primero.'));
  } else {
    const ol = h('ol', { class: 'linea-tiempo' });
    let anioPrevio = null;
    for (const x of registro.hitos) {
      ol.append(pintarHito(x, anioPrevio));
      const a = anioDe(x.fecha);
      if (a) anioPrevio = a;
    }
    raiz.append(ol);
  }

  cont.append(raiz);
}

function pintarError(mensaje) {
  const cont = registro.contenedor;
  if (!cont) return;
  const error = h('p', { class: 'vista__error', role: 'alert' }, mensaje);
  cont.prepend(error);
  setTimeout(() => error.remove(), 5000);
}

function pintarOk(mensaje) {
  const cont = registro.contenedor;
  if (!cont) return;
  const ok = h('p', { class: 'vista__ok', role: 'status' }, mensaje);
  cont.prepend(ok);
  setTimeout(() => ok.remove(), 3500);
}

async function refrescar() {
  const r = await repoHitos.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.hitos = r.datos;
  pintar();
}

/* ---------- Submit -------------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const fecha = fd.get('fecha');

  if (!registro.colorFormulario) {
    pintarError('Elige un color para el hito.');
    return;
  }

  const r = await repoHitos.crear({
    titulo: fd.get('titulo'),
    fecha: fecha ? new Date(fecha + 'T12:00:00').toISOString() : null,
    color: registro.colorFormulario,
  });

  if (!r.exito) {
    pintarError(r.error);
    return;
  }

  registro.hitos = [r.datos, ...registro.hitos].sort((a, b) => {
    const fa = a.fecha ? new Date(a.fecha).getTime() : 0;
    const fb = b.fecha ? new Date(b.fecha).getTime() : 0;
    return fb - fa;
  });
  registro.formularioAbierto = false;
  registro.colorFormulario = null;
  form.reset();
  pintar();
  pintarOk('Hito añadido.');
}

/* ---------- Click --------------------------------------------- */

async function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;

  if (accion === 'abrir-formulario') {
    registro.formularioAbierto = true;
    registro.colorFormulario = null;
    pintar();
    setTimeout(() => {
      const input = registro.contenedor.querySelector('input[name="titulo"]');
      if (input) input.focus();
    }, 60);
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    registro.colorFormulario = null;
    pintar();
  } else if (accion === 'editar') {
    const hito = registro.hitos.find((x) => x.id === id);
    if (!hito) return;
    registro.editandoId = id;
    registro.colorEdicion = hito.color;
    pintar();
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion(
      'Eliminar hito',
      '¿Seguro que quieres eliminar este hito de la historia?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoHitos.eliminar(id);
    if (r.exito) {
      registro.hitos = registro.hitos.filter((x) => x.id !== id);
      pintar();
    } else {
      pintarError(r.error);
    }
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.editandoId = null;
  registro.formularioAbierto = false;
  registro.colorFormulario = null;
  registro.colorEdicion = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:hitos:crear', refrescar),
    al('realtime:hitos:actualizar', refrescar),
    al('realtime:hitos:eliminar', refrescar),
  ];

  pintar();
  refrescar().catch((e) => log.error('Error al refrescar:', e));
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.hitos = [];
  registro.editandoId = null;
  registro.formularioAbierto = false;
  registro.colorFormulario = null;
  registro.colorEdicion = null;
  registro.contenedor = null;
}