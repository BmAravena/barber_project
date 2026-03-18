'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiMyServices, apiCreateService, apiUpdateService, apiDeleteService } from '@/lib/api';
import type { Service } from '@/types';
import { Scissors, Plus, Trash2, Save, Clock, Edit2 } from 'lucide-react';

const fmtP = (n: number) => `$${n.toLocaleString('es-CL')}`;

export default function ServicesPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Service>>({});
  const [creating, setCreating] = useState(false);
  const [newSvc, setNewSvc] = useState({ name:'', description:'', price:0, duration:30 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => apiMyServices(tenant).then(setServices).finally(() => setLoading(false));
  useEffect(() => { if (tenant) load(); }, [tenant]);

  const saveEdit = async (id: string) => {
    setSaving(true);
    try { await apiUpdateService(tenant, id, editData); setMsg('Guardado ✓'); setEditId(null); load(); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 2000); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar?')) return;
    await apiDeleteService(tenant, id);
    setServices(prev => prev.filter(s => s.id !== id));
  };

  const create = async () => {
    if (!newSvc.name || newSvc.price <= 0) { setMsg('Nombre y precio requeridos'); return; }
    setSaving(true);
    try { await apiCreateService(tenant, newSvc); setCreating(false); setNewSvc({ name:'', description:'', price:0, duration:30 }); setMsg('Servicio creado ✓'); load(); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 2000); }
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="font-mono text-[11px] text-gold tracking-[.4em] uppercase mb-2">Gestión</p>
          <h1 className="font-display text-4xl md:text-6xl text-cream">SERVICIOS</h1>
          <div className="h-px w-24 bg-gold mt-3" />
        </div>
        <button onClick={() => setCreating(!creating)} className={creating ? 'btn-outline' : 'btn-gold'}>
          <Plus size={16} className="inline mr-2" />{creating ? 'Cancelar' : 'Nuevo servicio'}
        </button>
      </div>

      {msg && <div className={`font-mono text-xs tracking-widest mb-6 px-4 py-3 border ${msg.includes('✓') ? 'text-rap-green bg-rap-green/10 border-rap-green/30' : 'text-rap-red bg-rap-red/10 border-rap-red/30'}`}>{msg}</div>}

      {creating && (
        <div className="card p-6 mb-8 border-gold/40">
          <h3 className="font-display text-2xl text-gold mb-5">NUEVO SERVICIO</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div><label className="label">Nombre *</label><input className="input-field" placeholder="Ej: Fade Mid" value={newSvc.name} onChange={e => setNewSvc({...newSvc, name: e.target.value})} /></div>
            <div><label className="label">Descripción</label><input className="input-field" placeholder="Descripción breve" value={newSvc.description} onChange={e => setNewSvc({...newSvc, description: e.target.value})} /></div>
            <div><label className="label">Precio (CLP) *</label><input className="input-field" type="number" min="0" step="500" value={newSvc.price} onChange={e => setNewSvc({...newSvc, price: +e.target.value})} /></div>
            <div><label className="label">Duración (min)</label><input className="input-field" type="number" min="15" step="15" value={newSvc.duration} onChange={e => setNewSvc({...newSvc, duration: +e.target.value})} /></div>
          </div>
          <button onClick={create} disabled={saving} className="btn-gold flex items-center gap-2"><Plus size={16}/>{saving ? 'Creando...' : 'Crear servicio'}</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : services.length === 0 ? (
        <div className="card p-16 text-center"><Scissors size={36} className="text-ink-500 mx-auto mb-4 rotate-180" /><p className="font-display text-3xl text-ink-600 tracking-widest">SIN SERVICIOS</p></div>
      ) : (
        <div className="space-y-3 stagger">
          {services.map(s => (
            <div key={s.id} className="card p-5 hover:border-gold/30 transition-colors">
              {editId === s.id ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><label className="label">Nombre</label><input className="input-field" value={editData.name||''} onChange={e => setEditData({...editData, name:e.target.value})} /></div>
                    <div><label className="label">Descripción</label><input className="input-field" value={editData.description||''} onChange={e => setEditData({...editData, description:e.target.value})} /></div>
                    <div><label className="label">Precio (CLP)</label><input className="input-field" type="number" min="0" step="500" value={editData.price||0} onChange={e => setEditData({...editData, price:+e.target.value})} /></div>
                    <div><label className="label">Duración (min)</label><input className="input-field" type="number" min="15" step="15" value={editData.duration||30} onChange={e => setEditData({...editData, duration:+e.target.value})} /></div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => saveEdit(s.id)} disabled={saving} className="btn-gold flex items-center gap-2 py-2 px-6"><Save size={14}/>{saving?'Guardando...':'Guardar'}</button>
                    <button onClick={() => setEditId(null)} className="btn-ghost">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gold/10 flex items-center justify-center border border-gold/20">
                      <Scissors size={16} className="text-gold rotate-180" />
                    </div>
                    <div>
                      <div className="font-display text-xl text-cream tracking-wide">{s.name}</div>
                      {s.description && <div className="font-mono text-[11px] text-ink-700 tracking-wider mt-0.5">{s.description}</div>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="font-display text-lg text-gold">{fmtP(s.price)}</span>
                        <span className="flex items-center gap-1 text-ink-600 font-mono text-[10px] tracking-widest"><Clock size={10}/>{s.duration} MIN</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditId(s.id); setEditData({name:s.name,description:s.description,price:s.price,duration:s.duration}); }}
                      className="w-9 h-9 border border-ink-500 flex items-center justify-center text-ink-600 hover:border-gold hover:text-gold transition-all"><Edit2 size={14}/></button>
                    <button onClick={() => del(s.id)}
                      className="w-9 h-9 border border-ink-500 flex items-center justify-center text-ink-600 hover:border-rap-red hover:text-rap-red transition-all"><Trash2 size={14}/></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
