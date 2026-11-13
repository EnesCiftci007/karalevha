const SIZES = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
} as const;

/** Kullanıcının baş harfiyle sade avatar (dış servise istek atmaz). */
export default function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <span
      className={`${SIZES[size]} shrink-0 rounded-full bg-levha-yuzey border border-levha-cizgi flex items-center justify-center font-display font-bold text-tebesir`}
      aria-hidden="true"
    >
      {(name.trim().charAt(0) || '?').toLocaleUpperCase('tr')}
    </span>
  );
}
