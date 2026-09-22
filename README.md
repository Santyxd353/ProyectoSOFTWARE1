# ProyectoSOFTWARE1

Plataforma colaborativa para diseñar modelos UML y generar proyectos de software a partir de diagramas de clases. Este monorepositorio reúne la aplicación web, la API y la documentación del Primer Parcial.

## Estructura

```text
frontend/  Aplicación web con Next.js, React Flow y Socket.IO
backend/   API NestJS, Prisma, colaboración y generación de código
mobile/    Aplicación Flutter Android offline-first
docs/      PUDS y documentación técnica del proyecto
deploy/    Plantillas reproducibles para Azure y Google Cloud
```

## Funcionalidad presente en el código base

- Registro, autenticación y control de acceso.
- Creación de espacios de trabajo y diagramas UML.
- Edición de clases, atributos, métodos y relaciones.
- Colaboración en tiempo real mediante WebSocket.
- Asistente de IA conectado desde el backend.
- Generación de backend y frontend a partir del modelo.
- Repositorio interno de código con revisiones inmutables.
- Árbol de archivos, visor textual/binario y comparación entre revisiones.
- Descarga ZIP, restauración histórica y comentarios en tiempo real.
- Administración de roles y política de comentarios para observadores.
- Interfaz profesional con tema claro y modo oscuro.
- Sincronización durable e idempotente, reproducción al reconectar y resolución de conflictos.
- Importación y exportación confirmada mediante XMI 2.1/2.5.1, JSON y ZIP propio.
- Especificación OpenAPI y colección Postman dentro de cada backend generado.
- Refinamiento de backend asistido por IA, con propuesta previa y aplicación determinista confirmada.
- Selección parcial de propuestas UML y mejoras de backend, con diferencias visibles antes de publicar.
- Fusión automática de ediciones UML independientes; los cambios incompatibles conservan un conflicto explícito.
- Aplicación Android con editor UML táctil, colaboración, invitaciones, repositorio, intercambio XMI/JSON/ZIP, cola offline y asistente híbrido por texto/voz.
- FunctionGemma 270M opcional en el dispositivo, con descarga/importación, verificación SHA-256, catálogo cerrado de acciones y fallback básico identificado.

## Despliegue

- Despliegue piloto objetivo en una VM de Azure; plantillas en `deploy/azure/`.
- Sustitución de las rutas locales de artefactos y base de datos por servicios administrados.
- Configuración productiva de secretos, dominios, HTTPS, observabilidad y publicación Android.

La versión actual está preparada y verificada para desarrollo local y para una VM piloto de Azure. Las credenciales productivas se mantienen fuera del repositorio.

## Idiomas

La aplicación web está disponible completamente en español e inglés. En la primera visita detecta el idioma preferido del navegador y usa inglés cuando la preferencia no es compatible. El selector `ES | EN`, ubicado junto al control de tema, aplica el cambio inmediatamente y conserva la elección en el navegador para las siguientes visitas.

## Repositorio interno

Cada generación Spring Boot o Flutter crea una revisión vinculada con proyecto, diagrama, versión UML, autor y generador. Los archivos se guardan mediante una abstracción de almacenamiento: PostgreSQL conserva metadatos, permisos, comentarios y auditoría; `ARTIFACT_STORAGE_PATH` conserva los bytes durante desarrollo local.

| Acción | OWNER | EDITOR | VIEWER |
| --- | --- | --- | --- |
| Abrir, comparar y descargar | Sí | Sí | Sí |
| Generar y restaurar | Sí | Sí | No |
| Comentar | Sí | Sí | Según política del proyecto |
| Administrar miembros y política | Sí | No | No |

La pestaña **Código** permite navegar archivos, comparar revisiones, descargar ZIP, restaurar una versión como revisión nueva y comentar archivos o líneas. La pestaña **Miembros** permite al propietario actualizar roles, retirar colaboradores y decidir si los observadores pueden comentar.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- PostgreSQL accesible para el backend.
- Claves de servicios de IA únicamente cuando se habiliten esas funciones.

## Configuración

1. Copiar `frontend/.env.example` como `frontend/.env.local`.
2. Copiar `backend/.env.example` como `backend/.env`.
3. Sustituir los valores de ejemplo por credenciales locales. Los archivos reales de entorno no deben incluirse en Git.

Variables esenciales del backend:

```dotenv
DATABASE_URL="postgresql://usuario:clave@localhost:5432/uml_platform?schema=public"
JWT_SECRET="una-clave-larga-y-privada"
ARTIFACT_STORAGE_PATH="./artifacts"
REPOSITORY_TEXT_MAX_BYTES=1000000
REPOSITORY_DIFF_MAX_BYTES=1000000
```

## Inicio rápido en Windows sin Docker

Ejecuta `INICIAR_LOCAL.cmd` desde el Explorador de archivos o una terminal:

```powershell
.\INICIAR_LOCAL.cmd
```

La primera ejecución crea un PostgreSQL aislado dentro de `.local/`, genera credenciales aleatorias fuera de Git, instala dependencias cuando faltan, aplica las migraciones e inicia backend y frontend en segundo plano.

Cada ejecución posterior compara el hash de los archivos `package-lock.json`, reinstala únicamente las dependencias desfasadas, vuelve a generar el cliente Prisma y ejecuta `prisma migrate deploy`. Así, una actualización del repositorio no deja dependencias ni base de datos desfasadas.

Después abre `http://localhost:3000`. Los registros quedan en `.local/logs/`.

Para detener todo:

```powershell
.\DETENER_LOCAL.cmd
```

Docker Desktop no es necesario. Las funciones normales, colaboración y repositorio interno pueden probarse sin claves externas. Para probar la IA online en local, configura `AI_PROVIDER=groq`, `GROQ_API_KEY`, `AI_MODEL_MAIN=qwen/qwen3.8-27b` y `AI_MODEL_FAST=qwen/qwen3.8-27b` en líneas separadas del archivo ignorado `backend/.env` y reinicia la API. La clave nunca debe copiarse al frontend ni a Android. Gemini y Anthropic continúan disponibles con `AI_PROVIDER=gemini`/`GEMINI_API_KEY` y `AI_PROVIDER=anthropic`/`ANTHROPIC_API_KEY`.

Una clave que permite listar modelos no necesariamente puede generar contenido: si Google responde `403 PERMISSION_DENIED` por el proyecto, el chat lo informa y usa el fallback local; se necesita una clave de un proyecto con acceso para activar la IA en la nube. La clave de prueba no se incluye en Git.

El refinamiento con IA acepta únicamente mejoras deterministas soportadas, muestra la propuesta y no genera una revisión hasta recibir confirmación. Los secretos detectados se sustituyen por `[REDACTED]` antes de enviar la instrucción al proveedor.

## Android local

Con un emulador iniciado o un teléfono Android conectado:

```powershell
cd mobile
flutter pub get
flutter run
```

El emulador usa por defecto `http://10.0.2.2:3002/api`. En un teléfono físico, abre **Configurar servidor local** y usa `http://IP_DE_TU_PC:3002/api`; ambos dispositivos deben estar en la misma red y el firewall debe permitir el puerto.

La IA básica funciona sin descargar pesos. Para usar FunctionGemma sin internet después de la instalación, abre **Configuración > IA sin conexión > Descargar modelo oficial**. El archivo ocupa aproximadamente 284 MB y se verifica con SHA-256 antes de activarse. Las eliminaciones propuestas por IA nunca se ejecutan sin confirmación.

## Ejecución local

Backend:

```powershell
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Frontend, en otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

La interfaz web queda disponible normalmente en `http://localhost:3000` y la API en `http://localhost:3002`.

## Verificación

```powershell
cd frontend
npm test
npm run type-check
npm run build

cd ..\backend
npm test -- --runInBand
npm run build

cd ..\mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

El frontend verifica idioma, tema, colaboración durable, árbol de archivos y capacidades por rol. El backend prueba autorización, auditoría, almacenamiento seguro, publicación, revisión, descarga, restauración, comentarios, miembros, intercambio UML, generación de artefactos, refinamiento confirmado y autenticación WebSocket. Android verifica IA local, editor táctil, persistencia, cola offline, colaboración, invitaciones, repositorio, intercambio y conflictos. El recorrido integral está en `mobile/integration_test/android_parity_journey_test.dart`.

La evidencia RF/CU y el recorrido local verificado están en [docs/TRACEABILITY.md](docs/TRACEABILITY.md).

## Compatibilidad

Los ZIP generados antes de esta ampliación continúan disponibles desde la ruta histórica, ahora protegida por membresía del proyecto. Las generaciones nuevas se descargan desde el repositorio interno. La interoperabilidad acepta XMI 2.1, 2.5 y 2.5.1, además del JSON canónico y el paquete ZIP propio; toda importación exige vista previa y confirmación.

## Repositorio oficial

Este proyecto se mantiene en [Santyxd353/ProyectoSOFTWARE1](https://github.com/Santyxd353/ProyectoSOFTWARE1).
