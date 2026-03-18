'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiTenantInfo, apiGetBarbers, getToken } from '@/lib/api';
import { Scissors, MapPin, Phone, Clock, LayoutDashboard, ExternalLink } from 'lucide-react';
import type { Tenant, Barber } from '@/types';

function GoogleMapEmbed({ address, city, name }: { address: string; city?: string; name: string }) {
  const query = encodeURIComponent([address, city, 'Chile'].filter(Boolean).join(', '));
  const embedUrl = `https://maps.google.com/maps?q=${query}&output=embed&hl=es&z=16`;
  const mapsUrl  = `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <div className="relative w-full h-full">
      <iframe
        title={`Ubicación de ${name}`}
        src={embedUrl}
        className="w-full h-full border-0 grayscale contrast-125 opacity-90"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/90 to-transparent p-4 pointer-events-none" />
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 right-4 flex items-center gap-2 bg-gold text-ink font-mono text-[10px] tracking-[.3em] uppercase px-3 py-2 hover:bg-gold/90 transition-colors"
      >
        <ExternalLink size={11} />
        Abrir en Maps
      </a>
    </div>
  );
}

export default function TenantPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [info, setInfo] = useState<Tenant | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setIsLoggedIn(!!getToken(tenant));
    Promise.all([apiTenantInfo(tenant), apiGetBarbers(tenant)])
      .then(([t, b]) => { setInfo(t); setBarbers(b); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenant]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="font-display text-5xl text-rap-red mb-4">BARBERÍA NO ENCONTRADA</p>
        <p className="font-mono text-ink-700 tracking-widest">{error}</p>
        <Link href="/" className="btn-gold mt-8 inline-block">VOLVER AL INICIO</Link>
      </div>
    </div>
  );

  const hasLocation = !!(info?.address || info?.city);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/95 backdrop-blur-sm border-b border-ink-400">
        <div className="bg-gold h-7 overflow-hidden flex items-center">
          <div className="animate-marquee whitespace-nowrap flex gap-16">
            {Array(4).fill([`✂ ${info?.name}`, `📍 ${info?.city || 'Chile'}`, `📞 ${info?.phone || ''}`, '⬡ Reserva Tu Cita Online ⬡']).flat().map((t, i) => (
              <span key={i} className="font-mono text-[11px] tracking-[.3em] text-ink uppercase mx-8">{t}</span>
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${tenant}`} className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gold flex items-center justify-center animate-pulse-gold">
              <Scissors size={16} className="text-ink rotate-180" />
            </div>
            <div>
              <div className="font-display text-xl text-cream">{info?.name?.toUpperCase()}</div>
              <div className="font-mono text-[8px] text-ink-700 tracking-[.35em]">BARBER SHOP</div>
            </div>
          </Link>
          <div className="flex items-center gap-3 md:gap-6">
            <Link href={`/${tenant}/barbers`} className="nav-link text-sm md:text-base hidden sm:block">Barberos</Link>
            <Link href={`/${tenant}/book`} className="btn-gold text-sm md:text-base py-2 px-4 md:px-6 shimmer">Reservar →</Link>
            {isLoggedIn ? (
              <Link href={`/${tenant}/dashboard`} className="hidden sm:flex items-center gap-2 font-display text-base text-gold tracking-wider hover:text-gold-light transition-colors">
                <LayoutDashboard size={15} />
                Dashboard
              </Link>
            ) : (
              <Link href={`/${tenant}/auth/login`} className="btn-ghost text-sm hidden sm:block">Barberos ↗</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 noise overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink to-ink-50" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display text-[18vw] text-gold/[.025] leading-none whitespace-nowrap truncate px-4">
            {info?.name?.toUpperCase()}
          </span>
        </div>
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto stagger">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px w-16 bg-gold" />
            <span className="font-mono text-[11px] text-gold tracking-[.4em] uppercase">{info?.city || 'Chile'} · Hip Hop Culture</span>
            <div className="h-px w-16 bg-gold" />
          </div>
          <h1 className="font-display leading-none mb-4">
            <span className="block text-[12vw] md:text-[100px] text-cream">{info?.name?.split(' ')[0]?.toUpperCase()}</span>
            <span className="block text-[6vw] md:text-[52px] text-gold tracking-[.15em]">BARBER SHOP</span>
          </h1>
          <p className="font-mono text-sm text-ink-700 tracking-[.3em] uppercase mb-12">
            ✦ Cortes Que Hablan Por Ti · Reserva Online ✦
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${tenant}/book`} className="btn-gold text-xl px-12 py-4 shimmer">RESERVAR CITA</Link>
            <Link href={`/${tenant}/barbers`} className="btn-outline text-xl px-12 py-4">VER BARBEROS</Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-14 text-ink-700">
            {info?.address && <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase"><MapPin size={12} className="text-gold" />{info.address}</span>}
            {info?.phone   && <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase"><Phone size={12} className="text-gold" />{info.phone}</span>}
            <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase"><Clock size={12} className="text-gold" />Lun–Sáb · 9:00–20:00</span>
          </div>
        </div>
      </section>

      {/* Barbers preview */}
      {barbers.length > 0 && (
        <section className="py-24 px-4 bg-ink-50">
          <div className="max-w-7xl mx-auto">
            <p className="font-mono text-xs text-gold tracking-[.4em] uppercase mb-3">El equipo</p>
            <h2 className="section-title text-5xl mb-12">NUESTROS BARBEROS</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger">
              {barbers.slice(0, 3).map(b => (
                <Link key={b.id} href={`/${tenant}/barbers/${b.id}`} className="group block">
                  <div className="card p-0 overflow-hidden hover:border-gold/60 transition-all duration-300 hover:-translate-y-1">
                    <div className="h-48 bg-ink-300 relative overflow-hidden">
                      {b.avatar
                        ? <img src={b.avatar.startsWith('data:') ? b.avatar : `data:image/jpeg;base64,${b.avatar}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={b.full_name} />
                        : <div className="w-full h-full flex items-center justify-center"><Scissors size={40} className="text-gold/20 rotate-180" /></div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-200/80 to-transparent" />
                    </div>
                    <div className="p-5">
                      <div className="font-display text-2xl text-cream tracking-wide">{b.full_name}</div>
                      {b.specialty && <div className="font-mono text-[10px] text-gold tracking-widest mt-1">{b.specialty}</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link href={`/${tenant}/barbers`} className="btn-outline">VER TODOS LOS BARBEROS</Link>
            </div>
          </div>
        </section>
      )}

      {/* ── UBICACIÓN ────────────────────────────────────────────────────────── */}
      {hasLocation && (
        <section className="py-24 px-4 bg-ink">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-0 border border-ink-400">

              {/* Info panel */}
              <div className="bg-ink-200 p-10 flex flex-col justify-center">
                <p className="font-mono text-[10px] text-gold tracking-[.4em] uppercase mb-3">Dónde encontrarnos</p>
                <h2 className="font-display text-5xl text-cream tracking-wider mb-2">UBICACIÓN</h2>
                <div className="h-px w-16 bg-gold mb-8" />

                <div className="space-y-5">
                  {info?.address && (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin size={14} className="text-gold" />
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-ink-600 tracking-[.3em] uppercase mb-1">Dirección</p>
                        <p className="font-display text-xl text-cream">{info.address}</p>
                        {info?.city && <p className="font-mono text-[11px] text-gold tracking-widest mt-0.5">{info.city}</p>}
                      </div>
                    </div>
                  )}

                  {info?.phone && (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Phone size={14} className="text-gold" />
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-ink-600 tracking-[.3em] uppercase mb-1">Teléfono</p>
                        <a href={`tel:${info.phone}`} className="font-display text-xl text-cream hover:text-gold transition-colors">
                          {info.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock size={14} className="text-gold" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] text-ink-600 tracking-[.3em] uppercase mb-1">Horario</p>
                      <p className="font-display text-xl text-cream">Lun – Sáb</p>
                      <p className="font-mono text-[11px] text-gold tracking-widest mt-0.5">9:00 – 20:00</p>
                    </div>
                  </div>
                </div>

                <div className="mt-10">
                  <Link href={`/${tenant}/book`} className="btn-gold shimmer">
                    RESERVAR CITA →
                  </Link>
                </div>
              </div>

              {/* Mapa */}
              <div className="h-80 md:h-auto min-h-[360px] relative overflow-hidden border-l border-ink-400">
                <GoogleMapEmbed
                  address={info?.address || ''}
                  city={info?.city}
                  name={info?.name || ''}
                />
              </div>

            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-ink-400 py-8 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="font-display text-xl text-cream">{info?.name?.toUpperCase()}</div>
          <div className="font-mono text-[10px] text-ink-600 tracking-widest">POWERED BY HOMIE SAAS · HIP HOP CULTURE</div>
          <Link href={`/${tenant}/auth/login`} className="font-mono text-[11px] text-gold tracking-widest hover:underline">Acceso Barberos →</Link>
        </div>
      </footer>
    </div>
  );
}
