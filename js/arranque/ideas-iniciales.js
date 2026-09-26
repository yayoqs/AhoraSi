/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/arranque/ideas-iniciales.js
   Versión: 1.0.0
   Propósito: siembra las ideas iniciales la primera vez que
              arranca el espacio. Las ideas son del espacio (no
              se filtran por autor). Si ya existe cualquier fila
              con esIdea = true, no siembra nada. Idempotente.
              v1.0.0: versión inicial.
   ================================================================ */

import { listarIdeas, crear } from '../datos/repositorios/planes.js';
import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('arranque:ideas-iniciales');

const IDEAS = [
  {
    categoria: 'Percusión',
    titulo: 'Pad de percusión hecho a mano',
    descripcion: 'Un pad con sensores piezo y una placa Arduino o ESP32 para tocar sonidos de tumbe desde cualquier superficie.',
  },
  {
    categoria: 'Percusión',
    titulo: 'Semibatucada al aire libre',
    descripcion: 'Grabar un ritmo tuyo en plena montaña y montarlo con lo que capturemos de los pájaros.',
  },
  {
    categoria: 'Electrónica',
    titulo: 'Grabadora de cantos de aves',
    descripcion: 'Un dispositivo con micrófono que deje grabando al amanecer para identificar después qué pajaritos pasaron.',
  },
  {
    categoria: 'Electrónica',
    titulo: 'Energía solar para el campamento',
    descripcion: 'Un pequeño sistema con panel, batería y luces hecho por nosotros.',
  },
  {
    categoria: 'Naturaleza',
    titulo: 'Mapa de nuestras rutas',
    descripcion: 'Cada salida queda como un punto en un mapa, con lo que vimos, escuchamos y comimos.',
  },
  {
    categoria: 'Naturaleza',
    titulo: 'Amanecer planificado',
    descripcion: 'Calcular hora exacta de salida del sol, clima y mejor punto para verlo.',
  },
  {
    categoria: 'Viajes',
    titulo: 'Mapa de viajes pendientes',
    descripcion: 'Una lista de destinos con presupuesto estimado y fechas posibles, para que los viajes dejen de ser algún día.',
  },
  {
    categoria: 'Tu trabajo',
    titulo: 'Sistema de citas para tu barbería',
    descripcion: 'Una página sencilla, hecha a tu medida, para que tus clientes reserven y tú controles caja y agenda.',
  },
  {
    categoria: 'Tu trabajo',
    titulo: 'Tablero de números de tu negocio',
    descripcion: 'Ingresos, gastos y horarios pico, para practicar administración con datos reales tuyos.',
  },
];

export async function asegurarIdeasIniciales(usuarioId) {
  if (!usuarioId) return;

  const rLista = await listarIdeas();
  if (!rLista.exito) {
    log.warn('No se pudieron listar las ideas:', rLista.error);
    return;
  }

  if (rLista.datos.length > 0) {
    log.info('Ya hay ideas en el espacio, no se siembra.');
    return;
  }

  log.info('Sembrando ideas iniciales.');

  for (const idea of IDEAS) {
    const r = await crear({
      titulo: idea.titulo,
      descripcion: idea.descripcion,
      categoria: idea.categoria,
      esIdea: true,
      estado: 'pendiente',
      cuando: '',
    });
    if (!r.exito) {
      log.warn('No se pudo crear idea:', idea.titulo, '-', r.error);
    }
  }

  log.info('Ideas iniciales sembradas.');
}