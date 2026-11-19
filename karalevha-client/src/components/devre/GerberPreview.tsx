import { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const Gerber3DView = lazy(() => import('./Gerber3DView'));

/** Gerber ve delik dosyası uzantıları (ZIP içinden seçilenler) */
const GERBER_EXT = /\.(gbr|ger|gtl|gbl|gto|gbo|gts|gbs|gtp|gbp|gko|gm1|gml|gm|gml|drl|xln|exc|txt|cmp|sol|stc|sts|plc|pls|crc|crs|art|pho)$/i;

type ViewMode = 'top' | 'bottom' | '3d';

/**
 * Gerber üretim dosyalarından kartın üst, alt ve 3B görünümünü çizer (tracespace, MIT). Bir ZIP (bütün katmanlar)
 * ya da tek bir Gerber katmanı alır; okuyucu, ZIP açıcı ve 3B sahne yalnızca gerektiğinde yüklenir.
 */
export default function GerberPreview({ url, fileName }: { url: string; fileName: string }) {
  const [svgs, setSvgs] = useState<{ top: string; bottom: string } | null>(null);
  const [layerCount, setLayerCount] = useState(0);
  const [mode, setMode] = useState<ViewMode>('top');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Dosya indirilemedi.');
        const bytes = new Uint8Array(await res.arrayBuffer());

        let files: File[];
        if (/\.zip$/i.test(fileName)) {
          const { unzipSync } = await import('fflate');
          const entries = unzipSync(bytes, {
            // Klasörler, macOS çöpü ve gerber olmayanlar atlanır; çok büyük girdi açılmaz
            filter: (f) => !f.name.endsWith('/') && !f.name.includes('__MACOSX') && GERBER_EXT.test(f.name) && f.originalSize < 20 * 1024 * 1024,
          });
          files = Object.entries(entries).map(([name, data]) => new File([data], name.split('/').pop() ?? name));
        } else {
          files = [new File([bytes], fileName)];
        }
        if (files.length === 0) throw new Error('ZIP içinde Gerber ya da delik dosyası bulunamadı.');

        const { read, plot, renderLayers, renderBoard, stringifySvg } = await import('@tracespace/core');
        const readResult = await read(files);
        const board = renderBoard(renderLayers(plot(readResult)));
        if (cancelled) return;
        setLayerCount(readResult.layers.length);
        setSvgs({ top: stringifySvg(board.top), bottom: stringifySvg(board.bottom) });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gerber dosyaları okunamadı.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, fileName]);

  if (error) return <p className="p-6 text-sm text-hata">{error} Dosyayı indirip bir Gerber görüntüleyicide açabilirsin.</p>;
  if (!svgs) return <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-tebesir-silik" /></div>;

  const tabs: { id: ViewMode; label: string }[] = [
    { id: 'top', label: 'Üst yüz' },
    { id: 'bottom', label: 'Alt yüz' },
    { id: '3d', label: '3B görünüm' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-levha-cizgi">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            aria-pressed={mode === t.id}
            className={`h-7 px-3 rounded text-xs font-medium transition-colors ${mode === t.id ? 'bg-levha-yuzey text-tebesir' : 'text-tebesir-silik hover:text-tebesir'}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto veri">{layerCount} katman</span>
      </div>
      {mode === '3d' ? (
        <div className="flex-1 min-h-0">
          <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-tebesir-silik" /></div>}>
            <Gerber3DView topSvg={svgs.top} bottomSvg={svgs.bottom} />
          </Suspense>
        </div>
      ) : (
        /* tracespace'in ürettiği SVG yalnızca çizim öğeleri içerir; img ile gösterilir (betik çalışmaz) */
        <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-[#0b2a16]">
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs[mode])}`}
            alt={`${fileName} — ${mode === 'top' ? 'üst' : 'alt'} yüz`}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
