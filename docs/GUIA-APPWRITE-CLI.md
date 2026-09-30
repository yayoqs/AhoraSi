GUIA-APPWRITE-CLI.md — Guía de trabajo con Appwrite CLI para Ahora Sí

Versión: 1.1.0
Fecha: 30 de septiembre de 2026
Propósito: guía operativa para que cualquier colaborador (humano o IA) pueda hacer cambios de schema en el backend de Ahora Sí sin romper nada, sin inventar comandos y sin dejar el proyecto en un estado inconsistente.
Mantenedor: Kiu.

---

0. Cómo usar este documento

Este documento se pega al inicio del chat cuando se va a trabajar sobre el schema de Appwrite. No reemplaza al brief principal, lo complementa.

Si algo de acá no coincide con la realidad del proyecto, no se ejecuta el comando. Se consulta primero.

Los comandos de la sección 5 fueron verificados contra Appwrite CLI 27.2.1 en la Terminal web de la consola, el 30 de septiembre de 2026. Los comandos de las secciones 4 y 6 siguen sin verificación y están marcados con ⚠️ CONFIRMAR.

---

1. Contexto

1.1 Proyecto Appwrite

Campo Valor
Organización 6a0252ef002b258c5458
Proyecto 6a025322001f24c57d1d
Endpoint https://tor.cloud.appwrite.io/v1
Database ID 6a0275cb0022ebf7d30d
Database nombre EkyzD
Bucket de fotos ahorasi_fotos

1.2 Plan y límites

· Plan Free. Una sola base de datos. Máximo 2 funciones serverless (Kiu ya usa las 2 en otros proyectos). Sin transformación de imágenes.
· Row Security desactivado. Los permisos van a nivel de tabla, no de fila.
· Sin funciones serverless. Toda la escritura es directa desde el cliente con tablesDB.createRow.

1.3 Convenciones del proyecto

· Prefijo: todas las tablas llevan ahorasi_ adelante.
· Row IDs: se generan en el cliente con prefijo corto (plan_, kit_, hito_, carta_, resp_, fauna_, flora_, ritmo_, perf_, esp_, foto_, lugar_, serie_, reto_, penitencia_, pregunta_, apuesta_, chiste_, receta_).
· Timestamps: todas las tablas tienen creadoEn (datetime). Las que aplican, también actualizadoEn.
· Permisos: read, create, update, delete para user:Elyayo y user:ChicaLuci. Nada más.

---

2. Dónde se ejecuta el CLI

2.1 Dos modos posibles

El CLI de Appwrite se puede usar de dos maneras:

· **CLI local**, instalado con npm. Corre en una shell (Termux, bash, zsh, PowerShell). Tiene acceso al sistema de archivos, historial del shell, y comandos del sistema operativo.
· **Terminal web de la consola**, disponible en la propia consola de Appwrite. No es una shell. Solo entiende comandos que empiecen con appwrite.

Cada modo tiene sus límites. Antes de empezar, hay que saber en cuál se está trabajando.

2.2 CLI local

Requisitos:

· Node.js 18 o superior.
· npm.
· Termux (Android) o terminal Linux/Mac/Windows.

Instalación:

    npm install -g appwrite-cli

Verificación:

    appwrite --version

Debe devolver la versión. Si devuelve "command not found", npm no dejó el binario en el PATH. En Termux suele pasar. Solución:

    export PATH=$PATH:$PREFIX/bin
    echo 'export PATH=$PATH:$PREFIX/bin' >> ~/.bashrc

2.3 Terminal web de la consola

Se accede desde la consola de Appwrite, en el panel lateral. Usa automáticamente la sesión y el proyecto activo.

**Importante:** no es una shell. Los comandos del sistema operativo **no funcionan**:

· pwd → devuelve "pwd: not available in this terminal."
· ls, cd, cat → igual.
· No hay historial del shell ni expansión de variables.
· No interpreta \ para continuar línea. Cada comando va completo en una sola línea.

Cada comando empieza con appwrite. El prompt indica el proyecto con el formato usuario@proyecto$. Ejemplo: yayoqs8@lataberna$.

Para pedir ayuda sobre los comandos disponibles:

    appwrite help

---

3. Autenticación

3.1 Login (solo CLI local)

    appwrite login

Pide email y contraseña de la cuenta Appwrite. Usa la cuenta de Kiu, la que administra la organización.

La Terminal web no requiere login: hereda la sesión de la consola.

3.2 Verificar la sesión

    appwrite whoami

Salida esperada:

    Appwrite CLI 27.2.1 (Go 1.26.5, js/wasm)
    Email    : Yayoqs8@gmail.com
    Endpoint : https://cloud.appwrite.io/v1

**Ojo:** el campo Endpoint muestra el endpoint por defecto (https://cloud.appwrite.io/v1), no el endpoint real del proyecto (https://tor.cloud.appwrite.io/v1). No es un error de configuración. Es solo que whoami no resuelve el endpoint regional.

Para verificar que estás en el proyecto correcto, no uses whoami. Usa:

    appwrite databases list

Si en la salida aparece la base EkyzD con ID 6a0275cb0022ebf7d30d, estás en el proyecto correcto. Si no aparece, el CLI está apuntando a otro proyecto o a otro endpoint. Se corrige con appwrite init project (CLI local) o seleccionando el proyecto en la consola (Terminal web).

3.3 Nota sobre la sesión del CLI local

La sesión del CLI local se guarda en ~/.appwrite/prefs.json. No se sincroniza entre dispositivos. En cada terminal nueva hay que loguear una vez.

La Terminal web no tiene este problema: siempre usa la sesión de la consola.

---

4. Estructura del proyecto

4.1 Carpeta de trabajo (solo CLI local)

El proyecto Ahora Sí vive en GitHub. El appwrite.json (config del CLI) está en la raíz del repo.

⚠️ CONFIRMAR: verificar que appwrite.json está commiteado y no ignorado por .gitignore.

4.2 Vincular el repo al proyecto Appwrite (solo CLI local)

La primera vez en un repo nuevo (o después de un clon):

    appwrite init project

Elegir la organización y el proyecto (Ahora Sí). Esto crea o actualiza appwrite.json.

4.3 Estructura de appwrite.json

    {
      "projectId": "6a025322001f24c57d1d",
      "projectName": "Ahora Sí",
      "databases": [
        {
          "key": "...",
          "name": "EkyzD",
          "$id": "6a0275cb0022ebf7d30d",
          "tables": [
            {
              "$id": "ahorasi_perfiles",
              "name": "ahorasi_perfiles",
              "columns": [ ... ],
              "indexes": [ ... ]
            }
          ]
        }
      ]
    }

⚠️ CONFIRMAR: la estructura exacta de appwrite.json en la versión 27.2.1. La key puede llamarse tables o collections según la versión.

4.4 Bajar el schema actual (solo CLI local)

Para sincronizar el appwrite.json local con lo que hay en el servidor:

    appwrite pull tables

o el comando equivalente de tu versión.

⚠️ CONFIRMAR: el comando exacto para bajar schema de TablesDB en 27.2.1. **Este comando no está disponible en la Terminal web** porque no hay sistema de archivos local donde guardar el appwrite.json.

Antes de empezar cualquier trabajo, hacer un pull. Esto asegura que el appwrite.json local refleja el estado real del servidor, no lo que quedó de la última sesión.

---

5. Comandos de schema (TablesDB)

Esta sección fue verificada contra Appwrite CLI 27.2.1. Los comandos funcionan tanto en CLI local como en Terminal web, salvo los de pull/push que requieren sistema de archivos (sección 4).

5.1 Sintaxis general

Todos los comandos usan el prefijo tablesdb:

    appwrite tablesdb <accion> --flag valor --flag2 valor2

Los parámetros van con flags (con --), nunca como argumentos posicionales.

**Los comandos van en una sola línea.** La Terminal web no interpreta \ para continuar línea.

**Confirmar sintaxis antes de armar un comando:**

    appwrite tablesdb create-text-column --help

Muestra los flags disponibles para ese comando en la versión instalada. Es la fuente de verdad. Si la guía dice algo distinto al --help, gana el --help.

5.2 Listar columnas e índices

    appwrite tablesdb list-columns --database-id <DATABASE_ID> --table-id <TABLE_ID>

    appwrite tablesdb list-indexes --database-id <DATABASE_ID> --table-id <TABLE_ID>

Para ver detalles crudos de una columna específica:

    appwrite tablesdb get-column --database-id <DATABASE_ID> --table-id <TABLE_ID> --key <COLUMN_KEY> --raw

La salida de list-columns trae por cada columna: key, type, status, required, array, $createdAt, $updatedAt, y detalles propios del tipo (size para varchar, min/max para integer, elements para enum).

5.3 Crear columnas

**Importante sobre --required:** es un flag booleano de presencia. **El formato correcto es --required=false con signo igual, no con espacio.**

· --required=false → columna opcional. Correcto.
· --required=true → columna requerida. Correcto.
· --required false (con espacio) → falla o se interpreta mal.
· Sin el flag → Cobra exige que esté presente y falla con:
  ✗ Error: required flag(s) "required" not set

**Importante sobre --xdefault:** el flag de default es --xdefault, no --default. Ejemplo:

    --xdefault ""

**Importante sobre --size:** solo aplica a varchar. Los comandos de text, integer, datetime, etc. no aceptan --size.

**Regla del proyecto:** las columnas nuevas se crean siempre con --required=false. Si ya hay filas en la tabla, una columna requerida rompe la migración.

Boolean:

    appwrite tablesdb create-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required=false

Integer:

    appwrite tablesdb create-integer-column --database-id <ID> --table-id <ID> --key <KEY> --required=false

Double (float):

    appwrite tablesdb create-float-column --database-id <ID> --table-id <ID> --key <KEY> --required=false

Varchar (string corto):

    appwrite tablesdb create-varchar-column --database-id <ID> --table-id <ID> --key <KEY> --size 255 --required=false

Text (string sin límite):

    appwrite tablesdb create-text-column --database-id <ID> --table-id <ID> --key <KEY> --required=false

Enum:

    appwrite tablesdb create-enum-column --database-id <ID> --table-id <ID> --key <KEY> --elements valor1 --elements valor2 --elements valor3 --required=false

Datetime:

    appwrite tablesdb create-datetime-column --database-id <ID> --table-id <ID> --key <KEY> --required=false

5.3.1 Nota sobre --elements en enum

La CLI no parsea valores separados por coma en --elements. Tampoco interpreta correctamente strings con formato JSON array.

Incorrecto (queda como un único elemento literal "valor1,valor2"):

    appwrite tablesdb create-enum-column ... --elements valor1,valor2,valor3

Correcto (repetir el flag por cada valor):

    appwrite tablesdb create-enum-column ... --elements valor1 --elements valor2 --elements valor3

Verificar el resultado con get-column --raw. El campo elements debe mostrar un array con strings separados. Si aparece ['a,b,c'] o ['["a","b"]'], la columna quedó mal formada. Hay que borrarla y recrearla con la sintaxis correcta.

5.3.2 Creación en paralelo (opcional)

Se pueden enviar varios create-*-column seguidos sobre la misma tabla sin esperar entre cada uno. **Pero hay contención de locks:** mientras una columna está en processing, la tabla no acepta más cambios de schema. Los comandos que llegan en ese momento fallan silenciosamente.

**Regla:** si se manda en paralelo, hay que verificar con list-columns que todas las columnas entraron. Si alguna falta, se vuelve a crear. Nunca asumir que todas entraron.

Ejemplo aplicado el 30 de septiembre de 2026 sobre ahorasi_ritmos:

    appwrite tablesdb create-text-column --database-id 6a0275cb0022ebf7d30d --table-id ahorasi_ritmos --key silenciados --required=false
    appwrite tablesdb create-text-column --database-id 6a0275cb0022ebf7d30d --table-id ahorasi_ritmos --key solistas --required=false
    appwrite tablesdb create-integer-column --database-id 6a0275cb0022ebf7d30d --table-id ahorasi_ritmos --key swing --required=false

Las tres entraron en este caso. Pero el orden de respuesta y el resultado pueden variar entre intentos.

5.4 Estados de columna

Toda columna pasa por dos estados:

Estado Descripción
processing Appwrite está aplicando el cambio en background.
available La columna está lista para usarse en queries, escrituras y Realtime.

Regla dura: **no se puede escribir en la tabla mientras alguna de sus columnas esté en processing.** Antes de continuar con el siguiente comando, verificar con list-columns que la columna anterior esté available.

Tiempo típico: entre 5 y 30 segundos.

Verificación:

    appwrite tablesdb list-columns --database-id <DATABASE_ID> --table-id <TABLE_ID>

Buscar la columna por key. Cuando diga status: available, seguir.

5.5 Actualizar columnas

Cambiar tamaño de varchar:

    appwrite tablesdb update-varchar-column --database-id <ID> --table-id <ID> --key <KEY> --size 500 --required=false

Marcar como requerida (⚠️ cuidado, ver 5.3):

    appwrite tablesdb update-boolean-column --database-id <ID> --table-id <ID> --key <KEY> --required=true

5.6 Eliminar columnas

Operación destructiva. Elimina los datos de esa columna en todas las filas. Requiere confirmación previa del Coordinador.

    appwrite tablesdb delete-column --database-id <ID> --table-id <ID> --key <COLUMN_KEY>

El comando responde silenciosamente cuando tiene éxito. Verificar con list-columns después.

**Recomendación del proyecto:** si solo se quiere dejar de usar una columna, es mejor dejarla sin usar en el código que borrarla. Así se conserva el histórico. Ejemplo: la columna cumplido de ahorasi_hitos sigue existiendo pero el repositorio la ignora.

5.7 Crear índices

Importante: el flag es --columns, no --attributes.

Key:

    appwrite tablesdb create-index --database-id <ID> --table-id <ID> --key <INDEX_KEY> --type key --columns <COLUMNA>

Unique:

    appwrite tablesdb create-index --database-id <ID> --table-id <ID> --key <INDEX_KEY> --type unique --columns <COLUMNA>

Fulltext:

    appwrite tablesdb create-index --database-id <ID> --table-id <ID> --key <INDEX_KEY> --type fulltext --columns <COLUMNA>

Índice compuesto:

    appwrite tablesdb create-index --database-id <ID> --table-id <ID> --key <INDEX_KEY> --type key --columns col1 --columns col2

5.8 Crear tabla

    appwrite tablesdb create-table --database-id <DATABASE_ID> --table-id <TABLE_ID> --name <NOMBRE>

Los flags --permissions y --row-security son opcionales. Por el escape de comillas en la terminal, se recomienda configurar estos desde la consola web.

---

6. Flujo típico de cambios de schema

6.1 Cuando hay que agregar un campo

Ejemplo: agregar notas a ahorasi_kit.

1. Pull (solo CLI local). Bajar el schema actual:

       appwrite pull tables

   En Terminal web, saltar este paso (no hay sistema de archivos).

2. Confirmar sintaxis. Correr --help del comando que se va a usar:

       appwrite tablesdb create-varchar-column --help

3. Crear la columna. --required=false, tamaño según convención:

       appwrite tablesdb create-varchar-column --database-id 6a0275cb0022ebf7d30d --table-id ahorasi_kit --key notas --size 200 --required=false

4. Esperar a available. Consultar el estado con list-columns hasta que la columna diga available. Suele tardar entre 5 y 30 segundos.

5. Actualizar el repo. Abrir js/datos/repositorios/kit.js y:
   · Agregar el campo a normalizar().
   · Agregar el campo a crear() con validación de largo.
   · Agregar el campo a actualizar() con validación.
   · Subir la versión del archivo con changelog.

6. Actualizar la vista. Si la UI muestra el campo, modificar js/vistas/kit.js y css/vistas/kit.css.

7. Actualizar el test. Agregar un caso al test unificado en Test.html que verifique que el campo se guarda y se lee.

8. Correr el test. Abrir Test.html y verificar que todos los casos pasan.

9. Push al repo. Commit y push. GitHub Pages reconstruye.

6.2 Cuando hay que agregar una tabla

Ejemplo: agregar una tabla nueva ahorasi_vinilos.

1. Definir el schema completo. Antes de tocar nada:
   · Nombre de la tabla.
   · Columnas con tipo y largo.
   · Índices.
   · Permisos.

2. Crear la tabla desde la consola (más fácil que CLI para el primer paso). Configurar:
   · Table ID: ahorasi_vinilos
   · Row Security: desactivado.
   · Permisos: read, create, update, delete para user:Elyayo y user:ChicaLuci.

3. Agregar las columnas una por una desde la Terminal o la consola. --required=false salvo en las imprescindibles (por ejemplo, espacioId).

4. Agregar los índices. Al menos:
   · espacioId (para el filtrado por espacio).
   · creadoEn descendente (para ordenar).

5. Esperar a available.

6. Pull (solo CLI local) para bajar el schema al appwrite.json.

7. Crear el repositorio en js/datos/repositorios/vinilos.js siguiendo el patrón de los otros (validar, construir payload, usar _contexto.js, emitir eventos, devolver Resultado).

8. Registrar la tabla en realtime.js dentro del objeto TABLAS.

9. Crear la vista en js/vistas/vinilos.js y su CSS.

10. Registrar la vista en app.js dentro de VISTAS y en el grupo correspondiente.

11. Actualizar EVENTOS.md con los eventos nuevos (vinilos:creado, vinilos:actualizado, vinilos:eliminado, y los canales de Realtime).

12. Agregar tests al unificado.

13. Correr tests, verificar, commit, push.

6.3 Cuando hay que modificar una columna existente

⚠️ Advertencia: Appwrite CLI no permite cambiar el tipo de una columna existente. Para cambiar de tipo hay que:

1. Crear una columna nueva con el tipo deseado.
2. Migrar los datos (con un script).
3. Borrar la columna vieja.

Alternativa más simple: dejar la columna vieja sin usar y crear una nueva con otro nombre. Fue lo que se hizo con cumplido en hitos.

---

7. Convenciones del proyecto

7.1 Nombres de tablas

· Prefijo: ahorasi_.
· Todo en singular o plural según sentido natural: ahorasi_perfiles (plural), ahorasi_carta (singular porque la carta es única por usuario), ahorasi_planes (plural).
· Sin espacios, sin mayúsculas, sin guiones. Solo minúsculas y guión bajo.

7.2 Nombres de columnas

· Sin prefijo.
· camelCase: espacioId, creadoPor, nombrePropio, fechaVisita.
· Los IDs referenciales terminan en Id o Por: espacioId, userId, creadoPor, marcadoPor, asignadaPor, enviadoPor.

7.3 Tipos de columna

Uso Tipo Largo
Nombre corto varchar 100
Descripción, notas varchar 500
Texto libre largo text —
Enum corto enum —
Fecha datetime —
Número entero integer —
Booleano boolean —
JSON serializado text —
ID referencial varchar 36

Nota: para JSON serializado se usa text (sin límite), no varchar. Así no hay que estar ajustando el tamaño cada vez que el JSON crece. Precedente: patron en ahorasi_ritmos, efectos, volumen, silenciados, solistas.

7.4 Valores requeridos

Regla: las columnas nuevas se crean opcionales (--required=false). Solo espacioId y los campos mínimos de identificación van como required.

Motivo: si una columna es required y ya hay filas creadas, Appwrite rechaza la creación de la columna hasta que todas las filas tengan ese valor. En una app viva, eso rompe la tabla.

7.5 Permisos

Cada tabla lleva al menos:

    read("user:Elyayo")
    create("user:Elyayo")
    update("user:Elyayo")
    delete("user:Elyayo")
    read("user:ChicaLuci")
    create("user:ChicaLuci")
    update("user:ChicaLuci")
    delete("user:ChicaLuci")

Row Security desactivado.

---

8. Errores comunes y cómo evitarlos

8.1 "required flag(s) \"required\" not set"

Causa: appwrite tablesdb create-*-column exige el flag --required. No se puede omitir.

Solución: pasar --required=false (con signo igual) para columnas opcionales, o --required=true para requeridas.

8.2 "Invalid document structure: Missing required attribute X"

Causa: una columna marcada como required no tiene valor en el payload.

Solución: dejar la columna como opcional, o incluir siempre el campo en el payload (aunque sea vacío).

8.3 "user_unauthorized: Row permissions can only be granted to the current user"

Causa: el cliente intenta otorgar permisos de fila a otro usuario (por ejemplo, a Luci). Appwrite rechaza esto.

Solución: no enviar permissions en createRow. Con Row Security desactivado, los permisos van a nivel de tabla.

8.4 La columna no acepta escrituras durante unos segundos

Causa: la columna está en estado processing.

Solución: esperar. Consultar el estado de la tabla hasta que todas las columnas digan available.

8.5 "Database not found" o "Table not found"

Causa: el ID de la base o de la tabla está mal escrito. Los IDs son sensibles a mayúsculas.

Solución: verificar contra config.js (databaseId) y contra el nombre exacto de la tabla en repositorios/*.js.

8.6 El CLI dice que hay cambios locales pero el servidor no los refleja

Causa: el appwrite.json local está desactualizado o hay cambios sin pushear.

Solución: hacer pull para sincronizar. Si el pull trae cambios inesperados, revisar antes de pushear.

8.7 Se borró una tabla por accidente con push

Causa: push sin pull previo puede eliminar recursos remotos que no están en el appwrite.json local.

Solución: siempre hacer pull antes de push. Y si hay dudas, no pushear. Hacer los cambios desde la consola web.

8.8 El test falla después de un cambio de schema

Causa: el repositorio no normaliza el campo nuevo, o el test no contempla el campo.

Solución: actualizar normalizar() del repositorio y los tests correspondientes. Siempre subir la versión del archivo con changelog.

8.9 "unknown command \"\\\""

Causa: se pegó un comando multilínea con \. La Terminal web no interpreta continuaciones.

Solución: pegar el comando completo en una sola línea.

8.10 "pwd: not available in this terminal"

Causa: se intentó correr un comando de shell (pwd, ls, cd, cat) en la Terminal web.

Solución: la Terminal web no es una shell. Solo entiende comandos que empiezan con appwrite.

8.11 Una columna creada en paralelo no aparece en list-columns

Causa: contención de locks. Mientras una columna está en processing, la tabla no acepta más cambios de schema y los comandos siguientes pueden fallar silenciosamente.

Solución: verificar con list-columns después de cada tanda paralela. Si falta alguna, volver a crearla.

---

9. Qué NO hacer

· No correr appwrite push sin pull previo. Puede borrar recursos.
· No marcar columnas como required en tablas que ya tienen datos. Rompe la migración.
· No enviar permissions en createRow. No aplica en este proyecto.
· No intentar cambiar el tipo de una columna existente. No se puede. Crear una nueva.
· No borrar columnas en uso. Solo ignorarlas en el código.
· No usar IDs con espacios, mayúsculas o guiones.
· No crear una segunda base de datos. El plan Free permite una sola.
· No crear funciones serverless. El plan Free permite 2 y ya están usadas en otros proyectos.
· No confiar en el estado del appwrite.json local sin verificar contra el servidor.
· No intentar comandos de shell (pwd, ls, cd) en la Terminal web.

---

10. Troubleshooting

10.1 El CLI no encuentra el proyecto

    appwrite whoami

Si no hay sesión, appwrite login (solo CLI local). Si hay sesión pero la base EkyzD no aparece en appwrite databases list, el proyecto activo es otro.

En la Terminal web, seleccionar el proyecto desde la consola.

10.2 Los comandos no funcionan en Termux

Falta $PREFIX/bin en el PATH. Ver sección 2.2.

10.3 El CLI dice que el proyecto no tiene tablas

Hacer:

    appwrite pull tables

Solo disponible en CLI local. En Terminal web, listar directamente con appwrite tablesdb list-columns.

10.4 Después de un cambio, la app no lee los datos

1. Verificar que la columna está available.
2. Verificar que el repositorio tiene el campo en normalizar().
3. Verificar que el espacioId está bien filtrado.
4. Revisar la consola del navegador (F12).

10.5 El test falla con "No hay usuario autenticado"

Verificar que el test crea su propio espacio de prueba al arrancar. Si el reiniciar de la suite B borra el contexto, hay que restaurarlo (ver Test.html v2.0.3+, ya resuelto).

10.6 "Endpoint: https://cloud.appwrite.io/v1" en whoami

No es un error. whoami muestra el endpoint base, no el regional. La verificación real es appwrite databases list.

---

11. Checklist antes de cerrar una sesión de schema

☐ Pull corrido al inicio (solo CLI local).
☐ Sintaxis de cada comando verificada con --help.
☐ --required=false con signo igual, no con espacio.
☐ Cambios probados en local.
☐ Columnas nuevas en estado available.
☐ Si se creó en paralelo, verificado con list-columns que todas entraron.
☐ Repositorio actualizado con el campo nuevo.
☐ Vista actualizada si corresponde.
☐ Tests actualizados.
☐ Test unificado corriendo en verde.
☐ EVENTOS.md actualizado si hubo eventos nuevos.
☐ Versiones de archivos modificados subidas con changelog.
☐ Commit y push al repo.
☐ Verificación en producción (ahorasi.elisekai.com).

---

12. Recursos

12.1 Documentación oficial

· Appwrite CLI: https://appwrite.io/docs/tooling/command-line/installation
· TablesDB API: https://appwrite.io/docs/references/cloud/server-nodejs/tablesdb
· Permisos: https://appwrite.io/docs/permissions

12.2 Referencia interna

· docs/REGLAS.md — reglas del proyecto.
· docs/EVENTOS.md — catálogo de eventos.
· GUIA-APPWRITE-CONSOLE-IV.md (en proyecto LaTaberna) — guía completa de consola Appwrite.
· guia-appwrite-console-databases.md (en proyecto LaTaberna) — operación de TablesDB con SDK y CLI.

12.3 Notas específicas de la cuenta

· La cuenta Appwrite de Kiu administra varias organizaciones. Verificar siempre que se está operando sobre "Ahora Sí" y no sobre otro proyecto antes de correr comandos destructivos.
· Kiu ya usa las 2 funciones serverless del plan Free en otros proyectos. No crear más.
· Versión de CLI verificada: 27.2.1 (Go 1.26.5, js/wasm).

---

13. Cambios de la v1.1.0

Esta versión incorpora los hallazgos de la primera sesión de trabajo con la CLI, el 30 de septiembre de 2026, durante la migración de ahorasi_ritmos:

· Sección 2 reescrita: ahora distingue CLI local de Terminal web. La Terminal web no es una shell. Los comandos pwd, ls, cd fallan con mensaje explícito.
· Sección 3.2 corregida: whoami muestra el endpoint base, no el activo. Verificación real con databases list.
· Sección 5 reescrita: los ejemplos fueron verificados contra CLI 27.2.1. Cambios:
  · --required es booleano con signo igual: --required=false.
  · El flag de default es --xdefault, no --default.
  · text no lleva --size.
  · JSON serializado va como text, no varchar.
  · Confirmar sintaxis con --help antes de armar un comando.
  · Se documentó la contención de locks al crear columnas en paralelo.
· Sección 8 ampliada con 3 errores nuevos: required flag(s) "required" not set, pwd: not available, columna faltante tras creación paralela.
· Sección 13 nueva, con el changelog de la guía.

---

Documento mantenido por Kiu.
Versión 1.1.0 — 30 de septiembre de 2026