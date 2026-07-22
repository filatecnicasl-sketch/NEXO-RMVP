"""Email notifications via IONOS SMTP."""
import os
import ssl
import smtplib
import logging
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger("hemsa.email")


def _cfg():
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.ionos.es"),
        "port": int(os.environ.get("SMTP_PORT", "465")),
        "user": os.environ.get("SMTP_USER", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "from_name": os.environ.get("SMTP_FROM_NAME", "Hemsa San Fernando"),
        "public_url": os.environ.get("APP_PUBLIC_URL", ""),
    }


STATUS_LABEL = {
    "pendiente": "Pendiente",
    "recepcionada": "Recepcionada",
    "en_revision": "En revisión",
    "aprobada": "Aprobada",
    "denegada": "Denegada",
}

STATUS_COLOR = {
    "pendiente": "#F59E0B",
    "recepcionada": "#8B5CF6",
    "en_revision": "#3B82F6",
    "aprobada": "#10B981",
    "denegada": "#EF4444",
}


def _send(to: str, subject: str, html: str, text: str, attachments: Optional[list] = None) -> bool:
    cfg = _cfg()
    if not cfg["user"] or not cfg["password"]:
        logger.warning("SMTP not configured, skipping email to %s", to)
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f'{cfg["from_name"]} <{cfg["user"]}>'
    msg["To"] = to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    # attachments: list of (filename, mime, bytes)
    for att in (attachments or []):
        try:
            filename, mime, data = att
            maintype, _, subtype = (mime or "application/octet-stream").partition("/")
            msg.add_attachment(data, maintype=maintype or "application", subtype=subtype or "octet-stream", filename=filename)
        except Exception as e:
            logger.warning("Could not attach %s: %s", att, e)
    ctx = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL(cfg["host"], cfg["port"], context=ctx, timeout=30) as server:
            server.login(cfg["user"], cfg["password"])
            server.send_message(msg)
        logger.info("Email sent to %s · %s", to, subject)
        return True
    except Exception as e:
        logger.exception("Email send failed to %s: %s", to, e)
        return False


def _wrap_html(title: str, body_html: str, accent: str = "#2ECC8B") -> str:
    return f"""<!doctype html>
<html><body style="margin:0;background:#FAFAFA;font-family:Helvetica,Arial,sans-serif;color:#3F3F46;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #E4E4E7;border-radius:12px;overflow:hidden;">
    <div style="padding:18px 24px;border-bottom:1px solid #E4E4E7;background:#fff;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:32px;height:32px;border-radius:8px;background:{accent};display:inline-block;"></div>
        <div>
          <div style="font-weight:700;font-size:14px;color:#3F3F46;">Hemsa · San Fernando</div>
          <div style="font-size:11px;color:#7A7A7A;text-transform:uppercase;letter-spacing:0.08em;">Registro Vivienda Protegida</div>
        </div>
      </div>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:22px;color:#3F3F46;margin:0 0 16px;">{title}</h1>
      {body_html}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #E4E4E7;color:#7A7A7A;font-size:11px;">
      Este es un mensaje automático. Por favor, no responda a este correo. Si necesita asistencia, contacte con Hemsa en el 956 940 000.
    </div>
  </div>
</body></html>"""


def notify_application_created(to: str, name: str, numero_registro: str, pdf_bytes: Optional[bytes] = None) -> bool:
    if not to:
        return False
    url = f'{_cfg()["public_url"]}/dashboard'
    body = f"""
    <p>Estimado/a <b>{name}</b>,</p>
    <p>Su solicitud ha sido <b>enviada correctamente</b> al Registro Público Municipal de Demandantes de Vivienda Protegida de San Fernando.</p>
    <p>Su número de registro asignado es:</p>
    <div style="background:#E7F8F0;color:#229C6A;border:1px solid #2ECC8B;border-radius:10px;padding:16px 18px;font-size:24px;font-weight:800;text-align:center;letter-spacing:0.02em;">
      {numero_registro}
    </div>
    <p style="margin-top:18px;">Adjunto a este correo encontrará el <b>resguardo oficial</b> de su solicitud en formato PDF. Recibirá una nueva notificación cuando Hemsa <b>recepcione</b> oficialmente su expediente y nuevamente cuando se aprobe o deniegue.</p>
    <p><a href="{url}" style="display:inline-block;background:#2ECC8B;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:999px;">Ir a mi solicitud</a></p>
    <p style="color:#7A7A7A;font-size:13px;">Gracias por confiar en Hemsa.</p>
    """
    text = f"Estimado/a {name}, su solicitud ha sido enviada. Nº de registro: {numero_registro}. Resguardo oficial adjunto. Acceda a {url} para más detalle."
    attachments = []
    if pdf_bytes:
        attachments.append((f"resguardo_{numero_registro}.pdf", "application/pdf", pdf_bytes))
    return _send(to, f"Solicitud enviada · Nº {numero_registro}", _wrap_html("Solicitud enviada", body), text, attachments)


def notify_status_change(to: str, name: str, numero_registro: str, new_status: str, nota: Optional[str] = None, pdf_bytes: Optional[bytes] = None, signed_pdf: Optional[tuple] = None) -> bool:
    if not to:
        return False
    label = STATUS_LABEL.get(new_status, new_status)
    color = STATUS_COLOR.get(new_status, "#2ECC8B")
    url = f'{_cfg()["public_url"]}/dashboard'
    # Subject custom messages per status
    extra_html = ""
    if new_status == "recepcionada":
        extra_html = "<p>Su solicitud ha sido <b>recepcionada</b> oficialmente por Hemsa. En breve nuestro equipo procederá a revisarla.</p>"
    elif new_status == "en_revision":
        extra_html = "<p>Su solicitud se encuentra <b>en revisión</b> por parte del personal técnico.</p>"
    elif new_status == "aprobada":
        extra_html = "<p>¡Enhorabuena! Su solicitud ha sido <b>aprobada</b>. Adjuntamos el documento oficial firmado digitalmente con certificado FNMT por el órgano competente de Hemsa.</p>"
    elif new_status == "denegada":
        extra_html = "<p>Lamentamos comunicarle que su solicitud ha sido <b>denegada</b>. Consulte el motivo a continuación. Puede presentar nueva solicitud subsanando los aspectos indicados.</p>"
    nota_html = ""
    if nota:
        nota_html = f"""<div style="background:#F4F4F5;border-left:3px solid {color};padding:10px 14px;margin:14px 0;color:#3F3F46;font-size:14px;">
          <div style="font-size:11px;color:#7A7A7A;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Observaciones de Hemsa</div>
          {nota}
        </div>"""
    body = f"""
    <p>Estimado/a <b>{name}</b>,</p>
    <p>Le informamos que el estado de su solicitud <b>{numero_registro}</b> ha sido actualizado a:</p>
    <div style="background:{color};color:#fff;border-radius:999px;padding:8px 16px;display:inline-block;font-weight:700;font-size:14px;letter-spacing:0.02em;">
      {label}
    </div>
    {extra_html}
    {nota_html}
    <p style="margin-top:18px;">Adjuntamos el resguardo oficial actualizado:</p>
    <p><a href="{url}" style="display:inline-block;background:#2ECC8B;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:999px;">Ver mi solicitud</a></p>
    """
    text = f"Su solicitud {numero_registro} ha cambiado de estado: {label}. {nota or ''}"
    attachments = []
    if pdf_bytes:
        attachments.append((f"resguardo_{numero_registro}.pdf", "application/pdf", pdf_bytes))
    if signed_pdf:
        # signed_pdf: (filename, bytes)
        attachments.append((signed_pdf[0], "application/pdf", signed_pdf[1]))
    subject = f"Actualización de su solicitud {numero_registro} · {label}"
    if new_status == "recepcionada":
        subject = f"Solicitud recepcionada · {numero_registro}"
    elif new_status == "aprobada":
        subject = f"Solicitud APROBADA · {numero_registro}"
    return _send(to, subject, _wrap_html(label, body, color), text, attachments)


def notify_password_reset(to: str, name: str, reset_url: str) -> bool:
    if not to:
        return False
    body = f"""
    <p>Estimado/a <b>{name or to}</b>,</p>
    <p>Hemos recibido una solicitud para restablecer la contraseña de su cuenta en el Registro Público Municipal de Vivienda Protegida de San Fernando.</p>
    <p>Pulse el botón siguiente para elegir una nueva contraseña. El enlace expira en <b>1 hora</b>.</p>
    <p style="margin:24px 0;"><a href="{reset_url}" style="display:inline-block;background:#2ECC8B;color:#fff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:999px;">Restablecer mi contraseña</a></p>
    <p style="color:#7A7A7A;font-size:13px;">Si no solicitó este cambio, ignore este correo. Su contraseña actual seguirá siendo válida.</p>
    <p style="color:#7A7A7A;font-size:11px;margin-top:24px;">O copie esta URL en su navegador:<br/><code style="word-break:break-all;">{reset_url}</code></p>
    """
    text = f"Para restablecer su contraseña visite: {reset_url} (válido 1 hora). Si no fue usted, ignore este mensaje."
    return _send(to, "Restablecer contraseña · Hemsa", _wrap_html("Restablecer contraseña", body), text)
