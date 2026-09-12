# ProyectoSOFTWARE1

Plataforma colaborativa para diseñar modelos UML y generar proyectos de software a partir de diagramas de clases. Este monorepositorio reúne la aplicación web, la API y la documentación del Primer Parcial.

## Estructura

```text
frontend/  Aplicación web con Next.js, React Flow y Socket.IO
backend/   API NestJS, Prisma, colaboración y generación de código
mobile/    Alcance y futura aplicación Flutter offline-first
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

## Ampliaciones pendientes

- Aplicación móvil Flutter con operación offline-first.
- Chat de IA por texto y audio, con funciones básicas locales.
- Sincronización de operaciones y resolución de conflictos.
- Importación y exportación UML mediante XMI, JSON y ZIP propio.
- Despliegue objetivo sobre servicios administrados de Google Cloud.

Estas ampliaciones siguen documentadas como entregas posteriores; no forman parte de la implementación actual.

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
```

El frontend verifica tema, árbol de archivos y capacidades por rol. El backend prueba autorización, auditoría, almacenamiento seguro, publicación, revisión, descarga, restauración, comentarios, miembros y autenticación WebSocket.

## Compatibilidad

Los ZIP generados antes de esta ampliación continúan disponibles desde la ruta histórica, ahora protegida por membresía del proyecto. Las generaciones nuevas se descargan desde el repositorio interno. Google Cloud Storage, XMI, aplicación móvil, sincronización offline e IA local permanecen en fases posteriores del PUDS.

## Repositorio oficial

Este proyecto se mantiene en [Santyxd353/ProyectoSOFTWARE1](https://github.com/Santyxd353/ProyectoSOFTWARE1).
