/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/kit.js
   Versión: 4.0.0
   Propósito: vista del kit de campamento. Progreso grande arriba,
              items agrupados por categoría en grilla de 2 columnas.
              Cada item tiene check, nombre, preview de la nota e
              inicial del autor cuando está listo. Se expande al
              toque para ver la nota completa y las acciones.
              v4.0.0: rediseño. La vista deja el layout de lista
                      agrupada simple y adopta la grilla de 2
                      columnas con item expandible. Se agrega el
                      campo notas (preview con ellipsis en la
                      cabecera, texto completo al expandir). Se
                      agrega la marca de autor (solo inicial)
                      cuando el item está listo. Se agrega barra
                      de progreso grande con contador.
              v3.0.0: rediseño al nuevo lenguaje visual.
              v1.5.0: edición inline.
              v1.4.0: categoría como select.
              v1.3.0: formulario colapsable.
              v1.2.1: mostrarConfirmacion().
              v1.1.0: distintivoAutor.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoKit from '../datos/repositorios/kit.js';
import { CONFIG } from '../config/config.js';
import { al } from '../nucleo/bus-eventos.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:kit');

const CATEGORIAS = [
  'Dormir',
  'Comer',
  'Cocina',
  'Ropa',
  'Herramientas',
  'Primeros auxilios',
  'Aseo',
  'Observación',
  'Energía',
  'Música',
];

const SV_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  items: [],
  formularioAbierto: false,
  editandoId: null,
  abiertoId: null,
};

/* ---------- Utilidades ---------------------------------------- */

function agruparPorCategoria(items) {
  const mapa = new Map();
  for (const it of items) {
    if (!mapa.has(it.categoria)) mapa.set(it.categoria, []);
    mapa.get(it.categoria).push(it);
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function inicialDeAutor(userId) {
  if (userId === CONFIG.usuarios.yayo) return { ini: 'Y', clase: 'autor--yayo' };
  if (userId === CONFIG.usuarios.luci) return { ini: 'L', clase: 'autor--luci' };
  return null;
}

/* ---------- Formulario de creación ----------------------------- */

function pintarBloqueRegistro() {
  const cont = h('div', {});

  if (!registro.formularioAbierto) {
    cont.append(h('button', {
      type: 'button',
      class: 'btn-agregar-principal',
      'data-accion': 'abrir-formulario',
    }, '+ Añadir item'));
    return cont;
  }

  const selectCategoria = h('select', { name: 'categoria', required: true },
    ...CATEGORIAS.map((c) => h('option', { value: c }, c))
  );

  const form = h('form', { class: 'form-inline', 'data-accion': 'crear' },
    selectCategoria,
    h('input', {
      name: 'item',
      placeholder: 'Item (Carpa 2p, Papas, Café…)',
      required: true,
      maxlength: 100,
    }),
    h('textarea', {
      name: 'notas',
      placeholder: 'Notas (opcional). Cantidad, presentación, marca, para qué es…',
      maxlength: 200,
      rows: 2,
    }),
    h('div', { class: 'form-inline__fila' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn btn--primario' }, 'Añadir')
    )
  );

  cont.append(form);
  return cont;
}

/* ---------- Item ---------------------------------------------- */

function pintarItem(it) {
  if (registro.editandoId === it.id) {
    return pintarItemEnEdicion(it);
  }

  const abierto = registro.abiertoId === it.id;
  const autor = inicialDeAutor(it.marcadoPor);

  const item = h('div', {
    class: 'kit-item' +
      (it.listo ? ' is-listo' : '') +
      (abierto ? ' is-abierto' : ''),
    'data-id': it.id,
  });

  // Cabecera clickeable.
  const cab = h('div', { class: 'kit-item__cab' });

  // Check.
  const check = h('button', {
    type: 'button',
    class: 'kit-item__check',
    'data-accion': 'toggle-listo',
    'data-id': it.id,
    'aria-pressed': String(it.listo),
    'aria-label': it.listo ? 'Marcar como no listo' : 'Marcar como listo',
  });
  check.innerHTML = SV_CHECK;
  cab.append(check);

  // Cuerpo del nombre (nombre + preview de nota).
  const cuerpoNombre = h('div', { class: 'kit-item__cuerpo-nombre' });
  cuerpoNombre.append(h('span', { class: 'kit-item__nombre' }, it.item));
  if (it.notas) {
    cuerpoNombre.append(h('span', { class: 'kit-item__preview' }, it.notas));
  }
  cab.append(cuerpoNombre);

  // Autor (solo si está listo).
  if (it.listo && autor) {
    cab.append(h('span', { class: `autor--ini ${autor.clase}` }, autor.ini));
  }

  item.append(cab);

  // Cuerpo expandible.
  if (abierto) {
    const cuerpo = h('div', { class: 'kit-item__cuerpo' });

    if (it.notas) {
      cuerpo.append(h('p', { class: 'kit-item__nota-completa' }, it.notas));
    } else {
      cuerpo.append(h('p', { class: 'kit-item__sin-nota' }, 'Sin nota.'));
    }

    cuerpo.append(
      h('div', { class: 'kit-item__acciones' },
        h('button', {
          type: 'button', class: 'btn-mini',
          'data-accion': 'editar', 'data-id': it.id,
        }, 'Editar'),
        h('button', {
          type: 'button', class: 'btn-mini btn-mini--peligro',
          'data-accion': 'eliminar', 'data-id': it.id,
        }, 'Eliminar')
      )
    );

    item.append(cuerpo);
  }

  return item;
}

function pintarItemEnEdicion(it) {
  const categorias = CATEGORIAS.includes(it.categoria)
    ? CATEGORIAS
    : [it.categoria, ...CATEGORIAS];

  const selectCategoria = h('select', { name: 'categoria', required: true },
    ...categorias.map((c) => {
      const op = h('option', { value: c }, c);
      if (c === it.categoria) op.setAttribute('selected', '');
      return op;
    })
  );

  const inputItem = h('input', {
    name: 'item',
    value: it.item || '',
    placeholder: 'Item',
    required: true,
    maxlength: 100,
  });

  const textareaNotas = h('textarea', {
    name: 'notas',
    placeholder: 'Notas (opcional)',
    maxlength: 200,
    rows: 2,
  }, it.notas || '');

  return h('div', { class: 'kit-item is-abierto pieza-edit', 'data-id': it.id },
    h('div', { class: 'pieza-edit__cuerpo' },
      selectCategoria,
      inputItem,
      textareaNotas
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
        onclick: () => guardarEdicion(it.id, {
          categoria: selectCategoria.value,
          item: inputItem.value,
          notas: textareaNotas.value,
        }),
      }, 'Guardar')
    )
  );
}

async function guardarEdicion(id, valores) {
  if (!valores.item.trim()) {
    pintarError('El nombre del item no puede quedar vacío.');
    return;
  }
  const r = await repoKit.actualizar(id, {
    categoria: valores.categoria,
    item: valores.item.trim(),
    notas: (valores.notas || '').trim(),
  });
  if (r.exito) {
    const i = registro.items.findIndex((x) => x.id === id);
    if (i >= 0) registro.items[i] = r.datos;
    registro.editandoId = null;
    registro.abiertoId = id;
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

  const raiz = h('section', { id: 'vista-kit', class: 'vista vista--kit' });

  raiz.append(pintarBloqueRegistro());

  const totales = registro.items.length;
  const listos = registro.items.filter((x) => x.listo).length;

  // Progreso (solo si hay items).
  if (totales > 0) {
    const pct = Math.round((listos / totales) * 100);
    const barra = h('div', { class: 'kit-progreso__barra' });
    barra.append(h('i', { style: `width: ${pct}%` }));

    raiz.append(h('div', { class: 'kit-progreso' },
      h('div', { class: 'kit-progreso__cab' },
        h('div', { class: 'kit-progreso__num' },
          String(listos),
          h('small', {}, ` / ${totales}`)
        ),
        h('span', { class: 'kit-progreso__txt' }, 'listos para el viaje')
      ),
      barra
    ));
  }

  if (totales === 0) {
    raiz.append(h('p', { class: 'vista__vacio' }, 'El kit está vacío. Añade el primer item.'));
  } else {
    const grupos = agruparPorCategoria(registro.items);
    for (const [categoria, items] of grupos) {
      const listosGrupo = items.filter((x) => x.listo).length;
      const seccion = h('section', { class: 'kit-grupo' });
      seccion.append(h('div', { class: 'kit-grupo__cab' },
        h('span', { class: 'kit-grupo__nombre' }, categoria),
        h('span', { class: 'kit-grupo__linea' }),
        h('span', { class: 'kit-grupo__count' }, `${listosGrupo}/${items.length}`)
      ));
      const grid = h('div', { class: 'kit-grid' });
      for (const it of items) {
        grid.append(pintarItem(it));
      }
      seccion.append(grid);
      raiz.append(seccion);
    }
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
  const r = await repoKit.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.items = r.datos;
  pintar();
}

/* ---------- Submit -------------------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const r = await repoKit.crear({
    categoria: fd.get('categoria'),
    item: fd.get('item'),
    notas: fd.get('notas'),
  });
  if (r.exito) {
    registro.items = [...registro.items, r.datos];
    registro.formularioAbierto = false;
    form.reset();
    pintar();
    pintarOk('Item añadido.');
  } else {
    pintarError(r.error);
  }
}

/* ---------- Click --------------------------------------------- */

async function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (btn) {
    const accion = btn.dataset.accion;
    const id = btn.dataset.id;

    if (accion === 'abrir-formulario') {
      registro.formularioAbierto = true;
      registro.abiertoId = null;
      pintar();
      setTimeout(() => {
        const input = registro.contenedor.querySelector('input[name="item"]');
        if (input) input.focus();
      }, 60);
      return;
    }
    if (accion === 'cerrar-formulario') {
      registro.formularioAbierto = false;
      pintar();
      return;
    }
    if (accion === 'toggle-listo') {
      const it = registro.items.find((x) => x.id === id);
      if (!it) return;
      const r = await repoKit.marcar(id, !it.listo);
      if (r.exito) {
        const i = registro.items.findIndex((x) => x.id === id);
        if (i >= 0) registro.items[i] = r.datos;
        pintar();
      } else {
        pintarError(r.error);
      }
      return;
    }
    if (accion === 'editar') {
      registro.editandoId = id;
      registro.abiertoId = null;
      pintar();
      return;
    }
    if (accion === 'eliminar') {
      const ok = await mostrarConfirmacion(
        'Eliminar item del kit',
        '¿Seguro que quieres eliminar este item?',
        { textoConfirmar: 'Eliminar' }
      );
      if (!ok) return;
      const r = await repoKit.eliminar(id);
      if (r.exito) {
        registro.items = registro.items.filter((x) => x.id !== id);
        if (registro.abiertoId === id) registro.abiertoId = null;
        pintar();
      } else {
        pintarError(r.error);
      }
      return;
    }
  }

  // Si no fue un botón, ver si fue la cabecera para expandir.
  const cab = ev.target.closest('.kit-item__cab');
  if (cab) {
    const itemEl = cab.closest('.kit-item');
    const id = itemEl.dataset.id;
    registro.abiertoId = registro.abiertoId === id ? null : id;
    registro.editandoId = null;
    pintar();
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.formularioAbierto = false;
  registro.editandoId = null;
  registro.abiertoId = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:kit:crear', refrescar),
    al('realtime:kit:actualizar', refrescar),
    al('realtime:kit:eliminar', refrescar),
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
  registro.items = [];
  registro.formularioAbierto = false;
  registro.editandoId = null;
  registro.abiertoId = null;
  registro.contenedor = null;
}