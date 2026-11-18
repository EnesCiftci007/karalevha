import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { api } from '../../services/api';
import Field from './Field';
import Modal from './Modal';

export type ReportTarget = 'project' | 'model' | 'post' | 'comment' | 'obamessage' | 'user';

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam ya da reklam' },
  { id: 'uygunsuz', label: 'Uygunsuz içerik' },
  { id: 'taciz', label: 'Taciz ya da hakaret' },
  { id: 'telif', label: 'Başkasının işi (telif)' },
  { id: 'diger', label: 'Başka bir sorun' },
] as const;

export const TARGET_LABEL: Record<ReportTarget, string> = {
  project: 'Proje',
  model: '3B model',
  post: 'Gönderi',
  comment: 'Yorum',
  obamessage: 'Oba mesajı',
  user: 'Kullanıcı',
};

interface Pending {
  type: ReportTarget;
  id: number;
  /** Pencerede neyin bildirildiği, ör. projenin adı */
  title: string;
}

const ReportContext = createContext<(type: ReportTarget, id: number, title: string) => void>(() => {});

/** Herhangi bir içeriği bildirme penceresini açar: report('project', 12, 'Robot kol') */
export const useReport = () => useContext(ReportContext);

function ReportDialog({ target, onClose }: { target: Pending; onClose: () => void }) {
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await api<{ message: string }>('/api/sikayetler', {
        method: 'POST',
        body: JSON.stringify({ targetType: target.type, targetId: target.id, reason, note: note.trim() || null }),
      });
      setDone(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title={`${TARGET_LABEL[target.type]} bildir`} onClose={() => !sending && onClose()}>
      {done ? (
        <div className="p-5 space-y-4">
          <p className="text-sm text-tebesir-soluk" role="status">{done}</p>
          <div className="flex justify-end"><button type="button" onClick={onClose} className="btn-ana">Tamam</button></div>
        </div>
      ) : (
        <form onSubmit={send} className="p-5 space-y-4">
          <p className="text-sm text-tebesir-soluk">
            <span className="font-medium text-tebesir">{target.title}</span> kulüp yöneticilerine bildirilecek. Kimin bildirdiğini
            içeriğin sahibi görmez.
          </p>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-tebesir">Neden?</legend>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className="flex items-center gap-2.5 text-sm text-tebesir-soluk cursor-pointer">
                  <input type="radio" name="sikayet-neden" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="w-4 h-4 accent-isaret" />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="sikayet-not" label="Açıklama" note="isteğe bağlı">
            <textarea id="sikayet-not" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Yöneticinin bilmesi gereken bir şey varsa yaz." className="girdi resize-y" />
          </Field>
          {error && <p className="text-sm text-hata" role="alert">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={sending} className="btn-ikincil">Vazgeç</button>
            <button type="submit" disabled={!reason || sending} className="btn-ana">{sending ? 'Gönderiliyor…' : 'Bildir'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Bildirme penceresini uygulamanın her yerinde kullanılabilir yapar (App'te bir kez) */
export function ReportProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Pending | null>(null);
  const report = useCallback((type: ReportTarget, id: number, title: string) => setTarget({ type, id, title }), []);
  return (
    <ReportContext.Provider value={report}>
      {children}
      {target && <ReportDialog key={`${target.type}-${target.id}`} target={target} onClose={() => setTarget(null)} />}
    </ReportContext.Provider>
  );
}
