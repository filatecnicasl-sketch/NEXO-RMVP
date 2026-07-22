"""Generador del PDF de resguardo oficial de la solicitud."""
import io
from datetime import datetime
from typing import Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

HEMSA_GREEN = colors.HexColor("#2ECC8B")
HEMSA_TEXT = colors.HexColor("#3F3F46")
HEMSA_MUTED = colors.HexColor("#7A7A7A")
HEMSA_BORDER = colors.HexColor("#E4E4E7")
HEMSA_SOFT = colors.HexColor("#E7F8F0")


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("hTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=HEMSA_TEXT, spaceAfter=4),
        "subtitle": ParagraphStyle("hSub", parent=base["Normal"], fontName="Helvetica", fontSize=10, leading=14, textColor=HEMSA_MUTED, spaceAfter=10),
        "section": ParagraphStyle("hSection", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=HEMSA_GREEN, spaceBefore=12, spaceAfter=6),
        "label": ParagraphStyle("hLabel", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=HEMSA_MUTED),
        "value": ParagraphStyle("hValue", parent=base["Normal"], fontName="Helvetica", fontSize=10, leading=12, textColor=HEMSA_TEXT),
        "body": ParagraphStyle("hBody", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=12, textColor=HEMSA_TEXT),
        "footer": ParagraphStyle("hFooter", parent=base["Normal"], fontName="Helvetica", fontSize=8, leading=10, textColor=HEMSA_MUTED, alignment=TA_CENTER),
    }


STATUS_TEXT = {
    "pendiente": "Pendiente",
    "en_revision": "En revisión",
    "aprobada": "Aprobada",
    "denegada": "Denegada",
}


def _kv_table(items, styles):
    """items: list of (label, value) string tuples; returns a 2-col Table."""
    data = []
    for k, v in items:
        data.append([Paragraph(k.upper(), styles["label"]), Paragraph(str(v) if v not in (None, "") else "—", styles["value"])])
    t = Table(data, colWidths=[55 * mm, None])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HEMSA_BORDER),
    ]))
    return t


def _holder_items(t: Dict[str, Any]):
    if not t:
        return []
    full = f"{t.get('nombre','')} {t.get('apellido1','')} {t.get('apellido2','')}".strip()
    return [
        ("Nombre completo", full),
        ("Documento", f"{t.get('tipo_documento','')} {t.get('numero_documento','')}".strip()),
        ("Sexo", t.get("sexo", "")),
        ("Nacionalidad", t.get("nacionalidad", "")),
        ("Fecha de nacimiento", t.get("fecha_nacimiento", "")),
        ("Empadronado/a en", t.get("empadronado_en", "")),
        ("Dirección", f"{t.get('direccion','')} ({t.get('codigo_postal','')})".strip()),
        ("Localidad", t.get("domicilio", "")),
        ("Email", t.get("email", "")),
        ("Teléfono móvil", t.get("telefono_movil", "")),
        ("Teléfono fijo", t.get("telefono_fijo", "")),
        ("Ingresos económicos", f"{t.get('ingresos_economicos', 0)} € · {t.get('tipo_declaracion_irpf','')} {t.get('anio_ingresos','')}"),
        ("Grupos acreditación", ", ".join(t.get("grupos_acreditacion") or []) or "—"),
    ]


def generate_application_pdf(app: Dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm)
    styles = _styles()
    story = []

    # Header banner
    header_data = [[
        Paragraph("<b>HEMSA · San Fernando</b><br/>"
                  "<font size=8 color='#7A7A7A'>Registro Público Municipal de Demandantes de Vivienda Protegida</font>", styles["value"]),
        Paragraph(f"<para align=right><font size=8 color='#7A7A7A'>RESGUARDO OFICIAL</font><br/>"
                  f"<b>Nº {app.get('numero_registro','—')}</b><br/>"
                  f"<font size=8 color='#7A7A7A'>{STATUS_TEXT.get(app.get('status',''), app.get('status',''))}</font></para>", styles["value"]),
    ]]
    header = Table(header_data, colWidths=[110 * mm, None])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HEMSA_SOFT),
        ("BOX", (0, 0), (-1, -1), 0.6, HEMSA_GREEN),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(header)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Solicitud de inscripción", styles["title"]))
    created = app.get("created_at", "")
    try:
        created_fmt = datetime.fromisoformat(created).strftime("%d/%m/%Y %H:%M")
    except Exception:
        created_fmt = created
    story.append(Paragraph(f"Fecha de presentación: {created_fmt}", styles["subtitle"]))

    # Titular 1
    story.append(Paragraph("TITULAR 1", styles["section"]))
    story.append(_kv_table(_holder_items(app.get("titular1") or {}), styles))

    if app.get("titular2"):
        story.append(Paragraph("TITULAR 2", styles["section"]))
        story.append(_kv_table(_holder_items(app.get("titular2") or {}), styles))

    # Otros miembros
    miembros = app.get("otros_miembros") or []
    story.append(Paragraph(f"OTROS MIEMBROS DE LA UNIDAD FAMILIAR ({len(miembros)})", styles["section"]))
    if not miembros:
        story.append(Paragraph("Sin miembros adicionales declarados.", styles["body"]))
    else:
        rows = [[
            Paragraph("<b>Nombre</b>", styles["label"]),
            Paragraph("<b>NIF</b>", styles["label"]),
            Paragraph("<b>F.Nac.</b>", styles["label"]),
            Paragraph("<b>Ingresos</b>", styles["label"]),
            Paragraph("<b>IRPF</b>", styles["label"]),
        ]]
        for m in miembros:
            rows.append([
                Paragraph(m.get("nombre_completo", "—"), styles["body"]),
                Paragraph(m.get("nif", "—"), styles["body"]),
                Paragraph(m.get("fecha_nacimiento", "—"), styles["body"]),
                Paragraph(f"{m.get('ingresos_economicos', 0)} €", styles["body"]),
                Paragraph(f"{m.get('tipo_declaracion','')} {m.get('anio_ingresos','')}", styles["body"]),
            ])
        t = Table(rows, colWidths=[58*mm, 28*mm, 24*mm, 26*mm, 32*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HEMSA_SOFT),
            ("GRID", (0, 0), (-1, -1), 0.3, HEMSA_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)

    # Vivienda
    v = app.get("vivienda") or {}
    story.append(Paragraph("VIVIENDA A LA QUE SE OPTA", styles["section"]))
    story.append(_kv_table([
        ("Régimen", ", ".join(v.get("regimen") or [])),
        ("Dormitorios", ", ".join(v.get("dormitorios") or [])),
        ("Algún miembro silla de ruedas", "Sí" if v.get("silla_ruedas") else "No"),
        ("Movilidad reducida", "Sí" if v.get("movilidad_reducida") else "No"),
        ("Cooperativa", "Sí" if v.get("cooperativa") else "No"),
        ("Vivienda adaptada", "Sí" if v.get("necesidad_vivienda_adaptada") else "No"),
        ("Precariedad habitacional", "Sí" if v.get("precariedad") else "No"),
        ("Vivienda inadecuada por superficie", "Sí" if v.get("vivienda_inadecuada_superficie") else "No"),
        ("Renta elevada respecto a ingresos", "Sí" if v.get("renta_elevada") else "No"),
        ("Alojamiento con otros familiares", "Sí" if v.get("alojamiento_otros_familiares") else "No"),
        ("Formación nueva unidad familiar", "Sí" if v.get("nueva_unidad_familiar") else "No"),
        ("Otros", v.get("otros_detalle") if v.get("otros") else "No"),
    ], styles))

    # Justificación
    just = (app.get("justificacion") or {}).get("casillas") or []
    story.append(Paragraph("JUSTIFICACIÓN DE LA NECESIDAD", styles["section"]))
    story.append(Paragraph(", ".join(just) if just else "—", styles["body"]))

    # Declaración
    dec = app.get("declaracion") or {}
    story.append(Paragraph("DECLARACIÓN RESPONSABLE", styles["section"]))
    story.append(_kv_table([
        ("Motivo (si tiene propiedad)", dec.get("motivo_propiedad", "")),
        ("Otras inscripciones", dec.get("inscripcion_otros_municipios", "")),
        ("Preferencia en", dec.get("preferencia_en", "")),
        ("Notificación email", "Autorizada" if dec.get("autoriza_email") else "No autorizada"),
        ("Notificación SMS", "Autorizada" if dec.get("autoriza_sms") else "No autorizada"),
    ], styles))

    # Score
    if app.get("score") is not None:
        story.append(Paragraph("BAREMO (orientativo)", styles["section"]))
        story.append(Paragraph(f"<b>Puntuación calculada:</b> {app.get('score')} puntos.<br/>"
                               f"<font color='#7A7A7A' size=8>Cálculo orientativo sujeto a verificación documental por parte de Hemsa.</font>", styles["body"]))

    # Footer / legal
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Este documento es un resguardo de la presentación electrónica de la solicitud de inscripción en el Registro "
        "Público Municipal de Demandantes de Vivienda Protegida del Excmo. Ayuntamiento de San Fernando, gestionado por "
        "Hemsa (Servicios Públicos Municipales). El estado actual del expediente puede consultarse en el portal del "
        "ciudadano. Los datos personales han sido tratados conforme al RGPD (UE) 2016/679 y la LOPDGDD 3/2018.",
        styles["body"],
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} · Hemsa · San Fernando",
        styles["footer"],
    ))

    doc.build(story)
    buf.seek(0)
    return buf.getvalue()
