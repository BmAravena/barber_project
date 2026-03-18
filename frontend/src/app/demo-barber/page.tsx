'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Scissors } from 'lucide-react';

export default function DemoRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Short delay so the loading screen shows, then redirect to demo tenant
    const t = setTimeout(() => router.replace('/demo-barber/barbers'), 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink gap-8">
      {/* Animated scissors */}
      <div className="w-20 h-20 bg-gold flex items-center justify-center animate-pulse-gold">
        <Scissors size={36} className="text-ink rotate-180" />
      </div>

      {/* Title */}
      <div className="text-center">
        <div className="font-display text-5xl text-cream tracking-wider mb-2">HOMIE DEMO</div>
        <div className="font-mono text-[11px] text-gold tracking-[.4em] uppercase">BARBER SHOP</div>
      </div>

      {/* Demo badge */}
      <div className="bg-gold/10 border border-gold/30 px-8 py-3 text-center">
        <div className="font-mono text-xs text-gold tracking-[.3em] uppercase">
          Modo demostración — datos de ejemplo
        </div>
      </div>

      {/* Spinner */}
      <div className="flex items-center gap-3 text-ink-600">
        <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-[11px] tracking-widest uppercase">Cargando...</span>
      </div>
    </div>
  );
}
