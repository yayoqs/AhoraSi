/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/planes.js
   Versión: 4.0.0
   Propósito: vista de planes. Lista coordinable de cosas para
              hacer juntos. Cada tarjeta tiene un segmented control
              arriba con los 4 estados, descripción y "cuándo"
              debajo, y al pie el autor más Editar y Eliminar.
              v4.0.0: se adopta la variante C del prototipo. Se
                      reemplazan los 4 botones internos por un
                      segmented control arriba de la tarjeta. Se
                      agrega edición inline (título, descripción,
                      cuándo). El botón "Editar" reemplaza al
                      "Eliminar" único: ahora hay ambos al pie.
              v3.0.1: reversión del v4.0.0 anterior (ciclado).
              v3.0.0: rediseño al nuevo lenguaje visual.
              v1.7.0: form colapsable.
              v1.6.1: se quita sección Ideas (movida a ideas.js).
              v1.3.1: mostrarConfirmacion().
              v1.3.0: activar() pinta primero.
              v1.2.0: distintivoAutor, clase .vista--planes.
              v1.1.0: Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoPlanes from '../datos/repositorios/planes.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:planes');

const ESTADOS = [
  { id: 'si', etiqueta: 'Sí' },
  { id: 'quiza', etiqueta: 'Quizás' },
  { id: 'no', etiqueta: 'No' },
  { id: 'pendiente', etiqueta: 'Pendiente' },
];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  planes: [],
  formularioAbierto: false,
  editandoId: null,
};

/* ---------- Formulario de creación ----------------------------- */

function pintarBloqueRegistro() {
  const cont = h('div', {});

  if (!registro.formularioAbierto) {
    cont.append(h('button', {
      type: 'button',
      class: 'btn-agregar-principal',
      'data-accion': 'abrir-formulario',
    }, '+ Crear plan'));
    return cont;
  }

  const form = h('form', { class: 'form-inline', 'data-accion': 'crear' },
    h('input', { name: 'titulo', placeholder: 'Título del plan', required: true, maxlength: 200 }),
    h('input', { name: 'descripcion', placeholder: 'Descripción', maxlength: 500 }),
    h('input', { name: 'cuando', placeholder: 'Cuándo' }),
    h('div', { class: 'form-inline__fila' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn btn--primario' }, 'Crear')
    )
  );

  cont.append(form);
  return cont;
}

/* ---------- Tarjeta de plan ------------------------------------ */

function pintarPlan(p) {
  if (registro.editandoId === p.id) {
    return pintarPlanEnEdicion(p);
  }

  const li = h('li', { class: 'plan', 'data-id': p.id, 'data-estado': p.estado });

  // Cabecera: título solo.
  li.append(
    h('div', { class: 'plan__cabecera' },
      h('h3', { class: 'plan__titulo' }, p.titulo)
    )
  );

  // Segmented control.
  const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Estado del plan' });
  for (const e of ESTADOS) {
    seg.append(h('button', {
      type: 'button',
      'data-accion': 'estado',
      'data-id': p.id,
      'data-estado': e.id,
      'aria-pressed': String(p.estado === e.id),
    }, e.etiqueta));
  }
  li.append(seg);

  if (p.descripcion) {
    li.append(h('p', { class: 'plan__desc' }, p.descripcion));
  }
  if (p.cuando) {
    li.append(h('p', { class: 'plan__cuando' }, p.cuando));
  }

  // Pie: autor + Editar + Eliminar.
  li.append(h('div', { class: 'plan__pie' },
    distintivoAutor(p.creadoPor),
    h('div', { class: 'plan__acciones' },
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'editar', 'data-id': p.id,
      }, 'Editar'),
      h('button', {
        type: 'button', class: 'btn-mini btn-mini--peligro',
        'data-accion': 'eliminar', 'data-id': p.id,
      }, 'Eliminar')
    )
  ));

  return li;
}

function pintarPlanEnEdicion(p) {
  const inputTitulo = h('input', {
    type: 'text', value: p.titulo || '',
    placeholder: 'Título', maxlength: 200, required: true,
  });
  const inputDesc = h('input', {
    type: 'text', value: p.descripcion || '',
    placeholder: 'Descripción', maxlength: 500,
  });
  const inputCuando = h('input', {
    type: 'text', value: p.cuando || '',
    placeholder: 'Cuándo',
  });

  return h('li', { class: 'plan pieza-edit', 'data-id': p.id },
    h('div', { class: 'pieza-edit__cuerpo' },
      inputTitulo,
      inputDesc,
      inputCuando
    ),
    h('div', { class: 'pieza-edit__botones' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        onclick: () => {
          registro.editandoId = null;
          pintar();
        },
      }, 'Cancelar'),
      h('button', {
        type: 'button', class: 'btn btn--primario',
        onclick: () => guardarEdicion(p.id, {
          titulo: inputTitulo.value,
          descripcion: inputDesc.value,
          cuando: inputCuando.value,
        }),
      }, 'Guardar')
    )
  );
}

async function guardarEdicion(id, valores) {
  if (!valores.titulo.trim()) {
    pintarError('El título no puede quedar vacío.');
    return;
  }
  const r = await repoPlanes.actualizar(id, {
    titulo: valores.titulo.trim(),
    descripcion: (valores.descripcion || '').trim(),
    cuando: (valores.cuando || '').trim(),
  });
  if (r.exito) {
    const i = registro.planes.findIndex((x) => x.id === id);
    if (i >= 0) registro.planes[i] = r.datos;
    registro.editandoId = null;
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

  const raiz = h('section', { id: 'vista-planes', class: 'vista vista--planes' });

  raiz.append(pintarBloqueRegistro());

  if (registro.planes.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' }, 'Todavía no hay planes. Crea el primero.'));
  } else {
    const ul = h('ul', { class: 'lista-planes' });
    for (const p of registro.planes) {
      ul.append(pintarPlan(p));
    }
    raiz.append(ul);
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
  const r = await repoPlanes.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.planes = r.datos;
  pintar();
}

/* ---------- Submit -------------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const r = await repoPlanes.crear({
    titulo: fd.get('titulo'),
    descripcion: fd.get('descripcion'),
    cuando: fd.get('cuando'),
    esIdea: false,
  });
  if (r.exito) {
    registro.planes = [r.datos, ...registro.planes];
    registro.formularioAbierto = false;
    form.reset();
    pintar();
    pintarOk('Plan creado.');
  } else {
    pintarError(r.error);
  }
}

/* ---------- Click --------------------------------------------- */

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;
  const id = boton.dataset.id;

  if (accion === 'abrir-formulario') {
    registro.formularioAbierto = true;
    pintar();
    setTimeout(() => {
      const input = registro.contenedor.querySelector('input[name="titulo"]');
      if (input) input.focus();
    }, 60);
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    pintar();
  } else if (accion === 'estado') {
    const nuevo = boton.dataset.estado;
    const r = await repoPlanes.cambiarEstado(id, nuevo);
    if (r.exito) {
      const i = registro.planes.findIndex((x) => x.id === id);
      if (i >= 0) registro.planes[i] = r.datos;
      pintar();
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'editar') {
    registro.editandoId = id;
    pintar();
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion(
      'Eliminar plan',
      '¿Seguro que quieres eliminar este plan? Esta acción no se puede deshacer.',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoPlanes.eliminar(id);
    if (r.exito) {
      registro.planes = registro.planes.filter((x) => x.id !== id);
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
  registro.formularioAbierto = false;
  registro.editandoId = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:planes:crear', refrescar),
    al('realtime:planes:actualizar', refrescar),
    al('realtime:planes:eliminar', refrescar),
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
  registro.planes = [];
  registro.formularioAbierto = false;
  registro.editandoId = null;
  registro.contenedor = null;
}