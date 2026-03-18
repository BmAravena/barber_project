'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiBillingStatus, apiBillingSubscribe, apiBillingCancel } from '@/lib/api';
import { Check, X, Zap, CreditCard, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { Suspense } from 'react';

const fmtCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

const PLANS = [
  {
    id: 'trial',
    name: 'TRIAL',
    price: 'GRATIS',
    period: '14 días',
    color: 'border-ink-500',
    titleColor: 'text-cream',
    features: ['10 barberos', 'Citas ilimitadas', 'Emails automáticos', 'Portfolio', 'Todas las funciones'],
    missing: ['Soporte prioritario'],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: fmtCLP(6500),
    period: 'CLP / mes',
    color: 'border-gold',
    titleColor: 'text-gold',
    features: ['10 barberos', 'Citas ilimitadas', 'Emails automáticos', 'Portfolio', 'Invitaciones'],
    missing: ['Soporte prioritario'],
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: fmtCLP(12000),
    period: 'CLP / mes',
    color: 'border-ink-500',
    titleColor: 'text-cream',
    features: ['Barberos ilimitados', 'Todo de Pro incluido', 'Soporte prioritario', 'API access'],
    missing: [],
  },
];

const STATUS_LABEL: Record<string, string> = {
  pending:    'Pago pendiente',
  authorized: 'Activa',
  cancelled:  'Cancelada',
  paused:     'Pausada',
};
const STATUS_CLASS: Record<string, string> = {
  pending:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  authorized: 'bg-rap-green/20 text-rap-green border-rap-green/30',
  cancelled:  'bg-ink-500/20 text-ink-600 border-ink-500/30',
  paused:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function BillingContent() {
  const { tenant } = useParams<{ tenant: string }>();
  const searchParams = useSearchParams();

  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  // Mostrar banner de resultado de pago si viene de MP
  const paymentResult = searchParams.get('payment');
  const paidPlan      = searchParams.get('plan');

  useEffect(() => {
    loadBilling();
  }, [tenant]);

  const loadBilling = () => {
    setLoading(true);
    apiBillingStatus(tenant)
      .then(setBilling)
      .catch(() => setError('No se pudo cargar el estado del plan'))
      .finally(() => setLoading(false));
  };

  const handleUpgrade = async (plan: string) => {
    setActionLoading(plan); setError('');
    try {
      const result = await apiBillingSubscribe(tenant, plan);
      // Redirigir al checkout de MercadoPago
      window.location.href = result.init_point;
    } catch (e: any) {
      setError(e.message || 'Error al iniciar el pago');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async () => {
    setActionLoading('cancel'); setError('');
    try {
      await apiBillingCancel(tenant);
      setConfirm(false);
      loadBilling();
    } catch (e: any) {
      setError(e.message || 'Error al cancelar');
    } finally {
      setActionLoading('');
    }
  };

  const currentPlan = billing?.plan || 'trial';
  const sub         = billing?.subscription;
  const limits      = billing?.plan_limits || {};
  const isExpired   = currentPlan === 'expired';
  const isTrial     = currentPlan === 'trial';

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="mb-8">
        <p className="font-mono text-[11px] text-gold tracking-[.4em] uppercase mb-2">Gestión</p>
        <h1 className="font-display text-4xl md:text-6xl text-cream">PLAN</h1>
        <div className="h-px w-24 bg-gold mt-3" />
      </div>

      {/* Trial / Expired banners */}
      {isTrial && limits.trial_days_left !== undefined && (
        <div className={`flex items-center gap-3 px-5 py-4 mb-6 border ${
          limits.trial_days_left <= 3
            ? 'bg-rap-red/10 border-rap-red/30'
            : 'bg-gold/5 border-gold/20'
        }`}>
          <AlertTriangle size={15} className={`flex-shrink-0 ${limits.trial_days_left <= 3 ? 'text-rap-red' : 'text-gold'}`} />
          <p className={`font-mono text-[11px] tracking-widest ${limits.trial_days_left <= 3 ? 'text-rap-red' : 'text-gold'}`}>
            {limits.trial_days_left <= 0
              ? 'Tu período de prueba ha vencido — elige un plan para continuar.'
              : `Trial activo — ${limits.trial_days_left} día${limits.trial_days_left !== 1 ? 's' : ''} restante${limits.trial_days_left !== 1 ? 's' : ''}. Elige un plan antes de que venza.`}
          </p>
        </div>
      )}
      {isExpired && (
        <div className="flex items-center gap-3 bg-rap-red/10 border border-rap-red/30 px-5 py-4 mb-6">
          <AlertTriangle size={15} className="text-rap-red flex-shrink-0" />
          <p className="font-mono text-[11px] text-rap-red tracking-widest">
            Tu período de prueba venció. Elige un plan para reactivar tu barbería.
          </p>
        </div>
      )}

      {/* Payment result banner */}
      {paymentResult === 'success' && (
        <div className="flex items-center gap-3 bg-rap-green/10 border border-rap-green/30 px-5 py-4 mb-6">
          <CheckCircle size={18} className="text-rap-green flex-shrink-0" />
          <div>
            <p className="font-display text-xl text-rap-green">¡PAGO PROCESADO!</p>
            <p className="font-mono text-[11px] text-rap-green/80 tracking-widest mt-0.5">
              Tu plan {paidPlan?.toUpperCase()} se activará en unos minutos.
            </p>
          </div>
        </div>
      )}
      {paymentResult === 'failure' && (
        <div className="flex items-center gap-3 bg-rap-red/10 border border-rap-red/30 px-5 py-4 mb-6">
          <AlertTriangle size={18} className="text-rap-red flex-shrink-0" />
          <p className="font-mono text-[11px] text-rap-red tracking-widest">
            El pago no pudo procesarse. Puedes intentarlo nuevamente.
          </p>
        </div>
      )}

      {error && (
        <div className="font-mono text-[11px] text-rap-red tracking-widest bg-rap-red/10 border border-rap-red/30 px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Current plan card */}
          <div className="card p-6 mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="font-mono text-[10px] text-ink-700 tracking-[.4em] uppercase mb-1">Plan actual</p>
                <div className="flex items-center gap-3">
                  <span className={`font-display text-5xl ${currentPlan === 'pro' ? 'text-gold' : 'text-cream'}`}>
                    {currentPlan.toUpperCase()}
                  </span>
                  {sub && (
                    <span className={`badge border ${STATUS_CLASS[sub.status] || ''}`}>
                      {STATUS_LABEL[sub.status] || sub.status}
                    </span>
                  )}
                </div>
                {sub?.current_period_end && (
                  <p className="font-mono text-[11px] text-ink-700 tracking-widest mt-1">
                    Próximo cobro: {new Date(sub.current_period_end).toLocaleDateString('es-CL')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <CreditCard size={32} className="text-gold/40" />
              </div>
            </div>

            {/* Current plan features */}
            {(() => {
              const plan = PLANS.find(p => p.id === currentPlan);
              return plan ? (
                <div className="mt-4 pt-4 border-t border-ink-400">
                  <div className="flex flex-wrap gap-3">
                    {plan.features.map((f, i) => (
                      <span key={i} className="flex items-center gap-1.5 font-mono text-[11px] text-cream tracking-wider">
                        <Check size={11} className="text-gold" />{f}
                      </span>
                    ))}
                    {plan.missing.map((f, i) => (
                      <span key={i} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-600 tracking-wider">
                        <X size={11} />{f}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Cancel button */}
            {sub?.status === 'authorized' && !confirm && (
              <div className="mt-4 pt-4 border-t border-ink-400">
                <button
                  onClick={() => setConfirm(true)}
                  className="font-mono text-[11px] text-ink-600 hover:text-rap-red tracking-widest uppercase transition-colors"
                >
                  Cancelar suscripción →
                </button>
              </div>
            )}
            {confirm && (
              <div className="mt-4 pt-4 border-t border-rap-red/30 bg-rap-red/5 p-4">
                <p className="font-mono text-[11px] text-rap-red tracking-widest mb-3">
                  ¿Confirmar cancelación? Tu plan volverá a Free inmediatamente.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading === 'cancel'}
                    className="btn-danger text-xs"
                  >
                    {actionLoading === 'cancel' ? 'Cancelando...' : 'Sí, cancelar'}
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="font-mono text-[11px] text-ink-700 hover:text-cream tracking-widest uppercase"
                  >
                    No, mantener plan
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upgrade options */}
          {/* Upgrade options — mostrar en trial, expired, o plan free */}
          {(isTrial || isExpired || currentPlan === 'free') && (
            <>
              <h2 className="font-display text-3xl text-gold tracking-wider mb-2">ACTUALIZA TU PLAN</h2>
              <div className="gold-line mb-6" />
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {PLANS.filter(p => p.id !== 'free').map(plan => (
                  <div key={plan.id} className={`bg-ink-200 border-2 ${plan.color} p-6 relative overflow-hidden`}>
                    {plan.id === 'pro' && (
                      <div className="absolute top-0 right-0 bg-gold text-ink font-mono text-[9px] tracking-[.3em] uppercase px-3 py-1">
                        RECOMENDADO
                      </div>
                    )}
                    <p className="font-mono text-[10px] text-ink-700 tracking-[.3em] uppercase mb-2">
                      {plan.id === 'pro' ? 'Para barberías activas' : 'Para cadenas y franquicias'}
                    </p>
                    <h3 className={`font-display text-4xl ${plan.titleColor} mb-1`}>{plan.name}</h3>
                    <div className="flex items-end gap-1 mb-4">
                      <span className="font-display text-3xl text-cream">{plan.price}</span>
                      <span className="font-mono text-[11px] text-ink-600 tracking-wider mb-1">{plan.period}</span>
                    </div>
                    <div className="gold-line mb-4" />
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 font-mono text-[11px] text-cream tracking-wider">
                          <Check size={11} className="text-gold flex-shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={actionLoading === plan.id}
                      className={`w-full py-3 font-display text-lg tracking-widest flex items-center justify-center gap-2
                        ${plan.id === 'pro' ? 'btn-gold shimmer' : 'btn-outline'}`}
                    >
                      {actionLoading === plan.id ? (
                        'Redirigiendo...'
                      ) : (
                        <><Zap size={16} /> Activar {plan.name}</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2">
                <ExternalLink size={13} className="text-ink-600" />
                <Link href="/pricing" target="_blank" className="font-mono text-[11px] text-ink-600 hover:text-gold tracking-widest uppercase">
                  Ver comparativa completa de planes →
                </Link>
              </div>
            </>
          )}

          {/* Already on paid plan */}
          {!isTrial && !isExpired && currentPlan !== 'free' && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-gold" />
                <p className="font-mono text-[11px] text-gold tracking-[.3em] uppercase">Tu plan incluye</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PLANS.find(p => p.id === currentPlan)?.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check size={12} className="text-gold flex-shrink-0" />
                    <span className="font-mono text-[11px] text-cream tracking-wider">{f}</span>
                  </div>
                ))}
              </div>
              {currentPlan === 'pro' && (
                <div className="mt-6 pt-4 border-t border-ink-400">
                  <p className="font-mono text-[10px] text-ink-600 tracking-widest">
                    ¿Necesitas más? El plan Enterprise incluye barberos ilimitados y soporte prioritario.
                  </p>
                  <button
                    onClick={() => handleUpgrade('enterprise')}
                    disabled={actionLoading === 'enterprise'}
                    className="btn-outline mt-3 text-sm py-2 px-6"
                  >
                    {actionLoading === 'enterprise' ? 'Redirigiendo...' : 'Upgrade a Enterprise →'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
