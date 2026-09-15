# ProyectoSOFTWARE1

Plataforma colaborativa para diseñar modelos UML y generar proyectos de software a partir de diagramas de clases. Este monorepositorio reúne la aplicación web, la API y la documentación del Primer Parcial.

## Estructura

```text
frontend/  Aplicación web con Next.js, React Flow y Socket.IO
backend/   API NestJS, Prisma, colaboración y generación de código
mobile/    Aplicación Flutter Android offline-first
docs/      PUDS y documentación técnica del proyecto
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
- Aplicación Android con caché local, cola offline, asistente por texto/voz y comandos UML básicos sin internet.

## Alcance pendiente para despliegue

- Despliegue objetivo sobre servicios administrados de Google Cloud.
- Sustitución de las rutas locales de artefactos y base de datos por servicios administrados.
- Configuración productiva de secretos, dominios, HTTPS, observabilidad y publicación Android.

La versión actual está preparada y verificada para desarrollo local. La adaptación a Google Cloud se realizará al final, como se acordó, sin mezclar configuración productiva con esta etapa.

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

Cada ejecución posterior vuelve a verificar el cliente Prisma y ejecuta `prisma migrate deploy`, por lo que una actualización del repositorio no deja la base local desfasada.

Después abre `http://localhost:3000`. Los registros quedan en `.local/logs/`.

Para detener todo:

```powershell
.\DETENER_LOCAL.cmd
```

Docker Desktop no es necesario. Las funciones normales, colaboración y repositorio interno pueden probarse sin claves externas. Para probar la IA online, agrega una clave válida en `backend/.env` después de la preparación inicial.

El refinamiento con IA acepta únicamente mejoras deterministas soportadas, muestra la propuesta y no genera una revisión hasta recibir confirmación. Los secretos detectados se sustituyen por `[REDACTED]` antes de enviar la instrucción al proveedor.

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

El frontend verifica idioma, tema, colaboración durable, árbol de archivos y capacidades por rol. El backend prueba autorización, auditoría, almacenamiento seguro, publicación, revisión, descarga, restauración, comentarios, miembros, intercambio UML, generación de artefactos, refinamiento confirmado y autenticación WebSocket. Android verifica IA local, persistencia, cola offline, sincronización y conflictos.

La evidencia RF/CU y el recorrido local verificado están en [docs/TRACEABILITY.md](docs/TRACEABILITY.md).

## Compatibilidad

Los ZIP generados antes de esta ampliación continúan disponibles desde la ruta histórica, ahora protegida por membresía del proyecto. Las generaciones nuevas se descargan desde el repositorio interno. La interoperabilidad acepta XMI 2.1, 2.5 y 2.5.1, además del JSON canónico y el paquete ZIP propio; toda importación exige vista previa y confirmación.

## Repositorio oficial

Este proyecto se mantiene en [Santyxd353/ProyectoSOFTWARE1](https://github.com/Santyxd353/ProyectoSOFTWARE1).
