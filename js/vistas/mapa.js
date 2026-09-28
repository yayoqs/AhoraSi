/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/mapa.js
   Versión: 1.2.0
   Propósito: vista del mapa de lugares. Muestra Chile centrado
              en Chillán. Buscador de direcciones y lugares con
              Nominatim (acepta POIs: puentes, parques, museos).
              Marcadores propios. Lista con acciones.
              v1.2.0: se amplía el buscador para incluir POIs.
                      Se agregan extratags, namedetails, dedupe,
                      limit=8. Se cambia countrycodes=cl por
                      viewbox + bounded=1 (más flexible para
                      lugares turísticos). Fallback sin filtros
                      geográficos si la primera búsqueda no
                      devuelve nada. Cada resultado lleva un badge
                      con su tipo (calle, pueblo, puente, etc.).
              v1.1.0: centro en Chillán, buscador con Nominatim,
                      autocompletado, flyTo.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoLugares from '../datos/repositorios/lugares.js';
import { al } from '../nucleo/bus-eventos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { h, limpiarContenedor, formatearFecha, escaparHtml } from '../nucleo/utils.js';

const log = crearLogger('vista:mapa');

const CENTRO_CHILLAN = [-36.6067, -72.1034];
const ZOOM_INICIAL = 7;
const ZOOM_RESULTADO = 14;
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATRIBUCION = '© OpenStreetMap';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_CARACTERES_BUSQUEDA = 3;
const DEBOUNCE_BUSQUEDA_MS = 500;
const LIMITE_RESULTADOS = 8;

/* Viewbox que cubre Chile continental + insular + Antártica.
   Formato: oeste, norte, este, sur (lon_min, lat_max, lon_max, lat_min). */
const VIEWBOX_CHILE = '-109.5,-17.5,-66.0,-56.0';

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
  bloqueRegistroEl: null,
  progresoEl: null,
  formularioAbierto: false,
  editandoId: null,
  formularioActivo: null,
  inputsActivos: null,
  timeoutBusqueda: null,
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
    center: CENTRO_CHILLAN,
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

/* ---------- Búsqueda (Nominatim) ------------------------------ */

/**
 * Etiquetas legibles para los tipos más comunes que devuelve
 * Nominatim. Si el tipo no está en el mapa, se muestra el `type`
 * crudo con la primera letra en mayúscula.
 */
const ETIQUETAS_TIPO = {
  // Lugares administrativos y poblados
  city: 'Ciudad',
  town: 'Pueblo',
  village: 'Aldea',
  hamlet: 'Caserío',
  suburb: 'Barrio',
  neighbourhood: 'Barrio',
  municipality: 'Comuna',
  county: 'Provincia',
  state: 'Región',
  region: 'Región',
  country: 'País',
  // Vías
  road: 'Calle',
  street: 'Calle',
  residential: 'Calle',
  pedestrian: 'Pasaje',
  path: 'Sendero',
  footway: 'Sendero',
  track: 'Camino',
  primary: 'Ruta',
  secondary: 'Ruta',
  tertiary: 'Ruta',
  motorway: 'Autopista',
  trunk: 'Ruta',
  // Lugares naturales y turísticos
  peak: 'Cumbre',
  mountain_pass: 'Paso',
  water: 'Agua',
  river: 'Río',
  lake: 'Lago',
  bay: 'Bahía',
  beach: 'Playa',
  forest: 'Bosque',
  park: 'Parque',
  nature_reserve: 'Reserva',
  protected_area: 'Área protegida',
  bridge: 'Puente',
  // Turismo y cultura
  attraction: 'Atracción',
  viewpoint: 'Mirador',
  museum: 'Museo',
  monument: 'Monumento',
  memorial: 'Memorial',
  artwork: 'Obra',
  gallery: 'Galería',
  tourism: 'Turismo',
  hotel: 'Hotel',
  hostel: 'Hostal',
  camp_site: 'Camping',
  picnic_site: 'Picnic',
  alpine_hut: 'Refugio',
  wilderness_hut: 'Refugio',
  information: 'Información',
  // Comercio y servicios
  restaurant: 'Restaurante',
  cafe: 'Café',
  bar: 'Bar',
  pub: 'Pub',
  fast_food: 'Comida',
  supermarket: 'Supermercado',
  market: 'Feria',
  pharmacy: 'Farmacia',
  hospital: 'Hospital',
  clinic: 'Clínica',
  school: 'Escuela',
  university: 'Universidad',
  library: 'Biblioteca',
  bank: 'Banco',
  fuel: 'Bencinera',
  bus_station: 'Terminal',
  aerodrome: 'Aeródromo',
  railway: 'Estación',
  place_of_worship: 'Templo',
  // Otros
  administrative: 'Administrativo',
  building: 'Edificio',
  house: 'Casa',
  boundary: 'Límite',
};

function etiquetaDeResultado(r) {
  const clave = r.type || r.class || '';
  if (ETIQUETAS_TIPO[clave]) return ETIQUETAS_TIPO[clave];
  if (!clave) return '';
  return clave.charAt(0).toUpperCase() + clave.slice(1);
}

/**
 * Normaliza el resultado de Nominatim a lo que la UI necesita.
 */
function normalizarResultado(r) {
  return {
    lat: Number(r.lat),
    lon: Number(r.lon),
    nombreCorto: String(r.display_name || '').split(',')[0].trim() || 'Lugar',
    direccion: r.display_name || '',
    etiqueta: etiquetaDeResultado(r),
  };
}

async function consultarNominatim(consulta, conFiltroChile) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', consulta.trim());
  url.searchParams.set('limit', String(LIMITE_RESULTADOS));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('dedupe', '1');

  if (conFiltroChile) {
    url.searchParams.set('viewbox', VIEWBOX_CHILE);
    url.searchParams.set('bounded', '1');
  }

  const r = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Nominatim respondió ${r.status}`);
  return await r.json();
}

/**
 * Busca una dirección o lugar. Primero intenta limitar a Chile
 * con viewbox+bounded. Si no encuentra nada, reintenta sin
 * filtros geográficos. Así encuentra POIs que no están
 * etiquetados en Chile o que están mal ubicados en el mapa.
 */
async function buscarDireccion(consulta) {
  let resultados = await consultarNominatim(consulta, true);
  if (!resultados || resultados.length === 0) {
    resultados = await consultarNominatim(consulta, false);
  }
  return resultados || [];
}

function programarBusqueda(valor, contenedorResultados, inputLat, inputLng, inputNombre) {
  clearTimeout(registro.timeoutBusqueda);
  if (!valor || valor.trim().length < MIN_CARACTERES_BUSQUEDA) {
    contenedorResultados.hidden = true;
    limpiarContenedor(contenedorResultados);
    return;
  }

  registro.timeoutBusqueda = setTimeout(async () => {
    pintarResultadosCargando(contenedorResultados);
    try {
      const crudos = await buscarDireccion(valor);
      const resultados = crudos
        .map(normalizarResultado)
        .filter((r) => !Number.isNaN(r.lat) && !Number.isNaN(r.lon));
      pintarResultados(resultados, contenedorResultados, inputLat, inputLng, inputNombre);
    } catch (e) {
      log.warn('Error al buscar:', e.message);
      pintarResultadosError(contenedorResultados, 'No se pudo buscar. Revisa tu conexión.');
    }
  }, DEBOUNCE_BUSQUEDA_MS);
}

function pintarResultadosCargando(contenedor) {
  contenedor.hidden = false;
  limpiarContenedor(contenedor);
  contenedor.append(h('li', { class: 'mapa__resultado-cargando' }, 'Buscando…'));
}

function pintarResultadosError(contenedor, texto) {
  contenedor.hidden = false;
  limpiarContenedor(contenedor);
  contenedor.append(h('li', { class: 'mapa__resultado-cargando' }, texto));
}

function pintarResultados(resultados, contenedor, inputLat, inputLng, inputNombre) {
  contenedor.hidden = false;
  limpiarContenedor(contenedor);

  if (!resultados || resultados.length === 0) {
    contenedor.append(h('li', { class: 'mapa__resultado-cargando' }, 'Sin resultados.'));
    return;
  }

  for (const r of resultados) {
    contenedor.append(h('li', {
      class: 'mapa__resultado',
      onclick: () => {
        inputLat.value = r.lat.toFixed(6);
        inputLng.value = r.lon.toFixed(6);
        if (inputNombre && !inputNombre.value.trim()) {
          inputNombre.value = r.nombreCorto;
        }
        if (registro.mapa) {
          registro.mapa.flyTo([r.lat, r.lon], ZOOM_RESULTADO, { duration: 0.8 });
        }
        contenedor.hidden = true;
        limpiarContenedor(contenedor);
      },
    },
      h('div', { class: 'mapa__resultado-cabecera' },
        h('strong', {}, r.nombreCorto),
        r.etiqueta ? h('span', { class: 'mapa__resultado-tipo' }, r.etiqueta) : null
      ),
      h('span', { class: 'mapa__resultado-direccion' }, r.direccion)
    ));
  }
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
  const inputBusqueda = h('input', {
    type: 'search',
    name: 'busqueda',
    placeholder: 'Buscar calle, pueblo, cerro, museo…',
    autocomplete: 'off',
  });
  const contenedorResultados = h('ul', { class: 'mapa__resultados', hidden: '' });
  const inputLat = h('input', { name: 'latitud', placeholder: 'Latitud', required: true, type: 'number', step: 'any' });
  const inputLng = h('input', { name: 'longitud', placeholder: 'Longitud', required: true, type: 'number', step: 'any' });
  const inputRegion = h('input', { name: 'region', placeholder: 'Región o zona (opcional)', maxlength: 100 });
  const textareaNotas = h('textarea', { name: 'notas', placeholder: 'Notas (opcional)', maxlength: 500, rows: 3 });
  const selectEstado = h('select', { name: 'estado' },
    h('option', { value: 'pendiente' }, 'Pendiente'),
    h('option', { value: 'visitado' }, 'Visitado')
  );
  const inputFecha = h('input', { type: 'date', name: 'fechaVisita' });

  inputBusqueda.addEventListener('input', () => {
    programarBusqueda(inputBusqueda.value, contenedorResultados, inputLat, inputLng, inputNombre);
  });

  registro.inputsActivos = { lat: inputLat, lng: inputLng };

  return h('form', { class: 'vista__form mapa__form', 'data-accion': 'crear' },
    h('div', { class: 'mapa__buscador' },
      inputBusqueda,
      contenedorResultados,
      h('p', { class: 'mapa__ayuda' },
        'Busca una dirección o lugar, haz clic en el mapa, o escribe las coordenadas a mano.')
    ),
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
  const inputBusqueda = h('input', {
    type: 'search',
    name: 'busqueda',
    placeholder: 'Buscar otra dirección o lugar…',
    autocomplete: 'off',
  });
  const contenedorResultados = h('ul', { class: 'mapa__resultados', hidden: '' });
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

  inputBusqueda.addEventListener('input', () => {
    programarBusqueda(inputBusqueda.value, contenedorResultados, inputLat, inputLng, inputNombre);
  });

  registro.inputsActivos = { lat: inputLat, lng: inputLng };

  return h('li', { class: 'pieza-edit mapa__pieza-edit', 'data-id': lugar.id },
    h('div', { class: 'mapa__buscador' },
      inputBusqueda,
      contenedorResultados
    ),
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
      if (registro.mapa) {
        registro.mapa.flyTo(
          [pos.coords.latitude, pos.coords.longitude],
          ZOOM_RESULTADO,
          { duration: 0.8 }
        );
      }
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
      const input = registro.bloqueRegistroEl.querySelector('input[name="busqueda"]');
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
  registro.timeoutBusqueda = null;

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
  clearTimeout(registro.timeoutBusqueda);
  registro.timeoutBusqueda = null;

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