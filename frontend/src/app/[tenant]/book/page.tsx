'use client';
import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiGetBarbers, apiGetServices, apiAvailability, apiBook, getToken, apiGetMe } from '@/lib/api';
import type { Barber, Service } from '@/types';
import { Scissors, CheckCircle, Clock, ChevronRight, User, Phone, Mail, FileText, AlertTriangle } from 'lucide-react';

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

function BookContent() {
  const { tenant } = useParams<{ tenant: string }>();
  const params = useSearchParams();
  const preBarber = params.get('barber');

  const [step, setStep]           = useState(1);
  const [barbers, setBarbers]     = useState<Barber[]>([]);
  const [services, setServices]   = useState<Service[]>([]);
  const [slots, setSlots]         = useState<string[]>([]);
  const [done, setDone]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [loggedBarberId, setLoggedBarberId] = useState<string | null>(null);

  const [selBarber, setSelBarber]   = useState<Barber | null>(null);
  const [selService, setSelService] = useState<Service | null>(null);
  const [selDate, setSelDate]       = useState<Date | null>(null);
  const [selTime, setSelTime]       = useState('');
  const [form, setForm] = useState({ client_name:'', client_phone:'', client_email:'', notes:'' });

  const days = getNextDays(14);

  const [loggedResolved, setLoggedResolved] = useState(false);

  // Efecto 1: resolver primero si hay un barbero logueado
  useEffect(() => {
    if (!tenant) return;
    if (getToken(tenant)) {
      apiGetMe(tenant)
        .then(me => { setLoggedBarberId(me.id); setLoggedResolved(true); })
        .catch(() => { setLoggedBarberId(null); setLoggedResolved(true); });
    } else {
      setLoggedBarberId(null);
      setLoggedResolved(true);
    }
  }, [tenant]);

  // Efecto 2: cargar barberos solo cuando ya se resolvió el ID del logueado
  useEffect(() => {
    if (!tenant || !loggedResolved) return;
    apiGetBarbers(tenant).then((bs: Barber[]) => {
      // Filtrar al barbero logueado — no puede reservar consigo mismo
      const available = bs.filter((b: Barber) => b.id !== loggedBarberId);
      setBarbers(available);
      if (preBarber) {
        const found = available.find((b: Barber) => b.id === preBarber);
        if (found) { setSelBarber(found); setStep(2); }
      }
    });
  }, [tenant, preBarber, loggedBarberId, loggedResolved]);

  useEffect(() => {
    if (selBarber) apiGetServices(tenant, selBarber.id).then(setServices);
  }, [selBarber, tenant]);

  useEffect(() => {
    if (selBarber && selDate) {
      apiAvailability(tenant, selBarber.id, selDate.toISOString().split('T')[0])
        .then(d => setSlots(d.available));
    }
  }, [selBarber, selDate, tenant]);

  const handleBook = async () => {
    if (!selBarber || !selService || !selDate || !selTime) return;
    if (!form.client_name || !form.client_phone) { setError('Nombre y teléfono requeridos'); return; }
    // Double-check: prevent booking own slot
    if (selBarber.id === loggedBarberId) {
      setError('No puedes reservar una cita contigo mismo.');
      return;
    }
    setLoading(true); setError('');
    try {
      await apiBook(tenant, {
        barber_id: selBarber.id, service_id: selService.id,
        date: selDate.toISOString().split('T')[0], time: selTime, ...form,
      });
      setDone(true);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al reservar'); }
    finally { setLoading(false); }
  };

  const imgSrc = (img: string) => img?.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;

  if (done) return (
    <div className="min-h-screen flex items-center justify-center pt-20 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-8">
          <CheckCircle size={40} className="text-gold"/>
        </div>
        <h1 className="font-display text-5xl md:text-6xl text-gold mb-3">¡LISTO!</h1>
        <p className="font-display text-2xl md:text-3xl text-cream mb-8">CITA RESERVADA</p>
        <div className="card p-6 text-left space-y-3 mb-8">
          {[
            ['Barbero',  selBarber?.full_name ?? ''],
            ['Servicio', selService?.name ?? ''],
            ['Precio',   fmtP(selService?.price ?? 0)],
            ['Fecha',    selDate?.toLocaleDateString('es-CL', {weekday:'long',day:'numeric',month:'long'}) ?? ''],
            ['Hora',     selTime],
            ['Cliente',  form.client_name],
            ['Teléfono', form.client_phone],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between gap-4">
              <span className="font-mono text-[10px] text-ink-600 tracking-widest uppercase flex-shrink-0">{l}</span>
              <span className="font-body text-cream text-right">{v}</span>
            </div>
          ))}
        </div>
        <Link href={`/${tenant}`} className="btn-gold block">VOLVER AL INICIO</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-20 pb-20">
      {/* Header */}
      <div className="bg-ink-50 border-b border-ink-400 py-8 px-4 noise">
        <div className="max-w-4xl mx-auto">
          <Link href={`/${tenant}`} className="font-mono text-[11px] text-ink-700 tracking-widest uppercase hover:text-gold transition-colors flex items-center gap-2 mb-3">
            ← Volver
          </Link>
          <h1 className="font-display text-4xl md:text-6xl text-cream">RESERVAR CITA</h1>
        </div>
      </div>

      {/* Logged-in barber notice */}
      {loggedBarberId && (
        <div className="bg-gold/8 border-b border-gold/20 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <AlertTriangle size={14} className="text-gold flex-shrink-0" />
            <p className="font-mono text-[11px] text-gold tracking-widest">
              ESTÁS LOGUEADO COMO BARBERO — Solo puedes reservar con otros barberos del equipo
            </p>
          </div>
        </div>
      )}

      {/* Steps indicator */}
      <div className="bg-ink-100 border-b border-ink-400 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-1 md:gap-2">
          {[{n:1,l:'Barbero'},{n:2,l:'Servicio'},{n:3,l:'Fecha & Hora'},{n:4,l:'Tus datos'}].map(({n,l},i,arr) => (
            <div key={n} className="flex items-center gap-1 md:gap-2">
              <div className={`flex items-center gap-1 md:gap-2 cursor-pointer ${step>=n?'text-gold':'text-ink-600'}`}
                onClick={() => step > n && setStep(n)}>
                <div className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center font-mono text-xs border flex-shrink-0
                  ${step>n?'bg-gold text-ink border-gold':step===n?'border-gold text-gold':'border-ink-500 text-ink-600'}`}>
                  {step > n ? '✓' : n}
                </div>
                <span className="font-mono text-[10px] tracking-widest uppercase hidden sm:block">{l}</span>
              </div>
              {i < arr.length-1 && <ChevronRight size={10} className="text-ink-600 flex-shrink-0"/>}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* STEP 1 — Choose barber */}
        {step === 1 && (
          <div className="stagger">
            <h2 className="section-title text-3xl md:text-4xl mb-6">ELIGE TU BARBERO</h2>
            {barbers.length === 0 ? (
              <div className="card p-12 text-center">
                <Scissors size={36} className="text-ink-500 mx-auto mb-4 rotate-180"/>
                <p className="font-display text-2xl text-ink-600 tracking-widest">SIN BARBEROS DISPONIBLES</p>
                <p className="font-mono text-sm text-ink-600 mt-2">No hay otros barberos en esta barbería aún</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {barbers.map(b => (
                  <button key={b.id} onClick={() => { setSelBarber(b); setStep(2); }}
                    className="card p-0 text-left group hover:border-gold/60 transition-all hover:-translate-y-0.5 duration-200">
                    <div className="h-32 md:h-36 bg-ink-300 overflow-hidden relative">
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
            )}
          </div>
        )}

        {/* STEP 2 — Choose service */}
        {step === 2 && selBarber && (
          <div className="stagger">
            <h2 className="section-title text-3xl md:text-4xl mb-2">ELIGE TU SERVICIO</h2>
            <p className="font-mono text-[11px] text-ink-700 tracking-widest uppercase mb-6">Con {selBarber.full_name}</p>
            <div className="space-y-3">
              {services.map(s => (
                <button key={s.id} onClick={() => { setSelService(s); setStep(3); }}
                  className={`w-full card p-4 md:p-5 flex items-center justify-between text-left group hover:border-gold/60 transition-all ${selService?.id===s.id?'border-gold':''}`}>
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-gold/10 flex items-center justify-center border border-gold/20 group-hover:bg-gold/20 transition-colors flex-shrink-0">
                      <Scissors size={14} className="text-gold rotate-180"/>
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-lg md:text-xl text-cream">{s.name}</div>
                      {s.description && <div className="font-mono text-[10px] text-ink-700 tracking-wider mt-0.5 truncate">{s.description}</div>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="font-display text-xl md:text-2xl text-gold">{fmtP(s.price)}</div>
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

        {/* STEP 3 — Date & Time */}
        {step === 3 && (
          <div className="stagger">
            <h2 className="section-title text-3xl md:text-4xl mb-6">FECHA & HORA</h2>
            <div className="mb-8">
              <label className="label">Selecciona el día</label>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {days.map(d => {
                  const isSel = selDate?.toDateString() === d.toDateString();
                  return (
                    <button key={d.toISOString()} onClick={() => { setSelDate(d); setSelTime(''); }}
                      className={`flex-shrink-0 w-14 md:w-16 py-3 flex flex-col items-center border transition-all
                        ${isSel ? 'bg-gold border-gold text-ink' : 'bg-ink-200 border-ink-400 text-cream hover:border-gold/60'}`}>
                      <span className={`font-mono text-[9px] md:text-[10px] tracking-widest ${isSel?'text-ink':'text-ink-700'}`}>{DAY_NAMES[d.getDay()]}</span>
                      <span className="font-display text-xl md:text-2xl leading-tight">{d.getDate()}</span>
                      <span className={`font-mono text-[8px] md:text-[9px] ${isSel?'text-ink':'text-ink-600'}`}>{MONTH_NAMES[d.getMonth()]}</span>
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
                  : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map(t => (
                        <button key={t} onClick={() => setSelTime(t)}
                          className={`px-3 md:px-4 py-2 border font-mono text-sm tracking-widest transition-all
                            ${selTime===t ? 'bg-gold border-gold text-ink font-bold' : 'bg-ink-200 border-ink-400 text-cream hover:border-gold/60'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
            <div className="flex gap-4 mt-8">
              <button onClick={() => setStep(2)} className="btn-ghost">← Atrás</button>
              <button onClick={() => setStep(4)} disabled={!selDate || !selTime} className="btn-gold">Continuar →</button>
            </div>
          </div>
        )}

        {/* STEP 4 — Client data */}
        {step === 4 && (
          <div className="stagger">
            <h2 className="section-title text-3xl md:text-4xl mb-6">TUS DATOS</h2>
            {/* Summary */}
            <div className="card p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Barbero',  selBarber?.full_name],
                ['Servicio', selService?.name],
                ['Fecha',    selDate?.toLocaleDateString('es-CL', {day:'numeric', month:'short'})],
                ['Hora',     selTime],
              ].map(([l, v]) => (
                <div key={l}>
                  <div className="font-mono text-[9px] text-ink-600 tracking-[.3em] uppercase">{l}</div>
                  <div className="font-display text-base md:text-lg text-gold mt-1 truncate">{v}</div>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
              <div>
                <label className="label flex items-center gap-2"><User size={12}/> Nombre *</label>
                <input className="input-field" value={form.client_name} placeholder="Tu nombre"
                  onChange={e => setForm({...form, client_name: e.target.value})}/>
              </div>
              <div>
                <label className="label flex items-center gap-2"><Phone size={12}/> Teléfono *</label>
                <input className="input-field" value={form.client_phone} placeholder="9 XXXX XXXX"
                  onChange={e => setForm({...form, client_phone: e.target.value})}/>
              </div>
              <div>
                <label className="label flex items-center gap-2"><Mail size={12}/> Email</label>
                <input className="input-field" type="email" value={form.client_email} placeholder="opcional"
                  onChange={e => setForm({...form, client_email: e.target.value})}/>
              </div>
              <div>
                <label className="label flex items-center gap-2"><FileText size={12}/> Notas</label>
                <input className="input-field" value={form.notes} placeholder="Ej: quiero fade bajo"
                  onChange={e => setForm({...form, notes: e.target.value})}/>
              </div>
            </div>
            {error && (
              <p className="font-mono text-xs text-rap-red tracking-widest mt-4 bg-rap-red/10 border border-rap-red/30 px-4 py-3">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-4 mt-8 items-center">
              <button onClick={() => setStep(3)} className="btn-ghost">← Atrás</button>
              <button onClick={handleBook}
                disabled={loading || !form.client_name || !form.client_phone}
                className="btn-gold text-lg md:text-xl px-8 md:px-12">
                {loading ? 'Reservando...' : `CONFIRMAR · ${fmtP(selService?.price ?? 0)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BookContent />
    </Suspense>
  );
}
