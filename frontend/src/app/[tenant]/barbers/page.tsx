'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiGetBarbers } from '@/lib/api';
import type { Barber } from '@/types';
import { Scissors, ArrowLeft } from 'lucide-react';

export default function BarbersPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (tenant) apiGetBarbers(tenant).then(setBarbers).finally(() => setLoading(false)); }, [tenant]);

  return (
    <div className="min-h-screen pt-20">
      <div className="relative py-14 px-4 bg-ink-50 border-b border-ink-400 noise overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <Link href={`/${tenant}`} className="flex items-center gap-2 font-mono text-[11px] text-ink-700 tracking-widest uppercase mb-4 hover:text-gold transition-colors">
            <ArrowLeft size={12}/> Volver
          </Link>
          <h1 className="font-display text-8xl text-cream leading-none">BARBEROS</h1>
          <div className="gold-line mt-4 max-w-xs" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-14">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{[1,2,3].map(i => <div key={i} className="card h-72 animate-pulse" />)}</div>
        ) : barbers.length === 0 ? (
          <div className="text-center py-28"><Scissors size={40} className="text-ink-500 mx-auto mb-4 rotate-180" /><p className="font-display text-4xl text-ink-600 tracking-widest">SIN BARBEROS AÚN</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger">
            {barbers.map(b => (
              <Link key={b.id} href={`/${tenant}/barbers/${b.id}`} className="group block">
                <div className="card p-0 overflow-hidden hover:border-gold/60 transition-all hover:-translate-y-1 duration-300">
                  <div className="h-52 bg-ink-300 relative overflow-hidden">
                    {b.avatar
                      ? <img src={b.avatar.startsWith('data:') ? b.avatar : `data:image/jpeg;base64,${b.avatar}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={b.full_name}/>
                      : <div className="w-full h-full flex items-center justify-center"><Scissors size={44} className="text-gold/20 rotate-180"/></div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-200/90 to-transparent"/>
                    <div className="absolute bottom-3 left-4"><span className="font-mono text-[10px] tracking-widest text-gold bg-ink/80 px-2 py-1">@{b.username}</span></div>
                  </div>
                  <div className="p-5">
                    <div className="font-display text-2xl text-cream tracking-wide">{b.full_name}</div>
                    {b.specialty && <div className="font-mono text-[10px] text-gold tracking-widest mt-1">{b.specialty}</div>}
                    {b.bio && <p className="text-ink-700 text-sm mt-2 line-clamp-2 leading-relaxed">{b.bio}</p>}
                    <div className="font-display text-base text-gold mt-4 tracking-wider group-hover:tracking-[.2em] transition-all">VER PERFIL →</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
