/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/fauna.js
   Versión: 1.5.0
   Propósito: vista de fauna. Formulario arriba con foto opcional
              (cámara o galería) antes de los campos. Tres campos
              nuevos opcionales: nombre propio, pertenece a, notas.
              Al guardar se crea el registro y se sube la foto
              pendiente en un solo paso.
              v1.5.0: flujo unificado de captura + datos. Cámara y
                      galería arriba del formulario. Preview de la
                      foto pendiente con botón quitar. Tres campos
                      nuevos. Si la foto falla al subir, el registro
                      igual se guarda (se puede reintentar desde la
                      tarjeta).
              v1.4.0: edición inline, cámara con previsualización.
              v1.3.0: galería y lightbox.
              v1.2.1: mostrarConfirmacion().
              v1.2.0: activar() pinta primero.
              v1.1.0: distintivoAutor, clase .vista--fauna.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoFauna from '../datos/repositorios/fauna.js';
import * as repoFotos from '../datos/repositorios/fotos.js';
import { comprimir } from '../datos/subidor-fotos.js';
import { abrirCamara, camaraDisponible } from './componentes/camara.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:fauna');

const TIPOS = [
  { id: 'ave', etiqueta: 'Ave' },
  { id: 'mamifero', etiqueta: 'Mamífero' },
  { id: 'reptil', etiqueta: 'Reptil' },
  { id: 'anfibio', etiqueta: 'Anfibio' },
  { id: 'pez', etiqueta: 'Pez' },
  { id: 'insecto', etiqueta: 'Insecto' },
  { id: 'otro', etiqueta: 'Otro' },
];

const SUGERENCIAS_PERTENECE = [
  'Silvestre',
  'Doméstico',
  'De un familiar',
  'De un vecino',
  'De un conocido',
];

const registro = {
  contenedor: null,
  abortador: null,
  desuscribir: [],
  registros: [],
  fotosPorRegistro: {},
  luz: null,
  subiendo: false,
  editandoId: null,
  fotoPendiente: null,      // { blob, urlPreview, nombre }
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

function limpiarFotoPendiente() {
  if (registro.fotoPendiente?.urlPreview) {
    URL.revokeObjectURL(registro.fotoPendiente.urlPreview);
  }
  registro.fotoPendiente = null;
}

/* ---------- Formulario ---------------------------------------- */

function pintarFormularioFoto() {
  const cont = h('div', { class: 'form-foto' });

  if (registro.fotoPendiente) {
    cont.append(
      h('div', { class: 'form-foto__preview' },
        h('img', {
          src: registro.fotoPendiente.urlPreview,
          alt: 'Foto pendiente',
        }),
        h('div', { class: 'form-foto__preview-info' },
          h('p', { class: 'form-foto__peso' },
            'Foto lista · ' + Math.round(registro.fotoPendiente.blob.size / 1024) + ' KB'),
          h('button', {
            type: 'button',
            class: 'form-foto__quitar',
            'data-accion': 'quitar-foto-pendiente',
          }, 'Quitar')
        )
      )
    );
    return cont;
  }

  const inputId = 'input-foto-formulario';
  const puedeCamara = camaraDisponible();

  cont.append(
    h('div', { class: 'form-foto__acciones' },
      h('input', {
        type: 'file',
        id: inputId,
        accept: 'image/*',
        class: 'form-foto__archivo',
        'data-accion': 'seleccionar-foto-formulario',
      }),
      h('label', {
        for: inputId,
        class: 'form-foto__boton',
        role: 'button',
      }, 'Galería'),
      puedeCamara
        ? h('button', {
            type: 'button',
            class: 'form-foto__boton form-foto__boton--camara',
            'data-accion': 'tomar-foto-formulario',
          }, 'Cámara')
        : null
    ),
    h('p', { class: 'form-foto__ayuda' },
      'La foto es opcional. Puedes agregarla ahora o después, desde la tarjeta del registro.')
  );

  return cont;
}

function pintarFormulario() {
  const form = h('form', { class: 'vista__form vista__form--fauna', 'data-accion': 'crear' });

  form.append(pintarFormularioFoto());

  form.append(
    h('input', { name: 'nombre', placeholder: 'Especie (Chincol, Perro, Caballo)', required: true, maxlength: 100 }),
    h('select', { name: 'tipo' },
      ...TIPOS.map((t) => h('option', { value: t.id }, t.etiqueta))
    ),
    h('input', {
      name: 'nombrePropio',
      placeholder: 'Nombre propio (opcional)',
      maxlength: 100,
    }),
    h('input', {
      name: 'perteneceA',
      placeholder: 'Pertenece a (opcional)',
      maxlength: 100,
      list: 'sugerencias-pertenece',
    }),
    h('datalist', { id: 'sugerencias-pertenece' },
      ...SUGERENCIAS_PERTENECE.map((s) => h('option', { value: s }))
    ),
    h('input', { name: 'lugar', placeholder: 'Lugar', maxlength: 200 }),
    h('input', { type: 'date', name: 'fecha' }),
    h('textarea', {
      name: 'notas',
      placeholder: 'Notas, historia, algo que quieras recordar (opcional)',
      maxlength: 500,
      rows: 3,
    }),
    h('button', { type: 'submit' }, 'Registrar')
  );

  return form;
}

/* ---------- Galería de la tarjeta ------------------------------ */

function pintarGaleria(idRegistro) {
  const fotos = registro.fotosPorRegistro[idRegistro] || [];
  const cont = h('div', { class: 'galeria' });

  for (const foto of fotos) {
    cont.append(h('div', { class: 'galeria__item' },
      h('button', {
        type: 'button',
        class: 'galeria__miniatura',
        'data-accion': 'abrir-foto',
        'data-file-id': foto.fileId,
        'aria-label': 'Ver foto',
      },
        h('img', {
          src: repoFotos.urlPreview(foto.fileId),
          alt: '',
          loading: 'lazy',
        })
      ),
      h('button', {
        type: 'button',
        class: 'galeria__eliminar',
        'data-accion': 'eliminar-foto',
        'data-id': foto.id,
        'aria-label': 'Eliminar foto',
      }, '×')
    ));
  }

  if (fotos.length < 10) {
    const inputId = 'input-foto-' + idRegistro;
    const puedeCamara = camaraDisponible();

    cont.append(h('div', { class: 'galeria__acciones' },
      h('input', {
        type: 'file',
        id: inputId,
        accept: 'image/*',
        class: 'galeria__archivo',
        'data-accion': 'seleccionar-foto',
        'data-registro': idRegistro,
      }),
      h('label', {
        for: inputId,
        class: 'galeria__boton',
        role: 'button',
      }, fotos.length === 0 ? 'Galería' : 'Otra'),
      puedeCamara
        ? h('button', {
            type: 'button',
            class: 'galeria__boton galeria__boton--camara',
            'data-accion': 'tomar-foto',
            'data-registro': idRegistro,
          }, 'Cámara')
        : null
    ));
  }

  return cont;
}

/* ---------- Lightbox ------------------------------------------ */

function abrirLightbox(fileId) {
  cerrarLightbox();
  const overlay = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true' },
    h('button', {
      type: 'button',
      class: 'lightbox__cerrar',
      'aria-label': 'Cerrar',
      onclick: cerrarLightbox,
    }, '×'),
    h('img', {
      class: 'lightbox__imagen',
      src: repoFotos.urlArchivo(fileId),
      alt: '',
    })
  );

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) cerrarLightbox();
  });

  document.body.append(overlay);
  overlay.offsetWidth;
  overlay.classList.add('lightbox--visible');
  registro.luz = overlay;

  const alTeclado = (ev) => {
    if (ev.key === 'Escape') cerrarLightbox();
  };
  document.addEventListener('keydown', alTeclado);
  overlay._alTeclado = alTeclado;
}

function cerrarLightbox() {
  const ov = registro.luz;
  if (!ov) return;
  if (ov._alTeclado) document.removeEventListener('keydown', ov._alTeclado);
  ov.classList.remove('lightbox--visible');
  setTimeout(() => {
    if (ov.parentNode) ov.remove();
  }, 200);
  registro.luz = null;
}

/* ---------- Cargar fotos -------------------------------------- */

async function cargarFotosDeTodos() {
  const nuevo = {};
  for (const reg of registro.registros) {
    const r = await repoFotos.listarPorFila('ahorasi_fauna', reg.id);
    if (r.exito) nuevo[reg.id] = r.datos;
    else nuevo[reg.id] = [];
  }
  registro.fotosPorRegistro = nuevo;
}

/* ---------- Pintar -------------------------------------------- */

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const lista = registro.registros.length === 0
    ? h('p', { class: 'vista__vacio' }, 'Aún sin registros. Anota el primero arriba.')
    : h('ul', { class: 'vista__lista' },
        ...registro.registros.map((x) => pintarRegistro(x))
      );

  cont.append(
    h('section', { class: 'vista vista--fauna' },
      h('h1', {}, 'Fauna'),
      h('p', { class: 'vista__lead' }, 'Lo que vimos y escuchamos en el camino.'),
      pintarFormulario(),
      lista
    )
  );
}

function pintarRegistro(x) {
  if (registro.editandoId === x.id) {
    return pintarRegistroEnEdicion(x);
  }

  return h('li', { class: 'vista__item', 'data-id': x.id },
    h('div', { class: 'vista__item-cabecera' },
      h('strong', {}, x.nombre),
      h('span', { class: 'tipo-etiqueta' }, etiquetaTipo(x.tipo)),
      distintivoAutor(x.registradoPor)
    ),
    x.nombrePropio ? h('p', { class: 'fauna__nombre-propio' }, x.nombrePropio) : null,
    x.perteneceA ? h('p', { class: 'fauna__pertenece' }, x.perteneceA) : null,
    h('div', { class: 'meta' },
      x.lugar ? h('span', {}, x.lugar) : null,
      x.fecha ? h('span', {}, formatearFecha(x.fecha)) : null
    ),
    x.notas ? h('p', { class: 'fauna__notas' }, x.notas) : null,
    pintarGaleria(x.id),
    h('div', { class: 'acciones' },
      h('button', {
        type: 'button',
        'data-accion': 'editar',
        'data-id': x.id,
      }, 'Editar'),
      h('button', {
        type: 'button',
        'data-accion': 'eliminar',
        'data-id': x.id,
      }, 'Eliminar')
    )
  );
}

function pintarRegistroEnEdicion(x) {
  const inputNombre = h('input', { value: x.nombre || '', placeholder: 'Especie', maxlength: 100, required: true });
  const selectTipo = h('select', {},
    ...TIPOS.map((t) => {
      const opt = h('option', { value: t.id }, t.etiqueta);
      if (t.id === x.tipo) opt.setAttribute('selected', '');
      return opt;
    })
  );
  const inputNombrePropio = h('input', { value: x.nombrePropio || '', placeholder: 'Nombre propio', maxlength: 100 });
  const inputPertenece = h('input', {
    value: x.perteneceA || '',
    placeholder: 'Pertenece a',
    maxlength: 100,
    list: 'sugerencias-pertenece-edit-' + x.id,
  });
  const datalistPertenece = h('datalist', { id: 'sugerencias-pertenece-edit-' + x.id },
    ...SUGERENCIAS_PERTENECE.map((s) => h('option', { value: s }))
  );
  const inputLugar = h('input', { value: x.lugar || '', placeholder: 'Lugar', maxlength: 200 });
  const inputFecha = h('input', { type: 'date', value: fechaParaInput(x.fecha) });
  const textareaNotas = h('textarea', { placeholder: 'Notas', maxlength: 500, rows: 3 }, x.notas || '');

  return h('li', { class: 'vista__item pieza-edit', 'data-id': x.id },
    inputNombre,
    selectTipo,
    inputNombrePropio,
    inputPertenece,
    datalistPertenece,
    inputLugar,
    inputFecha,
    textareaNotas,
    h('div', { class: 'pieza-edit__botones' },
      h('button', {
        type: 'button', class: 'btn-primario',
        onclick: () => guardarEdicion(x.id, {
          nombre: inputNombre.value,
          tipo: selectTipo.value,
          nombrePropio: inputNombrePropio.value,
          perteneceA: inputPertenece.value,
          lugar: inputLugar.value,
          fecha: inputFecha.value,
          notas: textareaNotas.value,
        }),
      }, 'Guardar'),
      h('button', {
        type: 'button', class: 'btn-secundario',
        onclick: () => {
          registro.editandoId = null;
          pintar();
        },
      }, 'Cancelar')
    )
  );
}

async function guardarEdicion(id, valores) {
  const fecha = valores.fecha ? new Date(valores.fecha + 'T12:00:00').toISOString() : null;
  const r = await repoFauna.actualizar(id, {
    nombre: valores.nombre,
    tipo: valores.tipo,
    nombrePropio: valores.nombrePropio,
    perteneceA: valores.perteneceA,
    lugar: valores.lugar,
    fecha,
    notas: valores.notas,
  });
  if (r.exito) {
    registro.editandoId = null;
    await refrescar();
  } else {
    pintarError(r.error);
  }
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
  const r = await repoFauna.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.registros = r.datos;
  await cargarFotosDeTodos();
  pintar();
}

/* ---------- Flujo del formulario ------------------------------ */

async function seleccionarFotoFormulario(archivo) {
  if (!archivo) return;
  try {
    const comprimida = await comprimir(archivo);
    const url = URL.createObjectURL(comprimida.blob);
    limpiarFotoPendiente();
    registro.fotoPendiente = {
      blob: comprimida.blob,
      urlPreview: url,
      nombre: archivo.name,
    };
    pintar();
  } catch (e) {
    log.error('Error al comprimir:', e.message);
    pintarError('No se pudo procesar la foto: ' + e.message);
  }
}

async function tomarFotoFormulario() {
  try {
    const blob = await abrirCamara();
    if (!blob) return;
    const comprimida = await comprimir(blob, { maxAncho: 1200, calidad: 0.85 });
    const url = URL.createObjectURL(comprimida.blob);
    limpiarFotoPendiente();
    registro.fotoPendiente = {
      blob: comprimida.blob,
      urlPreview: url,
      nombre: 'camara.jpg',
    };
    pintar();
  } catch (e) {
    log.error('Error al tomar foto:', e.message);
    pintarError('No se pudo abrir la cámara: ' + e.message);
  }
}

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const fecha = fd.get('fecha');

  // 1) Crear el registro.
  const r = await repoFauna.crear({
    nombre: fd.get('nombre'),
    nombrePropio: fd.get('nombrePropio'),
    tipo: fd.get('tipo'),
    perteneceA: fd.get('perteneceA'),
    lugar: fd.get('lugar'),
    fecha: fecha ? new Date(fecha + 'T12:00:00').toISOString() : null,
    notas: fd.get('notas'),
  });

  if (!r.exito) {
    pintarError(r.error);
    return;
  }

  const nuevoId = r.datos.id;

  // 2) Subir la foto pendiente si existe. Si falla, el registro
  //    igual queda guardado. La foto se puede agregar después
  //    desde la tarjeta.
  if (registro.fotoPendiente) {
    pintarOk('Subiendo foto…');
    const rf = await repoFotos.subir(
      'ahorasi_fauna',
      nuevoId,
      registro.fotoPendiente.blob,
      registro.fotoPendiente.nombre,
      (p) => pintarOk(`Subiendo foto… ${p}%`)
    );
    if (!rf.exito) {
      pintarError('Registro guardado, pero la foto falló: ' + rf.error);
    }
  }

  limpiarFotoPendiente();
  form.reset();
  await refrescar();
  pintarOk('Registrado.');
}

/* ---------- Galería de tarjeta -------------------------------- */

async function manejarChange(ev) {
  const inputFormulario = ev.target.closest('input[type="file"][data-accion="seleccionar-foto-formulario"]');
  if (inputFormulario) {
    const archivo = inputFormulario.files && inputFormulario.files[0];
    inputFormulario.value = '';
    await seleccionarFotoFormulario(archivo);
    return;
  }

  const inputTarjeta = ev.target.closest('input[type="file"][data-accion="seleccionar-foto"]');
  if (inputTarjeta) {
    const archivo = inputTarjeta.files && inputTarjeta.files[0];
    if (!archivo) return;
    const idRegistro = inputTarjeta.dataset.registro;
    await subirFotoDesdeArchivo(idRegistro, archivo, inputTarjeta);
  }
}

async function subirFotoDesdeArchivo(idRegistro, archivo, input) {
  if (registro.subiendo) return;
  registro.subiendo = true;
  try {
    pintarOk('Comprimiendo…');
    const comprimida = await comprimir(archivo);
    pintarOk('Subiendo…');
    const r = await repoFotos.subir(
      'ahorasi_fauna',
      idRegistro,
      comprimida.blob,
      archivo.name,
      (p) => pintarOk(`Subiendo… ${p}%`)
    );
    if (!r.exito) {
      pintarError(r.error);
      return;
    }
    const rf = await repoFotos.listarPorFila('ahorasi_fauna', idRegistro);
    if (rf.exito) registro.fotosPorRegistro[idRegistro] = rf.datos;
    pintar();
    pintarOk('Foto agregada.');
  } catch (e) {
    log.error('Error al subir foto:', e.message);
    pintarError('Error: ' + e.message);
  } finally {
    registro.subiendo = false;
    if (input) input.value = '';
  }
}

async function subirFotoDesdeCamara(idRegistro) {
  if (registro.subiendo) return;
  try {
    const blob = await abrirCamara();
    if (!blob) return;
    registro.subiendo = true;
    pintarOk('Comprimiendo…');
    const comprimida = await comprimir(blob, { maxAncho: 1200, calidad: 0.85 });
    pintarOk('Subiendo…');
    const r = await repoFotos.subir(
      'ahorasi_fauna',
      idRegistro,
      comprimida.blob,
      'camara.jpg',
      (p) => pintarOk(`Subiendo… ${p}%`)
    );
    if (!r.exito) {
      pintarError(r.error);
      return;
    }
    const rf = await repoFotos.listarPorFila('ahorasi_fauna', idRegistro);
    if (rf.exito) registro.fotosPorRegistro[idRegistro] = rf.datos;
    pintar();
    pintarOk('Foto agregada.');
  } catch (e) {
    log.error('Error al tomar foto:', e.message);
    pintarError('No se pudo abrir la cámara: ' + e.message);
  } finally {
    registro.subiendo = false;
  }
}

/* ---------- Click --------------------------------------------- */

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;

  if (accion === 'abrir-foto') {
    abrirLightbox(boton.dataset.fileId);
  } else if (accion === 'eliminar-foto') {
    const id = boton.dataset.id;
    const ok = await mostrarConfirmacion(
      'Eliminar foto',
      '¿Seguro que quieres eliminar esta foto?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoFotos.eliminar(id);
    if (r.exito) await refrescar();
    else pintarError(r.error);
  } else if (accion === 'tomar-foto-formulario') {
    await tomarFotoFormulario();
  } else if (accion === 'quitar-foto-pendiente') {
    limpiarFotoPendiente();
    pintar();
  } else if (accion === 'tomar-foto') {
    await subirFotoDesdeCamara(boton.dataset.registro);
  } else if (accion === 'editar') {
    registro.editandoId = boton.dataset.id;
    pintar();
  } else if (accion === 'eliminar') {
    const id = boton.dataset.id;
    const ok = await mostrarConfirmacion(
      'Eliminar registro',
      '¿Seguro que quieres eliminar este registro de fauna? También se eliminarán sus fotos.',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    await repoFotos.eliminarPorFila('ahorasi_fauna', id);
    const r = await repoFauna.eliminar(id);
    if (r.exito) await refrescar();
    else pintarError(r.error);
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.subiendo = false;
  registro.editandoId = null;
  limpiarFotoPendiente();

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('change', manejarChange, { signal });

  registro.desuscribir = [
    al('realtime:fauna:crear', refrescar),
    al('realtime:fauna:actualizar', refrescar),
    al('realtime:fauna:eliminar', refrescar),
    al('realtime:fotos:creada', refrescar),
    al('realtime:fotos:eliminada', refrescar),
  ];

  pintar();
  refrescar().catch((e) => log.error('Error al refrescar:', e));
}

export function limpiar() {
  cerrarLightbox();
  limpiarFotoPendiente();
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.registros = [];
  registro.fotosPorRegistro = {};
  registro.subiendo = false;
  registro.editandoId = null;
  registro.contenedor = null;
}