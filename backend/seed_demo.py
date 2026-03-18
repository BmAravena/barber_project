"""
seed_demo.py
============
Crea el tenant "demo-barber" con datos realistas precargados.
Ejecutar UNA vez antes de iniciar el servidor:

  python seed_demo.py

Puede re-ejecutarse sin problema — limpia y recrea los datos.
"""
import sqlite3, uuid, bcrypt, shutil
from pathlib import Path
from datetime import datetime, timedelta
import random

SUPER_DB = "super.db"
DB_DIR   = Path("tenants_db")
SLUG     = "demo-barber"
DB_PATH  = DB_DIR / f"{SLUG}.db"

DB_DIR.mkdir(exist_ok=True)

# ─────────────────────────────────────────────────────────────
# 1. Ensure tenant exists in super.db
# ─────────────────────────────────────────────────────────────
def get_super():
    c = sqlite3.connect(SUPER_DB, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

def hash_pw(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

super_db = get_super()
super_db.execute("""
    CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL, owner_email TEXT NOT NULL,
        owner_name TEXT NOT NULL, phone TEXT DEFAULT '',
        address TEXT DEFAULT '', city TEXT DEFAULT '',
        plan TEXT DEFAULT 'free', active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    )
""")
super_db.execute("""
    INSERT OR REPLACE INTO tenants
    (id, slug, name, owner_email, owner_name, phone, address, city, plan, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    str(uuid.uuid4()), SLUG,
    "Homie Demo Barbershop",
    "demo@homiesaas.com",
    "Demo Owner",
    "9 9999 9999",
    "Av. Providencia 1234",
    "Santiago",
    "pro", 1
))
super_db.commit()
super_db.close()
print(f"[SEED] Tenant '{SLUG}' registrado en super.db")

# ─────────────────────────────────────────────────────────────
# 2. Recreate tenant DB
# ─────────────────────────────────────────────────────────────
if DB_PATH.exists():
    DB_PATH.unlink()

db = sqlite3.connect(str(DB_PATH), check_same_thread=False)
db.row_factory = sqlite3.Row

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

# ─────────────────────────────────────────────────────────────
# 3. BARBERS
# ─────────────────────────────────────────────────────────────
barbers_data = [
    {
        "id": str(uuid.uuid4()),
        "username": "jaycut",
        "full_name": "Jay Rodríguez",
        "email": "jay@demo.com",
        "bio": "10 años en el juego. Especialista en fades y diseños geométricos. Mi tijera habla por mí.",
        "specialty": "Fades & Diseños",
        "instagram": "jaycut_oficial",
        "role": "owner",
    },
    {
        "id": str(uuid.uuid4()),
        "username": "kingkev",
        "full_name": "Kevin Morales",
        "email": "kev@demo.com",
        "bio": "Barbero desde los 18. Me especializo en cortes clásicos con toque moderno y arreglo de barba.",
        "specialty": "Clásicos & Barba",
        "instagram": "kingkev_barber",
        "role": "barber",
    },
]

for b in barbers_data:
    db.execute(
        "INSERT INTO barbers (id,username,full_name,email,password,bio,specialty,instagram,role) VALUES (?,?,?,?,?,?,?,?,?)",
        (b["id"], b["username"], b["full_name"], b["email"], hash_pw("demo1234"),
         b["bio"], b["specialty"], b["instagram"], b["role"])
    )
print(f"[SEED] {len(barbers_data)} barberos creados")

# ─────────────────────────────────────────────────────────────
# 4. SERVICES per barber
# ─────────────────────────────────────────────────────────────
services_map = {}  # barber_id -> list of service ids

jay_id = barbers_data[0]["id"]
kev_id = barbers_data[1]["id"]

jay_services = [
    ("Fade Clásico",       "Degradado limpio a máquina",               9000, 30),
    ("Fade + Diseño",      "Degradado con líneas y diseño custom",     14000, 50),
    ("Fade + Barba",       "Combo degradado más arreglo de barba",     17000, 60),
    ("Corte Texturizado",  "Corte moderno con textura y volumen",      11000, 40),
    ("Diseño Premium",     "Diseño artístico, consultar disponibilidad",20000, 75),
]

kev_services = [
    ("Corte Clásico",      "Tijera y máquina, acabado impecable",       8000, 30),
    ("Corte + Barba",      "Corte completo más perfilado de barba",    14000, 55),
    ("Barba Completa",     "Perfilado, arreglo y afeitado profesional",  6000, 25),
    ("Corte Infantil",     "Corte para niños hasta 12 años",            6000, 25),
    ("Afeitado Navaja",    "Afeitado clásico con navaja y toalla caliente",9000, 40),
]

for svc_list, barber_id in [(jay_services, jay_id), (kev_services, kev_id)]:
    services_map[barber_id] = []
    for name, desc, price, dur in svc_list:
        sid = str(uuid.uuid4())
        db.execute(
            "INSERT INTO services (id,barber_id,name,description,price,duration) VALUES (?,?,?,?,?,?)",
            (sid, barber_id, name, desc, price, dur)
        )
        services_map[barber_id].append(sid)

print(f"[SEED] Servicios creados para ambos barberos")

# ─────────────────────────────────────────────────────────────
# 5. PORTFOLIO — SVG placeholder images (base64)
# Each is a unique SVG with different colors representing a haircut photo
# ─────────────────────────────────────────────────────────────
import base64

def make_svg_placeholder(label: str, bg: str, accent: str, number: int) -> str:
    """Generate a stylized SVG placeholder that looks like a portfolio photo."""
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="{bg}"/>
  <rect x="0" y="340" width="400" height="60" fill="#000" opacity="0.6"/>
  <!-- Decorative scissors icon -->
  <g transform="translate(200,160) scale(3)" fill="{accent}" opacity="0.15">
    <path d="M7.5 5.6L10 7 8.6 4.5c.6-.3 1-.9 1-1.6C9.6 1.9 8.7 1 7.6 1S5.6 1.9 5.6 2.9c0 .7.4 1.3 1 1.6L5.1 7l2.4-1.4zM7.6 2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm0 0"/>
    <path d="M10 9L7.5 10.4l.1-.2 1.5-2.6C8.6 7.3 8.2 7 7.6 7S6.6 7.3 6 7.6L4.5 5.1C5.1 4.8 5.5 4.2 5.5 3.5 5.5 2.4 4.6 1.5 3.5 1.5S1.5 2.4 1.5 3.5 2.4 5.5 3.5 5.5c.3 0 .5-.1.7-.2L5.7 8 3.5 9.6c-.2-.1-.4-.1-.7-.1C1.8 9.5.9 10.4.9 11.5S1.8 13.5 2.9 13.5 5 12.6 5 11.5c0-.3-.1-.5-.2-.7l2.4-1.4L9.6 11c-.1.2-.2.4-.2.7 0 1.1.9 2 2 2s2-.9 2-2c-.1-1.1-1-2-2.4-2zM3.5 12.5c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z"/>
  </g>
  <!-- Main visual elements -->
  <circle cx="200" cy="160" r="80" fill="{accent}" opacity="0.08"/>
  <circle cx="200" cy="160" r="55" fill="{accent}" opacity="0.06"/>
  <!-- Chain link decorations -->
  <text x="200" y="120" text-anchor="middle" font-family="monospace" font-size="11" fill="{accent}" opacity="0.3" letter-spacing="8">⬡ ─ ⬡ ─ ⬡</text>
  <!-- Number badge -->
  <circle cx="200" cy="160" r="36" fill="none" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
  <text x="200" y="168" text-anchor="middle" font-family="Arial Black" font-size="32" font-weight="900" fill="{accent}" opacity="0.5">{number:02d}</text>
  <!-- Label -->
  <text x="200" y="362" text-anchor="middle" font-family="Arial Black" font-size="13" font-weight="900" fill="#FFD700" letter-spacing="2">{label.upper()}</text>
  <!-- Corner marks -->
  <line x1="20" y1="20" x2="50" y2="20" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
  <line x1="20" y1="20" x2="20" y2="50" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
  <line x1="380" y1="20" x2="350" y2="20" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
  <line x1="380" y1="20" x2="380" y2="50" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
  <line x1="20" y1="380" x2="50" y2="380" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
  <line x1="20" y1="380" x2="20" y2="350" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
  <line x1="380" y1="380" x2="350" y2="380" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
  <line x1="380" y1="380" x2="380" y2="350" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
</svg>"""
    return base64.b64encode(svg.encode()).decode()

jay_portfolio = [
    ("Fade Bajo",       "#111",    "#FFD700", 1, "Fade bajo con línea definida"),
    ("Fade Mid",        "#181818", "#C084FC", 2, "Mid fade con degradado suave"),
    ("Diseño tribal",   "#0A0A0A", "#F97316", 3, "Diseño tribal en la sien"),
    ("Fade + Barba",    "#141414", "#34D399", 4, "Combo fade y barba perfilada"),
    ("Full Look",       "#0D0D0D", "#60A5FA", 5, "Look completo con diseño"),
    ("Geometrico",      "#111",    "#F472B6", 6, "Diseño geométrico premium"),
]

kev_portfolio = [
    ("Clásico",         "#111",    "#FFD700", 1, "Corte clásico a tijera"),
    ("Texturizado",     "#181818", "#94A3B8", 2, "Texturizado moderno"),
    ("Barba Completa",  "#0A0A0A", "#FB923C", 3, "Barba perfilada con navaja"),
    ("Afeitado",        "#141414", "#A78BFA", 4, "Afeitado clásico con toalla"),
]

for items, barber_id in [(jay_portfolio, jay_id), (kev_portfolio, kev_id)]:
    for label, bg, accent, num, caption in items:
        b64 = make_svg_placeholder(label, bg, accent, num)
        db.execute(
            "INSERT INTO portfolio (id,barber_id,image,caption) VALUES (?,?,?,?)",
            (str(uuid.uuid4()), barber_id, b64, caption)
        )

print(f"[SEED] Portfolio creado ({len(jay_portfolio)} fotos Jay, {len(kev_portfolio)} fotos Kevin)")

# ─────────────────────────────────────────────────────────────
# 6. APPOINTMENTS — realistic mix of past and future
# ─────────────────────────────────────────────────────────────
client_names  = ["Diego Herrera", "Matías Vega", "Sebastián Castro", "Andrés Muñoz",
                 "Felipe Rojas", "Ignacio Torres", "Cristóbal Silva", "Pablo Núñez",
                 "Joaquín Pérez", "Tomás Vargas", "Lucas Martínez", "Gabriel Soto"]
client_phones = ["9 1234 5678", "9 2345 6789", "9 3456 7890", "9 4567 8901",
                 "9 5678 9012", "9 6789 0123", "9 7890 1234", "9 8901 2345"]
statuses_past   = ["completed", "completed", "completed", "confirmed", "cancelled"]
statuses_future = ["confirmed", "confirmed", "pending", "pending"]
times = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"]

today = datetime.now()
appt_count = 0

for barber_id in [jay_id, kev_id]:
    svcs = services_map[barber_id]
    # Past appointments (last 30 days)
    for i in range(12):
        days_back = random.randint(1, 30)
        appt_date = (today - timedelta(days=days_back)).strftime("%Y-%m-%d")
        appt_time = random.choice(times)
        client    = random.choice(client_names)
        status    = random.choice(statuses_past)
        db.execute(
            "INSERT INTO appointments (id,barber_id,client_name,client_phone,service_id,date,time,status,reminder_sent) VALUES (?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), barber_id, client, random.choice(client_phones),
             random.choice(svcs), appt_date, appt_time, status, 1)
        )
        appt_count += 1
    # Future appointments (next 14 days)
    used_slots: set[tuple] = set()
    for i in range(8):
        for attempt in range(20):
            days_fwd  = random.randint(1, 14)
            appt_date = (today + timedelta(days=days_fwd)).strftime("%Y-%m-%d")
            appt_time = random.choice(times)
            if (appt_date, appt_time) not in used_slots:
                used_slots.add((appt_date, appt_time))
                client = random.choice(client_names)
                status = random.choice(statuses_future)
                db.execute(
                    "INSERT INTO appointments (id,barber_id,client_name,client_phone,client_email,service_id,date,time,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), barber_id, client, random.choice(client_phones),
                     f"{client.lower().replace(' ','.')}@email.com",
                     random.choice(svcs), appt_date, appt_time, status,
                     random.choice(["", "", "", "Preferencia de máquina corta", "Quiero diseño en la sien"]))
                )
                appt_count += 1
                break

print(f"[SEED] {appt_count} citas creadas (pasadas + futuras)")

# ─────────────────────────────────────────────────────────────
# 7. Commit & done
# ─────────────────────────────────────────────────────────────
db.commit()
db.close()

print(f"""
╔══════════════════════════════════════════════╗
║         DEMO SEED COMPLETADO ✓               ║
╠══════════════════════════════════════════════╣
║  Tenant:    demo-barber                      ║
║  URL:       localhost:3000/demo-barber        ║
║  Barberos:  Jay Rodríguez + Kevin Morales    ║
║  Servicios: 5 + 5                            ║
║  Portfolio: 6 + 4 fotos                      ║
║  Citas:     {appt_count} (pasadas + futuras)             ║
╚══════════════════════════════════════════════╝
""")
