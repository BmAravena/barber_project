'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Scissors, Check, X, Zap, Shield, ChevronRight, Clock } from 'lucide-react';

const fmtCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

const PLANS = [
  {
    id: 'trial',
    name: 'TRIAL',
    rawPrice: 0,
    period: '14 días gratis',
    description: 'Prueba sin límites',
    accent: 'border-ink-500',
    titleColor: 'text-cream',
    badge: null,
    features: [
      { text: 'Hasta 10 barberos', ok: true },
      { text: 'Citas ilimitadas', ok: true },
      { text: 'Página pública', ok: true },
      { text: 'Reservas online', ok: true },
      { text: 'Emails automáticos', ok: true },
      { text: 'Portfolio de fotos', ok: true },
      { text: 'Recordatorios 24h', ok: true },
      { text: 'Soporte prioritario', ok: false },
    ],
    cta: 'Comenzar prueba gratis',
    ctaClass: 'btn-outline w-full text-lg py-4',
  },
  {
    id: 'pro',
    name: 'PRO',
    rawPrice: 6500,
    period: 'CLP / mes',
    description: 'Para barberías activas',
    accent: 'border-gold',
    titleColor: 'text-gold',
    badge: 'MÁS POPULAR',
    features: [
      { text: 'Hasta 10 barberos', ok: true },
      { text: 'Citas ilimitadas', ok: true },
      { text: 'Página pública', ok: true },
      { text: 'Reservas online', ok: true },
      { text: 'Emails automáticos', ok: true },
      { text: 'Portfolio de fotos', ok: true },
      { text: 'Recordatorios 24h', ok: true },
      { text: 'Soporte prioritario', ok: false },
    ],
    cta: 'Empezar con Pro',
    ctaClass: 'btn-gold w-full text-lg py-4 shimmer',
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    rawPrice: 12000,
    period: 'CLP / mes',
    description: 'Para cadenas y franquicias',
    accent: 'border-ink-500',
    titleColor: 'text-cream',
    badge: null,
    features: [
      { text: 'Barberos ilimitados', ok: true },
      { text: 'Citas ilimitadas', ok: true },
      { text: 'Página pública', ok: true },
      { text: 'Reservas online', ok: true },
      { text: 'Emails automáticos', ok: true },
      { text: 'Portfolio de fotos', ok: true },
      { text: 'Recordatorios 24h', ok: true },
      { text: 'Soporte prioritario', ok: true },
    ],
    cta: 'Empezar con Enterprise',
    ctaClass: 'btn-outline w-full text-lg py-4',
  },
];

const FAQ = [
  { q: '¿Necesito tarjeta para el trial?', a: 'No. El trial de 14 días es completamente gratuito y no requiere ningún medio de pago. Al vencer, puedes elegir el plan que más te acomode.' },
  { q: '¿Qué pasa cuando termina el trial?', a: 'Tu cuenta queda en espera. No pierdes tus datos, pero deberás elegir un plan de pago para seguir recibiendo citas y usar todas las funciones.' },
  { q: '¿Puedo cambiar de plan después?', a: 'Sí. Puedes upgradear en cualquier momento desde el panel de tu barbería en Dashboard → Plan.' },
  { q: '¿Los precios incluyen IVA?', a: 'Los precios están en CLP y no incluyen IVA. Dependiendo de tu situación tributaria puede aplicar impuesto adicional.' },
  { q: '¿Cómo funciona el pago?', a: 'Aceptamos tarjetas de crédito/débito y medios de pago locales vía MercadoPago. El cobro es mensual y puedes cancelar cuando quieras sin costo.' },
];

export default function PricingPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSelectPlan = (planId: string) => {
    router.push(`/onboarding?plan=${planId}`);
  };

  return (
    <div className="min-h-screen">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/95 backdrop-blur-sm border-b border-ink-400">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold flex items-center justify-center">
              <Scissors size={18} className="text-ink rotate-180" />
            </div>
            <div>
              <div className="font-display text-2xl text-cream tracking-wider">HOMIE SAAS</div>
              <div className="font-mono text-[8px] text-ink-700 tracking-[.4em]">BARBER PLATFORM</div>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="nav-link text-base">Inicio</Link>
            <Link href="/onboarding" className="btn-gold text-base py-2 px-6">Empezar →</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-16 px-4 noise overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink to-ink-50" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display text-[18vw] text-gold/[.025] leading-none whitespace-nowrap">PLANS</span>
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-16 bg-gold" />
            <span className="font-mono text-[11px] text-gold tracking-[.4em] uppercase">Planes y precios</span>
            <div className="h-px w-16 bg-gold" />
          </div>
          <h1 className="font-display text-6xl md:text-8xl text-cream leading-none mb-4">
            ELIGE TU<br /><span className="text-gold">PLAN</span>
          </h1>
          {/* Trial banner */}
          <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 px-5 py-2 mt-6">
            <Clock size={13} className="text-gold" />
            <span className="font-mono text-[11px] text-gold tracking-[.3em] uppercase">
              14 días de prueba gratis · Sin tarjeta requerida
            </span>
          </div>
        </div>
      </section>

      {/* PLANS GRID */}
      <section className="py-16 px-4 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6 stagger">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-ink-200 border-2 ${plan.accent} overflow-hidden flex flex-col`}
            >
              {plan.badge && (
                <div className="bg-gold text-ink font-mono text-[10px] tracking-[.4em] uppercase text-center py-2">
                  {plan.badge}
                </div>
              )}
              {plan.id === 'pro' && (
                <div className="absolute top-0 left-0 w-[3px] h-full bg-gold" />
              )}

              <div className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <p className="font-mono text-[10px] text-ink-700 tracking-[.4em] uppercase mb-2">
                    {plan.description}
                  </p>
                  <h2 className={`font-display text-5xl tracking-widest ${plan.titleColor}`}>
                    {plan.name}
                  </h2>
                  <div className="gold-line mt-4" />
                </div>

                {/* Price */}
                <div className="mb-8">
                  {plan.rawPrice === 0 ? (
                    <div>
                      <span className="font-display text-6xl text-cream leading-none">GRATIS</span>
                      <p className="font-mono text-[11px] text-gold tracking-[.3em] uppercase mt-1">
                        luego elige un plan
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-end gap-1">
                        <span className="font-display text-6xl text-cream leading-none">
                          {fmtCLP(plan.rawPrice)}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-ink-700 tracking-[.3em] uppercase mt-1">
                        {plan.period}
                      </p>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3">
                      {f.ok
                        ? <Check size={14} className="text-gold flex-shrink-0" />
                        : <X size={14} className="text-ink-600 flex-shrink-0" />}
                      <span className={`font-mono text-[12px] tracking-wider ${f.ok ? 'text-cream' : 'text-ink-600'}`}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={plan.ctaClass}
                >
                  {plan.cta} →
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="font-mono text-[11px] text-ink-700 tracking-widest text-center mt-8 uppercase">
          ✦ Pago seguro vía MercadoPago · Tarjetas, débito y más ✦
        </p>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-16 px-4 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-mono text-xs text-gold tracking-[.4em] uppercase mb-3">Comparativa completa</p>
          <h2 className="section-title text-5xl">TODO EN DETALLE</h2>
        </div>

        <div className="bg-ink-200 border border-ink-400 overflow-hidden">
          <div className="grid grid-cols-4 border-b border-ink-400">
            <div className="p-4 border-r border-ink-400">
              <span className="font-mono text-[10px] text-ink-700 tracking-[.3em] uppercase">Feature</span>
            </div>
            {[
              { label: 'TRIAL', color: 'text-cream' },
              { label: 'PRO',   color: 'text-gold'  },
              { label: 'ENT.',  color: 'text-cream' },
            ].map(({ label, color }, i) => (
              <div key={label} className={`p-4 text-center ${i < 2 ? 'border-r border-ink-400' : ''}`}>
                <span className={`font-display text-xl tracking-widest ${color}`}>{label}</span>
              </div>
            ))}
          </div>

          {[
            { label: 'Duración',             vals: ['14 días', 'Mensual', 'Mensual'] },
            { label: 'Precio',               vals: ['Gratis', fmtCLP(6500), fmtCLP(12000)] },
            { label: 'Barberos',             vals: ['10', '10', 'Ilimitados'] },
            { label: 'Citas / mes',          vals: ['Ilimitadas', 'Ilimitadas', 'Ilimitadas'] },
            { label: 'Página pública',       vals: [true, true, true] },
            { label: 'Reservas online',      vals: [true, true, true] },
            { label: 'Emails confirmación',  vals: [true, true, true] },
            { label: 'Recordatorios 24h',    vals: [true, true, true] },
            { label: 'Portfolio de fotos',   vals: [true, true, true] },
            { label: 'Invite links',         vals: [true, true, true] },
            { label: 'Soporte prioritario',  vals: [false, false, true] },
          ].map((row, ri) => (
            <div key={ri} className={`grid grid-cols-4 border-b border-ink-400 ${ri % 2 === 0 ? 'bg-ink-300/30' : ''}`}>
              <div className="p-4 border-r border-ink-400">
                <span className="font-mono text-[12px] text-ink-800 tracking-wider">{row.label}</span>
              </div>
              {row.vals.map((val, ci) => (
                <div key={ci} className={`p-4 text-center ${ci < 2 ? 'border-r border-ink-400' : ''}`}>
                  {typeof val === 'boolean' ? (
                    val
                      ? <Check size={16} className="text-gold mx-auto" />
                      : <X size={14} className="text-ink-600 mx-auto" />
                  ) : (
                    <span className="font-mono text-[12px] text-cream tracking-wider">{val}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-mono text-xs text-gold tracking-[.4em] uppercase mb-3">Preguntas frecuentes</p>
          <h2 className="section-title text-5xl">FAQ</h2>
        </div>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-ink-200 border border-ink-400 overflow-hidden">
              <button
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-ink-300/50 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-display text-xl text-cream tracking-wider">{item.q}</span>
                <ChevronRight size={18} className={`text-gold flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-90' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5">
                  <div className="gold-line mb-4" />
                  <p className="font-mono text-sm text-ink-800 tracking-wider leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 px-4 text-center border-t border-ink-400">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-16 bg-gold" />
          <Zap size={16} className="text-gold" />
          <div className="h-px w-16 bg-gold" />
        </div>
        <h2 className="font-display text-6xl text-cream mb-4">
          ¿LISTO PARA<br /><span className="text-gold">EMPEZAR?</span>
        </h2>
        <p className="font-mono text-sm text-ink-700 tracking-[.2em] uppercase mb-10">
          Tu barbería online en menos de 5 minutos
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/onboarding" className="btn-gold text-xl px-12 py-4 shimmer">
            COMENZAR PRUEBA GRATIS →
          </Link>
        </div>
        <div className="flex items-center justify-center gap-2 mt-8">
          <Shield size={14} className="text-ink-700" />
          <span className="font-mono text-[11px] text-ink-700 tracking-widest uppercase">
            14 días gratis · Sin tarjeta · Cancela cuando quieras
          </span>
        </div>
      </section>
    </div>
  );
}
