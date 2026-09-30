# EVENTOS.md — Catálogo de eventos de Ahora Sí

**Versión:** 2.2.0
**Fecha:** 30 de septiembre de 2026
**Propósito:** Catálogo canónico de eventos del sistema. Todo evento que un módulo emite debe estar acá. Todo evento que una vista consume debe estar acá. Si un evento no aparece en este documento, no existe.
**Mantenedor:** Kiu.

---

## 1. Convenciones

- **Nombre del evento:** `modulo:accion`. Ejemplo: `planes:creado`.
- **Payload:** objeto plano con los datos del evento. Nunca `undefined` ni `null`.
- **Emisor:** módulo que llama a `emitir()`.
- **Consumidores:** módulos que llaman a `al()`.
- **Ciclo de vida:** cada suscripción devuelve una función para desuscribir. Se guarda en el registro del módulo y se ejecuta en `limpiar()`.

---

## 2. Eventos del núcleo

Emitidos por los módulos del directorio `js/nucleo/`.

### 2.1 Almacén

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `almacen:<clave>` | `almacen.js` | `{ valor, anterior }` | Cualquier módulo suscrito al cambio de una clave específica |
| `almacen:reiniciado` | `almacen.js` | *(sin payload)* | Módulos que necesitan saber cuándo se limpia el estado |

Claves vigentes en el almacén:

| Clave | Tipo | Quién la escribe | Quién la lee |
|-------|------|------------------|---------------|
| `usuarioActual` | objeto Appwrite | `sesion-inicial.js`, `sesion.js` | repositorios vía `_contexto.js` |
| `perfil` | objeto perfil | `sesion-inicial.js`, `cuenta.js` | `app.js` (title del botón cuenta), `cuenta.js` |
| `espacio` | objeto espacio | `sesion-inicial.js`, `espacio-inicial.js` | repositorios vía `_contexto.js` |
| `planes` | array | (no usado hoy; el repo lista directo) | — |
| `kit` | array | (no usado hoy) | — |
| `hitos` | array | (no usado hoy) | — |
| `carta` | array | (no usado hoy) | — |
| `respuestas` | array | (no usado hoy) | — |
| `fauna` | array | (no usado hoy) | — |
| `flora` | array | (no usado hoy) | — |
| `ritmos` | array | (no usado hoy) | — |
| `modoNoche` | boolean | `app.js` (al arrancar), `cuenta.js` (toggle) | `app.js` (aplica la clase al body) |
| `cargando` | boolean | (no usado hoy) | — |
| `error` | string/null | (no usado hoy) | — |

**Consumidores activos notables:**

- `almacen:perfil` → `app.js` (actualiza el nombre visible en el botón de cuenta).
- `almacen:modoNoche` → `app.js` (aplica o quita la clase `modo-noche` en el body).

### 2.2 Arranque

Los módulos de arranque (`sesion-inicial.js`, `espacio-inicial.js`, `carta-inicial.js`, `ideas-iniciales.js`) **no emiten eventos**. Devuelven objetos con `exito`, `usuario`, `perfil`, `espacio`, `motivo` y `detalle`. El shell consume el retorno directamente.

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

Para cada tabla suscrita, `realtime.js` emite también un evento específico por acción:

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `realtime:<clave>:crear` | `realtime.js` | `fila` (objeto) | Vistas de esa tabla |
| `realtime:<clave>:actualizar` | `realtime.js` | `fila` (objeto) | Vistas de esa tabla |
| `realtime:<clave>:eliminar` | `realtime.js` | `fila` (objeto) | Vistas de esa tabla |

### 4.3 Tablas suscritas

`<clave>` puede ser cualquiera de las siguientes:

| Clave | Tabla Appwrite | Vista consumidora |
|-------|----------------|-------------------|
| `planes` | `ahorasi_planes` | `js/vistas/planes.js`, `js/vistas/ideas.js` |
| `kit` | `ahorasi_kit` | `js/vistas/kit.js` |
| `hitos` | `ahorasi_hitos` | `js/vistas/hitos.js` |
| `carta` | `ahorasi_carta` | `js/vistas/carta.js` |
| `respuestas` | `ahorasi_respuestas` | `js/vistas/carta.js` (solo `crear`) |
| `fauna` | `ahorasi_fauna` | `js/vistas/fauna.js` |
| `flora` | `ahorasi_flora` | `js/vistas/flora.js` |
| `ritmos` | `ahorasi_ritmos` | `js/vistas/percusion.js` (solo `crear` y `eliminar`) |
| `fotos` | `ahorasi_fotos` | `js/vistas/fauna.js`, `js/vistas/flora.js` |
| `lugares` | `ahorasi_lugares` | `js/vistas/mapa.js` |
| `series` | `ahorasi_series` | `js/vistas/series.js` |
| `retos` | `ahorasi_retos` | `js/vistas/retos.js`, `js/vistas/juegos.js` (hub) |
| `penitencias` | `ahorasi_penitencias` | `js/vistas/penitencias.js`, `js/vistas/juegos.js` (hub) |
| `preguntas` | `ahorasi_preguntas` | `js/vistas/preguntas.js`, `js/vistas/juegos.js` (hub) |
| `apuestas` | `ahorasi_apuestas` | `js/vistas/apuestas.js`, `js/vistas/juegos.js` (hub) |
| `chistes` | `ahorasi_chistes` | `js/vistas/chistes.js`, `js/vistas/juegos.js` (hub) |
| `recetas` | `ahorasi_recetas` | `js/vistas/recetas.js` |

**Nota:** la vista de Juegos es solo un hub de navegación. Se suscribe a las cinco tablas de los mini-juegos para refrescar los contadores del hub, no para mostrar datos.

---

## 5. Eventos de repositorios

Emitidos por `js/datos/repositorios/*.js`. Se emiten **después** de que la operación de escritura en Appwrite fue exitosa.

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

**Nota:** el repositorio v1.8.0 eliminó la función `marcar()`. El campo `cumplido` de la tabla sigue existiendo pero el normalizador lo ignora. El único evento que emite `actualizar` es `hitos:actualizado`.

### 5.4 Carta

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `carta:creado` | `carta.js` | `pieza` (objeto normalizado) | Vistas, tests |
| `carta:actualizado` | `carta.js` | `pieza` (objeto normalizado) | Vistas, tests |
| `carta:eliminado` | `carta.js` | `{ id }` | Vistas, tests |

**Tipos de carta:** `base`, `anexo`, `compromiso`, `compromiso_compartido`, `firma`.

### 5.5 Respuestas

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `respuestas:creada` | `respuestas.js` | `respuesta` (objeto normalizado) | Vistas, tests |

### 5.6 Fauna

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `fauna:creado` | `fauna.js` | `registro` (objeto normalizado) | Vistas, tests |
| `fauna:actualizado` | `fauna.js` | `registro` (objeto normalizado) | Vistas, tests |
| `fauna:eliminado` | `fauna.js` | `{ id }` | Vistas, tests |

### 5.7 Flora

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `flora:creado` | `flora.js` | `registro` (objeto normalizado) | Vistas, tests |
| `flora:actualizado` | `flora.js` | `registro` (objeto normalizado) | Vistas, tests |
| `flora:eliminado` | `flora.js` | `{ id }` | Vistas, tests |

### 5.8 Ritmos

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `ritmos:creado` | `ritmos.js` | `ritmo` (objeto normalizado) | Vistas, tests |
| `ritmos:eliminado` | `ritmos.js` | `{ id }` | Vistas, tests |

**Nota:** el repo de ritmos no expone `actualizar()`. Solo crear y eliminar. Un ritmo guardado no se edita; se borra y se guarda de nuevo.

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

### 5.11 Fotos

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `fotos:creada` | `fotos.js` | `foto` (objeto normalizado) | Vistas de fauna, flora |
| `fotos:eliminada` | `fotos.js` | `{ id, fileId }` | Vistas de fauna, flora |

**Nota:** no existe `fotos:actualizada`. Una foto se borra y se sube de nuevo.

### 5.12 Lugares

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `lugares:creado` | `lugares.js` | `lugar` (objeto normalizado) | Vistas, tests |
| `lugares:actualizado` | `lugares.js` | `lugar` (objeto normalizado) | Vistas, tests |
| `lugares:eliminado` | `lugares.js` | `{ id }` | Vistas, tests |

### 5.13 Series

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `series:creado` | `series.js` | `serie` (objeto normalizado) | Vistas, tests |
| `series:actualizado` | `series.js` | `serie` (objeto normalizado) | Vistas, tests |
| `series:eliminado` | `series.js` | `{ id }` | Vistas, tests |
| `series:reordenado` | `series.js` | `{ ids: [...] }` | Vistas, tests |

**Nota:** `series:reordenado` se emite una sola vez al final de una operación de reordenamiento por drag&drop, no una vez por fila.

### 5.14 Retos

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `retos:creado` | `retos.js` | `reto` (objeto normalizado) | Vistas, tests |
| `retos:actualizado` | `retos.js` | `reto` (objeto normalizado) | Vistas, tests |
| `retos:eliminado` | `retos.js` | `{ id }` | Vistas, tests |

### 5.15 Penitencias

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `penitencias:creado` | `penitencias.js` | `penitencia` (objeto normalizado) | Vistas, tests |
| `penitencias:actualizado` | `penitencias.js` | `penitencia` (objeto normalizado) | Vistas, tests |
| `penitencias:eliminado` | `penitencias.js` | `{ id }` | Vistas, tests |

### 5.16 Preguntas

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `preguntas:creado` | `preguntas.js` | `pregunta` (objeto normalizado) | Vistas, tests |
| `preguntas:eliminado` | `preguntas.js` | `{ id }` | Vistas, tests |

**Nota:** las preguntas no se editan, solo se crean y se eliminan.

### 5.17 Apuestas

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `apuestas:creado` | `apuestas.js` | `apuesta` (objeto normalizado) | Vistas, tests |
| `apuestas:actualizado` | `apuestas.js` | `apuesta` (objeto normalizado) | Vistas, tests |
| `apuestas:eliminado` | `apuestas.js` | `{ id }` | Vistas, tests |

**Nota:** `actualizado` se emite también al resolver una apuesta.

### 5.18 Chistes

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `chistes:creado` | `chistes.js` | `chiste` (objeto normalizado) | Vistas, tests |
| `chistes:eliminado` | `chistes.js` | `{ id }` | Vistas, tests |

### 5.19 Recetas

| Evento | Emisor | Payload | Consumidores |
|--------|--------|---------|--------------|
| `recetas:creado` | `recetas.js` | `receta` (objeto normalizado) | Vistas, tests |
| `recetas:actualizado` | `recetas.js` | `receta` (objeto normalizado) | Vistas, tests |
| `recetas:eliminado` | `recetas.js` | `{ id }` | Vistas, tests |

---

## 6. Formato del payload normalizado

Cada repositorio normaliza la fila de Appwrite antes de emitirla. Los objetos llevan `id` (sin `$`), y los timestamps van como `creadoEn` y `actualizadoEn` cuando corresponde.

### 6.1 Ejemplo: `planes:creado`

    {
      id: 'plan_xxxxx',
      espacioId: 'esp_xxxxx',
      titulo: 'Ir al cerro',
      descripcion: '',
      cuando: '',
      estado: 'pendiente',
      esIdea: false,
      categoria: '',
      creadoPor: 'Elyayo',
      creadoEn: '2026-09-25T...',
      actualizadoEn: '2026-09-25T...'
    }

### 6.2 Ejemplo: `carta:creado` (tipo `base`)

    {
      id: 'carta_xxxxx',
      espacioId: 'esp_xxxxx',
      tipo: 'base',
      titulo: 'Idas y vueltas',
      contenido: 'Sé que lo nuestro ha tenido...',
      autor: 'Elyayo',
      orden: 0,
      creadoEn: '2026-09-25T...'
    }

### 6.3 Ejemplo: `fotos:creada`

    {
      id: 'fotos_xxxxx',
      fileId: 'foto_xxxxx',
      tabla: 'ahorasi_fauna',
      filaId: 'fauna_xxxxx',
      espacioId: 'esp_xxxxx',
      subidoPor: 'Elyayo',
      creadoEn: '2026-09-25T...'
    }

### 6.4 Ejemplo: `series:reordenado`

    {
      ids: ['serie_a', 'serie_b', 'serie_c']
    }

El orden va de arriba hacia abajo.

### 6.5 Ejemplo: `recetas:creado`

    {
      id: 'receta_xxxxx',
      espacioId: 'esp_xxxxx',
      titulo: 'Pan amasado',
      categoria: 'Desayuno',
      ingredientes: [ { tipo: 'simple', texto: '1 kg de harina' }, ... ],
      pasos: [ 'Disolver la levadura...', ... ],
      nota: 'El secreto es no amasar de más.',
      fotos: ['https://...'],
      creadoPor: 'Elyayo',
      creadoEn: '2026-09-25T...'
    }

### 6.6 Ejemplo: `ritmos:creado` (modo extendido, con mezcla y efectos)

    {
      id: 'ritmo_xxxxx',
      espacioId: 'esp_xxxxx',
      nombre: 'Tumbé de prueba',
      bpm: 110,
      patron: [
        [3,0,0,0, 0,0,2,0, 0,0,0,0, 0,0,0,0],
        ... 7 filas de 16 pasos ...
      ],
      modo: 'extendido',
      estiloId: 'tumbe',
      familia: 'afr',
      efectos: { reverb: 24, eco: 20, saturacion: 15, filtro: 100 },
      volumen: [1, 0.8, 0.8, 0.6, 0.55, 0.9, 0.55],
      silenciados: [false, false, false, false, false, false, false],
      solistas: [false, false, false, false, false, false, false],
      swing: 18,
      creadoPor: 'Elyayo',
      creadoEn: '2026-09-30T...'
    }

**Nota:** `efectos`, `volumen`, `silenciados`, `solistas` y `swing` se agregaron en la v1.6.0 del repositorio. Los ritmos guardados antes de esa versión devuelven `null` en esos campos; la vista los restituye con los defaults del estilo o del modo.

### 6.7 Ejemplo: `ritmos:creado` (modo simple)

    {
      id: 'ritmo_xxxxx',
      espacioId: 'esp_xxxxx',
      nombre: 'Rap underground',
      bpm: 90,
      patron: [
        { sonidoId: 'bombo_gordo', pasos: [3,0,2,0, 0,0,2,0] },
        { sonidoId: 'caja_seca',   pasos: [0,0,2,0, 0,0,2,0] },
        { sonidoId: 'hh_cerrado',  pasos: [2,2,2,2, 2,2,2,2] },
        { sonidoId: 'clap',        pasos: [0,0,3,0, 0,0,3,0] }
      ],
      modo: 'simple',
      estiloId: '',
      familia: '',
      efectos: null,
      volumen: null,
      silenciados: null,
      solistas: null,
      swing: 0,
      creadoPor: 'Elyayo',
      creadoEn: '2026-09-30T...'
    }

**Nota:** en modo simple, los campos de mezcla y efectos van en `null`. El modo simple no tiene efectos globales ni control de mezcla por voz.

---

## 7. Cómo suscribirse

    import { al } from '../nucleo/bus-eventos.js';

    const desuscribir = al('planes:creado', (plan) => {
      console.log('Nuevo plan:', plan.titulo);
    });

    // Al limpiar la vista:
    desuscribir();

Las vistas guardan las funciones de desuscribir en un array y las ejecutan todas en `limpiar()`.

**Ejemplo completo con el patrón de vistas:**

    registro.desuscribir = [
      al('realtime:planes:crear', refrescar),
      al('realtime:planes:actualizar', refrescar),
      al('realtime:planes:eliminar', refrescar),
    ];

---

## 8. Cómo emitir

    import { emitir } from '../nucleo/bus-eventos.js';

    emitir('planes:creado', plan);

**Reglas:**

1. El nombre sigue `modulo:accion`.
2. El payload es un objeto. Nunca `undefined`.
3. Se emite **después** de que la operación de escritura fue exitosa. Nunca antes.
4. Se documenta acá antes de agregarlo al código.

---

## 9. Eventos que NO existen

Estos eventos fueron considerados y descartados explícitamente:

- **`arranque:listo`, `arranque:sin-sesion`, `arranque:error`.** El arranque usa un retorno directo en `sesion-inicial.js`. No emite eventos. Si en el futuro se necesita notificar al shell de forma asíncrona, se evalúa reintroducirlos.
- **`productos:*`, `comandas:*`, `mesas:*`, `turno:*`.** Son eventos de un POS. Ahora Sí no es un POS y no tiene esos conceptos.
- **`fotos:actualizada`.** Una foto no se edita. Se borra y se sube de nuevo.
- **`preguntas:actualizado`.** Las preguntas no se editan. Se crean y se eliminan.
- **`ritmos:actualizado`.** Los ritmos guardados no se editan desde la UI. Se borran y se guardan de nuevo.
- **`hitos:cumplido`.** El campo `cumplido` de hitos está deprecado desde la v1.7.0 del repositorio. La función `marcar()` fue eliminada en v1.8.0. No se emite ningún evento relacionado.
- **`app:cerrar-sesion`.** No es un evento. Es un **comando** del bus de comandos. Ver sección 10.

---

## 10. Comandos registrados

El bus de comandos (`js/nucleo/bus-comandos.js`) es un canal síncrono, separado del bus de eventos. Un módulo registra un comando; otro lo ejecuta y recibe el resultado. Se usa para operaciones puntuales que no necesitan emitir notificación.

Comandos vigentes:

| Comando | Registrado en | Ejecutado por | Qué hace |
|---------|---------------|----------------|----------|
| `app:cerrar-sesion` | `app.js` | `cuenta.js` | Muestra el diálogo de confirmación, detiene Realtime, cierra la sesión y recarga la app |

**Reglas del bus de comandos:**

1. `registrar(nombre, manejador)` — un solo manejador por nombre. Si se registra dos veces, se sobrescribe (con warning en consola).
2. `ejecutar(nombre, ...args)` — lanza excepción si el comando no existe.
3. `existe(nombre)` — boolean.
4. `desregistrar(nombre)` — lo elimina.
5. No hay desuscripción automática. Los comandos viven mientras la app viva.

**Cuándo usar comandos en vez de eventos:**

- El llamador necesita un valor de retorno.
- El llamador necesita esperar a que la operación termine.
- La operación es una acción puntual, no un cambio de estado global.

**Cuándo usar eventos en vez de comandos:**

- El emisor no sabe quién va a reaccionar.
- Cualquier cantidad de suscriptores puede reaccionar.
- La operación es un cambio de estado que interesa a varios módulos.

---

## 11. Cómo NO suscribirse

Errores comunes que hay que evitar:

1. **No suscribirse sin guardar la función de desuscripción.** Si no se limpia en `limpiar()`, el listener queda vivo y el próximo `activar()` duplica suscriptores.
2. **No suscribirse dentro de un bucle sin salida.** Un `al()` dentro de un `.forEach()` que se ejecuta cada vez que se pinta la vista deja listeners acumulados.
3. **No emitir con `undefined` de payload.** El contrato dice objeto. Si no hay datos, `{}`.
4. **No emitir antes de que la escritura se confirme.** Un evento que dice "se creó" cuando todavía no se creó genera falsos positivos.
5. **No usar el bus de eventos para llamar a métodos de otro módulo de vista.** Para eso está el bus de comandos.

---

*Documento mantenido por Kiu.*
*Versión 2.2.0 — 30 de septiembre de 2026*