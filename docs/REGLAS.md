# REGLAS.md — Reglas y decisiones de Ahora Sí

**Versión:** 1.0.0
**Fecha:** 25 de septiembre de 2026
**Propósito:** Reglas duras del proyecto y decisiones de
arquitectura ya tomadas. Si algo de acá se rompe, es una
regresión y hay que arreglarlo antes de seguir.
**Mantenedor:** Kiu.

---

## 1. Qué es este proyecto

Una app personal para Kiu y Luci. Un espacio compartido para
planificar salidas, llevar registros y construir cosas juntos. No
es comercial, no es multiusuario, no es un POS. Es una app de
dos.

Está servida desde GitHub Pages en `ahorasi.elisekai.com` y usa
Appwrite Cloud para el backend.

---

## 2. Reglas de idioma

### 2.1 Español neutro o chileno suave

Todo el código propio va en español. Variables, funciones,
clases, métodos, eventos, nombres de archivos, constantes
propias, mensajes de log, textos de UI.

Los modismos chilenos suaves son aceptables: "cachái", "dale",
"al tiro", "po". Los modismos argentinos no son aceptables bajo
ninguna circunstancia: ni voseo (`querés`, `tenés`, `podés`,
`usás`, `confirmás`), ni léxico (`boludo`, `che`, `güey`), ni
construcciones propias del Río de la Plata.

Cuando hay duda, se usa español neutro. Cuando el modismo
chileno aporta cercanía y no suena forzado, se usa.

### 2.2 APIs externas conservan su idioma

`createRow`, `listRows`, `setEndpoint`, `deleteSession`,
`createEmailPasswordSession`. No se traducen. Pero los
envoltorios propios sí: `listar()`, `crear()`, `actualizar()`.

---

## 3. Reglas de código

### 3.1 Módulos ES6

Cada archivo importa explícitamente lo que necesita y exporta lo
que ofrece. Sin variables globales sueltas. Sin `window.X = ...`.
Única excepción: SDKs externos como `appwrite.min.js`, que se
cargan como `<script>` clásico y exponen `window.Appwrite`.

### 3.2 Exportaciones con nombre

Sin `export default`. Cada símbolo tiene nombre explícito. Se
importa con `import { nombre } from '...'` o
`import * as modulo from '...'`.

### 3.3 Sin `var`

Solo `const` y `let`. Nunca `var`.

### 3.4 Sin `onclick` en HTML

Los eventos se manejan con `addEventListener` o delegación por
`data-accion`. Nunca `onclick="..."` ni `onchange="..."`.

### 3.5 Ciclo de vida de vistas

Cada módulo de vista expone `activar(contenedor)` y `limpiar()`.
`activar()` monta la vista en el contenedor recibido. `limpiar()`
libera listeners, aborta operaciones en curso, y vacía el
contenedor.

### 3.6 AbortController para listeners del DOM

Al activar una vista, se crea un `AbortController`. Todos los
`addEventListener` reciben la señal. Al limpiar, se llama
`controller.abort()`. Esto evita listeners huérfanos.

### 3.7 Suscripciones con desuscripción

`bus-eventos.al()` devuelve una función para desuscribir. Se
guarda en el registro del módulo y se ejecuta en `limpiar()`.

### 3.8 Comunicación entre módulos

Solo por `bus-eventos` (eventos) o `bus-comandos` (comandos
síncronos). Ningún módulo de vista importa y llama directamente
a otro módulo de vista.

### 3.9 Persistencia solo por la capa de datos

Ningún módulo de UI toca Appwrite directamente. Todo pasa por
los repositorios en `js/datos/repositorios/`.

### 3.10 Encabezado estándar en cada archivo

    /* ================================================================
       Ahora Sí — MÓDULO JS (ES6)
       Archivo: ruta/archivo.js
       Versión: X.Y.Z
       Propósito: descripción breve.
                  vX.Y.Z: qué cambió en esta versión.
       ================================================================ */

Versionado semántico. Cada entrega sube la versión del archivo y
agrega una línea de changelog.

### 3.11 Archivos completos

Cuando se entrega un archivo modificado, va entero. Nunca "el
resto sigue igual". Esto evita errores de transcripción.

### 3.12 Escapar HTML al pintar

Cualquier dato que venga del backend o del usuario y se inserte
en el DOM debe pasar por `escaparHtml()` de `utils.js`. Esto
evita inyección de HTML si algún día un campo de texto libre
contiene `<script>`.

---

## 4. Control de regresiones

Antes de entregar un archivo modificado, comparar contra la
versión anterior y verificar:

- ¿Se eliminó alguna función pública?
- ¿Se eliminó algún parámetro de alguna firma?
- ¿Se eliminó alguna constante, mapa o caché compartido?
- ¿Se eliminó alguna emisión de evento?
- ¿Se eliminó alguna importación usada en otro archivo?

Si algo se eliminó, se justifica explícitamente en el changelog.
Si no hay justificación, se revierte antes de entregar.

---

## 5. Arquitectura del proyecto

### 5.1 Capas


js/
├── config/       → configuración global
├── nucleo/       → utilidades transversales (logger, bus-eventos,
│                    almacen, utils, autores, dialogos,
│                    idempotencia)
├── dominio/      → tipos de dominio (Resultado)
├── datos/        → capa de datos
│   ├── cliente-appwrite.js
│   ├── sesion.js
│   ├── realtime.js
│   └── repositorios/
├── audio/        → motor de audio (sintetizador)
├── arranque/     → inicialización de sesión y espacio
└── vistas/       → módulos de UI


### 5.2 Responsabilidades

- **Vistas:** pintan UI y reaccionan a eventos. No llaman a
  Appwrite. No conocen detalles de persistencia.
- **Repositorios:** validan, construyen payloads, llaman a
  `tablesDB`, normalizan respuestas, emiten eventos. Única capa
  que conoce Appwrite.
- **Núcleo:** utilidades sin dependencias de dominio.
- **Dominio:** tipos puros (por ahora solo `Resultado`).
- **Arranque:** bootstrap de la app.

### 5.3 Estado

Todo el estado compartido vive en `almacen.js`. Los módulos leen
con `obtener(clave)`. La UI no mantiene copias propias del
estado; mantiene su caché local de render y se refresca con
eventos del bus o de Realtime.

---

## 6. Modelo de datos

### 6.1 Base de datos única

Una sola base de datos en Appwrite: `EkyzD`
(`6a0275cb0022ebf7d30d`). Todas las tablas del proyecto viven ahí
con prefijo `ahorasi_*`. Esto no es negociable: el plan Free
permite una sola base de datos por proyecto.

### 6.2 Row Security

**Row Security desactivado.** Los permisos de tabla otorgan
acceso completo a los dos usuarios (Kiu y Luci). El cliente no
intenta asignar permisos de fila a otros usuarios, porque eso
está prohibido por Appwrite (un usuario solo puede otorgar
permisos de fila a sí mismo o a `users`/`any`).

Esta decisión se tomó después de descubrir que Appwrite rechaza
el envío de `permissions: [Permission.read(Role.user('otro'))]`
desde un cliente no-admin. Ver `docs/REGLAS.md` sección 7.1.

### 6.3 IDs de fila

Todos los IDs se generan en el cliente con prefijo. Ejemplos:
`plan_`, `kit_`, `hito_`, `carta_`, `resp_`, `fauna_`, `flora_`,
`ritmo_`, `perf_`, `esp_`. Esto permite trazabilidad visual en la
consola de Appwrite y facilita los tests.

### 6.4 Timestamps

Todas las tablas tienen columnas `creadoEn` (datetime) y las que
aplican, `actualizadoEn`. Cuando el repositorio normaliza una
fila, agrega `creadoEn` y `actualizadoEn` a partir de los campos
nativos de Appwrite (`$createdAt`, `$updatedAt`).

---

## 7. Decisiones de arquitectura ya tomadas

### 7.1 Row Security desactivado

Ver 6.2.

### 7.2 Idempotencia automática en crear y actualizar

Cada llamada a `crear()` o `actualizar()` de un repositorio pasa
por `conIdempotenciaParaCrear` o `conIdempotenciaParaActualizar`
de `_contexto.js`. Estas funciones generan una clave automática
si el llamador no pasa `idOperacion`. Ventana de TTL: 30
segundos.

**Motivo:** un doble clic rápido, un retry de red o un error
transitorio no deben duplicar filas.

### 7.3 Sin funciones serverless nuevas

El plan Free de Appwrite permite 2 funciones por proyecto. Kiu ya
usa las 2 en otros proyectos. Esta app no usa funciones
serverless. Esto significa que la creación de filas se hace
directamente desde el cliente con `tablesDB.createRow`. La
seguridad recae en:

1. Row Security desactivado.
2. Permisos de tabla que solo incluyen a los dos usuarios.
3. El hecho de que nadie más tiene acceso al proyecto.

Es un trade-off aceptado. Si en el futuro se necesita más
seguridad, se crea un proyecto Appwrite separado para esta app.

### 7.4 Realtime filtrado por espacioId

Las suscripciones de Realtime filtran por `espacioId` para que
cada dispositivo reciba solo lo que corresponde a su espacio. La
clave del espacio se resuelve desde el almacén (`espacio.id`).

### 7.5 SDK como bundle UMD local

`js/appwrite.min.js` es un bundle UMD de la versión 25 del SDK
Web de Appwrite. Se carga en el `<head>` con `defer`. No se usa
import dinámico desde CDN porque:

1. `esm.sh` no exporta `Channel` en todas las versiones.
2. La app depende de la red de un tercero.
3. El bundle local es más rápido y más confiable.

### 7.6 Idempotencia en memoria, no persistida

El registro de idempotencia vive en memoria. No se persiste en
`localStorage` entre sesiones. El TTL de 30 segundos cubre el
caso de uso (doble clic y retry inmediato). Persistir más allá es
complejidad innecesaria.

### 7.7 Arranque no bloqueante

El arranque de la app hace:

1. `cargarSesion()` (bloqueante, es rápido).
2. `Promise.all([obtenerPerfil, asegurarEspacioCompartido])`
   (paralelo).
3. `construirShell()` (sincrónico).
4. `navegar(ruta)` (no bloqueante: el shell aparece antes de que
   la vista cargue datos).
5. `iniciarRealtime()` (no bloqueante).

El objetivo es que el usuario vea el shell en menos de un
segundo, aunque los datos tarden más en llegar.

---

## 8. Lecciones aprendidas

### 8.1 La carpeta `_contexto.js` empieza con guión bajo

GitHub Pages usa Jekyll por defecto, que ignora archivos y
carpetas que empiezan con guión bajo (`_`). Para que Jekyll no
ignore `js/datos/repositorios/_contexto.js`, hay un archivo
`.nojekyll` vacío en la raíz del repo.

Si algún día se borra ese archivo, `_contexto.js` deja de
servirse y toda la app falla. **Nunca borrar `.nojekyll`**.

### 8.2 El `import` no funciona desde `file://`

Los módulos ES6 requieren ser servidos por HTTP. Abrir el
`index.html` haciendo doble clic no funciona. Se sirve con
`python -m http.server` o con GitHub Pages.

### 8.3 Los límites de Appwrite no son evidentes

- Una sola base de datos por proyecto en plan Free.
- Una sola instancia de funciones serverless (máximo 2) por
  proyecto.
- Los IDs de fila tienen límite de 36 caracteres.
- Los nombres de columna no admiten ciertos caracteres.

Ver `docs/GUIA-APPWRITE-CONSOLE-IV.md` (en el proyecto de
LaTaberna) para referencia completa.

### 8.4 Appwrite rechaza permisos de fila sobre otros usuarios

Un usuario autenticado solo puede otorgar permisos de fila a sí
mismo, a `users`, a `any`, o a su propio `label`. Intentar
otorgar permisos a otro usuario específico (`Role.user('otro')`)
falla con `user_unauthorized`.

**Consecuencia:** Row Security desactivado y permisos a nivel de
tabla para ambos usuarios.

### 8.5 Los componentes de Appwrite usan índices concurrentes

Cuando se crea una columna o un índice, pasa por estado
`processing` y después `available`. No se puede escribir en la
tabla hasta que todas las columnas estén `available`. Esperar
entre comandos del CLI.

---

## 9. Comunicación entre Kiu y el colaborador

- **Paciencia antes de acción.** Si algo no está claro, se
  pregunta. No se inventa.
- **Un hallazgo, un cambio acotado.** Si durante una tarea se
  detecta código que parece redundante, se consulta antes de
  tocarlo.
- **Archivos completos, siempre.** Nunca fragmentos.
- **Verificación por etapas.** Después de cada grupo de cambios,
  correr `tests/test.html`. Si falla, se arregla antes de seguir.

---

## 10. Tests

- **Test unificado:** `tests/test.html`. Corre 41 casos sobre
  núcleo, repositorios, vistas, Realtime e idempotencia.
- **Regla de mantenimiento:** cada feature nueva que se agregue
  debe sumar sus propios tests al unificado.
- **Tests temporales:** se pueden crear archivos sueltos para
  diagnóstico puntual. Si aportan algo al unificado, se migran y
  se borra el temporal. Si no, se borra directamente.

---

*Documento mantenido por Kiu.*
*Versión 1.0.0 — 25 de septiembre de 2026*