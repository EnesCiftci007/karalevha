import { createElement, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import './kicanvas.css';

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
 * KiCad 6+ şema (.kicad_sch) ve PCB (.kicad_pcb) dosyasını sitede gösterir: yakınlaştırma, katmanlar,
 * bileşen ve ağ listeleri KiCanvas'tan gelir. KiCad 5 ve öncesi dosyalar okunamaz.
 */
export default function KicadViewer({ url, fileName }: { url: string; fileName: string }) {
  const [state, setState] = useState<'yukleniyor' | 'hazir' | 'hata'>('yukleniyor');

  useEffect(() => {
    let cancelled = false;
    loadKiCanvas()
      .then(() => !cancelled && setState('hazir'))
      .catch(() => !cancelled && setState('hata'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'hata') return <p className="p-6 text-sm text-hata">KiCad görüntüleyicisi yüklenemedi. Dosyayı indirip KiCad ile açabilirsin.</p>;
  if (state === 'yukleniyor') {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-tebesir-silik" /></div>;
  }
  // Özel öğeler (web component) React'in JSX tiplerinde yok: createElement ile
  return createElement(
    'kicanvas-embed',
    { controls: 'full', controlslist: 'nodownload', theme: 'kicad', key: url },
    createElement('kicanvas-source', { src: url, name: fileName })
  );
}
