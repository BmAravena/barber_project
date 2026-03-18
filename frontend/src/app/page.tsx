'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Scissors, Store, Users, CalendarCheck, Shield, TrendingUp,
  LogIn, X, AlertCircle, Search, MapPin, ChevronRight,
  Navigation, Loader2, AlertTriangle
} from 'lucide-react';
import { apiLogin, setToken, apiSearch, apiSearchNearby } from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// ── Quick Login Modal ──────────────────────────────────────────────────────
function QuickLoginModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const slugRef = useRef<HTMLInputElement>(null);

  useEffect(() => { slugRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handle = async () => {
    if (!slug || !username || !password) { setError('Completa todos los campos'); return; }
    setLoading(true); setError('');
    try {
      const data = await apiLogin(slug.trim().toLowerCase(), { username, password });
      setToken(slug.trim().toLowerCase(), data.token);
      router.push(`/${slug.trim().toLowerCase()}/dashboard`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Credenciales incorrectas');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-ink-200 border border-ink-400 overflow-hidden">
        <div className="bg-gold h-1 w-full" />
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="font-mono text-[10px] text-ink-700 tracking-[.4em] uppercase mb-1">Acceso barberos</p>
              <h2 className="font-display text-4xl text-cream tracking-wider">MI BARBERÍA</h2>
            </div>
            <button onClick={onClose} className="text-ink-600 hover:text-cream transition-colors p-1 -mt-1">
              <X size={20} />
            </button>
          </div>
          <div className="gold-line mb-6" />
          <div className="space-y-4">
            <div>
              <label className="label">Nombre de tu barbería (slug)</label>
              <div className="flex items-center border border-ink-500 focus-within:border-gold focus-within:ring-1 focus-within:ring-gold bg-ink-300 transition-all">
                <span className="font-mono text-[11px] text-ink-600 pl-4 pr-1 whitespace-nowrap">homie.app/</span>
                <input ref={slugRef}
                  className="flex-1 bg-transparent text-cream font-body text-lg px-2 py-3 outline-none placeholder:text-ink-600"
                  placeholder="mi-barberia" value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
              </div>
            </div>
            <div>
              <label className="label">Usuario</label>
              <input className="input-field" placeholder="tu_usuario" value={username}
                onChange={e => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input-field" type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>
            {error && (
              <div className="flex items-center gap-2 bg-rap-red/10 border border-rap-red/30 px-4 py-3">
                <AlertCircle size={13} className="text-rap-red flex-shrink-0" />
                <p className="font-mono text-[11px] text-rap-red tracking-widest">{error}</p>
              </div>
            )}
            <button onClick={handle} disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2 text-xl py-4 mt-2">
              <LogIn size={18} />
              {loading ? 'Ingresando...' : 'ENTRAR AL DASHBOARD'}
            </button>
          </div>
          <p className="font-mono text-[10px] text-ink-600 tracking-widest text-center mt-5">
            ¿Aún no tienes barbería?{' '}
            <Link href="/onboarding" onClick={onClose} className="text-gold hover:underline">Regístrate gratis →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Result Card ────────────────────────────────────────────────────────────
function BarberCard({ b, onClick }: { b: any; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-ink-300 transition-colors border-b border-ink-400 last:border-0 text-left group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
          <Scissors size={14} className="text-gold rotate-180" />
        </div>
        <div>
          <div className="font-display text-xl text-cream group-hover:text-gold transition-colors">{b.name}</div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {b.city && (
              <span className="flex items-center gap-1">
                <MapPin size={9} className="text-ink-600" />
                <span className="font-mono text-[10px] text-ink-600 tracking-widest">{b.city}</span>
              </span>
            )}
            {b.distance_km !== undefined && (
              <span className="flex items-center gap-1">
                <Navigation size={9} className="text-gold" />
                <span className="font-mono text-[10px] text-gold tracking-widest">{fmtDist(b.distance_km)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <ChevronRight size={16} className="text-ink-600 group-hover:text-gold transition-colors flex-shrink-0" />
    </button>
  );
}

// ── GPS Barber Search ──────────────────────────────────────────────────────
type GeoState = 'idle' | 'locating' | 'located' | 'denied' | 'error';
const RADII = [5, 15, 50]; // km — radio dinámico

function BarberSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentRadius, setCurrentRadius] = useState(RADII[0]);
  const [nearbyCount, setNearbyCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Búsqueda por texto con debounce
  useEffect(() => {
    if (query.length === 0) {
      // Si hay coords activas, volver a mostrar cercanas
      if (coords) { searchNearby(coords.lat, coords.lng, RADII[0]); }
      else { setResults([]); setSearched(false); }
      return;
    }
    setSearched(true);
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiSearch(query);
        setResults(data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const searchNearby = useCallback(async (lat: number, lng: number, radius: number) => {
    setLoading(true); setSearched(true);
    try {
      const data = await apiSearchNearby(lat, lng, radius);
      if (data.count === 0 && radius < RADII[RADII.length - 1]) {
        // Expandir radio automáticamente
        const nextRadius = RADII[RADII.indexOf(radius) + 1] ?? radius;
        setCurrentRadius(nextRadius);
        await searchNearby(lat, lng, nextRadius);
        return;
      }
      setNearbyCount(data.count);
      setCurrentRadius(radius);
      setResults(data.results);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoState('error'); return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setGeoState('located');
        searchNearby(lat, lng, RADII[0]);
        inputRef.current?.focus();
      },
      () => { setGeoState('denied'); },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // Solicitar ubicación automáticamente al montar
  useEffect(() => { requestLocation(); }, []);

  return (
    <div className="w-full">
      {/* Estado GPS */}
      <div className="mb-3 min-h-[24px]">
        {geoState === 'locating' && (
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="text-gold animate-spin" />
            <span className="font-mono text-[10px] text-gold tracking-widest uppercase">Obteniendo ubicación...</span>
          </div>
        )}
        {geoState === 'located' && (
          <div className="flex items-center gap-2">
            <Navigation size={12} className="text-gold" />
            <span className="font-mono text-[10px] text-gold tracking-widest uppercase">
              {nearbyCount > 0
                ? `${nearbyCount} barbería${nearbyCount !== 1 ? 's' : ''} encontrada${nearbyCount !== 1 ? 's' : ''} en ${currentRadius}km`
                : `Sin barberías en ${currentRadius}km`}
            </span>
          </div>
        )}
        {geoState === 'denied' && (
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-ink-600" />
            <span className="font-mono text-[10px] text-ink-600 tracking-widest uppercase">
              Ubicación denegada — busca por nombre o ciudad
            </span>
          </div>
        )}
        {geoState === 'error' && (
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-ink-600" />
            <span className="font-mono text-[10px] text-ink-600 tracking-widest uppercase">GPS no disponible</span>
          </div>
        )}
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="flex items-center bg-ink-200 border-2 border-gold/60 focus-within:border-gold transition-all">
          <Search size={18} className="text-gold ml-4 flex-shrink-0" />
          <input ref={inputRef}
            className="flex-1 bg-transparent text-cream font-body text-lg px-4 py-4 outline-none placeholder:text-ink-600"
            placeholder={geoState === 'located' ? 'Filtrar por nombre...' : 'Busca por nombre o ciudad...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {loading
            ? <Loader2 size={16} className="text-gold animate-spin mr-4 flex-shrink-0" />
            : geoState === 'denied' || geoState === 'error'
              ? (
                <button onClick={requestLocation} title="Reintentar ubicación"
                  className="mr-3 p-1.5 hover:bg-gold/10 transition-colors border border-ink-500 hover:border-gold/40">
                  <Navigation size={14} className="text-ink-600 hover:text-gold" />
                </button>
              ) : null
          }
        </div>

        {/* Results */}
        {searched && (
          <div className="absolute top-full left-0 right-0 z-50 bg-ink-200 border border-ink-400 border-t-0 max-h-72 overflow-y-auto shadow-lg">
            {results.length === 0 && !loading ? (
              <div className="px-5 py-6 text-center space-y-3">
                <p className="font-mono text-[11px] text-ink-600 tracking-widest uppercase">
                  {query
                    ? `Sin resultados para "${query}"`
                    : `Sin barberías registradas en ${currentRadius}km`}
                </p>
                {!query && geoState === 'located' && (
                  <p className="font-mono text-[10px] text-ink-600 tracking-widest">
                    ¿Tu barbería favorita no está aquí?{' '}
                    <Link href="/onboarding" className="text-gold hover:underline">Invítala a registrarse →</Link>
                  </p>
                )}
              </div>
            ) : (
              results.map((b) => (
                <BarberCard key={b.slug} b={b} onClick={() => router.push(`/${b.slug}`)} />
              ))
            )}
          </div>
        )}
      </div>

      <p className="font-mono text-[10px] text-ink-600 tracking-widest text-center mt-3 uppercase">
        O accede directo a <span className="text-gold">homie.app/nombre-de-barberia</span>
      </p>
    </div>
  );
}

// ── Landing Page ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="min-h-screen">
      {showLogin && <QuickLoginModal onClose={() => setShowLogin(false)} />}

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/95 backdrop-blur-sm border-b border-ink-400">
        <div className="bg-gold h-7 overflow-hidden flex items-center">
          <div className="animate-marquee whitespace-nowrap flex gap-16">
            {Array(4).fill(['✂ Homie SaaS', '💈 Tu barbería online en minutos', '🎵 Hip Hop Culture', '⬡ Multi-Tenant Platform', '🚀 Reservas · Perfiles · Portafolio']).flat().map((t, i) => (
              <span key={i} className="font-mono text-[11px] tracking-[.3em] text-ink uppercase mx-8">{t}</span>
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold flex items-center justify-center animate-pulse-gold">
              <Scissors size={18} className="text-ink rotate-180" />
            </div>
            <div>
              <div className="font-display text-2xl text-cream tracking-wider">HOMIE SAAS</div>
              <div className="font-mono text-[8px] text-ink-700 tracking-[.4em]">BARBER PLATFORM</div>
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/pricing" className="nav-link text-sm md:text-base hidden sm:block">Precios</Link>
            <button onClick={() => setShowLogin(true)}
              className="flex items-center gap-2 font-display text-base tracking-wider text-ink-800 hover:text-gold transition-colors uppercase">
              <LogIn size={15} />
              <span className="hidden sm:inline">Mi barbería</span>
            </button>
            <Link href="/onboarding" className="btn-gold text-sm md:text-base py-2 px-4 md:px-6 shimmer">
              Empezar →
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 noise overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink to-ink-50" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display text-[20vw] text-gold/[.025] leading-none whitespace-nowrap">HOMIE</span>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-16 bg-gold" />
              <span className="font-mono text-[11px] text-gold tracking-[.4em] uppercase">La plataforma de barberías</span>
              <div className="h-px w-16 bg-gold" />
            </div>
            <h1 className="font-display leading-none">
              <span className="block text-[11vw] md:text-[90px] text-cream">HOMIE SAAS</span>
              <span className="block text-[5vw] md:text-[42px] text-gold tracking-[.15em]">BARBER PLATFORM</span>
            </h1>
          </div>

          {/* Dos cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* CARD CLIENTE */}
            <div className="bg-ink-200 border border-ink-400 p-8 flex flex-col gap-5">
              <div>
                <p className="font-mono text-[10px] text-gold tracking-[.4em] uppercase mb-2">Para clientes</p>
                <h2 className="font-display text-4xl text-cream tracking-wider">BUSCA TU<br />BARBERÍA</h2>
                <div className="h-px w-12 bg-gold mt-3" />
              </div>
              <p className="font-mono text-[12px] text-ink-700 tracking-wider leading-relaxed">
                Barberías registradas en Homie SaaS cerca de ti, ordenadas por distancia.
              </p>
              <BarberSearch />
            </div>

            {/* CARD BARBERÍA */}
            <div className="bg-ink-200 border border-gold/40 p-8 flex flex-col gap-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-[3px] h-full bg-gold" />
              <div>
                <p className="font-mono text-[10px] text-gold tracking-[.4em] uppercase mb-2">Para barberías</p>
                <h2 className="font-display text-4xl text-gold tracking-wider">REGISTRA TU<br />BARBERÍA</h2>
                <div className="h-px w-12 bg-gold mt-3" />
              </div>
              <p className="font-mono text-[12px] text-ink-700 tracking-wider leading-relaxed">
                Crea tu espacio online en minutos. Gestiona tu equipo, tus servicios y recibe reservas 24/7.
              </p>
              <div className="space-y-3 mt-auto">
                {['14 días de prueba gratis', 'Sin tarjeta requerida', 'Tu barbería en homie.app/tu-nombre'].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-gold flex-shrink-0" />
                    <span className="font-mono text-[11px] text-cream tracking-wider">{item}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <Link href="/onboarding" className="btn-gold w-full block text-center shimmer">EMPEZAR GRATIS →</Link>
                </div>
                <button onClick={() => setShowLogin(true)}
                  className="w-full flex items-center justify-center gap-2 font-mono text-[11px] text-ink-700 hover:text-gold tracking-widest uppercase transition-colors py-2">
                  <LogIn size={12} /> Ya tengo barbería
                </button>
              </div>
            </div>

          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <div className="w-px h-12 bg-gradient-to-b from-gold to-transparent" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <p className="font-mono text-xs text-gold tracking-[.4em] uppercase mb-3 text-center">Cómo funciona</p>
        <h2 className="section-title text-5xl text-center mb-2">MULTI-TENANT REAL</h2>
        <p className="font-mono text-sm text-ink-700 tracking-widest text-center mb-16 uppercase">cada barbería vive en su propio espacio aislado</p>
        <div className="grid md:grid-cols-3 gap-6 stagger">
          {[
            { n:'01', icon: <Store size={28}/>, title:'Registra tu barbería', desc:'Elige un slug único (ej: homie-temuco). Tu barbería vive en /homie-temuco y tiene su propia base de datos.' },
            { n:'02', icon: <Users size={28}/>, title:'Agrega tus barberos', desc:'Cada barbero del equipo crea su cuenta dentro de tu barbería. Perfiles, portafolio y servicios propios.' },
            { n:'03', icon: <CalendarCheck size={28}/>, title:'Recibe reservas', desc:'Los clientes te encuentran por GPS, eligen barbero, servicio y horario. Sin crear cuenta.' },
          ].map(s => (
            <div key={s.n} className="card p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="font-display text-5xl text-gold/20 leading-none">{s.n}</div>
                <div className="text-gold mt-2">{s.icon}</div>
              </div>
              <h3 className="font-display text-2xl text-cream mb-3 tracking-wide">{s.title}</h3>
              <p className="text-ink-800 text-base leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-4 bg-ink-50">
        <div className="max-w-7xl mx-auto">
          <p className="font-mono text-xs text-gold tracking-[.4em] uppercase mb-3">Incluido en cada barbería</p>
          <h2 className="section-title text-5xl mb-16">FUNCIONALIDADES</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 stagger">
            {[
              { icon: <Shield size={20}/>, title:'Aislamiento total', desc:'Cada barbería tiene su propio archivo .db' },
              { icon: <Users size={20}/>, title:'Multi-barbero', desc:'N barberos por barbería, cada uno con su perfil' },
              { icon: <CalendarCheck size={20}/>, title:'Reservas sin cuenta', desc:'El cliente reserva solo con nombre y teléfono' },
              { icon: <TrendingUp size={20}/>, title:'Dashboard', desc:'Estadísticas, métricas e ingresos en tiempo real' },
              { icon: <Scissors size={20}/>, title:'Portafolio', desc:'Sube tus trabajos con galería y lightbox' },
              { icon: <Store size={20}/>, title:'Servicios y precios', desc:'Gestión completa con duración y descripción' },
            ].map(f => (
              <div key={f.title} className="card p-5 hover:border-gold/40 transition-colors">
                <div className="text-gold mb-3">{f.icon}</div>
                <div className="font-display text-xl text-cream mb-1 tracking-wide">{f.title}</div>
                <div className="font-mono text-[11px] text-ink-700 tracking-wider">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center relative noise overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse at center, rgba(255,215,0,0.06) 0%, transparent 70%)'}} />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="font-display text-7xl text-cream mb-6">EMPIEZA HOY</h2>
          <p className="font-mono text-sm text-ink-700 tracking-widest mb-4 uppercase">14 días gratis · Sin tarjeta requerida</p>
          <p className="font-mono text-sm text-ink-700 tracking-widest mb-10 uppercase">Tu barbería online en menos de 2 minutos</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/onboarding" className="btn-gold text-2xl px-16 py-5 shimmer">CREAR MI BARBERÍA →</Link>
            <button onClick={() => setShowLogin(true)}
              className="btn-outline text-xl px-10 py-5 flex items-center justify-center gap-2">
              <LogIn size={18} /> Ya tengo cuenta
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-ink-400 py-8 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="font-display text-xl text-cream">HOMIE SAAS · BARBER PLATFORM</div>
          <div className="font-mono text-[10px] text-ink-600 tracking-widest">MULTI-TENANT · HIP HOP CULTURE</div>
          <Link href="/admin" className="font-mono text-[11px] text-gold tracking-widest hover:underline">Super Admin →</Link>
        </div>
      </footer>
    </div>
  );
}
