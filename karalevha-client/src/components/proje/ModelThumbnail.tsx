import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import type { ModelFormat } from '../../utils/loadModel';

/** Kart görseli: ekrana girince modelden küçük resim üretir. */
export default function ModelThumbnail({ url, format }: { url: string; format: ModelFormat }) {
  const ref = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [state, setState] = useState<'bekliyor' | 'hazir' | 'yok'>('bekliyor');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      observer.disconnect();
      // three.js yalnızca küçük resim gerektiğinde yüklenir (liste sayfaları hafif kalsın)
      import('../../utils/modelThumbnail').then((m) => m.modelThumbnail(url, format)).then((data) => {
        if (cancelled) return;
        setImage(data);
        setState(data ? 'hazir' : 'yok');
      });
    };
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && start(), { rootMargin: '200px' });
    observer.observe(el);
    // Kart açılışta zaten görünür alandaysa gözlemcinin ilk bildirimini bekleme
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 200 && rect.bottom > -200) start();
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [url, format]);

  return (
    <div ref={ref} className="relative aspect-[4/3] bg-levha-koyu overflow-hidden">
      <div className="kareli absolute inset-0" aria-hidden="true" />
      {image ? (
        <img src={image} alt="" className="relative w-full h-full object-contain" />
      ) : (
        <div className="relative w-full h-full flex items-center justify-center">
          <Box className={`w-8 h-8 text-levha-cizgi ${state === 'bekliyor' ? 'animate-pulse' : ''}`} strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
