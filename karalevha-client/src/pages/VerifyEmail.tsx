import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { Logo, Wordmark } from '../components/brand/Brand';

/** E-postadaki doğrulama bağlantısının açtığı sayfa: /verify-email?email=...&token=... */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<{ status: 'bekliyor' | 'tamam' | 'hata'; message: string }>({ status: 'bekliyor', message: '' });
  const [resent, setResent] = useState<string | null>(null);
  const email = params.get('email');

  // Süresi dolmuş ya da kullanılmış bağlantı: yenisi buradan istenebilsin
  const resend = async () => {
    if (!email) return;
    try {
      const d = await api<{ message: string }>('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
      setResent(d.message);
    } catch (err) {
      setResent(err instanceof Error ? err.message : 'Gönderilemedi.');
    }
  };

  useEffect(() => {
    const email = params.get('email');
    const token = params.get('token');
    if (!email || !token) {
      setState({ status: 'hata', message: 'Bağlantı eksik. E-postadaki bağlantıyı yeniden aç.' });
      return;
    }
    api<{ message: string }>('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, token }) })
      .then((d) => setState({ status: 'tamam', message: d.message }))
      .catch((err) => setState({ status: 'hata', message: err instanceof Error ? err.message : 'Doğrulanamadı.' }));
  }, [params]);

  return (
    <div className="min-h-screen bg-levha flex items-center justify-center px-4">
      <div className="w-full max-w-sm kart p-6">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6" aria-label="KaraLevha ana sayfa">
          <Logo className="w-7 h-7 text-isaret" />
          <Wordmark className="text-base" />
        </Link>
        <h1 className="font-display font-bold text-lg text-tebesir">E-posta doğrulama</h1>
        {state.status === 'bekliyor' ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-tebesir-soluk">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Doğrulanıyor…
          </p>
        ) : (
          <p role={state.status === 'hata' ? 'alert' : 'status'} className={`mt-3 text-sm ${state.status === 'hata' ? 'text-hata' : 'text-basari'}`}>
            {state.message}
          </p>
        )}
        {state.status === 'hata' && email && (
          resent ? (
            <p role="status" className="mt-3 text-sm text-tebesir-soluk">{resent}</p>
          ) : (
            <button type="button" onClick={resend} className="mt-3 text-sm underline underline-offset-4 text-tebesir hover:text-isaret">
              Yeni doğrulama bağlantısı gönder
            </button>
          )
        )}
        <Link to="/auth" className="btn-ana w-full mt-6">Giriş ekranına git</Link>
      </div>
    </div>
  );
}
