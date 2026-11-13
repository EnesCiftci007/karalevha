/** Yüklenirken içerik yerine duran gri blok. Boyutu className ile verilir. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`rounded-md bg-levha-yuzey animate-pulse ${className}`} aria-hidden="true" />;
}

/** Liste yüklenirken: n adet satır iskeleti. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-2" aria-label="Yükleniyor" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
      ))}
    </div>
  );
}
