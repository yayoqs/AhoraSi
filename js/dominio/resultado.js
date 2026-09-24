/* ================================================================
   Ahora Sí — MÓDULO JS (ES6)
   Archivo: js/dominio/resultado.js
   Versión: 1.0.0
   Propósito: tipo Resultado para manejo funcional de errores.
              Cada operación que puede fallar devuelve un
              Resultado con exito (boolean), datos (payload) y
              error (mensaje). Permite encadenar operaciones sin
              try/catch anidados.
   ================================================================ */

export class Resultado {
  constructor(exito, datos = null, error = null) {
    this.exito = exito;
    this.datos = datos;
    this.error = error;
    Object.freeze(this);
  }

  static ok(datos = null) {
    return new Resultado(true, datos, null);
  }

  static fallo(error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return new Resultado(false, null, mensaje);
  }

  encadenar(fn) {
    if (!this.exito) return this;
    try {
      const siguiente = fn(this.datos);
      if (siguiente instanceof Resultado) return siguiente;
      return Resultado.ok(siguiente);
    } catch (e) {
      return Resultado.fallo(e);
    }
  }

  mapear(fn) {
    if (!this.exito) return this;
    try {
      return Resultado.ok(fn(this.datos));
    } catch (e) {
      return Resultado.fallo(e);
    }
  }

  recuperar(fn) {
    if (this.exito) return this;
    try {
      const siguiente = fn(this.error);
      if (siguiente instanceof Resultado) return siguiente;
      return Resultado.ok(siguiente);
    } catch (e) {
      return Resultado.fallo(e);
    }
  }
}