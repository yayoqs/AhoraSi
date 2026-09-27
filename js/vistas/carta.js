/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/vistas/carta.js
   Versión: 2.2.0
   Propósito: vista de la carta. Cada usuario tiene su propia
              carta (manifiesto, compromisos personales y firma).
              La vista principal muestra la carta del otro más los
              compromisos compartidos y los anexos. El botón "Ver
              mi carta" lleva a la propia, donde se puede editar
              con fijado por sección.
              v2.2.0: la sección raíz lleva id="vista-carta" para
                      el encapsulado de CSS. Sin cambios en la
                      lógica ni en las firmas públicas.
              v2.1.0: edición inline de anexos, CRUD completo de
                      compromisos compartidos.
              v2.0.1: envuelve todo en .vista--carta.
              v2.0.0: reescritura completa, carta por usuario.
              v1.3.1: usa mostrarConfirmacion().
              v1.3.0: activar() pinta primero.
              v1.2.0: distintivoAutor, clase .vista--carta.
              v1.1.0: escucha eventos de Realtime.
              v1.0.0: versión inicial.
   ================================================================ */

import * as repoCarta from '../datos/repositorios/carta.js';
import { CONFIG } from '../config/config.js';
import { al } from '../nucleo/bus-eventos.js';
import { mostrarConfirmacion } from '../nucleo/dialogos.js';
import { distintivoAutor } from '../nucleo/autores.js';
import { crearLogger } from '../nucleo/logger.js';
import { obtener } from '../nucleo/almacen.js';
import { h, limpiarContenedor } from '../nucleo/utils.js';

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

const registro = {
  contenedor: null,
  raiz: null,
  abortador: null,
  desuscribir: [],
  todas: [],
  pantalla: 'otro',
  modo: 'vista',
  seccionesFijadas: new Set(),
  borrador: null,
  toastMostrado: false,
  toastElemento: null,
  editandoAnexo: null,
  editandoCompromisoCompartido: null,
};

function usuarioActual() {
  const u = obtener('usuarioActual');
  return u?.$id || u?.id || null;
}

function esLuci() {
  return usuarioActual() === CONFIG.usuarios.luci;
}

function userIdOtro() {
  const yo = usuarioActual();
  if (yo === CONFIG.usuarios.yayo) return CONFIG.usuarios.luci;
  if (yo === CONFIG.usuarios.luci) return CONFIG.usuarios.yayo;
  return null;
}

function nombreOtro() {
  return userIdOtro() === CONFIG.usuarios.yayo ? 'Yayo' : 'Luci';
}

function nombrePropio() {
  return usuarioActual() === CONFIG.usuarios.yayo ? 'Yayo' : 'Luci';
}

function piezasDe(userId, tipo) {
  return registro.todas
    .filter((p) => p.autor === userId && p.tipo === tipo)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function firmaDe(userId) {
  return registro.todas.find((p) => p.autor === userId && p.tipo === 'firma') || null;
}

function cartaDe(userId) {
  return {
    manifiesto: piezasDe(userId, 'base'),
    compromisos: piezasDe(userId, 'compromiso'),
    firma: firmaDe(userId),
  };
}

function compartidos() {
  return registro.todas
    .filter((p) => p.tipo === 'compromiso_compartido')
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function anexos() {
  return registro.todas
    .filter((p) => p.tipo === 'anexo')
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function cartaVacia(userId) {
  const c = cartaDe(userId);
  return c.manifiesto.length === 0 && c.compromisos.length === 0 && !c.firma;
}

const NS_SVG = 'http://www.w3.org/2000/svg';

function svgCheck() {
  const s = document.createElementNS(NS_SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2.4');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS(NS_SVG, 'path');
  p.setAttribute('d', 'M4 12.5l5 5L20 6.5');
  s.append(p);
  return s;
}

function pintarMensaje(tipo, texto) {
  const raiz = registro.raiz;
  if (!raiz) return;
  const clase = tipo === 'ok' ? 'vista__ok' : 'vista__error';
  const p = h('p', { class: clase, role: tipo === 'ok' ? 'status' : 'alert' }, texto);
  raiz.prepend(p);
  setTimeout(() => p.remove(), 5000);
}

function pintarManifiesto(items) {
  const cont = h('div', { class: 'manifiesto' });
  if (items.length === 0) {
    cont.append(h('p', { class: 'vista__vacio' }, 'Sin párrafos.'));
    return cont;
  }
  for (const p of items) {
    cont.append(h('article', {},
      p.titulo ? h('h3', {}, p.titulo) : null,
      h('p', {}, p.contenido)
    ));
  }
  return cont;
}

function pintarCompromisos(items, compartido = false) {
  const ul = h('ul', { class: 'compromisos' });
  if (items.length === 0) {
    return h('p', { class: 'vista__vacio' }, 'Sin compromisos.');
  }
  for (const c of items) {
    ul.append(h('li', { class: 'compromiso' + (compartido ? ' compromiso--compartido' : '') },
      h('div', { class: 'compromiso__check' }, svgCheck()),
      h('div', {},
        h('p', { class: 'compromiso__titulo' }, c.titulo),
        h('p', { class: 'compromiso__desc' }, c.contenido)
      )
    ));
  }
  return ul;
}

/* ---------- Anexos: lista con edición inline ------------------- */

function pintarListaAnexos(items) {
  const ul = h('ul', { class: 'anexos' });
  for (const a of items) {
    if (registro.editandoAnexo === a.id) {
      ul.append(pintarAnexoEnEdicion(a));
    } else {
      ul.append(h('li', { class: 'anexo', 'data-id': a.id },
        h('h3', {}, a.titulo),
        h('p', {}, a.contenido),
        h('div', { class: 'anexo__meta' }, distintivoAutor(a.autor)),
        h('div', { class: 'anexo__acciones' },
          h('button', {
            type: 'button', class: 'btn-mini',
            'data-accion': 'editar-anexo', 'data-id': a.id,
          }, 'Editar'),
          h('button', {
            type: 'button', class: 'btn-mini',
            'data-accion': 'eliminar-anexo', 'data-id': a.id,
          }, 'Eliminar')
        )
      ));
    }
  }
  return ul;
}

function pintarAnexoEnEdicion(a) {
  const inputT = h('input', { value: a.titulo || '', placeholder: 'Título', maxlength: 200 });
  const textarea = h('textarea', { placeholder: 'Contenido' }, a.contenido || '');
  return h('li', { class: 'pieza-edit', style: 'list-style:none;' },
    inputT,
    textarea,
    h('div', { class: 'pieza-edit__botones' },
      h('button', {
        type: 'button', class: 'btn-primario',
        onclick: () => guardarAnexo(a.id, inputT.value, textarea.value),
      }, 'Guardar'),
      h('button', {
        type: 'button', class: 'btn-secundario',
        onclick: () => {
          registro.editandoAnexo = null;
          pintar();
        },
      }, 'Cancelar')
    )
  );
}

async function guardarAnexo(id, titulo, contenido) {
  const r = await repoCarta.actualizar(id, { titulo, contenido });
  if (r.exito) {
    registro.editandoAnexo = null;
    await refrescar();
    pintar();
  } else {
    pintarMensaje('error', r.error);
  }
}

/* ---------- Compromisos compartidos: lista con edición --------- */

function pintarListaCompartidos(items) {
  const ul = h('ul', { class: 'compromisos' });
  for (const c of items) {
    if (registro.editandoCompromisoCompartido === c.id) {
      ul.append(pintarCompartidoEnEdicion(c));
    } else {
      ul.append(h('li', { class: 'compromiso compromiso--compartido', 'data-id': c.id },
        h('div', { class: 'compromiso__check' }, svgCheck()),
        h('div', {},
          h('p', { class: 'compromiso__titulo' }, c.titulo),
          h('p', { class: 'compromiso__desc' }, c.contenido),
          h('div', { class: 'compromiso__meta' },
            distintivoAutor(c.autor),
            h('button', {
              type: 'button', class: 'btn-mini',
              'data-accion': 'editar-compartido', 'data-id': c.id,
            }, 'Editar'),
            h('button', {
              type: 'button', class: 'btn-mini',
              'data-accion': 'eliminar-compartido', 'data-id': c.id,
            }, 'Eliminar')
          )
        )
      ));
    }
  }
  return ul;
}

function pintarCompartidoEnEdicion(c) {
  const inputT = h('input', { value: c.titulo || '', placeholder: 'Título', maxlength: 200 });
  const textarea = h('textarea', { placeholder: 'Descripción' }, c.contenido || '');
  return h('li', { class: 'pieza-edit', style: 'list-style:none;' },
    inputT,
    textarea,
    h('div', { class: 'pieza-edit__botones' },
      h('button', {
        type: 'button', class: 'btn-primario',
        onclick: () => guardarCompartido(c.id, inputT.value, textarea.value),
      }, 'Guardar'),
      h('button', {
        type: 'button', class: 'btn-secundario',
        onclick: () => {
          registro.editandoCompromisoCompartido = null;
          pintar();
        },
      }, 'Cancelar')
    )
  );
}

async function guardarCompartido(id, titulo, contenido) {
  const r = await repoCarta.actualizar(id, { titulo, contenido });
  if (r.exito) {
    registro.editandoCompromisoCompartido = null;
    await refrescar();
    pintar();
  } else {
    pintarMensaje('error', r.error);
  }
}

/* ---------- Vistas --------------------------------------------- */

function pintarVistaOtro(cont) {
  const otro = userIdOtro();
  const carta = cartaDe(otro);

  cont.append(
    h('h1', {}, 'Carta'),
    h('p', { class: 'vista__lead' }, 'Lo que ' + nombreOtro() + ' dejó para ti.')
  );

  if (cartaVacia(otro)) {
    cont.append(
      h('div', { class: 'vacio-caja' },
        h('p', {}, nombreOtro() + ' todavía no dejó su carta.')
      )
    );
  } else {
    cont.append(pintarManifiesto(carta.manifiesto));

    if (carta.compromisos.length > 0) {
      cont.append(h('h2', { class: 'vista__subtitulo' }, 'Sus compromisos'));
      cont.append(pintarCompromisos(carta.compromisos));
    }

    if (carta.firma && carta.firma.contenido) {
      cont.append(h('div', { class: 'firma' },
        h('div', { class: 'firma__texto' }, carta.firma.contenido)
      ));
    }
  }

  cont.append(h('h2', { class: 'vista__subtitulo' }, 'Compromisos compartidos'));
  const comp = compartidos();
  if (comp.length === 0) {
    cont.append(h('p', { class: 'vista__vacio' }, 'Sin compromisos compartidos todavía.'));
  } else {
    cont.append(pintarListaCompartidos(comp));
  }
  cont.append(
    h('form', { class: 'vista__form', 'data-accion': 'crear-compartido' },
      h('input', { name: 'titulo', placeholder: 'Título del compromiso', required: true, maxlength: 200 }),
      h('textarea', { name: 'contenido', placeholder: 'Descripción', required: true, rows: 2, maxlength: 500 }),
      h('button', { type: 'submit' }, 'Agregar compromiso compartido')
    )
  );

  cont.append(h('h2', { class: 'vista__subtitulo' }, 'Anexos'));
  const anx = anexos();
  if (anx.length > 0) {
    cont.append(pintarListaAnexos(anx));
  } else {
    cont.append(h('p', { class: 'vista__vacio' }, 'Aún sin anexos.'));
  }
  cont.append(
    h('form', { class: 'vista__form', 'data-accion': 'crear-anexo' },
      h('input', { name: 'titulo', placeholder: 'Título del anexo', required: true, maxlength: 200 }),
      h('textarea', { name: 'contenido', placeholder: 'Contenido', required: true, rows: 4 }),
      h('button', { type: 'submit' }, 'Agregar anexo')
    )
  );
}

function pintarVistaMia(cont) {
  const propia = cartaDe(usuarioActual());

  if (registro.modo === 'vista' && cartaVacia(usuarioActual())) {
    cont.append(
      h('h1', {}, 'Tu carta'),
      h('p', { class: 'vista__lead' }, 'Todavía no has escrito nada. Cuando quieras, empieza.'),
      h('div', { class: 'vacio-caja' },
        h('p', {}, 'Puedes escribir desde cero, o cargar un texto de guía y editarlo a tu gusto.'),
        h('div', { class: 'vacio-caja__botones' },
          h('button', { type: 'button', class: 'btn-primario', 'data-accion': 'empezar-vacio' }, 'Escribir desde cero'),
          esLuci()
            ? h('button', { type: 'button', class: 'btn-secundario', 'data-accion': 'cargar-guia' }, 'Ver mensaje de prueba')
            : null
        )
      )
    );
    return;
  }

  cont.append(
    h('h1', {}, 'Tu carta'),
    h('p', { class: 'vista__lead' }, 'Lo que quieres decirle a ' + nombreOtro() + '.')
  );

  const datos = registro.modo === 'edicion' ? registro.borrador : propia;

  cont.append(h('h2', { class: 'vista__subtitulo' }, 'Manifiesto'));
  if (registro.modo === 'edicion') {
    cont.append(pintarManifiestoEditable(datos.manifiesto));
  } else {
    cont.append(pintarManifiesto(datos.manifiesto));
  }
  if (registro.modo === 'edicion' && !registro.seccionesFijadas.has('manifiesto')) {
    cont.append(divisorFijar('manifiesto', 'Fijar manifiesto'));
  }

  cont.append(h('h2', { class: 'vista__subtitulo' }, 'Compromisos'));
  if (registro.modo === 'edicion') {
    cont.append(pintarCompromisosEditables(datos.compromisos));
  } else {
    cont.append(pintarCompromisos(datos.compromisos));
  }
  if (registro.modo === 'edicion' && !registro.seccionesFijadas.has('compromisos')) {
    cont.append(divisorFijar('compromisos', 'Fijar compromisos'));
  }

  cont.append(h('h2', { class: 'vista__subtitulo' }, 'Firma'));
  if (registro.modo === 'edicion') {
    cont.append(pintarFirmaEditable(datos.firma));
  } else if (datos.firma && datos.firma.contenido) {
    cont.append(
      h('div', { class: 'firma' },
        h('div', { class: 'firma__texto' }, datos.firma.contenido)
      )
    );
  } else {
    cont.append(h('p', { class: 'vista__vacio' }, 'Sin firma.'));
  }
  if (registro.modo === 'edicion' && !registro.seccionesFijadas.has('firma')) {
    cont.append(divisorFijar('firma', 'Fijar firma'));
  }
}

/* ---------- Editables de la carta propia ----------------------- */

function pintarManifiestoEditable(items) {
  const cont = h('div', { class: 'manifiesto' });
  items.forEach((p, idx) => {
    const inputT = h('input', { value: p.titulo || '', placeholder: 'Título (opcional)', maxlength: 200 });
    const textarea = h('textarea', { placeholder: 'Contenido' }, p.contenido || '');
    inputT.addEventListener('input', () => { p.titulo = inputT.value; });
    textarea.addEventListener('input', () => { p.contenido = textarea.value; });
    cont.append(h('div', { class: 'pieza-edit' },
      inputT,
      textarea,
      h('div', { class: 'pieza-edit__botones' },
        h('button', {
          type: 'button', class: 'btn-mini',
          onclick: () => {
            registro.borrador.manifiesto.splice(idx, 1);
            pintar();
          },
        }, 'Eliminar')
      )
    ));
  });
  cont.append(h('button', {
    type: 'button', class: 'btn-secundario',
    onclick: () => {
      registro.borrador.manifiesto.push({ id: null, titulo: '', contenido: '' });
      pintar();
    },
  }, '+ Agregar párrafo'));
  return cont;
}

function pintarCompromisosEditables(items) {
  const ul = h('ul', { class: 'compromisos' });
  items.forEach((c, idx) => {
    const inputT = h('input', { value: c.titulo || '', placeholder: 'Título', maxlength: 200 });
    const textarea = h('textarea', { placeholder: 'Descripción' }, c.contenido || '');
    inputT.addEventListener('input', () => { c.titulo = inputT.value; });
    textarea.addEventListener('input', () => { c.contenido = textarea.value; });
    ul.append(h('li', { class: 'pieza-edit', style: 'list-style:none;' },
      inputT,
      textarea,
      h('div', { class: 'pieza-edit__botones' },
        h('button', {
          type: 'button', class: 'btn-mini',
          onclick: () => {
            registro.borrador.compromisos.splice(idx, 1);
            pintar();
          },
        }, 'Eliminar')
      )
    ));
  });
  ul.append(h('li', { style: 'list-style:none;' },
    h('button', {
      type: 'button', class: 'btn-secundario',
      onclick: () => {
        registro.borrador.compromisos.push({ id: null, titulo: '', contenido: '' });
        pintar();
      },
    }, '+ Agregar compromiso')
  ));
  return ul;
}

function pintarFirmaEditable(firma) {
  const valor = firma?.contenido || '';
  const input = h('input', { value: valor, placeholder: 'Firma', maxlength: 100 });
  input.addEventListener('input', () => {
    if (!registro.borrador.firma) registro.borrador.firma = { id: null, contenido: '' };
    registro.borrador.firma.contenido = input.value;
  });
  return h('div', { class: 'pieza-edit' }, input);
}

function divisorFijar(seccion, etiqueta) {
  return h('div', { class: 'fijar-seccion' },
    h('button', { type: 'button', onclick: () => fijarSeccion(seccion) }, etiqueta)
  );
}

/* ---------- Barra superior -------------------------------------- */

function pintarBarra(cont) {
  const barra = h('div', { class: 'vista__barra' });

  if (registro.pantalla === 'otro') {
    barra.append(
      h('button', {
        type: 'button', class: 'btn-secundario',
        onclick: () => {
          registro.pantalla = 'mio';
          registro.modo = 'vista';
          registro.borrador = null;
          registro.seccionesFijadas = new Set();
          registro.editandoAnexo = null;
          registro.editandoCompromisoCompartido = null;
          pintar();
        },
      }, 'Ver mi carta')
    );
  } else {
    barra.append(
      h('button', {
        type: 'button', class: 'btn-secundario',
        onclick: async () => {
          if (registro.modo === 'edicion') {
            const ok = await mostrarConfirmacion(
              'Salir de la edición',
              '¿Descartar los cambios sin fijar?',
              { textoConfirmar: 'Descartar' }
            );
            if (!ok) return;
            registro.borrador = null;
            registro.modo = 'vista';
            registro.seccionesFijadas = new Set();
          }
          registro.pantalla = 'otro';
          pintar();
        },
      }, 'Volver a la carta de ' + nombreOtro())
    );

    const vacia = cartaVacia(usuarioActual());

    if (registro.modo === 'vista' && !vacia) {
      barra.append(
        h('button', {
          type: 'button', class: 'btn-primario',
          onclick: entrarEdicion,
        }, 'Editar')
      );
    } else if (registro.modo === 'edicion') {
      barra.append(
        h('span', { class: 'vista__aviso-modo' }, 'Editando'),
        h('button', {
          type: 'button', class: 'btn-secundario',
          onclick: cancelarEdicion,
        }, 'Cancelar'),
        h('button', {
          type: 'button', class: 'btn-primario',
          onclick: fijarTodo,
        }, 'Fijar todo')
      );
    }
  }

  cont.append(barra);
}

/* ---------- Flujo de edición de la carta ----------------------- */

function entrarEdicion() {
  const propia = cartaDe(usuarioActual());
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
  const yo = usuarioActual();
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
  const yo = usuarioActual();
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
  if (!cartaVacia(usuarioActual())) return;
  if (cartaVacia(userIdOtro())) return;

  registro.toastMostrado = true;

  const toast = h('div', { class: 'carta-toast' },
    h('div', { class: 'carta-toast__texto' }, nombreOtro() + ' te dejó una carta. ¿Quieres dejarle un mensaje?'),
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
  const fd = new FormData(form);

  if (accion === 'crear-anexo') {
    const r = await repoCarta.crear({
      tipo: 'anexo',
      titulo: String(fd.get('titulo') || '').trim() || '(sin título)',
      contenido: String(fd.get('contenido') || '').trim(),
      orden: anexos().length,
    });
    if (r.exito) {
      form.reset();
      await refrescar();
      pintar();
    } else {
      pintarMensaje('error', r.error);
    }
  } else if (accion === 'crear-compartido') {
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
  const boton = ev.target.closest('button[data-accion]');
  if (!boton) return;
  const accion = boton.dataset.accion;
  const id = boton.dataset.id;

  if (accion === 'editar-anexo') {
    registro.editandoAnexo = id;
    registro.editandoCompromisoCompartido = null;
    pintar();
  } else if (accion === 'eliminar-anexo') {
    const ok = await mostrarConfirmacion(
      'Eliminar anexo',
      '¿Seguro que quieres eliminar este anexo?',
      { textoConfirmar: 'Eliminar' }
    );
    if (!ok) return;
    const r = await repoCarta.eliminar(id);
    if (r.exito) { await refrescar(); pintar(); }
    else pintarMensaje('error', r.error);
  } else if (accion === 'editar-compartido') {
    registro.editandoCompromisoCompartido = id;
    registro.editandoAnexo = null;
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
  } else if (accion === 'empezar-vacio') {
    empezarVacio();
  } else if (accion === 'cargar-guia') {
    cargarTextoGuia();
  }
}

/* ---------- Refresco y pintado --------------------------------- */

async function refrescar() {
  const r = await repoCarta.listar();
  if (!r.exito) {
    pintarMensaje('error', r.error);
    return;
  }
  registro.todas = r.datos;
}

function pintar() {
  const cont = registro.contenedor;
  if (!cont) return;
  limpiarContenedor(cont);

  const raiz = h('section', { id: 'vista-carta', class: 'vista vista--carta' });
  cont.append(raiz);
  registro.raiz = raiz;

  pintarBarra(raiz);
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
  registro.editandoAnexo = null;
  registro.editandoCompromisoCompartido = null;

  const { signal } = registro.abortador;
  contenedor.addEventListener('submit', manejarSubmit, { signal });
  contenedor.addEventListener('click', manejarClick, { signal });

  registro.desuscribir = [
    al('realtime:carta:crear', async () => { await refrescar(); pintar(); }),
    al('realtime:carta:actualizar', async () => { await refrescar(); pintar(); }),
    al('realtime:carta:eliminar', async () => { await refrescar(); pintar(); }),
  ];

  await refrescar();
  pintar();
}

export function limpiar() {
  registro.desuscribir.forEach((fn) => fn());
  registro.desuscribir = [];
  registro.abortador?.abort();
  registro.abortador = null;
  cerrarToast();
  if (registro.contenedor) limpiarContenedor(registro.contenedor);
  registro.todas = [];
  registro.borrador = null;
  registro.seccionesFijadas = new Set();
  registro.pantalla = 'otro';
  registro.modo = 'vista';
  registro.toastMostrado = false;
  registro.editandoAnexo = null;
  registro.editandoCompromisoCompartido = null;
  registro.contenedor = null;
  registro.raiz = null;
}