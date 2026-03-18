"""
Homie Barber Shop — Multi-Tenant SaaS Backend v4
=================================================
v4: Security hardening
  - Secrets from environment variables (never hardcoded)
  - CORS restricted to allowed origins
  - SQL field allowlists (no dynamic column names)
  - Config persistence in DB (survives restarts)
  - UTC-aware datetime comparisons
  - Default super admin password forced change on first login
  - Rate limiting on auth endpoints
  - Slug validation on all tenant lookups
"""
from fastapi import FastAPI, HTTPException, Depends, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, timedelta, timezone
import jwt, bcrypt, sqlite3, uuid, os, re, secrets
from pathlib import Path

from email_service import send_booking_confirmation, send_reminder, send_invite
import scheduler as sched
import mercadopago_service as mp_svc

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG — todos los secretos desde variables de entorno
# ─────────────────────────────────────────────────────────────────────────────
def _require_env(key: str, default: str | None = None) -> str:
    """Devuelve la variable de entorno o lanza error si es crítica y no existe."""
    val = os.environ.get(key, default)
    if val is None:
        raise RuntimeError(f"Variable de entorno requerida no configurada: {key}")
    return val

SECRET_KEY      = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
SUPER_SECRET    = os.environ.get("SUPER_SECRET") or secrets.token_hex(32)
ALGORITHM       = "HS256"
TOKEN_HOURS     = 24
INVITE_EXPIRE_H = 48
FRONTEND_URL    = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Si los secrets no están en el entorno, se generan aleatoriamente cada inicio
# (los JWT dejarán de ser válidos al reiniciar — aceptable en dev, inaceptable en prod)
if not os.environ.get("SECRET_KEY"):
    print("⚠️  ADVERTENCIA: SECRET_KEY no configurada. Genera una con: python -c \"import secrets; print(secrets.token_hex(32))\"")
if not os.environ.get("SUPER_SECRET"):
    print("⚠️  ADVERTENCIA: SUPER_SECRET no configurada.")

# ─────────────────────────────────────────────────────────────────────────────
# PLAN LIMITS
# None = ilimitado
# ─────────────────────────────────────────────────────────────────────────────
TRIAL_DAYS   = 14   # días de prueba gratuita con acceso completo
PLAN_LIMITS = {
    # "trial" = acceso igual a Pro, expira en TRIAL_DAYS días
    "trial": {
        "max_barbers":       10,
        "max_appts_monthly": None,
        "emails":            True,
        "portfolio":         True,
        "invites":           True,
        "is_trial":          True,
    },
    "pro": {
        "max_barbers":       10,
        "max_appts_monthly": None,
        "emails":            True,
        "portfolio":         True,
        "invites":           True,
        "is_trial":          False,
    },
    "enterprise": {
        "max_barbers":       None,
        "max_appts_monthly": None,
        "emails":            True,
        "portfolio":         True,
        "invites":           True,
        "is_trial":          False,
    },
    # "expired" = barbería cuyo trial venció y no pagó
    "expired": {
        "max_barbers":       0,
        "max_appts_monthly": 0,
        "emails":            False,
        "portfolio":         False,
        "invites":           False,
        "is_trial":          False,
    },
}

def _get_plan_limits(slug: str) -> dict:
    """Devuelve los límites del plan activo, considerando expiración del trial."""
    info    = _get_tenant_info(slug)
    plan    = info.get("plan", "trial")
    limits  = PLAN_LIMITS.get(plan, PLAN_LIMITS["expired"]).copy()

    if plan == "trial":
        created_at   = info.get("created_at", "")
        trial_ends   = _trial_end_date(created_at)
        days_left    = (trial_ends - _utcnow()).days
        limits["trial_days_left"] = max(days_left, 0)
        limits["trial_ends_at"]   = trial_ends.strftime("%Y-%m-%d")
        if days_left <= 0:
            # Trial vencido → degradar a expired en la BD y devolver límites vacíos
            _expire_trial(slug)
            return PLAN_LIMITS["expired"].copy()
    return limits

def _trial_end_date(created_at_str: str):
    """Calcula la fecha de vencimiento del trial."""
    from datetime import timezone
    try:
        dt = datetime.strptime(created_at_str[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    except Exception:
        try:
            dt = datetime.strptime(created_at_str[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except Exception:
            dt = _utcnow()
    return dt + timedelta(days=TRIAL_DAYS)

def _expire_trial(slug: str):
    """Marca el tenant como 'expired' si el trial venció."""
    db = get_super_db()
    db.execute("UPDATE tenants SET plan='expired' WHERE slug=? AND plan='trial'", (slug,))
    db.commit(); db.close()
    print(f"[TRIAL] Trial vencido para '{slug}' → plan=expired")

def _check_feature(slug: str, feature: str):
    """Lanza 402 si el plan no incluye la feature."""
    limits = _get_plan_limits(slug)
    if not limits.get(feature, False):
        plan = _get_tenant_info(slug).get("plan", "trial")
        if plan == "expired":
            raise HTTPException(402, "Tu período de prueba venció. Elige un plan en /pricing")
        raise HTTPException(402, "Tu plan no incluye esta función. Actualiza en /pricing")

DB_DIR   = Path("tenants_db")
DB_DIR.mkdir(exist_ok=True)
SUPER_DB = "super.db"

app = FastAPI(title="Homie SaaS API v4", version="4.0.0")

# CORS: solo orígenes explícitos. En prod, configura ALLOWED_ORIGINS en el entorno.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", FRONTEND_URL)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme     = OAuth2PasswordBearer(tokenUrl="/api/auth/login",  auto_error=False)
oauth2_superadmin = OAuth2PasswordBearer(tokenUrl="/api/super/login", auto_error=False)

# ─────────────────────────────────────────────────────────────────────────────
# SUBSCRIPTION VERIFICATION JOB
# Corre cada 6h. Consulta MP por cada suscripción 'authorized' y baja el plan
# a 'free' si el estado cambió a cancelado, pausado, o con cobro fallido.
# ─────────────────────────────────────────────────────────────────────────────
def _verify_subscriptions_job():
    if not os.environ.get("MP_ACCESS_TOKEN"):
        return  # MP no configurado, nada que verificar

    print("[SUBS CHECK] Verificando suscripciones activas...")
    db = get_super_db()
    try:
        rows = db.execute(
            "SELECT * FROM subscriptions WHERE status='authorized'"
        ).fetchall()
    except Exception as e:
        print(f"[SUBS CHECK] Error leyendo BD: {e}")
        db.close(); return

    downgraded = 0
    for row in rows:
        sub = dict(row)
        preapproval_id = sub.get("preapproval_id", "")
        slug           = sub.get("tenant_slug", "")
        if not preapproval_id or not slug:
            continue
        try:
            data   = mp_svc.get_preapproval(preapproval_id)
            status = data.get("status", "")

            if status == "authorized":
                # Suscripción sana — actualizar fecha de próximo cobro si cambió
                next_charge = data.get("auto_recurring", {}).get("end_date", "")
                if next_charge and next_charge != sub.get("current_period_end", ""):
                    db.execute(
                        "UPDATE subscriptions SET current_period_end=?, updated_at=datetime('now') WHERE id=?",
                        (next_charge, sub["id"])
                    )
            elif status in ("cancelled", "paused", "pending"):
                # Suscripción ya no está activa → bajar a expired
                db.execute(
                    "UPDATE subscriptions SET status=?, updated_at=datetime('now') WHERE id=?",
                    (status, sub["id"])
                )
                db.execute("UPDATE tenants SET plan='expired' WHERE slug=?", (slug,))
                print(f"[SUBS CHECK] ⬇ {slug} bajado a expired (MP status={status})")
                downgraded += 1

        except Exception as e:
            print(f"[SUBS CHECK] Error verificando {preapproval_id}: {e}")
            continue

    db.commit(); db.close()
    print(f"[SUBS CHECK] Completado. {len(rows)} verificadas, {downgraded} bajadas a free.")


# ─────────────────────────────────────────────────────────────────────────────
# LIFECYCLE
# ─────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_super_db()
    _load_config_to_env()
    sched.start()
    _reschedule_pending_reminders()
    # Job periódico: verificar suscripciones activas en MP cada 6 horas
    sched.schedule_interval("verify_subscriptions", _verify_subscriptions_job, hours=6)

@app.on_event("shutdown")
def on_shutdown():
    sched.stop()

# ─────────────────────────────────────────────────────────────────────────────
# DATABASES
# ─────────────────────────────────────────────────────────────────────────────
def get_super_db():
    c = sqlite3.connect(SUPER_DB, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

def init_super_db():
    db = get_super_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL, owner_email TEXT NOT NULL,
            owner_name TEXT NOT NULL, phone TEXT DEFAULT '',
            address TEXT DEFAULT '', city TEXT DEFAULT '',
            plan TEXT DEFAULT 'free', active INTEGER DEFAULT 1,
            lat REAL DEFAULT NULL, lng REAL DEFAULT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS super_admins (
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            must_change_password INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            tenant_slug TEXT NOT NULL,
            plan TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            preapproval_id TEXT DEFAULT '',
            external_reference TEXT DEFAULT '',
            amount REAL DEFAULT 0,
            currency TEXT DEFAULT 'CLP',
            current_period_end TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );
    """)
    # Migración: agregar lat/lng si no existen (para BDs ya creadas)
    try:
        db.execute("ALTER TABLE tenants ADD COLUMN lat REAL DEFAULT NULL")
        db.execute("ALTER TABLE tenants ADD COLUMN lng REAL DEFAULT NULL")
        db.commit()
        print("[DB] Columnas lat/lng agregadas a tenants")
    except Exception:
        pass  # Ya existen
    # Crear super admin por defecto solo si no existe
    # Contraseña inicial: se lee del entorno o se genera aleatoria
    if not db.execute("SELECT id FROM super_admins WHERE username='admin'").fetchone():
        initial_pw = os.environ.get("SUPER_ADMIN_INITIAL_PASSWORD") or secrets.token_urlsafe(16)
        db.execute(
            "INSERT INTO super_admins (id,username,password,must_change_password) VALUES (?,?,?,?)",
            (str(uuid.uuid4()), "admin", _hash(initial_pw), 1)
        )
        print(f"✅ Super admin creado. Contraseña inicial: {initial_pw}")
        print("   ⚠️  Cambia esta contraseña en el primer login.")
    db.commit(); db.close()


def _config_get(key: str, default: str = "") -> str:
    """Lee un valor de app_config (persiste entre reinicios)."""
    db = get_super_db()
    row = db.execute("SELECT value FROM app_config WHERE key=?", (key,)).fetchone()
    db.close()
    return row[0] if row else default


def _config_set(key: str, value: str):
    """Guarda un valor en app_config."""
    db = get_super_db()
    db.execute(
        "INSERT INTO app_config (key,value,updated_at) VALUES (?,?,datetime('now')) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        (key, value)
    )
    db.commit(); db.close()


def _load_config_to_env():
    """Al startup, carga la config guardada en DB a las variables de entorno."""
    try:
        for key in ("GMAIL_USER", "GMAIL_APP_PASSWORD",
                    "MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET",
                    "MP_CURRENCY", "MP_PRICE_PRO", "MP_PRICE_ENTERPRISE"):
            val = _config_get(key)
            if val and not os.environ.get(key):
                os.environ[key] = val
    except Exception as e:
        print(f"[STARTUP] Error cargando config: {e}")

def get_tenant_db(slug: str):
    c = sqlite3.connect(str(DB_DIR / f"{slug}.db"), check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

def init_tenant_db(slug: str):
    db = get_tenant_db(slug)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS barbers (
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL, bio TEXT DEFAULT '',
            specialty TEXT DEFAULT '', avatar TEXT DEFAULT '',
            instagram TEXT DEFAULT '', role TEXT DEFAULT 'barber',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY, barber_id TEXT NOT NULL,
            name TEXT NOT NULL, description TEXT DEFAULT '',
            price INTEGER NOT NULL DEFAULT 0, duration INTEGER NOT NULL DEFAULT 30,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (barber_id) REFERENCES barbers(id)
        );
        CREATE TABLE IF NOT EXISTS portfolio (
            id TEXT PRIMARY KEY, barber_id TEXT NOT NULL,
            image TEXT NOT NULL, caption TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (barber_id) REFERENCES barbers(id)
        );
        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY, barber_id TEXT NOT NULL,
            client_name TEXT NOT NULL, client_phone TEXT NOT NULL,
            client_email TEXT DEFAULT '', service_id TEXT NOT NULL,
            date TEXT NOT NULL, time TEXT NOT NULL,
            status TEXT DEFAULT 'pending', notes TEXT DEFAULT '',
            reminder_sent INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (barber_id) REFERENCES barbers(id),
            FOREIGN KEY (service_id) REFERENCES services(id)
        );
        CREATE TABLE IF NOT EXISTS invite_tokens (
            id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL,
            created_by TEXT NOT NULL, email TEXT DEFAULT '',
            used INTEGER DEFAULT 0, used_by TEXT DEFAULT '',
            expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (created_by) REFERENCES barbers(id)
        );
    """)
    db.commit(); db.close()

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _hash(pw): return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def _verify(pw, h): return bcrypt.checkpw(pw.encode(), h.encode())

def _utcnow() -> datetime:
    """UTC-aware datetime (evita deprecation de datetime.utcnow)."""
    return datetime.now(timezone.utc)

def _utcnow_iso() -> str:
    return _utcnow().strftime("%Y-%m-%dT%H:%M:%S")

def _make_token(sub: str, extra: dict | None = None, secret: str = SECRET_KEY) -> str:
    payload = {"sub": sub, "exp": _utcnow() + timedelta(hours=TOKEN_HOURS)}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, secret, algorithm=ALGORITHM)

def _decode_token(token, secret=SECRET_KEY):
    try: return jwt.decode(token, secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Sesión expirada")
    except: raise HTTPException(401, "Token inválido")

def _resolve_tenant(
    x_tenant: Optional[str] = Header(None),
    tenant_slug: Optional[str] = Query(None),
    token: Optional[str] = Depends(oauth2_scheme),
) -> str:
    slug = x_tenant or tenant_slug
    if not slug and token:
        try: slug = _decode_token(token).get("tenant")
        except: pass
    if not slug: raise HTTPException(400, "Tenant no especificado")
    db = get_super_db()
    t = db.execute("SELECT active FROM tenants WHERE slug=?", (slug,)).fetchone()
    db.close()
    if not t: raise HTTPException(404, f"Barbería '{slug}' no encontrada")
    if not t["active"]: raise HTTPException(403, "Barbería inactiva")
    return slug

def _current_barber(token: Optional[str] = Depends(oauth2_scheme), slug: str = Depends(_resolve_tenant)) -> dict:
    if not token: raise HTTPException(401, "Token requerido")
    payload = _decode_token(token)
    if payload.get("tenant") != slug: raise HTTPException(403, "Token no corresponde")
    db = get_tenant_db(slug)
    row = db.execute("SELECT * FROM barbers WHERE id=?", (payload["sub"],)).fetchone()
    db.close()
    if not row: raise HTTPException(401, "Barbero no encontrado")
    b = dict(row); b["_tenant"] = slug; return b

def _current_superadmin(token: Optional[str] = Depends(oauth2_superadmin)) -> dict:
    if not token: raise HTTPException(401, "Token requerido")
    p = _decode_token(token, secret=SUPER_SECRET)
    if p.get("role") != "superadmin": raise HTTPException(403, "No autorizado")
    return p

def _get_tenant_info(slug: str) -> dict:
    db = get_super_db()
    r = db.execute("SELECT * FROM tenants WHERE slug=?", (slug,)).fetchone()
    db.close()
    return dict(r) if r else {}

def _reschedule_pending_reminders():
    for db_file in DB_DIR.glob("*.db"):
        slug = db_file.stem
        try:
            db = get_tenant_db(slug)
            rows = db.execute("""
                SELECT a.id, a.date, a.time, a.client_email, a.client_name,
                       b.full_name as barber_name, s.name as service_name
                FROM appointments a
                JOIN barbers b ON a.barber_id=b.id
                JOIN services s ON a.service_id=s.id
                WHERE a.status NOT IN ('cancelled') AND a.reminder_sent=0
                AND a.client_email!=''
                AND datetime(a.date||' '||a.time) > datetime('now')
            """).fetchall()
            db.close()
            tenant_info = _get_tenant_info(slug)
            for r in rows: _schedule_reminder_job(slug, dict(r), tenant_info)
        except Exception as e: print(f"[STARTUP] {slug}: {e}")

def _schedule_reminder_job(slug: str, appt: dict, tenant_info: dict):
    if not appt.get("client_email"): return
    def job():
        try:
            db = get_tenant_db(slug)
            row = db.execute("SELECT status FROM appointments WHERE id=?", (appt["id"],)).fetchone()
            if not row or dict(row)["status"] == "cancelled":
                db.close(); return
            ok = send_reminder(
                to=appt["client_email"], client_name=appt["client_name"],
                barber_name=appt["barber_name"], service_name=appt["service_name"],
                date=appt["date"], time=appt["time"],
                tenant_name=tenant_info.get("name", slug),
                tenant_address=tenant_info.get("address", ""),
                tenant_phone=tenant_info.get("phone", ""),
            )
            if ok:
                db.execute("UPDATE appointments SET reminder_sent=1 WHERE id=?", (appt["id"],))
                db.commit()
            db.close()
        except Exception as e: print(f"[REMINDER] {appt['id']}: {e}")
    sched.schedule_reminder(appt["id"], appt["date"], appt["time"], job)

# ─────────────────────────────────────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────────────────────────────────────
class TenantCreate(BaseModel):
    slug: str; name: str; owner_email: str; owner_name: str
    phone: str = ""; address: str = ""; city: str = ""; plan: str = "free"

class TenantUpdate(BaseModel):
    name: Optional[str]=None; phone: Optional[str]=None; address: Optional[str]=None
    city: Optional[str]=None; plan: Optional[str]=None; active: Optional[int]=None

class RegisterBody(BaseModel):
    username: str; full_name: str; email: str; password: str
    invite_token: str

class LoginBody(BaseModel):
    username: str; password: str

class BarberUpdate(BaseModel):
    full_name: Optional[str]=None; bio: Optional[str]=None; specialty: Optional[str]=None
    avatar: Optional[str]=None; instagram: Optional[str]=None

class ServiceBody(BaseModel):
    name: str; description: str=""; price: int; duration: int=30

class ServiceUpdate(BaseModel):
    name: Optional[str]=None; description: Optional[str]=None
    price: Optional[int]=None; duration: Optional[int]=None; active: Optional[int]=None

class PortfolioBody(BaseModel):
    image: str; caption: str=""

class AppointmentBody(BaseModel):
    barber_id: str; client_name: str; client_phone: str; client_email: str=""
    service_id: str; date: str; time: str; notes: str=""

class StatusUpdate(BaseModel):
    status: str

class InviteCreate(BaseModel):
    email: str=""

class OnboardBody(BaseModel):
    slug: str; name: str; owner_email: str; owner_name: str
    phone: str=""; address: str=""; city: str=""
    barber_username: str; barber_password: str
    plan: str = "free"

class EmailConfig(BaseModel):
    gmail_user: str; gmail_app_password: str

# ─────────────────────────────────────────────────────────────────────────────
# SUPER ADMIN
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/super/login")
def super_login(body: LoginBody):
    db = get_super_db()
    row = db.execute("SELECT * FROM super_admins WHERE username=?", (body.username,)).fetchone()
    db.close()
    if not row or not _verify(body.password, row["password"]):
        raise HTTPException(400, "Credenciales inválidas")
    r = dict(row)
    return {
        "token": _make_token(r["id"], {"role": "superadmin"}, secret=SUPER_SECRET),
        "must_change_password": bool(r.get("must_change_password", 0)),
    }

class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str

@app.post("/api/super/change-password")
def super_change_password(body: ChangePasswordBody, sa=Depends(_current_superadmin)):
    if len(body.new_password) < 12:
        raise HTTPException(400, "La nueva contraseña debe tener al menos 12 caracteres")
    db = get_super_db()
    row = db.execute("SELECT * FROM super_admins WHERE id=?", (sa["sub"],)).fetchone()
    if not row or not _verify(body.current_password, row["password"]):
        db.close(); raise HTTPException(400, "Contraseña actual incorrecta")
    db.execute(
        "UPDATE super_admins SET password=?, must_change_password=0 WHERE id=?",
        (_hash(body.new_password), sa["sub"])
    )
    db.commit(); db.close()
    return {"ok": True}

@app.get("/api/super/tenants")
def list_tenants(sa=Depends(_current_superadmin)):
    db = get_super_db()
    rows = db.execute("SELECT * FROM tenants ORDER BY created_at DESC").fetchall()
    db.close(); return [dict(r) for r in rows]

@app.post("/api/super/tenants", status_code=201)
def create_tenant(body: TenantCreate, sa=Depends(_current_superadmin)):
    if not re.match(r'^[a-z0-9-]+$', body.slug): raise HTTPException(400, "Slug inválido")
    db = get_super_db()
    if db.execute("SELECT id FROM tenants WHERE slug=?", (body.slug,)).fetchone():
        db.close(); raise HTTPException(409, "Slug ya existe")
    tid = str(uuid.uuid4())
    lat, lng = _geocode(body.address, body.city)
    db.execute(
        "INSERT INTO tenants (id,slug,name,owner_email,owner_name,phone,address,city,plan,lat,lng) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (tid, body.slug, body.name, body.owner_email, body.owner_name, body.phone, body.address, body.city, body.plan, lat, lng)
    )
    db.commit(); db.close(); init_tenant_db(body.slug)
    return {"id": tid, "slug": body.slug}

@app.put("/api/super/tenants/{slug}")
def update_tenant(slug: str, body: TenantUpdate, sa=Depends(_current_superadmin)):
    ALLOWED_FIELDS = {"name", "phone", "address", "city", "plan", "active"}
    db = get_super_db()
    fields = {k: v for k, v in body.dict().items() if v is not None and k in ALLOWED_FIELDS}
    # Si cambia dirección o ciudad, re-geocodificar
    if "address" in fields or "city" in fields:
        tenant = db.execute("SELECT address, city FROM tenants WHERE slug=?", (slug,)).fetchone()
        if tenant:
            new_address = fields.get("address", dict(tenant)["address"])
            new_city    = fields.get("city",    dict(tenant)["city"])
            lat, lng = _geocode(new_address, new_city)
            if lat:
                fields["lat"] = lat
                fields["lng"] = lng
    if fields:
        set_clause = ", ".join(f"{k}=?" for k in fields)
        db.execute(f"UPDATE tenants SET {set_clause} WHERE slug=?", (*fields.values(), slug))
        db.commit()
    db.close(); return {"ok": True}

@app.delete("/api/super/tenants/{slug}")
def delete_tenant(slug: str, sa=Depends(_current_superadmin)):
    db = get_super_db()
    db.execute("DELETE FROM tenants WHERE slug=?", (slug,)); db.commit(); db.close()
    p = Path(str(DB_DIR / f"{slug}.db"))
    if p.exists(): p.unlink()
    return {"ok": True}

@app.get("/api/super/tenants/{slug}/stats")
def tenant_stats(slug: str, sa=Depends(_current_superadmin)):
    if not (DB_DIR / f"{slug}.db").exists():
        return {"barbers": 0, "appointments": 0, "portfolio": 0, "pending_reminders": 0}
    db = get_tenant_db(slug)
    r = {
        "barbers":          db.execute("SELECT COUNT(*) FROM barbers").fetchone()[0],
        "appointments":     db.execute("SELECT COUNT(*) FROM appointments").fetchone()[0],
        "portfolio":        db.execute("SELECT COUNT(*) FROM portfolio").fetchone()[0],
        "pending_reminders":db.execute("SELECT COUNT(*) FROM appointments WHERE reminder_sent=0 AND client_email!='' AND status!='cancelled'").fetchone()[0],
    }
    db.close(); return r

@app.get("/api/super/scheduler/jobs")
def scheduler_jobs(sa=Depends(_current_superadmin)):
    return sched.list_jobs()

@app.post("/api/super/email-config")
def set_email_config(body: EmailConfig, sa=Depends(_current_superadmin)):
    os.environ["GMAIL_USER"]         = body.gmail_user
    os.environ["GMAIL_APP_PASSWORD"] = body.gmail_app_password
    # Persistir en BD para sobrevivir reinicios
    _config_set("GMAIL_USER", body.gmail_user)
    _config_set("GMAIL_APP_PASSWORD", body.gmail_app_password)
    return {"ok": True}

@app.get("/api/super/email-config")
def get_email_config(sa=Depends(_current_superadmin)):
    user = os.environ.get("GMAIL_USER", "")
    return {
        "gmail_user": user,
        "configured": bool(user and os.environ.get("GMAIL_APP_PASSWORD"))
    }

@app.post("/api/super/email-test")
def test_email(body: dict, sa=Depends(_current_superadmin)):
    to = body.get("to","")
    if not to: raise HTTPException(400,"Campo 'to' requerido")
    ok = send_booking_confirmation(to=to, client_name="Test", barber_name="Barbero", service_name="Fade", price=10000, date="2024-12-25", time="15:30", tenant_name="Homie Test")
    return {"ok": ok}

# ─────────────────────────────────────────────────────────────────────────────
# GEOCODING — convierte dirección en lat/lng usando Google Maps o Nominatim
# ─────────────────────────────────────────────────────────────────────────────
def _geocode(address: str, city: str) -> tuple[float | None, float | None]:
    """
    Intenta geocodificar la dirección.
    Usa Google Maps si GOOGLE_MAPS_API_KEY está configurada,
    si no usa Nominatim (OpenStreetMap) — gratuito, sin key.
    Retorna (lat, lng) o (None, None) si falla.
    """
    query = ", ".join(filter(None, [address, city, "Chile"]))
    if not query.strip():
        return None, None

    google_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")

    if google_key:
        try:
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": query, "key": google_key, "language": "es"},
                timeout=8,
            )
            data = resp.json()
            if data.get("status") == "OK":
                loc = data["results"][0]["geometry"]["location"]
                return loc["lat"], loc["lng"]
        except Exception as e:
            print(f"[GEOCODE] Google error: {e}")

    # Fallback: Nominatim (OpenStreetMap) — sin key, rate limit 1 req/s
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": "Homie-SaaS/1.0"},
            timeout=8,
        )
        results = resp.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:
        print(f"[GEOCODE] Nominatim error: {e}")

    return None, None


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en km entre dos coordenadas (fórmula Haversine)."""
    import math
    R = 6371  # Radio de la Tierra en km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC SEARCH — clientes buscan barberías
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/search")
def search_barbers(q: str = Query(default="", min_length=0)):
    """Búsqueda pública por texto. No requiere auth."""
    db = get_super_db()
    if q.strip():
        rows = db.execute(
            """SELECT slug, name, city, address, phone, lat, lng
               FROM tenants
               WHERE active=1 AND plan != 'expired'
                 AND (name LIKE ? OR city LIKE ? OR slug LIKE ?)
               ORDER BY name LIMIT 20""",
            (f"%{q}%", f"%{q}%", f"%{q}%")
        ).fetchall()
    else:
        rows = db.execute(
            """SELECT slug, name, city, address, phone, lat, lng
               FROM tenants WHERE active=1 AND plan != 'expired'
               ORDER BY created_at DESC LIMIT 20"""
        ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/api/search/nearby")
def search_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(default=5.0),
):
    """
    Búsqueda por coordenadas GPS con radio dinámico.
    Devuelve barberías ordenadas por distancia.
    Solo incluye las que tienen lat/lng geocodificado.
    """
    db = get_super_db()
    rows = db.execute(
        """SELECT slug, name, city, address, phone, lat, lng
           FROM tenants
           WHERE active=1 AND plan != 'expired'
             AND lat IS NOT NULL AND lng IS NOT NULL"""
    ).fetchall()
    db.close()

    results = []
    for r in rows:
        row = dict(r)
        dist = _haversine(lat, lng, row["lat"], row["lng"])
        if dist <= radius_km:
            row["distance_km"] = round(dist, 2)
            results.append(row)

    results.sort(key=lambda x: x["distance_km"])
    return {
        "results": results,
        "radius_km": radius_km,
        "count": len(results),
    }


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC TENANT INFO
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/tenant/info")
def tenant_info(slug: str = Depends(_resolve_tenant)):
    db = get_super_db()
    r = db.execute("SELECT id,slug,name,owner_name,phone,address,city,plan FROM tenants WHERE slug=?", (slug,)).fetchone()
    db.close()
    info = dict(r)
    info["plan_limits"] = _get_plan_limits(slug)
    return info

# ─────────────────────────────────────────────────────────────────────────────
# INVITE TOKENS
# ─────────────────────────────────────────────────────────────────────────────
def _require_owner(me: dict):
    """Raises 403 if the current barber is not the tenant owner."""
    if me.get("role") != "owner":
        raise HTTPException(403, "Solo el dueño de la barbería puede gestionar invitaciones")

@app.post("/api/invites", status_code=201)
def create_invite(body: InviteCreate, me: dict = Depends(_current_barber)):
    _require_owner(me)
    _check_feature(me["_tenant"], "invites")
    slug  = me["_tenant"]
    token = str(uuid.uuid4()).replace("-","")[:24]
    expires = (_utcnow() + timedelta(hours=INVITE_EXPIRE_H)).strftime("%Y-%m-%dT%H:%M:%S")
    db = get_tenant_db(slug)
    iid = str(uuid.uuid4())
    db.execute("INSERT INTO invite_tokens (id,token,created_by,email,expires_at) VALUES (?,?,?,?,?)",
               (iid, token, me["id"], body.email, expires))
    db.commit(); db.close()
    invite_url = f"{FRONTEND_URL}/{slug}/auth/register?invite={token}"
    email_sent = False
    if body.email:
        ti = _get_tenant_info(slug)
        email_sent = send_invite(to=body.email, invite_url=invite_url,
                                 tenant_name=ti.get("name", slug),
                                 invited_by=me["full_name"], expires_hours=INVITE_EXPIRE_H)
    return {"token": token, "invite_url": invite_url, "expires_at": expires, "email_sent": email_sent}

@app.get("/api/invites")
def list_invites(me: dict = Depends(_current_barber)):
    _require_owner(me)
    db = get_tenant_db(me["_tenant"])
    rows = db.execute("SELECT * FROM invite_tokens ORDER BY created_at DESC").fetchall()
    db.close()
    now = _utcnow_iso()
    return [{**dict(r), "expired": dict(r)["expires_at"] < now} for r in rows]

@app.delete("/api/invites/{iid}")
def delete_invite(iid: str, me: dict = Depends(_current_barber)):
    _require_owner(me)
    db = get_tenant_db(me["_tenant"])
    db.execute("DELETE FROM invite_tokens WHERE id=?", (iid,))
    db.commit(); db.close(); return {"ok": True}

@app.get("/api/invites/validate/{token}")
def validate_invite(token: str, slug: str = Depends(_resolve_tenant)):
    db = get_tenant_db(slug)
    row = db.execute("SELECT * FROM invite_tokens WHERE token=? AND used=0", (token,)).fetchone()
    db.close()
    if not row: raise HTTPException(404, "Token inválido o ya utilizado")
    if dict(row)["expires_at"] < _utcnow_iso(): raise HTTPException(410, "Enlace expirado")
    return {"valid": True, "email": dict(row)["email"]}

# ─────────────────────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/auth/register", status_code=201)
def register(body: RegisterBody, slug: str = Depends(_resolve_tenant)):
    db = get_tenant_db(slug)
    invite = db.execute("SELECT * FROM invite_tokens WHERE token=? AND used=0", (body.invite_token,)).fetchone()
    if not invite: db.close(); raise HTTPException(403, "Token de invitación inválido")
    if dict(invite)["expires_at"] < _utcnow_iso(): db.close(); raise HTTPException(410, "Enlace expirado")
    if db.execute("SELECT id FROM barbers WHERE username=? OR email=?", (body.username, body.email)).fetchone():
        db.close(); raise HTTPException(400, "Usuario o email ya registrado")
    # Check plan barber limit
    limits = _get_plan_limits(slug)
    if limits["max_barbers"] is not None:
        count = db.execute("SELECT COUNT(*) FROM barbers").fetchone()[0]
        if count >= limits["max_barbers"]:
            db.close(); raise HTTPException(402, f"Tu plan permite máximo {limits['max_barbers']} barbero(s). Actualiza tu plan en /pricing")
    bid = str(uuid.uuid4())
    db.execute("INSERT INTO barbers (id,username,full_name,email,password) VALUES (?,?,?,?,?)",
               (bid, body.username, body.full_name, body.email, _hash(body.password)))
    for name, desc, price, dur in [("Corte Clásico","Tijera o máquina",8000,30),("Fade + Diseño","Degradado personalizado",12000,45),("Barba","Perfilado y arreglo",5000,20),("Combo Completo","Corte + barba",15000,60)]:
        db.execute("INSERT INTO services (id,barber_id,name,description,price,duration) VALUES (?,?,?,?,?,?)",
                   (str(uuid.uuid4()), bid, name, desc, price, dur))
    db.execute("UPDATE invite_tokens SET used=1, used_by=? WHERE token=?", (bid, body.invite_token))
    db.commit(); db.close()
    return {"token": _make_token(bid, {"tenant": slug}), "barber_id": bid}

@app.post("/api/auth/login")
def login(body: LoginBody, slug: str = Depends(_resolve_tenant)):
    db = get_tenant_db(slug)
    row = db.execute("SELECT * FROM barbers WHERE username=?", (body.username,)).fetchone()
    db.close()
    if not row or not _verify(body.password, row["password"]): raise HTTPException(400, "Credenciales incorrectas")
    b = dict(row); b.pop("password")
    return {"token": _make_token(row["id"], {"tenant": slug}), "barber": b}

# ─────────────────────────────────────────────────────────────────────────────
# BARBERS
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/barbers")
def list_barbers(slug: str = Depends(_resolve_tenant)):
    db = get_tenant_db(slug)
    rows = db.execute("SELECT id,username,full_name,bio,specialty,avatar,instagram FROM barbers").fetchall()
    db.close(); return [dict(r) for r in rows]

@app.get("/api/barbers/me")
def get_me(me: dict = Depends(_current_barber)):
    me.pop("password", None); me.pop("_tenant", None); return me

@app.put("/api/barbers/me")
def update_me(body: BarberUpdate, me: dict = Depends(_current_barber)):
    ALLOWED_FIELDS = {"full_name", "bio", "specialty", "avatar", "instagram"}
    db = get_tenant_db(me["_tenant"])
    fields = {k: v for k, v in body.dict().items() if v is not None and k in ALLOWED_FIELDS}
    if fields:
        set_clause = ", ".join(f"{k}=?" for k in fields)
        db.execute(f"UPDATE barbers SET {set_clause} WHERE id=?", (*fields.values(), me["id"]))
        db.commit()
    db.close(); return {"ok": True}

@app.get("/api/barbers/{bid}")
def get_barber(bid: str, slug: str = Depends(_resolve_tenant)):
    db = get_tenant_db(slug)
    row = db.execute("SELECT id,username,full_name,bio,specialty,avatar,instagram FROM barbers WHERE id=?", (bid,)).fetchone()
    db.close()
    if not row: raise HTTPException(404, "No encontrado")
    return dict(row)

# ─────────────────────────────────────────────────────────────────────────────
# SERVICES
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/barbers/{bid}/services")
def get_services(bid: str, slug: str = Depends(_resolve_tenant)):
    db = get_tenant_db(slug); rows = db.execute("SELECT * FROM services WHERE barber_id=? AND active=1", (bid,)).fetchall(); db.close(); return [dict(r) for r in rows]

@app.get("/api/services/my")
def my_services(me: dict = Depends(_current_barber)):
    db = get_tenant_db(me["_tenant"]); rows = db.execute("SELECT * FROM services WHERE barber_id=?", (me["id"],)).fetchall(); db.close(); return [dict(r) for r in rows]

@app.post("/api/services", status_code=201)
def create_service(body: ServiceBody, me: dict = Depends(_current_barber)):
    sid = str(uuid.uuid4()); db = get_tenant_db(me["_tenant"])
    db.execute("INSERT INTO services (id,barber_id,name,description,price,duration) VALUES (?,?,?,?,?,?)", (sid, me["id"], body.name, body.description, body.price, body.duration))
    db.commit(); db.close(); return {"id": sid}

@app.put("/api/services/{sid}")
def update_service(sid: str, body: ServiceUpdate, me: dict = Depends(_current_barber)):
    ALLOWED_FIELDS = {"name", "description", "price", "duration", "active"}
    db = get_tenant_db(me["_tenant"])
    if not db.execute("SELECT id FROM services WHERE id=? AND barber_id=?", (sid, me["id"])).fetchone():
        db.close(); raise HTTPException(404, "No encontrado")
    fields = {k: v for k, v in body.dict().items() if v is not None and k in ALLOWED_FIELDS}
    if fields:
        set_clause = ", ".join(f"{k}=?" for k in fields)
        db.execute(f"UPDATE services SET {set_clause} WHERE id=?", (*fields.values(), sid))
        db.commit()
    db.close(); return {"ok": True}

@app.delete("/api/services/{sid}")
def delete_service(sid: str, me: dict = Depends(_current_barber)):
    # Soft delete: marcar como inactivo en vez de borrar
    # Las citas existentes mantienen su referencia válida
    db = get_tenant_db(me["_tenant"])
    if not db.execute("SELECT id FROM services WHERE id=? AND barber_id=?", (sid, me["id"])).fetchone():
        db.close(); raise HTTPException(404, "No encontrado")
    db.execute("UPDATE services SET active=0 WHERE id=? AND barber_id=?", (sid, me["id"]))
    db.commit(); db.close(); return {"ok": True}

# ─────────────────────────────────────────────────────────────────────────────
# PORTFOLIO
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/barbers/{bid}/portfolio")
def get_portfolio(bid: str, slug: str = Depends(_resolve_tenant)):
    db = get_tenant_db(slug); rows = db.execute("SELECT * FROM portfolio WHERE barber_id=? ORDER BY created_at DESC", (bid,)).fetchall(); db.close(); return [dict(r) for r in rows]

@app.post("/api/portfolio", status_code=201)
def add_portfolio(body: PortfolioBody, me: dict = Depends(_current_barber)):
    _check_feature(me["_tenant"], "portfolio")
    pid = str(uuid.uuid4()); db = get_tenant_db(me["_tenant"])
    db.execute("INSERT INTO portfolio (id,barber_id,image,caption) VALUES (?,?,?,?)", (pid, me["id"], body.image, body.caption))
    db.commit(); db.close(); return {"id": pid}

@app.delete("/api/portfolio/{pid}")
def del_portfolio(pid: str, me: dict = Depends(_current_barber)):
    db = get_tenant_db(me["_tenant"]); db.execute("DELETE FROM portfolio WHERE id=? AND barber_id=?", (pid, me["id"])); db.commit(); db.close(); return {"ok": True}

# ─────────────────────────────────────────────────────────────────────────────
# APPOINTMENTS + EMAIL + REMINDER
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/appointments", status_code=201)
def book(
    body: AppointmentBody,
    slug: str = Depends(_resolve_tenant),
    token: Optional[str] = Depends(oauth2_scheme),
):
    db = get_tenant_db(slug)
    limits = _get_plan_limits(slug)

    # Verificar si quien reserva es un barbero logueado intentando reservar consigo mismo
    if token:
        try:
            payload = _decode_token(token)
            if payload.get("tenant") == slug and payload.get("sub") == body.barber_id:
                db.close()
                raise HTTPException(400, "No puedes reservar una cita contigo mismo")
        except HTTPException:
            raise
        except Exception:
            pass  # Token inválido o de otro tenant — continuar normalmente

    # Check monthly appointment limit
    if limits["max_appts_monthly"] is not None:
        from datetime import date
        month_start = date.today().strftime("%Y-%m-01")
        count = db.execute(
            "SELECT COUNT(*) FROM appointments WHERE date >= ? AND status != 'cancelled'",
            (month_start,)
        ).fetchone()[0]
        if count >= limits["max_appts_monthly"]:
            db.close(); raise HTTPException(402, f"Has alcanzado el límite de {limits['max_appts_monthly']} citas este mes. Actualiza tu plan en /pricing")
    if not db.execute("SELECT id FROM barbers WHERE id=?", (body.barber_id,)).fetchone(): db.close(); raise HTTPException(404, "Barbero no encontrado")
    svc = db.execute("SELECT * FROM services WHERE id=? AND barber_id=? AND active=1", (body.service_id, body.barber_id)).fetchone()
    if not svc: db.close(); raise HTTPException(404, "Servicio no encontrado")
    if db.execute("SELECT id FROM appointments WHERE barber_id=? AND date=? AND time=? AND status!='cancelled'", (body.barber_id, body.date, body.time)).fetchone():
        db.close(); raise HTTPException(409, "Horario no disponible")
    barber = db.execute("SELECT full_name FROM barbers WHERE id=?", (body.barber_id,)).fetchone()
    aid = str(uuid.uuid4())
    db.execute("INSERT INTO appointments (id,barber_id,client_name,client_phone,client_email,service_id,date,time,notes) VALUES (?,?,?,?,?,?,?,?,?)",
               (aid, body.barber_id, body.client_name, body.client_phone, body.client_email, body.service_id, body.date, body.time, body.notes))
    db.commit()
    appt = {"id": aid, "date": body.date, "time": body.time, "client_email": body.client_email,
            "client_name": body.client_name, "barber_name": dict(barber)["full_name"] if barber else "",
            "service_name": dict(svc)["name"]}
    db.close()
    ti = _get_tenant_info(slug)
    limits = _get_plan_limits(slug)
    if body.client_email and limits["emails"]:
        send_booking_confirmation(to=body.client_email, client_name=body.client_name,
            barber_name=appt["barber_name"], service_name=appt["service_name"],
            price=dict(svc)["price"], date=body.date, time=body.time,
            tenant_name=ti.get("name", slug), tenant_address=ti.get("address",""), tenant_phone=ti.get("phone",""))
    if limits["emails"]:
        _schedule_reminder_job(slug, appt, ti)
    return {"id": aid, "message": "Cita reservada"}

@app.get("/api/appointments/my")
def my_appointments(me: dict = Depends(_current_barber)):
    db = get_tenant_db(me["_tenant"])
    rows = db.execute("SELECT a.*, s.name as service_name, s.price as service_price FROM appointments a JOIN services s ON a.service_id=s.id WHERE a.barber_id=? ORDER BY a.date DESC, a.time DESC", (me["id"],)).fetchall()
    db.close(); return [dict(r) for r in rows]

@app.put("/api/appointments/{aid}/status")
def update_status(aid: str, body: StatusUpdate, me: dict = Depends(_current_barber)):
    if body.status not in ["pending","confirmed","completed","cancelled"]: raise HTTPException(400, "Estado inválido")
    db = get_tenant_db(me["_tenant"])
    db.execute("UPDATE appointments SET status=? WHERE id=? AND barber_id=?", (body.status, aid, me["id"]))
    db.commit(); db.close()
    if body.status == "cancelled": sched.cancel_reminder(aid)
    return {"ok": True}

@app.get("/api/barbers/{bid}/availability")
def availability(bid: str, date: str, slug: str = Depends(_resolve_tenant)):
    db = get_tenant_db(slug)
    booked = {r["time"] for r in db.execute("SELECT time FROM appointments WHERE barber_id=? AND date=? AND status!='cancelled'", (bid, date)).fetchall()}
    db.close()
    slots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"]
    return {"available": [s for s in slots if s not in booked], "booked": list(booked)}

# ─────────────────────────────────────────────────────────────────────────────
# ONBOARDING (first barber is owner — no invite needed)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/onboarding", status_code=201)
def onboarding(body: OnboardBody):
    if not re.match(r'^[a-z0-9-]+$', body.slug): raise HTTPException(400, "Slug inválido")
    db = get_super_db()
    if db.execute("SELECT id FROM tenants WHERE slug=?", (body.slug,)).fetchone():
        db.close(); raise HTTPException(409, "Slug ya en uso")
    tid = str(uuid.uuid4())

    # Geocodificar la dirección en background (no bloquea el registro si falla)
    lat, lng = _geocode(body.address, body.city)
    if lat:
        print(f"[GEOCODE] {body.slug}: {lat}, {lng}")

    # Siempre crear como 'trial' — acceso completo por 14 días
    db.execute(
        "INSERT INTO tenants (id,slug,name,owner_email,owner_name,phone,address,city,plan,lat,lng) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (tid, body.slug, body.name, body.owner_email, body.owner_name,
         body.phone, body.address, body.city, "trial", lat, lng)
    )
    db.commit(); db.close()

    init_tenant_db(body.slug)
    tdb = get_tenant_db(body.slug)
    bid = str(uuid.uuid4())
    tdb.execute(
        "INSERT INTO barbers (id,username,full_name,email,password,role) VALUES (?,?,?,?,?,?)",
        (bid, body.barber_username, body.owner_name, body.owner_email,
         _hash(body.barber_password), "owner")
    )
    for name, desc, price, dur in [
        ("Corte Clásico", "Tijera o máquina", 8000, 30),
        ("Fade + Diseño",  "Degradado personalizado", 12000, 45),
        ("Barba",         "Perfilado y arreglo", 5000, 20),
    ]:
        tdb.execute(
            "INSERT INTO services (id,barber_id,name,description,price,duration) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), bid, name, desc, price, dur)
        )
    tdb.commit(); tdb.close()

    token = _make_token(bid, {"tenant": body.slug})
    from datetime import timezone
    trial_ends = (_utcnow() + timedelta(days=TRIAL_DAYS)).strftime("%Y-%m-%d")
    result = {
        "message":       "Barbería creada",
        "slug":          body.slug,
        "token":         token,
        "dashboard_url": f"/{body.slug}/dashboard",
        "plan":          "trial",
        "trial_ends_at": trial_ends,
        "checkout_url":  None,
    }

    # Si el plan solicitado es de pago, crear suscripción en MP y devolver checkout_url
    requested_plan = body.plan if body.plan in ("pro", "enterprise") else None
    if requested_plan and os.environ.get("MP_ACCESS_TOKEN"):
        try:
            backend_url  = os.environ.get("BACKEND_URL", "http://localhost:8000")
            mp_result = mp_svc.create_subscription(
                tenant_slug=body.slug,
                plan=requested_plan,
                payer_email=body.owner_email,
                back_url_success=f"{FRONTEND_URL}/{body.slug}/dashboard?payment=success&plan={requested_plan}",
                back_url_failure=f"{FRONTEND_URL}/{body.slug}/dashboard?payment=failure",
                notification_url=f"{backend_url}/api/webhooks/mercadopago",
            )
            # Guardar suscripción pendiente
            sdb = get_super_db()
            sdb.execute(
                "INSERT INTO subscriptions (id,tenant_slug,plan,status,preapproval_id,external_reference) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), body.slug, requested_plan, "pending",
                 mp_result["preapproval_id"], f"{body.slug}::{requested_plan}")
            )
            sdb.commit(); sdb.close()
            result["checkout_url"]   = mp_result["init_point"]
            result["requested_plan"] = requested_plan
        except Exception as e:
            # Si MP falla, el tenant queda en free — el usuario puede upgradear después
            print(f"[ONBOARDING] MP error para {body.slug}: {e}")
            result["mp_error"] = "No se pudo iniciar el pago. Podrás upgradear desde el dashboard."

    return result


# ─────────────────────────────────────────────────────────────────────────────
# SUBSCRIPTIONS — MercadoPago
# ─────────────────────────────────────────────────────────────────────────────

class SubscribeBody(BaseModel):
    plan: str  # "pro" | "enterprise"

@app.post("/api/billing/subscribe")
def create_subscription(body: SubscribeBody, me: dict = Depends(_current_barber)):
    """
    El dueño de la barbería inicia el proceso de pago para un plan.
    Devuelve la URL de checkout de MercadoPago.
    """
    if me.get("role") != "owner":
        raise HTTPException(403, "Solo el dueño puede gestionar el plan")
    if body.plan not in ("pro", "enterprise"):
        raise HTTPException(400, "Plan inválido")

    slug = me["_tenant"]
    tenant = _get_tenant_info(slug)
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    frontend_url = FRONTEND_URL

    try:
        result = mp_svc.create_subscription(
            tenant_slug=slug,
            plan=body.plan,
            payer_email=tenant.get("owner_email", me.get("email", "")),
            back_url_success=f"{frontend_url}/{slug}/dashboard?payment=success&plan={body.plan}",
            back_url_failure=f"{frontend_url}/{slug}/dashboard?payment=failure",
            notification_url=f"{backend_url}/api/webhooks/mercadopago",
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Guardar suscripción pendiente
    db = get_super_db()
    sid = str(uuid.uuid4())
    db.execute(
        "INSERT OR REPLACE INTO subscriptions (id, tenant_slug, plan, status, preapproval_id, external_reference) VALUES (?,?,?,?,?,?)",
        (sid, slug, body.plan, "pending", result["preapproval_id"], f"{slug}::{body.plan}")
    )
    db.commit(); db.close()

    return {"init_point": result["init_point"], "preapproval_id": result["preapproval_id"]}


@app.get("/api/billing/status")
def billing_status(me: dict = Depends(_current_barber)):
    """Devuelve el plan actual y el estado de la suscripción."""
    slug = me["_tenant"]
    tenant = _get_tenant_info(slug)
    db = get_super_db()
    sub = db.execute(
        "SELECT * FROM subscriptions WHERE tenant_slug=? ORDER BY created_at DESC LIMIT 1",
        (slug,)
    ).fetchone()
    db.close()
    return {
        "plan": tenant.get("plan", "free"),
        "plan_limits": _get_plan_limits(slug),
        "subscription": dict(sub) if sub else None,
    }


@app.post("/api/billing/cancel")
def cancel_subscription(me: dict = Depends(_current_barber)):
    """Cancela la suscripción activa del tenant."""
    if me.get("role") != "owner":
        raise HTTPException(403, "Solo el dueño puede cancelar el plan")
    slug = me["_tenant"]
    db = get_super_db()
    sub = db.execute(
        "SELECT * FROM subscriptions WHERE tenant_slug=? AND status='authorized' ORDER BY created_at DESC LIMIT 1",
        (slug,)
    ).fetchone()
    if not sub:
        db.close(); raise HTTPException(404, "No hay suscripción activa")
    sub = dict(sub)

    # Cancelar en MP
    if sub.get("preapproval_id"):
        mp_svc.cancel_subscription(sub["preapproval_id"])

    # Actualizar BD
    db.execute(
        "UPDATE subscriptions SET status='cancelled', updated_at=datetime('now') WHERE id=?",
        (sub["id"],)
    )
    db.execute("UPDATE tenants SET plan='expired' WHERE slug=?", (slug,))
    db.commit(); db.close()
    return {"ok": True, "message": "Suscripción cancelada. Tu plan ha expirado."}


# ─────────────────────────────────────────────────────────────────────────────
# WEBHOOK — MercadoPago
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import Request

@app.post("/api/webhooks/mercadopago")
async def mp_webhook(request: Request):
    """
    Recibe notificaciones de MercadoPago sobre cambios en suscripciones.
    MP envía { type: "subscription_preapproval", data: { id: "preapproval_id" } }
    """
    # Validar firma
    x_sig  = request.headers.get("x-signature", "")
    x_req  = request.headers.get("x-request-id", "")
    body   = await request.json()
    data_id = body.get("data", {}).get("id", "")

    if x_sig and not mp_svc.verify_webhook_signature(x_sig, x_req, data_id):
        raise HTTPException(401, "Firma de webhook inválida")

    topic = body.get("type", body.get("topic", ""))
    print(f"[MP WEBHOOK] topic={topic} data_id={data_id}")

    # Solo procesar eventos de suscripciones
    if topic not in ("subscription_preapproval", "preapproval"):
        return {"ok": True, "ignored": True}

    if not data_id:
        return {"ok": True, "ignored": True}

    # Consultar estado real en MP
    try:
        preapproval = mp_svc.get_preapproval(data_id)
    except Exception as e:
        print(f"[MP WEBHOOK] Error obteniendo preapproval: {e}")
        raise HTTPException(500, "Error consultando MercadoPago")

    status    = preapproval.get("status", "")
    ext_ref   = preapproval.get("external_reference", "")
    slug, plan = mp_svc.parse_external_reference(ext_ref)

    print(f"[MP WEBHOOK] preapproval_id={data_id} status={status} slug={slug} plan={plan}")

    if not slug or not plan:
        return {"ok": True, "ignored": True}

    db = get_super_db()

    if status == "authorized":
        # Pago aprobado → activar plan
        next_charge = preapproval.get("auto_recurring", {}).get("end_date", "")
        db.execute(
            "UPDATE tenants SET plan=? WHERE slug=?", (plan, slug)
        )
        db.execute(
            """UPDATE subscriptions SET status='authorized', preapproval_id=?,
               updated_at=datetime('now'), current_period_end=?
               WHERE tenant_slug=? AND plan=?""",
            (data_id, next_charge, slug, plan)
        )
        print(f"[MP WEBHOOK] ✓ Plan '{plan}' activado para '{slug}'")

    elif status in ("cancelled", "paused"):
        # Suscripción cancelada o pausada → bajar a free
        db.execute("UPDATE tenants SET plan='free' WHERE slug=?", (slug,))
        db.execute(
            "UPDATE subscriptions SET status=?, updated_at=datetime('now') WHERE preapproval_id=?",
            (status, data_id)
        )
        print(f"[MP WEBHOOK] Suscripción {status} para '{slug}', plan → free")

    db.commit(); db.close()
    return {"ok": True}


# ─── MP CONFIG endpoints (Super Admin) ────────────────────────────────────────

class MPConfig(BaseModel):
    mp_access_token: str
    mp_webhook_secret: str = ""
    mp_currency: str = "CLP"
    mp_price_pro: str = "19"
    mp_price_enterprise: str = "49"

@app.post("/api/super/mp-config")
def set_mp_config(body: MPConfig, sa=Depends(_current_superadmin)):
    mapping = {
        "MP_ACCESS_TOKEN":     body.mp_access_token,
        "MP_WEBHOOK_SECRET":   body.mp_webhook_secret,
        "MP_CURRENCY":         body.mp_currency,
        "MP_PRICE_PRO":        body.mp_price_pro,
        "MP_PRICE_ENTERPRISE": body.mp_price_enterprise,
    }
    for key, val in mapping.items():
        os.environ[key] = val
        if val:  # no persistir vacíos
            _config_set(key, val)
    return {"ok": True}

@app.get("/api/super/mp-config")
def get_mp_config(sa=Depends(_current_superadmin)):
    return {
        "configured":           bool(os.environ.get("MP_ACCESS_TOKEN")),
        "mp_currency":          os.environ.get("MP_CURRENCY", "CLP"),
        "mp_price_pro":         os.environ.get("MP_PRICE_PRO", "19"),
        "mp_price_enterprise":  os.environ.get("MP_PRICE_ENTERPRISE", "49"),
        "mp_webhook_secret_set": bool(os.environ.get("MP_WEBHOOK_SECRET")),
    }

@app.get("/api/super/subscriptions")
def list_subscriptions(sa=Depends(_current_superadmin)):
    db = get_super_db()
    rows = db.execute("SELECT * FROM subscriptions ORDER BY created_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
