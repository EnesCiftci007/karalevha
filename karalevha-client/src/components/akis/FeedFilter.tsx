import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Hash, SlidersHorizontal, X } from 'lucide-react';
import { normalizeTag } from '../../utils/hashtags';

export type Scope = 'hepsi' | 'takip' | 'benim';
export type SortKey = 'yeni' | 'begeni' | 'yorum';
export type Period = 'tum' | 'gun' | 'hafta' | 'ay';

export interface FeedFilterValue {
  scope: Scope;
  sort: SortKey;
  period: Period;
  tag: string | null;
}

export const DEFAULT_FILTER: FeedFilterValue = { scope: 'hepsi', sort: 'yeni', period: 'tum', tag: null };

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'hepsi', label: 'Herkes' },
  { value: 'takip', label: 'Takip ettiklerim' },
  { value: 'benim', label: 'Benim' },
];
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'yeni', label: 'En yeni' },
  { value: 'begeni', label: 'En çok beğenilen' },
  { value: 'yorum', label: 'En çok yorumlanan' },
];
const PERIODS: { value: Period; label: string }[] = [
  { value: 'tum', label: 'Tümü' },
  { value: 'gun', label: 'Bugün' },
  { value: 'hafta', label: 'Bu hafta' },
  { value: 'ay', label: 'Bu ay' },
];

const labelOf = <T extends string>(list: { value: T; label: string }[], v: T) => list.find((x) => x.value === v)?.label ?? v;

/** Seçenek düğmeleri (tek seçim) */
function Options<T extends string>({ name, options, value, onChange }: { name: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="etiket mb-2">{name}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`h-8 px-3 rounded border text-sm transition-colors ${
              o.value === value ? 'border-isaret text-isaret bg-isaret/10' : 'border-levha-cizgi text-tebesir-soluk hover:border-tebesir-silik hover:text-tebesir'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Etkin filtre çipi: tıklayınca o filtre kalkar */
function Chip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded border border-isaret/60 text-sm text-isaret bg-isaret/10 hover:bg-isaret/15 transition-colors">
      {children}
      <X className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  );
}

interface FeedFilterProps {
  value: FeedFilterValue;
  onChange: (patch: Partial<FeedFilterValue>) => void;
  /** Gündemdeki etiketler: etiket alanında öneri olarak */
  suggestions: string[];
  /** Giriş yapılmamışsa "Takip ettiklerim" ve "Benim" yok */
  signedIn: boolean;
}

/**
 * Akış filtresi: "Filtrele" düğmesiyle açılan panel (gösterilenler, sıralama, zaman, etiket)
 * ve yanında etkin filtrelerin çipleri. Dışarı tıklayınca ya da Esc ile kapanır.
 */
export default function FeedFilter({ value, onChange, suggestions, signedIn }: FeedFilterProps) {
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active =
    (value.scope !== 'hepsi' ? 1 : 0) + (value.sort !== 'yeni' ? 1 : 0) + (value.period !== 'tum' ? 1 : 0) + (value.tag ? 1 : 0);

  const applyTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag.length < 2) return;
    onChange({ tag });
    setTagInput('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`inline-flex items-center gap-2 h-8 px-3 rounded border text-sm transition-colors ${
            open || active ? 'border-tebesir-silik text-tebesir bg-levha-yuzey' : 'border-levha-cizgi text-tebesir-soluk hover:text-tebesir hover:border-tebesir-silik'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          Filtrele
          {active > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-isaret text-levha-koyu text-xs font-semibold leading-4 text-center">{active}</span>}
        </button>

        {open && (
          <div role="dialog" aria-label="Akış filtresi" className="absolute left-0 top-full mt-2 z-30 w-[min(24rem,calc(100vw-2rem))] kart bg-levha-yuzey shadow-2xl p-4 space-y-4">
            {signedIn && <Options name="Gösterilenler" options={SCOPES} value={value.scope} onChange={(scope) => onChange({ scope })} />}
            <Options name="Sıralama" options={SORTS} value={value.sort} onChange={(sort) => onChange({ sort })} />
            <Options name="Zaman" options={PERIODS} value={value.period} onChange={(period) => onChange({ period })} />

            <div>
              <label htmlFor="akis-filtre-etiket" className="etiket block mb-2">Etiket</label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  applyTag(tagInput);
                }}
                className="relative"
              >
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tebesir-silik pointer-events-none" aria-hidden="true" />
                <input
                  id="akis-filtre-etiket"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder={value.tag ?? 'etiket yaz, Enter'}
                  className="girdi h-9 pl-9 text-sm"
                />
              </form>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 8).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onChange({ tag: value.tag === t ? null : t })}
                      aria-pressed={value.tag === t}
                      className={`h-7 px-2.5 rounded border text-xs transition-colors ${
                        value.tag === t ? 'border-isaret text-isaret bg-isaret/10' : 'border-levha-cizgi text-tebesir-soluk hover:text-tebesir'
                      }`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-levha-cizgi">
              <button type="button" onClick={() => onChange(DEFAULT_FILTER)} disabled={active === 0} className="btn-sade h-8 px-2 text-sm disabled:opacity-40">
                Temizle
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ikincil h-8">Tamam</button>
            </div>
          </div>
        )}
      </div>

      {/* Etkin filtreler */}
      {value.scope !== 'hepsi' && <Chip onClear={() => onChange({ scope: 'hepsi' })}>{labelOf(SCOPES, value.scope)}</Chip>}
      {value.tag && <Chip onClear={() => onChange({ tag: null })}>#{value.tag}</Chip>}
      {value.sort !== 'yeni' && <Chip onClear={() => onChange({ sort: 'yeni' })}>{labelOf(SORTS, value.sort)}</Chip>}
      {value.period !== 'tum' && <Chip onClear={() => onChange({ period: 'tum' })}>{labelOf(PERIODS, value.period)}</Chip>}
    </div>
  );
}
