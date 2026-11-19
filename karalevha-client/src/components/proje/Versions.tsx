import { useEffect, useRef, useState } from 'react';
import { Download, File, History, UploadCloud, X } from 'lucide-react';
import { api, API_URL } from '../../services/api';
import { formatSize } from '../../services/files';
import { fullDate, timeAgo } from '../../utils/time';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import Skeleton from '../ui/Skeleton';

export interface FileVersionItem {
  id: number;
  version: number;
  fileName: string;
  fileUrl: string;
  size: number;
  note: string | null;
  createdAt: string;
  uploader: string | null;
}

/** "v3" rozeti: sürüm geçmişini açar (yalnızca birden fazla sürüm varsa) */
export function VersionBadge({ version, onClick }: { version?: number; onClick: () => void }) {
  if (!version || version < 2) return null;
  return (
    <button type="button" onClick={onClick} className="veri shrink-0 hover:text-isaret" title="Sürüm geçmişi">
      v{version}
    </button>
  );
}

/** Yeni sürüm yükleme: o anki dosya geçmişe taşınır, bağlantılar ve yorumlar aynı kalır */
export function VersionUploadModal({ title, endpoint, accept, maxBytes, onClose, onDone }: {
  title: string;
  /** ör. /api/projects/3/dosyalar/7/surum ya da /api/printmodels/5/surum */
  endpoint: string;
  accept?: string;
  maxBytes: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > maxBytes) return setError(`Dosya en fazla ${formatSize(maxBytes)} olabilir.`);
    setError('');
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || saving) return;
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    if (note.trim()) form.append('note', note.trim());
    try {
      await api(endpoint, { method: 'POST', body: form });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal title={`Yeni sürüm: ${title}`} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <p className="text-sm text-tebesir-soluk">Şimdiki dosya silinmez, sürüm geçmişinde kalır ve indirilebilir.</p>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
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
          <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-md border border-dashed border-levha-cizgi hover:border-tebesir-silik px-4 py-7 text-center transition-colors">
            <UploadCloud className="w-6 h-6 mx-auto mb-2 text-tebesir-silik" strokeWidth={1.5} aria-hidden="true" />
            <span className="block text-sm font-medium text-tebesir">Yeni sürümün dosyasını seç</span>
          </button>
        )}
        <Field id="surum-not" label="Ne değişti?" note="isteğe bağlı">
          <input id="surum-not" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ör. motor yuvası 2 mm genişletildi" className="girdi" />
        </Field>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ikincil">Vazgeç</button>
          <button type="submit" disabled={!file || saving} className="btn-ana">{saving ? 'Yükleniyor…' : 'Yükle'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Sürüm geçmişi: şimdiki sürüm ve eskileri, notları ve indirme bağlantılarıyla */
export function VersionHistoryModal({ title, endpoint, current, onClose }: {
  title: string;
  /** ör. /api/projects/3/dosyalar/7/surumler */
  endpoint: string;
  current: { version: number; note?: string | null; fileName: string; fileUrl: string; uploader: string; uploadedAt: string };
  onClose: () => void;
}) {
  const [items, setItems] = useState<FileVersionItem[] | null>(null);
  useEffect(() => {
    api<FileVersionItem[]>(endpoint).then(setItems).catch(() => setItems([]));
  }, [endpoint]);

  const row = (v: { version: number; note?: string | null; fileName: string; fileUrl: string; uploader: string | null; date: string; size?: number }, latest: boolean) => (
    <li key={v.version} className="flex items-start gap-3 px-4 py-3">
      <span className={`veri w-8 shrink-0 ${latest ? 'text-isaret' : ''}`}>v{v.version}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-tebesir">{v.note || (latest ? 'Şimdiki sürüm' : 'Not yazılmamış')}</span>
        <span className="block text-xs text-tebesir-silik truncate">
          {v.fileName}{v.size ? ` · ${formatSize(v.size)}` : ''} · {v.uploader ?? 'silinmiş hesap'} ·{' '}
          <time dateTime={v.date} title={fullDate(v.date)}>{timeAgo(v.date)}</time>
        </span>
      </span>
      <a href={`${API_URL}${v.fileUrl}`} download={v.fileName} className="p-1.5 rounded text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey" aria-label={`v${v.version} indir`} title="İndir">
        <Download className="w-4 h-4" />
      </a>
    </li>
  );

  return (
    <Modal title={`Sürüm geçmişi: ${title}`} onClose={onClose}>
      <div className="p-5">
        <p className="mb-3 flex items-center gap-2 text-sm text-tebesir-soluk">
          <History className="w-4 h-4" aria-hidden="true" /> Yeniden eskiye. Eski sürümler indirilebilir.
        </p>
        {items === null ? (
          <Skeleton className="h-24" />
        ) : (
          <ul className="kart divide-y divide-levha-cizgi">
            {row({ ...current, date: current.uploadedAt }, true)}
            {items.map((v) => row({ ...v, date: v.createdAt }, false))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
