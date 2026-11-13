import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

export interface ItemMenuAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

/** "..." menüsü: Düzenle / Sil gibi öğe eylemleri. Dışarı tıklayınca ve Esc ile kapanır. */
export default function ItemMenu({ actions, label = 'Seçenekler' }: { actions: ItemMenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="p-1.5 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 top-full mt-1 z-30 min-w-36 py-1 rounded-md border border-levha-cizgi bg-levha-yuzey shadow-xl">
          {actions.map(({ label: text, icon: Icon, onSelect, danger }) => (
            <li key={text} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={`w-full flex items-center gap-2 px-3 h-8 text-sm text-left transition-colors hover:bg-levha ${danger ? 'text-hata' : 'text-tebesir'}`}
              >
                {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
                {text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
