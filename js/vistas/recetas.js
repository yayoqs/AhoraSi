/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/recetas.js
   Versión: 3.0.0
   Propósito: vista de recetas. Lista agrupada por categoría con
              índice lateral derecho para saltar entre secciones.
              Cada receta puede tener ingredientes simples (texto
              libre) o sub-recetas (referencia a otra receta con
              cantidad y unidad). Modal de detalle con árbol de
              ingredientes y pasos numerados.
              v3.0.0: rediseño al nuevo lenguaje visual. La vista
                      ya no emite h1 ni lead (los muestra el
                      shell). Paleta de categorías cálida. Se
                      renombran los botones principales a
                      .btn-agregar-principal y se mantienen las
                      clases del modal sin prefijo de ID.
              v1.0.2: fix del AbortController propio del modal.
              v1.0.1: fix del nombre de la clase visible del modal.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoRecetas from '../datos/repositorios/recetas.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { obtener } from '../nucleo/almacen.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

const log = crearLogger('vista:recetas');

/* Paleta cálida en armonía con el papel crema. */
const CATEGORIAS_COLOR = {
  'Desayuno': '#D9A421',  // mostaza
  'Almuerzo': '#5A6B3E',  // musgo
  'Cena':     '#C9613B',  // terracota
  'Postre':   '#E8A17A',  // terracota clara
  'Snack':    '#C8912F',  // mostaza cálida
  'Bebida':   '#7A8B5E',  // verde claro
  'Salsa':    '#A03737',  // rojo profundo
};

const NOMBRES_CATEGORIA = Object.keys(CATEGORIAS_COLOR);

const registro = {
  contenedor: null,
  raiz: null,
  abortador: null,
  abortadorModal: null,
  desuscribir: [],
  recetas: [],
  filtroCategoria: null,
  modalActivo: null,
  borrador: null,
  observer: null,
};

/* ---------- Helpers -------------------------------------------- */

function usuarioActualId() {
  const u = obtener('usuarioActual');
  return u?.$id || u?.id || null;
}

function generarId(titulo) {
  return (titulo || 'receta')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36).slice(-4);
}

function recetaPorId(id) {
  return registro.recetas.find((r) => r.id === id);
}

function colorCategoria(cat) {
  return CATEGORIAS_COLOR[cat] || 'var(--terracota)';
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

  const raiz = h('section', { id: 'vista-recetas', class: 'vista vista--recetas' });
  cont.append(raiz);
  registro.raiz = raiz;

  raiz.append(
    h('button', {
      type: 'button', class: 'btn-agregar-principal',
      'data-accion': 'abrir-formulario',
    }, '+ Nueva receta'),
    h('div', { class: 'chips-categoria' }),
    h('div', { class: 'recetas__layout' },
      h('div', { class: 'recetas__paginas' }),
      h('nav', { class: 'recetas__indice', 'aria-label': 'Categorías' })
    )
  );

  registro.chipsEl = raiz.querySelector('.chips-categoria');
  registro.paginasEl = raiz.querySelector('.recetas__paginas');
  registro.indiceEl = raiz.querySelector('.recetas__indice');
}

/* ---------- Chips de filtro ----------------------------------- */

function pintarChips() {
  const cont = registro.chipsEl;
  if (!cont) return;
  limpiarContenedor(cont);

  const opciones = [{ id: null, nombre: 'Todas' }]
    .concat(NOMBRES_CATEGORIA.map((c) => ({ id: c, nombre: c })));

  for (const op of opciones) {
    cont.append(h('button', {
      type: 'button',
      class: 'chip-categoria',
      'data-accion': 'filtrar',
      'data-categoria': op.id || '',
      'aria-pressed': String(registro.filtroCategoria === op.id),
    }, op.nombre));
  }
}

function recetasFiltradas() {
  if (!registro.filtroCategoria) return registro.recetas;
  return registro.recetas.filter((r) => r.categoria === registro.filtroCategoria);
}

/* ---------- Lista agrupada ------------------------------------ */

function pintarLista() {
  const cont = registro.paginasEl;
  if (!cont) return;
  limpiarContenedor(cont);

  const lista = recetasFiltradas();
  if (lista.length === 0) {
    cont.append(h('p', { class: 'vista__vacio' },
      registro.filtroCategoria ? 'No hay recetas en esta categoría.' : 'Todavía no hay recetas.'));
    return;
  }

  const grupos = {};
  for (const r of lista) {
    if (!grupos[r.categoria]) grupos[r.categoria] = [];
    grupos[r.categoria].push(r);
  }

  const ul = h('ul', { class: 'recetas__lista' });
  for (const cat of NOMBRES_CATEGORIA) {
    const items = grupos[cat];
    if (!items) continue;
    ul.append(pintarGrupo(cat, items));
  }
  cont.append(ul);
}

function pintarGrupo(categoria, items) {
  const color = colorCategoria(categoria);
  const idGrupo = 'cap-' + categoria.toLowerCase().replace(/\s+/g, '-');

  const tarjetas = h('div', { class: 'recetas__tarjetas' });
  for (const r of items) {
    tarjetas.append(pintarTarjeta(r, color));
  }

  return h('li', {
    class: 'recetas__grupo',
    id: idGrupo,
    'data-categoria': categoria,
    style: `--cat-color: ${color}`,
  },
    h('div', { class: 'recetas__grupo-cab' },
      h('h2', {}, categoria),
      h('span', { class: 'recetas__grupo-contador' }, String(items.length))
    ),
    tarjetas
  );
}

function pintarTarjeta(r, color) {
  const foto = r.fotos && r.fotos[0];

  const fotoDiv = h('div', { class: 'recetas__tarjeta-foto' });
  if (foto) {
    fotoDiv.append(h('img', { src: foto, alt: '', loading: 'lazy' }));
  } else {
    fotoDiv.append(h('span', { class: 'recetas__tarjeta-inicial' },
      (r.titulo || '?').trim().charAt(0).toUpperCase()));
  }

  const tieneSub = r.ingredientes.some((i) => i.tipo === 'sub');

  const meta = h('div', { class: 'recetas__tarjeta-meta' });
  meta.append(distintivoAutor(r.creadoPor));
  if (tieneSub) meta.append(h('span', { class: 'recetas__badge recetas__badge--sub' }, 'Con sub'));

  return h('article', {
    class: 'recetas__tarjeta',
    style: `--cat-color: ${color}`,
    'data-accion': 'abrir-detalle',
    'data-id': r.id,
  },
    fotoDiv,
    h('div', { class: 'recetas__tarjeta-cuerpo' },
      h('div', { class: 'recetas__tarjeta-titulo' }, r.titulo),
      meta
    )
  );
}

/* ---------- Índice lateral ------------------------------------ */

function pintarIndice() {
  const cont = registro.indiceEl;
  if (!cont) return;
  limpiarContenedor(cont);

  if (registro.filtroCategoria) return;

  const lista = recetasFiltradas();
  const cats = NOMBRES_CATEGORIA.filter((c) => lista.some((r) => r.categoria === c));
  if (cats.length < 2) return;

  for (const cat of cats) {
    const color = colorCategoria(cat);
    const id = 'cap-' + cat.toLowerCase().replace(/\s+/g, '-');
    cont.append(h('button', {
      type: 'button',
      class: 'recetas__indice-tab',
      'data-cat': id,
      style: `background: ${color};`,
      title: cat,
      'aria-label': 'Ir a ' + cat,
      'data-accion': 'ir-categoria',
      'data-destino': id,
    }, cat.slice(0, 3)));
  }
}

function engancharObserver() {
  if (registro.observer) {
    registro.observer.disconnect();
    registro.observer = null;
  }

  const tabs = registro.indiceEl.querySelectorAll('.recetas__indice-tab');
  const caps = registro.paginasEl.querySelectorAll('.recetas__grupo');
  if (!tabs.length || !caps.length) return;

  tabs[0].classList.add('activo');

  registro.observer = new IntersectionObserver((entries) => {
    entries.forEach((ent) => {
      if (ent.isIntersecting) {
        const catId = ent.target.id;
        tabs.forEach((t) => {
          t.classList.toggle('activo', t.dataset.cat === catId);
        });
      }
    });
  }, {
    root: null,
    rootMargin: '-20% 0px -70% 0px',
    threshold: 0,
  });

  caps.forEach((c) => registro.observer.observe(c));
}

/* ---------- Pintar todo --------------------------------------- */

function pintar() {
  pintarChips();
  pintarLista();
  pintarIndice();
  engancharObserver();
}

/* ---------- Refresco ------------------------------------------ */

async function refrescar() {
  const r = await repoRecetas.listar();
  if (!r.exito) {
    log.error('Error al listar recetas:', r.error);
    pintarError(r.error);
    return;
  }
  registro.recetas = r.datos;
  pintar();
}

/* ---------- Modal: helpers ------------------------------------ */

function cerrarModal() {
  if (registro.abortadorModal) {
    registro.abortadorModal.abort();
    registro.abortadorModal = null;
  }
  const m = registro.modalActivo;
  if (!m) return;
  m.classList.remove('recetas__modal--visible');
  setTimeout(() => {
    if (m.parentNode) m.remove();
  }, 200);
  registro.modalActivo = null;
}

function crearModalBase(tituloModal, cuerpo, pie) {
  cerrarModal();

  const modal = h('div', { class: 'recetas__modal' });
  const tarjeta = h('div', { class: 'recetas__modal-tarjeta' });

  tarjeta.append(
    h('div', { class: 'recetas__modal-handle' }),
    h('div', { class: 'recetas__modal-cabecera' },
      h('h2', {}, tituloModal),
      h('button', {
        type: 'button',
        class: 'recetas__modal-cerrar',
        'data-accion': 'cerrar-modal',
        'aria-label': 'Cerrar',
      }, '×')
    ),
    cuerpo
  );

  if (pie) tarjeta.append(pie);

  modal.append(tarjeta);
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal) cerrarModal();
  });

  const abortadorModal = new AbortController();
  registro.abortadorModal = abortadorModal;
  const { signal } = abortadorModal;
  modal.addEventListener('click', manejarClick, { signal });
  modal.addEventListener('input', manejarInput, { signal });
  modal.addEventListener('change', manejarChange, { signal });

  document.body.append(modal);
  modal.offsetWidth;
  modal.classList.add('recetas__modal--visible');
  registro.modalActivo = modal;

  return modal;
}

/* ---------- Modal: detalle ------------------------------------ */

function abrirDetalle(id) {
  const r = recetaPorId(id);
  if (!r) return;

  const color = colorCategoria(r.categoria);
  const cuerpo = h('div', { class: 'recetas__modal-cuerpo' });

  cuerpo.append(
    h('div', { class: 'recetas__detalle-meta' },
      h('span', {
        class: 'recetas__badge',
        style: `background: ${color}22; color: ${color}; padding: 4px 10px; font-size: 11px; border: 1px solid ${color}55;`,
      }, r.categoria),
      distintivoAutor(r.creadoPor)
    )
  );

  if (r.fotos && r.fotos[0]) {
    cuerpo.append(h('div', {
      class: 'recetas__detalle-foto',
      style: `background-image: url('${r.fotos[0]}')`,
    }));
  }

  cuerpo.append(
    h('section', {},
      h('p', { class: 'recetas__seccion-titulo' }, 'Ingredientes'),
      pintarIngredientes(r.ingredientes)
    )
  );

  cuerpo.append(
    h('section', {},
      h('p', { class: 'recetas__seccion-titulo' }, 'Preparación'),
      pintarPasos(r.pasos)
    )
  );

  if (r.nota) {
    cuerpo.append(
      h('section', {},
        h('p', { class: 'recetas__seccion-titulo' }, 'Nota'),
        h('div', { class: 'recetas__nota' }, r.nota)
      )
    );
  }

  const pie = h('div', { class: 'recetas__modal-pie' },
    h('button', {
      type: 'button', class: 'recetas__btn-peligro',
      'data-accion': 'eliminar', 'data-id': r.id,
    }, 'Eliminar'),
    h('button', {
      type: 'button', class: 'recetas__btn-secundario',
      'data-accion': 'cerrar-modal',
    }, 'Cerrar'),
    h('button', {
      type: 'button', class: 'recetas__btn-primario',
      'data-accion': 'editar', 'data-id': r.id,
    }, 'Editar')
  );

  crearModalBase(r.titulo, cuerpo, pie);
}

function pintarIngredientes(ingredientes) {
  const ul = h('ul', { class: 'recetas__ingredientes' });

  if (ingredientes.length === 0) {
    ul.append(h('li', { class: 'vista__vacio' }, 'Sin ingredientes.'));
    return ul;
  }

  for (const ing of ingredientes) {
    if (ing.tipo === 'simple') {
      ul.append(h('li', { class: 'recetas__ing-simple' }, ing.texto));
    } else if (ing.tipo === 'sub') {
      const sub = recetaPorId(ing.recetaId);
      const nombreSub = sub ? sub.titulo : '(sub-receta eliminada)';
      const cantidad = [ing.cantidad, ing.unidad].filter(Boolean).join(' ');

      const hijosUl = h('ul', { class: 'recetas__ing-sub-hijos' });
      if (sub) {
        for (const subIng of sub.ingredientes) {
          if (subIng.tipo === 'simple') {
            hijosUl.append(h('li', {}, subIng.texto));
          } else {
            const subSub = recetaPorId(subIng.recetaId);
            hijosUl.append(h('li', {}, '📦 ' + (subSub ? subSub.titulo : '(desconocida)')));
          }
        }
      }

      ul.append(h('li', { class: 'recetas__ing-sub' },
        h('details', {},
          h('summary', {},
            h('span', { class: 'recetas__ing-sub-nombre' }, '📦 ' + nombreSub),
            cantidad ? h('span', { class: 'recetas__ing-sub-cantidad' }, cantidad) : null
          ),
          sub ? hijosUl : null
        )
      ));
    }
  }
  return ul;
}

function pintarPasos(pasos) {
  const ol = h('ol', { class: 'recetas__pasos' });
  pasos.forEach((p, i) => {
    ol.append(h('li', { class: 'recetas__paso' },
      h('span', { class: 'recetas__paso-num' }, String(i + 1)),
      h('span', { class: 'recetas__paso-texto' }, p)
    ));
  });
  return ol;
}

/* ---------- Modal: formulario --------------------------------- */

function abrirFormulario(idReceta) {
  const editando = idReceta ? recetaPorId(idReceta) : null;

  registro.borrador = editando
    ? {
        id: editando.id,
        titulo: editando.titulo,
        categoria: editando.categoria,
        nota: editando.nota || '',
        ingredientes: editando.ingredientes.map((i) => ({ ...i })),
        pasos: editando.pasos.slice(),
        fotos: (editando.fotos || []).slice(),
      }
    : {
        id: null,
        titulo: '',
        categoria: NOMBRES_CATEGORIA[0],
        nota: '',
        ingredientes: [],
        pasos: [''],
        fotos: [],
      };

  pintarFormulario();
}

function pintarFormulario() {
  const editando = !!registro.borrador.id;

  const cuerpo = h('div', { class: 'recetas__modal-cuerpo' });

  cuerpo.append(
    h('div', { class: 'recetas__form-fila' },
      h('div', { class: 'recetas__campo' },
        h('label', {}, 'Título'),
        h('input', {
          type: 'text', value: registro.borrador.titulo,
          maxlength: '100', placeholder: 'Ej. Pan amasado',
          'data-campo': 'titulo',
        })
      ),
      h('div', { class: 'recetas__campo' },
        h('label', {}, 'Categoría'),
        h('select', { 'data-campo': 'categoria' },
          ...NOMBRES_CATEGORIA.map((c) => {
            const op = h('option', { value: c }, c);
            if (c === registro.borrador.categoria) op.setAttribute('selected', '');
            return op;
          })
        )
      )
    )
  );

  const listaIng = h('div', { class: 'recetas__lista-editable', 'data-lista': 'ingredientes' });
  cuerpo.append(
    h('div', { class: 'recetas__campo' },
      h('label', {}, 'Ingredientes'),
      listaIng,
      h('div', { class: 'recetas__tipo-ing' },
        h('button', {
          type: 'button',
          'data-accion': 'agregar-ing-simple',
        }, '+ Ingrediente simple'),
        h('button', {
          type: 'button',
          'data-accion': 'agregar-ing-sub',
        }, '+ Sub-receta')
      )
    )
  );

  const listaPasos = h('div', { class: 'recetas__lista-editable', 'data-lista': 'pasos' });
  cuerpo.append(
    h('div', { class: 'recetas__campo' },
      h('label', {}, 'Preparación'),
      listaPasos,
      h('button', {
        type: 'button', class: 'recetas__btn-agregar-linea',
        'data-accion': 'agregar-paso',
      }, '+ Añadir paso')
    )
  );

  cuerpo.append(
    h('div', { class: 'recetas__campo' },
      h('label', {}, 'Nota (opcional)'),
      h('textarea', {
        placeholder: 'Algún detalle, truco o comentario sobre la receta',
        maxlength: '500',
        'data-campo': 'nota',
      }, registro.borrador.nota)
    )
  );

  cuerpo.append(
    h('div', { class: 'recetas__campo' },
      h('label', {}, 'Foto (URL, opcional)'),
      h('input', {
        type: 'url',
        value: registro.borrador.fotos[0] || '',
        placeholder: 'https://...',
        'data-campo': 'foto',
      })
    )
  );

  const pie = h('div', { class: 'recetas__modal-pie' },
    h('button', {
      type: 'button', class: 'recetas__btn-secundario',
      'data-accion': 'cerrar-modal',
    }, 'Cancelar'),
    h('button', {
      type: 'button', class: 'recetas__btn-primario',
      'data-accion': 'guardar',
    }, editando ? 'Guardar cambios' : 'Crear receta')
  );

  crearModalBase(editando ? 'Editar receta' : 'Nueva receta', cuerpo, pie);

  pintarIngredientesEditables();
  pintarPasosEditables();
}

function pintarIngredientesEditables() {
  const cont = registro.modalActivo?.querySelector('[data-lista="ingredientes"]');
  if (!cont) return;
  limpiarContenedor(cont);

  if (registro.borrador.ingredientes.length === 0) {
    cont.append(h('p', { class: 'recetas__aviso' }, 'Sin ingredientes todavía.'));
    return;
  }

  registro.borrador.ingredientes.forEach((ing, idx) => {
    if (ing.tipo === 'simple') {
      cont.append(h('div', { class: 'recetas__fila-editable' },
        h('input', {
          type: 'text', value: ing.texto,
          placeholder: 'Ej. 2 tazas de harina', maxlength: '150',
          'data-campo-ing': 'texto', 'data-idx': String(idx),
        }),
        h('button', {
          type: 'button', class: 'recetas__btn-quitar',
          'data-accion': 'quitar-ing', 'data-idx': String(idx),
        }, '×')
      ));
    } else {
      const disponibles = registro.recetas.filter((r) => r.id !== registro.borrador.id);
      const select = h('select', {
        'data-campo-ing': 'recetaId', 'data-idx': String(idx),
      }, ...disponibles.map((r) => {
        const op = h('option', { value: r.id }, r.titulo);
        if (r.id === ing.recetaId) op.setAttribute('selected', '');
        return op;
      }));

      cont.append(h('div', { class: 'recetas__fila-editable recetas__fila-editable--sub' },
        select,
        h('input', {
          type: 'number', value: String(ing.cantidad || ''),
          placeholder: 'Cant.', 'data-campo-ing': 'cantidad', 'data-idx': String(idx),
        }),
        h('input', {
          type: 'text', value: ing.unidad || '',
          placeholder: 'Unidad', maxlength: '10',
          'data-campo-ing': 'unidad', 'data-idx': String(idx),
        }),
        h('button', {
          type: 'button', class: 'recetas__btn-quitar',
          'data-accion': 'quitar-ing', 'data-idx': String(idx),
        }, '×')
      ));
    }
  });
}

function pintarPasosEditables() {
  const cont = registro.modalActivo?.querySelector('[data-lista="pasos"]');
  if (!cont) return;
  limpiarContenedor(cont);

  registro.borrador.pasos.forEach((p, idx) => {
    cont.append(h('div', { class: 'recetas__fila-editable' },
      h('input', {
        type: 'text', value: p,
        placeholder: `Paso ${idx + 1}`, maxlength: '500',
        'data-campo-paso': '', 'data-idx': String(idx),
      }),
      h('button', {
        type: 'button', class: 'recetas__btn-quitar',
        'data-accion': 'quitar-paso', 'data-idx': String(idx),
      }, '×')
    ));
  });
}

/* ---------- Guardar formulario -------------------------------- */

async function guardarFormulario() {
  const b = registro.borrador;
  if (!b) return;

  if (!b.titulo.trim()) {
    pintarError('Falta el título.');
    return;
  }

  const ingredientesValidos = b.ingredientes.filter((i) =>
    i.tipo === 'simple' ? i.texto.trim() : i.recetaId
  );
  if (ingredientesValidos.length === 0) {
    pintarError('Agrega al menos un ingrediente.');
    return;
  }

  const pasosValidos = b.pasos.map((p) => p.trim()).filter(Boolean);
  if (pasosValidos.length === 0) {
    pintarError('Agrega al menos un paso.');
    return;
  }

  const payload = {
    titulo: b.titulo.trim(),
    categoria: b.categoria,
    nota: b.nota.trim(),
    ingredientes: ingredientesValidos,
    pasos: pasosValidos,
    fotos: b.fotos.slice(),
  };

  let r;
  if (b.id) {
    r = await repoRecetas.actualizar(b.id, payload);
  } else {
    r = await repoRecetas.crear(payload);
  }

  if (!r.exito) {
    pintarError(r.error);
    return;
  }

  cerrarModal();
  await refrescar();
  pintarOk(b.id ? 'Receta actualizada.' : 'Receta creada.');
}

/* ---------- Eliminar ------------------------------------------ */

async function eliminarReceta(id) {
  const r = recetaPorId(id);
  if (!r) return;

  const ok = await mostrarConfirmacion(
    'Eliminar receta',
    `¿Seguro que quieres eliminar "${r.titulo}"?`,
    { textoConfirmar: 'Eliminar' }
  );
  if (!ok) return;

  const usan = registro.recetas.filter((x) => x.id !== id &&
    x.ingredientes.some((i) => i.tipo === 'sub' && i.recetaId === id));

  if (usan.length > 0) {
    const nombres = usan.map((u) => u.titulo).join(', ');
    const ok2 = await mostrarConfirmacion(
      'Está en uso',
      `Esta receta se usa como sub-receta en: ${nombres}. ¿Eliminar igual?`,
      { textoConfirmar: 'Eliminar igual' }
    );
    if (!ok2) return;
  }

  const res = await repoRecetas.eliminar(id);
  if (res.exito) {
    cerrarModal();
    await refrescar();
    pintarOk('Receta eliminada.');
  } else {
    pintarError(res.error);
  }
}

/* ---------- Manejo de eventos --------------------------------- */

function manejarClick(ev) {
  const btn = ev.target.closest('[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;

  if (accion === 'abrir-formulario') {
    abrirFormulario(null);
  } else if (accion === 'cerrar-modal') {
    cerrarModal();
  } else if (accion === 'filtrar') {
    const cat = btn.dataset.categoria || null;
    registro.filtroCategoria = registro.filtroCategoria === cat ? null : cat;
    pintar();
  } else if (accion === 'ir-categoria') {
    document.getElementById(btn.dataset.destino)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (accion === 'abrir-detalle') {
    abrirDetalle(id);
  } else if (accion === 'editar') {
    abrirFormulario(id);
  } else if (accion === 'eliminar') {
    eliminarReceta(id);
  } else if (accion === 'agregar-ing-simple') {
    registro.borrador.ingredientes.push({ tipo: 'simple', texto: '' });
    pintarIngredientesEditables();
  } else if (accion === 'agregar-ing-sub') {
    const disponibles = registro.recetas.filter((r) => r.id !== registro.borrador.id);
    if (disponibles.length === 0) {
      pintarError('No hay otras recetas para usar como sub-receta.');
      return;
    }
    registro.borrador.ingredientes.push({
      tipo: 'sub',
      recetaId: disponibles[0].id,
      cantidad: 100,
      unidad: 'g',
    });
    pintarIngredientesEditables();
  } else if (accion === 'quitar-ing') {
    const idx = Number(btn.dataset.idx);
    registro.borrador.ingredientes.splice(idx, 1);
    pintarIngredientesEditables();
  } else if (accion === 'agregar-paso') {
    registro.borrador.pasos.push('');
    pintarPasosEditables();
  } else if (accion === 'quitar-paso') {
    const idx = Number(btn.dataset.idx);
    if (registro.borrador.pasos.length === 1) {
      registro.borrador.pasos[0] = '';
    } else {
      registro.borrador.pasos.splice(idx, 1);
    }
    pintarPasosEditables();
  } else if (accion === 'guardar') {
    guardarFormulario();
  }
}

function manejarInput(ev) {
  const el = ev.target;

  const campo = el.dataset.campo;
  if (campo === 'titulo') {
    registro.borrador.titulo = el.value;
    return;
  }
  if (campo === 'nota') {
    registro.borrador.nota = el.value;
    return;
  }
  if (campo === 'foto') {
    const v = el.value.trim();
    registro.borrador.fotos = v ? [v] : [];
    return;
  }

  const campoIng = el.dataset.campoIng;
  if (campoIng) {
    const idx = Number(el.dataset.idx);
    const ing = registro.borrador.ingredientes[idx];
    if (!ing) return;
    if (campoIng === 'texto') ing.texto = el.value;
    else if (campoIng === 'recetaId') ing.recetaId = el.value;
    else if (campoIng === 'cantidad') ing.cantidad = Number(el.value) || 0;
    else if (campoIng === 'unidad') ing.unidad = el.value;
    return;
  }

  if (el.hasAttribute('data-campo-paso')) {
    const idx = Number(el.dataset.idx);
    registro.borrador.pasos[idx] = el.value;
    return;
  }
}

function manejarChange(ev) {
  const el = ev.target;
  if (el.dataset.campo === 'categoria') {
    registro.borrador.categoria = el.value;
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.abortadorModal = null;
  registro.filtroCategoria = null;
  registro.modalActivo = null;
  registro.borrador = null;
  registro.observer = null;
  registro.recetas = [];

  const { signal } = registro.abortador;
  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('input', manejarInput, { signal });
  contenedor.addEventListener('change', manejarChange, { signal });

  registro.desuscribir = [
    al('realtime:recetas:crear', async () => { await refrescar(); }),
    al('realtime:recetas:actualizar', async () => { await refrescar(); }),
    al('realtime:recetas:eliminar', async () => { await refrescar(); }),
  ];

  montarEstructura();
  await refrescar();
}

export function limpiar() {
  if (registro.observer) {
    registro.observer.disconnect();
    registro.observer = null;
  }
  cerrarModal();

  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;

  if (registro.contenedor) limpiarContenedor(registro.contenedor);

  registro.recetas = [];
  registro.filtroCategoria = null;
  registro.modalActivo = null;
  registro.borrador = null;
  registro.raiz = null;
  registro.chipsEl = null;
  registro.paginasEl = null;
  registro.indiceEl = null;
  registro.contenedor = null;
}