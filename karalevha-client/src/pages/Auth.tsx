import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isLogin = mode === 'giris';

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        const data = await api<{ user: User; token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ usernameOrEmail: email, password }),
        });
        login(data.user, data.token);
        navigate(returnTo, { replace: true });
      } else {
        const data = await api<{ message?: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, email, password }),
        });
        setMode('giris');
        setPassword('');
        setSuccessMsg(data.message || 'Kayıt başarılı. Şimdi giriş yapabilirsin.');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
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
            <p className="mt-5 rounded-md border border-hata/40 bg-hata/10 px-3 py-2 text-sm text-hata" role="alert">{errorMsg}</p>
          )}
          {successMsg && (
            <p className="mt-5 rounded-md border border-basari/40 bg-basari/10 px-3 py-2 text-sm text-basari" role="status">{successMsg}</p>
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
            <button type="submit" disabled={loading} className="btn-ana w-full mt-2">
              {loading ? 'Bekle…' : isLogin ? 'Giriş yap' : 'Hesap oluştur'}
            </button>
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
