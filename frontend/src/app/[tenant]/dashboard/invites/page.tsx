'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getToken, apiGetMe } from '@/lib/api';
import { Link2, Plus, Trash2, Copy, Check, Mail, Clock, ShieldOff } from 'lucide-react';

interface Invite {
  id: string; token: string; invite_url?: string;
  email: string; used: number; expired: boolean;
  expires_at: string; created_at: string;
}

const BASE = 'http://localhost:8000';

export default function InvitesPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [role, setRole]       = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail]     = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg]         = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken(tenant)}`,
    'X-Tenant': tenant,
  });

  // Load current barber role first
  useEffect(() => {
    if (!tenant) return;
    apiGetMe(tenant)
      .then(b => {
        setRole(b.role);
        if (b.role === 'owner') loadInvites();
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant]);

  const loadInvites = async () => {
    setLoading(true);
    const r = await fetch(`${BASE}/api/invites?tenant_slug=${tenant}`, { headers: headers() });
    if (r.ok) setInvites(await r.json());
    setLoading(false);
  };

  const create = async () => {
    setCreating(true); setMsg('');
    try {
      const r = await fetch(`${BASE}/api/invites?tenant_slug=${tenant}`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error');
      setMsg(data.email_sent ? `✓ Invitación enviada a ${email}` : '✓ Enlace creado');
      setEmail('');
      loadInvites();
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Error'); }
    finally { setCreating(false); setTimeout(() => setMsg(''), 4000); }
  };

  const del = async (id: string) => {
    await fetch(`${BASE}/api/invites/${id}?tenant_slug=${tenant}`, { method: 'DELETE', headers: headers() });
    setInvites(prev => prev.filter(i => i.id !== id));
  };

  const copy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  // ── Access denied for non-owners ──────────────────────────
  if (!loading && role !== 'owner') {
    return (
      <div className="p-8 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-ink-200 border border-ink-400 flex items-center justify-center mx-auto mb-8">
          <ShieldOff size={36} className="text-ink-600" />
        </div>
        <h1 className="font-display text-5xl text-ink-600 tracking-wider mb-4">ACCESO RESTRINGIDO</h1>
        <p className="font-mono text-sm text-ink-600 tracking-widest max-w-sm">
          Solo el dueño de la barbería puede gestionar las invitaciones.
          Contacta a tu dueño si necesitas invitar a alguien.
        </p>
      </div>
    );
  }

  const active  = invites.filter(i => !i.used && !i.expired);
  const used    = invites.filter(i => i.used);
  const expired = invites.filter(i => !i.used && i.expired);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="mb-8">
        <p className="font-mono text-[11px] text-gold tracking-[.4em] uppercase mb-2">Solo dueño</p>
        <h1 className="font-display text-4xl md:text-6xl text-cream">INVITACIONES</h1>
        <div className="h-px w-24 bg-gold mt-3" />
        <p className="font-mono text-[11px] text-ink-700 tracking-widest mt-3 max-w-xl">
          Solo tú, como dueño, puedes generar estos enlaces. Compártelos por WhatsApp o email — 
          expiran en 48h y son de un solo uso.
        </p>
      </div>

      {/* Create */}
      <div className="card p-6 mb-8 border-gold/30">
        <h3 className="font-display text-2xl text-gold mb-5 tracking-wider">INVITAR BARBERO</h3>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-56">
            <label className="label flex items-center gap-2"><Mail size={11}/> Email del barbero (opcional)</label>
            <input className="input-field"
              placeholder="barbero@email.com — se envía el enlace automáticamente"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()} />
          </div>
          <button onClick={create} disabled={creating} className="btn-gold flex items-center gap-2 py-3">
            <Plus size={16}/>{creating ? 'Generando...' : 'Generar enlace'}
          </button>
        </div>
        {msg && (
          <p className={`font-mono text-xs tracking-widest mt-4 px-4 py-3 border
            ${msg.startsWith('✓')
              ? 'text-rap-green bg-rap-green/10 border-rap-green/30'
              : 'text-rap-red bg-rap-red/10 border-rap-red/30'}`}>
            {msg}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Activos',  val: active.length,  color: 'text-rap-green' },
          { label: 'Usados',   val: used.length,    color: 'text-ink-700'   },
          { label: 'Expirados',val: expired.length, color: 'text-rap-red'   },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`font-display text-3xl ${s.color}`}>{s.val}</div>
            <div className="font-mono text-[9px] text-ink-600 tracking-[.25em] uppercase mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse"/>)}</div>
      ) : invites.length === 0 ? (
        <div className="card p-14 text-center">
          <Link2 size={32} className="text-ink-500 mx-auto mb-4"/>
          <p className="font-display text-3xl text-ink-600 tracking-widest">SIN INVITACIONES AÚN</p>
          <p className="font-mono text-sm text-ink-600 mt-2">Genera el primer enlace arriba</p>
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {invites.map(inv => {
            const url = inv.invite_url
              || `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/${tenant}/auth/register?invite=${inv.token}`;
            return (
              <div key={inv.id}
                className={`card p-5 transition-colors
                  ${inv.used ? 'opacity-50' : inv.expired ? 'opacity-40' : 'hover:border-gold/30'}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0
                      ${inv.used ? 'bg-ink-600' : inv.expired ? 'bg-rap-red/60' : 'bg-rap-green'}`}/>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm text-gold tracking-wider truncate max-w-xs">{url}</span>
                        {inv.used     && <span className="badge badge-completed">USADO</span>}
                        {!inv.used && inv.expired  && <span className="badge badge-cancelled">EXPIRADO</span>}
                        {!inv.used && !inv.expired && <span className="badge badge-confirmed">ACTIVO</span>}
                      </div>
                      <div className="flex gap-4 mt-1 flex-wrap">
                        {inv.email && (
                          <span className="font-mono text-[11px] text-ink-700 tracking-widest flex items-center gap-1">
                            <Mail size={10}/>{inv.email}
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-ink-700 tracking-widest flex items-center gap-1">
                          <Clock size={10}/>Expira {fmtDate(inv.expires_at)}
                        </span>
                        {inv.used && (
                          <span className="font-mono text-[11px] text-ink-600 tracking-widest">
                            Usado el {fmtDate(inv.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!inv.used && !inv.expired && (
                      <button onClick={() => copy(url, inv.id)}
                        className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase
                                   px-4 py-2 border border-ink-500 text-ink-700
                                   hover:border-gold hover:text-gold transition-all">
                        {copiedId === inv.id
                          ? <><Check size={13}/> Copiado</>
                          : <><Copy size={13}/> Copiar</>
                        }
                      </button>
                    )}
                    <button onClick={() => del(inv.id)}
                      className="w-9 h-9 border border-ink-500 flex items-center justify-center
                                 text-ink-600 hover:border-rap-red hover:text-rap-red transition-all">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
