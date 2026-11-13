import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Geniş içerik (ör. 3B önizleme) için */
  wide?: boolean;
}

/** Ortak pencere: Esc ve dışarı tıklama ile kapanır, arkadaki sayfa kaymaz. */
export default function Modal({ title, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'} max-h-[92vh] flex flex-col bg-levha-yuzey border border-levha-cizgi rounded-t-xl sm:rounded-xl shadow-2xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-levha-cizgi shrink-0">
          <h2 className="font-display font-semibold text-lg text-tebesir truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha transition-colors"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
