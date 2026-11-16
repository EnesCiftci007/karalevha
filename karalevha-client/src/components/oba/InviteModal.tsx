import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import Modal from '../ui/Modal';

/** Kurucunun davet bağlantısı: kopyala ya da yenile (yenileyince eski bağlantı çalışmaz). */
export default function InviteModal({ obaId, onClose }: { obaId: number | string; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    api<{ code: string }>(`/api/obalar/${obaId}/davet`)
      .then((r) => setCode(r.code))
      .catch((err) => setError(err instanceof Error ? err.message : 'Davet bağlantısı alınamadı.'));
  }, [obaId]);

  const link = code ? `${window.location.origin}/e-oba/davet/${code}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Kopyalanamadı; bağlantıyı elle seç.');
    }
  };

  const renew = async () => {
    setRenewing(true);
    setError('');
    try {
      setCode((await api<{ code: string }>(`/api/obalar/${obaId}/davet/yenile`, { method: 'POST' })).code);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yenilenemedi.');
    } finally {
      setRenewing(false);
    }
  };

  return (
    <Modal title="Davet bağlantısı" onClose={onClose}>
      <div className="p-5 space-y-4">
        <p className="text-sm text-tebesir-soluk">Bağlantıya sahip olan herkes giriş yapıp obaya katılabilir. Şifre gerekmez.</p>
        <div className="flex gap-2">
          <input readOnly value={link} placeholder="Hazırlanıyor…" onFocus={(e) => e.target.select()} className="girdi font-mono text-xs" aria-label="Davet bağlantısı" />
          <button type="button" onClick={copy} disabled={!code} className="btn-ana shrink-0">
            {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-levha-cizgi">
          <p className="text-xs text-tebesir-silik">Bağlantı yanlış kişilere ulaştıysa yenile; eskisi çalışmaz.</p>
          <button type="button" onClick={renew} disabled={!code || renewing} className="btn-sade shrink-0">
            <RefreshCw className={`w-4 h-4 ${renewing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Yenile
          </button>
        </div>
      </div>
    </Modal>
  );
}
