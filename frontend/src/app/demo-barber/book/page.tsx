'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DemoBanner from '@/components/DemoBanner';
import { apiGetBarbers, apiGetServices, apiAvailability } from '@/lib/api';
import type { Barber, Service } from '@/types';
import { Scissors, CheckCircle, Clock, ChevronRight, User, Phone } from 'lucide-react';

const SLUG = 'demo-barber';
const fmtP = (n: number) => `$${n.toLocaleString('es-CL')}`;
const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function getNextDays(n: number) {
  const days: Date[] = [];
  const start = new Date(); start.setDate(start.getDate() + 1);
  for (let i = 0; i < n; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d.getDay() !== 0) days.push(d);
  }
  return days;
}

function DemoBookContent() {
  const params = useSearchParams();
  const preBarber = params.get('barber');

  const [step, setStep]           = useState(1);
  const [barbers, setBarbers]     = useState<Barber[]>([]);
  const [services, setServices]   = useState<Service[]>([]);
  const [slots, setSlots]         = useState<string[]>([]);
  const [done, setDone]           = useState(false);

  const [selBarber, setSelBarber]   = useState<Barber | null>(null);
  const [selService, setSelService] = useState<Service | null>(null);
  const [selDate, setSelDate]       = useState<Date | null>(null);
  const [selTime, setSelTime]       = useState('');
  const [form, setForm]             = useState({ client_name: '', client_phone: '' });

  const days = getNextDays(14);

  useEffect(() => {
    apiGetBarbers(SLUG).then(bs => {
      setBarbers(bs);
      if (preBarber) {
        const found = bs.find((b: Barber) => b.id === preBarber);
        if (found) { setSelBarber(found); setStep(2); }
      }
    });
  }, [preBarber]);

  useEffect(() => {
    if (selBarber) apiGetServices(SLUG, selBarber.id).then(setServices);
  }, [selBarber]);

  useEffect(() => {
    if (selBarber && selDate) {
      apiAvailability(SLUG, selBarber.id, selDate.toISOString().split('T')[0]).then(d => setSlots(d.available));
    }
  }, [selBarber, selDate]);

  const imgSrc = (img?: string) => {
    if (!img) return '';
    return img.startsWith('data:') ? img : `data:image/svg+xml;base64,${img}`;
  };

  // Demo: simulate booking without actually calling the API
  const handleBook = () => {
    if (!form.client_name || !form.client_phone) return;
    setDone(true);
  };

  if (done) return (
    <div className="min-h-screen">
      <DemoBanner />
      <div className="flex items-center justify-center min-h-[calc(100vh-40px)] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-8">
            <CheckCircle size={40} className="text-gold" />
          </div>
          <h1 className="font-display text-6xl text-gold mb-3">¡ASÍ SE VE!</h1>
          <p className="font-display text-3xl text-cream mb-4">RESERVA DEMO</p>
          <p className="font-mono text-[11px] text-ink-600 tracking-widest mb-8">
            En una barbería real, el cliente recibiría un email de confirmación y un recordatorio 24h antes.
          </p>
          <div className="card p-6 text-left space-y-3 mb-8">
            {[
              ['Barbero',  selBarber?.full_name ?? ''],
              ['Servicio', selService?.name ?? ''],
              ['Precio',   fmtP(selService?.price ?? 0)],
              ['Fecha',    selDate?.toLocaleDateString('es-CL', {weekday:'long',day:'numeric',month:'long'}) ?? ''],
              ['Hora',     selTime],
              ['Cliente',  form.client_name],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="font-mono text-[10px] text-ink-600 tracking-widest uppercase">{l}</span>
                <span className="font-body text-cream text-right">{v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Link href="/onboarding" className="btn-gold block text-center text-xl">
              CREAR MI BARBERÍA GRATIS →
            </Link>
            <button onClick={() => { setDone(false); setStep(1); setSelBarber(null); setSelService(null); setSelDate(null); setSelTime(''); setForm({ client_name: '', client_phone: '' }); }}
              className="btn-ghost block w-full text-center">
              ← Volver a probar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <DemoBanner />

      {/* Header */}
      <div className="bg-ink-50 border-b border-ink-400 py-8 px-4 noise">
        <div className="max-w-4xl mx-auto">
          <Link href="/demo-barber/barbers" className="font-mono text-[11px] text-ink-700 tracking-widest uppercase hover:text-gold transition-colors flex items-center gap-2 mb-3">
            ← Volver
          </Link>
          <h1 className="font-display text-5xl text-cream">RESERVAR CITA <span className="text-gold/50 text-3xl">— DEMO</span></h1>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-ink-100 border-b border-ink-400 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          {[{n:1,l:'Barbero'},{n:2,l:'Servicio'},{n:3,l:'Fecha & Hora'},{n:4,l:'Confirmar'}].map(({n,l},i,arr) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 cursor-pointer ${step>=n?'text-gold':'text-ink-600'}`} onClick={() => step>n && setStep(n)}>
                <div className={`w-7 h-7 flex items-center justify-center font-mono text-xs border ${step>n?'bg-gold text-ink border-gold':step===n?'border-gold text-gold':'border-ink-500 text-ink-600'}`}>{step>n?'✓':n}</div>
                <span className="font-mono text-[11px] tracking-widest uppercase hidden md:block">{l}</span>
              </div>
              {i<arr.length-1 && <ChevronRight size={12} className="text-ink-600"/>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* STEP 1 */}
        {step === 1 && (
          <div className="stagger">
            <h2 className="section-title text-4xl mb-8">ELIGE TU BARBERO</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {barbers.map(b => (
                <button key={b.id} onClick={() => { setSelBarber(b); setStep(2); }}
                  className="card p-0 text-left group hover:border-gold/60 transition-all hover:-translate-y-0.5 duration-200">
                  <div className="h-36 bg-ink-300 overflow-hidden relative">
                    {b.avatar
                      ? <img src={imgSrc(b.avatar)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt={b.full_name}/>
                      : <div className="w-full h-full flex items-center justify-center"><Scissors size={32} className="text-gold/20 rotate-180"/></div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-200/80 to-transparent"/>
                  </div>
                  <div className="p-4">
                    <div className="font-display text-xl text-cream">{b.full_name}</div>
                    {b.specialty && <div className="font-mono text-[10px] text-gold tracking-widest mt-0.5">{b.specialty}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && selBarber && (
          <div className="stagger">
            <h2 className="section-title text-4xl mb-2">ELIGE TU SERVICIO</h2>
            <p className="font-mono text-[11px] text-ink-700 tracking-widest uppercase mb-8">Con {selBarber.full_name}</p>
            <div className="space-y-3">
              {services.map(s => (
                <button key={s.id} onClick={() => { setSelService(s); setStep(3); }}
                  className="w-full card p-5 flex items-center justify-between text-left group hover:border-gold/60 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gold/10 flex items-center justify-center border border-gold/20 group-hover:bg-gold/20 transition-colors">
                      <Scissors size={16} className="text-gold rotate-180"/>
                    </div>
                    <div>
                      <div className="font-display text-xl text-cream">{s.name}</div>
                      {s.description && <div className="font-mono text-[11px] text-ink-700 tracking-wider mt-0.5">{s.description}</div>}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="font-display text-2xl text-gold">{fmtP(s.price)}</div>
                    <div className="flex items-center gap-1 justify-end text-ink-600 mt-1">
                      <Clock size={10}/><span className="font-mono text-[10px]">{s.duration}m</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="btn-ghost mt-6">← Cambiar barbero</button>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="stagger">
            <h2 className="section-title text-4xl mb-8">FECHA & HORA</h2>
            <div className="mb-8">
              <label className="label">Selecciona el día</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map(d => {
                  const isSel = selDate?.toDateString() === d.toDateString();
                  return (
                    <button key={d.toISOString()} onClick={() => { setSelDate(d); setSelTime(''); }}
                      className={`flex-shrink-0 w-16 py-3 flex flex-col items-center border transition-all ${isSel?'bg-gold border-gold text-ink':'bg-ink-200 border-ink-400 text-cream hover:border-gold/60'}`}>
                      <span className={`font-mono text-[10px] tracking-widest ${isSel?'text-ink':'text-ink-700'}`}>{DAY_NAMES[d.getDay()]}</span>
                      <span className="font-display text-2xl leading-tight">{d.getDate()}</span>
                      <span className={`font-mono text-[9px] ${isSel?'text-ink':'text-ink-600'}`}>{MONTH_NAMES[d.getMonth()]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {selDate && (
              <div>
                <label className="label">Horarios disponibles</label>
                {slots.length === 0
                  ? <p className="text-ink-600 font-mono text-sm">Sin horarios disponibles</p>
                  : <div className="flex flex-wrap gap-2">{slots.map(t => (
                    <button key={t} onClick={() => setSelTime(t)}
                      className={`px-4 py-2 border font-mono text-sm tracking-widest transition-all ${selTime===t?'bg-gold border-gold text-ink font-bold':'bg-ink-200 border-ink-400 text-cream hover:border-gold/60'}`}>{t}</button>
                  ))}</div>
                }
              </div>
            )}
            <div className="flex gap-4 mt-8">
              <button onClick={() => setStep(2)} className="btn-ghost">← Atrás</button>
              <button onClick={() => setStep(4)} disabled={!selDate || !selTime} className="btn-gold">Continuar →</button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="stagger">
            <h2 className="section-title text-4xl mb-8">CONFIRMAR DEMO</h2>
            <div className="card p-5 mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[['Barbero',selBarber?.full_name],['Servicio',selService?.name],['Fecha',selDate?.toLocaleDateString('es-CL',{day:'numeric',month:'short'})],['Hora',selTime]].map(([l,v]) => (
                <div key={l}><div className="font-mono text-[9px] text-ink-600 tracking-[.3em] uppercase">{l}</div><div className="font-display text-lg text-gold mt-1">{v}</div></div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-5 mb-8">
              <div><label className="label flex items-center gap-2"><User size={12}/> Nombre</label><input className="input-field" value={form.client_name} placeholder="Tu nombre" onChange={e => setForm({...form,client_name:e.target.value})}/></div>
              <div><label className="label flex items-center gap-2"><Phone size={12}/> Teléfono</label><input className="input-field" value={form.client_phone} placeholder="9 XXXX XXXX" onChange={e => setForm({...form,client_phone:e.target.value})}/></div>
            </div>
            <div className="bg-gold/5 border border-gold/20 px-5 py-4 mb-8">
              <p className="font-mono text-[11px] text-gold tracking-widest">
                ✓ EN MODO DEMO: En una barbería real se enviaría un email de confirmación y un recordatorio 24h antes.
              </p>
            </div>
            <div className="flex gap-4 items-center">
              <button onClick={() => setStep(3)} className="btn-ghost">← Atrás</button>
              <button onClick={handleBook} disabled={!form.client_name || !form.client_phone}
                className="btn-gold text-xl px-12">
                VER CONFIRMACIÓN →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DemoBookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DemoBookContent />
    </Suspense>
  );
}
