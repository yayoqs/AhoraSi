/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/flora.js
   Versión: 2.2.0
   Propósito: vista de flora en formato bitácora de campo.
              v2.2.0: mismo cambio que fauna v2.2.0. La tarjeta
                      ya no permite añadir fotos. La galería
                      compacta muestra hasta 3 fotos y "+N". El
                      flujo de subida vive en el detalle.
              v2.1.0: la tarjeta usa galeria.js en modo compacto.
              v2.0.0: rediseño bitácora.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoFlora from '../datos/repositorios/flora.js';
import * as repoFotos from '../datos/repositorios/fotos.js';
import { comprimir } from '../datos/subidor-fotos.js';
import { abrirCamara, camaraDisponible } from './componentes/camara.js';
import {
  limpiarGaleria,
  pintarGaleria,
} from './componentes/galeria.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import {
  h, limpiarContenedor, formatearFecha,
} from '../nucleo/utils.js';

const log = crearLogger('vista:flora');

const TIPOS = [
  { id: 'arbol', etiqueta: 'Árbol' },
  { id: 'arbusto', etiqueta: 'Arbusto' },
  { id: 'hierba', etiqueta: 'Hierba' },
  { id: 'flor', etiqueta: 'Flor' },
  { id: 'helecho', etiqueta: 'Helecho' },
  { id: 'musgo', etiqueta: 'Musgo' },
  { id: 'hongo', etiqueta: 'Hongo' },
  { id: 'otro', etiqueta: 'Otro' },
];

const ICONO_CERRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>';
const ICONO_FOTO = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3l-2 3H3v15h18V6h-4l-2-3H9zm3 6a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/></svg>';
const ICONO_CAMARA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3l-2 3H3v15h18V6h-4l-2-3H9z"/><circle cx="12" cy="13" r="4"/></svg>';

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  registros: [],
  fotosPorRegistro: {},
  sheetActivo: null,
  abortadorSheet: null,
  fotoPendiente: null,
};

function etiquetaTipo(id) {
  const t = TIPOS.find((x) => x.id === id);
  return t ? t.etiqueta : id;
}

function fechaParaInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
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

function pintarRegistro(r) {
  const card = h('article', {
    class: 'registro',
    'data-id': r.id,
    'data-accion': 'abrir-detalle',
    role: 'button',
    tabindex: '0',
  });

  const cab = h('div', { class: 'registro__cab' });
  const tituloWrap = h('div', { class: 'registro__titulo-wrap' });
  tituloWrap.append(h('div', { class: 'registro__nombre' }, r.nombre));
  cab.append(tituloWrap);

  if (r.registradoPor) {
    const d = distintivoAutor(r.registradoPor);
    d.classList.add('registro__autor');
    cab.append(d);
  }
  card.append(cab);

  const meta = h('div', { class: 'registro__meta' });
  meta.append(h('span', { class: `chip-tipo chip-tipo--${r.tipo || 'otro'}` }, etiquetaTipo(r.tipo)));
  meta.append(h('span', { class: 'registro__meta-sep' }, '·'));
  if (r.lugar) meta.append(h('span', { class: 'registro__meta-item' }, r.lugar));
  if (r.lugar && r.fecha) meta.append(h('span', { class: 'registro__meta-sep' }, '·'));
  if (r.fecha) meta.append(h('span', { class: 'registro__meta-item' }, formatearFecha(r.fecha)));
  card.append(meta);

  const galeria = pintarGaleria({
    fotos: registro.fotosPorRegistro[r.id] || [],
    tabla: 'ahorasi_flora',
    filaId: r.id,
    compacto: true,
    onVerMas: () => abrirDetalle(r),
  });
  card.append(galeria);

  return card;
}

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-flora', class: 'vista vista--flora' });

  raiz.append(h('button', {
    type: 'button',
    class: 'btn-fantasma',
    'data-accion': 'abrir-formulario',
    'aria-hidden': 'true',
    tabindex: '-1',
    style: 'display:none',
  }));

  if (registro.registros.length === 0) {
    raiz.append(h('p', { class: 'vista__vacio' }, 'Aún sin registros. Anota el primero con el botón +.'));
  } else {
    const lista = h('div', { class: 'lista-registros' });
    for (const r of registro.registros) lista.append(pintarRegistro(r));
    raiz.append(lista);
  }

  cont.append(raiz);
}

async function cargarFotosDeTodos() {
  const resultados = await Promise.all(
    registro.registros.map((r) =>
      repoFotos.listarPorFila('ahorasi_flora', r.id).then((res) => ({
        id: r.id,
        fotos: res.exito ? res.datos : [],
      }))
    )
  );
  const nuevo = {};
  for (const { id, fotos } of resultados) nuevo[id] = fotos;
  registro.fotosPorRegistro = nuevo;
}

async function refrescar() {
  const r = await repoFlora.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.registros = r.datos;
  await cargarFotosDeTodos();
  pintar();
}

function cerrarSheet() {
  const s = registro.sheetActivo;
  if (!s) return;
  if (registro.abortadorSheet) {
    registro.abortadorSheet.abort();
    registro.abortadorSheet = null;
  }
  registro.sheetActivo = null;
  s.classList.remove('is-open');
  setTimeout(() => { if (s.parentNode) s.remove(); }, 320);
}

function abrirSheet({ eyebrow, titulo, cuerpo, foot }) {
  cerrarSheet();
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const panel = h('div', { class: 'sheet__panel' });

  const head = h('div', { class: 'sheet__head' },
    h('div', { class: 'sheet__head-title' },
      eyebrow ? h('p', { class: 'sheet__eyebrow' }, eyebrow) : null,
      h('h2', { class: 'sheet__title' }, titulo)
    ),
    h('button', { type: 'button', class: 'sheet__cerrar', 'aria-label': 'Cerrar' }, h('span', { html: ICONO_CERRAR }))
  );

  const body = h('div', { class: 'sheet__body' }, cuerpo);
  const footEl = foot ? h('div', { class: 'sheet__foot' }, foot) : null;

  panel.append(h('div', { class: 'sheet__handle' }), head, body);
  if (footEl) panel.append(footEl);
  sheet.append(panel);
  document.body.append(sheet);

  const abortador = new AbortController();
  registro.abortadorSheet = abortador;
  const { signal } = abortador;

  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) cerrarSheet(); }, { signal });
  head.querySelector('.sheet__cerrar').addEventListener('click', cerrarSheet, { signal });
  body.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrarSheet, { signal }));

  requestAnimationFrame(() => sheet.classList.add('is-open'));
  registro.sheetActivo = sheet;
  return { sheet, body, footEl };
}

function abrirDetalle(r) {
  const fotos = registro.fotosPorRegistro[r.id] || [];

  const cuerpo = h('div', {});
  cuerpo.append(h('div', { class: 'detalle__meta' },
    distintivoAutor(r.registradoPor),
    h('span', { class: `chip-tipo chip-tipo--${r.tipo || 'otro'}` }, etiquetaTipo(r.tipo))
  ));

  const info = h('div', { class: 'detalle__info' });
  if (r.lugar) info.append(h('div', { class: 'detalle__info-item' },
    h('span', { class: 'detalle__info-label' }, 'Lugar'),
    h('span', { class: 'detalle__info-valor' }, r.lugar)));
  if (r.fecha) info.append(h('div', { class: 'detalle__info-item' },
    h('span', { class: 'detalle__info-label' }, 'Fecha'),
    h('span', { class: 'detalle__info-valor' }, formatearFecha(r.fecha))));
  if (info.children.length) cuerpo.append(info);

  const seccionFotos = h('div', { class: 'detalle__seccion' },
    h('h3', { class: 'detalle__seccion-title' }, `Fotos · ${fotos.length}`)
  );
  const galeria = pintarGaleria({
    fotos,
    tabla: 'ahorasi_flora',
    filaId: r.id,
    onCambio: async () => {
      await cargarFotosDeTodos();
      pintar();
      const actualizado = registro.registros.find((x) => x.id === r.id);
      if (actualizado) {
        cerrarSheet();
        setTimeout(() => abrirDetalle(actualizado), 340);
      }
    },
    onMensaje: (texto, tipo) => tipo === 'error' ? pintarError(texto) : pintarOk(texto),
  });
  seccionFotos.append(galeria);
  cuerpo.append(seccionFotos);

  const foot = h('div', { style: 'display:flex;gap:8px;width:100%' },
    h('button', { type: 'button', class: 'btn btn--peligro',
      onclick: () => { cerrarSheet(); setTimeout(() => confirmarEliminar(r), 340); } }, 'Eliminar'),
    h('button', { type: 'button', class: 'btn btn--secundario', onclick: cerrarSheet }, 'Cerrar'),
    h('button', { type: 'button', class: 'btn btn--primario',
      onclick: () => { cerrarSheet(); setTimeout(() => abrirFormulario(r), 340); } }, 'Editar')
  );

  abrirSheet({ eyebrow: 'Flora', titulo: r.nombre, cuerpo, foot });
}

function abrirFormulario(r) {
  const editando = !!r;
  if (editando) registro.fotoPendiente = null;

  let fotoPendiente = null;
  const filaFoto = h('div', { class: 'form-foto-fila' });

  function pintarFilaFoto() {
    limpiarContenedor(filaFoto);
    if (fotoPendiente) {
      filaFoto.append(h('div', { class: 'form-foto-preview' },
        h('div', { class: 'form-foto-preview__thumb' }, h('span', { html: ICONO_FOTO })),
        h('span', { class: 'form-foto-preview__texto' }, `${fotoPendiente.nombre} · ${Math.round(fotoPendiente.blob.size / 1024)} KB`),
        h('button', {
          type: 'button', class: 'form-foto-preview__quitar',
          onclick: () => {
            if (fotoPendiente?.urlPreview) URL.revokeObjectURL(fotoPendiente.urlPreview);
            fotoPendiente = null;
            registro.fotoPendiente = null;
            pintarFilaFoto();
          },
        }, 'Quitar')
      ));
      return;
    }

    const inputArchivo = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    inputArchivo.addEventListener('change', async () => {
      const archivo = inputArchivo.files?.[0];
      inputArchivo.value = '';
      if (!archivo) return;
      try {
        const comprimida = await comprimir(archivo);
        fotoPendiente = {
          blob: comprimida.blob,
          nombre: archivo.name,
          urlPreview: URL.createObjectURL(comprimida.blob),
        };
        registro.fotoPendiente = fotoPendiente;
        pintarFilaFoto();
      } catch (e) {
        pintarError('No se pudo procesar la foto: ' + e.message);
      }
    });

    filaFoto.append(inputArchivo);
    filaFoto.append(h('button', {
      type: 'button', class: 'form-foto-btn',
      onclick: () => inputArchivo.click(),
    }, h('span', { html: ICONO_FOTO }), 'Galería'));

    if (camaraDisponible()) {
      filaFoto.append(h('button', {
        type: 'button', class: 'form-foto-btn',
        onclick: async () => {
          try {
            const blob = await abrirCamara();
            if (!blob) return;
            const comprimida = await comprimir(blob, { maxAncho: 1200, calidad: 0.85 });
            fotoPendiente = {
              blob: comprimida.blob,
              nombre: 'camara.jpg',
              urlPreview: URL.createObjectURL(comprimida.blob),
            };
            registro.fotoPendiente = fotoPendiente;
            pintarFilaFoto();
          } catch (e) {
            pintarError('No se pudo abrir la cámara: ' + e.message);
          }
        },
      }, h('span', { html: ICONO_CAMARA }), 'Cámara'));
    }
  }
  pintarFilaFoto();

  const inputNombre = h('input', { type: 'text', value: r?.nombre || '', placeholder: 'Quillay, Rosa, Helecho…', maxlength: 100 });
  const selectTipo = h('select', {}, ...TIPOS.map((t) => {
    const op = h('option', { value: t.id }, t.etiqueta);
    if (r?.tipo === t.id) op.setAttribute('selected', '');
    return op;
  }));
  const inputLugar = h('input', { type: 'text', value: r?.lugar || '', placeholder: 'Cerro, bosque, patio…', maxlength: 200 });
  const inputFecha = h('input', { type: 'date', value: fechaParaInput(r?.fecha) });

  const cuerpo = h('div', {},
    filaFoto,
    h('div', { class: 'fcampo' }, h('label', {}, 'Nombre'), inputNombre),
    h('div', { class: 'fcampo' }, h('label', {}, 'Tipo'), selectTipo),
    h('div', { class: 'fcampo--dos' },
      h('div', { class: 'fcampo' }, h('label', {}, 'Lugar'), inputLugar),
      h('div', { class: 'fcampo' }, h('label', {}, 'Fecha'), inputFecha)
    )
  );

  const botonGuardar = h('button', { type: 'button', class: 'btn btn--primario' },
    editando ? 'Guardar' : 'Registrar');

  botonGuardar.addEventListener('click', async () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) { pintarError('Falta el nombre'); return; }
    const fecha = inputFecha.value
      ? new Date(inputFecha.value + 'T12:00:00').toISOString()
      : null;

    const datos = {
      nombre,
      tipo: selectTipo.value,
      lugar: inputLugar.value.trim(),
      fecha,
    };

    const resultado = editando
      ? await repoFlora.actualizar(r.id, datos)
      : await repoFlora.crear(datos);

    if (!resultado.exito) {
      pintarError(resultado.error);
      return;
    }

    if (!editando && fotoPendiente) {
      const subida = await repoFotos.subir(
        'ahorasi_flora', resultado.datos.id,
        fotoPendiente.blob, fotoPendiente.nombre
      );
      if (!subida.exito) pintarError('Registro guardado, pero la foto falló: ' + subida.error);
      if (fotoPendiente.urlPreview) URL.revokeObjectURL(fotoPendiente.urlPreview);
      registro.fotoPendiente = null;
    }

    cerrarSheet();
    await refrescar();
    pintarOk(editando ? 'Guardado.' : 'Registrado.');
  });

  const foot = h('div', { style: 'display:flex;gap:8px;width:100%' },
    h('button', {
      type: 'button', class: 'btn btn--secundario',
      onclick: () => {
        if (fotoPendiente?.urlPreview) URL.revokeObjectURL(fotoPendiente.urlPreview);
        registro.fotoPendiente = null;
        cerrarSheet();
      },
    }, 'Cancelar'),
    botonGuardar
  );

  abrirSheet({
    eyebrow: 'Flora',
    titulo: editando ? 'Editar registro' : 'Nuevo registro',
    cuerpo,
    foot,
  });
}

async function confirmarEliminar(r) {
  const ok = await mostrarConfirmacion(
    'Eliminar registro',
    '¿Seguro que quieres eliminar este registro? También se eliminarán sus fotos.',
    { textoConfirmar: 'Eliminar' }
  );
  if (!ok) return;
  await repoFotos.eliminarPorFila('ahorasi_flora', r.id);
  const res = await repoFlora.eliminar(r.id);
  if (res.exito) {
    registro.registros = registro.registros.filter((x) => x.id !== r.id);
    delete registro.fotosPorRegistro[r.id];
    pintar();
    pintarOk('Eliminado.');
  } else {
    pintarError(res.error);
  }
}

function manejarClick(ev) {
  const btn = ev.target.closest('[data-accion]');
  if (btn) {
    const accion = btn.dataset.accion;
    const id = btn.dataset.id;

    if (accion === 'abrir-formulario') { abrirFormulario(null); return; }
    if (accion === 'editar') {
      ev.stopPropagation();
      const r = registro.registros.find((x) => x.id === id);
      if (r) abrirFormulario(r);
      return;
    }
    if (accion === 'eliminar') {
      ev.stopPropagation();
      const r = registro.registros.find((x) => x.id === id);
      if (r) confirmarEliminar(r);
      return;
    }
  }

  const tarjeta = ev.target.closest('.registro');
  if (tarjeta) {
    const r = registro.registros.find((x) => x.id === tarjeta.dataset.id);
    if (r) abrirDetalle(r);
  }
}

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.registros = [];
  registro.fotosPorRegistro = {};
  registro.sheetActivo = null;
  registro.abortadorSheet = null;
  registro.fotoPendiente = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:flora:crear', refrescar),
    al('realtime:flora:actualizar', refrescar),
    al('realtime:flora:eliminar', refrescar),
    al('realtime:fotos:creada', refrescar),
    al('realtime:fotos:eliminada', refrescar),
  ];

  pintar();
  await refrescar();
}

export function limpiar() {
  cerrarSheet();
  limpiarGaleria();
  if (registro.fotoPendiente?.urlPreview) URL.revokeObjectURL(registro.fotoPendiente.urlPreview);
  registro.fotoPendiente = null;

  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);

  registro.registros = [];
  registro.fotosPorRegistro = {};
  registro.sheetActivo = null;
  registro.abortadorSheet = null;
  registro.contenedor = null;
}