# Trazabilidad PUDS - implementación local

Fecha de verificación: 20 de septiembre de 2026.

Estado del alcance: los RF-01 a RF-32 y CU-01 a CU-25 tienen implementación local comprobada en el monorepositorio. La paridad Android se verificó con pruebas unitarias, de widgets, integración contra la API real y una APK instalada en un emulador Android 15 (API 35). El despliegue en Google Cloud continúa fuera de esta etapa.

## Requisitos funcionales

| ID | Requisito del PUDS | Evidencia principal | Estado local |
| --- | --- | --- | --- |
| RF-01 | Registrar usuarios e iniciar o cerrar una sesión protegida. | `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.service.spec.ts`, `frontend/stores/auth.ts` | Implementado y probado; registro e inicio exitosos quedan auditados. |
| RF-02 | Crear, consultar y organizar espacios de trabajo UML. | `backend/src/workspace/workspace.service.ts`, `frontend/app/dashboard/page.tsx` | Implementado. |
| RF-03 | Editar clases, atributos, operaciones y relaciones en un lienzo gráfico. | `frontend/components/editor/UMLEditor.tsx`, `ClassEditor.tsx`, `RelationshipEditor.tsx` | Implementado. |
| RF-04 | Distribuir cambios del diagrama entre participantes conectados. | `backend/src/collaboration/collaboration.gateway.ts`, `collaboration-operation.service.ts`, `frontend/hooks/useSocket.ts` | Implementado; se persiste antes de transmitir. |
| RF-05 | Invitar personas y controlar su participación en un proyecto. | `backend/src/invitation/invitation.service.ts`, `frontend/components/workspace/MemberManagement.tsx` | Implementado y probado. |
| RF-06 | Archivar modelos sin perder su trazabilidad histórica. | `backend/src/diagram/diagram.service.ts`, `frontend/lib/diagram-lifecycle.ts` | Implementado y probado. |
| RF-07 | Transformar un diagrama válido en un backend Spring Boot reproducible. | `backend/src/code-generation/code-generation.service.ts`, `backend/templates/springboot/` | Implementado; generación real recorrida localmente. |
| RF-08 | Crear o completar modelos UML mediante instrucciones en lenguaje natural. | `backend/src/ai-chat/ai-chat.service.ts`, `frontend/components/chat/AIChatInterface.tsx` | Implementado con propuesta y confirmación humana. |
| RF-09 | Configurar metadatos, permisos y opciones del espacio de trabajo. | `backend/src/workspace/workspace.service.ts`, `frontend/components/workspace/WorkspaceSettings.tsx` | Implementado y probado. |
| RF-10 | Producir colecciones de pruebas para la API generada. | `backend/src/code-generation/api-artifacts.ts`, `api-artifacts.spec.ts` | Implementado: OpenAPI 3.0.3 y Postman 2.1. |
| RF-11 | Generar una aplicación Flutter conectada a la API del proyecto. | `backend/src/code-generation/code-generation.service.ts`, `backend/templates/flutter/` | Implementado y probado. |
| RF-12 | Guardar el código generado en un repositorio interno por proyecto. | `backend/src/code-repository/code-repository.service.ts`, `frontend/components/repository/CodeRepositoryPanel.tsx` | Implementado; publicación real con 19 archivos verificada. |
| RF-13 | Mantener revisiones inmutables y comparables de cada generación. | `backend/prisma/schema.prisma`, `backend/src/code-repository/code-repository.service.spec.ts` | Implementado y probado. |
| RF-14 | Aceptar solicitudes de IA por texto y por audio. | `mobile/lib/main.dart`, `mobile/lib/app_controller.dart` | Implementado en Android con dictado y lectura de respuesta. |
| RF-15 | Ejecutar comandos UML básicos sin conexión a internet. | `mobile/lib/core/ai/local_model_runtime.dart`, `function_catalog.dart`, `local_ai_engine_test.dart` | Implementado con FunctionGemma 270M opcional y fallback básico identificado; las acciones se validan antes de modificar el diagrama. |
| RF-16 | Sincronizar operaciones móviles pendientes al recuperar conectividad. | `mobile/lib/app_controller.dart`, `mobile/lib/core/api/api_client.dart`, `backend/src/collaboration/collaboration-operation.service.ts` | Implementado con cola durable e idempotencia. |
| RF-17 | Importar y exportar modelos mediante XMI, JSON y ZIP propio. | `backend/src/diagram-interchange/diagram-interchange.service.ts`, `frontend/app/workspace/[workspaceId]/page.tsx` | Implementado con vista previa, advertencias y confirmación. |
| RF-18 | Refinar código y decisiones de diseño con una IA en la nube. | `backend/src/ai-chat/backend-refinement.service.ts`, `frontend/components/code-generation/CodeGenerationPanel.tsx` | Implementado; requiere `ANTHROPIC_API_KEY` e internet para una llamada real. Mantiene compatibilidad temporal con `CLAUDE_API_KEY`. |
| RF-19 | Permitir revisión colaborativa del código y su historial. | `backend/src/code-repository/code-repository.service.ts`, `frontend/components/repository/CommentPanel.tsx` | Implementado; comentario de archivo/línea verificado. |
| RF-20 | Detectar y resolver conflictos conservando ambas variantes. | `backend/src/collaboration/collaboration-operation.service.ts`, `mobile/lib/core/sync/sync_queue.dart` | Implementado y probado. |
| RF-21 | Administrar roles OWNER, EDITOR y VIEWER en todos los canales. | `backend/src/authorization/authorization.service.ts`, `frontend/lib/repository-capabilities.ts` | Implementado en REST, WebSocket y descargas. |
| RF-22 | Descargar, comparar y restaurar revisiones autorizadas. | `backend/src/code-repository/code-repository.controller.ts`, `RevisionCompare.tsx` | Implementado; ZIP, comparación y restauración verificados. |
| RF-23 | Persistir datos y artefactos fuera de instancias efímeras de ejecución. | `backend/prisma/schema.prisma`, `backend/src/artifact-storage/local-artifact-storage.service.ts` | Implementado localmente en PostgreSQL y `.local`/`artifacts`. |
| RF-24 | Registrar eventos relevantes para auditoría y diagnóstico. | `backend/src/audit/audit.service.ts`, modelos `AuditEvent` y `DiagramActivity` | Implementado; metadatos sensibles se filtran. |
| RF-25 | Ofrecer en Android las funciones de cuenta, perfil, idioma, tema y acceso disponibles en la web. | `mobile/lib/app.dart`, `features/auth/`, `features/settings/`, `project_lifecycle_widget_test.dart` | Implementado y probado. |
| RF-26 | Crear y editar clases, atributos, métodos y relaciones mediante un editor UML táctil. | `mobile/lib/features/diagrams/editor/`, `diagram_operations_test.dart`, `uml_editor_widget_test.dart` | Implementado con pan, zoom, arrastre, formularios y confirmación destructiva. |
| RF-27 | Administrar desde Android el ciclo de vida de proyectos y diagramas según permisos. | `mobile/lib/features/workspaces/workspace_management.dart`, `app_controller_lifecycle_test.dart` | Implementado con controles por rol y validación del servidor. |
| RF-28 | Invitar por correo, enlace o código temporal, revocable y asociado a un rol. | `backend/src/invitation/`, `mobile/lib/features/workspaces/invitations_screen.dart`, `invitations_screen_test.dart` | Implementado; enlace/código, caducidad, revocación, vínculo opcional de correo e idempotencia probados. |
| RF-29 | Colaborar en tiempo real desde Android con presencia y operaciones confirmadas. | `mobile/lib/core/realtime/realtime_client.dart`, `realtime_client_test.dart`, `app_controller_sync_test.dart` | Implementado con JWT, reingreso, cursor de replay y presencia. |
| RF-30 | Generar, navegar, comentar, descargar, comparar y restaurar código desde Android. | `mobile/lib/features/generation/`, `features/repository/`, `artifact_hub_screen_test.dart` | Implementado y recorrido contra la API local. |
| RF-31 | Importar y exportar XMI, JSON y ZIP desde el almacenamiento del dispositivo. | `mobile/lib/features/interchange/`, `portability_api_test.dart`, `android_parity_journey_test.dart` | Implementado con selector/guardado del sistema y recorrido XMI de ida y vuelta. |
| RF-32 | Visualizar y resolver conflictos móviles conservando variantes, autor y versión. | `mobile/lib/features/conflicts/`, `conflict_merge_test.dart`, `sync_coordinator_test.dart` | Implementado con selección local/remota o fusión manual y descarte preciso de la operación confirmada. |

## Casos de uso

| ID | Caso de uso del PUDS | RF | Evidencia de aceptación |
| --- | --- | --- | --- |
| CU-01 | Gestionar acceso al sistema | RF-01, RF-24 | `auth.service.spec.ts`; prueba real de registro, login, perfil y eventos `USER_REGISTERED`/`USER_LOGGED_IN`. |
| CU-02 | Consultar y administrar proyectos | RF-02, RF-21 | `workspace.service.spec.ts`, dashboard bilingüe. |
| CU-03 | Construir el modelo UML del dominio | RF-03, RF-24 | Editor React Flow y operación versionada. |
| CU-04 | Sincronizar el diagrama colaborativo | RF-04, RF-24 | `collaboration.gateway.spec.ts`; conexión real con replay. |
| CU-05 | Incorporar participantes al proyecto | RF-05, RF-21 | `invitation.service.spec.ts` y panel de miembros. |
| CU-06 | Archivar o retirar diagramas | RF-06, RF-24 | `diagram.service.spec.ts`, confirmación y restauración UI. |
| CU-07 | Generar backend Spring Boot por reglas | RF-07, RF-12, RF-13 | `code-generation.service.spec.ts`; generación y publicación real. |
| CU-08 | Construir un modelo con asistencia inteligente | RF-08, RF-18 | IA devuelve propuesta; `AIChatInterface.tsx` exige aplicar o descartar. |
| CU-09 | Crear y configurar un espacio de trabajo | RF-02, RF-09 | Creación API real y `WorkspaceSettings.tsx`. |
| CU-10 | Producir una colección de pruebas API | RF-10, RF-13 | `api-artifacts.spec.ts`; archivos `openapi.json` y `postman_collection.json` comprobados en revisión. |
| CU-11 | Generar una aplicación Flutter | RF-11, RF-12, RF-13 | Generador Flutter por plantillas y publicación en repositorio interno. |
| CU-12 | Gestionar el repositorio interno de código | RF-12, RF-13, RF-23 | Árbol real de 19 archivos, lectura de OpenAPI y almacenamiento por checksum. |
| CU-13 | Interactuar con la IA por texto o voz | RF-14, RF-15, RF-18 | Pantalla Android, `speech_to_text`, TTS y `local_ai_engine_test.dart`. |
| CU-14 | Importar y exportar modelos UML | RF-17, RF-24 | 10 pruebas de intercambio y recorrido HTTP XMI/JSON/ZIP. |
| CU-15 | Trabajar offline y sincronizar cambios | RF-15, RF-16, RF-20 | `app_controller_sync_test.dart`, `local_store_test.dart`, `sync_queue_test.dart`. |
| CU-16 | Generar o refinar backend con IA | RF-07, RF-18, RF-24 | `backend-refinement.service.spec.ts`; token firmado, confirmación y manifiesto trazable. |
| CU-17 | Revisar colaborativamente código generado | RF-13, RF-19, RF-21 | Comentarios en tiempo real, archivo/línea y permisos probados. |
| CU-18 | Detectar y resolver conflictos de sincronización | RF-16, RF-20, RF-24 | Conflicto real creado/resuelto; ambas variantes se conservan hasta resolver. |
| CU-19 | Administrar roles y permisos | RF-05, RF-21, RF-24 | `authorization.service.spec.ts`, `workspace.service.spec.ts`, autenticación de socket. |
| CU-20 | Descargar, comparar o restaurar una revisión | RF-13, RF-22, RF-23 | Descarga ZIP 200, comparación de 19 archivos y nueva revisión restaurada. |
| CU-21 | Gestionar cuenta, proyectos y diagramas desde Android | RF-25, RF-27 | `app_controller_lifecycle_test.dart`, `project_lifecycle_widget_test.dart` y recorrido Android integral aprobado. |
| CU-22 | Editar un diagrama UML táctil | RF-26, RF-29 | Reductores, lienzo y formularios cubiertos por `diagram_operations_test.dart`, `uml_canvas_controller_test.dart` y `uml_editor_widget_test.dart`. |
| CU-23 | Invitar mediante enlace o código | RF-21, RF-28 | Dos usuarios reales crearon y reclamaron un código en el emulador; suites de invitación cubren vencimiento, revocación, rol e idempotencia. |
| CU-24 | Generar y revisar artefactos desde Android | RF-30 | El recorrido Android generó Spring Boot y Flutter, abrió el árbol, comentó, comparó y descargó un ZIP. |
| CU-25 | Intercambiar y sincronizar trabajo desde Android | RF-16, RF-20, RF-29, RF-31, RF-32 | Recorrido Android XMI de ida y vuelta y persistencia real de una operación offline entre recreaciones; conflictos y replay cubiertos por pruebas específicas. |

## Verificación ejecutada

- PostgreSQL 18 local aislado en `127.0.0.1:55432`; seis migraciones aplicadas y `prisma migrate status` limpio.
- API en `http://localhost:3002/api` y web en `http://localhost:3000` mediante `INICIAR_LOCAL.cmd`, sin Docker.
- Recorrido HTTP real: registro, perfil, workspace, diagrama, operación durable, replay, XMI/JSON/ZIP, importación confirmada, Spring Boot, repositorio, OpenAPI/Postman, comentario, comparación, descarga, restauración y conflicto/resolución.
- WebSocket real: JWT aceptado antes de eventos, unión a diagrama y reproducción de una operación persistida.
- Backend: `npm test -- --runInBand --forceExit --silent` y `npm run build`.
- Frontend: `npm test`, `npm run type-check` y `npm run build`.
- Android: Flutter 3.35.7, `flutter analyze` sin observaciones, 65 pruebas Flutter y 2 recorridos de integración en emulador.
- El recorrido CU-21..CU-25 usó dos usuarios autenticados, invitación temporal, edición versionada, generación Spring Boot/Flutter, revisión/comentario/comparación/ZIP y reimportación XMI.
- `npm audit` informa 0 vulnerabilidades en las 804 dependencias del backend y 0 en las 550 del frontend.
- La APK se compiló, instaló y permaneció activa en Android 15 API 35 sin excepciones fatales.
- APK generado en `mobile/build/app/outputs/flutter-apk/app-debug.apk`.

La llamada al proveedor Claude no se ejecutó contra una cuenta real porque el entorno local verificado mantiene `ANTHROPIC_API_KEY` vacío. El contrato, selección configurable de modelo, redacción de secretos, validación de esquema, caducidad/autorización del token, ausencia de mutación durante propuesta, modo local explícito y trazabilidad tras confirmación sí están cubiertos por pruebas automatizadas.

FunctionGemma no se incluye dentro de la APK: el usuario descarga o importa el archivo oficial de 284 MB desde **Configuración > IA sin conexión**. El gestor muestra el progreso, comprueba su SHA-256 y permite retirarlo. La integración, el catálogo de herramientas y los límites del fallback están probados; la velocidad y memoria de inferencia deben validarse también en el teléfono Android físico objetivo porque dependen del hardware.
