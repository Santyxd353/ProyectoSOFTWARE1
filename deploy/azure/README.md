# Despliegue en Azure VM

Piloto de una sola instancia para ProyectoSOFTWARE1. La VM usa Ubuntu 24.04,
PostgreSQL 16, Node.js 22, Caddy y servicios systemd. Solo se exponen 22, 80 y
443; PostgreSQL, Next.js y NestJS escuchan localmente.

## Recursos

- Grupo: `rg-proyectosoftware1`
- VM: `vm-proyectosoftware1`
- Tamaño: `Standard_D2as_v7` (2 vCPU, 8 GiB)
- Disco: 64 GiB Standard SSD LRS
- Datos persistentes: `/var/lib/proyecto-software1`
- Aplicación: `/opt/proyecto/current`

## Instalación

1. Instalar Node.js 22, PostgreSQL, Caddy, Git y certificados.
2. Crear el usuario del sistema `proyecto` y los directorios persistentes.
3. Crear la base `uml_platform` y un usuario PostgreSQL exclusivo.
4. Instalar dependencias con `npm ci`, generar Prisma y compilar backend/web.
5. Guardar secretos únicamente en `/etc/proyecto-software1/backend.env` con
   permisos `600`.
6. Instalar las unidades systemd y `Caddyfile`, ejecutar migraciones y arrancar.
7. Validar `/api/health`, autenticación, WebSocket, Groq y una operación UML.

El script `bootstrap.sh` automatiza la instalación de la aplicación después de
preparar la VM. Recibe el origen público como primer argumento y espera la clave
Groq en `/tmp/backend.local.env`; elimina ese archivo tras crear el entorno
privado del servicio.

Antes de habilitar HTTPS se debe asignar un DNS a la IP pública. Reemplazar
`REPLACE_DOMAIN` en las plantillas. La clave Groq nunca se almacena en Git.
