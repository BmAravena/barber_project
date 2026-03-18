'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiOnboarding, setToken } from '@/lib/api';
import { Scissors, CheckCircle, ArrowRight, Check, X } from 'lucide-react';

const fmtCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

const PLANS = [
  {
    id: 'trial',
    name: 'TRIAL',
    price: 'GRATIS',
    period: '14 días · luego elige un plan',
    color: 'border-ink-500',
    titleColor: 'text-cream',
    badge: null,
    perks: ['10 barberos', 'Citas ilimitadas', 'Todo incluido'],
    limits: [],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: fmtCLP(6500),
    period: 'CLP / mes',
    color: 'border-gold',
    titleColor: 'text-gold',
    badge: 'RECOMENDADO',
    perks: ['10 barberos', 'Citas ilimitadas', 'Emails automáticos', 'Portfolio'],
    limits: [],
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: fmtCLP(12000),
    period: 'CLP / mes',
    color: 'border-ink-500',
    titleColor: 'text-cream',
    badge: null,
    perks: ['Barberos ilimitados', 'Todo incluido', 'Soporte prioritario'],
    limits: [],
  },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(0); // 0=plan, 1=datos, 2=cuenta
  const [selectedPlan, setSelectedPlan] = useState('trial');
  const [form, setForm] = useState({
    slug: '', name: '', owner_name: '', owner_email: '', phone: '', address: '', city: '',
    barber_username: '', barber_password: '', barber_confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ slug: string } | null>(null);

  useEffect(() => {
    const planFromUrl = searchParams.get('plan');
    if (planFromUrl && PLANS.find(p => p.id === planFromUrl)) {
      setSelectedPlan(planFromUrl);
      setStep(1);
    }
  }, [searchParams]);

  const slugify = (v: string) =>
    v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const next = () => {
    setError('');
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      if (!form.slug || !form.name || !form.owner_name || !form.owner_email) {
        setError('Completa todos los campos obligatorios'); return;
      }
      setStep(2);
    } else {
      if (!form.barber_username || !form.barber_password) {
        setError('Completa usuario y contraseña'); return;
      }
      if (form.barber_password !== form.barber_confirm) {
        setError('Las contraseñas no coinciden'); return;
      }
      if (form.barber_password.length < 6) {
        setError('Contraseña mínimo 6 caracteres'); return;
      }
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiOnboarding({
        slug: form.slug, name: form.name, owner_email: form.owner_email,
        owner_name: form.owner_name, phone: form.phone, address: form.address,
        city: form.city, barber_username: form.barber_username,
        barber_password: form.barber_password,
        plan: selectedPlan,
      });
      setToken(form.slug, data.token);

      // Si el backend devolvió un checkout_url, redirigir a MercadoPago
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return; // no continuar — el usuario vuelve desde MP al dashboard
      }

      setDone({ slug: form.slug });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error'); setStep(1);
    } finally { setLoading(false); }
  };

  const stepLabels = ['ELIGE TU PLAN', 'TU BARBERÍA', 'TU CUENTA'];

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (done) {
    const plan = PLANS.find(p => p.id === selectedPlan)!;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-8">
            <CheckCircle size={40} className="text-gold" />
          </div>
          <h1 className="font-display text-6xl text-gold mb-2">¡LISTO!</h1>
          <p className="font-display text-3xl text-cream mb-6">BARBERÍA CREADA</p>
          <div className="card p-6 text-left mb-6 space-y-3">
            <Row label="Barbería" val={form.name} />
            <Row label="Plan activo" val="FREE" />
            <Row label="URL pública" val={`/${done.slug}/`} />
            <Row label="Dashboard" val={`/${done.slug}/dashboard`} />
          </div>
          {selectedPlan !== 'trial' && (
            <div className="bg-gold/5 border border-gold/20 p-4 mb-6">
              <p className="font-mono text-[11px] text-gold tracking-widest uppercase text-center">
                ✦ Activa el plan {plan?.name} desde tu dashboard ✦
              </p>
              <p className="font-mono text-[10px] text-ink-700 tracking-wider text-center mt-1">
                Dashboard → Plan → Activar {plan?.name}
              </p>
            </div>
          )}
          <div className="flex gap-3 flex-col">
            <Link href={`/${done.slug}/dashboard`} className="btn-gold block text-center text-xl">
              IR A MI DASHBOARD →
            </Link>
            <Link href={`/${done.slug}`} className="btn-outline block text-center">
              VER MI PÁGINA PÚBLICA
            </Link>
            {selectedPlan === 'free' && (
              <Link href="/pricing" className="font-mono text-[11px] text-ink-700 hover:text-gold tracking-widest uppercase text-center mt-2">
                ¿Quieres más funciones? Ver planes →
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gold flex items-center justify-center animate-pulse-gold">
              <Scissors size={22} className="text-ink rotate-180" />
            </div>
          </Link>
          <h1 className="font-display text-5xl text-cream">REGISTRAR BARBERÍA</h1>
          <p className="font-mono text-[11px] text-gold tracking-[.4em] mt-2 uppercase">
            {stepLabels[step]}
          </p>
          <div className="mt-4 h-1 bg-ink-400 w-full">
            <div
              className="h-full bg-gold transition-all duration-500"
              style={{ width: `${((step + 1) / 3) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            {stepLabels.map((label, i) => (
              <span key={i} className={`font-mono text-[9px] tracking-widest uppercase transition-colors ${i <= step ? 'text-gold' : 'text-ink-600'}`}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        {/* ── STEP 0: PLAN ─────────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="font-mono text-[11px] text-ink-700 tracking-widest text-center uppercase mb-6">
              Puedes cambiar de plan en cualquier momento
            </p>
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`w-full text-left bg-ink-200 border-2 transition-all duration-200 p-5 relative overflow-hidden
                  ${selectedPlan === plan.id ? plan.color : 'border-ink-400 hover:border-ink-500'}`}
              >
                {plan.badge && (
                  <span className="absolute top-0 right-0 bg-gold text-ink font-mono text-[9px] tracking-[.3em] uppercase px-3 py-1">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                      ${selectedPlan === plan.id ? 'border-gold bg-gold' : 'border-ink-500'}`}>
                      {selectedPlan === plan.id && <div className="w-2 h-2 rounded-full bg-ink" />}
                    </div>
                    <div>
                      <span className={`font-display text-3xl tracking-widest ${selectedPlan === plan.id ? plan.titleColor : 'text-ink-800'}`}>
                        {plan.name}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {plan.perks.map((p, i) => (
                          <span key={i} className="flex items-center gap-1 font-mono text-[10px] text-cream tracking-wider">
                            <Check size={10} className="text-gold" />{p}
                          </span>
                        ))}
                        {plan.limits.map((l, i) => (
                          <span key={i} className="flex items-center gap-1 font-mono text-[10px] text-ink-600 tracking-wider">
                            <X size={10} />{l}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className={`font-display text-3xl ${selectedPlan === plan.id ? plan.titleColor : 'text-ink-700'}`}>
                      {plan.price}
                    </div>
                    <div className="font-mono text-[9px] text-ink-600 tracking-widest whitespace-nowrap">
                      {plan.period}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            <button onClick={next} className="btn-gold w-full flex items-center justify-center gap-2 text-xl py-4 mt-2">
              Continuar con {PLANS.find(p => p.id === selectedPlan)?.name} <ArrowRight size={18} />
            </button>
            <p className="text-center font-mono text-[10px] text-ink-600 tracking-widest">
              <Link href="/pricing" className="hover:text-gold underline">Ver comparativa completa →</Link>
            </p>
          </div>
        )}

        {/* ── STEP 1: DATOS ────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="card p-8 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-2xl text-gold tracking-wider">DATOS DE LA BARBERÍA</h3>
              <span className={`badge ${selectedPlan === 'pro' ? 'badge-pro' : 'badge-free'}`}>
                {selectedPlan.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Nombre de la barbería *</label>
                <input className="input-field" placeholder="Ej: Homie Barber Shop"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <label className="label">Slug (URL única) *</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-ink-600 text-sm whitespace-nowrap">homie.app/</span>
                  <input className="input-field flex-1" placeholder="mi-barberia"
                    value={form.slug}
                    onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} />
                </div>
                <p className="font-mono text-[10px] text-ink-600 tracking-widest mt-1">Solo minúsculas, números y guiones</p>
              </div>
              <div>
                <label className="label">Tu nombre *</label>
                <input className="input-field" placeholder="Nombre completo"
                  value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input-field" type="email" placeholder="tu@email.com"
                  value={form.owner_email} onChange={e => setForm({ ...form, owner_email: e.target.value })} />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input-field" placeholder="9 XXXX XXXX"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Ciudad</label>
                <input className="input-field" placeholder="Temuco"
                  value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Dirección</label>
                <input className="input-field" placeholder="Calle y número"
                  value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            {error && <p className="font-mono text-[11px] text-rap-red tracking-widest bg-rap-red/10 border border-rap-red/30 px-4 py-3">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(0)} className="btn-ghost">← Atrás</button>
              <button onClick={next} disabled={loading} className="btn-gold flex-1 flex items-center justify-center gap-2 text-xl py-4">
                Siguiente <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: CUENTA ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="card p-8 space-y-5">
            <h3 className="font-display text-2xl text-gold tracking-wider">TU CUENTA DE BARBERO</h3>
            <p className="font-mono text-[11px] text-ink-700 tracking-widest">
              Serás el dueño de <span className="text-gold">{form.name}</span>
            </p>
            <div>
              <label className="label">Usuario *</label>
              <input className="input-field" placeholder="tu_usuario"
                value={form.barber_username} onChange={e => setForm({ ...form, barber_username: e.target.value })} />
            </div>
            <div>
              <label className="label">Contraseña *</label>
              <input className="input-field" type="password" placeholder="Mínimo 6 caracteres"
                value={form.barber_password} onChange={e => setForm({ ...form, barber_password: e.target.value })} />
            </div>
            <div>
              <label className="label">Confirmar contraseña *</label>
              <input className="input-field" type="password" placeholder="Repite tu contraseña"
                value={form.barber_confirm} onChange={e => setForm({ ...form, barber_confirm: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && next()} />
            </div>
            {error && <p className="font-mono text-[11px] text-rap-red tracking-widest bg-rap-red/10 border border-rap-red/30 px-4 py-3">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="btn-ghost">← Atrás</button>
              <button onClick={next} disabled={loading} className="btn-gold flex-1 flex items-center justify-center gap-2 text-xl py-4">
                {loading
                  ? (selectedPlan !== 'trial' ? 'Preparando pago...' : 'Creando...')
                  : (selectedPlan !== 'trial' ? 'CREAR Y PAGAR →' : 'CREAR MI BARBERÍA →')}
              </button>
            </div>
          </div>
        )}

        <p className="text-center font-mono text-[11px] text-ink-600 tracking-widest mt-6">
          ¿YA TIENES BARBERÍA?{' '}
          <Link href="/" className="text-gold hover:underline">VER BARBERÍAS</Link>
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-mono text-[10px] text-ink-600 tracking-widest uppercase">{label}</span>
      <span className="font-mono text-sm text-gold">{val}</span>
    </div>
  );
}
