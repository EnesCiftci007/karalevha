import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import { api, apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Field from '../ui/Field';
import Modal from '../ui/Modal';

/**
 * Profilde yalnızca kişinin kendisine görünen "Hesap" bölümü: verilerini indirmek ve hesabını silmek
 * (KVKK madde 11). Silme şifre ve kullanıcı adıyla onaylanır.
 */
export default function AccountPanel({ username }: { username: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      const res = await apiFetch('/api/auth/verilerim');
      if (!res.ok) throw new Error('Veriler hazırlanamadı.');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `karalevha-verilerim-${username}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'İndirilemedi.');
    } finally {
      setDownloading(false);
    }
  };

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typed !== username || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/hesabi-sil', { method: 'POST', body: JSON.stringify({ password }) });
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesap silinemedi.');
      setBusy(false);
    }
  };

  return (
    <section className="kart p-4 mb-8">
      <h2 className="text-sm font-semibold text-tebesir mb-1">Hesap</h2>
      <p className="text-xs text-tebesir-silik mb-3">
        Verilerin nasıl işlendiğini <Link to="/gizlilik" className="underline underline-offset-4 hover:text-tebesir">aydınlatma metninde</Link> okuyabilirsin.
      </p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={download} disabled={downloading} className="btn-ikincil justify-start">
          <Download className="w-4 h-4" aria-hidden="true" />{downloading ? 'Hazırlanıyor…' : 'Verilerimi indir'}
        </button>
        <button type="button" onClick={() => setDeleting(true)} className="btn-sade justify-start text-hata">
          <Trash2 className="w-4 h-4" aria-hidden="true" />Hesabımı sil
        </button>
      </div>
      {downloadError && <p className="mt-2 text-xs text-hata" role="alert">{downloadError}</p>}

      {deleting && (
        <Modal title="Hesabını sil" onClose={() => !busy && setDeleting(false)}>
          <form onSubmit={remove} className="p-5 space-y-4">
            <div className="text-sm text-tebesir-soluk space-y-2">
              <p>Hesabın ve verilerin <strong className="text-tebesir">kalıcı olarak</strong> silinir; geri alınamaz:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Gönderilerin, yorumların, beğenilerin, oba mesajların, baskı fotoğrafların, siparişlerin ve rezervasyonların silinir.</li>
                <li>Ekibi olmayan projelerin ve üyesi olmayan obaların silinir.</li>
                <li>Ekibi olan projelerin ve üyesi olan obaların en eski üyeye devredilir; başkasının projesine yüklediklerin o projede kalır.</li>
              </ul>
              <p>İstersen önce <button type="button" onClick={download} className="underline underline-offset-4 hover:text-tebesir">verilerini indir</button>.</p>
            </div>
            <Field id="sil-sifre" label="Şifren">
              <input id="sil-sifre" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="girdi" />
            </Field>
            <Field id="sil-ad" label={`Onaylamak için kullanıcı adını yaz: ${username}`}>
              <input id="sil-ad" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="girdi" />
            </Field>
            {error && <p className="text-sm text-hata" role="alert">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeleting(false)} disabled={busy} className="btn-ikincil">Vazgeç</button>
              <button type="submit" disabled={busy || !password || typed !== username} className="btn-ana !bg-hata !text-tebesir">
                {busy ? 'Siliniyor…' : 'Hesabımı kalıcı olarak sil'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
