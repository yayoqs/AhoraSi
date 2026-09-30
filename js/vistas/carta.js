/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/carta.js
   Versión: 4.0.2
   Propósito: vista de la carta fusionada con Respuesta. Cada
              usuario tiene su propia carta (manifiesto,
              compromisos personales y firma). La vista principal
              muestra la carta del otro más los compromisos
              compartidos y el bloque de respuesta. El botón
              "Ver mi carta" lleva a la propia.
              v4.0.2: se elimina la sección "Anexos". Los anexos
                      ahora viven en su propia sub-vista bajo
                      Cuenta (anexos.js v1.0.0). Se eliminan del
                      render la lista, el formulario y las
                      funciones auxiliares: pintarListaAnexos,
                      pintarAnexoEnEdicion, guardarAnexo, anexos,
                      y los handlers de 'crear-anexo',
                      'editar-anexo' y 'eliminar-anexo'. Se
                      elimina la propiedad editandoAnexo del
                      registro. Sin cambios en las firmas públicas.
                      Los anexos existentes siguen en la tabla
                      ahorasi_carta con tipo 'anexo' y son leídos
                      por anexos.js.
              v4.0.1: el CTA "Ver mi carta" se mueve arriba del
                      bloque de respuesta.
              v4.0.0: fusión con Respuesta.
              v3.0.0: rediseño al nuevo lenguaje visual.
              v2.2.0: id="vista-carta" para CSS.
              v2.1.0: edición inline de anexos, CRUD de compartidos.
              v2.0.1: envuelve todo en .vista--carta.
              v2.0.0: carta por usuario.
              v1.3.1: mostrarConfirmacion().
              v1.3.0: activar() pinta primero.
              v1.1.0: Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoCarta from '../datos/repositorios/carta.js';
import * as repoRespuestas from '../datos/repositorios/respuestas.js';
import { CONFIG } from '../config/config.js';
import { al } from '../nucleo/bus-eventos.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { crearLogger } from '../nucleo/logger.js';
import { obtener } from '../nucleo/almacen.js';
import { h, limpiarContenedor, formatearFecha } from '../nucleo/utils.js';

const log = crearLogger('vista:carta');

const TEXTO_GUIA = {
  manifiesto: [
    { titulo: '', contenido: 'Escribe aquí lo que quieras decirle. No hay prisa, no hay formato correcto.' },
    { titulo: '', contenido: 'Puedes contarle algo que te haya quedado dando vueltas, o simplemente agradecer por algo.' },
  ],
  compromisos: [
    { titulo: 'Escucharte', contenido: 'Sin interrumpir, sin adelantarme.' },
    { titulo: 'Ser clara con lo que siento', contenido: 'Aunque cueste.' },
  ],
  firma: 'Luci',
};

const ELECCIONES = [
  { id: 'paso_a_paso', etiqueta: 'Quiero ir paso a paso', ayuda: 'Sin etiquetas. Un plan a la vez.' },
  { id: 'hablar', etiqueta: 'Quiero que hablemos', ayuda: 'Con calma, cuando podamos.' },
  { id: 'tiempo', etiqueta: 'Necesito más tiempo', ayuda: 'Y está bien.' },
];

const SVG_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';
const SVG_FIJAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';
const SVG_FLECHA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

const registro = {
  contenedor: null,
  raiz: null,
  abortador: null,
  desuscribir: [],
  todasCarta: [],
  todasRespuestas: [],
  pantalla: 'otro',
  modo: 'vista',
  seccionesFijadas: new Set(),
  borrador: null,
  toastMostrado: false,
  toastElemento: null,
  editandoCompartido: null,
  respuestaSeleccionada: null,
  respuestaNota: '',
  respuestaEnviando: false,
  barraProgresoEl: null,
  manejarScrollRef: null,
};

/* ---------- Helpers -------------------------------------------- */

function usuarioActualId() {
  const u = obtener('usuarioActual');
  return u?.$id || u?.id || null;
}

function esLuci() {
  return usuarioActualId() === CONFIG.usuarios.luci;
}

function userIdOtro() {
  const yo = usuarioActualId();
  if (yo === CONFIG.usuarios.yayo) return CONFIG.usuarios.luci;
  if (yo === CONFIG.usuarios.luci) return CONFIG.usuarios.yayo;
  return null;
}

function nombreDe(userId) {
  if (userId === CONFIG.usuarios.yayo) return 'Yayo';
  if (userId === CONFIG.usuarios.luci) return 'Luci';
  return 'Desconocido';
}

function nombreOtro() {
  return nombreDe(userIdOtro());
}

function nombrePropio() {
  return nombreDe(usuarioActualId());
}

function etiquetaEleccion(id) {
  const e = ELECCIONES.find((x) => x.id === id);
  return e ? e.etiqueta : id;
}

function piezasDe(userId, tipo) {
  return registro.todasCarta
    .filter((p) => p.autor === userId && p.tipo === tipo)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function firmaDe(userId) {
  return registro.todasCarta.find((p) => p.autor === userId && p.tipo === 'firma') || null;
}

function cartaDe(userId) {
  return {
    manifiesto: piezasDe(userId, 'base'),
    compromisos: piezasDe(userId, 'compromiso'),
    firma: firmaDe(userId),
  };
}

function compartidos() {
  return registro.todasCarta
    .filter((p) => p.tipo === 'compromiso_compartido')
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function cartaVacia(userId) {
  const c = cartaDe(userId);
  return c.manifiesto.length === 0 && c.compromisos.length === 0 && !c.firma;
}

function fechaRelativa(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (dias < 1) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} semanas`;
  return `Hace ${Math.floor(dias / 30)} meses`;
}

function distintivoAutorLocal(userId) {
  const nombre = nombreDe(userId);
  const inicial = nombre.charAt(0).toUpperCase();
  const clase = userId === CONFIG.usuarios.yayo ? 'autor--yayo'
    : userId === CONFIG.usuarios.luci ? 'autor--luci'
    : 'autor--desconocido';
  return h('span', { class: `autor ${clase}`, 'aria-label': `Por ${nombre}` },
    h('span', { class: 'autor__inicial', 'aria-hidden': 'true' }, inicial),
    h('span', {}, nombre)
  );
}

/* ---------- Mensajes ------------------------------------------- */

function pintarMensaje(tipo, texto) {
  const raiz = registro.raiz;
  if (!raiz) return;
  const clase = tipo === 'ok' ? 'vista__ok' : 'vista__error';
  const p = h('p', { class: clase, role: tipo === 'ok' ? 'status' : 'alert' }, texto);
  raiz.prepend(p);
  setTimeout(() => p.remove(), 5000);
}

/* ---------- Barra de progreso de lectura (D7) ------------------ */

function montarBarraProgreso() {
  const header = document.querySelector('.shell__header');
  if (!header) return;

  quitarBarraProgreso();

  const barra = h('div', { class: 'progreso-lectura', 'aria-hidden': 'true' },
    h('i', {})
  );
  header.append(barra);
  registro.barraProgresoEl = barra;

  const actualizar = () => {
    const i = barra.querySelector('i');
    if (!i) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    i.style.width = pct.toFixed(2) + '%';
  };
  registro.manejarScrollRef = actualizar;

  window.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', actualizar);
  actualizar();
}

function quitarBarraProgreso() {
  if (registro.manejarScrollRef) {
    window.removeEventListener('scroll', registro.manejarScrollRef);
    window.removeEventListener('resize', registro.manejarScrollRef);
    registro.manejarScrollRef = null;
  }
  if (registro.barraProgresoEl && registro.barraProgresoEl.parentNode) {
    registro.barraProgresoEl.remove();
  }
  registro.barraProgresoEl = null;
}

/* ---------- Bloques reusables --------------------------------- */

function pintarManifiesto(items) {
  const cont = h('div', {});
  if (items.length === 0) {
    cont.append(h('p', { class: 'vista__vacio' }, 'Sin párrafos.'));
    return cont;
  }
  for (const p of items) {
    cont.append(h('div', { class: 'carta__parrafo' },
      p.titulo ? h('div', { class: 'carta__titulo-interno' }, p.titulo) : null,
      h('p', { class: 'carta__texto' }, p.contenido)
    ));
  }
  return cont;
}

function pintarSeparador() {
  return h('div', { class: 'carta__separador', 'aria-hidden': 'true' },
    h('span', {}, '·'),
    h('span', {}, '·'),
    h('span', {}, '·')
  );
}

function pintarCompromisosDelOtro(items) {
  const ul = h('ul', { class: 'compromisos__lista' });
  if (items.length === 0) {
    return h('p', { class: 'vista__vacio' }, 'Sin compromisos.');
  }
  for (const c of items) {
    const li = h('li', { class: 'compromiso' });
    const check = h('span', { class: 'compromiso__check' });
    check.innerHTML = SVG_CHECK;
    li.append(
      check,
      h('div', { class: 'compromiso__cuerpo' },
        h('p', { class: 'compromiso__titulo' }, c.titulo),
        h('p', { class: 'compromiso__desc' }, c.contenido)
      )
    );
    ul.append(li);
  }
  return ul;
}

function pintarListaCompartidos(items) {
  const ul = h('ul', { class: 'compartidos__lista' });
  for (const c of items) {
    if (registro.editandoCompartido === c.id) {
      ul.append(pintarCompartidoEnEdicion(c));
    } else {
      const li = h('li', { class: 'compartido', 'data-id': c.id });
      const check = h('span', { class: 'compartido__check' });
      check.innerHTML = SVG_CHECK;
      li.append(
        check,
        h('div', { class: 'compartido__cuerpo' },
          h('p', { class: 'compartido__titulo' }, c.titulo),
          h('p', { class: 'compartido__desc' }, c.contenido),
          h('div', { class: 'compartido__meta' },
            distintivoAutorLocal(c.autor),
            h('button', {
              type: 'button', class: 'btn-mini',
              'data-accion': 'editar-compartido', 'data-id': c.id,
            }, 'Editar'),
            h('button', {
              type: 'button', class: 'btn-mini btn-mini--peligro',
              'data-accion': 'eliminar-compartido', 'data-id': c.id,
            }, 'Eliminar')
          )
        )
      );
      ul.append(li);
    }
  }
  return ul;
}

function pintarCompartidoEnEdicion(c) {
  const inputT = h('input', { value: c.titulo || '', placeholder: 'Título', maxlength: 200 });
  const textarea = h('textarea', { placeholder: 'Descripción' }, c.contenido || '');
  return h('li', { class: 'campo-editable', 'data-id': c.id },
    inputT,
    textarea,
    h('div', { class: 'form-inline__fila' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        onclick: () => {
          registro.editandoCompartido = null;
          pintar();
        },
      }, 'Cancelar'),
      h('button', {
        type: 'button', class: 'btn btn--primario',
        onclick: () => guardarCompartido(c.id, inputT.value, textarea.value),
      }, 'Guardar')
    )
  );
}

async function guardarCompartido(id, titulo, contenido) {
  const r = await repoCarta.actualizar(id, { titulo, contenido });
  if (r.exito) {
    registro.editandoCompartido = null;
    await refrescar();
    pintar();
  } else {
    pintarMensaje('error', r.error);
  }
}

/* ---------- CTA "Ver mi carta" --------------------------------- */

function pintarCtaVerMiCarta() {
  return h('aside', { class: 'cta-carta' },
    h('p', { class: 'cta-carta__eyebrow' }, 'Tu turno'),
    h('p', { class: 'cta-carta__titulo' }, '¿Quieres escribirle algo a ' + nombreOtro() + '?'),
    h('p', { class: 'cta-carta__sub' }, 'Puedes dejar tu propia carta, tus compromisos y una firma.'),
    h('button', {
      type: 'button',
      class: 'btn btn--primario btn--full',
      'data-accion': 'ir-mia',
    }, 'Ver mi carta', h('span', { html: SVG_FLECHA }))
  );
}

/* ---------- Bloque de respuesta -------------------------------- */

function ultimaRespuestaPropia() {
  const yo = usuarioActualId();
  return registro.todasRespuestas.find((r) => r.enviadoPor === yo) || null;
}

function pintarBloqueRespuesta() {
  const propia = ultimaRespuestaPropia();
  const bloque = h('section', { class: 'respuesta-cta', id: 'bloqueRespuesta' });

  bloque.append(
    h('p', { class: 'respuesta-cta__eyebrow' }, 'Cuando quieras'),
    h('p', { class: 'respuesta-cta__titulo' }, propia ? 'Tu respuesta' : '¿Cómo te sientes ahora?')
  );

  if (propia) {
    const check = h('span', { class: 'ya-respondiste__icono' });
    check.innerHTML = SVG_CHECK;

    bloque.append(
      h('div', { class: 'ya-respondiste' },
        check,
        h('div', { class: 'ya-respondiste__cuerpo' },
          h('p', { class: 'ya-respondiste__titulo' }, `Ya le dijiste a ${nombreOtro()}`),
          h('p', { class: 'ya-respondiste__sub' },
            'Elegiste: ',
            h('strong', {}, etiquetaEleccion(propia.eleccion)),
            `. Puedes cambiar tu respuesta cuando quieras.`
          )
        )
      ),
      h('button', {
        type: 'button', class: 'btn btn--secundario btn--full',
        'data-accion': 'cambiar-respuesta',
      }, 'Cambiar mi respuesta')
    );
  } else {
    const opciones = h('div', { class: 'respuesta-opciones' });
    for (const e of ELECCIONES) {
      opciones.append(h('button', {
        type: 'button',
        class: 'respuesta-opcion',
        'data-accion': 'elegir-respuesta',
        'data-id': e.id,
        'aria-pressed': String(registro.respuestaSeleccionada === e.id),
      },
        h('span', { class: 'respuesta-opcion__t' }, e.etiqueta),
        h('span', { class: 'respuesta-opcion__s' }, e.ayuda)
      ));
    }

    const textarea = h('textarea', {
      class: 'respuesta-nota',
      'data-accion': 'nota-respuesta',
      placeholder: 'Si quieres agregar algo… (opcional)',
      maxlength: 500,
    });
    textarea.value = registro.respuestaNota;

    const btnEnviar = h('button', {
      type: 'button',
      class: 'respuesta-boton-enviar',
      'data-accion': 'enviar-respuesta',
    }, registro.respuestaEnviando ? 'Enviando…' : 'Enviar respuesta');
    if (!registro.respuestaSeleccionada || registro.respuestaEnviando) {
      btnEnviar.disabled = true;
    }

    bloque.append(opciones, textarea, btnEnviar);
  }

  if (registro.todasRespuestas.length > 0) {
    const hist = h('div', { class: 'historial' },
      h('p', { class: 'historial__titulo' }, 'Lo que ya se dijo')
    );
    const lista = h('div', { class: 'historial__lista' });

    for (const r of registro.todasRespuestas) {
      const item = h('div', { class: 'historial__item' },
        h('div', { class: 'historial__cab' },
          distintivoAutorLocal(r.enviadoPor),
          h('span', { class: 'historial__eleccion' }, etiquetaEleccion(r.eleccion)),
          h('span', { class: 'historial__fecha' }, formatearFecha(r.enviadoEn))
        )
      );
      if (r.nota) {
        item.append(h('p', { class: 'historial__nota' }, `"${r.nota}"`));
      }
      lista.append(item);
    }
    hist.append(lista);
    bloque.append(hist);
  } else {
    bloque.append(
      h('p', { class: 'historial__vacio' }, 'Sin respuestas todavía.')
    );
  }

  return bloque;
}

async function enviarRespuesta() {
  if (!registro.respuestaSeleccionada || registro.respuestaEnviando) return;
  registro.respuestaEnviando = true;
  pintar();

  const r = await repoRespuestas.crear({
    eleccion: registro.respuestaSeleccionada,
    nota: registro.respuestaNota,
  });

  registro.respuestaEnviando = false;

  if (r.exito) {
    registro.respuestaSeleccionada = null;
    registro.respuestaNota = '';
    await refrescarRespuestas();
    pintar();
    pintarMensaje('ok', 'Respuesta enviada.');
  } else {
    pintarMensaje('error', r.error);
    pintar();
  }
}

/* ---------- Vistas --------------------------------------------- */

function pintarVistaOtro(cont) {
  const otro = userIdOtro();
  const carta = cartaDe(otro);
  const comp = compartidos();

  // Hoja de carta.
  if (!cartaVacia(otro)) {
    const hoja = h('article', { class: 'carta-hoja' });

    const fechaBase = carta.manifiesto[0]?.creadoEn;
    hoja.append(h('div', { class: 'carta__fecha' },
      'De ' + nombreOtro() + ' · ' + (fechaBase ? fechaRelativa(fechaBase) : 'hoy')));

    if (carta.manifiesto.length > 0) {
      hoja.append(pintarManifiesto(carta.manifiesto));
    }

    if (carta.firma && carta.firma.contenido) {
      hoja.append(pintarSeparador());
      hoja.append(h('div', { class: 'carta__firma' },
        h('span', { class: 'carta__firma-texto' }, carta.firma.contenido),
        h('span', { class: 'carta__firma-rol' }, 'Firmado')
      ));
    }

    cont.append(hoja);
  } else {
    cont.append(h('div', { class: 'vacio-caja' },
      h('div', { class: 'vacio-caja__emoji' }, '💌'),
      h('h2', { class: 'vacio-caja__titulo' }, nombreOtro() + ' todavía no dejó su carta'),
      h('p', { class: 'vacio-caja__sub' }, 'Cuando la escriba, va a aparecer acá.')
    ));
  }

  // Compromisos del otro.
  if (carta.compromisos.length > 0) {
    cont.append(h('section', { class: 'seccion' },
      h('div', { class: 'seccion__cab' },
        h('h2', { class: 'seccion__titulo' }, 'Sus compromisos'),
        h('span', { class: 'seccion__contador' }, String(carta.compromisos.length))
      ),
      pintarCompromisosDelOtro(carta.compromisos)
    ));
  }

  // Compromisos compartidos.
  cont.append(h('section', { class: 'seccion' },
    h('div', { class: 'seccion__cab' },
      h('h2', { class: 'seccion__titulo' }, 'Compromisos compartidos'),
      h('span', { class: 'seccion__contador' }, String(comp.length))
    ),
    comp.length > 0
      ? pintarListaCompartidos(comp)
      : h('p', { class: 'vista__vacio' }, 'Sin compromisos compartidos todavía.'),
    h('form', { class: 'form-inline', 'data-accion': 'crear-compartido' },
      h('input', { name: 'titulo', placeholder: 'Título del compromiso', required: true, maxlength: 200 }),
      h('textarea', { name: 'contenido', placeholder: 'Descripción', required: true, rows: 2, maxlength: 500 }),
      h('div', { class: 'form-inline__fila' },
        h('button', { type: 'submit', class: 'btn btn--primario' }, 'Agregar compromiso')
      )
    )
  ));

  // CTA "Ver mi carta" — va antes del bloque de respuesta.
  cont.append(pintarCtaVerMiCarta());

  // Bloque de respuesta.
  cont.append(pintarBloqueRespuesta());
}

function pintarVistaMia(cont) {
  const propia = cartaDe(usuarioActualId());

  if (registro.modo === 'vista' && cartaVacia(usuarioActualId())) {
    cont.append(h('div', { class: 'vacio-caja' },
      h('div', { class: 'vacio-caja__emoji' }, '✍️'),
      h('h2', { class: 'vacio-caja__titulo' }, 'Tu carta está en blanco'),
      h('p', { class: 'vacio-caja__sub' }, 'Puedes escribir desde cero, o cargar un texto de guía y editarlo a tu gusto.'),
      h('div', { class: 'vacio-caja__botones' },
        h('button', {
          type: 'button', class: 'btn btn--primario btn--full',
          'data-accion': 'empezar-vacio',
        }, 'Escribir desde cero'),
        esLuci() ? h('button', {
          type: 'button', class: 'btn btn--secundario btn--full',
          'data-accion': 'cargar-guia',
        }, 'Ver mensaje de prueba') : null
      )
    ));
    return;
  }

  const datos = registro.modo === 'edicion' ? registro.borrador : propia;

  if (registro.modo === 'edicion') {
    cont.append(h('div', { class: 'banner-edicion' },
      h('span', { class: 'banner-edicion__punto' }),
      h('span', { class: 'banner-edicion__texto' },
        'Editando tu carta — fija cada sección cuando la tengas lista')
    ));

    cont.append(pintarSeccionEditableManifiesto(datos.manifiesto));
    if (!registro.seccionesFijadas.has('manifiesto')) {
      cont.append(divisorFijar('manifiesto', 'Fijar manifiesto'));
    }

    cont.append(pintarSeccionEditableCompromisos(datos.compromisos));
    if (!registro.seccionesFijadas.has('compromisos')) {
      cont.append(divisorFijar('compromisos', 'Fijar compromisos'));
    }

    cont.append(pintarSeccionEditableFirma(datos.firma));
    if (!registro.seccionesFijadas.has('firma')) {
      cont.append(divisorFijar('firma', 'Fijar firma'));
    }

    cont.append(h('div', { class: 'barra-edicion' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        'data-accion': 'cancelar-edicion',
      }, 'Cancelar'),
      h('button', {
        type: 'button', class: 'btn btn--primario',
        'data-accion': 'fijar-todo',
      }, 'Fijar todo')
    ));
    return;
  }

  const hoja = h('article', { class: 'carta-hoja' });

  const fechaBase = propia.manifiesto[0]?.creadoEn;
  hoja.append(h('div', { class: 'carta__fecha' },
    'Tu carta · ' + (fechaBase ? fechaRelativa(fechaBase) : 'hoy')));

  if (propia.manifiesto.length > 0) {
    hoja.append(pintarManifiesto(propia.manifiesto));
  }

  if (propia.firma && propia.firma.contenido) {
    hoja.append(pintarSeparador());
    hoja.append(h('div', { class: 'carta__firma' },
      h('span', { class: 'carta__firma-texto' }, propia.firma.contenido),
      h('span', { class: 'carta__firma-rol' }, 'Firmado')
    ));
  }

  cont.append(hoja);

  if (propia.compromisos.length > 0) {
    cont.append(h('section', { class: 'seccion' },
      h('div', { class: 'seccion__cab' },
        h('h2', { class: 'seccion__titulo' }, 'Mis compromisos'),
        h('span', { class: 'seccion__contador' }, String(propia.compromisos.length))
      ),
      pintarCompromisosDelOtro(propia.compromisos)
    ));
  }

  cont.append(h('div', { style: 'margin-top: 28px; display: flex; flex-direction: column; gap: 8px;' },
    h('button', {
      type: 'button', class: 'btn btn--primario btn--full',
      'data-accion': 'editar-mi-carta',
    }, 'Editar mi carta'),
    h('button', {
      type: 'button', class: 'btn btn--secundario btn--full',
      'data-accion': 'volver-al-otro',
    }, 'Volver a la carta de ' + nombreOtro())
  ));
}

/* ---------- Secciones editables -------------------------------- */

function pintarSeccionEditableManifiesto(items) {
  const seccion = h('section', { class: 'seccion', style: 'margin-top: 0;' });
  seccion.append(h('div', { class: 'seccion__cab' },
    h('h2', { class: 'seccion__titulo' }, 'Manifiesto')
  ));

  items.forEach((p, idx) => {
    const inputT = h('input', { type: 'text', value: p.titulo || '', placeholder: 'Título (opcional)', maxlength: 200 });
    const textarea = h('textarea', { placeholder: 'Escribe aquí lo que quieras decirle. No hay prisa, no hay formato correcto.' }, p.contenido || '');
    inputT.addEventListener('input', () => { p.titulo = inputT.value; });
    textarea.addEventListener('input', () => { p.contenido = textarea.value; });

    seccion.append(h('div', { class: 'fila-editable' },
      h('div', { class: 'fila-editable__cuerpo' },
        h('div', { class: 'campo-editable' }, inputT),
        h('div', { class: 'campo-editable', style: 'margin-bottom: 0;' }, textarea)
      ),
      h('button', {
        type: 'button', class: 'btn-quitar', 'aria-label': 'Eliminar',
        onclick: () => {
          registro.borrador.manifiesto.splice(idx, 1);
          pintar();
        },
      }, '×')
    ));
  });

  seccion.append(h('button', {
    type: 'button', class: 'btn-agregar',
    onclick: () => {
      registro.borrador.manifiesto.push({ id: null, titulo: '', contenido: '' });
      pintar();
    },
  }, '+ Agregar párrafo'));

  return seccion;
}

function pintarSeccionEditableCompromisos(items) {
  const seccion = h('section', { class: 'seccion' });
  seccion.append(h('div', { class: 'seccion__cab' },
    h('h2', { class: 'seccion__titulo' }, 'Mis compromisos')
  ));

  items.forEach((c, idx) => {
    const inputT = h('input', { type: 'text', value: c.titulo || '', placeholder: 'Título', maxlength: 200 });
    const textarea = h('textarea', { placeholder: 'Descripción' }, c.contenido || '');
    inputT.addEventListener('input', () => { c.titulo = inputT.value; });
    textarea.addEventListener('input', () => { c.contenido = textarea.value; });

    seccion.append(h('div', { class: 'fila-editable' },
      h('div', { class: 'fila-editable__cuerpo' },
        h('div', { class: 'campo-editable' }, inputT),
        h('div', { class: 'campo-editable', style: 'margin-bottom: 0;' }, textarea)
      ),
      h('button', {
        type: 'button', class: 'btn-quitar', 'aria-label': 'Eliminar',
        onclick: () => {
          registro.borrador.compromisos.splice(idx, 1);
          pintar();
        },
      }, '×')
    ));
  });

  seccion.append(h('button', {
    type: 'button', class: 'btn-agregar',
    onclick: () => {
      registro.borrador.compromisos.push({ id: null, titulo: '', contenido: '' });
      pintar();
    },
  }, '+ Agregar compromiso'));

  return seccion;
}

function pintarSeccionEditableFirma(firma) {
  const seccion = h('section', { class: 'seccion' });
  seccion.append(h('div', { class: 'seccion__cab' },
    h('h2', { class: 'seccion__titulo' }, 'Firma')
  ));

  const valor = firma?.contenido || '';
  const input = h('input', {
    type: 'text',
    value: valor,
    placeholder: 'Firma',
    maxlength: 100,
    style: 'font-family: var(--fuente-carta); font-style: italic; font-size: 20px;',
  });
  input.addEventListener('input', () => {
    if (!registro.borrador.firma) registro.borrador.firma = { id: null, contenido: '' };
    registro.borrador.firma.contenido = input.value;
  });

  seccion.append(h('div', { class: 'campo-editable' }, input));
  return seccion;
}

function divisorFijar(seccion, etiqueta) {
  return h('div', { class: 'fijar-seccion' },
    h('button', {
      type: 'button', class: 'btn-fijar',
      onclick: () => fijarSeccion(seccion),
    }, h('span', { html: SVG_FIJAR }), etiqueta)
  );
}

/* ---------- Flujo de edición ----------------------------------- */

function entrarEdicion() {
  const propia = cartaDe(usuarioActualId());
  registro.borrador = {
    manifiesto: propia.manifiesto.map((p) => ({ id: p.id, titulo: p.titulo, contenido: p.contenido })),
    compromisos: propia.compromisos.map((c) => ({ id: c.id, titulo: c.titulo, contenido: c.contenido })),
    firma: propia.firma
      ? { id: propia.firma.id, contenido: propia.firma.contenido }
      : { id: null, contenido: '' },
  };
  registro.modo = 'edicion';
  registro.seccionesFijadas = new Set();
  pintar();
}

function cancelarEdicion() {
  registro.borrador = null;
  registro.modo = 'vista';
  registro.seccionesFijadas = new Set();
  pintar();
}

async function fijarSeccion(nombre) {
  const aplicar = {
    manifiesto: aplicarManifiesto,
    compromisos: aplicarCompromisos,
    firma: aplicarFirma,
  }[nombre];
  if (!aplicar) return;

  const ok = await aplicar();
  if (!ok) return;

  registro.seccionesFijadas.add(nombre);
  const todas = ['manifiesto', 'compromisos', 'firma'];
  if (todas.every((s) => registro.seccionesFijadas.has(s))) {
    registro.borrador = null;
    registro.modo = 'vista';
    registro.seccionesFijadas = new Set();
    await refrescar();
    pintar();
    pintarMensaje('ok', 'Todo fijado. Vuelves a la vista limpia.');
  } else {
    pintar();
  }
}

async function fijarTodo() {
  for (const s of ['manifiesto', 'compromisos', 'firma']) {
    const aplicar = {
      manifiesto: aplicarManifiesto,
      compromisos: aplicarCompromisos,
      firma: aplicarFirma,
    }[s];
    if (!aplicar) continue;
    const ok = await aplicar();
    if (!ok) return;
  }
  registro.borrador = null;
  registro.modo = 'vista';
  registro.seccionesFijadas = new Set();
  await refrescar();
  pintar();
  pintarMensaje('ok', 'Todo fijado.');
}

async function aplicarManifiesto() {
  return aplicarBloque('base', registro.borrador.manifiesto);
}

async function aplicarCompromisos() {
  return aplicarBloque('compromiso', registro.borrador.compromisos);
}

async function aplicarBloque(tipo, itemsBorrador) {
  const yo = usuarioActualId();
  const actuales = piezasDe(yo, tipo);

  const idsBorrador = new Set(itemsBorrador.map((i) => i.id).filter(Boolean));
  for (const fila of actuales) {
    if (!idsBorrador.has(fila.id)) {
      const r = await repoCarta.eliminar(fila.id);
      if (!r.exito) {
        pintarMensaje('error', r.error);
        return false;
      }
    }
  }

  let orden = 0;
  for (const item of itemsBorrador) {
    if (!item.titulo?.trim() && !item.contenido?.trim()) {
      orden++;
      continue;
    }
    const payload = {
      titulo: item.titulo?.trim() || '(sin título)',
      contenido: item.contenido?.trim() || '',
      orden,
    };
    if (item.id) {
      const original = actuales.find((f) => f.id === item.id);
      const cambio = !original
        || original.titulo !== payload.titulo
        || original.contenido !== payload.contenido
        || (original.orden || 0) !== orden;
      if (cambio) {
        const r = await repoCarta.actualizar(item.id, payload);
        if (!r.exito) {
          pintarMensaje('error', r.error);
          return false;
        }
      }
    } else {
      const r = await repoCarta.crear({ tipo, ...payload });
      if (!r.exito) {
        pintarMensaje('error', r.error);
        return false;
      }
    }
    orden++;
  }
  return true;
}

async function aplicarFirma() {
  const f = registro.borrador.firma;
  if (!f) return true;
  const yo = usuarioActualId();
  const actual = firmaDe(yo);
  const contenido = (f.contenido || '').trim();

  if (!contenido) {
    if (actual) {
      const r = await repoCarta.eliminar(actual.id);
      if (!r.exito) { pintarMensaje('error', r.error); return false; }
    }
    return true;
  }

  if (actual) {
    if (actual.contenido === contenido) return true;
    const r = await repoCarta.actualizar(actual.id, { contenido });
    if (!r.exito) { pintarMensaje('error', r.error); return false; }
    return true;
  }

  const r = await repoCarta.crear({ tipo: 'firma', titulo: 'Firma', contenido, orden: 999 });
  if (!r.exito) { pintarMensaje('error', r.error); return false; }
  return true;
}

/* ---------- Desde cero ----------------------------------------- */

function empezarVacio() {
  registro.borrador = {
    manifiesto: [],
    compromisos: [],
    firma: { id: null, contenido: nombrePropio() },
  };
  registro.modo = 'edicion';
  registro.seccionesFijadas = new Set();
  pintar();
}

function cargarTextoGuia() {
  registro.borrador = {
    manifiesto: TEXTO_GUIA.manifiesto.map((p) => ({ id: null, titulo: p.titulo, contenido: p.contenido })),
    compromisos: TEXTO_GUIA.compromisos.map((c) => ({ id: null, titulo: c.titulo, contenido: c.contenido })),
    firma: { id: null, contenido: TEXTO_GUIA.firma },
  };
  registro.modo = 'edicion';
  registro.seccionesFijadas = new Set();
  pintar();
}

/* ---------- Toast ---------------------------------------------- */

function mostrarToastBienvenida() {
  if (!esLuci()) return;
  if (registro.pantalla !== 'otro') return;
  if (registro.toastMostrado) return;
  if (!cartaVacia(usuarioActualId())) return;
  if (cartaVacia(userIdOtro())) return;

  registro.toastMostrado = true;

  const toast = h('div', { class: 'carta-toast' },
    h('div', { class: 'carta-toast__texto' },
      nombreOtro() + ' te dejó una carta. ¿Quieres dejarle un mensaje?'),
    h('button', {
      type: 'button', class: 'carta-toast__boton',
      onclick: () => {
        cerrarToast();
        registro.pantalla = 'mio';
        registro.modo = 'vista';
        pintar();
      },
    }, 'Déjale un mensaje'),
    h('button', {
      type: 'button', class: 'carta-toast__cerrar', 'aria-label': 'Cerrar',
      onclick: cerrarToast,
    }, '×')
  );

  document.body.append(toast);
  registro.toastElemento = toast;
  toast.offsetWidth;
  toast.classList.add('carta-toast--visible');

  setTimeout(cerrarToast, 8000);
}

function cerrarToast() {
  const t = registro.toastElemento;
  if (!t) return;
  t.classList.remove('carta-toast--visible');
  setTimeout(() => {
    if (t.parentNode) t.remove();
  }, 300);
  registro.toastElemento = null;
}

/* ---------- Manejo de eventos ---------------------------------- */

async function manejarSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const accion = form.dataset.accion;
  if (!accion) return;
  const fd = new FormData(form);

  if (accion === 'crear-compartido') {
    const r = await repoCarta.crear({
      tipo: 'compromiso_compartido',
      titulo: String(fd.get('titulo') || '').trim() || '(sin título)',
      contenido: String(fd.get('contenido') || '').trim(),
      orden: compartidos().length,
    });
    if (r.exito) {
      form.reset();
      await refrescar();
      pintar();
    } else {
      pintarMensaje('error', r.error);
    }
  }
}

async function manejarClick(ev) {
  const btn = ev.target.closest('button[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;

  if (accion === 'ir-mia') {
    registro.pantalla = 'mio';
    registro.modo = 'vista';
    registro.borrador = null;
    registro.seccionesFijadas = new Set();
    registro.editandoCompartido = null;
    pintar();
  } else if (accion === 'volver-al-otro') {
    registro.pantalla = 'otro';
    registro.modo = 'vista';
    registro.borrador = null;
    registro.seccionesFijadas = new Set();
    pintar();
  } else if (accion === 'editar-mi-carta') {
    entrarEdicion();
  } else if (accion === 'cancelar-edicion') {
    cancelarEdicion();
  } else if (accion === 'fijar-todo') {
    fijarTodo();
  } else if (accion === 'empezar-vacio') {
    empezarVacio();
  } else if (accion === 'cargar-guia') {
    cargarTextoGuia();
  } else if (accion === 'editar-compartido') {
    registro.editandoCompartido = id;
    pintar();
  } else if (accion === 'eliminar-compartido') {
    const ok = await mostrarConfirmacion(
      'Eliminar compromiso compartido',
      '¿Seguro que quieres eliminar este compromiso?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoCarta.eliminar(id);
    if (r.exito) { await refrescar(); pintar(); }
    else pintarMensaje('error', r.error);
  } else if (accion === 'elegir-respuesta') {
    registro.respuestaSeleccionada =
      registro.respuestaSeleccionada === id ? null : id;
    pintar();
  } else if (accion === 'enviar-respuesta') {
    enviarRespuesta();
  } else if (accion === 'cambiar-respuesta') {
    registro.respuestaSeleccionada = null;
    registro.respuestaNota = '';
    pintar();
  }
}

function manejarInput(ev) {
  const ta = ev.target.closest('textarea[data-accion="nota-respuesta"]');
  if (!ta) return;
  registro.respuestaNota = ta.value;
}

/* ---------- Refresco y pintado --------------------------------- */

async function refrescarCarta() {
  const r = await repoCarta.listar();
  if (!r.exito) {
    pintarMensaje('error', r.error);
    return;
  }
  registro.todasCarta = r.datos;
}

async function refrescarRespuestas() {
  const r = await repoRespuestas.listar();
  if (!r.exito) {
    pintarMensaje('error', r.error);
    return;
  }
  registro.todasRespuestas = r.datos;
}

async function refrescar() {
  await Promise.all([refrescarCarta(), refrescarRespuestas()]);
}

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-carta', class: 'vista vista--carta' });
  cont.append(raiz);
  registro.raiz = raiz;

  if (registro.pantalla === 'otro') {
    pintarVistaOtro(raiz);
    setTimeout(mostrarToastBienvenida, 400);
  } else {
    pintarVistaMia(raiz);
  }
}

/* ---------- Ciclo de vida -------------------------------------- */

export async function activar(contenedor) {
  registro.contenedor = contenedor;
  registro.abortador = new AbortController();
  registro.pantalla = 'otro';
  registro.modo = 'vista';
  registro.borrador = null;
  registro.seccionesFijadas = new Set();
  registro.toastMostrado = false;
  registro.editandoCompartido = null;
  registro.respuestaSeleccionada = null;
  registro.respuestaNota = '';
  registro.respuestaEnviando = false;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });
  contenedor.addEventListener('input', manejarInput, { signal });

  registro.desuscribir = [
    al('realtime:carta:crear', async () => { await refrescar(); pintar(); }),
    al('realtime:carta:actualizar', async () => { await refrescar(); pintar(); }),
    al('realtime:carta:eliminar', async () => { await refrescar(); pintar(); }),
    al('realtime:respuestas:crear', async () => { await refrescarRespuestas(); pintar(); }),
  ];

  montarBarraProgreso();

  await refrescar();
  pintar();
}

export function limpiar() {
  quitarBarraProgreso();
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  cerrarToast();
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.todasCarta = [];
  registro.todasRespuestas = [];
  registro.borrador = null;
  registro.seccionesFijadas = new Set();
  registro.pantalla = 'otro';
  registro.modo = 'vista';
  registro.toastMostrado = false;
  registro.editandoCompartido = null;
  registro.respuestaSeleccionada = null;
  registro.respuestaNota = '';
  registro.respuestaEnviando = false;
  registro.contenedor = null;
  registro.raiz = null;
  registro.barraProgresoEl = null;
  registro.manejarScrollRef = null;
}