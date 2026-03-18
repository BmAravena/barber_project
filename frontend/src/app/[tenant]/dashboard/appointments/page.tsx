'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiMyAppointments, apiUpdateStatus } from '@/lib/api';
import type { Appointment } from '@/types';
import { CalendarDays, Phone, FileText, ChevronDown } from 'lucide-react';

const fmtP = (n: number) => `$${n.toLocaleString('es-CL')}`;
const STATUSES = [
  { val:'all', label:'Todas' },{ val:'pending', label:'Pendientes' },
  { val:'confirmed', label:'Confirmadas' },{ val:'completed', label:'Completadas' },
  { val:'cancelled', label:'Canceladas' },
];
const STATUS_LABELS: Record<string, string> = {
  pending:'Pendiente', confirmed:'Confirmada', completed:'Completada', cancelled:'Cancelada',
};

export default function AppointmentsPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    apiMyAppointments(tenant).then(setAppts).finally(() => setLoading(false));
  }, [tenant]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiUpdateStatus(tenant, id, status);
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status: status as Appointment['status'] } : a));
    } catch {}
  };

  const filtered = filter === 'all' ? appts : appts.filter(a => a.status === filter);
  const revenue = appts.filter(a => ['confirmed','completed'].includes(a.status)).reduce((s, a) => s + a.service_price, 0);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="mb-8">
        <p className="font-mono text-[11px] text-gold tracking-[.4em] uppercase mb-2">Gestión</p>
        <h1 className="font-display text-4xl md:text-6xl text-cream">MIS CITAS</h1>
        <div className="h-px w-24 bg-gold mt-3" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label:'Total', val: appts.length, color:'text-cream' },
          { label:'Pendientes', val: appts.filter(a=>a.status==='pending').length, color:'text-yellow-400' },
          { label:'Confirmadas', val: appts.filter(a=>a.status==='confirmed').length, color:'text-rap-green' },
          { label:'Ingresos', val: fmtP(revenue), color:'text-gold' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`font-display text-3xl ${s.color}`}>{s.val}</div>
            <div className="font-mono text-[9px] text-ink-600 tracking-[.25em] uppercase mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUSES.map(s => (
          <button key={s.val} onClick={() => setFilter(s.val)}
            className={`font-mono text-[11px] tracking-widest uppercase px-4 py-2 border transition-all duration-150
              ${filter === s.val ? 'bg-gold border-gold text-ink' : 'bg-ink-200 border-ink-400 text-ink-700 hover:border-gold/50 hover:text-cream'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <CalendarDays size={36} className="text-ink-500 mx-auto mb-4" />
          <p className="font-display text-3xl text-ink-600 tracking-widest">SIN CITAS</p>
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {filtered.map(a => (
            <div key={a.id} className="card p-5 hover:border-gold/30 transition-colors">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="w-13 h-13 bg-gold/10 border border-gold/20 flex flex-col items-center justify-center flex-shrink-0 w-12 h-12">
                    <span className="font-display text-xl text-gold leading-none">{new Date(a.date+'T12:00:00').getDate()}</span>
                    <span className="font-mono text-[8px] text-gold/70 tracking-widest">{new Date(a.date+'T12:00:00').toLocaleDateString('es-CL',{month:'short'}).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-display text-2xl text-cream">{a.client_name}</span>
                      <span className={`badge badge-${a.status}`}>{STATUS_LABELS[a.status]}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="font-mono text-[11px] text-ink-700 tracking-widest flex items-center gap-1"><CalendarDays size={10}/>{a.date} · {a.time}</span>
                      <span className="font-mono text-[11px] text-ink-700 tracking-widest">✂ {a.service_name} · <span className="text-gold">{fmtP(a.service_price)}</span></span>
                      <span className="font-mono text-[11px] text-ink-700 tracking-widest flex items-center gap-1"><Phone size={10}/>{a.client_phone}</span>
                      {a.notes && <span className="font-mono text-[11px] text-ink-700 tracking-widest flex items-center gap-1"><FileText size={10}/>{a.notes}</span>}
                    </div>
                  </div>
                </div>
                <div className="relative flex-shrink-0">
                  <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
                    className="appearance-none bg-ink-300 border border-ink-500 text-cream font-mono text-[11px] tracking-widest uppercase px-4 py-2 pr-8 outline-none focus:border-gold cursor-pointer hover:border-gold/60 transition-colors">
                    <option value="pending">Pendiente</option>
                    <option value="confirmed">Confirmar</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelar</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-600 pointer-events-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
