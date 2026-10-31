"""
Servicio de email transaccional de Hubzy.

Modos de operación:
- SMTP configurado (SMTP_HOST + credenciales): envío real vía smtplib en hilo
  separado para no bloquear el event loop.
- Sin SMTP (desarrollo): el contenido del email (incluido el enlace con token)
  se escribe en el log — permite probar el flujo completo en local sin servidor
  de correo.

Fail-safe: un fallo de email NUNCA rompe el flujo del usuario — se loguea y se
devuelve False para que el caller decida.
"""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("hubzy.email")


def _smtp_configured() -> bool:
    return bool(settings.EMAIL_ENABLED and settings.SMTP_HOST)


def _send_smtp(to: str, subject: str, html: str, text: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
        server.send_message(msg)
    return True


async def send_email(to: str, subject: str, html: str, text: str | None = None) -> bool:
    """Envía un email transaccional. En dev sin SMTP, lo loguea y devuelve True."""
    if not settings.EMAIL_ENABLED:
        logger.info(f"[email disabled] a={to} asunto='{subject}'")
        return True

    plain = text or ""

    if not _smtp_configured():
        # Modo desarrollo: el enlace queda en el log para pruebas manuales
        logger.info(f"[dev-email] Para: {to} | Asunto: {subject}")
        logger.info(f"[dev-email] Cuerpo: {plain[:500]}")
        return True

    try:
        await asyncio.to_thread(_send_smtp, to, subject, html, plain)
        logger.info(f"Email enviado a {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Error enviando email a {to}: {e}")
        return False


_BASE_HTML = """<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
<div style="background:#0ea5e9;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
  <h1 style="margin:0;font-size:20px">Hubzy</h1>
</div>
<div style="border:1px solid #e2e8f0;border-top:none;padding:24px 20px;border-radius:0 0 12px 12px">
  {body}
  <p style="color:#94a3b8;font-size:12px;margin-top:32px">
    Si no solicitaste esto, ignora este mensaje. Este enlace expira en {ttl}.
  </p>
</div></body></html>"""


def _cta_button(url: str, label: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;background:#0ea5e9;color:#fff;'
        f'padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">{label}</a>'
    )


async def send_verification_email(to: str, username: str, token: str) -> bool:
    """Email de verificación de cuenta con enlace firmado (24h)."""
    url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject = "Confirma tu cuenta de Hubzy"
    text = f"Hola {username}, confirma tu cuenta aquí: {url} (expira en 24 horas)"
    html = _BASE_HTML.format(
        ttl="24 horas",
        body=f"""
  <p>Hola <strong>{username}</strong>,</p>
  <p>Confirma tu correo para activar todas las funciones de Hubzy.</p>
  <p style="text-align:center;margin:28px 0">{_cta_button(url, "Confirmar mi cuenta")}</p>""",
    )
    return await send_email(to, subject, html, text)


async def send_password_reset_email(to: str, username: str, token: str) -> bool:
    """Email de recuperación de contraseña con enlace firmado (1h)."""
    url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Restablece tu contraseña de Hubzy"
    text = f"Hola {username}, restablece tu contraseña aquí: {url} (expira en 1 hora)"
    html = _BASE_HTML.format(
        ttl="1 hora",
        body=f"""
  <p>Hola <strong>{username}</strong>,</p>
  <p>Recibimos una solicitud para restablecer tu contraseña.</p>
  <p style="text-align:center;margin:28px 0">{_cta_button(url, "Restablecer contraseña")}</p>""",
    )
    return await send_email(to, subject, html, text)
