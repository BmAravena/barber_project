'use client';
import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Scissors, CalendarDays, User, Wrench, Image, LogOut, LayoutDashboard, Globe, Link2, Menu, X, CreditCard } from 'lucide-react';
import { apiGetMe, clearToken, getToken } from '@/lib/api';

interface BarberWithRole {
  id: string; username: string; full_name: string;
  bio?: string; specialty?: string; avatar?: string;
  instagram?: string; role?: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useParams<{ tenant: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [barber, setBarber] = useState<BarberWithRole | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = getToken(tenant);
    if (!t) { router.replace(`/${tenant}/auth/login`); return; }
    const stored = localStorage.getItem(`homie_barber_${tenant}`);
    if (stored) setBarber(JSON.parse(stored));
    apiGetMe(tenant).then(b => {
      setBarber(b);
      localStorage.setItem(`homie_barber_${tenant}`, JSON.stringify(b));
    }).catch(() => { clearToken(tenant); router.replace(`/${tenant}/auth/login`); });
  }, [tenant, router]);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const logout = () => { clearToken(tenant); router.push(`/${tenant}/auth/login`); };
  const isOwner = barber?.role === 'owner';

  const allNavItems = [
    { href: `/${tenant}/dashboard`,              label: 'Resumen',      icon: LayoutDashboard, ownerOnly: false },
    { href: `/${tenant}/dashboard/appointments`, label: 'Mis Citas',    icon: CalendarDays,    ownerOnly: false },
    { href: `/${tenant}/dashboard/services`,     label: 'Servicios',    icon: Wrench,          ownerOnly: false },
    { href: `/${tenant}/dashboard/portfolio`,    label: 'Portafolio',   icon: Image,           ownerOnly: false },
    { href: `/${tenant}/dashboard/invites`,      label: 'Invitaciones', icon: Link2,       ownerOnly: true  },
    { href: `/${tenant}/dashboard/billing`,      label: 'Plan',         icon: CreditCard,  ownerOnly: true  },
    { href: `/${tenant}/dashboard/profile`,      label: 'Mi Perfil',    icon: User,        ownerOnly: false },
  ];
  const navItems = allNavItems.filter(item => !item.ownerOnly || isOwner);

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-ink-400">
        <Link href={`/${tenant}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gold flex items-center justify-center animate-pulse-gold">
            <Scissors size={14} className="text-ink rotate-180" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg text-cream leading-none truncate">{tenant?.toUpperCase()}</div>
            <div className="font-mono text-[8px] text-ink-600 tracking-[.3em]">DASHBOARD</div>
          </div>
        </Link>
      </div>

      {/* Barber info */}
      {barber && (
        <div className="px-5 py-4 border-b border-ink-400">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-gold/40 overflow-hidden bg-ink-300 flex-shrink-0">
              {barber.avatar
                ? <img src={barber.avatar.startsWith('data:') ? barber.avatar : `data:image/jpeg;base64,${barber.avatar}`} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center"><Scissors size={12} className="text-gold/40 rotate-180" /></div>
              }
            </div>
            <div className="min-w-0">
              <div className="font-display text-base text-cream truncate">{barber.full_name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="font-mono text-[8px] text-gold tracking-widest truncate">@{barber.username}</div>
                {isOwner && (
                  <span className="font-mono text-[8px] bg-gold/20 text-gold border border-gold/30 px-1.5 py-0.5 tracking-widest uppercase flex-shrink-0">
                    Dueño
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== `/${tenant}/dashboard` && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-150 group border-l-2
                ${active ? 'bg-gold/10 border-gold text-gold' : 'border-transparent text-ink-700 hover:text-cream hover:bg-ink-200'}`}>
              <Icon size={15} className={active ? 'text-gold' : 'text-ink-600 group-hover:text-cream'} />
              <span className="font-display text-base tracking-wider">{label}</span>
            </Link>
          );
        })}
        <div className="h-px bg-ink-400 my-2" />
        <Link href={`/${tenant}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 text-ink-700 hover:text-gold transition-colors border-l-2 border-transparent">
          <Globe size={15} />
          <span className="font-display text-base tracking-wider">Ver página</span>
        </Link>
      </nav>

      <div className="px-3 pb-5 border-t border-ink-400 pt-3">
        <button onClick={logout} className="flex items-center gap-3 px-4 py-3 text-ink-700 hover:text-rap-red transition-colors w-full">
          <LogOut size={15} />
          <span className="font-display text-base tracking-wider">Salir</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-ink">
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex w-60 bg-ink-50 border-r border-ink-400 flex-col fixed top-0 left-0 h-full z-40">
        <SidebarContent />
      </aside>

      {/* ── Mobile: top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-ink-50 border-b border-ink-400 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gold flex items-center justify-center animate-pulse-gold">
            <Scissors size={12} className="text-ink rotate-180" />
          </div>
          <div>
            <div className="font-display text-base text-cream leading-none">{tenant?.toUpperCase()}</div>
            <div className="font-mono text-[7px] text-ink-600 tracking-[.3em]">DASHBOARD</div>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="text-cream p-1">
          <Menu size={22} />
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-ink/80" onClick={() => setOpen(false)} />
          {/* Drawer */}
          <div className="relative w-72 bg-ink-50 border-r border-ink-400 flex flex-col h-full z-10 overflow-hidden">
            <button onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-ink-700 hover:text-cream transition-colors">
              <X size={20} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="w-full md:ml-60 flex-1 min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
