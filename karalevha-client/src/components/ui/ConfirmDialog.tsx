import { useState, type ReactNode } from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Silme gibi geri alınamaz işlemler kırmızı butonla gösterilir */
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Onay penceresi. İşlem sürerken kapanmaz; hata olursa pencerede gösterir. */
export default function ConfirmDialog({ title, children, confirmLabel, danger = true, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <div className="p-5 space-y-4">
        <div className="text-sm text-tebesir-soluk">{children}</div>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ikincil">Vazgeç</button>
          <button type="button" onClick={run} disabled={busy} className={danger ? 'btn-tehlike' : 'btn-ana'}>
            {busy ? 'Bekle…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
