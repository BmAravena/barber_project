'use client';
import { useState, useEffect } from 'react';
import {
  apiSuperLogin, apiSuperListTenants, apiSuperCreateTenant,
  apiSuperUpdateTenant, apiSuperDeleteTenant, apiSuperTenantStats,
  apiSuperGetEmailConfig, apiSuperSetEmailConfig, apiSuperTestEmail, apiSuperSchedulerJobs,
} from '@/lib/api';
import type { Tenant } from '@/types';
import { Scissors, Plus, Trash2, X, CheckCircle, XCircle, Shield, ExternalLink, Mail, Bell, Layers, Eye, EyeOff, KeyRound } from 'lucide-react';
import Link from 'next/link';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function fmtDate(d: string) { return new Date(d).toLocaleDateString('es-CL'); }
function fmtDateTime(d: string) { return new Date(d).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
const slugify = (v: string) => v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export default function AdminPage() {
  const [logged, setLogged]     = useState(false);
  const [mustChangePw, setMustChangePw] = useState(false);
  const [changePwForm, setChangePwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [changePwErr, setChangePwErr]   = useState('');
  const [changePwOk, setChangePwOk]     = useState(false);
  const [tab, setTab]           = useState<'tenants' | 'email' | 'scheduler'>('tenants');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');

  // Tenants
  const [tenants, setTenants]   = useState<Tenant[]>([]);
  const [stats, setStats]       = useState<Record<string, { barbers: number; appointments: number; portfolio: number; pending_reminders?: number }>>({});
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState(false);
  const [newForm, setNewForm]   = useState({ slug:'', name:'', owner_name:'', owner_email:'', phone:'', address:'', city:'', plan:'free' });
  const [msg, setMsg]           = useState('');

  // Email config
  const [emailForm, setEmailForm]   = useState({ gmail_user: '', gmail_app_password: '' });
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [showPw, setShowPw]         = useState(false);
  const [testTo, setTestTo]         = useState('');
  const [emailMsg, setEmailMsg]     = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  // Scheduler
  const [jobs, setJobs] = useState<{ id: string; next_run: string | null }[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('homie_super_token');
    if (t) { setLogged(true); loadAll(); }
  }, []);

  const login = async () => {
    try {
      const data = await apiSuperLogin(loginForm);
      localStorage.setItem('homie_super_token', data.token);
      if (data.must_change_password) {
        setMustChangePw(true);
        setChangePwForm(f => ({ ...f, current_password: loginForm.password }));
      }
      setLogged(true); loadAll();
    } catch (e: unknown) { setLoginErr(e instanceof Error ? e.message : 'Error'); }
  };

  const handleChangePassword = async () => {
    if (!changePwForm.new_password || !changePwForm.confirm) { setChangePwErr('Completa todos los campos'); return; }
    if (changePwForm.new_password !== changePwForm.confirm) { setChangePwErr('Las contraseñas no coinciden'); return; }
    if (changePwForm.new_password.length < 12) { setChangePwErr('Mínimo 12 caracteres'); return; }
    setChangePwErr('');
    try {
      const token = localStorage.getItem('homie_super_token');
      const res = await fetch(`${BASE}/api/super/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ current_password: changePwForm.current_password, new_password: changePwForm.new_password }),
      });
      if (!res.ok) { const d = await res.json(); setChangePwErr(d.detail || 'Error'); return; }
      setChangePwOk(true);
      setMustChangePw(false);
    } catch { setChangePwErr('Error al cambiar contraseña'); }
  };

  const loadAll = () => { loadTenants(); loadEmailConfig(); };

  const loadTenants = async () => {
    setLoading(true);
    try {
      const data = await apiSuperListTenants();
      setTenants(data);
      const m: typeof stats = {};
      await Promise.all(data.map(async (t: Tenant) => {
        try { m[t.slug] = await apiSuperTenantStats(t.slug); } catch {}
      }));
      setStats(m);
    } finally { setLoading(false); }
  };

  const loadEmailConfig = async () => {
    try {
      const d = await apiSuperGetEmailConfig();
      setEmailConfigured(d.configured);
      if (d.gmail_user) setEmailForm(f => ({ ...f, gmail_user: d.gmail_user }));
    } catch {}
  };

  const loadJobs = async () => {
    setJobsLoading(true);
    try { setJobs(await apiSuperSchedulerJobs()); } finally { setJobsLoading(false); }
  };

  useEffect(() => { if (tab === 'scheduler' && logged) loadJobs(); }, [tab, logged]);

  const createTenant = async () => {
    try {
      await apiSuperCreateTenant(newForm);
      flash('Barbería creada ✓'); setModal(false);
      setNewForm({ slug:'', name:'', owner_name:'', owner_email:'', phone:'', address:'', city:'', plan:'free' });
      loadTenants();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Error'); }
  };

  const toggleActive = async (t: Tenant) => {
    await apiSuperUpdateTenant(t.slug, { active: t.active ? 0 : 1 });
    loadTenants();
  };

  const deleteTenant = async (slug: string) => {
    if (!confirm(`¿Eliminar "${slug}" y TODOS sus datos? Irreversible.`)) return;
    await apiSuperDeleteTenant(slug); loadTenants();
  };

  const saveEmailConfig = async () => {
    if (!emailForm.gmail_user || !emailForm.gmail_app_password) { setEmailMsg('Completa ambos campos'); return; }
    setEmailSaving(true);
    try {
      await apiSuperSetEmailConfig(emailForm);
      setEmailConfigured(true); setEmailMsg('✓ Configuración guardada');
    } catch (e: unknown) { setEmailMsg(e instanceof Error ? e.message : 'Error'); }
    finally { setEmailSaving(false); setTimeout(() => setEmailMsg(''), 3000); }
  };

  const sendTestEmail = async () => {
    if (!testTo) { setEmailMsg('Ingresa un email destino'); return; }
    try {
      const r = await apiSuperTestEmail(testTo);
      setEmailMsg(r.ok ? `✓ Email de prueba enviado a ${testTo}` : '✗ Error al enviar — revisa las credenciales');
    } catch (e: unknown) { setEmailMsg(e instanceof Error ? e.message : 'Error'); }
    setTimeout(() => setEmailMsg(''), 5000);
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (!logged) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-5">
            <Shield size={28} className="text-gold"/>
          </div>
          <h1 className="font-display text-5xl text-cream">SUPER ADMIN</h1>
          <p className="font-mono text-[11px] text-ink-700 tracking-[.3em] mt-2 uppercase">Acceso restringido</p>
        </div>
        <div className="card p-8 space-y-5">
          <div>
            <label className="label">Usuario</label>
            <input className="input-field" value={loginForm.username} placeholder="admin"
              onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && login()}/>
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input-field" type="password" value={loginForm.password} placeholder="••••••••"
              onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && login()}/>
          </div>
          {loginErr && <p className="font-mono text-[11px] text-rap-red tracking-widest bg-rap-red/10 border border-rap-red/30 px-4 py-3">{loginErr}</p>}
          <button onClick={login} className="btn-gold w-full text-xl py-4">ENTRAR →</button>
        </div>
        <div className="text-center mt-6">
          <Link href="/" className="font-mono text-[11px] text-ink-700 hover:text-gold tracking-widest">← Volver al inicio</Link>
        </div>
      </div>
    </div>
  );

  // ── CHANGE PASSWORD MODAL ─────────────────────────────────────────────────
  if (mustChangePw) return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ink">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-5">
            <KeyRound size={28} className="text-gold"/>
          </div>
          <h1 className="font-display text-4xl text-cream">CAMBIA TU CONTRASEÑA</h1>
          <p className="font-mono text-[11px] text-gold tracking-[.3em] mt-2 uppercase">Requerido en el primer inicio de sesión</p>
        </div>
        <div className="card p-8 space-y-5">
          <div>
            <label className="label">Contraseña actual</label>
            <input className="input-field" type="password" value={changePwForm.current_password}
              onChange={e => setChangePwForm({...changePwForm, current_password: e.target.value})}/>
          </div>
          <div>
            <label className="label">Nueva contraseña (mínimo 12 caracteres)</label>
            <input className="input-field" type="password" placeholder="••••••••••••"
              value={changePwForm.new_password}
              onChange={e => setChangePwForm({...changePwForm, new_password: e.target.value})}/>
          </div>
          <div>
            <label className="label">Confirmar nueva contraseña</label>
            <input className="input-field" type="password" placeholder="••••••••••••"
              value={changePwForm.confirm}
              onChange={e => setChangePwForm({...changePwForm, confirm: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}/>
          </div>
          {changePwErr && <p className="font-mono text-[11px] text-rap-red tracking-widest bg-rap-red/10 border border-rap-red/30 px-4 py-3">{changePwErr}</p>}
          <button onClick={handleChangePassword} className="btn-gold w-full text-xl py-4">
            GUARDAR CONTRASEÑA →
          </button>
          <button onClick={() => setMustChangePw(false)} className="btn-ghost w-full text-center">
            Cambiar después
          </button>
        </div>
      </div>
    </div>
  );

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-8">
      {/* Cambio de contraseña exitoso */}
      {changePwOk && (
        <div className="flex items-center gap-3 bg-rap-green/10 border border-rap-green/30 px-5 py-3 mb-6">
          <CheckCircle size={15} className="text-rap-green flex-shrink-0"/>
          <p className="font-mono text-[11px] text-rap-green tracking-widest">Contraseña actualizada correctamente.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Shield size={14} className="text-gold"/>
            </div>
            <span className="font-mono text-[11px] text-gold tracking-[.4em] uppercase">Panel global</span>
          </div>
          <h1 className="font-display text-6xl text-cream">SUPER ADMIN</h1>
          <div className="h-px w-24 bg-gold mt-3"/>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'tenants' && (
            <button onClick={() => setModal(true)} className="btn-gold flex items-center gap-2">
              <Plus size={16}/> Nueva barbería
            </button>
          )}
          <button onClick={() => setMustChangePw(true)}
            className="flex items-center gap-2 font-mono text-[11px] text-ink-600 hover:text-gold tracking-widest uppercase transition-colors border border-ink-500 hover:border-gold/40 px-3 py-2">
            <KeyRound size={13}/> Contraseña
          </button>
          <button onClick={() => { localStorage.removeItem('homie_super_token'); setLogged(false); }} className="btn-ghost">
            Salir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-ink-400 mb-8">
        {([
          { key: 'tenants',   label: 'Barberías',    icon: <Layers size={15}/> },
          { key: 'email',     label: 'Email / Gmail', icon: <Mail size={15}/> },
          { key: 'scheduler', label: 'Recordatorios', icon: <Bell size={15}/> },
        ] as const).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-6 py-3 font-display text-lg tracking-wider border-b-2 transition-all duration-150
              ${tab === key ? 'border-gold text-gold' : 'border-transparent text-ink-600 hover:text-cream'}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {msg && <div className={`font-mono text-xs tracking-widest mb-6 px-4 py-3 border ${msg.includes('✓') ? 'text-rap-green bg-rap-green/10 border-rap-green/30' : 'text-rap-red bg-rap-red/10 border-rap-red/30'}`}>{msg}</div>}

      {/* ── TAB: TENANTS ── */}
      {tab === 'tenants' && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 stagger">
            {[
              { label: 'Barberías', val: tenants.length, color: 'text-cream' },
              { label: 'Activas', val: tenants.filter(t => t.active).length, color: 'text-rap-green' },
              { label: 'Plan Pro', val: tenants.filter(t => t.plan === 'pro').length, color: 'text-gold' },
              { label: 'Barberos totales', val: Object.values(stats).reduce((s, v) => s + v.barbers, 0), color: 'text-cream' },
            ].map(({ label, val, color }) => (
              <div key={label} className="card p-5 text-center">
                <div className={`font-display text-4xl ${color}`}>{val}</div>
                <div className="font-mono text-[9px] text-ink-600 tracking-[.25em] uppercase mt-1">{label}</div>
              </div>
            ))}
          </div>

          <h2 className="font-display text-3xl text-gold tracking-wider mb-4">BARBERÍAS REGISTRADAS</h2>
          <div className="gold-line mb-6"/>

          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse"/>)}</div>
          ) : tenants.length === 0 ? (
            <div className="card p-16 text-center">
              <Scissors size={36} className="text-ink-500 mx-auto mb-4 rotate-180"/>
              <p className="font-display text-3xl text-ink-600 tracking-widest">SIN BARBERÍAS</p>
            </div>
          ) : (
            <div className="space-y-3 stagger">
              {tenants.map(t => {
                const s = stats[t.slug] || { barbers: 0, appointments: 0, portfolio: 0, pending_reminders: 0 };
                return (
                  <div key={t.id} className={`card p-5 hover:border-gold/30 transition-colors ${!t.active ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 flex-shrink-0">
                          {t.active ? <CheckCircle size={16} className="text-rap-green"/> : <XCircle size={16} className="text-ink-600"/>}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-display text-2xl text-cream tracking-wide">{t.name}</span>
                            <span className={`badge badge-${t.plan}`}>{t.plan.toUpperCase()}</span>
                            {!t.active && <span className="badge badge-cancelled">INACTIVA</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            <span className="font-mono text-[11px] text-gold tracking-widest">/{t.slug}</span>
                            <span className="font-mono text-[11px] text-ink-700 tracking-widest">{t.owner_name}</span>
                            <span className="font-mono text-[11px] text-ink-700 tracking-widest">{t.owner_email}</span>
                            {t.city && <span className="font-mono text-[11px] text-ink-700 tracking-widest">📍 {t.city}</span>}
                            <span className="font-mono text-[11px] text-ink-600 tracking-widest">Desde {fmtDate(t.created_at)}</span>
                          </div>
                          <div className="flex gap-4 mt-1.5 flex-wrap">
                            <span className="font-mono text-[10px] text-ink-600 tracking-widest">✂ {s.barbers} barberos</span>
                            <span className="font-mono text-[10px] text-ink-600 tracking-widest">📅 {s.appointments} citas</span>
                            <span className="font-mono text-[10px] text-ink-600 tracking-widest">📸 {s.portfolio} fotos</span>
                            {(s.pending_reminders ?? 0) > 0 && (
                              <span className="font-mono text-[10px] text-gold tracking-widest">⏰ {s.pending_reminders} recordatorios pendientes</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <select value={t.plan}
                          onChange={async e => { await apiSuperUpdateTenant(t.slug, { plan: e.target.value }); loadTenants(); }}
                          className="appearance-none bg-ink-300 border border-ink-500 text-cream font-mono text-[11px] tracking-widest uppercase px-3 py-2 outline-none focus:border-gold cursor-pointer hover:border-gold/60 transition-colors">
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                        <Link href={`/${t.slug}`} target="_blank"
                          className="w-9 h-9 border border-ink-500 flex items-center justify-center text-ink-600 hover:border-gold hover:text-gold transition-all">
                          <ExternalLink size={14}/>
                        </Link>
                        <button onClick={() => toggleActive(t)}
                          className={`w-9 h-9 border flex items-center justify-center transition-all
                            ${t.active ? 'border-ink-500 text-ink-600 hover:border-yellow-500 hover:text-yellow-400' : 'border-rap-green/40 text-rap-green hover:border-rap-green'}`}>
                          {t.active ? <XCircle size={14}/> : <CheckCircle size={14}/>}
                        </button>
                        <button onClick={() => deleteTenant(t.slug)}
                          className="w-9 h-9 border border-ink-500 flex items-center justify-center text-ink-600 hover:border-rap-red hover:text-rap-red transition-all">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: EMAIL CONFIG ── */}
      {tab === 'email' && (
        <div className="max-w-2xl space-y-8">
          {/* Status banner */}
          <div className={`flex items-center gap-3 px-5 py-4 border ${emailConfigured ? 'bg-rap-green/10 border-rap-green/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
            {emailConfigured
              ? <><CheckCircle size={18} className="text-rap-green flex-shrink-0"/><span className="font-mono text-sm text-rap-green tracking-widest">GMAIL CONFIGURADO — los emails se enviarán automáticamente</span></>
              : <><Mail size={18} className="text-yellow-400 flex-shrink-0"/><span className="font-mono text-sm text-yellow-400 tracking-widest">SIN CONFIGURAR — los emails no se enviarán hasta configurar</span></>
            }
          </div>

          {/* Step 1: Credentials */}
          <div className="card p-7">
            <h3 className="font-display text-2xl text-gold tracking-wider mb-2">PASO 1 — CUENTA GMAIL</h3>
            <p className="font-mono text-[11px] text-ink-600 tracking-widest mb-6 leading-relaxed">
              Necesitas una contraseña de aplicación de Gmail (no tu contraseña normal).<br/>
              Ir a: myaccount.google.com → Seguridad → Verificación en 2 pasos → Contraseñas de aplicación
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Gmail (cuenta que enviará los emails)</label>
                <input className="input-field" type="email" placeholder="tu_cuenta@gmail.com"
                  value={emailForm.gmail_user}
                  onChange={e => setEmailForm({...emailForm, gmail_user: e.target.value})}/>
              </div>
              <div>
                <label className="label">Contraseña de aplicación</label>
                <div className="relative">
                  <input className="input-field pr-12"
                    type={showPw ? 'text' : 'password'}
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={emailForm.gmail_app_password}
                    onChange={e => setEmailForm({...emailForm, gmail_app_password: e.target.value})}/>
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-600 hover:text-gold transition-colors">
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>
              <button onClick={saveEmailConfig} disabled={emailSaving} className="btn-gold flex items-center gap-2">
                <Mail size={16}/>{emailSaving ? 'Guardando...' : 'GUARDAR CONFIGURACIÓN'}
              </button>
            </div>
          </div>

          {/* Step 2: Test */}
          <div className="card p-7">
            <h3 className="font-display text-2xl text-gold tracking-wider mb-2">PASO 2 — PROBAR EMAIL</h3>
            <p className="font-mono text-[11px] text-ink-600 tracking-widest mb-5">
              Envía un email de prueba para verificar que todo funciona correctamente.
            </p>
            <div className="flex gap-3">
              <input className="input-field flex-1" type="email" placeholder="destino@email.com"
                value={testTo} onChange={e => setTestTo(e.target.value)}/>
              <button onClick={sendTestEmail} disabled={!emailConfigured}
                className={emailConfigured ? 'btn-gold flex items-center gap-2' : 'btn-outline opacity-50 flex items-center gap-2'}>
                <Mail size={16}/> Probar
              </button>
            </div>
            {!emailConfigured && <p className="font-mono text-[10px] text-ink-600 tracking-widest mt-2">Configura las credenciales primero</p>}
          </div>

          {emailMsg && (
            <div className={`font-mono text-xs tracking-widest px-4 py-3 border ${emailMsg.includes('✓') ? 'text-rap-green bg-rap-green/10 border-rap-green/30' : 'text-rap-red bg-rap-red/10 border-rap-red/30'}`}>
              {emailMsg}
            </div>
          )}

          {/* How it works */}
          <div className="card p-7">
            <h3 className="font-display text-xl text-gold tracking-wider mb-4">CÓMO FUNCIONA</h3>
            <div className="space-y-3">
              {[
                { icon: '📧', label: 'Confirmación inmediata', desc: 'Se envía al cliente al reservar, si ingresó su email.' },
                { icon: '⏰', label: 'Recordatorio 24h antes', desc: 'Se programa automáticamente. Si la cita se cancela, el recordatorio se cancela también.' },
                { icon: '✉', label: 'Invitaciones de barberos', desc: 'Al generar un invite token con email, se envía automáticamente.' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
                  <div>
                    <div className="font-display text-base text-cream tracking-wide">{label}</div>
                    <div className="font-mono text-[11px] text-ink-700 tracking-wider mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SCHEDULER ── */}
      {tab === 'scheduler' && (
        <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-3xl text-gold tracking-wider">RECORDATORIOS PROGRAMADOS</h2>
            <button onClick={loadJobs} className="btn-ghost flex items-center gap-2">↻ Actualizar</button>
          </div>
          <div className="gold-line mb-6"/>

          <p className="font-mono text-[11px] text-ink-600 tracking-widest mb-6">
            Cada fila es un recordatorio programado para enviarse 24h antes de una cita.
            Se cancela automáticamente si la cita es cancelada.
          </p>

          {jobsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-14 animate-pulse"/>)}</div>
          ) : jobs.length === 0 ? (
            <div className="card p-14 text-center">
              <Bell size={32} className="text-ink-500 mx-auto mb-4"/>
              <p className="font-display text-3xl text-ink-600 tracking-widest">SIN JOBS ACTIVOS</p>
              <p className="font-mono text-sm text-ink-600 mt-2 tracking-widest">Los recordatorios aparecen aquí cuando hay citas futuras con email</p>
            </div>
          ) : (
            <div className="space-y-2 stagger">
              {jobs.map(job => (
                <div key={job.id} className="card p-4 hover:border-gold/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm text-gold tracking-widest">{job.id}</div>
                      <div className="font-mono text-[11px] text-ink-700 tracking-widest mt-1">
                        {job.next_run ? `⏰ Dispara: ${fmtDateTime(job.next_run)}` : 'Sin fecha programada'}
                      </div>
                    </div>
                    <span className="badge badge-confirmed">ACTIVO</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 card p-5">
            <div className="font-display text-lg text-gold mb-3 tracking-wider">TOTAL</div>
            <div className="font-display text-5xl text-cream">{jobs.length}</div>
            <div className="font-mono text-[10px] text-ink-600 tracking-widest mt-1 uppercase">Jobs activos en memoria</div>
          </div>
        </div>
      )}

      {/* Create Tenant Modal */}
      {modal && (
        <div className="fixed inset-0 bg-ink/90 z-50 flex items-center justify-center p-4">
          <div className="bg-ink-100 border border-ink-400 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-8 py-6 border-b border-ink-400">
              <h2 className="font-display text-3xl text-gold tracking-wider">NUEVA BARBERÍA</h2>
              <button onClick={() => setModal(false)} className="text-ink-700 hover:text-cream"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nombre de la barbería *</label>
                  <input className="input-field" placeholder="Homie Barber Shop"
                    value={newForm.name}
                    onChange={e => setNewForm({...newForm, name: e.target.value, slug: slugify(e.target.value)})}/>
                </div>
                <div className="col-span-2">
                  <label className="label">Slug (URL) *</label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-ink-600 text-sm flex-shrink-0">homie.app/</span>
                    <input className="input-field flex-1" placeholder="mi-barberia"
                      value={newForm.slug}
                      onChange={e => setNewForm({...newForm, slug: slugify(e.target.value)})}/>
                  </div>
                </div>
                <div>
                  <label className="label">Nombre del dueño *</label>
                  <input className="input-field" placeholder="Nombre completo"
                    value={newForm.owner_name} onChange={e => setNewForm({...newForm, owner_name: e.target.value})}/>
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input className="input-field" type="email" placeholder="owner@email.com"
                    value={newForm.owner_email} onChange={e => setNewForm({...newForm, owner_email: e.target.value})}/>
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input-field" placeholder="9 XXXX XXXX"
                    value={newForm.phone} onChange={e => setNewForm({...newForm, phone: e.target.value})}/>
                </div>
                <div>
                  <label className="label">Ciudad</label>
                  <input className="input-field" placeholder="Temuco"
                    value={newForm.city} onChange={e => setNewForm({...newForm, city: e.target.value})}/>
                </div>
                <div className="col-span-2">
                  <label className="label">Dirección</label>
                  <input className="input-field" placeholder="Calle y número"
                    value={newForm.address} onChange={e => setNewForm({...newForm, address: e.target.value})}/>
                </div>
                <div>
                  <label className="label">Plan</label>
                  <select className="input-field" value={newForm.plan} onChange={e => setNewForm({...newForm, plan: e.target.value})}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={createTenant} className="btn-gold flex-1 text-xl py-4">CREAR BARBERÍA →</button>
                <button onClick={() => setModal(false)} className="btn-ghost px-6">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
