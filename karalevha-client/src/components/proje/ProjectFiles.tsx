import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Box, CircuitBoard, Code2, Download, File, FileCode2, FileText, Image as ImageIcon, Loader2, PenTool, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import { api, API_URL } from '../../services/api';
import { ProjectFile } from '../../types';
import { formatSize } from '../../services/files';
import { fullDate, timeAgo } from '../../utils/time';
import { languageOf } from '../kod/fileTypes';
import { cadFormatOf } from '../../utils/loadModel';
import { KIND_FORMATS, acceptOf, fits, loadFileTypes, type FileKind, type FileTypes } from '../../utils/projectFileTypes';
import EmptyState from '../ui/EmptyState';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import Skeleton from '../ui/Skeleton';
import ConfirmDialog from '../ui/ConfirmDialog';

const PdfView = lazy(() => import('../oba/PdfView'));
const CodeBlock = lazy(() => import('../kod/CodeBlock'));
const ModelViewerPanel = lazy(() => import('../modeller/ModelViewerPanel'));

const MAX_UPLOAD = 25 * 1024 * 1024; // Backend sınırıyla aynı
const MAX_CODE_VIEW = 1024 * 1024; // Daha büyük kod dosyası sitede açılmaz, indirilir

const urlOf = (f: ProjectFile) => `${API_URL}${f.fileUrl}`;
const isImage = (f: ProjectFile) => f.contentType.startsWith('image/');
const isPdf = (f: ProjectFile) => f.contentType === 'application/pdf';
/** STEP / IGES: sitede 3B açılır (büyük montajlar tarayıcıyı zorlar) */
const isCad = (f: ProjectFile) => !!cadFormatOf(f.fileName) && f.size <= 60 * 1024 * 1024;
const isText = (f: ProjectFile) => f.contentType === 'text/plain' && f.size <= MAX_CODE_VIEW;
const extOf = (f: ProjectFile) => (f.fileName.includes('.') ? f.fileName.slice(f.fileName.lastIndexOf('.') + 1) : '').toUpperCase();

const COPY: Record<FileKind, { icon: typeof PenTool; add: string; empty: string; tip: string }> = {
  cizim: {
    icon: PenTool,
    add: 'Çizim ya da CAD ekle',
    empty: 'Bu projede henüz çizim yok',
    tip: 'Teknik çizimler, CAD dosyaları ve robot tanımları burada durur. Sitede görünmesi için çizimin PDF ya da görsel çıktısını da ekle.',
  },
  elektronik: {
    icon: CircuitBoard,
    add: 'Devre dosyası ekle',
    empty: 'Bu projede henüz devre dosyası yok',
    tip: 'Şema, PCB ve Gerber dosyaları burada durur. Sitede görünmesi için şemanın PDF çıktısını ya da kartın fotoğrafını da ekle.',
  },
  kod: {
    icon: Code2,
    add: 'Kod dosyası ekle',
    empty: 'Bu projede henüz kod dosyası yok',
    tip: 'Kaynak dosyalar sitede renklendirilmiş olarak açılır. Büyük projeler için GitHub deposu bağlamak daha iyi.',
  },
};

/** Dosya türünün simgesi */
function KindIcon({ file, className }: { file: ProjectFile; className: string }) {
  if (isImage(file)) return <ImageIcon className={className} aria-hidden="true" />;
  if (isPdf(file)) return <FileText className={className} aria-hidden="true" />;
  if (file.contentType === 'text/plain') return <FileCode2 className={className} aria-hidden="true" />;
  if (file.kind === 'elektronik') return <CircuitBoard className={className} aria-hidden="true" />;
  if (file.kind === 'cizim') return <PenTool className={className} aria-hidden="true" />;
  return <File className={className} aria-hidden="true" />;
}

const Spinner = () => <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-tebesir-silik" /></div>;

/** PDF ya da kod dosyasını indirip sitede gösterir */
function FilePreview({ file }: { file: ProjectFile }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(urlOf(file))
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then(async (b) => {
        if (cancelled) return;
        if (isPdf(file)) setBlob(b);
        else setText(await b.text());
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [file]);
  if (failed) return <p className="p-6 text-sm text-hata">Dosya açılamadı. İndirip bakabilirsin.</p>;
  if (isPdf(file)) return blob ? <Suspense fallback={<Spinner />}><PdfView blob={blob} /></Suspense> : <Spinner />;
  if (text === null) return <Spinner />;
  return (
    <div className="max-h-[70vh] overflow-auto bg-levha-koyu">
      <Suspense fallback={<Spinner />}>
        <CodeBlock code={text} language={languageOf(file.fileName)} />
      </Suspense>
    </div>
  );
}

interface ProjectFilesProps {
  projectId: number;
  kind: FileKind;
  /** Proje sahibi ekler */
  canEdit: boolean;
  /** Sahibi ya da yönetici siler */
  canDelete: boolean;
  onCountChange?: (count: number) => void;
}

/**
 * Projenin dosya bölümlerinden biri: çizim/CAD, elektronik ya da kod.
 * Görseller, PDF'ler ve kod dosyaları sitede açılır; diğerleri (STEP, KiCad, Gerber…) indirilir.
 */
export default function ProjectFiles({ projectId, kind, canEdit, canDelete, onCountChange }: ProjectFilesProps) {
  const copy = COPY[kind];
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [types, setTypes] = useState<FileTypes | null>(null);
  const [viewing, setViewing] = useState<ProjectFile | null>(null);
  const [viewing3d, setViewing3d] = useState<ProjectFile | null>(null);
  const [deleting, setDeleting] = useState<ProjectFile | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      api<ProjectFile[]>(`/api/projects/${projectId}/dosyalar`)
        .then((all) => setFiles(all.filter((f) => (f.kind ?? 'cizim') === kind)))
        .catch(() => setFiles([])),
    [projectId, kind]
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (files) onCountChange?.(files.length);
  }, [files, onCountChange]);
  useEffect(() => {
    if (canEdit) loadFileTypes().then(setTypes).catch(() => {});
  }, [canEdit]);

  const pick = (picked: File | undefined | null) => {
    if (!picked) return;
    if (picked.size > MAX_UPLOAD) return setError(`Dosya en fazla ${formatSize(MAX_UPLOAD)} olabilir.`);
    if (types && !fits(types, picked.name, kind)) return setError(`Bu bölüme ${KIND_FORMATS[kind]}, görsel, PDF ya da ZIP eklenir.`);
    setError('');
    setFile(picked);
    setTitle((t) => t || picked.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (title.trim()) form.append('title', title.trim());
    try {
      const created = await api<ProjectFile>(`/api/projects/${projectId}/dosyalar`, { method: 'POST', body: form });
      setFiles((prev) => [created, ...(prev ?? [])]);
      setFile(null);
      setTitle('');
      setShowUpload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const images = (files ?? []).filter(isImage);
  const others = (files ?? []).filter((f) => !isImage(f));
  const opens = (f: ProjectFile) => isPdf(f) || isText(f);

  return (
    <div>
      {canEdit && files && files.length > 0 && (
        <div className="flex justify-end mb-4">
          <button type="button" onClick={() => setShowUpload(true)} className="btn-ikincil">
            <Plus className="w-4 h-4" aria-hidden="true" />
            {copy.add}
          </button>
        </div>
      )}

      {files === null ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/3]" />)}</div>
      ) : files.length === 0 ? (
        <EmptyState
          icon={copy.icon}
          title={copy.empty}
          description={`${copy.tip} Biçimler: ${KIND_FORMATS[kind]}.`}
          action={canEdit && <button type="button" onClick={() => setShowUpload(true)} className="btn-ikincil">{copy.add}</button>}
        />
      ) : (
        <div className="space-y-8">
          {/* Görseller: önizlemeli ızgara */}
          {images.length > 0 && (
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {images.map((f) => (
                <li key={f.id} className="kart overflow-hidden group">
                  <button type="button" onClick={() => setViewing(f)} className="block w-full" aria-label={`${f.title} görselini büyüt`}>
                    <img src={urlOf(f)} alt={f.title} loading="lazy" className="w-full aspect-[4/3] object-cover bg-levha-koyu group-hover:opacity-90 transition-opacity" />
                  </button>
                  <div className="px-3 py-2 flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm text-tebesir truncate" title={f.title}>{f.title}</span>
                    <span className="veri shrink-0">{extOf(f)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Belgeler, kaynak kod, CAD ve devre dosyaları: liste */}
          {others.length > 0 && (
            <ul className="kart divide-y divide-levha-cizgi">
              {others.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <KindIcon file={f} className="w-5 h-5 shrink-0 text-tebesir-silik" />
                  <span className="min-w-0 flex-1">
                    {isCad(f) ? (
                      <button type="button" onClick={() => setViewing3d(f)} className="block max-w-full text-sm font-medium text-tebesir hover:underline underline-offset-4 truncate text-left">{f.title}</button>
                    ) : opens(f) ? (
                      <button type="button" onClick={() => setViewing(f)} className="block max-w-full text-sm font-medium text-tebesir hover:underline underline-offset-4 truncate text-left">{f.title}</button>
                    ) : (
                      <span className="block text-sm font-medium text-tebesir truncate">{f.title}</span>
                    )}
                    <span className="block text-xs text-tebesir-silik truncate">
                      {f.fileName} · {formatSize(f.size)} · <time dateTime={f.uploadedAt} title={fullDate(f.uploadedAt)}>{timeAgo(f.uploadedAt)}</time>
                    </span>
                  </span>
                  {isCad(f) && (
                    <button type="button" onClick={() => setViewing3d(f)} className="btn-sade h-7 px-2 text-xs shrink-0" title="Sitede 3B olarak aç">
                      <Box className="w-3.5 h-3.5" aria-hidden="true" />3B
                    </button>
                  )}
                  <span className="veri shrink-0 hidden sm:inline">{extOf(f)}</span>
                  <a href={urlOf(f)} download={f.fileName} className="p-1.5 rounded text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey" aria-label={`${f.title} dosyasını indir`} title="İndir">
                    <Download className="w-4 h-4" />
                  </a>
                  {canDelete && (
                    <button type="button" onClick={() => setDeleting(f)} className="p-1.5 rounded text-tebesir-silik hover:text-hata hover:bg-levha-yuzey" aria-label={`${f.title} dosyasını sil`} title="Sil">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Görsel, PDF ya da kod görüntüleme */}
      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)} wide>
          {isImage(viewing) ? (
            <div className="bg-levha-koyu flex justify-center">
              <img src={urlOf(viewing)} alt={viewing.title} className="max-h-[75vh] max-w-full object-contain" />
            </div>
          ) : (
            <FilePreview file={viewing} />
          )}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-levha-cizgi">
            <span className="text-xs text-tebesir-silik truncate">{viewing.fileName} · {formatSize(viewing.size)} · {viewing.uploader}</span>
            <div className="flex items-center gap-2 shrink-0">
              {canDelete && (
                <button type="button" onClick={() => { setDeleting(viewing); setViewing(null); }} className="btn-sade text-hata">
                  <Trash2 className="w-4 h-4" aria-hidden="true" />Sil
                </button>
              )}
              <a href={urlOf(viewing)} download={viewing.fileName} className="btn-ikincil"><Download className="w-4 h-4" aria-hidden="true" />İndir</a>
            </div>
          </div>
        </Modal>
      )}

      {/* STEP / IGES: model görüntüleyicide */}
      {viewing3d && (
        <Suspense fallback={null}>
          <ModelViewerPanel
            title={viewing3d.title}
            meta={<>{extOf(viewing3d)} · {formatSize(viewing3d.size)} · {viewing3d.uploader}</>}
            url={urlOf(viewing3d)}
            format={cadFormatOf(viewing3d.fileName)!}
            unit="mm"
            onClose={() => setViewing3d(null)}
            actions={<a href={urlOf(viewing3d)} download={viewing3d.fileName} className="btn-ana w-full justify-center"><Download className="w-4 h-4" aria-hidden="true" />{extOf(viewing3d)} indir</a>}
          >
            <p className="text-xs text-tebesir-silik">CAD dosyası tarayıcıda üçgenlere çevrilerek gösterilir; ölçüler dosyanın biriminde (çoğunlukla mm).</p>
          </ModelViewerPanel>
        </Suspense>
      )}

      {/* Yükleme */}
      {showUpload && (
        <Modal title={copy.add} onClose={() => !uploading && setShowUpload(false)}>
          <form onSubmit={upload} className="p-5 space-y-4">
            <input ref={inputRef} type="file" accept={types ? acceptOf(types, kind) : undefined} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            {file ? (
              <div className="flex items-center gap-3 rounded-md border border-levha-cizgi bg-levha-koyu px-3 py-2.5">
                <File className="w-5 h-5 shrink-0 text-tebesir-silik" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-tebesir truncate">{file.name}</span>
                  <span className="block veri">{formatSize(file.size)}</span>
                </span>
                <button type="button" onClick={() => setFile(null)} className="p-1 text-tebesir-silik hover:text-tebesir" aria-label="Dosyayı kaldır"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0]); }}
                className={`w-full rounded-md border border-dashed px-4 py-8 text-center transition-colors ${dragOver ? 'border-isaret bg-isaret/5' : 'border-levha-cizgi hover:border-tebesir-silik'}`}
              >
                <UploadCloud className="w-6 h-6 mx-auto mb-2 text-tebesir-silik" strokeWidth={1.5} aria-hidden="true" />
                <span className="block text-sm font-medium text-tebesir">Dosyayı sürükle ya da seç</span>
                <span className="block mt-1 text-xs text-tebesir-silik">{KIND_FORMATS[kind]}, görsel, PDF, ZIP · en fazla {formatSize(MAX_UPLOAD)}</span>
              </button>
            )}
            <Field id={`dosya-baslik-${kind}`} label="Başlık" note="isteğe bağlı">
              <input id={`dosya-baslik-${kind}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ör. motor sürücü şeması" className="girdi" />
            </Field>
            {error && <p className="text-sm text-hata" role="alert">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowUpload(false)} disabled={uploading} className="btn-ikincil">Vazgeç</button>
              <button type="submit" disabled={uploading || !file} className="btn-ana">{uploading ? 'Yükleniyor…' : 'Ekle'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Dosya silinsin mi?"
          confirmLabel="Sil"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`/api/projects/${projectId}/dosyalar/${deleting.id}`, { method: 'DELETE' });
            setFiles((prev) => (prev ?? []).filter((f) => f.id !== deleting.id));
          }}
        >
          <span className="font-medium text-tebesir">{deleting.title}</span> kalıcı olarak silinecek.
        </ConfirmDialog>
      )}
    </div>
  );
}
