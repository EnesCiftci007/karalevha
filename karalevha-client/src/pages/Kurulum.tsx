import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Field from '../components/ui/Field';
import PageHeader from '../components/ui/PageHeader';

/**
 * /kurulum — kulübün ilk kurucusunu (Owner) atamak için tek seferlik sayfa. Yalnızca hiç Owner yokken ve
 * sunucuya kurulum anahtarı (Bootstrap__OwnerToken) verilmişken çalışır; Owner oluşunca kalıcı olarak kapanır.
 */
export default function Kurulum() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<{ hasOwner: boolean; setupEnabled: boolean } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoadError('');
    api<{ hasOwner: boolean; setupEnabled: boolean }>('/api/admin/owner-durumu')
      .then(setStatus)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Kurulum durumu alınamadı.'));
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api('/api/admin/owner-kurulum', { method: 'POST', body: JSON.stringify({ token: token.trim() }) });
      setToken('');
      await refreshUser();
      setStatus({ hasOwner: true, setupEnabled: true });
      setMessage({ ok: true, text: 'Kulübün kurucusu (Owner) oldun. Kurulum artık kapandı.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Kurulum yapılamadı.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md">
      <PageHeader title="Kulüp kurulumu" description="Kulübün ilk kurucusunu (Owner) bir kez atamak içindir." />
      {!user ? (
        <p className="text-sm text-tebesir-soluk">
          Önce kurucu olacak hesapla <Link to="/auth" state={{ from: '/kurulum' }} className="underline underline-offset-4 hover:text-tebesir">giriş yap</Link>.
        </p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-hata">{loadError}</p>
      ) : status === null ? null : status.hasOwner && !message?.ok ? (
        <p className="text-sm text-tebesir-soluk">Kulübün zaten bir kurucusu var; kurulum bir kez yapılır.</p>
      ) : !status.setupEnabled ? (
        <p className="text-sm text-tebesir-soluk">Kurulum kapalı. Sunucuya kurulum anahtarı (Bootstrap__OwnerToken) verilmemiş.</p>
      ) : message?.ok ? (
        <p className="text-sm text-basari" role="status">{message.text}</p>
      ) : (
        <form onSubmit={submit} className="kart p-5 space-y-4">
          <p className="text-sm text-tebesir-soluk"><span className="font-medium text-tebesir">{user.username}</span> hesabı kulübün kurucusu olacak.</p>
          <Field id="kurulum-anahtar" label="Kurulum anahtarı" hint="Sunucuya ortam değişkeni olarak verilen gizli anahtar.">
            <input id="kurulum-anahtar" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} className="girdi font-mono" />
          </Field>
          {message && <p className="text-sm text-hata" role="alert">{message.text}</p>}
          <button type="submit" disabled={busy || !token.trim()} className="btn-ana w-full justify-center">{busy ? 'Bekle…' : 'Kurucu ol'}</button>
        </form>
      )}
    </div>
  );
}
