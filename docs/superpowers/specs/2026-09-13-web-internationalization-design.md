# Diseño de internacionalización web Español/English

Fecha: 2026-09-13

## Contexto

La interfaz web contiene textos en inglés y español distribuidos entre páginas y componentes. No existe una fuente central de traducciones ni una preferencia global de idioma. El cambio incorporará dos idiomas a toda la aplicación web sin modificar las rutas actuales ni el contrato del backend.

## Objetivos

- Ofrecer Español (`es`) e English (`en`) en toda la interfaz web.
- Detectar el idioma preferido del navegador durante la primera visita.
- Permitir el cambio manual desde las pantallas públicas y autenticadas.
- Conservar la elección entre recargas y nuevas sesiones del navegador.
- Mantener el diseño profesional, el modo oscuro y la accesibilidad actuales.
- Traducir navegación, formularios, validaciones, estados vacíos, diálogos, herramientas UML, IA, generación de código, repositorio y miembros.

## No objetivos

- Traducir mensajes técnicos emitidos directamente por el backend.
- Traducir nombres creados por usuarios, código fuente, UML o contenido generado.
- Incorporar idiomas adicionales en esta entrega.
- Cambiar URLs según el idioma.
- Agregar una dependencia externa de internacionalización.

## Enfoque elegido

Se utilizará un contexto React propio con catálogos tipados. Es la opción más conveniente para el tamaño actual del proyecto: evita una nueva dependencia, conserva las rutas existentes y permite migrar los componentes gradualmente con verificación automática de claves.

El catálogo inglés será la referencia estructural. El catálogo español deberá implementar exactamente las mismas claves. TypeScript y una prueba de paridad impedirán publicar una traducción incompleta.

## Arquitectura

### Modelo de idioma

Los únicos valores válidos serán `en` y `es`. La resolución inicial seguirá este orden:

1. Preferencia manual válida almacenada por la aplicación.
2. Idioma indicado por el navegador.
3. Inglés como alternativa final.

Al cambiar el idioma se actualizarán el estado global, `localStorage`, una cookie y el atributo `lang` del documento. La cookie permite que el layout entregue el idioma correcto desde el primer renderizado; `localStorage` conserva compatibilidad con el almacenamiento del navegador.

### Catálogos

Los catálogos usarán claves planas y semánticas, por ejemplo `auth.login.title`, `workspace.create.button` y `repository.revision.restore`. La función `t` aceptará variables para textos como saludos, cantidades y nombres. Las cantidades que necesiten singular y plural tendrán claves independientes para evitar reglas implícitas difíciles de revisar.

### Proveedor y consumo

`I18nProvider` envolverá toda la aplicación desde el layout. El hook `useI18n` expondrá:

- `locale`: idioma activo.
- `setLocale(locale)`: cambio manual persistente.
- `t(key, variables)`: traducción e interpolación segura.
- `formatDate(value)`: fechas con la configuración regional activa.

Las utilidades de detección, normalización e interpolación permanecerán separadas del componente React para poder probarse sin navegador.

## Selector de idioma

Se incorporará un control compacto `ES | EN`, compatible con teclado y lector de pantalla. Usará la misma jerarquía visual neutra del selector de tema y no añadirá colores decorativos.

Ubicaciones:

- Esquina superior derecha en login y registro, junto al modo oscuro.
- Cabecera del dashboard.
- Cabecera del espacio de trabajo.
- Barra superior del editor UML.

El control mostrará claramente el idioma activo y tendrá un nombre accesible traducido.

## Cobertura de interfaz

La migración abarcará:

- Inicio, login, registro y dashboard.
- Creación y listado de espacios de trabajo.
- Detalle del espacio, estadísticas, diagramas y colaboradores.
- Editor UML, barra lateral, barra de herramientas, clases y relaciones.
- Chat de IA y mensajes de estado controlados por el frontend.
- Generación y descarga de Spring Boot y Flutter.
- Repositorio interno: revisiones, árbol, archivos, comparación, restauración y comentarios.
- Administración de miembros, roles y política de comentarios.
- Selector de tema, etiquetas accesibles, estados de carga, errores genéricos y confirmaciones.

## Errores y datos dinámicos

Los errores de validación creados en el frontend usarán el catálogo activo. Los mensajes desconocidos recibidos del backend se mostrarán como detalle técnico acompañado por un encabezado localizado. Los nombres de personas, proyectos, diagramas, archivos y clases no se traducirán.

Las fechas se formatearán con `es-BO` para español y `en-US` para inglés. Los identificadores, rutas y fragmentos de código conservarán su formato original.

## Accesibilidad y experiencia

- El selector tendrá botones de al menos 44 píxeles de alto o un área interactiva equivalente.
- El estado activo no dependerá únicamente del color.
- `aria-label`, títulos y texto alternativo cambiarán con el idioma.
- El foco visible y el comportamiento responsive actuales se conservarán.
- El cambio será inmediato y no recargará la página.

## Pruebas

- Pruebas unitarias de normalización y detección de idioma.
- Prueba de paridad exacta entre catálogos inglés y español.
- Pruebas de interpolación y formato regional.
- Prueba de persistencia del cambio manual.
- Pruebas existentes de frontend y backend sin regresiones.
- Type-check y build de producción.
- Recorrido manual en ambos idiomas por autenticación, dashboard, workspace, editor, IA y repositorio.

## Criterios de aceptación

- Toda cadena visible controlada por el frontend puede mostrarse en español o inglés.
- El selector aparece en todas las áreas principales y cambia la interfaz inmediatamente.
- La preferencia sobrevive una recarga y una nueva sesión del navegador.
- La primera visita respeta el idioma del navegador.
- El modo oscuro, colaboración, editor y repositorio continúan funcionando.
- No existen claves ausentes entre catálogos ni errores de TypeScript o build.
