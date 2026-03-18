'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { apiGetMe, apiUpdateMe } from '@/lib/api';
import type { Barber } from '@/types';
import { Scissors, Camera, Save, Instagram } from 'lucide-react';

export default function ProfilePage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [barber, setBarber] = useState<Barber | null>(null);
  const [form, setForm] = useState({ full_name:'', bio:'', specialty:'', instagram:'' });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenant) return;
    apiGetMe(tenant).then(b => {
      setBarber(b);
      setForm({ full_name:b.full_name||'', bio:b.bio||'', specialty:b.specialty||'', instagram:b.instagram||'' });
    });
  }, [tenant]);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = { ...form };
      if (avatarPreview) payload.avatar = avatarPreview.includes(',') ? avatarPreview.split(',')[1] : avatarPreview;
      await apiUpdateMe(tenant, payload);
      setMsg('Perfil actualizado ✓');
      const updated = await apiGetMe(tenant);
      setBarber(updated);
      localStorage.setItem(`homie_barber_${tenant}`, JSON.stringify(updated));
      if (avatarPreview) setAvatarPreview(null);
    } catch { setMsg('Error al guardar'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const currentAvatar = avatarPreview
    || (barber?.avatar ? (barber.avatar.startsWith('data:') ? barber.avatar : `data:image/jpeg;base64,${barber.avatar}`) : null);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="mb-8">
        <p className="font-mono text-[11px] text-gold tracking-[.4em] uppercase mb-2">Personalización</p>
        <h1 className="font-display text-4xl md:text-6xl text-cream">MI PERFIL</h1>
        <div className="h-px w-24 bg-gold mt-3" />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Avatar col */}
        <div className="lg:col-span-1">
          <div className="card p-6 text-center">
            <h3 className="font-display text-xl text-gold mb-5 tracking-wider">FOTO DE PERFIL</h3>
            <div className="relative w-36 h-36 mx-auto cursor-pointer group" onClick={() => fileRef.current?.click()}>
              <div className="w-full h-full border-2 border-gold/40 overflow-hidden bg-ink-300 animate-pulse-gold">
                {currentAvatar
                  ? <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Scissors size={40} className="text-gold/30 rotate-180" /></div>
                }
              </div>
              <div className="absolute inset-0 bg-ink/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={24} className="text-gold" />
              </div>
              {avatarPreview && <div className="absolute -top-1 -right-1 w-5 h-5 bg-gold rounded-full flex items-center justify-center"><span className="text-ink text-[10px] font-bold">✓</span></div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
            <p className="font-mono text-[10px] text-ink-600 tracking-widest mt-4 uppercase">
              {avatarPreview ? '✓ Lista para guardar' : 'Click para cambiar'}
            </p>
            {barber && (
              <div className="mt-6 pt-6 border-t border-ink-400 space-y-3 text-left">
                <div>
                  <div className="font-mono text-[9px] text-ink-600 tracking-[.3em] uppercase">Usuario</div>
                  <div className="font-display text-lg text-gold tracking-wider mt-0.5">@{barber.username}</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] text-ink-600 tracking-[.3em] uppercase">Barbería</div>
                  <div className="font-mono text-sm text-ink-800 mt-0.5">{tenant}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form col */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="font-display text-xl text-gold mb-6 tracking-wider">INFORMACIÓN</h3>
            <div className="grid md:grid-cols-2 gap-5 mb-5">
              <div><label className="label">Nombre completo</label><input className="input-field" value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} placeholder="Tu nombre" /></div>
              <div><label className="label">Especialidad</label><input className="input-field" value={form.specialty} onChange={e => setForm({...form,specialty:e.target.value})} placeholder="Ej: Fades & Diseños" /></div>
            </div>
            <div className="mb-5">
              <label className="label">Bio</label>
              <textarea className="input-field resize-none" rows={4} value={form.bio} onChange={e => setForm({...form,bio:e.target.value})} placeholder="Cuéntale a tus clientes quién eres..." />
            </div>
            <div className="mb-8">
              <label className="label flex items-center gap-2"><Instagram size={12}/> Instagram (sin @)</label>
              <input className="input-field" value={form.instagram} onChange={e => setForm({...form,instagram:e.target.value})} placeholder="tu_usuario_ig" />
            </div>
            {msg && <div className={`font-mono text-xs tracking-widest mb-5 px-4 py-3 border ${msg.includes('✓') ? 'text-rap-green bg-rap-green/10 border-rap-green/30' : 'text-rap-red bg-rap-red/10 border-rap-red/30'}`}>{msg}</div>}
            <button onClick={save} disabled={saving} className="btn-gold flex items-center gap-2 text-xl px-10">
              <Save size={18}/>{saving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
            </button>
          </div>

          {/* Preview */}
          <div className="card p-6">
            <h3 className="font-display text-xl text-gold mb-5 tracking-wider">VISTA PREVIA</h3>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 border border-gold/40 overflow-hidden bg-ink-300 flex-shrink-0">
                {currentAvatar ? <img src={currentAvatar} alt="preview" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Scissors size={20} className="text-gold/30 rotate-180" /></div>}
              </div>
              <div>
                <div className="font-display text-2xl text-cream">{form.full_name || 'Tu nombre'}</div>
                {form.specialty && <div className="font-mono text-[10px] text-gold tracking-widest uppercase mt-1">{form.specialty}</div>}
                {form.bio && <p className="text-ink-700 text-sm mt-2 leading-relaxed line-clamp-2">{form.bio}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
