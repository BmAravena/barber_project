'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DemoBanner from '@/components/DemoBanner';
import { apiGetBarbers, apiTenantInfo } from '@/lib/api';
import { Scissors } from 'lucide-react';
import type { Barber, Tenant } from '@/types';

const SLUG = 'demo-barber';

export default function DemoBarbersPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [info, setInfo] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiGetBarbers(SLUG), apiTenantInfo(SLUG)])
      .then(([b, t]) => { setBarbers(b); setInfo(t); })
      .catch(e => setError('El servidor demo no está disponible. Asegúrate de haber ejecutado seed_demo.py y que el backend esté corriendo.'))
      .finally(() => setLoading(false));
  }, []);

  const imgSrc = (img: string) => img?.startsWith('data:') ? img : `data:image/svg+xml;base64,${img}`;

  return (
    <div className="min-h-screen">
      <DemoBanner />

      {/* Navbar */}
      <nav className="bg-ink/95 border-b border-ink-400">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/demo-barber" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gold flex items-center justify-center animate-pulse-gold">
              <Scissors size={16} className="text-ink rotate-180" />
            </div>
            <div>
              <div className="font-display text-xl text-cream">{info?.name?.toUpperCase() ?? 'HOMIE DEMO'}</div>
              <div className="font-mono text-[8px] text-ink-700 tracking-[.35em]">BARBER SHOP · DEMO</div>
            </div>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/demo-barber/barbers" className="nav-link text-base">Barberos</Link>
            <Link href="/demo-barber/book" className="btn-gold text-base py-2 px-6 shimmer">Reservar →</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="relative py-16 px-4 bg-ink-50 border-b border-ink-400 noise overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(255,215,0,0.06) 0%, transparent 60%)' }} />
        <div className="max-w-7xl mx-auto relative z-10">
          <p className="font-mono text-xs text-gold tracking-[.4em] uppercase mb-3">El equipo</p>
          <h1 className="font-display text-8xl text-cream leading-none">NUESTROS<br/>BARBEROS</h1>
          <div className="gold-line mt-5 max-w-xs" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-14">
        {error ? (
          <div className="card p-8 border-rap-red/40">
            <p className="font-display text-2xl text-rap-red mb-3 tracking-wide">DEMO NO DISPONIBLE</p>
            <p className="font-mono text-sm text-ink-700 tracking-wider leading-relaxed">{error}</p>
            <div className="mt-5 bg-ink-300 border border-ink-500 p-4">
              <p className="font-mono text-xs text-gold tracking-widest mb-2">PARA ACTIVAR EL DEMO:</p>
              <code className="font-mono text-sm text-cream">cd backend && python seed_demo.py</code>
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map(i => <div key={i} className="card h-80 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger">
            {barbers.map(b => (
              <Link key={b.id} href={`/demo-barber/barbers/${b.id}`} className="group block">
                <div className="card p-0 overflow-hidden hover:border-gold/60 transition-all duration-300 hover:-translate-y-1">
                  <div className="h-56 bg-ink-300 relative overflow-hidden">
                    {b.avatar ? (
                      <img src={imgSrc(b.avatar)} alt={b.full_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Scissors size={48} className="text-gold/20 rotate-180" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-200/90 to-transparent" />
                    <div className="absolute bottom-3 left-4">
                      <span className="font-mono text-[10px] tracking-widest text-gold bg-ink/80 px-2 py-1">@{b.username}</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="font-display text-2xl text-cream tracking-wide">{b.full_name}</div>
                    {b.specialty && <div className="font-mono text-[10px] text-gold tracking-widest mt-1">{b.specialty}</div>}
                    {b.bio && <p className="text-ink-700 text-sm mt-3 line-clamp-2 leading-relaxed">{b.bio}</p>}
                    <div className="font-display text-base text-gold mt-4 tracking-wider group-hover:tracking-[.2em] transition-all">
                      VER PERFIL →
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        {!error && !loading && (
          <div className="mt-16 text-center">
            <div className="gold-line max-w-xs mx-auto mb-10" />
            <p className="font-mono text-sm text-ink-700 tracking-widest uppercase mb-6">
              ¿Te gusta lo que ves? Crea tu propia barbería gratis
            </p>
            <Link href="/onboarding" className="btn-gold text-xl px-12 py-4 shimmer">
              REGISTRAR MI BARBERÍA →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
