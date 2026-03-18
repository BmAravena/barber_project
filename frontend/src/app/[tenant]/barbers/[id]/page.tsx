'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiGetBarber, apiGetServices, apiGetPortfolio } from '@/lib/api';
import type { Barber, Service, PortfolioItem } from '@/types';
import { Scissors, ArrowLeft, Clock, Instagram } from 'lucide-react';

const fmtP = (n: number) => `$${n.toLocaleString('es-CL')}`;

export default function BarberProfilePage() {
  const { tenant, id } = useParams<{ tenant: string; id: string }>();
  const [barber, setBarber] = useState<Barber | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant || !id) return;
    Promise.all([apiGetBarber(tenant, id), apiGetServices(tenant, id), apiGetPortfolio(tenant, id)])
      .then(([b, s, p]) => { setBarber(b); setServices(s); setPortfolio(p); })
      .finally(() => setLoading(false));
  }, [tenant, id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin"/></div>;
  if (!barber) return <div className="min-h-screen flex items-center justify-center"><p className="font-display text-4xl text-ink-600">NO ENCONTRADO</p></div>;

  const imgSrc = (img: string) => img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <div className="relative h-64 bg-ink-100 overflow-hidden">
        {barber.avatar && <img src={imgSrc(barber.avatar)} className="w-full h-full object-cover opacity-25" alt=""/>}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-transparent"/>
        <div className="absolute bottom-6 left-0 right-0 px-4 max-w-7xl mx-auto">
          <Link href={`/${tenant}/barbers`} className="flex items-center gap-2 font-mono text-[11px] text-ink-700 tracking-widest uppercase mb-4 hover:text-gold transition-colors">
            <ArrowLeft size={12}/> Todos los barberos
          </Link>
          <div className="flex items-end gap-5">
            <div className="w-20 h-20 border-2 border-gold overflow-hidden bg-ink-300 flex-shrink-0">
              {barber.avatar ? <img src={imgSrc(barber.avatar)} className="w-full h-full object-cover" alt={barber.full_name}/> : <div className="w-full h-full flex items-center justify-center"><Scissors size={28} className="text-gold/50 rotate-180"/></div>}
            </div>
            <div>
              <p className="font-mono text-[10px] text-gold tracking-[.4em] uppercase mb-1">@{barber.username}</p>
              <h1 className="font-display text-5xl text-cream leading-none">{barber.full_name}</h1>
              {barber.specialty && <p className="font-mono text-xs text-gold/80 tracking-[.2em] uppercase mt-1">{barber.specialty}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {barber.bio && (
              <div>
                <h2 className="section-title text-3xl mb-3">SOBRE MÍ</h2>
                <div className="gold-line mb-5"/>
                <p className="text-ink-800 leading-relaxed text-lg">{barber.bio}</p>
              </div>
            )}

            <div>
              <h2 className="section-title text-3xl mb-3">SERVICIOS</h2>
              <div className="gold-line mb-5"/>
              {services.length === 0 ? <p className="text-ink-600 font-mono text-sm">Sin servicios</p> : (
                <div className="space-y-3">
                  {services.map(s => (
                    <div key={s.id} className="card p-5 flex items-center justify-between hover:border-gold/40 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gold/10 flex items-center justify-center border border-gold/20"><Scissors size={16} className="text-gold rotate-180"/></div>
                        <div>
                          <div className="font-display text-xl text-cream">{s.name}</div>
                          {s.description && <div className="font-mono text-[11px] text-ink-700 tracking-wider mt-0.5">{s.description}</div>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-6">
                        <div className="font-display text-2xl text-gold">{fmtP(s.price)}</div>
                        <div className="flex items-center gap-1 justify-end text-ink-600 mt-1"><Clock size={10}/><span className="font-mono text-[10px] tracking-widest">{s.duration} MIN</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {portfolio.length > 0 && (
              <div>
                <h2 className="section-title text-3xl mb-3">PORTAFOLIO</h2>
                <div className="gold-line mb-5"/>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {portfolio.map(item => (
                    <div key={item.id} className="relative aspect-square overflow-hidden bg-ink-300 border border-ink-400 hover:border-gold/40 transition-colors group">
                      <img src={imgSrc(item.image)} alt={item.caption||''} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                      {item.caption && (
                        <div className="absolute inset-0 bg-ink/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                          <span className="font-mono text-[10px] text-gold tracking-widest">{item.caption}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky booking CTA */}
          <div className="lg:col-span-1">
            <div className="sticky top-28">
              <div className="card p-8 animate-pulse-gold">
                <h3 className="font-display text-3xl text-gold mb-2">RESERVAR</h3>
                <div className="gold-line mb-5"/>
                <p className="font-mono text-[11px] text-ink-700 tracking-widest uppercase mb-8">Con {barber.full_name.split(' ')[0]}</p>
                <Link href={`/${tenant}/book?barber=${barber.id}`} className="btn-gold w-full text-center block text-xl">AGENDAR CITA →</Link>
                {barber.instagram && (
                  <div className="mt-5 flex items-center gap-3 text-ink-700 hover:text-gold transition-colors cursor-pointer">
                    <Instagram size={15}/>
                    <span className="font-mono text-[11px] tracking-widest">@{barber.instagram}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
