# ✂ HOMIE SAAS v3 — Multi-Tenant Barber Platform
### Next.js 14 · Tailwind CSS · FastAPI · APScheduler · Gmail SMTP

---

## 🆕 Novedades v3

| Feature | Descripción |
|---|---|
| **Invite tokens** | El registro de barberos requiere enlace de invitación — nadie puede registrarse sin él |
| **Email de confirmación** | Se envía al cliente inmediatamente al reservar (si ingresó email) |
| **Recordatorio automático** | Email 24h antes de la cita, programado con APScheduler |
| **Email de invitación** | Al generar un invite token con email, se envía el enlace automáticamente |
| **Panel Email en Super Admin** | Configura Gmail, prueba envío, ve jobs activos del scheduler |

---

## 🚀 Instalación

### 1. Backend

```bash
cd homie_mt/backend
pip install -r requirements.txt

# Configurar Gmail (opcional pero necesario para emails)
cp .env.example .env
# Editar .env con tu cuenta Gmail y contraseña de aplicación

# Iniciar el servidor
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd homie_mt/frontend
npm install
npm run dev
```

---

## 📧 Configurar Gmail para emails automáticos

### Opción A — Variables de entorno (recomendado para producción)
```bash
export GMAIL_USER="tu_cuenta@gmail.com"
export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
```

### Opción B — Panel Super Admin (más fácil para pruebas)
1. Ir a `localhost:3000/admin`
2. Login: `admin` / `homie2024`
3. Tab **Email / Gmail** → ingresar cuenta y contraseña de aplicación → Guardar
4. Usar **Probar** para enviar un email de prueba

### Cómo obtener la contraseña de aplicación
1. Ir a [myaccount.google.com/security](https://myaccount.google.com/security)
2. Activar **Verificación en 2 pasos**
3. Buscar **Contraseñas de aplicación**
4. Crear una para "Correo" / "Otro"
5. Copiar las 16 letras (sin espacios)

---

## 🔑 Flujo de invite tokens

```
Barbero dueño (en dashboard)
  → Invitaciones → Generar enlace
  → [Opcional] ingresa email → se envía automáticamente
  → Comparte enlace: /homie-temuco/auth/register?invite=abc123
  
Nuevo barbero
  → Abre enlace → sistema valida token
  → Token válido → formulario de registro
  → Token inválido/expirado → pantalla de error
  → Se registra → token se invalida (uso único, 48h de vigencia)
```

---

## ⏰ Flujo de recordatorios

```
Cliente reserva cita (con email ingresado)
  → Email de confirmación enviado INMEDIATAMENTE
  → Job programado en APScheduler para 24h antes de la cita

24h antes de la cita
  → APScheduler dispara el job
  → Verifica que la cita no fue cancelada
  → Envía email de recordatorio con hora destacada
  → Marca reminder_sent=1 en la BD

Si la cita se cancela
  → Job eliminado del scheduler automáticamente
```

---

## 🗺 URLs

| URL | Descripción |
|---|---|
| `localhost:3000` | Landing SaaS |
| `localhost:3000/onboarding` | Registro self-service de barbería |
| `localhost:3000/admin` | Super Admin (`admin` / `homie2024`) |
| `localhost:3000/:slug` | Página pública de la barbería |
| `localhost:3000/:slug/book` | Reservar cita (4 pasos) |
| `localhost:3000/:slug/auth/login` | Login de barberos |
| `localhost:3000/:slug/auth/register?invite=TOKEN` | Registro con invitación |
| `localhost:3000/:slug/dashboard` | Dashboard del barbero |
| `localhost:3000/:slug/dashboard/invites` | Gestión de invitaciones |
| `localhost:8000/docs` | Swagger API |

---

## 🗂 Estructura del proyecto

```
homie_mt/
├── backend/
│   ├── main.py             ← FastAPI — todas las rutas
│   ├── email_service.py    ← Gmail SMTP + templates HTML
│   ├── scheduler.py        ← APScheduler — jobs de recordatorio
│   ├── requirements.txt
│   └── .env.example
└── frontend/src/app/
    ├── page.tsx                         ← Landing SaaS
    ├── onboarding/page.tsx              ← Registro barbería
    ├── admin/page.tsx                   ← Super Admin (3 tabs)
    └── [tenant]/
        ├── page.tsx                     ← Página pública
        ├── barbers/[id]/page.tsx        ← Perfil barbero
        ├── book/page.tsx                ← Reserva 4 pasos
        ├── auth/login/page.tsx
        ├── auth/register/page.tsx       ← Validación invite token
        └── dashboard/
            ├── page.tsx                 ← Resumen
            ├── appointments/page.tsx    ← Citas + cambiar estado
            ├── services/page.tsx        ← Servicios y precios
            ├── portfolio/page.tsx       ← Fotos de trabajos
            ├── invites/page.tsx         ← Generar invite links ← NUEVO
            └── profile/page.tsx         ← Editar perfil
```

---

## 🔐 Seguridad

- Registro de barberos **solo con invite token** (uso único, 48h de vigencia)
- JWT con **claim `tenant`** — un token de barbería A no funciona en barbería B
- **bcrypt** para contraseñas
- Barberías inactivas devuelven **403** en todas las rutas
- El primer barbero (dueño) se crea en el onboarding sin necesitar invitación

---

*Homie SaaS v3 · Multi-Tenant · Invite-Only · Email Reminders · 🎵 Hip Hop Culture*
