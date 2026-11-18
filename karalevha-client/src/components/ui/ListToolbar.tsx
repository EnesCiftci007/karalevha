import type { ReactNode } from 'react';
import { Search, UserRound } from 'lucide-react';

interface ListToolbarProps<S extends string> {
  id: string;
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  sort?: S;
  onSort?: (s: S) => void;
  sortOptions?: { value: S; label: string }[];
  /** "6 proje" gibi; arama varken "2 / 6" gösterilir */
  count?: { shown: number; total: number; unit: string };
  /** Arama kutusunun soluna konan ek denetim (ör. kategori sekmeleri) */
  leading?: ReactNode;
  /** "Benimkiler" süzgeci (yalnızca giriş yapılmışsa verilir) */
  mine?: { active: boolean; onChange: (on: boolean) => void };
}

/** Liste sayfalarının ortak üst çubuğu: arama, sıralama ve sonuç sayısı. */
export default function ListToolbar<S extends string>({
  id, query, onQuery, placeholder, sort, onSort, sortOptions, count, leading, mine,
}: ListToolbarProps<S>) {
  const narrowed = !!query.trim() || !!mine?.active;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      {leading}
      <div className="relative flex-1 min-w-0 sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tebesir-silik pointer-events-none" aria-hidden="true" />
        <label htmlFor={id} className="sr-only">{placeholder}</label>
        <input id={id} type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} className="girdi pl-9" />
      </div>
      <div className="flex items-center gap-3 sm:ml-auto">
        {mine && (
          <button
            type="button"
            onClick={() => mine.onChange(!mine.active)}
            aria-pressed={mine.active}
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded border text-sm whitespace-nowrap transition-colors ${
              mine.active ? 'border-isaret text-isaret bg-isaret/10' : 'border-levha-cizgi text-tebesir-soluk hover:border-tebesir-silik hover:text-tebesir'
            }`}
          >
            <UserRound className="w-4 h-4" aria-hidden="true" />
            Benimkiler
          </button>
        )}
        {count && (
          <span className="veri whitespace-nowrap" aria-live="polite">
            {narrowed ? `${count.shown} / ${count.total}` : count.total} {count.unit}
          </span>
        )}
        {sortOptions && onSort && sort && (
          <>
            <label htmlFor={`${id}-sirala`} className="sr-only">Sıralama</label>
            <select id={`${id}-sirala`} value={sort} onChange={(e) => onSort(e.target.value as S)} className="girdi w-auto">
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
