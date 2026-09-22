# Documentación

Esta carpeta contiene la documentación académica y técnica del proyecto.

El entregable principal es `Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf`. La versión vigente contiene 32 requisitos funcionales y 25 casos de uso. `TRACEABILITY.md` relaciona cada requisito con su código, pruebas y estado real; RF-25 a RF-32 y CU-21 a CU-25 ya cuentan con implementación y evidencia local en Android.

- Diseño: `superpowers/specs/2026-09-12-internal-code-repository-design.md`
- Plan y evidencia TDD: `superpowers/plans/2026-09-12-internal-code-repository-implementation.md`

La aplicación Android, XMI/JSON/ZIP, sincronización offline, colaboración, repositorio de código e IA híbrida ya forman parte del monorepositorio. El despliegue piloto usa una VM única de Azure y está documentado en `../deploy/azure/README.md`; se conserva `../deploy/gce/` como alternativa.

El PUDS entregado describe Gemini como proveedor cloud seleccionado (secciones 5.6 y 8.2). Esa integración permanece disponible, pero dos claves recibieron 403 de Google al generar. Para cerrar la operación cloud sin cambiar los casos de uso, el adaptador común admite Groq como proveedor principal; Qwen 3.8 fue verificado con texto, JSON e imagen reales. La sustitución es una decisión de infraestructura: las interfaces, confirmaciones y fallback documentados no cambian.

Repositorio oficial: [Santyxd353/ProyectoSOFTWARE1](https://github.com/Santyxd353/ProyectoSOFTWARE1).
