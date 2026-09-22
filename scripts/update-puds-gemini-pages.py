"""Refresh PUDS status pages without changing page count or TOC targets."""

from io import BytesIO
from pathlib import Path
import os

from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "docs" / "Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf"
PAGE_W, PAGE_H = 612, 792
INK = colors.HexColor("#20252b")
GRAY = colors.HexColor("#555b61")
GRID = colors.HexColor("#888888")
HEADER_BG = colors.HexColor("#f7f7f7")


def paragraph(text, size=8.5, bold=False):
    style = ParagraphStyle(
        "cell", fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size, leading=size + 2, textColor=INK,
    )
    return Paragraph(text, style)


def heading(c, title, subtitle, number):
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(54, 760, title)
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 10)
    c.drawString(54, 732, subtitle)
    c.setFillColor(INK)
    c.setFont("Helvetica", 8)
    c.drawRightString(558, 24, str(number))


def draw_table(c, data, widths, top, heights=None):
    table = Table(data, colWidths=widths, rowHeights=heights)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), .55, GRID),
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    _, height = table.wrapOn(c, sum(widths), PAGE_H)
    table.drawOn(c, 54, top - height)
    return top - height


def body_lines(c, lines, top=687, spacing=38):
    for index, line in enumerate(lines):
        item = paragraph(line, 10)
        item.wrapOn(c, 504, spacing - 3)
        item.drawOn(c, 54, top - index * spacing)


def page_85(c):
    heading(c, "4.6 Mapeo lógico-físico", "Correspondencia comprobada con el esquema Prisma actual.", 85)
    rows = [
        [paragraph("Concepto", bold=True), paragraph("Persistencia real", bold=True), paragraph("Observación", bold=True)],
        [paragraph("Usuarios y proyectos"), paragraph("users / workspaces"), paragraph("Propiedad y acceso por rol.")],
        [paragraph("Participantes e invitaciones"), paragraph("workspace_collaborators / workspace_invitations"), paragraph("Roles, expiración y revocación.")],
        [paragraph("Modelo UML"), paragraph("diagrams / uml_classes / uml_attributes / uml_methods / uml_relations"), paragraph("Estado y elementos editables.")],
        [paragraph("Operaciones y conflictos"), paragraph("diagram_operations / sync_conflicts"), paragraph("Secuencia durable y variantes.")],
        [paragraph("Código generado"), paragraph("generated_codes / code_revisions / revision_files"), paragraph("Revisiones inmutables y archivos.")],
        [paragraph("Auditoría"), paragraph("diagram_activities / audit_events"), paragraph("Autor y momento del evento.")],
    ]
    bottom = draw_table(c, rows, [126, 209, 169], 691, [30, 47, 59, 59, 47, 47, 47])
    note = paragraph(
        "La cola de cambios pendientes permanece en el almacenamiento local de Android; "
        "el servidor registra las operaciones confirmadas en diagram_operations. "
        "Los artefactos se guardan en el directorio persistente configurado por la API. "
        "Cloud SQL y Cloud Storage son alternativas futuras, no el estado desplegado.", 10)
    note.wrapOn(c, 504, 100)
    note.drawOn(c, 54, bottom - 112)


def page_24(c):
    heading(c, "1.19 Despliegue en Google Cloud",
            "Fundamentación de una primera etapa verificable y su posible evolución.", 24)
    body_lines(c, [
        "Compute Engine permite ejecutar el frontend, la API, PostgreSQL y Socket.IO en una VM única.",
        "El disco persistente conserva la base de datos y los artefactos fuera de cada release; Caddy ofrece HTTPS.",
        "El piloto no proporciona alta disponibilidad. El acceso público se limita a 80/443 y se programan respaldos.",
        "Cloud Run, Cloud SQL, Cloud Storage y Redis son opciones para una fase distribuida posterior; requieren adaptar almacenamiento y eventos entre instancias.",
        "El despliegue remoto aún no se ha efectuado; la guía y las plantillas se verifican localmente.",
    ], spacing=80)
    rows = [
        [paragraph("Criterio", bold=True), paragraph("Aplicación en el proyecto", bold=True)],
        [paragraph("Persistencia"), paragraph("Base y artefactos en disco persistente, fuera de /opt/proyecto/current.")],
        [paragraph("Seguridad"), paragraph("Secretos fuera del repositorio, TLS y puertos internos cerrados.")],
        [paragraph("Escalado futuro"), paragraph("Separar estado y agregar coordinación distribuida antes de múltiples instancias.")],
    ]
    draw_table(c, rows, [136, 368], 360, [30, 54, 54, 54])


def page_80(c):
    heading(c, "4.1 Diseño físico para Google Cloud",
            "Topología de lanzamiento preparada; recursos remotos aún no creados.", 80)
    rows = [
        [paragraph("Criterio", bold=True), paragraph("Decisión de primera etapa", bold=True)],
        [paragraph("Ejecución"), paragraph("Una VM Compute Engine con frontend Next.js, API NestJS y Socket.IO.")],
        [paragraph("Datos"), paragraph("PostgreSQL local y archivos de revisiones en Persistent Disk, fuera del checkout.")],
        [paragraph("Acceso"), paragraph("Caddy termina HTTPS; solo 80/443 públicos; PostgreSQL y servicios internos en loopback.")],
        [paragraph("Respaldo"), paragraph("pg_dump y snapshots del disco con prueba periódica de restauración.")],
        [paragraph("Evolución"), paragraph("Cloud Run exige almacenamiento externo y coordinación de eventos multiinstancia.")],
    ]
    bottom = draw_table(c, rows, [126, 378], 682, [32, 54, 54, 54, 54, 54])
    body_lines(c, [
        "Esta topología prioriza una publicación reproducible sin fingir escalado horizontal.",
        "La clave Gemini probada recibe 403; la verificación del proveedor es una puerta de salida independiente.",
    ], top=bottom - 62, spacing=58)


def page_108(c):
    heading(c, "5.7 Preparación para Google Cloud",
            "Decisiones de despliegue vinculadas al código y a su estado real.", 108)
    body_lines(c, [
        "La primera publicación propuesta utiliza Compute Engine de instancia única, no Cloud Run.",
        "PostgreSQL y los directorios de artefactos viven en disco persistente fuera del release; systemd gestiona los procesos.",
        "Caddy enruta HTTPS hacia Next.js, API y Socket.IO. La base solo escucha en 127.0.0.1.",
        "El preflight comprueba configuración y rutas; migraciones, snapshots, smoke tests y rollback figuran en deploy/gce/README.md.",
        "El despliegue remoto, la clave Gemini autorizada y la prueba Android física siguen pendientes.",
    ], spacing=78)
    rows = [
        [paragraph("Dimensión", bold=True), paragraph("Criterio de aceptación", bold=True)],
        [paragraph("Seguridad"), paragraph("TLS válido, JWT robusto, clave IA fuera de Git y 5432/3000/3002 privados.")],
        [paragraph("Durabilidad"), paragraph("Base y ZIPs sobreviven reinicios y reemplazos de release.")],
        [paragraph("Validación"), paragraph("Web, API, WebSocket, repositorio y APK probados en el dominio antes del anuncio.")],
    ]
    draw_table(c, rows, [126, 378], 263, [30, 53, 53, 53])


def page_86(c):
    heading(c, "4.7 Diseño físico - extracto verificable",
            "Restricciones relevantes del esquema Prisma y migraciones del proyecto.", 86)
    rows = [
        [paragraph("Tabla", bold=True), paragraph("Restricción vigente", bold=True), paragraph("Propósito", bold=True)],
        [paragraph("diagram_operations"), paragraph("UNIQUE(deviceId, clientSequence)"), paragraph("Evita repetir una operación móvil o web.")],
        [paragraph("diagram_operations"), paragraph("UNIQUE(diagramId, serverSequence)"), paragraph("Ordena los eventos del diagrama.")],
        [paragraph("revision_files"), paragraph("UNIQUE(revisionId, path)"), paragraph("Mantiene una ruta única por revisión.")],
        [paragraph("code_revisions"), paragraph("Índices por proyecto y diagrama"), paragraph("Permite consultar el historial.")],
        [paragraph("sync_conflicts"), paragraph("Índices por estado y diagrama"), paragraph("Facilita la revisión de variantes.")],
    ]
    bottom = draw_table(c, rows, [130, 195, 179], 682, [30, 57, 57, 57, 57, 57])
    body_lines(c, [
        "La estructura ejecutable se define en backend/prisma/schema.prisma y en las migraciones versionadas.",
        "Las sentencias SQL de una edición anterior eran un bosquejo conceptual, no migraciones aplicables.",
        "Antes de desplegar se ejecuta prisma migrate deploy contra PostgreSQL con respaldo previo.",
    ], top=bottom - 67, spacing=48)


def page_106(c):
    heading(c, "5.5 Colaboración y repositorio interno",
            "Arquitectura local validada y condiciones para su publicación.", 106)
    body_lines(c, [
        "El editor web y Android envían operaciones versionadas; el servidor las persiste antes de distribuir eventos.",
        "Los cambios independientes pueden fusionarse con una base histórica confiable. Las ediciones incompatibles conservan ambas variantes y requieren resolución humana.",
        "El repositorio interno publica revisiones inmutables, archivos, comentarios y restauraciones autorizadas.",
        "Android permite explorar, comentar, comparar y descargar código generado; los recorridos se probaron en emulador.",
        "En Google Cloud, la primera etapa usa una VM única con PostgreSQL y artefactos en disco persistente. Esta topología no equivale a un despliegue completado.",
        "Se limita el acceso público a HTTPS y se respaldan tanto la base de datos como el directorio de artefactos.",
    ], spacing=73)


def page_119(c):
    heading(c, "6.10 Explorar el repositorio interno",
            "Guía de uso de la funcionalidad implementada en web y Android.", 119)
    body_lines(c, [
        "1. Abrir un proyecto autorizado y entrar en Repositorio de código.",
        "2. Elegir una revisión publicada para recorrer carpetas y archivos.",
        "3. Comparar dos revisiones para identificar adiciones, modificaciones y eliminaciones.",
        "4. Si el rol lo permite, comentar un archivo o línea, descargar el ZIP o restaurar una versión.",
        "5. Comprobar el autor, la versión UML y la revisión antes de una acción permanente.",
        "Estado: recorrido de generación, árbol, comentarios, comparación y descarga verificado en emulador; falta validación en teléfono físico.",
    ], spacing=72)


def page_120(c):
    heading(c, "6.11 Trabajar con IA móvil offline",
            "Guía de uso de voz, comandos locales y sincronización durable.", 120)
    body_lines(c, [
        "1. Dictar o escribir una orden en el apartado de IA. El texto siempre se puede editar antes de enviarlo.",
        "2. Sin red, ejecutar comandos UML del catálogo local; FunctionGemma es opcional y requiere importar su archivo verificado.",
        "3. Revisar la propuesta y confirmar la modificación del diagrama; ninguna acción destructiva se aplica sin confirmación.",
        "4. Los cambios quedan en una cola local hasta que el servidor confirma su aplicación o informa un conflicto.",
        "5. Si caduca la sesión, iniciar sesión nuevamente: la cola se conserva y reanuda el envío con el nuevo token.",
        "Estado: flujo local y cola probados; la inferencia de FunctionGemma y STT/TTS deben medirse en un Android físico.",
    ], spacing=72)


def page_107(c):
    heading(c, "5.6 IA local y servicio avanzado",
            "Decisiones técnicas vinculadas al estado verificable del sistema.", 107)
    body = paragraph(
        "Android ofrece texto, dictado, TTS, comandos básicos y un gestor opcional de "
        "FunctionGemma. La IA avanzada usa un proveedor en la nube seleccionado "
        "en el backend; no sustituye el modo sin conexión.", 10.5)
    body.wrapOn(c, 504, 70)
    body.drawOn(c, 54, 680)

    c.setFont("Helvetica-Bold", 11)
    c.drawString(54, 650, "Decisiones")
    c.setFont("Helvetica", 10)
    for index, line in enumerate([
        "- FunctionGemma propone solo acciones UML del catálogo permitido.",
        "- Propuestas UML: selección de altas/cambios; una omisión no borra.",
        "- Gemini atiende chat, propuestas UML por texto/imagen y refinamiento.",
        "- Claude permanece seleccionable para instalaciones anteriores.",
    ]):
        c.drawString(62, 624 - index * 22, line)

    rows = [
        [paragraph("Dimensión", bold=True), paragraph("Criterio de aceptación", bold=True)],
        [paragraph("Configuración"), paragraph("La clave queda solo en backend/.env local; en nube se usará un gestor de secretos.")],
        [paragraph("Propuestas"), paragraph("UML y backend admiten selección parcial; nada se aplica sin confirmación humana.")],
        [paragraph("Trazabilidad"), paragraph("Registrar proveedor, modelo, versión UML y revisión de artefactos sin divulgar secretos.")],
        [paragraph("Fallo del proveedor"), paragraph("Mostrar fallback identificado; un error 403 no se etiqueta como respuesta cloud.")],
    ]
    bottom = draw_table(c, rows, [122, 382], 520, [30, 38, 38, 38, 38])
    c.setStrokeColor(GRID)
    c.rect(54, bottom - 110, 504, 88, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(66, bottom - 40, "Estado de validación local")
    note = paragraph(
        "El adaptador Gemini y las pruebas automatizadas están implementados. "
        "La clave de prueba autentica para listar modelos, pero el proyecto de Google "
        "deniega la generación (403); falta una clave con acceso. La inferencia de "
        "FunctionGemma aún requiere medición en un Android físico.", 9)
    note.wrapOn(c, 480, 60)
    note.drawOn(c, 66, bottom - 90)


def page_124(c):
    heading(c, "8.2 Inventario de estado funcional",
            "Separación entre implementación, pruebas y restricciones externas.", 124)
    rows = [
        [paragraph("Capacidad", bold=True), paragraph("Estado", bold=True), paragraph("Evidencia / siguiente paso", bold=True)],
        [paragraph("Acceso y proyectos"), paragraph("Implementado"), paragraph("Web, API y Android; roles y ciclo de vida probados.")],
        [paragraph("Editor UML"), paragraph("Implementado"), paragraph("React Flow y editor táctil Flutter.")],
        [paragraph("Colaboración"), paragraph("Implementado"), paragraph("Socket.IO, presencia y operaciones durables.")],
        [paragraph("IA cloud"), paragraph("Integrada; acceso pendiente"), paragraph("Gemini seleccionado en local. Proyecto de prueba deniega generación 403; falta otra clave/proyecto.")],
        [paragraph("Generación de código"), paragraph("Implementado"), paragraph("Spring Boot, Flutter, repositorio y revisiones.")],
        [paragraph("Tema e idioma"), paragraph("Implementado"), paragraph("Modo claro/oscuro y selector de idioma.")],
        [paragraph("Aplicación Android"), paragraph("Implementado en emulador"), paragraph("RF-25 a RF-32 y CU-21 a CU-25 verificados; falta teléfono físico.")],
        [paragraph("IA local y voz"), paragraph("Integrada; equipo pendiente"), paragraph("Fallback, STT/TTS y gestor FunctionGemma probados; falta medir inferencia real en teléfono.")],
        [paragraph("XMI, JSON y ZIP"), paragraph("Implementado"), paragraph("Intercambio web/API/Android probado.")],
        [paragraph("Invitación enlace/código"), paragraph("Implementado"), paragraph("Flujo Android y web con rol, expiración y revocación.")],
        [paragraph("Google Cloud"), paragraph("Preparación local"), paragraph("Runbook y archivos de servicio para VM única; sin despliegue remoto ni dominio configurado.")],
    ]
    bottom = draw_table(c, rows, [150, 102, 252], 676,
                        [32, 34, 34, 34, 44, 34, 34, 42, 48, 34, 40, 38])
    c.setStrokeColor(GRID)
    c.rect(54, bottom - 75, 504, 58, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(66, bottom - 34, "Cierre")
    note = paragraph(
        "La implementación local no implica acceso efectivo a un proveedor externo "
        "ni valida rendimiento en un equipo físico. Ambos pendientes se registran por separado.", 9)
    note.wrapOn(c, 480, 36)
    note.drawOn(c, 66, bottom - 64)


def page_123(c, qr_data):
    heading(c, "8.1 Repositorio oficial del proyecto",
            "Frontend, backend, Android y documentación se consolidan en un único monorepositorio.", 123)
    c.drawImage(ImageReader(BytesIO(qr_data)), 211, 412, width=190, height=190)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(306, 376, "Santyxd353/ProyectoSOFTWARE1")
    c.setFont("Helvetica", 9)
    c.drawCentredString(306, 353, "https://github.com/Santyxd353/ProyectoSOFTWARE1")
    rows = [
        [paragraph("Carpeta", bold=True), paragraph("Contenido", bold=True)],
        [paragraph("frontend/"), paragraph("Aplicación web Next.js y editor UML.")],
        [paragraph("backend/"), paragraph("API NestJS, colaboración, IA y generadores.")],
        [paragraph("mobile/"), paragraph("Aplicación Flutter Android: editor UML, IA híbrida y sincronización offline.")],
        [paragraph("docs/"), paragraph("PUDS, decisiones y material técnico.")],
    ]
    draw_table(c, rows, [106, 398], 314, [28, 28, 28, 28, 28])


def overlay(draw):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))
    draw(c)
    c.save()
    buffer.seek(0)
    return PdfReader(buffer).pages[0]


def main():
    reader = PdfReader(PDF)
    assert len(reader.pages) == 124
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    qr_data = reader.pages[122].images[0].data
    for page_number, draw in ((24, page_24), (80, page_80),
                              (85, page_85), (86, page_86), (106, page_106),
                              (107, page_107), (108, page_108), (119, page_119), (120, page_120),
                              (123, lambda c: page_123(c, qr_data)), (124, page_124)):
        page = writer.pages[page_number - 1]
        blank = DecodedStreamObject()
        blank.set_data(b"")
        page[NameObject("/Contents")] = writer._add_object(blank)
        page.merge_page(overlay(draw))
    staged = PDF.with_suffix(".staged.pdf")
    with staged.open("wb") as output:
        writer.write(output)
    verified = PdfReader(staged)
    assert len(verified.pages) == 124
    assert "Gemini" in (verified.pages[106].extract_text() or "")
    assert "403" in (verified.pages[123].extract_text() or "")
    os.replace(staged, PDF)


if __name__ == "__main__":
    main()
