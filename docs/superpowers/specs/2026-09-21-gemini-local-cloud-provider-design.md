# Selección de Gemini para la IA en la nube local

## Alcance

RF-08, RF-18 y CU-08 del PUDS mantienen sus contratos: una propuesta UML nunca modifica el diagrama sin confirmación y el refinamiento de backend solo admite las mejoras deterministas ya enumeradas. El asistente Android conserva FunctionGemma y su fallback sin conexión; cuando solicita la nube utiliza la misma API del backend que la web.

## Configuración y seguridad

`AI_PROVIDER=gemini` selecciona Gemini. `GEMINI_API_KEY` vive exclusivamente en `backend/.env`, archivo ignorado por Git; nunca se envía al frontend, a Android ni a la documentación. `AI_MODEL_MAIN` y `AI_MODEL_FAST` seleccionan modelos de Gemini (por defecto `gemini-3.8-flash`). `AI_PROVIDER=anthropic` preserva el proveedor anterior. Sin clave, la respuesta se identifica como fallback y nunca como IA en la nube. Una clave válida para listar modelos pero sin permiso de generación no se presenta como funcional.

## Flujo

Un adaptador de proveedor en el backend convierte texto o imagen en una respuesta de texto. Sus consumidores existentes cubren chat, propuesta UML desde texto, extracción de un diagrama desde imagen y plan de refinamiento de backend. El adaptador usa el formato de contenido del proveedor elegido; las respuestas siguen atravesando las validaciones, permisos, auditoría y confirmaciones existentes. Los errores del proveedor no exponen la clave ni guardan imágenes fallidas en archivos de diagnóstico.

## Verificación

Pruebas unitarias cubren selección de proveedor y modelo, respuesta de texto y de imagen, ausencia de clave, errores HTTP y ausencia de secretos en diagnósticos. Se ejecutan pruebas completas del backend y compilación. Una llamada real mínima confirma que la clave local puede generar; si Google devuelve un error de acceso del proyecto, la integración queda preparada, pero la activación requiere una clave de un proyecto con acceso.
