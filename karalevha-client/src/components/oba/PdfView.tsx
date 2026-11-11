import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 60; // Çok uzun belgelerde tarayıcıyı kilitlememek için

/**
 * PDF'i tarayıcının gömülü eklentisine bırakmadan sayfa sayfa canvas'a çizer.
 * Böylece telefonlarda ve eklentisi olmayan tarayıcılarda da önizleme çalışır.
 */
export default function PdfView({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageInfo, setPageInfo] = useState<{ shown: number; total: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let loadingTask: pdfjs.PDFDocumentLoadingTask | null = null;

    (async () => {
      try {
        loadingTask = pdfjs.getDocument({ data: await blob.arrayBuffer() });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const total = pdf.numPages;
        const shown = Math.min(total, MAX_PAGES);
        setPageInfo({ shown, total });

        const targetWidth = Math.min(container.clientWidth - 32, 1000);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= shown; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;

          const cssScale = targetWidth / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: cssScale * pixelRatio });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
          canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
          canvas.className = 'block mx-auto mb-4 bg-white shadow-lg';
          container.appendChild(canvas);

          await page.render({ canvas, viewport }).promise;
          if (n === 1 && !cancelled) setStatus('ready');
        }
      } catch (e) {
        console.error('PDF gösterilemedi:', e);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy().catch(() => {});
      container.replaceChildren();
    };
  }, [blob]);

  return (
    <div className="w-full h-full overflow-auto relative">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#39ff14] animate-spin" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-red-500 font-bold uppercase tracking-widest text-sm text-center px-4">
            PDF açılamadı. Dosyayı indirip deneyebilirsiniz.
          </p>
        </div>
      )}
      <div ref={containerRef} className="p-4" />
      {status === 'ready' && pageInfo && pageInfo.shown < pageInfo.total && (
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest text-center pb-6">
          İlk {pageInfo.shown} sayfa gösteriliyor (toplam {pageInfo.total}). Tamamı için dosyayı indirin.
        </p>
      )}
    </div>
  );
}
