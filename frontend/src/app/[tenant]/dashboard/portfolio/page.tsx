'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { apiGetMe, apiGetPortfolio, apiAddPortfolio, apiDeletePortfolio } from '@/lib/api';
import type { PortfolioItem } from '@/types';
import { Upload, Trash2, Image as ImgIcon, X } from 'lucide-react';

export default function PortfolioPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [barberId, setBarberId] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenant) return;
    apiGetMe(tenant).then(b => {
      setBarberId(b.id);
      return apiGetPortfolio(tenant, b.id);
    }).then(setItems).finally(() => setLoading(false));
  }, [tenant]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const upload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      const b64 = preview.includes(',') ? preview.split(',')[1] : preview;
      await apiAddPortfolio(tenant, { image: b64, caption });
      setMsg('Foto subida ✓'); setPreview(null); setCaption('');
      if (fileRef.current) fileRef.current.value = '';
      const updated = await apiGetPortfolio(tenant, barberId);
      setItems(updated);
    } catch { setMsg('Error al subir'); }
    finally { setUploading(false); setTimeout(() => setMsg(''), 3000); }
  };

  const del = async (id: string) => {
    await apiDeletePortfolio(tenant, id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (lightbox?.id === id) setLightbox(null);
  };

  const imgSrc = (img: string) => img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="mb-8">
        <p className="font-mono text-[11px] text-gold tracking-[.4em] uppercase mb-2">Mi trabajo</p>
        <h1 className="font-display text-4xl md:text-6xl text-cream">PORTAFOLIO</h1>
        <div className="h-px w-24 bg-gold mt-3" />
      </div>

      {/* Upload */}
      <div className="card p-6 mb-8">
        <h3 className="font-display text-2xl text-gold mb-5">SUBIR NUEVA FOTO</h3>
        {!preview ? (
          <div onClick={() => fileRef.current?.click()}
            className="border border-dashed border-ink-500 h-36 flex flex-col items-center justify-center cursor-pointer hover:border-gold/50 hover:bg-gold/5 transition-all group">
            <Upload size={24} className="text-ink-600 group-hover:text-gold transition-colors mb-2" />
            <p className="font-mono text-[11px] text-ink-600 tracking-widest uppercase group-hover:text-gold">Click para seleccionar imagen</p>
          </div>
        ) : (
          <div className="flex gap-6 items-start flex-wrap">
            <div className="relative">
              <img src={preview} alt="Preview" className="w-44 h-44 object-cover border border-gold/40" />
              <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value=''; }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-rap-red flex items-center justify-center">
                <X size={12} className="text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-56 space-y-4">
              <div>
                <label className="label">Descripción (opcional)</label>
                <input className="input-field" placeholder="Ej: Fade mid con diseño" value={caption} onChange={e => setCaption(e.target.value)} />
              </div>
              <button onClick={upload} disabled={uploading} className="btn-gold flex items-center gap-2">
                <Upload size={16}/>{uploading ? 'Subiendo...' : 'SUBIR AL PORTAFOLIO'}
              </button>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {msg && <p className={`font-mono text-xs tracking-widest mt-4 ${msg.includes('✓') ? 'text-rap-green' : 'text-rap-red'}`}>{msg}</p>}
      </div>

      {/* Gallery */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-3xl text-gold tracking-wider">MIS FOTOS</h3>
        <span className="font-mono text-[11px] text-ink-600 tracking-widest">{items.length} IMÁGENES</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-ink-300 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="card p-16 text-center"><ImgIcon size={36} className="text-ink-500 mx-auto mb-4" /><p className="font-display text-3xl text-ink-600 tracking-widest">SIN FOTOS AÚN</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger">
          {items.map(item => (
            <div key={item.id} className="group relative aspect-square overflow-hidden bg-ink-300 border border-ink-400 cursor-pointer" onClick={() => setLightbox(item)}>
              <img src={imgSrc(item.image)} alt={item.caption||''} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/60 transition-all flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                {item.caption && <p className="font-mono text-[10px] text-gold tracking-widest text-center px-2">{item.caption}</p>}
                <button onClick={e => { e.stopPropagation(); del(item.id); }}
                  className="w-9 h-9 bg-rap-red/90 flex items-center justify-center hover:bg-rap-red transition-colors">
                  <Trash2 size={14} className="text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-ink/95 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-6 right-6 text-ink-700 hover:text-cream"><X size={28}/></button>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={imgSrc(lightbox.image)} alt={lightbox.caption} className="w-full max-h-[80vh] object-contain border border-ink-400" />
            {lightbox.caption && <div className="mt-3 text-center font-mono text-[11px] text-gold tracking-widest">{lightbox.caption}</div>}
            <button onClick={() => del(lightbox.id)} className="absolute top-3 right-3 w-9 h-9 bg-rap-red/90 flex items-center justify-center"><Trash2 size={14} className="text-white"/></button>
          </div>
        </div>
      )}
    </div>
  );
}
