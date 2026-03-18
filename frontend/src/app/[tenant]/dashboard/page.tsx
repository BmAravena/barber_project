'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiMyAppointments, apiTenantInfo } from '@/lib/api';
import type { Appointment, Tenant } from '@/types';
import { CalendarDays, CheckCircle, Clock, TrendingUp } from 'lucide-react';

const fmtP = (n: number) => `$${n.toLocaleString('es-CL')}`;
const STATUS: Record<string, string> = { pending:'Pendiente', confirmed:'Confirmada', completed:'Completada', cancelled:'Cancelada' };

export default function DashboardPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [info, setInfo] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!tenant) return;
    apiMyAppointments(tenant).then(setAppts).catch(() => {});
    apiTenantInfo(tenant).then(setInfo).catch(() => {});
  }, [tenant]);

  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appts.filter(a => a.date === today);
  const pending = appts.filter(a => a.status === 'pending');
  const revenue = appts.filter(a => ['confirmed','completed'].includes(a.status)).reduce((s, a) => s + a.service_price, 0);
  const upcoming = appts.filter(a => a.date >= today && a.status !== 'cancelled')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 6);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="mb-8">
        <p className="font-mono text-[11px] text-gold tracking-[.4em] uppercase mb-2">{info?.name || tenant}</p>
        <h1 className="font-display text-4xl md:text-6xl text-cream">RESUMEN</h1>
        <div className="h-px w-24 bg-gold mt-3" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 stagger">
        {[
          { label:'Hoy', val: todayAppts.length, icon: CalendarDays, color:'text-gold' },
          { label:'Pendientes', val: pending.length, icon: Clock, color:'text-yellow-400' },
          { label:'Confirmadas', val: appts.filter(a=>a.status==='confirmed').length, icon: CheckCircle, color:'text-rap-green' },
          { label:'Ingresos', val: fmtP(revenue), icon: TrendingUp, color:'text-gold' },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <Icon size={18} className={color} />
              <span className="font-mono text-[9px] text-ink-600 tracking-[.3em] uppercase">{label}</span>
            </div>
            <div className={`font-display text-4xl ${color} leading-none`}>{val}</div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-3xl text-gold tracking-wider mb-4">PRÓXIMAS CITAS</h2>
      <div className="gold-line mb-6" />

      {upcoming.length === 0 ? (
        <div className="card p-16 text-center">
          <CalendarDays size={36} className="text-ink-500 mx-auto mb-4" />
          <p className="font-display text-3xl text-ink-600 tracking-widest">SIN CITAS PRÓXIMAS</p>
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {upcoming.map(a => (
            <div key={a.id} className="card p-4 flex items-center justify-between hover:border-gold/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gold/10 border border-gold/20 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="font-display text-xl text-gold leading-none">{new Date(a.date+'T12:00:00').getDate()}</span>
                  <span className="font-mono text-[8px] text-gold/70 tracking-widest">{new Date(a.date+'T12:00:00').toLocaleDateString('es-CL',{month:'short'}).toUpperCase()}</span>
                </div>
                <div>
                  <div className="font-display text-xl text-cream">{a.client_name}</div>
                  <div className="flex gap-3 mt-0.5 flex-wrap">
                    <span className="font-mono text-[10px] text-ink-700 tracking-widest">{a.time}</span>
                    <span className="font-mono text-[10px] text-ink-700 tracking-widest">✂ {a.service_name}</span>
                    <span className="font-mono text-[10px] text-gold tracking-widest">{fmtP(a.service_price)}</span>
                  </div>
                </div>
              </div>
              <span className={`badge badge-${a.status}`}>{STATUS[a.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
