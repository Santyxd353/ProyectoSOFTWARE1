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
- Interfaz profesional con tema claro y modo oscuro.

## Ampliaciones diseñadas

- Repositorio interno con revisiones navegables del código generado.
- Aplicación móvil Flutter con operación offline-first.
- Chat de IA por texto y audio, con funciones básicas locales.
- Sincronización de operaciones y resolución de conflictos.
- Importación y exportación UML mediante XMI, JSON y ZIP propio.
- Despliegue objetivo sobre servicios administrados de Google Cloud.

Las ampliaciones se describen como diseño hasta que su implementación y pruebas estén incorporadas al repositorio.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- PostgreSQL accesible para el backend.
- Claves de servicios de IA únicamente cuando se habiliten esas funciones.

## Configuración

1. Copiar `frontend/.env.example` como `frontend/.env.local`.
2. Copiar `backend/.env.example` como `backend/.env`.
3. Sustituir los valores de ejemplo por credenciales locales. Los archivos reales de entorno no deben incluirse en Git.

## Ejecución local

Backend:

```powershell
cd backend
npm ci
npx prisma generate
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

El frontend incluye pruebas automatizadas para la preferencia de tema. El backend compila correctamente, pero el código base todavía no incorpora archivos `*.spec.ts`; esa cobertura deberá añadirse junto con las nuevas funcionalidades.

## Repositorio oficial

Este proyecto se mantiene en [Santyxd353/ProyectoSOFTWARE1](https://github.com/Santyxd353/ProyectoSOFTWARE1).
