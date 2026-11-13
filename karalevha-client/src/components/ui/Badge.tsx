import type { ReactNode } from 'react';

const TONES = {
  notr: 'border-levha-cizgi text-tebesir-soluk',
  isaret: 'border-isaret/40 text-isaret bg-isaret/10',
  hata: 'border-hata/40 text-hata bg-hata/10',
  basari: 'border-basari/40 text-basari bg-basari/10',
} as const;

/** Küçük durum etiketi: "Gizli", "Yeni", "Kurucu" gibi. */
export default function Badge({ tone = 'notr', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}
