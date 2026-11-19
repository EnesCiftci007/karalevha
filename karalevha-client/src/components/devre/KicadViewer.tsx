import { Suspense, createElement, lazy, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import './kicanvas.css';

const Kicad3DView = lazy(() => import('./Kicad3DView'));

/** KiCanvas bir kez yüklenir (public/vendor/kicanvas, MIT); yalnızca bir KiCad dosyası açılınca */
let loading: Promise<void> | null = null;
function loadKiCanvas(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    if (customElements.get('kicanvas-embed')) return resolve();
    const script = document.createElement('script');
    script.src = '/vendor/kicanvas/kicanvas.js';
    script.async = true;
    script.onload = () => customElements.whenDefined('kicanvas-embed').then(() => resolve());
    script.onerror = () => {
      loading = null;
      reject(new Error('KiCad görüntüleyicisi yüklenemedi.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * KiCad 6+ şema (.kicad_sch) ve PCB (.kicad_pcb) dosyasını sitede gösterir:
 * - 2B (KiCanvas): yakınlaştırma, katmanlar, bileşen ve ağ listeleri.
 * - 3B (yalnızca .kicad_pcb): gerçekçi 3B kart, metalik pad'ler, lehim maskesi renkleri ve 3B parçalar.
 */
export default function KicadViewer({ url, fileName }: { url: string; fileName: string }) {
  const isPcb = /\.kicad_pcb$/i.test(fileName);
  const [mode, setMode] = useState<'3d' | '2d'>(isPcb ? '3d' : '2d');
  const [state, setState] = useState<'yukleniyor' | 'hazir' | 'hata'>('yukleniyor');

  useEffect(() => {
    if (mode !== '2d') return;
    let cancelled = false;
    loadKiCanvas()
      .then(() => !cancelled && setState('hazir'))
      .catch(() => !cancelled && setState('hata'));
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const view2d =
    state === 'hata' ? (
      <p className="p-6 text-sm text-hata">KiCad görüntüleyicisi yüklenemedi. Dosyayı indirip KiCad ile açabilirsin.</p>
    ) : state === 'yukleniyor' ? (
      <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-tebesir-silik" /></div>
    ) : (
      // Özel öğeler (web component) React'in JSX tiplerinde yok: createElement ile
      createElement(
        'kicanvas-embed',
        { controls: 'full', controlslist: 'nodownload', theme: 'kicad', key: url },
        createElement('kicanvas-source', { src: url, name: fileName })
      )
    );

  if (!isPcb) return view2d;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-levha-cizgi bg-levha-yuzey shrink-0">
        {([['3d', '3B görünüm'], ['2d', '2B katmanlar (KiCanvas)']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={`h-7 px-3 rounded text-xs font-medium transition-colors ${mode === id ? 'bg-levha text-isaret border border-levha-cizgi' : 'text-tebesir-silik hover:text-tebesir'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {mode === '3d' ? (
          <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-tebesir-silik" /></div>}>
            <Kicad3DView url={url} />
          </Suspense>
        ) : (
          view2d
        )}
      </div>
    </div>
  );
}
