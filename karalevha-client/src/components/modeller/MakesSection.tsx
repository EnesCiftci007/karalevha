import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import { api, API_URL } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PrintMake } from '../../types';
import { formatSize } from '../../services/files';
import { fullDate, timeAgo } from '../../utils/time';
import ConfirmDialog from '../ui/ConfirmDialog';
import Field from '../ui/Field';
import UserLink from '../ui/UserLink';

const MAX_PHOTO = 8 * 1024 * 1024;

/** "Bunu bastım": modelin basılmış hâllerinin fotoğrafları ve yeni fotoğraf ekleme. */
export default function MakesSection({ modelId }: { modelId: number }) {
  const { user } = useAuth();
  const [makes, setMakes] = useState<PrintMake[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [settings, setSettings] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<PrintMake | null>(null);
  const [toDelete, setToDelete] = useState<PrintMake | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api<PrintMake[]>(`/api/bastim/model/${modelId}`).then((d) => !cancelled && setMakes(d)).catch(() => !cancelled && setMakes([]));
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError('Fotoğraf JPG, PNG ya da WebP olmalı.');
    if (file.size > MAX_PHOTO) return setError(`Fotoğraf en fazla ${formatSize(MAX_PHOTO)} olabilir.`);
    setError('');
    setPhoto(file);
  };

  const reset = () => {
    setAdding(false);
    setPhoto(null);
    setNote('');
    setSettings('');
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo || saving) return;
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('photo', photo);
    if (note.trim()) form.append('note', note.trim());
    if (settings.trim()) form.append('settings', settings.trim());
    try {
      const created = await api<PrintMake>(`/api/bastim/model/${modelId}`, { method: 'POST', body: form });
      setMakes((prev) => [created, ...(prev ?? [])]);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotoğraf yüklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="px-5 pb-5" aria-label="Bunu bastım">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-tebesir">
          Bunu bastım {makes && makes.length > 0 && <span className="veri">{makes.length}</span>}
        </h3>
        {user && !adding && (
          <button type="button" className="btn-sade h-8" onClick={() => setAdding(true)}>
            <Camera className="w-4 h-4" aria-hidden="true" />
            Fotoğraf ekle
          </button>
        )}
        {!user && (
          <Link to="/auth" className="text-sm text-tebesir-soluk hover:text-tebesir">Bastıysan giriş yapıp paylaş</Link>
        )}
      </div>

      {adding && (
        <form onSubmit={submit} className="kart p-4 mb-4 space-y-3">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          {preview ? (
            <div className="relative w-40">
              <img src={preview} alt="Seçilen fotoğraf" className="w-40 h-32 object-cover rounded-md border border-levha-cizgi" />
              <button type="button" onClick={() => setPhoto(null)} className="absolute -top-2 -right-2 p-1 rounded-full bg-levha-yuzey border border-levha-cizgi text-tebesir-silik hover:text-tebesir" aria-label="Fotoğrafı kaldır">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-md border border-dashed border-levha-cizgi hover:border-tebesir-silik px-4 py-6 text-center transition-colors">
              <ImagePlus className="w-5 h-5 mx-auto mb-1 text-tebesir-silik" aria-hidden="true" />
              <span className="text-sm text-tebesir">Baskının fotoğrafını seç</span>
              <span className="block text-xs text-tebesir-silik">JPG, PNG ya da WebP · en fazla {formatSize(MAX_PHOTO)}</span>
            </button>
          )}
          <Field id={`bastim-ayar-${modelId}`} label="Ayarlar" note="isteğe bağlı">
            <input id={`bastim-ayar-${modelId}`} className="girdi" maxLength={300} value={settings} onChange={(e) => setSettings(e.target.value)} placeholder="Ender 3 · PLA · 0.2 mm · %20 dolgu · destek yok" />
          </Field>
          <Field id={`bastim-not-${modelId}`} label="Not" note="isteğe bağlı">
            <input id={`bastim-not-${modelId}`} className="girdi" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Köprüler biraz sarktı, %105 ölçekle daha iyi oturdu" />
          </Field>
          {error && <p className="text-sm text-hata" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} disabled={saving} className="btn-sade">Vazgeç</button>
            <button type="submit" disabled={saving || !photo} className="btn-ana">{saving ? 'Yükleniyor…' : 'Paylaş'}</button>
          </div>
        </form>
      )}

      {makes === null ? null : makes.length === 0 ? (
        !adding && <p className="text-sm text-tebesir-silik">Henüz kimse bu modelin baskı fotoğrafını paylaşmadı.</p>
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {makes.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setOpen(m)} className="block w-full aspect-square rounded-md overflow-hidden border border-levha-cizgi hover:border-tebesir-silik transition-colors" aria-label={`${m.username} baskısı`}>
                <img src={`${API_URL}${m.photoPath}`} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Tek fotoğraf görünümü */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label="Baskı fotoğrafı">
          <figure className="max-w-3xl w-full bg-levha-yuzey border border-levha-cizgi rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <img src={`${API_URL}${open.photoPath}`} alt={`${open.username} baskısı`} className="w-full max-h-[70vh] object-contain bg-levha-koyu" />
            <figcaption className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-tebesir"><UserLink username={open.username} className="font-semibold" /> <span className="text-tebesir-silik" title={fullDate(open.createdAt)}>· {timeAgo(open.createdAt)}</span></p>
                {open.settings && <p className="mt-1 veri">{open.settings}</p>}
                {open.note && <p className="mt-1 text-sm text-tebesir-soluk whitespace-pre-wrap break-words">{open.note}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {user && (user.id === open.userId || user.isAdmin) && (
                  <button type="button" className="btn-sade h-8 text-hata" onClick={() => setToDelete(open)}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Sil
                  </button>
                )}
                <button type="button" className="btn-ikincil h-8" onClick={() => setOpen(null)}>Kapat</button>
              </div>
            </figcaption>
          </figure>
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Fotoğraf silinsin mi?"
          confirmLabel="Sil"
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await api(`/api/bastim/${toDelete.id}`, { method: 'DELETE' });
            setMakes((prev) => (prev ?? []).filter((m) => m.id !== toDelete.id));
            setOpen(null);
          }}
        >
          Bu baskı fotoğrafı kalıcı olarak silinecek.
        </ConfirmDialog>
      )}
    </section>
  );
}
