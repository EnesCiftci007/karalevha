import { useEffect, useMemo, useState } from 'react';
import { Check, Hash, Lock, Search, Users } from 'lucide-react';
import { api } from '../../services/api';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Avatar from '../ui/Avatar';

export interface ChannelSummary {
  id: number;
  name: string;
  type: string;
  category: string;
  isPrivate: boolean;
  canManage: boolean;
}

/** GET /api/obachannels/kanal/{id} */
export interface ChannelDetail {
  id: number;
  name: string;
  category: string;
  isPrivate: boolean;
  canManage: boolean;
  createdBy: string | null;
  ownerId: number;
  createdById: number | null;
  members: { id: number; username: string }[];
}

interface Person {
  id: number;
  username: string;
  isOwner: boolean;
}

const NEW_CATEGORY = '__yeni__';

/** Sunucudaki kuralın aynısı: "Çıkmış Sorular" -> "çıkmış-sorular" */
export function channelSlug(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[\s.]+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export const categoryLabel = (c: string) => c.charAt(0) + c.slice(1).toLocaleLowerCase('tr');

interface ChannelFormModalProps {
  obaId: string;
  userId: number;
  /** Obadaki metin kanalı bölümleri (büyük harfle, sunucudaki gibi) */
  categories: string[];
  /** Bölümün yanındaki + ile açıldıysa o bölüm seçili gelir */
  initialCategory?: string;
  /** Düzenlemede kanalın şimdiki hâli */
  channel?: ChannelDetail;
  onSaved: (channel: ChannelSummary) => void;
  onClose: () => void;
}

/** Kanal aç / düzenle: ad, bölüm, kimlerin göreceği ve gizli kanalın kişileri. */
export default function ChannelFormModal({ obaId, userId, categories, initialCategory, channel, onSaved, onClose }: ChannelFormModalProps) {
  const editing = !!channel;
  const [name, setName] = useState(channel?.name ?? '');
  const [category, setCategory] = useState(channel?.category ?? initialCategory ?? categories[0] ?? 'METİN KANALLARI');
  const [newCategory, setNewCategory] = useState('');
  const [isPrivate, setIsPrivate] = useState(channel?.isPrivate ?? false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(channel?.members.map((m) => m.id) ?? []));
  const [people, setPeople] = useState<Person[] | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<Person[]>(`/api/obachannels/${obaId}/kisiler`)
      .then((list) => !cancelled && setPeople(list))
      .catch(() => !cancelled && setPeople([]));
    return () => {
      cancelled = true;
    };
  }, [obaId]);

  // Kurucu ve kanalı açan kişi gizli kanalı her zaman görür
  const creatorId = channel?.createdById ?? userId;
  const alwaysIn = (p: Person) => p.isOwner || p.id === creatorId;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return (people ?? []).filter((p) => !q || p.username.toLocaleLowerCase('tr').includes(q));
  }, [people, query]);

  const slug = channelSlug(name);
  const chosenCategory = category === NEW_CATEGORY ? newCategory.trim() : category;
  const pickedCount = (people ?? []).filter((p) => !alwaysIn(p) && selected.has(p.id)).length;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return setError('Kanal adı boş olamaz.');
    if (category === NEW_CATEGORY && !chosenCategory) return setError('Yeni bölümün adını yaz.');
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify({
        name,
        category: chosenCategory,
        isPrivate,
        memberIds: isPrivate ? [...selected] : [],
      });
      const saved = editing
        ? await api<ChannelSummary>(`/api/obachannels/kanal/${channel!.id}`, { method: 'PUT', body })
        : await api<ChannelSummary>(`/api/obachannels/${obaId}`, { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kanal kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Kanalı düzenle' : 'Kanal ekle'} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-5">
        <Field id="kanal-adi" label="Kanal adı" hint={slug ? `#${slug}` : 'Ör. çıkmış sorular, ders notları'}>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tebesir-silik" aria-hidden="true" />
            <input id="kanal-adi" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="girdi pl-9" />
          </div>
        </Field>

        <Field id="kanal-bolum" label="Bölüm">
          <select id="kanal-bolum" value={category} onChange={(e) => setCategory(e.target.value)} className="girdi">
            {categories.map((c) => (
              <option key={c} value={c}>{categoryLabel(c)}</option>
            ))}
            <option value={NEW_CATEGORY}>Yeni bölüm…</option>
          </select>
          {category === NEW_CATEGORY && (
            <input
              aria-label="Yeni bölümün adı"
              value={newCategory}
              maxLength={50}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Ör. Dersler"
              className="girdi mt-2"
            />
          )}
        </Field>

        <fieldset>
          <legend className="alan-etiketi">Kimler görebilir</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { value: false, icon: Users, title: 'Obadaki herkes', text: 'Obaya giren herkes okur ve yazar.' },
              { value: true, icon: Lock, title: 'Seçtiğim kişiler', text: 'Yalnızca eklediğin kişiler görür.' },
            ].map((o) => (
              <label
                key={String(o.value)}
                className={`flex gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  isPrivate === o.value ? 'border-isaret bg-levha' : 'border-levha-cizgi hover:border-tebesir-silik'
                }`}
              >
                <input type="radio" name="kanal-gizlilik" className="sr-only" checked={isPrivate === o.value} onChange={() => setIsPrivate(o.value)} />
                <o.icon className={`w-4 h-4 mt-0.5 shrink-0 ${isPrivate === o.value ? 'text-isaret' : 'text-tebesir-silik'}`} aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium text-tebesir">{o.title}</span>
                  <span className="block text-xs text-tebesir-silik">{o.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {isPrivate && (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="alan-etiketi mb-0">Kişiler</span>
              <span className="veri">{pickedCount} seçili</span>
            </div>
            <div className="rounded border border-levha-cizgi">
              <div className="relative border-b border-levha-cizgi">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tebesir-silik" aria-hidden="true" />
                <input
                  aria-label="Kişi ara"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Obadaki kişilerde ara"
                  className="w-full h-10 bg-transparent pl-9 pr-3 text-sm text-tebesir placeholder:text-tebesir-silik focus:outline-none"
                />
              </div>
              <ul className="max-h-56 overflow-y-auto p-1">
                {people === null ? (
                  <li className="px-3 py-4 text-sm text-tebesir-silik">Kişiler yükleniyor…</li>
                ) : filtered.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-tebesir-silik">Kimse bulunamadı.</li>
                ) : (
                  filtered.map((p) => {
                    const fixed = alwaysIn(p);
                    const on = fixed || selected.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={fixed}
                          onClick={() => toggle(p.id)}
                          aria-pressed={on}
                          className="w-full flex items-center gap-3 px-2 py-1.5 rounded text-left hover:bg-levha disabled:hover:bg-transparent disabled:cursor-default"
                        >
                          <Avatar name={p.username} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-tebesir truncate">{p.username}</span>
                            {fixed && (
                              <span className="block text-xs text-tebesir-silik">
                                {p.id === userId ? 'Sen' : p.isOwner ? 'Kurucu' : 'Kanalı açan'} · her zaman görür
                              </span>
                            )}
                          </span>
                          <span
                            className={`w-5 h-5 shrink-0 rounded-sm border flex items-center justify-center ${
                              on ? (fixed ? 'bg-levha-cizgi border-levha-cizgi text-tebesir-soluk' : 'bg-isaret border-isaret text-levha') : 'border-tebesir-silik'
                            }`}
                            aria-hidden="true"
                          >
                            {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-hata" role="alert">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="btn-sade">Vazgeç</button>
          <button type="submit" disabled={saving || !slug} className="btn-ana">
            {saving ? 'Kaydediliyor…' : editing ? 'Kaydet' : 'Kanalı aç'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
