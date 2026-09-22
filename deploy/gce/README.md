# Preparación de despliegue en Google Cloud (sin ejecución remota)

Estado: **plantillas preparadas, no desplegado**. Esta primera etapa usa una VM de Compute Engine porque el backend actual conserva archivos en disco y Socket.IO funciona en una sola instancia. Cloud Run requeriría almacenamiento externo y un adaptador de eventos para varias instancias. [Discos persistentes de Compute Engine](https://docs.cloud.google.com/compute/docs/disks/persistent-disks), [sistema de archivos de Cloud Run](https://docs.cloud.google.com/run/docs/container-contract), [WebSockets en Cloud Run](https://docs.cloud.google.com/run/docs/triggering/websockets).

## Bloqueos previos

1. Proyecto de Google Cloud con facturación, cuota y permisos para Compute Engine, IP estática y DNS de un dominio controlado.
2. Clave Groq activa en el archivo privado del servidor. El proveedor y Qwen 3.8 ya respondieron correctamente en pruebas locales de texto, JSON e imagen. Nunca copiar una clave al repositorio.
3. Código en una revisión de lanzamiento verificable. Esta rama y sus cambios locales aún no se han subido a `main`; construir el paquete desde el estado que se pruebe, no desde una versión antigua del remoto.
   Ejecutar `node deploy/gce/preflight.mjs --scan-tracked` en el repositorio antes de empaquetar; informa nombres de archivos sospechosos sin imprimir secretos.
4. Android debe apuntar en Configuración a `https://DOMINIO/api`. Probar instalación, login, edición y sincronización contra el dominio antes de anunciar el servicio.

## Topología de primera etapa

- VM Ubuntu LTS con IP estática; abrir al público solo TCP 80/443. SSH restringido al administrador o IAP. No abrir 3000, 3002 ni 5432.
- PostgreSQL escuchando únicamente en `127.0.0.1`; datos en `/var/lib/postgresql`.
- Archivos generados y repositorio interno en `/var/lib/proyecto-software1/{generated-projects,artifacts}`. Ambos directorios y PostgreSQL viven en un **Persistent Disk** independiente del checkout; conservar el disco al eliminar la VM y programar snapshots. No cambiar a almacenamiento efímero.
- Caddy termina TLS y enruta `/api/*` y `/socket.io/*` a NestJS; el resto a Next.js. Caddy gestiona certificados cuando DNS y puertos 80/443 funcionan.
- Backend y frontend corren con usuario sin privilegios `proyecto` mediante systemd. No se ejecutan como root.

## Preparación de la VM

1. Reservar IP estática, crear VM/disco persistente con eliminación automática del disco desactivada, apuntar DNS al IP, crear reglas de firewall para 80/443 y acceso administrativo restringido. Configurar snapshots del disco; [programación oficial de snapshots](https://docs.cloud.google.com/compute/docs/disks/about-snapshot-schedules).
2. Instalar Node.js compatible con Next 16 (22 LTS), PostgreSQL, Caddy y utilidades de respaldo. Verificar `node --version`, `npm --version`, `psql --version`, `caddy version` y que Node esté en `/usr/bin/node` (o adaptar los `ExecStart`).
3. Crear usuario `proyecto`, directorios `/opt/proyecto/releases`, `/var/lib/proyecto-software1/generated-projects`, `/var/lib/proyecto-software1/artifacts` y `/etc/proyecto-software1`. Asignar los dos directorios de datos al usuario `proyecto`. Mantener `/etc/proyecto-software1/backend.env` legible solo por root; systemd lo cargará.
4. Crear rol/base PostgreSQL locales para la aplicación. Usar una contraseña aleatoria distinta del JWT. Comprobar que PostgreSQL no escucha en IP pública.
5. Copiar el código **sin** `.env`, `node_modules`, `.git`, `generated-projects`, `artifacts`, `build` ni `.next` a `/opt/proyecto/releases/<id>`. No exportar esta carpeta de trabajo sin revisar archivos no rastreados o secretos. Enlazar `/opt/proyecto/current` al nuevo release solo después de construirlo y validarlo.
6. Crear `backend.env` privado a partir de `backend.env.example`, sustituir TODOS los `REPLACE_*`, configurar dominio HTTPS, clave Groq, secreto JWT >=32 caracteres y rutas absolutas. Validar sin imprimir secretos:

   ```sh
   node /opt/proyecto/releases/<id>/deploy/gce/preflight.mjs /etc/proyecto-software1/backend.env
   ```

7. Configurar las variables de `frontend.build.env.example` **antes** de `npm run build`: Next incorpora `NEXT_PUBLIC_*` en el bundle; si cambia el dominio se debe reconstruir. API: `https://DOMINIO/api`; WebSocket: `https://DOMINIO`.
8. Ejecutar `npm ci && npm run build` en `backend/` y `frontend/`, y `npx prisma generate` en `backend/`. Ejecutar las pruebas antes del corte. Tras verificar el release, actualizar el enlace `/opt/proyecto/current` a `/opt/proyecto/releases/<id>` de forma atómica.
9. Instalar las tres unidades `.service` en `/etc/systemd/system/`, sustituir `REPLACE_DOMAIN` en Caddyfile y ubicarlo en `/etc/caddy/Caddyfile`. Validar con `caddy validate --config /etc/caddy/Caddyfile` y `systemd-analyze verify` para las unidades. Con respaldo reciente, ejecutar `systemctl daemon-reload` y `systemctl start proyecto-migrate` **una sola vez por release**; esta unidad carga `DATABASE_URL` desde el `EnvironmentFile` privado. Confirmar éxito con `systemctl status proyecto-migrate`; no usar `migrate dev` en producción. Activar servicios con `systemctl enable --now proyecto-backend proyecto-frontend caddy`.

## Verificación antes de anunciarlo

- `systemctl is-active postgresql proyecto-backend proyecto-frontend caddy` devuelve `active` para todos.
- `curl -I https://DOMINIO/login` devuelve una respuesta de la web y el certificado corresponde al dominio.
- `curl -i https://DOMINIO/api/...` alcanza la API (una ruta privada puede responder 401; 404 de Caddy no es válido).
- Registro/login de prueba, creación de proyecto/diagrama, colaboración entre dos sesiones, generación Spring Boot, descarga de revisión y archivo persistido tras reiniciar ambos servicios.
- Prueba Groq con texto, JSON e imagen y revisión del registro sin exponer claves. Un 401/403/429 impide marcar IA cloud como aprobada hasta resolver credenciales o cuota.
- APK Android configurada con el dominio, cuenta de prueba, invitación, edición, modo avión, cola pendiente y reconexión. FunctionGemma requiere además prueba en dispositivo físico compatible.
- Revisar `journalctl -u proyecto-backend -u proyecto-frontend` y certificados Caddy. No registrar cuerpos de solicitudes que contengan secretos.

## Respaldo y reversión

- Tomar snapshot del Persistent Disk y un `pg_dump` antes de cada migración. Respaldar `/var/lib/proyecto-software1` junto con la base; comprobar periódicamente restauración en una VM aislada. Los snapshots solos no sustituyen una prueba de restauración.
- Para volver a la versión anterior de la aplicación, detener servicios, cambiar el enlace `current` al release anterior y reiniciar. **No** borrar datos ni ejecutar `migrate reset`. Si una migración no es compatible hacia atrás, restaurar la base y los archivos desde el respaldo coherente; planificar esa ventana antes del corte.
- La primera VM es un piloto de una sola instancia, sin alta disponibilidad. Escalar posteriormente exige almacenamiento externo, Redis/adaptador Socket.IO, balanceo y pruebas de consistencia.
