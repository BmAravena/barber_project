'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { setToken, apiRegister, apiValidateInvite } from '@/lib/api';
import { Scissors, AlertTriangle, CheckCircle } from 'lucide-react';

function RegisterContent() {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get('invite') || '';

  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [prefillEmail, setPrefillEmail] = useState('');
  const [form, setForm] = useState({ username: '', full_name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Validate invite token on load
  useEffect(() => {
    if (!inviteToken) { setTokenStatus('invalid'); return; }
    apiValidateInvite(tenant, inviteToken)
      .then(data => {
        if (data.valid) {
          setTokenStatus('valid');
          if (data.email) { setPrefillEmail(data.email); setForm(f => ({ ...f, email: data.email })); }
        } else { setTokenStatus('invalid'); }
      })
      .catch(() => setTokenStatus('invalid'));
  }, [inviteToken, tenant]);

  const handle = async () => {
    if (!form.username || !form.full_name || !form.email || !form.password) { setError('Completa todos los campos'); return; }
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden'); return; }
    if (form.password.length < 6) { setError('Mínimo 6 caracteres'); return; }
    setLoading(true); setError('');
    try {
      const data = await apiRegister(tenant, { ...form, invite_token: inviteToken });
      setToken(tenant, data.token);
      router.push(`/${tenant}/dashboard`);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  };

  // Loading state
  if (tokenStatus === 'checking') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  // Invalid token
  if (tokenStatus === 'invalid') return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-rap-red/10 border border-rap-red/30 flex items-center justify-center mx-auto mb-8">
          <AlertTriangle size={36} className="text-rap-red"/>
        </div>
        <h1 className="font-display text-5xl text-rap-red mb-4">ACCESO DENEGADO</h1>
        <p className="font-mono text-sm text-ink-700 tracking-widest mb-2">
          {inviteToken
            ? 'Este enlace de invitación no es válido o ya fue utilizado.'
            : 'Necesitas un enlace de invitación para registrarte.'}
        </p>
        <p className="font-mono text-[11px] text-ink-600 tracking-widest mb-10">
          Contacta al dueño de la barbería para obtener una invitación.
        </p>
        <Link href={`/${tenant}/auth/login`} className="btn-gold inline-block">
          YA TENGO CUENTA →
        </Link>
        <div className="mt-4">
          <Link href={`/${tenant}`} className="font-mono text-[11px] text-ink-700 hover:text-gold tracking-widest">
            ← Volver a {tenant}
          </Link>
        </div>
      </div>
    </div>
  );

  // Valid token — show form
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gold mx-auto flex items-center justify-center mb-5 animate-pulse-gold">
            <Scissors size={28} className="text-ink rotate-180"/>
          </div>
          <h1 className="font-display text-5xl text-cream">CREAR CUENTA</h1>
          <p className="font-mono text-[11px] text-ink-700 tracking-[.3em] mt-2 uppercase">
            Únete a {tenant}
          </p>
        </div>

        {/* Valid token badge */}
        <div className="flex items-center gap-3 bg-rap-green/10 border border-rap-green/30 px-4 py-3 mb-6">
          <CheckCircle size={16} className="text-rap-green flex-shrink-0"/>
          <p className="font-mono text-[11px] text-rap-green tracking-widest">
            INVITACIÓN VÁLIDA — Tienes {48}h para completar tu registro
          </p>
        </div>

        <div className="card p-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Usuario</label>
              <input className="input-field" placeholder="tu_usuario"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}/>
            </div>
            <div>
              <label className="label">Nombre</label>
              <input className="input-field" placeholder="Tu nombre"
                value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}/>
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" placeholder="tu@email.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              readOnly={!!prefillEmail}
              style={prefillEmail ? { opacity: 0.7 } : {}}/>
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input-field" type="password" placeholder="Mínimo 6 caracteres"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/>
          </div>
          <div>
            <label className="label">Confirmar contraseña</label>
            <input className="input-field" type="password" placeholder="Repite tu contraseña"
              value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handle()}/>
          </div>

          {error && (
            <p className="font-mono text-[11px] text-rap-red tracking-widest bg-rap-red/10 border border-rap-red/30 px-4 py-3">{error}</p>
          )}

          <button onClick={handle} disabled={loading} className="btn-gold w-full text-xl py-4">
            {loading ? 'Creando cuenta...' : 'CREAR MI CUENTA →'}
          </button>
          <div className="gold-line"/>
          <p className="font-mono text-[11px] text-ink-700 tracking-widest text-center">
            ¿YA TIENES CUENTA?{' '}
            <Link href={`/${tenant}/auth/login`} className="text-gold hover:underline">INICIAR SESIÓN</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
