# Repositorio interno colaborativo - diseño técnico

Fecha: 2026-09-12  
Estado: aprobado conceptualmente; pendiente de implementación  
Fuente de alcance: PUDS del Primer Parcial

## 1. Objetivo

Implementar la primera ampliación funcional documentada: un repositorio interno para conservar, navegar, revisar, comparar, descargar y restaurar el código generado desde los diagramas UML. La solución no exige conocimientos de Git y mantiene cada resultado vinculado con el workspace, el diagrama, la versión UML, el autor y el generador que lo produjo.

Esta entrega cubre CU-12, CU-17, CU-20 y la parte de CU-19 necesaria para aplicar permisos uniformes sobre REST, WebSocket y descargas.

## 2. Trazabilidad

| Caso de uso | Comportamiento implementado | Requisitos relacionados |
| --- | --- | --- |
| CU-12 | Registrar revisiones inmutables, almacenar archivos y presentar árbol, vista previa e historial. | RF-12, RF-13, RF-23 |
| CU-17 | Consultar archivos, agregar comentarios por archivo/línea y distribuirlos en tiempo real. | RF-13, RF-19, RF-21 |
| CU-19 | Administrar roles y validar autorización en API, sockets y descargas. | RF-05, RF-21, RF-24 |
| CU-20 | Descargar, comparar y restaurar revisiones sin destruir el historial. | RF-13, RF-22, RF-23 |

RF-24 también se aplica a las operaciones relevantes de los cuatro casos mediante auditoría.

## 3. Alcance incluido

- Registrar automáticamente una revisión después de una generación Spring Boot o Flutter satisfactoria.
- Conservar una instantánea navegable de los archivos generados.
- Listar revisiones autorizadas por workspace y diagrama.
- Mostrar árbol de rutas, metadatos y contenido textual seguro.
- Reconocer archivos binarios y mostrar únicamente sus metadatos.
- Comparar dos revisiones mediante diferencias textuales; para binarios, comparar tamaño y huella.
- Descargar una revisión como ZIP temporal.
- Restaurar una revisión creando otra revisión inmutable.
- Crear y consultar comentarios ligados a revisión, archivo y línea opcional.
- Notificar comentarios nuevos mediante WebSocket autenticado.
- Consultar miembros y cambiar o retirar roles desde la interfaz de administración.
- Registrar auditoría de generación, comentario, comparación, descarga, restauración y cambio de rol.

## 4. Fuera de alcance

Esta entrega no implementa ramas, commits Git, pull requests, edición manual del contenido almacenado, ejecución del código generado, CI/CD, búsqueda global, XMI, IA nueva, aplicación móvil, sincronización offline ni despliegue en Google Cloud. Esas capacidades pertenecen a entregas posteriores del PUDS.

## 5. Arquitectura elegida

Se usará almacenamiento híbrido:

- PostgreSQL y Prisma conservarán metadatos, relaciones, permisos, comentarios y auditoría.
- Un contrato `ArtifactStorage` conservará bytes y permitirá guardar, leer, comprobar existencia y eliminar objetos.
- `LocalArtifactStorage` implementará ese contrato durante desarrollo local bajo un directorio configurable fuera de `src`.
- `GcsArtifactStorage` será la implementación de producción durante la fase de despliegue en Google Cloud; el dominio y los controladores no dependerán directamente del SDK de Google.

El backend incorporará módulos separados:

- `AuthorizationModule`: resolución de membresía y capacidades por rol.
- `AuditModule`: registro de eventos sin secretos ni contenido sensible.
- `ArtifactStorageModule`: adaptador local y contrato sustituible.
- `CodeRepositoryModule`: revisiones, archivos, comentarios, comparación, descarga y restauración.

La generación seguirá perteneciendo a `CodeGenerationModule`, pero entregará sus resultados al servicio del repositorio interno. No escribirá metadatos del repositorio de forma directa.

## 6. Modelo de datos

### 6.1 Workspace

Se añadirá `allowViewerComments Boolean @default(false)`. La opción materializa la política documentada para permitir o impedir comentarios de observadores.

### 6.2 CodeRevision

Campos:

- `id`: identificador estable.
- `workspaceId`: proyecto propietario.
- `diagramId`: diagrama de origen.
- `modelVersion`: versión UML utilizada.
- `authorId`: persona que generó o restauró.
- `projectType`: `SPRING_BOOT` o `FLUTTER` en esta entrega.
- `generator`: identificador y versión lógica del generador.
- `status`: `CREATING`, `PUBLISHED` o `FAILED`.
- `parentRevisionId`: revisión previa opcional.
- `restoredFromId`: revisión restaurada opcional.
- `manifest`: resumen JSON sin secretos.
- `createdAt` y `publishedAt`.

Una revisión `PUBLISHED` es inmutable. Una revisión fallida no aparecerá como descargable.

### 6.3 RevisionFile

Campos:

- `id`, `revisionId` y `path` normalizada.
- `storageKey`: referencia opaca al objeto.
- `checksum`: SHA-256 del contenido.
- `size`: bytes.
- `mimeType`.
- `isBinary`.
- `createdAt`.

La combinación `revisionId + path` será única. Los directorios se derivarán de las rutas y no tendrán registros propios.

### 6.4 ReviewComment

Campos:

- `id`, `revisionId`, `fileId` y `authorId`.
- `line`: línea opcional y positiva.
- `body`: texto validado y limitado.
- `createdAt` y `updatedAt`.

Los comentarios no modifican el archivo ni la revisión. Esta entrega no añade respuestas anidadas ni estados de resolución porque no aparecen en el PUDS.

### 6.5 AuditEvent

Campos:

- `id`, `workspaceId`, `actorId`, `action` y `createdAt`.
- `entityType` y `entityId`.
- `metadata`: JSON acotado sin tokens, contraseñas, audio ni contenido completo de archivos.

### 6.6 GeneratedCode existente

Se conservará temporalmente para compatibilidad con la API actual y se añadirá una relación opcional uno a uno con `CodeRevision`. `zipPath` dejará de ser la fuente de verdad: las descargas nuevas se reconstruirán desde `RevisionFile` y `ArtifactStorage`.

## 7. Política de autorización

| Acción | OWNER | EDITOR | VIEWER |
| --- | --- | --- | --- |
| Listar y abrir revisiones | Sí | Sí | Sí |
| Comparar revisiones | Sí | Sí | Sí |
| Descargar revisión | Sí | Sí | Sí |
| Generar y publicar revisión | Sí | Sí | No |
| Restaurar como revisión nueva | Sí | Sí | No |
| Comentar | Sí | Sí | Solo si `allowViewerComments` está activo |
| Cambiar roles o retirar miembros | Sí | No | No |

Reglas adicionales:

- El propietario se resolverá desde `Workspace.ownerId`; no se duplicará como colaborador.
- Nunca podrá quedar un workspace sin propietario.
- La API derivará el usuario del JWT; ningún cuerpo, parámetro o mensaje WebSocket podrá elegir otro `userId`.
- Los sockets se autenticarán durante el handshake y se unirán únicamente a salas autorizadas.
- Cada servicio volverá a comprobar autorización; ocultar un botón no constituye control de acceso.

## 8. Flujo de publicación

1. El actor autorizado solicita generar Spring Boot o Flutter.
2. El backend carga el diagrama junto con workspace y versión.
3. `AuthorizationService` exige capacidad de edición.
4. El generador crea el proyecto en un directorio temporal único.
5. `CodeRepositoryService` crea una revisión `CREATING`.
6. Se recorren únicamente archivos regulares dentro de la raíz temporal.
7. Cada ruta se normaliza, se calcula SHA-256, tamaño, MIME y condición binaria.
8. Los bytes se guardan mediante `ArtifactStorage` y los metadatos mediante Prisma.
9. La revisión cambia atómicamente a `PUBLISHED` y se registra auditoría.
10. El directorio temporal se elimina después de cerrar los streams.

Si falla cualquier paso, la revisión queda `FAILED`, no se ofrece para descarga y se registra un diagnóstico sin secretos. Los objetos guardados sin referencia se limpiarán de forma segura mediante una operación interna idempotente.

## 9. API REST

Todas las rutas requieren JWT.

### Repositorio

- `GET /workspaces/:workspaceId/revisions`
- `GET /workspaces/:workspaceId/revisions/:revisionId`
- `GET /workspaces/:workspaceId/revisions/:revisionId/tree`
- `GET /workspaces/:workspaceId/revisions/:revisionId/files/:fileId`
- `GET /workspaces/:workspaceId/revisions/compare?base=:id&target=:id&fileId=:optional`
- `GET /workspaces/:workspaceId/revisions/:revisionId/download`
- `POST /workspaces/:workspaceId/revisions/:revisionId/restore`

### Comentarios

- `GET /workspaces/:workspaceId/revisions/:revisionId/comments?fileId=:optional`
- `POST /workspaces/:workspaceId/revisions/:revisionId/comments`

El cuerpo de creación contendrá `fileId`, `line?` y `body`; autor y workspace se obtendrán del contexto autenticado.

### Miembros y política

- `GET /workspaces/:workspaceId/members`
- `PATCH /workspaces/:workspaceId/members/:memberId`
- `DELETE /workspaces/:workspaceId/members/:memberId`
- `PATCH /workspaces/:workspaceId/repository-policy`

Las respuestas usarán DTO explícitos y no expondrán rutas físicas ni `storageKey`.

## 10. WebSocket

El namespace de colaboración aceptará el JWT en el handshake. Se añadirá una sala `workspace:<workspaceId>:revision:<revisionId>` y un evento de servidor `review_comment_created`.

El cliente solo enviará la revisión que desea observar. El servidor resolverá identidad, membresía y permiso; no confiará en nombre, rol ni usuario aportados por el navegador.

El mismo mecanismo de autenticación reemplazará el `userId` confiado actualmente por la colaboración de diagramas, cumpliendo CU-19 sin introducir eventos ajenos al PUDS.

## 11. Interfaz web

El workspace incorporará una pestaña `Código` con:

- Selector de revisión y metadatos de origen.
- Árbol de archivos derivado de las rutas.
- Visor textual de solo lectura con números de línea.
- Estado binario con nombre, MIME, tamaño y huella.
- Selector de dos revisiones y vista de diferencias.
- Panel de comentarios del archivo o línea seleccionada.
- Acciones de descarga y restauración según capacidad.
- Estado vacío cuando todavía no existan revisiones.

La administración de miembros mostrará el rol vigente y permitirá cambiarlo o retirarlo únicamente al propietario. Todos los controles seguirán el tema profesional claro/oscuro existente.

## 12. Comparación, restauración y descarga

- La comparación textual será determinista y devolverá un diff unificado limitado por tamaño.
- Un archivo binario se comparará por presencia, tamaño, MIME y SHA-256.
- La restauración copiará los metadatos de archivo hacia una revisión nueva y conservará `restoredFromId`; nunca actualizará una revisión publicada.
- La descarga reconstruirá un ZIP temporal con rutas normalizadas y lo transmitirá al usuario autorizado.
- El ZIP se eliminará al completar o abortar la respuesta.
- No se aceptarán rutas absolutas, segmentos `..`, enlaces simbólicos ni archivos fuera de la raíz de generación.

## 13. Errores y límites

- `401`: sesión ausente o inválida.
- `403`: rol sin capacidad.
- `404`: workspace, revisión o archivo inexistente dentro del ámbito autorizado.
- `409`: cambio de rol concurrente, revisión no publicada o restauración incompatible.
- `413`: comentario, archivo, descarga o comparación sobre el límite configurado.
- `422`: ruta insegura, archivo ilegible o metadatos inconsistentes.

Los mensajes externos no incluirán rutas del servidor, stack traces ni nombres de objetos internos.

## 14. Estrategia de pruebas

### Backend

- Pruebas unitarias de capacidades OWNER/EDITOR/VIEWER.
- Pruebas de normalización de rutas y bloqueo de traversal/symlinks.
- Pruebas de publicación completa, fallo parcial e inmutabilidad.
- Pruebas de árbol, archivo textual y metadatos binarios.
- Pruebas de comparación textual/binaria.
- Pruebas de restauración como revisión nueva.
- Pruebas de descarga autorizada y denegada.
- Pruebas de comentarios y política de observadores.
- Pruebas de autenticación WebSocket sin identidad proporcionada por el cliente.
- Pruebas de auditoría sin datos sensibles.

### Frontend

- Pruebas de transformación de rutas a árbol.
- Pruebas de capacidades visibles por rol.
- Pruebas de estados vacío, carga, error, texto y binario.
- Verificación de tipos y compilación Next.js.

### Integración

- Migración Prisma validada sobre PostgreSQL de prueba.
- Flujo generación -> revisión -> árbol -> descarga.
- Flujo comentario -> evento WebSocket.
- Flujo comparación -> restauración -> historial preservado.

## 15. Migración y compatibilidad

1. Añadir modelos y relaciones Prisma mediante migración versionada.
2. Crear adaptador local y directorio ignorado por Git.
3. Incorporar autorización y auditoría antes de exponer endpoints.
4. Publicar nuevas generaciones como revisiones y conservar descargas antiguas desde `GeneratedCode` durante la transición.
5. Añadir interfaz de Código y administración de roles.
6. Retirar la dependencia de `zipPath` únicamente cuando el flujo nuevo esté cubierto por pruebas.

No se migrarán automáticamente ZIP antiguos a revisiones en esta entrega, porque el PUDS no exige una importación histórica. Seguirán disponibles mediante la ruta de compatibilidad mientras exista el archivo.

## 16. Criterios de aceptación

- Una generación autorizada crea exactamente una revisión publicada y navegable.
- Una revisión publicada no puede modificarse.
- Un usuario ajeno no puede inferir ni descargar revisiones por identificador.
- El árbol no contiene rutas fuera de la raíz ni claves físicas de almacenamiento.
- Los archivos textuales pueden abrirse y los binarios no se interpretan como texto.
- Dos revisiones pueden compararse y la respuesta distingue texto de binario.
- Restaurar conserva la revisión original y añade una nueva al historial.
- Los comentarios quedan ligados a revisión y archivo y se notifican en tiempo real.
- Los permisos coinciden con la tabla de autorización en REST, WebSocket y descargas.
- Las operaciones relevantes generan auditoría sin secretos.
- Backend y frontend compilan y todas las pruebas nuevas pasan.

## 17. Dependencias con entregas futuras

- CU-14 reutilizará `ArtifactStorage` para archivos XMI y paquetes exportados.
- CU-15 y CU-18 reutilizarán autorización, auditoría y revisiones para sincronización móvil.
- CU-16 publicará resultados de IA mediante el mismo flujo inmutable.
- La fase Google Cloud añadirá `GcsArtifactStorage` sin cambiar los casos de uso ni la API pública.
