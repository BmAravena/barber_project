'use client';
import Link from 'next/link';
import { FlaskConical, ArrowRight } from 'lucide-react';

export default function DemoBanner() {
  return (
    <div className="bg-gold text-ink py-2 px-4 flex items-center justify-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <FlaskConical size={14} />
        <span className="font-mono text-[11px] tracking-[.25em] uppercase font-bold">
          Modo Demo — Datos de ejemplo. Nada se guarda realmente.
        </span>
      </div>
      <Link href="/onboarding"
        className="flex items-center gap-1.5 font-mono text-[11px] tracking-[.2em] uppercase underline underline-offset-2 hover:opacity-70 transition-opacity">
        Crear mi barbería gratis <ArrowRight size={11} />
      </Link>
    </div>
  );
}
