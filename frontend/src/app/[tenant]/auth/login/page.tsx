'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiLogin, setToken } from '@/lib/api';
import { Scissors } from 'lucide-react';

export default function LoginPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!form.username || !form.password) { setError('Completa todos los campos'); return; }
    setLoading(true); setError('');
    try {
      const data = await apiLogin(tenant, form);
      setToken(tenant, data.token);
      localStorage.setItem(`homie_barber_${tenant}`, JSON.stringify(data.barber));
      router.push(`/${tenant}/dashboard`);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gold mx-auto flex items-center justify-center mb-5 animate-pulse-gold">
            <Scissors size={28} className="text-ink rotate-180" />
          </div>
          <h1 className="font-display text-5xl text-cream">ACCESO</h1>
          <p className="font-mono text-[11px] text-ink-700 tracking-[.3em] mt-2 uppercase">Barberos de {tenant}</p>
        </div>
        <div className="card p-8 space-y-5">
          <div>
            <label className="label">Usuario</label>
            <input className="input-field" placeholder="tu_usuario" value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input className="input-field" type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {error && <p className="font-mono text-[11px] text-rap-red tracking-widest bg-rap-red/10 border border-rap-red/30 px-4 py-3">{error}</p>}
          <button onClick={handleLogin} disabled={loading} className="btn-gold w-full text-xl py-4">
            {loading ? 'Entrando...' : 'ENTRAR →'}
          </button>
          <div className="gold-line" />
          <p className="font-mono text-[11px] text-ink-700 tracking-widest text-center">
            ¿SIN CUENTA?{' '}
            <Link href={`/${tenant}/auth/register`} className="text-gold hover:underline">REGISTRARSE</Link>
          </p>
          <p className="font-mono text-[11px] text-ink-600 tracking-widest text-center">
            <Link href={`/${tenant}`} className="hover:text-gold">← Volver a {tenant}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
