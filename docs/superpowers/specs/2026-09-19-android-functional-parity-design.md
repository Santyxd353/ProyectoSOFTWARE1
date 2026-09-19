# Diseño de paridad funcional Android

Fecha: 19 de septiembre de 2026  
Estado: especificación escrita para revisión  
Fuente contractual: PUDS, secciones 2.5.6 a 2.5.9, RF-25 a RF-32 y CU-21 a CU-25.

## Objetivo

Completar la aplicación Android para que produzca los mismos resultados funcionales que la aplicación web, con una interacción adaptada a pantallas táctiles y conservando el modo offline y la IA híbrida ya definidos. La implementación debe mantener roles, auditoría, historial, trazabilidad y formatos de intercambio compartidos con la web.

No se incluye despliegue en Google Cloud. Esta etapa debe quedar ejecutable y verificable localmente.

## Enfoque seleccionado

Se ampliará la aplicación Flutter existente mediante módulos funcionales que consumen la misma API NestJS. No se utilizará WebView y no se mantendrá una segunda lógica de negocio incompatible. El backend seguirá siendo la autoridad de permisos, versiones, invitaciones, revisiones y conflictos; Android conservará una copia local y una cola durable para las operaciones permitidas sin conexión.

El editor combinará un lienzo táctil con formularios inferiores. El lienzo cubrirá selección, movimiento, zoom, creación visual y conexión; los formularios editarán clases, atributos, métodos, relaciones y multiplicidades sin depender de gestos difíciles de descubrir.

## Arquitectura

### Backend

- NestJS expone contratos REST para cuenta, workspaces, diagramas, miembros, invitaciones, generación, repositorio, comentarios, conflictos e intercambio.
- Socket.IO distribuye presencia y operaciones persistidas. El servidor valida JWT, pertenencia y capacidad antes de aceptar cada evento.
- Prisma/PostgreSQL conserva la autoridad de usuarios, membresías, diagramas, operaciones, conflictos, revisiones y auditoría.
- El almacenamiento de artefactos conserva archivos y ZIP; la base de datos guarda sus metadatos y checksums.

### Android

- `core/api`: clientes HTTP tipados, descarga/subida de archivos y normalización de errores.
- `core/realtime`: autenticación Socket.IO, presencia, reconexión y reproducción de operaciones.
- `core/storage`: caché de entidades, preferencias, credenciales protegidas, archivos seleccionados y cola durable.
- `core/sync`: envío idempotente, actualización incremental, detección de conflictos y reintentos.
- `features/auth`: registro, login, perfil y cierre de sesión.
- `features/workspaces`: listado, creación, configuración, miembros, roles e invitaciones.
- `features/diagrams`: ciclo de vida de diagramas, lienzo táctil y formularios UML.
- `features/ai`: chat de texto/voz, selección explícita de motor local o remoto, propuesta y confirmación.
- `features/repository`: generaciones, árbol de archivos, visor, historial, comparación, comentarios, descarga y restauración.
- `features/interchange`: selección de archivos, vista previa, importación y exportación XMI, JSON y ZIP.
- `features/conflicts`: lista de conflictos, comparación de variantes y resolución confirmada.
- `features/settings`: idioma español/inglés, tema del sistema/claro/oscuro y URL local de API.

La navegación será jerárquica: sesión, proyectos, detalle de proyecto y pestañas de diagramas, código, miembros y configuración. El detalle de diagrama abrirá editor, IA, actividad y conflictos sin duplicar la carga del modelo.

## Modelo de invitaciones por enlace y código

`WorkspaceInvitation` se ampliará para soportar invitaciones dirigidas por correo y portables. Una invitación portable tendrá:

- `tokenHash`: hash único del token aleatorio incluido en el enlace; nunca se almacena el token en claro.
- `shortCodeHash`: hash del código manual normalizado.
- `expiresAt`: vencimiento obligatorio, con siete días como valor predeterminado.
- `claimedAt`: fecha de aceptación.
- `role`, `workspaceId`, `invitedById`, `status` y `acceptedById`.
- `email` opcional: cuando exista, la aceptación exige que coincida con el usuario autenticado.

El propietario o quien posea `members:manage` puede crear, listar y revocar invitaciones. OWNER nunca se asigna mediante invitación. La aceptación requiere sesión válida, es transaccional e idempotente, no duplica membresías ni eleva un rol existente. Los intentos vencidos, revocados, malformados o reutilizados se rechazan y quedan auditados sin registrar secretos.

El backend devolverá el enlace y el código únicamente al crearlos. Android aceptará enlaces profundos y permitirá introducir el código manualmente.

## Editor UML táctil

El lienzo usa el mismo esquema canónico de diagrama que la web. Cada modificación se expresa como una operación con `deviceId`, `clientSequence`, `baseVersion` y contenido estructurado.

Funciones obligatorias:

- crear, seleccionar, mover, renombrar y eliminar clases;
- crear, editar, reordenar y eliminar atributos y métodos;
- crear, editar y eliminar asociación, herencia, composición, agregación, dependencia y realización;
- editar visibilidad, tipos, parámetros, estereotipos, nulabilidad, unicidad y multiplicidades soportadas;
- zoom y desplazamiento táctil, autoajuste y selección accesible;
- validación local antes de encolar y validación autoritativa en el servidor;
- acciones destructivas con confirmación y permisos visibles.

El estado local se actualiza de forma optimista solo después de persistir la operación en la cola. Una respuesta del servidor sustituye la versión local por la versión confirmada.

## Offline, tiempo real y conflictos

Las lecturas disponibles offline usan la última copia sincronizada. Las operaciones UML básicas y las propuestas locales de IA se guardan antes de reflejarse en pantalla. La cola conserva orden, idempotencia y reintentos con retroceso.

Al reconectar:

1. renovar o validar la sesión;
2. obtener la versión remota y operaciones faltantes;
3. enviar operaciones locales pendientes en orden;
4. aplicar respuestas confirmadas;
5. presentar conflictos que no admitan fusión segura.

Los cambios sobre elementos distintos se fusionan automáticamente. Los conflictos conservan base, variante local y variante remota. La interfaz permite elegir local, remoto o una combinación editable, y muestra autor, tiempo y versiones antes de confirmar.

Socket.IO acelera presencia y difusión, pero no sustituye la persistencia REST. Una operación se muestra como confirmada en otros dispositivos únicamente después de que el backend la haya guardado.

## IA híbrida y audio

El chat acepta texto o dictado y puede leer respuestas mediante TTS. La ruta local ejecuta en el dispositivo un modelo FunctionGemma cuantizado para convertir órdenes básicas a funciones estructuradas. El ejecutor local valida la función contra una lista cerrada y solicita confirmación para cambios destructivos.

La ruta local cubre edición y consulta UML básica, validación y plantillas locales sobre diagramas descargados. La ruta remota cubre arquitectura amplia, refinamiento de modelos o código y explicaciones complejas. La UI identifica el motor utilizado y nunca presenta una respuesta local determinista como si proviniera de la nube.

El modelo y los recursos necesarios se empaquetarán o descargarán de forma explícita para que el recorrido básico funcione sin internet. Las claves de nube permanecen en el backend.

## Generación, repositorio e intercambio

Android invocará los mismos endpoints de generación que la web para Spring Boot, Flutter, OpenAPI y Postman. El repositorio móvil permitirá:

- listar revisiones y su estado;
- navegar carpetas y archivos;
- visualizar texto y binarios identificados;
- comentar archivos o líneas según política;
- comparar revisiones;
- descargar ZIP;
- restaurar como revisión nueva.

La importación abrirá el selector del sistema, enviará el archivo para vista previa y requerirá confirmación antes de crear una revisión. La exportación guardará o compartirá XMI, JSON o ZIP mediante las APIs nativas de Android.

## Seguridad y errores

- Los tokens de sesión se guardan en almacenamiento seguro.
- Permisos insuficientes producen controles deshabilitados y una respuesta autoritativa del backend.
- Los códigos, tokens y claves no aparecen en logs ni auditoría.
- Las cargas tienen límites de tamaño y tipo; XML y ZIP nunca se ejecutan.
- Los errores se clasifican en validación, autorización, conectividad, conflicto y fallo interno.
- Las acciones mutables muestran estado pendiente, confirmado o fallido y permiten reintentar cuando sea seguro.
- La expiración de sesión conserva la cola local y solicita autenticación antes de sincronizar.

## Compatibilidad y migración

La migración Prisma debe conservar las invitaciones por correo existentes. `email` pasará a ser opcional sin perder valores y la restricción de unicidad anterior será sustituida por índices compatibles con invitaciones portables. Los clientes web existentes seguirán funcionando; el panel web recibirá también la posibilidad de crear y revocar enlaces/códigos para mantener paridad de resultados.

## Pruebas y aceptación

### Backend

- pruebas unitarias y de integración para creación, vencimiento, revocación, aceptación, idempotencia y roles de invitaciones;
- autorización de todos los endpoints reutilizados por Android;
- persistencia antes de difusión y reproducción de operaciones;
- generación, repositorio, comentarios, comparación, descarga, restauración e intercambio.

### Flutter

- pruebas de modelos, clientes, almacenamiento y controladores;
- pruebas de widgets para formularios, permisos, estados offline y errores;
- pruebas del editor para crear, mover, conectar y editar todos los elementos UML;
- pruebas de cola, reconexión, conflictos y enlaces profundos;
- pruebas del enrutador híbrido y del ejecutor de funciones locales;
- recorridos de integración CU-21 a CU-25 contra el backend local.

### Verificación final

- `npm test` y compilación del backend;
- pruebas, typecheck y build del frontend para evitar regresiones;
- `flutter analyze`, pruebas unitarias/widgets/integración y APK debug;
- auditorías de dependencias sin vulnerabilidades conocidas de severidad alta o crítica;
- prueba manual en emulador Android de los criterios de la página 83 del PUDS;
- actualización de `docs/TRACEABILITY.md` únicamente cuando exista evidencia ejecutada.

## Entregables

- PUDS actualizado y trazabilidad real;
- migraciones y API compatibles;
- web ajustada solo donde sea necesario para invitaciones portables;
- aplicación Android completa para RF-25 a RF-32 y CU-21 a CU-25;
- pruebas automatizadas, APK debug y guía local reproducible;
- ningún cambio de despliegue ni envío a `main` durante esta etapa.
