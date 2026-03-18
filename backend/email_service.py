"""
Email service — Gmail SMTP
==========================
Configura en .env o en el panel de Super Admin:
  GMAIL_USER = tu_cuenta@gmail.com
  GMAIL_APP_PASSWORD = xxxx xxxx xxxx xxxx  (contraseña de aplicación, NO la de tu cuenta)

Para obtener la contraseña de aplicación:
  1. Ir a myaccount.google.com → Seguridad
  2. Activar verificación en 2 pasos
  3. Buscar "Contraseñas de aplicación"
  4. Generar una para "Correo" / "Otro"
"""
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional


def _get_credentials() -> tuple[str, str]:
    user = os.environ.get("GMAIL_USER", "")
    pw   = os.environ.get("GMAIL_APP_PASSWORD", "")
    return user, pw


def _send(to: str, subject: str, html: str, text: str) -> bool:
    """Returns True on success, False on failure (never raises)."""
    sender, pw = _get_credentials()
    if not sender or not pw:
        print(f"[EMAIL] Credenciales no configuradas — email a {to} no enviado")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Homie Barber Shop <{sender}>"
        msg["To"]      = to
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(sender, pw)
            server.sendmail(sender, to, msg.as_string())
        print(f"[EMAIL] Enviado a {to}: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL] Error enviando a {to}: {e}")
        return False


# ── Templates ─────────────────────────────────────────────────────────────────

def _base_html(content: str, tenant_name: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{tenant_name}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #2A2A2A;max-width:560px;">
        <!-- Header -->
        <tr>
          <td style="background:#FFD700;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-family:'Arial Black',Arial,sans-serif;font-size:26px;font-weight:900;color:#080808;letter-spacing:4px;text-transform:uppercase;">
                    {tenant_name}
                  </div>
                  <div style="font-size:11px;color:#333;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">
                    BARBER SHOP
                  </div>
                </td>
                <td align="right">
                  <div style="font-size:28px;">✂</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            {content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #2A2A2A;">
            <div style="font-size:11px;color:#555;letter-spacing:2px;text-align:center;text-transform:uppercase;">
              {tenant_name} · Powered by Homie SaaS
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def send_booking_confirmation(
    to: str,
    client_name: str,
    barber_name: str,
    service_name: str,
    price: int,
    date: str,         # "2024-12-25"
    time: str,         # "15:30"
    tenant_name: str,
    tenant_address: str = "",
    tenant_phone: str = "",
) -> bool:
    # Format date nicely
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        date_fmt = dt.strftime("%A %d de %B de %Y").capitalize()
    except Exception:
        date_fmt = date

    price_fmt = f"${price:,}".replace(",", ".")

    content = f"""
    <h1 style="font-family:'Arial Black',Arial,sans-serif;font-size:28px;color:#FFD700;
               letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;">
      ¡Cita Confirmada!
    </h1>
    <p style="color:#888;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 28px;">
      Te esperamos, {client_name}
    </p>

    <!-- Detail card -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#1A1A1A;border-left:3px solid #FFD700;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          {''.join(f'''
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
              <td style="font-size:10px;color:#666;letter-spacing:3px;text-transform:uppercase;
                         width:100px;vertical-align:top;padding-top:2px;">{lbl}</td>
              <td style="font-size:16px;color:{color};font-weight:bold;">{val}</td>
            </tr>
          </table>
          ''' for lbl, val, color in [
              ("Barbero",  barber_name,  "#F5F0E8"),
              ("Servicio", service_name, "#F5F0E8"),
              ("Fecha",    date_fmt,     "#FFD700"),
              ("Hora",     time,         "#FFD700"),
              ("Precio",   price_fmt,    "#F5F0E8"),
          ])}
        </td>
      </tr>
    </table>

    {f'<p style="color:#666;font-size:13px;margin:0 0 6px;">📍 {tenant_address}</p>' if tenant_address else ''}
    {f'<p style="color:#666;font-size:13px;margin:0 0 20px;">📞 {tenant_phone}</p>' if tenant_phone else ''}

    <p style="color:#888;font-size:13px;line-height:1.6;margin:20px 0 0;">
      Si necesitas cancelar o reagendar, contacta directamente con la barbería.
    </p>
    """

    html = _base_html(content, tenant_name)
    text = (
        f"¡Cita confirmada en {tenant_name}!\n\n"
        f"Hola {client_name},\n\n"
        f"Barbero:  {barber_name}\n"
        f"Servicio: {service_name}\n"
        f"Fecha:    {date_fmt}\n"
        f"Hora:     {time}\n"
        f"Precio:   {price_fmt}\n\n"
        f"{tenant_address}\n{tenant_phone}"
    )
    return _send(to, f"✂ Cita confirmada — {tenant_name}", html, text)


def send_reminder(
    to: str,
    client_name: str,
    barber_name: str,
    service_name: str,
    date: str,
    time: str,
    tenant_name: str,
    tenant_address: str = "",
    tenant_phone: str = "",
) -> bool:
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        date_fmt = dt.strftime("%A %d de %B").capitalize()
    except Exception:
        date_fmt = date

    content = f"""
    <h1 style="font-family:'Arial Black',Arial,sans-serif;font-size:28px;color:#FFD700;
               letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;">
      Recordatorio
    </h1>
    <p style="color:#888;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 28px;">
      Tu cita es mañana, {client_name}
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#1A1A1A;border-left:3px solid #FFD700;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          {''.join(f'''
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
              <td style="font-size:10px;color:#666;letter-spacing:3px;text-transform:uppercase;
                         width:100px;vertical-align:top;padding-top:2px;">{lbl}</td>
              <td style="font-size:16px;color:{color};font-weight:bold;">{val}</td>
            </tr>
          </table>
          ''' for lbl, val, color in [
              ("Barbero",  barber_name,  "#F5F0E8"),
              ("Servicio", service_name, "#F5F0E8"),
              ("Mañana",   date_fmt,     "#FFD700"),
              ("Hora",     time,         "#FFD700"),
          ])}
        </td>
      </tr>
    </table>

    <!-- Big time banner -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#FFD700;margin-bottom:24px;">
      <tr>
        <td style="padding:16px;text-align:center;">
          <div style="font-family:'Arial Black',Arial,sans-serif;font-size:42px;
                      color:#080808;font-weight:900;letter-spacing:4px;">
            {time}
          </div>
          <div style="font-size:11px;color:#333;letter-spacing:3px;text-transform:uppercase;">
            {date_fmt}
          </div>
        </td>
      </tr>
    </table>

    {f'<p style="color:#666;font-size:13px;margin:0 0 6px;">📍 {tenant_address}</p>' if tenant_address else ''}
    {f'<p style="color:#666;font-size:13px;margin:0 0 0;">📞 {tenant_phone}</p>' if tenant_phone else ''}
    """

    html = _base_html(content, tenant_name)
    text = (
        f"Recordatorio — {tenant_name}\n\n"
        f"Hola {client_name}, tu cita es mañana.\n\n"
        f"Barbero:  {barber_name}\n"
        f"Servicio: {service_name}\n"
        f"Fecha:    {date_fmt}\n"
        f"Hora:     {time}\n\n"
        f"{tenant_address}\n{tenant_phone}"
    )
    return _send(to, f"⏰ Recordatorio — tu cita mañana a las {time}", html, text)


def send_invite(
    to: str,
    invite_url: str,
    tenant_name: str,
    invited_by: str,
    expires_hours: int = 48,
) -> bool:
    content = f"""
    <h1 style="font-family:'Arial Black',Arial,sans-serif;font-size:28px;color:#FFD700;
               letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;">
      Invitación
    </h1>
    <p style="color:#888;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 28px;">
      Únete al equipo
    </p>

    <p style="color:#F5F0E8;font-size:16px;line-height:1.6;margin:0 0 24px;">
      <strong>{invited_by}</strong> te ha invitado a unirte como barbero en
      <strong style="color:#FFD700;">{tenant_name}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <a href="{invite_url}"
             style="display:inline-block;background:#FFD700;color:#080808;
                    font-family:'Arial Black',Arial,sans-serif;font-size:16px;
                    font-weight:900;letter-spacing:3px;text-transform:uppercase;
                    padding:14px 40px;text-decoration:none;">
            CREAR MI CUENTA →
          </a>
        </td>
      </tr>
    </table>

    <p style="color:#555;font-size:12px;text-align:center;">
      Este enlace expira en {expires_hours} horas.<br/>
      Si no esperabas esta invitación, ignora este email.
    </p>
    """

    html = _base_html(content, tenant_name)
    text = (
        f"Invitación a {tenant_name}\n\n"
        f"{invited_by} te invita a unirte como barbero.\n\n"
        f"Crea tu cuenta aquí:\n{invite_url}\n\n"
        f"El enlace expira en {expires_hours} horas."
    )
    return _send(to, f"✂ Invitación — Únete a {tenant_name}", html, text)
