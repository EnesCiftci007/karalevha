import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError, api } from '../services/api';
import { User } from '../types';
import Field from '../components/ui/Field';
import Tabs from '../components/ui/Tabs';
import { Logo, Mascot, Wordmark } from '../components/brand/Brand';

type Mode = 'giris' | 'kayit';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('giris');
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  // Giriş gerektiren bir yerden gelindiyse girişten sonra oraya dön
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Kayıtta şifre iki kez yazılır: yazım hatasıyla açılıp girilemeyen hesap olmasın
  const [passwordAgain, setPasswordAgain] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // Giriş, e-posta doğrulanmadığı için reddedildiyse bağlantıyı yeniden göndermek için adres
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const isLogin = mode === 'giris';

  const switchMode = (next: Mode) => {
    setMode(next);
    setUnverifiedEmail(null);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
    setPasswordAgain('');
  };

  // Tekrar alanına yazılmaya başlanınca ve uyuşmuyorsa alanın altında söylenir
  const mismatch = !isLogin && passwordAgain.length > 0 && passwordAgain !== password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && password !== passwordAgain) {
      setErrorMsg('Şifreler aynı değil. İkisini de aynı yaz.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setUnverifiedEmail(null);

    try {
      if (isLogin) {
        const data = await api<{ user: User; token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ usernameOrEmail: email, password }),
        });
        login(data.user);
        navigate(returnTo, { replace: true });
      } else {
        const data = await api<{ message?: string; requiresVerification?: boolean; email?: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, email, password }),
        });
        setMode('giris');
        setPassword('');
        setPasswordAgain('');
        setSuccessMsg(data.message || 'Kayıt başarılı. Şimdi giriş yapabilirsin.');
        // Doğrulama e-postası gelmezse buradan yeniden istenebilsin
        if (data.requiresVerification) setUnverifiedEmail(data.email ?? email);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Sunucuya bağlanılamadı.');
      if (error instanceof ApiError && error.body?.requiresVerification) {
        setUnverifiedEmail(String(error.body.email ?? ''));
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!unverifiedEmail) return;
    try {
      const data = await api<{ message: string }>('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      setErrorMsg('');
      setUnverifiedEmail(null);
      setSuccessMsg(data.message);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Gönderilemedi.');
    }
  };

  return (
    <div className="min-h-screen bg-levha flex flex-col">
      <div className="kareli fixed inset-x-0 top-0 h-80 pointer-events-none" aria-hidden="true" />

      <header className="relative px-4 sm:px-6 h-16 flex items-center">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-tebesir-soluk hover:text-tebesir transition-colors">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Siteye dön
        </Link>
      </header>

      <main className="relative flex-1 flex items-start sm:items-center justify-center px-4 pb-16 pt-6 sm:pt-0">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="KaraLevha ana sayfa">
              <Logo className="w-8 h-8 text-isaret" />
              <Wordmark className="text-lg" />
            </Link>
            <Mascot className="w-16 h-16" />
          </div>

          <h1 className="mb-6 font-display font-bold text-xl text-tebesir">
            {isLogin ? 'Giriş yap' : 'Kayıt ol'}
          </h1>

          <Tabs
            label="Hesap"
            value={mode}
            onChange={switchMode}
            options={[{ value: 'giris', label: 'Giriş yap' }, { value: 'kayit', label: 'Kayıt ol' }]}
          />

          {errorMsg && (
            <div className="mt-5 rounded-md border border-hata/40 bg-hata/10 px-3 py-2 text-sm text-hata" role="alert">
              <p>{errorMsg}</p>
              {unverifiedEmail && (
                <button type="button" onClick={resendVerification} className="mt-1.5 underline underline-offset-4 text-tebesir hover:text-isaret">
                  Doğrulama bağlantısını yeniden gönder
                </button>
              )}
            </div>
          )}
          {successMsg && (
            <div className="mt-5 rounded-md border border-basari/40 bg-basari/10 px-3 py-2 text-sm text-basari" role="status">
              <p>{successMsg}</p>
              {unverifiedEmail && !errorMsg && (
                <button type="button" onClick={resendVerification} className="mt-1.5 underline underline-offset-4 text-tebesir hover:text-isaret">
                  E-posta gelmedi mi? Yeniden gönder
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!isLogin && (
              <Field id="kullanici-adi" label="Kullanıcı adı">
                <input id="kullanici-adi" type="text" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="girdi" />
              </Field>
            )}
            <Field id="eposta" label={isLogin ? 'E-posta ya da kullanıcı adı' : 'E-posta'}>
              <input
                id="eposta"
                type={isLogin ? 'text' : 'email'}
                required
                autoComplete={isLogin ? 'username' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="girdi"
              />
            </Field>
            <Field id="sifre" label="Şifre">
              <input
                id="sifre"
                type="password"
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="girdi"
              />
            </Field>
            {!isLogin && (
              <Field id="sifre-tekrar" label="Şifre (tekrar)" error={mismatch ? 'Şifreler aynı değil.' : undefined}>
                <input
                  id="sifre-tekrar"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwordAgain}
                  onChange={(e) => setPasswordAgain(e.target.value)}
                  aria-invalid={mismatch}
                  className="girdi"
                />
              </Field>
            )}
            <button type="submit" disabled={loading} className="btn-ana w-full mt-2">
              {loading ? 'Bekle…' : isLogin ? 'Giriş yap' : 'Hesap oluştur'}
            </button>
            {!isLogin && (
              <p className="text-xs text-tebesir-silik">
                Kayıt olarak kişisel verilerinin <Link to="/gizlilik" className="underline underline-offset-4 hover:text-tebesir">Aydınlatma Metni</Link>'ndeki gibi işleneceğini öğrenmiş olursun.
              </p>
            )}
          </form>

          <p className="mt-8 text-sm text-tebesir-silik">
            <Link to="/" className="text-tebesir-soluk underline underline-offset-4 decoration-levha-cizgi hover:text-tebesir hover:decoration-tebesir-silik transition-colors">
              Üye olmadan gez
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
