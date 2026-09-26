/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/arranque/carta-inicial.js
   Versión: 1.0.0
   Propósito: siembra la carta base de Yayo la primera vez que
              entra. Crea manifiesto (cuatro párrafos), cuatro
              compromisos personales y la firma. Si ya existe
              cualquier pieza tipo 'base' con autor = Yayo, no
              siembra nada. Idempotente.
              v1.0.0: versión inicial.
   ================================================================ */

import { CONFIG } from '../config/config.js';
import { listar, crear } from '../datos/repositorios/carta.js';
import { crearLogger } from '../nucleo/logger.js';

const log = crearLogger('arranque:carta-inicial');

const MANIFIESTO = [
  {
    titulo: 'Idas y vueltas',
    contenido: 'Sé que lo nuestro ha tenido idas y vueltas, y no te voy a decir que no. Lo que sí sé es que te tengo mucho cariño y que contigo quiero hacer las cosas bien.',
  },
  {
    titulo: 'Sin presión',
    contenido: 'Esta página no es una presión ni una pregunta con fecha límite. Es mi forma de mostrarte, con lo que sé hacer, que lo pienso en serio.',
  },
  {
    titulo: 'Como eres',
    contenido: 'Me gusta cómo eres: libre, curiosa, con las manos siempre metidas en algo, sea un tambor, un circuito o una máquina de barbero. No quiero que cambies nada de eso.',
  },
  {
    titulo: 'Sin apuro',
    contenido: 'Tómate el tiempo que necesites. Lo que hay aquí sigue en pie igual.',
  },
];

const COMPROMISOS = [
  { titulo: 'Decirte las cosas de frente', contenido: 'Incluso las incómodas, y a tiempo.' },
  { titulo: 'Respetar tu libertad', contenido: 'Tus viajes, tu música, tu trabajo y tus espacios a solas.' },
  { titulo: 'Cumplir lo que propongo', contenido: 'Si no puedo, aviso con tiempo y propongo otra fecha.' },
  { titulo: 'Constancia, no impulsos', contenido: 'Que esto se note en los días normales, no solo en los buenos.' },
];

const FIRMA = 'Yayo';

export async function asegurarCartaDeYayo(usuarioId) {
  if (usuarioId !== CONFIG.usuarios.yayo) return;

  const rLista = await listar();
  if (!rLista.exito) {
    log.warn('No se pudo listar la carta:', rLista.error);
    return;
  }

  const yaTiene = rLista.datos.some(
    (p) => p.tipo === 'base' && p.autor === usuarioId
  );
  if (yaTiene) {
    log.info('Carta de Yayo ya existe, no se siembra.');
    return;
  }

  log.info('Sembrando carta inicial de Yayo.');

  let orden = 0;
  for (const p of MANIFIESTO) {
    const r = await crear({ tipo: 'base', titulo: p.titulo, contenido: p.contenido, orden: orden++ });
    if (!r.exito) log.warn('No se pudo crear párrafo:', r.error);
  }
  for (const c of COMPROMISOS) {
    const r = await crear({ tipo: 'compromiso', titulo: c.titulo, contenido: c.contenido, orden: orden++ });
    if (!r.exito) log.warn('No se pudo crear compromiso:', r.error);
  }
  const rf = await crear({ tipo: 'firma', titulo: 'Firma', contenido: FIRMA, orden: 999 });
  if (!rf.exito) log.warn('No se pudo crear firma:', rf.error);

  log.info('Carta de Yayo sembrada.');
}