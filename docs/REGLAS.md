# REGLAS.md — Reglas y decisiones de Ahora Sí

**Versión:** 2.0.0
**Fecha:** 30 de septiembre de 2026
**Propósito:** Reglas duras del proyecto y decisiones de arquitectura ya tomadas. Si algo de acá se rompe, es una regresión y hay que arreglarlo antes de seguir. Este documento es el contrato entre Kiu y cualquier colaborador (humano o IA). Se pega al inicio de cada sesión.

---

## 0. Cómo usar este documento

Este documento complementa al brief principal. El brief tiene el panorama completo y el lenguaje visual. Este documento tiene las reglas que se rompen con más frecuencia y las decisiones que no se vuelven a discutir sin motivo.

Si algo de acá no coincide con la realidad del código, se investiga antes de tocar nada. Si el código cambió porque una regla quedó obsoleta, se actualiza este documento primero, después el código.

---

## 1. Qué es este proyecto

Una app personal para Kiu y Luci. Un espacio compartido para planificar salidas, llevar registros y construir cosas juntos. No es comercial, no es multiusuario, no es un POS. Es una app de dos.

Está servida desde GitHub Pages en `ahorasi.elisekai.com` y usa Appwrite Cloud para el backend.

---

## 2. Reglas de idioma

### 2.1 Español neutro o chileno suave

Todo el código propio va en español. Variables, funciones, clases, métodos, eventos, nombres de archivos, constantes propias, mensajes de log, textos de UI.

Los modismos chilenos suaves son aceptables: "cachái", "dale", "al tiro", "po". Los modismos argentinos no son aceptables bajo ninguna circunstancia: ni voseo (`querés`, `tenés`, `podés`, `usás`, `confirmás`), ni léxico (`boludo`, `che`, `güey`), ni construcciones propias del Río de la Plata.

Cuando hay duda, se usa español neutro. Cuando el modismo chileno aporta cercanía y no suena forzado, se usa.

**Al escribir mensajes en el chat:** revisar cada mensaje antes de enviarlo. La regla aplica también a conversación, no solo a código.

### 2.2 APIs externas conservan su idioma

`createRow`, `listRows`, `setEndpoint`, `deleteSession`, `createEmailPasswordSession`. No se traducen. Pero los envoltorios propios sí: `listar()`, `crear()`, `actualizar()`.

### 2.3 Nombres de archivos y documentos

Los `.md` van en mayúscula y sin espacios: `EVENTOS.md`, `REGLAS.md`, `GUIA-APPWRITE-CLI.md`. Los archivos de código van en minúscula y con guion bajo si hace falta: `cliente-appwrite.js`, `subidor-fotos.js`.

Los `.md` se envían al chat encapsulados entre triple backticks. Pero **está prohibido que tengan triple backticks en su interior** (rompen el encapsulado). Los bloques de código dentro de un `.md` se indentan con 4 espacios, no con backticks.

---

## 3. Reglas de código

### 3.1 Módulos ES6

Cada archivo importa explícitamente lo que necesita y exporta lo que ofrece. Sin variables globales sueltas. Sin `window.X = ...`. Única excepción: SDKs externos como `appwrite.min.js`, que se cargan como `<script>` clásico y exponen `window.Appwrite`.

### 3.2 Exportaciones con nombre

Sin `export default`. Cada símbolo tiene nombre explícito. Se importa con `import { nombre } from '...'` o `import * as modulo from '...'`.

### 3.3 Sin `var`

Solo `const` y `let`. Nunca `var`.

### 3.4 Sin `onclick` en HTML

Los eventos se manejan con `addEventListener` o delegación por `data-accion`. Nunca `onclick="..."` ni `onchange="..."`.

### 3.5 Ciclo de vida de vistas

Cada módulo de vista expone `activar(contenedor)` y `limpiar()`. `activar()` monta la vista en el contenedor recibido. `limpiar()` libera listeners, aborta operaciones en curso, y vacía el contenedor.

Patrón obligatorio:

    registro.contenedor = contenedor;
    registro.abortador = new AbortController();
    const { signal } = registro.abortador;
    contenedor.addEventListener('click', manejarClick, { signal });

    registro.desuscribir = [
      al('realtime:planes:crear', refrescar),
    ];

    pintar();
    await refrescar();

### 3.6 AbortController para listeners del DOM

Al activar una vista, se crea un `AbortController`. Todos los `addEventListener` reciben la señal. Al limpiar, se llama `controller.abort()`. Esto evita listeners huérfanos.

### 3.7 Suscripciones con desuscripción

`bus-eventos.al()` devuelve una función para desuscribir. Se guarda en el registro del módulo y se ejecuta en `limpiar()`.

### 3.8 Comunicación entre módulos

Solo por `bus-eventos` (eventos asíncronos, uno a muchos) o `bus-comandos` (comandos síncronos, uno a uno). Ningún módulo de vista importa y llama directamente a otro módulo de vista.

**Cuándo usar eventos:** el emisor no sabe quién reacciona, cualquier cantidad de suscriptores puede reaccionar, la operación es un cambio de estado global.

**Cuándo usar comandos:** el llamador necesita un valor de retorno, el llamador necesita esperar a que la operación termine, la operación es una acción puntual.

### 3.9 Persistencia solo por la capa de datos

Ningún módulo de UI toca Appwrite directamente. Todo pasa por los repositorios en `js/datos/repositorios/`.

### 3.10 Encabezado estándar en cada archivo

    /* ================================================================
       Ahora Sí — MÓDULO JS (ES6)
       Archivo: ruta/archivo.js
       Versión: X.Y.Z
       Propósito: descripción breve.
                  vX.Y.Z: qué cambió en esta versión.
       ================================================================ */

Versionado semántico. Cada entrega sube la versión del archivo y agrega una línea de changelog.

### 3.11 Archivos completos

Cuando se entrega un archivo modificado, va entero. Nunca "el resto sigue igual". Esto evita errores de transcripción.

### 3.12 Escapar HTML al pintar

Cualquier dato que venga del backend o del usuario y se inserte en el DOM debe pasar por `escaparHtml()` de `utils.js`. Esto evita inyección de HTML si algún día un campo de texto libre contiene `<script>`.

### 3.13 Modales y sheets fuera del contenedor de vista

Los modales y sheets se montan al `document.body`, fuera del `#vista-X`. Necesitan su propio `AbortController` para los listeners. Patrón:

    function crearModalBase(tituloModal, cuerpo, pie) {
      cerrarModal();
      const modal = h('div', { class: 'recetas__modal' });
      // ...
      document.body.append(modal);
      const abortadorModal = new AbortController();
      registro.abortadorModal = abortadorModal;
      const { signal } = abortadorModal;
      modal.addEventListener('click', manejarClick, { signal });
      // ...
    }

Sus clases no llevan prefijo de ID.

---

## 4. Control de regresiones

Antes de entregar un archivo modificado, comparar contra la versión anterior y verificar:

- ¿Se eliminó alguna función pública?
- ¿Se eliminó algún parámetro de alguna firma?
- ¿Se eliminó alguna constante, mapa o caché compartido?
- ¿Se eliminó alguna emisión de evento?
- ¿Se eliminó alguna importación usada en otro archivo?

Si algo se eliminó, se justifica explícitamente en el changelog. Si no hay justificación, se revierte antes de entregar.

**Regla dura:** si el brief o la lista de pendientes dice "eliminar X", se verifica primero que nadie la use. Si alguien la usa, se coordina. Si no, se elimina y se documenta el motivo en el changelog.

---

## 5. Arquitectura del proyecto

### 5.1 Capas

    js/
    ├── config/       → configuración global
    ├── nucleo/       → utilidades transversales (logger, bus-eventos,
    │                    bus-comandos, almacen, utils, autores,
    │                    dialogos, idempotencia)
    ├── dominio/      → tipos de dominio (Resultado)
    ├── datos/        → capa de datos
    │   ├── cliente-appwrite.js
    │   ├── sesion.js
    │   ├── realtime.js
    │   ├── subidor-fotos.js
    │   └── repositorios/
    ├── audio/        → motor de audio (beatmaker, sintetizador)
    ├── arranque/     → inicialización de sesión, espacio y sembrados
    └── vistas/       → módulos de UI
        └── componentes/  → componentes reutilizables (camara, galeria)

### 5.2 Responsabilidades

- **Vistas:** pintan UI y reaccionan a eventos. No llaman a Appwrite. No conocen detalles de persistencia.
- **Repositorios:** validan, construyen payloads, llaman a `tablesDB`, normalizan respuestas, emiten eventos. Única capa que conoce Appwrite.
- **Núcleo:** utilidades sin dependencias de dominio.
- **Dominio:** tipos puros (por ahora solo `Resultado`).
- **Audio:** motor de síntesis y secuenciador. Solo importa de `nucleo/logger.js`.
- **Arranque:** bootstrap de la app.

### 5.3 Reglas de dependencia

- `vistas/*` puede importar de `nucleo/*`, `audio/*`, `dominio/*`, `datos/repositorios/*`, `config/*`.
- `datos/*` puede importar de `nucleo/*` y `config/*`.
- `nucleo/*` no importa nada salvo `config/*`.
- `audio/*` solo importa de `nucleo/logger.js`.
- Las vistas no se llaman entre sí.

### 5.4 Estado

Todo el estado compartido vive en `almacen.js`. Los módulos leen con `obtener(clave)`. La UI no mantiene copias propias del estado; mantiene su caché local de render y se refresca con eventos del bus o de Realtime.

Claves vigentes: `usuarioActual`, `perfil`, `espacio`, `planes`, `kit`, `hitos`, `ritmos`, `carta`, `respuestas`, `fauna`, `flora`, `modoNoche`, `cargando`, `error`.

---

## 6. Modelo de datos

### 6.1 Base de datos única

Una sola base de datos en Appwrite: `EkyzD` (`6a0275cb0022ebf7d30d`). Todas las tablas del proyecto viven ahí con prefijo `ahorasi_*`. Esto no es negociable: el plan Free permite una sola base de datos por proyecto.

### 6.2 Row Security

**Row Security desactivado.** Los permisos de tabla otorgan acceso completo a los dos usuarios (Kiu y Luci). El cliente no intenta asignar permisos de fila a otros usuarios, porque eso está prohibido por Appwrite (un usuario solo puede otorgar permisos de fila a sí mismo o a `users`/`any`).

### 6.3 IDs de fila

Todos los IDs se generan en el cliente con prefijo. Ejemplos: `plan_`, `kit_`, `hito_`, `carta_`, `resp_`, `fauna_`, `flora_`, `ritmo_`, `perf_`, `esp_`, `foto_`, `lugar_`, `serie_`, `reto_`, `penitencia_`, `pregunta_`, `apuesta_`, `chiste_`, `receta_`.

### 6.4 Timestamps

Todas las tablas tienen columnas `creadoEn` (datetime) y las que aplican, `actualizadoEn`. Cuando el repositorio normaliza una fila, agrega `creadoEn` y `actualizadoEn` a partir de los campos nativos de Appwrite (`$createdAt`, `$updatedAt`).

### 6.5 JSON serializado en columnas text

Los campos JSON (patrón, ingredientes, efectos, volumen, etc.) van en columnas `text`, no `varchar`. Motivo: `text` no tiene tope, así no hay que ajustar el tamaño cada vez que el JSON crece. Los repositorios serializan con `JSON.stringify()` al escribir y parsean con `JSON.parse()` al leer, con manejo defensivo (si el parseo falla, devuelven el default, nunca lanzan).

### 6.6 Columnas nuevas opcionales

Cuando se agrega una columna a una tabla que ya tiene filas, la columna se crea opcional (`--required=false`). Motivo: Appwrite rechaza la creación de una columna requerida si ya hay filas sin ese valor. Solo `espacioId` y los identificadores mínimos van como requeridos.

---

## 7. Decisiones de arquitectura ya tomadas

### 7.1 Row Security desactivado

Ver 6.2.

### 7.2 Idempotencia automática en crear y actualizar

Cada llamada a `crear()` o `actualizar()` de un repositorio pasa por `conIdempotenciaParaCrear` o `conIdempotenciaParaActualizar` de `_contexto.js`. Estas funciones generan una clave automática si el llamador no pasa `idOperacion`. Ventana de TTL: 30 segundos.

**Motivo:** un doble clic rápido, un retry de red o un error transitorio no deben duplicar filas.

### 7.3 Sin funciones serverless nuevas

El plan Free de Appwrite permite 2 funciones por proyecto. Kiu ya usa las 2 en otros proyectos. Esta app no usa funciones serverless. Esto significa que la creación de filas se hace directamente desde el cliente con `tablesDB.createRow`.

La seguridad recae en:

1. Row Security desactivado.
2. Permisos de tabla que solo incluyen a los dos usuarios.
3. El hecho de que nadie más tiene acceso al proyecto.

Es un trade-off aceptado. Si en el futuro se necesita más seguridad, se crea un proyecto Appwrite separado para esta app.

### 7.4 Realtime filtrado por espacioId

Las suscripciones de Realtime filtran por `espacioId` para que cada dispositivo reciba solo lo que corresponde a su espacio. La clave del espacio se resuelve desde el almacén (`espacio.id`).

### 7.5 SDK como bundle UMD local

`externos/appwrite.min.js` es un bundle UMD de la versión 25 del SDK Web de Appwrite. Se carga en el `<head>` con `defer`. No se usa import dinámico desde CDN porque:

1. `esm.sh` no exporta `Channel` en todas las versiones.
2. La app depende de la red de un tercero.
3. El bundle local es más rápido y más confiable.

### 7.6 Idempotencia en memoria, no persistida

El registro de idempotencia vive en memoria. No se persiste en `localStorage` entre sesiones. El TTL de 30 segundos cubre el caso de uso (doble clic y retry inmediato). Persistir más allá es complejidad innecesaria.

### 7.7 Arranque no bloqueante

El arranque de la app hace:

1. `cargarSesion()` (bloqueante, es rápido).
2. `Promise.all([obtenerPerfil, asegurarEspacioCompartido])` (paralelo).
3. `construirShell()` (sincrónico).
4. `navegar(ruta)` (no bloqueante: el shell aparece antes de que la vista cargue datos).
5. `iniciarRealtime()` (no bloqueante).

El objetivo es que el usuario vea el shell en menos de un segundo, aunque los datos tarden más en llegar.

### 7.8 Modo noche como preferencia global

El modo noche se guarda en `localStorage` con la clave `ahorasi:modoNoche` (valor `'1'` o `'0'`). También vive en el almacén bajo la clave `modoNoche` para que cualquier módulo pueda leerlo sin tocar `localStorage` directamente. Se aplica al body con la clase `modo-noche`. Los tokens de paleta se reescriben bajo `body.modo-noche` en `base.css`.

El toggle vive en la vista Cuenta. Al cambiar, escribe `localStorage` y actualiza el almacén (`establecer('modoNoche', valor)`), lo que dispara el evento `almacen:modoNoche` que `app.js` escucha para aplicar la clase.

### 7.9 Botón flotante contextual

Un FAB contextual. Aparece solo en las vistas que declaran `flotante: true` en `app.js`: Recetas, Fauna, Flora, Series. Dispara el click sobre `[data-accion="abrir-formulario"]` que la vista deja oculto.

### 7.10 Shell con sub-vistas

Una vista puede declarar `padre` en `VISTAS` de `app.js`. Si lo tiene:

- El shell muestra botón "volver" en el topbar (arriba a la izquierda del eyebrow).
- No muestra chips.
- El eyebrow dice "Grupo · Vista".
- El tabbar deja el grupo padre activo.
- Al tocar volver, navega al padre.

Las cinco sub-vistas de Juegos (Chistes, Retos, Penitencias, Preguntas, Apuestas) usan este patrón.

### 7.11 Cierre de sesión por comando

El cierre de sesión vive en `app.js` como `manejarSalir()`. La vista Cuenta lo ejecuta vía bus de comandos (`app:cerrar-sesion`). Así la lógica de logout vive en un solo lugar (el shell) y la vista no importa la capa de datos ni la capa de Realtime directamente.

---

## 8. Cambios de schema

### 8.1 Ver GUIA-APPWRITE-CLI.md

Los cambios de schema (agregar columnas, crear tablas, crear índices) tienen su propia guía operativa: `GUIA-APPWRITE-CLI.md`. Se pega al inicio de la sesión cuando se va a trabajar con el CLI.

### 8.2 Reglas básicas

- Las columnas nuevas se crean opcionales.
- `--required=false` con signo igual, no con espacio.
- Esperar a `available` antes de continuar con el siguiente comando.
- No borrar columnas en uso. Solo ignorarlas en el código.
- No intentar cambiar el tipo de una columna existente.

### 8.3 Cómo reconocer un campo obsoleto

Cuando un campo deja de usarse en el código:

1. Se elimina del normalizador del repositorio (así no se expone a las vistas).
2. Se elimina de los validadores y del payload de crear/actualizar.
3. **La columna queda en la tabla.** No se borra. Conserva el histórico por si algún día se quiere recuperar.
4. Se anota en el changelog del repositorio.

Ejemplo: la columna `cumplido` de `ahorasi_hitos` sigue existiendo pero el repositorio la ignora desde la v1.7.0.

---

## 9. Lecciones aprendidas

### 9.1 La carpeta `_contexto.js` empieza con guión bajo

GitHub Pages usa Jekyll por defecto, que ignora archivos y carpetas que empiezan con guión bajo (`_`). Para que Jekyll no ignore `js/datos/repositorios/_contexto.js`, hay un archivo `.nojekyll` vacío en la raíz del repo.

Si algún día se borra ese archivo, `_contexto.js` deja de servirse y toda la app falla. **Nunca borrar `.nojekyll`**.

### 9.2 El `import` no funciona desde `file://`

Los módulos ES6 requieren ser servidos por HTTP. Abrir el `index.html` haciendo doble clic no funciona. Se sirve con `python -m http.server` o con GitHub Pages.

### 9.3 Los límites de Appwrite no son evidentes

- Una sola base de datos por proyecto en plan Free.
- Una sola instancia de funciones serverless (máximo 2) por proyecto.
- Los IDs de fila tienen límite de 36 caracteres.
- Los nombres de columna no admiten ciertos caracteres.

### 9.4 Appwrite rechaza permisos de fila sobre otros usuarios

Un usuario autenticado solo puede otorgar permisos de fila a sí mismo, a `users`, a `any`, o a su propio `label`. Intentar otorgar permisos a otro usuario específico (`Role.user('otro')`) falla con `user_unauthorized`.

**Consecuencia:** Row Security desactivado y permisos a nivel de tabla para ambos usuarios.

### 9.5 Los componentes de Appwrite usan índices concurrentes

Cuando se crea una columna o un índice, pasa por estado `processing` y después `available`. No se puede escribir en la tabla hasta que todas las columnas estén `available`. Esperar entre comandos del CLI.

### 9.6 La Terminal web de la consola no es una shell

La Terminal web de Appwrite Console solo entiende comandos que empiezan con `appwrite`. Los comandos de sistema (`pwd`, `ls`, `cd`, `cat`) devuelven "not available in this terminal". No hay historial ni expansión de variables. No interpreta `\` para continuar línea: cada comando va en una sola línea.

La CLI local sí es una shell real. Ahí sí funcionan los comandos de sistema.

### 9.7 `whoami` no verifica el proyecto activo

`appwrite whoami` muestra el endpoint base (`https://cloud.appwrite.io/v1`), no el endpoint regional (`https://tor.cloud.appwrite.io/v1`). No es un error de configuración.

La verificación real del proyecto activo se hace con `appwrite databases list`. Si aparece la base `EkyzD`, se está en el proyecto correcto.

### 9.8 El flag `--required` va con signo igual

`--required=false` es la sintaxis correcta. Con espacio (`--required false`) falla o se interpreta mal. Sin el flag, la CLI exige que esté presente y falla con `required flag(s) "required" not set`.

### 9.9 Crear columnas en paralelo tiene contención

Se pueden mandar varios `create-*-column` seguidos sobre la misma tabla, pero mientras una columna está en `processing`, la tabla no acepta más cambios de schema. Los comandos que llegan en ese momento fallan silenciosamente. Si se manda en paralelo, verificar después con `list-columns` que todas entraron.

---

## 10. Tests

- **Test unificado:** `Test.html` en la raíz del repo. No en `tests/test.html`. Corre las suites A a AG, más de 150 casos sobre núcleo, configuración, sesión, repositorios, vistas, audio, Realtime, eventos e idempotencia.
- **Regla de mantenimiento:** cada feature nueva que se agregue debe sumar sus propios tests al unificado.
- **Tests temporales:** se pueden crear archivos sueltos para diagnóstico puntual. Si aportan algo al unificado, se migran y se borra el temporal. Si no, se borra directamente.
- **Cuando cambia el schema de un repo:** el test se actualiza en la misma tanda, no después. Si un campo nuevo no se prueba, el bug que motivó el cambio puede volver sin que nadie lo note.

### 10.1 Estructura del test

El test vive en la raíz, no en `/tests/`. Los `<script src>` apuntan a `./externos/appwrite.min.js` y `./externos/leaflet/leaflet.js`. Se sirve con el mismo servidor que la app.

### 10.2 Cobertura actual

Suites: A. Sanidad, B. Almacén, C. Resultado, D. Utilidades, E. Idempotencia núcleo, F. Bus eventos, G. Bus comandos, H. Autores, I. Planes, J. Kit, K. Hitos, L. Carta, M. Respuestas, N. Fauna, O. Flora, P. Ritmos, Q. Lugares, R. Series, S. Recetas, T. Retos, U. Penitencias, V. Preguntas, W. Apuestas, X. Chistes, Y. Fotos, Z. Espacios, AA. Perfiles, AB. Audio, AC. Eventos, AD. Vistas, AE. Realtime, AF. Idempotencia repos, AG. Limpieza.

### 10.3 Regla del `</script>` literal

Nunca puede aparecer `</script>` literal dentro de un `<script>` inline en HTML, ni siquiera en un string de JS. Se escapa como `<\/script>`. De lo contrario, el parser de HTML corta el bloque.

---

## 11. Comunicación entre Kiu y el colaborador

- **Paciencia antes de acción.** Si algo no está claro, se pregunta. No se inventa.
- **Un hallazgo, un cambio acotado.** Si durante una tarea se detecta código que parece redundante, se consulta antes de tocarlo.
- **Archivos completos, siempre.** Nunca fragmentos.
- **Verificación por etapas.** Después de cada grupo de cambios, correr `Test.html`. Si falla, se arregla antes de seguir.
- **Antes de tocar UI nueva, prototipo.** El flujo es: prototipo HTML estático → aprobación → implementación. No se salta.
- **Español neutro o chileno suave.** Nunca voseo argentino, ni en código ni en chat.

---

## 12. Qué NO hacer

- No usar voseo argentino. Nunca.
- No agregar dependencias externas sin consultar.
- No usar `var`.
- No usar `window.X = ...`.
- No usar `export default`.
- No usar nombres propios en inglés.
- No eliminar código "por si acaso". Si se elimina, se justifica.
- No llamar a Appwrite directo desde una vista.
- No dejar errores silenciosos: todo catch deja rastro con `Logger.error`.
- No avanzar sin avisar si algo no está claro.
- No asumir longitudes exactas de IDs.
- No tocar `.nojekyll`.
- No escribir modales fuera del `#vista-X` sin su propio `AbortController`.
- No implementar sin prototipo aprobado.
- No marcar columnas como `required` en tablas que ya tienen datos.
- No correr `appwrite push` sin `pull` previo.
- No intentar comandos de shell (`pwd`, `ls`) en la Terminal web.
- No enviar `permissions` en `createRow`.

---

## 13. Decisiones numeradas (recopilatorio)

Esta sección recopila las decisiones tomadas a lo largo del proyecto. Cada una tiene un identificador para poder referenciarla en discusiones futuras.

### 13.1 Organización y lenguaje visual

- **D1:** El primer grupo se llama Nido (no Fogón).
- **D2:** Acento por vista, no por grupo.
- **D3:** Botón flotante solo en Recetas, Fauna, Flora, Series.
- **D4:** Planes con segmented control dentro de la tarjeta (los 4 botones originales fueron reemplazados).
- **D5:** Kit con grid de 2 columnas y item expandible.
- **D6:** Hitos con año destacado a la izquierda, solo cuando cambia.
- **D7:** Barra de progreso de lectura en Carta.
- **D8:** Se mantiene `autor__inicial` (no se renombra).
- **D9:** Sin hero en Recetas.
- **D10:** Índice lateral de Recetas rotado con `writing-mode`.

### 13.2 Arquitectura

- **D11:** Idempotencia automática en crear y actualizar de todos los repositorios.
- **D12:** Realtime filtrado por `espacioId`.

### 13.3 Rediseño

- **D13:** Kit va en Afuera (entre Mapa y Fauna), no en Vida.
- **D14:** Recetas es la primera vista de Vida.
- **D15:** Modo noche como preferencia global en `localStorage`. Toggle en Cuenta.
- **D16:** Respuesta se fusiona con Carta.
- **D17:** Hitos como línea biográfica. Sin campo `cumplido`, sin autor, sin chip de tipo. Color elegible entre 6 opciones.
- **D18:** Fauna y Flora en formato bitácora. Texto primero, foto al pie. Galería compacta de 3 fotos más "+N".
- **D19:** Series con dos modos (Tarjeta y Ranking) con toggle.
- **D20:** Juegos como hub con 5 cards que llevan a sub-vistas independientes. Soporte de sub-vistas en el shell.
- **D21:** Percusión con orden tipo sheets (variante C). La caja sigue el modo noche global.
- **D22:** Percusión modo extendido con grilla de 16 pasos partida en 2 bloques de 8 (variante B del prototipo). Celdas sin `min-height` forzado, label del modo extendido a 56px.

### 13.4 Schema y datos

- **D23:** Campos JSON serializados van en columnas `text`, no `varchar`.
- **D24:** Ritmos guarda efectos, volumen, silenciados, solistas y swing desde v1.6.0 del repositorio.
- **D25:** Al cerrar sesión, se ejecuta por bus de comandos (`app:cerrar-sesion`) para que la lógica viva en el shell.
- **D26:** El campo `marcar()` de hitos fue eliminado en v1.8.0. Nadie lo usaba desde el rediseño de hitos.

---

*Documento mantenido por Kiu.*
*Versión 2.0.0 — 30 de septiembre de 2026*