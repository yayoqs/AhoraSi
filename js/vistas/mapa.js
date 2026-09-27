/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/mapa.js
   Versión: 1.0.0
   Propósito: vista del mapa de lugares. Muestra Chile con
              marcadores para cada lugar registrado (verde los
              visitados, dorado los pendientes). Lista debajo con
              acciones de editar, eliminar y marcar visitado.
              Formulario colapsable para agregar lugares, con
              coordenadas por click en el mapa o ubicación actual.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoLugares from '../datos/repositorios/lugares.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha, escaparHtml } from '../nucleo/utils.js';

const log = crearLogger('vista:mapa');

const CENTRO_CHILE = [-35.5, -71.0];
const ZOOM_INICIAL = 5;
const TILES_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATRIBUCION = '© OpenStreetMap';

const registro = {
  contenedor: null,
  raiz: null,
  abortador: null,
  desuscribir: [],
  lugares: [],
  mapa: null,
  capaMarcadores: null,
  contenedorMapaEl: null,
  listaEl: null,
  formularioAbierto: false,
  editandoId: null,
  // Formulario activo: 'crear' | id de lugar | null
  formularioActivo: null,
  // Inputs activos del formulario, para que el click en el mapa
  // rellene las coordenadas correctas.
  inputsActivos: null,
};

/* ---------- Iconos --------------------------------------------- */

function crearIcono(estado) {
  const L = window.L;
  return L.divIcon({
    className: 'mapa-marcador-wrapper',
    html: `<div class="mapa-marcador mapa-marcador--${estado}"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

/* ---------- Mapa ---------------------------------------------- */

function inicializarMapa() {
  const L = window.L;
  if (!L) {
    log.error('Leaflet no está cargado');
    registro.contenedorMapaEl.append(
      h('p', { class: 'vista__error' }, 'El mapa no está disponible. Revisa que Leaflet esté cargado.')
    );
    return;
  }

  registro.mapa = L.map(registro.contenedorMapaEl, {
    center: CENTRO_CHILE,
    zoom: ZOOM_INICIAL,
    zoomControl: true,
  });

  L.tileLayer(TILES_URL, {
    attribution: TILES_ATRIBUCION,
    maxZoom: 19,
  }).addTo(registro.mapa);

  registro.capaMarcadores = L.layerGroup().addTo(registro.mapa);

  registro.mapa.on('click', manejarClickMapa);
}

function manejarClickMapa(ev) {
  // Solo si hay un formulario activo rellenamos coordenadas.
  if (!registro.formularioActivo || !registro.inputsActivos) return;
  const { lat, lng } = ev.latlng;
  registro.inputsActivos.lat.value = lat.toFixed(6);
  registro.inputsActivos.lng.value = lng.toFixed(6);
}

function actualizarMarcadores() {
  const L = window.L;
  if (!registro.capaMarcadores) return;
  registro.capaMarcadores.clearLayers();

  for (const lugar of registro.lugares) {
    if (typeof lugar.latitud !== 'number' || typeof lugar.longitud !== 'number') continue;
    const marcador = L.marker([lugar.latitud, lugar.longitud], {
      icon: crearIcono(lugar.estado),
      title: lugar.nombre,
    });
    marcador.bindPopup(construirPopup(lugar));
    marcador.addTo(registro.capaMarcadores);
  }
}

function construirPopup(lugar) {
  const partes = [`<strong class="mapa-popup__nombre">${escaparHtml(lugar.nombre)}</strong>`];
  if (lugar.region) {
    partes.push(`<span class="mapa-popup__region">${escaparHtml(lugar.region)}</span>`);
  }
  if (lugar.notas) {
    partes.push(`<p class="mapa-popup__notas">${escaparHtml(lugar.notas)}</p>`);
  }
  if (lugar.estado === 'visitado' && lugar.fechaVisita) {
    partes.push(`<span class="mapa-popup__fecha">Visitado ${escaparHtml(formatearFecha(lugar.fechaVisita))}</span>`);
  }
  partes.push(`<span class="mapa-popup__estado mapa-popup__estado--${lugar.estado}">${lugar.estado}</span>`);
  return `<div class="mapa-popup">${partes.join('')}</div>`;
}

/* ---------- Estructura ---------------------------------------- */

function montarEstructura() {
  const cont = registro.contenedor;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-mapa', class: 'vista vista--mapa' });
  const encabezado = h('header', {},
    h('h1', {}, 'Lugares'),
    h('p', { class: 'vista__lead' },
      'Pueblos, cerros y rincones de Chile. Los pendientes en dorado, los visitados en verde.')
  );
  const bloqueRegistro = h('div', { class: 'mapa__bloque-registro' });
  const contenedorMapa = h('div', { class: 'mapa__contenedor' });
  const progreso = h('p', { class: 'mapa__progreso' });
  const lista = h('ul', { class: 'mapa__lista' });

  raiz.append(encabezado, bloqueRegistro, contenedorMapa, progreso, lista);
  cont.append(raiz);

  registro.raiz = raiz;
  registro.contenedorMapaEl = contenedorMapa;
  registro.listaEl = lista;
  registro.bloqueRegistroEl = bloqueRegistro;
  registro.progresoEl = progreso;

  inicializarMapa();
  pintarBloqueRegistro();
}

/* ---------- Bloque de registro -------------------------------- */

function pintarBloqueRegistro() {
  const cont = registro.bloqueRegistroEl;
  if (!cont) return;
  limpiarContenedor(cont);

  if (!registro.formularioAbierto) {
    cont.append(
      h('button', {
        type: 'button',
        class: 'abrir-form',
        'data-accion': 'abrir-formulario',
      }, '+ Añadir lugar')
    );
    registro.formularioActivo = null;
    registro.inputsActivos = null;
    return;
  }

  cont.append(pintarFormularioNuevo());
  registro.formularioActivo = 'crear';
}

function pintarFormularioNuevo() {
  const inputNombre = h('input', { name: 'nombre', placeholder: 'Nombre del lugar', required: true, maxlength: 100 });
  const inputLat = h('input', { name: 'latitud', placeholder: 'Latitud', required: true, type: 'number', step: 'any' });
  const inputLng = h('input', { name: 'longitud', placeholder: 'Longitud', required: true, type: 'number', step: 'any' });
  const inputRegion = h('input', { name: 'region', placeholder: 'Región o zona (opcional)', maxlength: 100 });
  const textareaNotas = h('textarea', { name: 'notas', placeholder: 'Notas (opcional)', maxlength: 500, rows: 3 });
  const selectEstado = h('select', { name: 'estado' },
    h('option', { value: 'pendiente' }, 'Pendiente'),
    h('option', { value: 'visitado' }, 'Visitado')
  );
  const inputFecha = h('input', { type: 'date', name: 'fechaVisita' });

  registro.inputsActivos = { lat: inputLat, lng: inputLng };

  return h('form', { class: 'vista__form mapa__form', 'data-accion': 'crear' },
    h('p', { class: 'mapa__ayuda' },
      'Haz clic en el mapa para elegir la ubicación, escribe las coordenadas, o usa tu ubicación actual.'),
    inputNombre,
    h('div', { class: 'mapa__fila-coords' },
      inputLat,
      inputLng,
      h('button', {
        type: 'button',
        class: 'btn-secundario',
        'data-accion': 'usar-ubicacion',
      }, 'Usar mi ubicación')
    ),
    inputRegion,
    textareaNotas,
    h('div', { class: 'mapa__fila-estado' },
      h('label', {}, 'Estado', selectEstado),
      h('label', {}, 'Fecha de visita (opcional)', inputFecha)
    ),
    h('div', { class: 'form-botones' },
      h('button', {
        type: 'button',
        class: 'btn-secundario',
        'data-accion': 'cerrar-formulario',
      }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn-primario' }, 'Añadir')
    )
  );
}

/* ---------- Formulario de edición ----------------------------- */

function pintarFormularioEdicion(lugar) {
  const inputNombre = h('input', { value: lugar.nombre || '', name: 'nombre', placeholder: 'Nombre', required: true, maxlength: 100 });
  const inputLat = h('input', { value: String(lugar.latitud ?? ''), name: 'latitud', placeholder: 'Latitud', required: true, type: 'number', step: 'any' });
  const inputLng = h('input', { value: String(lugar.longitud ?? ''), name: 'longitud', placeholder: 'Longitud', required: true, type: 'number', step: 'any' });
  const inputRegion = h('input', { value: lugar.region || '', name: 'region', placeholder: 'Región o zona', maxlength: 100 });
  const textareaNotas = h('textarea', { name: 'notas', placeholder: 'Notas', maxlength: 500, rows: 3 }, lugar.notas || '');
  const selectEstado = h('select', { name: 'estado' },
    h('option', { value: 'pendiente' }, 'Pendiente'),
    h('option', { value: 'visitado' }, 'Visitado')
  );
  selectEstado.value = lugar.estado;
  const inputFecha = h('input', { type: 'date', name: 'fechaVisita', value: fechaParaInput(lugar.fechaVisita) });

  registro.inputsActivos = { lat: inputLat, lng: inputLng };

  return h('li', { class: 'pieza-edit mapa__pieza-edit', 'data-id': lugar.id },
    h('p', { class: 'mapa__ayuda' }, 'Haz clic en el mapa para mover el punto.'),
    inputNombre,
    h('div', { class: 'mapa__fila-coords' }, inputLat, inputLng),
    inputRegion,
    textareaNotas,
    h('div', { class: 'mapa__fila-estado' },
      h('label', {}, 'Estado', selectEstado),
      h('label', {}, 'Fecha de visita', inputFecha)
    ),
    h('div', { class: 'pieza-edit__botones' },
      h('button', {
        type: 'button', class: 'btn-primario',
        onclick: () => guardarEdicion(lugar.id, {
          nombre: inputNombre.value,
          latitud: Number(inputLat.value),
          longitud: Number(inputLng.value),
          region: inputRegion.value,
          notas: textareaNotas.value,
          estado: selectEstado.value,
          fechaVisita: inputFecha.value,
        }),
      }, 'Guardar'),
      h('button', {
        type: 'button', class: 'btn-secundario',
        onclick: () => {
          registro.editandoId = null;
          registro.inputsActivos = null;
          registro.formularioActivo = null;
          actualizarVista();
        },
      }, 'Cancelar')
    )
  );
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

/* ---------- Lista --------------------------------------------- */

function actualizarLista() {
  const lista = registro.listaEl;
  if (!lista) return;
  limpiarContenedor(lista);

  if (registro.lugares.length === 0) {
    lista.append(h('li', { class: 'vista__vacio' }, 'Aún no hay lugares registrados.'));
    return;
  }

  const visitados = registro.lugares.filter((l) => l.estado === 'visitado');
  const pendientes = registro.lugares.filter((l) => l.estado === 'pendiente');

  if (pendientes.length > 0) {
    lista.append(h('li', { class: 'mapa__subtitulo' }, 'Pendientes'));
    for (const l of pendientes) lista.append(pintarItemLugar(l));
  }
  if (visitados.length > 0) {
    lista.append(h('li', { class: 'mapa__subtitulo' }, 'Visitados'));
    for (const l of visitados) lista.append(pintarItemLugar(l));
  }
}

function pintarItemLugar(lugar) {
  if (registro.editandoId === lugar.id) {
    return pintarFormularioEdicion(lugar);
  }

  return h('li', { class: 'mapa__item', 'data-id': lugar.id },
    h('div', { class: 'mapa__item-cuerpo' },
      h('div', { class: 'mapa__item-cabecera' },
        h('strong', {}, lugar.nombre),
        h('span', { class: `mapa__estado mapa__estado--${lugar.estado}` }, lugar.estado),
        distintivoAutor(lugar.creadoPor)
      ),
      lugar.region ? h('p', { class: 'mapa__item-region' }, lugar.region) : null,
      lugar.notas ? h('p', { class: 'mapa__item-notas' }, lugar.notas) : null,
      lugar.fechaVisita ? h('p', { class: 'meta' }, 'Visitado ' + formatearFecha(lugar.fechaVisita)) : null
    ),
    h('div', { class: 'mapa__item-acciones' },
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'toggle-visitado', 'data-id': lugar.id,
      }, lugar.estado === 'visitado' ? 'Marcar pendiente' : 'Marcar visitado'),
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'editar', 'data-id': lugar.id,
      }, 'Editar'),
      h('button', {
        type: 'button', class: 'btn-mini',
        'data-accion': 'eliminar', 'data-id': lugar.id,
      }, 'Eliminar')
    )
  );
}

function actualizarProgreso() {
  const p = registro.progresoEl;
  if (!p) return;
  const total = registro.lugares.length;
  if (total === 0) {
    p.textContent = '';
    return;
  }
  const visitados = registro.lugares.filter((l) => l.estado === 'visitado').length;
  p.textContent = `${visitados} de ${total} visitados`;
}

/* ---------- Actualización global ------------------------------ */

function actualizarVista() {
  actualizarMarcadores();
  actualizarLista();
  actualizarProgreso();
}

async function refrescar() {
  const r = await repoLugares.listar();
  if (!r.exito) {
    log.error('Error al listar:', r.error);
    pintarError(r.error);
    return;
  }
  registro.lugares = r.datos;
  actualizarVista();
}

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

/* ---------- Geolocalización ----------------------------------- */

function usarUbicacionActual() {
  if (!navigator.geolocation) {
    pintarError('Este navegador no soporta geolocalización.');
    return;
  }
  if (!registro.inputsActivos) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      registro.inputsActivos.lat.value = pos.coords.latitude.toFixed(6);
      registro.inputsActivos.lng.value = pos.coords.longitude.toFixed(6);
      pintarOk('Coordenadas actualizadas.');
    },
    (err) => {
      pintarError('No se pudo obtener la ubicación: ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/* ---------- Submit y clicks ----------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const estado = String(fd.get('estado') || 'pendiente');
  const fechaRaw = String(fd.get('fechaVisita') || '');

  const r = await repoLugares.crear({
    nombre: fd.get('nombre'),
    latitud: Number(fd.get('latitud')),
    longitud: Number(fd.get('longitud')),
    region: fd.get('region'),
    notas: fd.get('notas'),
    estado,
    fechaVisita: estado === 'visitado' && fechaRaw
      ? new Date(fechaRaw + 'T12:00:00').toISOString()
      : null,
  });
  if (r.exito) {
    registro.lugares = [r.datos, ...registro.lugares];
    registro.formularioAbierto = false;
    registro.inputsActivos = null;
    registro.formularioActivo = null;
    pintarBloqueRegistro();
    actualizarVista();
    pintarOk('Lugar añadido.');
  } else {
    pintarError(r.error);
  }
}

async function guardarEdicion(id, valores) {
  const fecha = valores.estado === 'visitado' && valores.fechaVisita
    ? new Date(valores.fechaVisita + 'T12:00:00').toISOString()
    : null;

  const r = await repoLugares.actualizar(id, {
    nombre: valores.nombre,
    latitud: valores.latitud,
    longitud: valores.longitud,
    region: valores.region,
    notas: valores.notas,
    estado: valores.estado,
    fechaVisita: fecha,
  });
  if (r.exito) {
    const i = registro.lugares.findIndex((x) => x.id === id);
    if (i >= 0) registro.lugares[i] = r.datos;
    registro.editandoId = null;
    registro.inputsActivos = null;
    registro.formularioActivo = null;
    actualizarVista();
  } else {
    pintarError(r.error);
  }
}

async function manejarClick(ev) {
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;
  const id = boton.dataset.id;

  if (accion === 'abrir-formulario') {
    registro.formularioAbierto = true;
    pintarBloqueRegistro();
    setTimeout(() => {
      const input = registro.bloqueRegistroEl.querySelector('input[name="nombre"]');
      if (input) input.focus();
    }, 60);
  } else if (accion === 'cerrar-formulario') {
    registro.formularioAbierto = false;
    registro.inputsActivos = null;
    registro.formularioActivo = null;
    pintarBloqueRegistro();
  } else if (accion === 'usar-ubicacion') {
    usarUbicacionActual();
  } else if (accion === 'toggle-visitado') {
    const lugar = registro.lugares.find((l) => l.id === id);
    if (!lugar) return;
    const visitado = lugar.estado !== 'visitado';
    const r = await repoLugares.marcarVisitado(id, visitado);
    if (r.exito) {
      const i = registro.lugares.findIndex((x) => x.id === id);
      if (i >= 0) registro.lugares[i] = r.datos;
      actualizarVista();
      pintarOk(visitado ? 'Marcado como visitado.' : 'Marcado como pendiente.');
    } else {
      pintarError(r.error);
    }
  } else if (accion === 'editar') {
    registro.editandoId = id;
    registro.formularioActivo = id;
    actualizarVista();
    setTimeout(() => {
      const item = registro.listaEl.querySelector(`[data-id="${id}"]`);
      if (item) item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  } else if (accion === 'eliminar') {
    const ok = await mostrarConfirmacion(
      'Eliminar lugar',
      '¿Seguro que quieres eliminar este lugar?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoLugares.eliminar(id);
    if (r.exito) {
      registro.lugares = registro.lugares.filter((l) => l.id !== id);
      actualizarVista();
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
  registro.formularioActivo = null;
  registro.inputsActivos = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:lugares:crear', refrescar),
    al('realtime:lugares:actualizar', refrescar),
    al('realtime:lugares:eliminar', refrescar),
  ];

  montarEstructura();
  await refrescar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;

  if (registro.mapa) {
    try {
      registro.mapa.off('click', manejarClickMapa);
      registro.mapa.remove();
    } catch (e) {
      log.warn('Error al destruir el mapa:', e.message);
    }
    registro.mapa = null;
  }
  registro.capaMarcadores = null;

  if (registro.contenedor) limpiarContenedor(registro.contenedor);

  registro.lugares = [];
  registro.formularioAbierto = false;
  registro.editandoId = null;
  registro.formularioActivo = null;
  registro.inputsActivos = null;
  registro.raiz = null;
  registro.contenedorMapaEl = null;
  registro.listaEl = null;
  registro.bloqueRegistroEl = null;
  registro.progresoEl = null;
  registro.contenedor = null;
}