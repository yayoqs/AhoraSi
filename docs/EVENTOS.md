# EVENTOS.md — Catálogo de eventos de Ahora Sí

**Versión:** 1.0.0
**Fecha:** 25 de septiembre de 2026
**Propósito:** Catálogo canónico de eventos del sistema. Todo
evento que un módulo emite debe estar acá. Todo evento que una
vista consume debe estar acá. Si un evento no aparece en este
documento, no existe.
**Mantenedor:** Kiu.

---

## 1. Convenciones

- **Nombre del evento:** `modulo:accion`. Ejemplo: `planes:creado`.
- **Payload:** objeto plano con los datos del evento. Nunca
  `undefined` ni `null`.
- **Emisor:** módulo que llama a `emitir()`.
- **Consumidores:** módulos que llaman a `al()`.
- **Ciclo de vida:** cada suscripción devuelve una función para
  desuscribir. Se guarda en el registro del módulo y se ejecuta
  en `limpiar()`.

---

## 2. Eventos del núcleo

Emitidos por los módulos del directorio `js/nucleo/`.

### 2.1 Almacén

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `almacen:<clave>` | `almacen.js` | `{ valor, anterior }` | Cualquier módulo suscrito al cambio de una clave específica |
| `almacen:reiniciado` | `almacen.js` | *(sin payload)* | Módulos que necesitan saber cuándo se limpia el estado |

Ejemplos de `<clave>`: `usuarioActual`, `espacio`, `planes`, `kit`,
`hitos`, `carta`, `respuestas`, `fauna`, `flora`, `ritmos`,
`perfiles`, `perfil`, `cargando`, `error`.

### 2.2 Arranque de sesión

El módulo `js/arranque/sesion-inicial.js` v1.2.0 **no emite
eventos**. Devuelve un objeto con `exito`, `usuario`, `perfil`,
`espacio`, `motivo` y `detalle`. El shell consume ese retorno
directamente. No requiere suscripción.

---

## 3. Eventos de sesión

Emitidos por `js/datos/sesion.js`.

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `sesion:iniciada` | `sesion.js` | `usuario` (objeto Appwrite) | Módulos que reaccionan al login |
| `sesion:cargada` | `sesion.js` | `usuario` (objeto Appwrite) | Módulos que reaccionan a sesión persistente |
| `sesion:cerrada` | `sesion.js` | *(sin payload)* | Módulos que reaccionan al logout |

---

## 4. Eventos de Realtime

Emitidos por `js/datos/realtime.js`.

### 4.1 Evento genérico

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `realtime:cambio` | `realtime.js` | `{ clave, accion, fila }` | Cualquier módulo que quiera recibir todos los cambios sin importar la tabla |

`accion` es uno de: `crear`, `actualizar`, `eliminar`.

### 4.2 Eventos por tabla

Para cada tabla suscrita, `realtime.js` emite también dos eventos
específicos:

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `realtime:<clave>:crear` | `realtime.js` | `fila` (objeto) | Vistas de esa tabla |
| `realtime:<clave>:actualizar` | `realtime.js` | `fila` (objeto) | Vistas de esa tabla |
| `realtime:<clave>:eliminar` | `realtime.js` | `fila` (objeto) | Vistas de esa tabla |

`<clave>` puede ser: `planes`, `kit`, `hitos`, `carta`, `respuestas`,
`fauna`, `flora`, `ritmos`.

**Consumidores por tabla:**

- `planes`: `js/vistas/planes.js`
- `kit`: `js/vistas/kit.js`
- `hitos`: `js/vistas/hitos.js`
- `carta`: `js/vistas/carta.js`
- `respuestas`: `js/vistas/respuesta.js` (solo `crear`)
- `fauna`: `js/vistas/fauna.js`
- `flora`: `js/vistas/flora.js`
- `ritmos`: `js/vistas/percusion.js` (solo `crear` y `eliminar`)

---

## 5. Eventos de repositorios

Emitidos por `js/datos/repositorios/*.js`. Se emiten después de
que la operación de escritura en Appwrite fue exitosa.

### 5.1 Planes

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `planes:creado` | `planes.js` | `plan` (objeto normalizado) | Vistas, tests |
| `planes:actualizado` | `planes.js` | `plan` (objeto normalizado) | Vistas, tests |
| `planes:eliminado` | `planes.js` | `{ id }` | Vistas, tests |

### 5.2 Kit

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `kit:creado` | `kit.js` | `item` (objeto normalizado) | Vistas, tests |
| `kit:actualizado` | `kit.js` | `item` (objeto normalizado) | Vistas, tests |
| `kit:eliminado` | `kit.js` | `{ id }` | Vistas, tests |

### 5.3 Hitos

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `hitos:creado` | `hitos.js` | `hito` (objeto normalizado) | Vistas, tests |
| `hitos:actualizado` | `hitos.js` | `hito` (objeto normalizado) | Vistas, tests |
| `hitos:eliminado` | `hitos.js` | `{ id }` | Vistas, tests |

### 5.4 Carta

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `carta:creado` | `carta.js` | `pieza` (objeto normalizado) | Vistas, tests |
| `carta:eliminado` | `carta.js` | `{ id }` | Vistas, tests |

### 5.5 Respuestas

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `respuestas:creada` | `respuestas.js` | `respuesta` (objeto normalizado) | Vistas, tests |

### 5.6 Fauna

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `fauna:creado` | `fauna.js` | `registro` (objeto normalizado) | Vistas, tests |
| `fauna:eliminado` | `fauna.js` | `{ id }` | Vistas, tests |

### 5.7 Flora

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `flora:creado` | `flora.js` | `registro` (objeto normalizado) | Vistas, tests |
| `flora:eliminado` | `flora.js` | `{ id }` | Vistas, tests |

### 5.8 Ritmos

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `ritmos:creado` | `ritmos.js` | `ritmo` (objeto normalizado) | Vistas, tests |
| `ritmos:eliminado` | `ritmos.js` | `{ id }` | Vistas, tests |

### 5.9 Perfiles

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `perfiles:creado` | `perfiles.js` | `perfil` (objeto normalizado) | Arranque, tests |
| `perfiles:actualizado` | `perfiles.js` | `perfil` (objeto normalizado) | Arranque, tests |
| `perfiles:eliminado` | `perfiles.js` | `{ id }` | Arranque, tests |

### 5.10 Espacios

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `espacios:creado` | `espacios.js` | `espacio` (objeto normalizado) | Arranque, tests |
| `espacios:eliminado` | `espacios.js` | `{ id }` | Arranque, tests |

---

## 6. Formato del payload normalizado

Cada repositorio normaliza la fila de Appwrite antes de emitirla.
Los objetos llevan `id` (sin `$`), y los timestamps van como
`creadoEn` y `actualizadoEn`.

Ejemplo del payload de `planes:creado`:

    {
      id: 'plan_xxxxx',
      espacioId: 'esp_xxxxx',
      titulo: 'Ir al cerro',
      descripcion: '',
      cuando: '',
      estado: 'pendiente',
      creadoPor: 'Elyayo',
      creadoEn: '2026-09-25T...',
      actualizadoEn: '2026-09-25T...'
    }

---

## 7. Cómo suscribirse

    import { al } from '../nucleo/bus-eventos.js';

    const desuscribir = al('planes:creado', (plan) => {
      console.log('Nuevo plan:', plan.titulo);
    });

    // Al limpiar la vista:
    desuscribir();

Las vistas guardan las funciones de desuscribir en un array y las
ejecutan todas en `limpiar()`.

---

## 8. Cómo emitir

    import { emitir } from '../nucleo/bus-eventos.js';

    emitir('planes:creado', plan);

Reglas:

1. El nombre debe seguir `modulo:accion`.
2. El payload debe ser un objeto. Nunca `undefined`.
3. Se emite **después** de que la operación de escritura fue
   exitosa. Nunca antes.
4. Se documenta acá antes de agregarlo al código.

---

## 9. Eventos que NO existen

Estos eventos fueron considerados y descartados explícitamente:

- **`arranque:listo`, `arranque:sin-sesion`, `arranque:error`.**
  El arranque usa un retorno directo en `sesion-inicial.js`. No
  emite eventos. Si en el futuro se necesita notificar al shell
  de forma asíncrona, se evalúa reintroducirlos.

- **`productos:*`, `comandas:*`, `mesas:*`, `turno:*`.**
  Son eventos de un POS. Ahora Sí no es un POS y no tiene esos
  conceptos.

---

*Documento mantenido por Kiu.*
*Versión 1.0.0 — 25 de septiembre de 2026*