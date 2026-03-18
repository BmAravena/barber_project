"""
MercadoPago Subscriptions Service
==================================
Maneja la creación de suscripciones recurrentes via la API
de preapproval de MercadoPago.

Flujo:
  1. create_subscription()  → devuelve init_point (URL de pago MP)
  2. El usuario paga en MP
  3. MP llama al webhook POST /api/webhooks/mercadopago
  4. verify_webhook_signature() valida la firma
  5. get_preapproval() obtiene el estado de la suscripción
  6. Si status=authorized → backend actualiza el plan del tenant

Credenciales requeridas en .env:
  MP_ACCESS_TOKEN   = APP_USR-xxxx...   (token de producción o sandbox)
  MP_WEBHOOK_SECRET = tu_clave_secreta  (generada en el panel MP)
  MP_CURRENCY       = CLP               (o ARS, PEN, MXN, etc.)
"""
import os, hmac, hashlib, binascii, httpx
from typing import Optional

MP_API_BASE = "https://api.mercadopago.com"


def _get_access_token() -> str:
    token = os.environ.get("MP_ACCESS_TOKEN", "")
    if not token:
        raise ValueError("MP_ACCESS_TOKEN no configurado")
    return token


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_get_access_token()}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": "",   # se sobreescribe por llamada
    }


# ─── PLAN AMOUNTS (en la moneda configurada) ──────────────────────────────────
# Ajusta estos montos según tu mercado. Se pueden cambiar desde el super admin
# en el futuro si agregas un endpoint para eso.

PLAN_AMOUNTS = {
    "pro":        float(os.environ.get("MP_PRICE_PRO",        "6500")),
    "enterprise": float(os.environ.get("MP_PRICE_ENTERPRISE", "12000")),
}

PLAN_REASONS = {
    "pro":        "Homie SaaS — Plan Pro",
    "enterprise": "Homie SaaS — Plan Enterprise",
}


# ─── CREATE SUBSCRIPTION ──────────────────────────────────────────────────────

def create_subscription(
    tenant_slug: str,
    plan: str,
    payer_email: str,
    back_url_success: str,
    back_url_failure: str,
    notification_url: str,
) -> dict:
    """
    Crea una suscripción mensual en MP y devuelve:
      { "init_point": "https://...", "preapproval_id": "xxx" }

    Lanza ValueError si el plan no existe o MP devuelve error.
    """
    if plan not in PLAN_AMOUNTS:
        raise ValueError(f"Plan '{plan}' no tiene precio configurado")

    currency = os.environ.get("MP_CURRENCY", "CLP")
    amount   = PLAN_AMOUNTS[plan]
    reason   = PLAN_REASONS[plan]

    payload = {
        "reason": reason,
        "external_reference": f"{tenant_slug}::{plan}",
        "payer_email": payer_email,
        "back_url": back_url_success,
        "auto_recurring": {
            "frequency":          1,
            "frequency_type":     "months",
            "transaction_amount": amount,
            "currency_id":        currency,
        },
        "notification_url": notification_url,
        "status": "pending",
    }

    import uuid
    headers = _headers()
    headers["X-Idempotency-Key"] = str(uuid.uuid4())

    try:
        resp = httpx.post(
            f"{MP_API_BASE}/preapproval",
            json=payload,
            headers=headers,
            timeout=15,
        )
        data = resp.json()
    except Exception as e:
        raise ValueError(f"Error conectando con MercadoPago: {e}")

    if resp.status_code not in (200, 201):
        msg = data.get("message") or data.get("error") or str(data)
        raise ValueError(f"MercadoPago error {resp.status_code}: {msg}")

    return {
        "init_point":    data.get("init_point", ""),
        "preapproval_id": data.get("id", ""),
    }


# ─── GET PREAPPROVAL ──────────────────────────────────────────────────────────

def get_preapproval(preapproval_id: str) -> dict:
    """
    Consulta el estado de una suscripción en MP.
    Retorna el objeto completo de la API.
    """
    try:
        resp = httpx.get(
            f"{MP_API_BASE}/preapproval/{preapproval_id}",
            headers=_headers(),
            timeout=10,
        )
        return resp.json()
    except Exception as e:
        raise ValueError(f"Error consultando preapproval: {e}")


# ─── CANCEL SUBSCRIPTION ──────────────────────────────────────────────────────

def cancel_subscription(preapproval_id: str) -> bool:
    """
    Cancela una suscripción activa en MP.
    Retorna True si fue exitoso.
    """
    try:
        import uuid
        headers = _headers()
        headers["X-Idempotency-Key"] = str(uuid.uuid4())
        resp = httpx.put(
            f"{MP_API_BASE}/preapproval/{preapproval_id}",
            json={"status": "cancelled"},
            headers=headers,
            timeout=10,
        )
        return resp.status_code in (200, 201)
    except Exception:
        return False


# ─── WEBHOOK SIGNATURE VALIDATION ─────────────────────────────────────────────

def verify_webhook_signature(
    x_signature: str,
    x_request_id: str,
    data_id: str,
) -> bool:
    """
    Valida la firma HMAC-SHA256 del webhook de MP.

    MP envía el header x-signature con formato:
      ts=1234567890,v1=abcdef123...

    Documentación:
      https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/payment-notifications
    """
    secret = os.environ.get("MP_WEBHOOK_SECRET", "")
    if not secret:
        # Si no hay secret configurado, skip validation (solo en desarrollo)
        print("[MP WEBHOOK] ADVERTENCIA: MP_WEBHOOK_SECRET no configurado, saltando validación")
        return True

    try:
        # Parsear ts y v1 del header
        parts = dict(p.split("=", 1) for p in x_signature.split(","))
        ts = parts.get("ts", "")
        v1 = parts.get("v1", "")

        # Construir template de firma
        template = f"id:{data_id};request-id:{x_request_id};ts:{ts};"

        # Calcular HMAC
        expected = binascii.hexlify(
            hmac.new(secret.encode(), template.encode(), hashlib.sha256).digest()
        ).decode()

        return hmac.compare_digest(expected, v1)
    except Exception as e:
        print(f"[MP WEBHOOK] Error validando firma: {e}")
        return False


# ─── PARSE EXTERNAL REFERENCE ─────────────────────────────────────────────────

def parse_external_reference(external_reference: str) -> tuple[str, str]:
    """
    Parsea "tenant_slug::plan" → (slug, plan).
    Retorna ("", "") si el formato es inválido.
    """
    try:
        slug, plan = external_reference.split("::", 1)
        return slug.strip(), plan.strip()
    except Exception:
        return "", ""
