/**
 * KaraLevha marka parçaları. Logodaki eğik (24°) yuvarlak çerçeve sitenin tekrar eden motifidir:
 * logo, maskot ve küçük işaretler aynı açıyı kullanır. Renk currentColor'dan gelir.
 */

export const TILT = 24; // logodaki eğim, derece

/** Levha logosu: eğik çerçeve ve içinde üç tebeşir çizgisi. */
export function Logo({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g transform={`rotate(${TILT} 50 50)`} fill="none" stroke="currentColor" strokeLinecap="round">
        <rect x="17" y="17" width="66" height="66" rx="12" strokeWidth="11" />
        <line x1="36" y1="38" x2="64" y2="38" strokeWidth="9.5" />
        <line x1="36" y1="50" x2="64" y2="50" strokeWidth="9.5" />
        <line x1="36" y1="62" x2="64" y2="62" strokeWidth="9.5" />
      </g>
    </svg>
  );
}

/**
 * Kulüp maskotu: logonun eğik çerçevesinde, alnında 3B yazıcı olan kafatası.
 * Çerçeve ve kafatası `frameClassName` / `skullClassName` ile ayrı renklenebilir.
 */
export function Mascot({
  className = '',
  frameClassName = 'text-sprey',
  skullClassName = 'text-tebesir',
  title = 'KaraLevha maskotu',
}: {
  className?: string;
  frameClassName?: string;
  skullClassName?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={title}>
      <g transform={`rotate(${TILT} 100 100)`} className={frameClassName}>
        <rect x="26" y="26" width="148" height="148" rx="26" fill="none" stroke="currentColor" strokeWidth="18" />
      </g>
      <g className={skullClassName} fill="currentColor">
        {/* Kafatası: kubbe + elmacık + çene */}
        <path
          fillRule="evenodd"
          d="M100 46c-29 0-50 20-50 47 0 15 6 26 15 33v14c0 5 4 9 9 9h4v8c0 3 2 5 5 5s5-2 5-5v-8h6v8c0 3 2 5 5 5s5-2 5-5v-8h6v8c0 3 2 5 5 5s5-2 5-5v-8h4c5 0 9-4 9-9v-14c9-7 15-18 15-33 0-27-21-47-50-47Z
             M80 104c-8 0-14 6-14 12s6 9 14 9 13-4 13-10-5-11-13-11Z
             M120 104c-8 0-13 5-13 11s5 10 13 10 14-3 14-9-6-12-14-12Z
             M100 126l-7 12h14Z"
        />
      </g>
      {/* Alındaki 3B yazıcı: gantri, nozul ve tabla (kafatası renginde boşluk olarak) */}
      <g className="text-levha" fill="currentColor">
        <rect x="80" y="58" width="4" height="30" rx="1" />
        <rect x="116" y="58" width="4" height="30" rx="1" />
        <rect x="76" y="58" width="48" height="4" rx="2" />
        <rect x="76" y="86" width="48" height="4" rx="2" />
        <rect x="96" y="62" width="8" height="7" rx="1" />
        <path d="M97 69h6l-3 5Z" />
        <rect x="90" y="78" width="20" height="7" rx="1.5" />
      </g>
    </svg>
  );
}

/** Küçük eğik kare işaret: liste maddeleri ve üst yazılar için. */
export function TiltMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={`inline-block w-2.5 h-2.5 ${className}`} aria-hidden="true">
      <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" transform={`rotate(${TILT} 5 5)`} fill="currentColor" />
    </svg>
  );
}

/** KaraLevha yazısı: logonun yanında düz, kalın. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-display font-bold tracking-tight text-tebesir leading-none ${className}`}>KaraLevha</span>;
}
