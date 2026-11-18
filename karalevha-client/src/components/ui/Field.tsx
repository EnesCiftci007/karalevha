import type { ReactNode } from 'react';

interface FieldProps {
  id: string;
  label: string;
  /** Etiketin yanında soluk yazılan not, ör. "isteğe bağlı" */
  note?: string;
  /** Alanın altındaki yardım metni */
  hint?: string;
  error?: string;
  /** Etiket satırının sağına konan öğe (ör. "Şifremi unuttum") */
  aside?: ReactNode;
  children: ReactNode;
}

/** Form alanı iskeleti: etiket, alan, yardım ya da hata metni. Alanın kendisi `girdi` sınıfını kullanır. */
export default function Field({ id, label, note, hint, error, aside, children }: FieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="alan-etiketi">
          {label}
          {note && <span className="ml-1 font-normal text-tebesir-silik">({note})</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-hata" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-tebesir-silik">{hint}</p>
      ) : null}
    </div>
  );
}
