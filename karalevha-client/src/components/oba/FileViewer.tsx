import { Suspense, lazy, useEffect, useState } from 'react';
import { Download, FileQuestion, Loader2, X } from 'lucide-react';
import StlPreview from '../StlPreview';
import { ObaFile, downloadObaFile, fetchObaFile, fileKind, formatSize } from '../../services/files';

interface FileViewerProps {
  messageId: number;
  file: ObaFile;
  onClose: () => void;
}

// pdf.js büyük bir kütüphane; sadece bir PDF açıldığında indirilsin
const PdfView = lazy(() => import('./PdfView'));

const MAX_TEXT_PREVIEW = 300_000; // karakter; daha uzun metinler kırpılır

/** Sohbette paylaşılan dosyayı indirmeden, uygulama içinde gösteren pencere. */
export default function FileViewer({ messageId, file, onClose }: FileViewerProps) {
  const kind = fileKind(file);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    fetchObaFile(messageId)
      .then(async (data) => {
        if (cancelled) return;
        setBlob(data);
        if (kind === 'text') {
          const content = await data.text();
          if (!cancelled) setText(content);
        } else if (kind !== 'other' && kind !== 'pdf') {
          objectUrl = URL.createObjectURL(data);
          setUrl(objectUrl);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready =
    kind === 'other' || kind === 'pdf' ? blob !== null : kind === 'text' ? text !== null : url !== null;
  const spinner = <Loader2 className="w-10 h-10 text-[#39ff14] animate-spin" />;

  const renderBody = () => {
    if (error) {
      return <p className="text-red-500 font-bold uppercase tracking-widest text-sm">{error}</p>;
    }
    if (!ready) {
      return spinner;
    }
    switch (kind) {
      case 'image':
        return <img src={url!} alt={file.name} className="max-w-full max-h-full object-contain" />;
      case 'pdf':
        return (
          <Suspense fallback={spinner}>
            <PdfView blob={blob!} />
          </Suspense>
        );
      case 'video':
        return <video src={url!} controls className="max-w-full max-h-full" />;
      case 'audio':
        return <audio src={url!} controls className="w-full max-w-xl" />;
      case 'stl':
        return <StlPreview url={url!} color="#39ff14" />;
      case 'text':
        return (
          <pre className="w-full h-full overflow-auto p-4 text-[13px] leading-relaxed text-zinc-200 font-mono whitespace-pre-wrap break-words self-start">
            {text!.length > MAX_TEXT_PREVIEW
              ? `${text!.slice(0, MAX_TEXT_PREVIEW)}\n\n… (dosyanın devamı için indirin)`
              : text}
          </pre>
        );
      default:
        return (
          <div className="text-center text-zinc-400">
            <FileQuestion className="w-14 h-14 mx-auto mb-4 opacity-60" />
            <p className="font-bold uppercase tracking-widest text-sm mb-1">Bu dosya türü için önizleme yok</p>
            <p className="text-xs text-zinc-500">Dosyayı indirip kendi programınızla açabilirsiniz.</p>
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={file.name}
    >
      <div
        className="w-full max-w-5xl h-[90vh] bg-[#111216] border-2 border-[#1f2129] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b-2 border-[#1f2129] flex-shrink-0">
          <div className="min-w-0 mr-4">
            <p className="text-white font-black tracking-wide truncate">{file.name}</p>
            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">{formatSize(file.size)}</p>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => downloadObaFile(messageId, file.name, blob ?? undefined).catch((e: Error) => setError(e.message))}
              className="flex items-center bg-[#39ff14] hover:bg-white text-black px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-colors border-2 border-black"
            >
              <Download className="w-4 h-4 sm:mr-2" strokeWidth={3} />
              <span className="hidden sm:inline">İndir</span>
            </button>
            <button type="button" onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white" aria-label="Kapat">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-[#0b0c10] flex items-center justify-center overflow-hidden">
          {renderBody()}
        </div>
      </div>
    </div>
  );
}
