import { useState } from 'react';
import { Hexagon, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Form States
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleToggle = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setErrorMsg('');
    setSuccessMsg('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const url = isLogin ? '/api/auth/login' : '/api/auth/register';

    const payload = isLogin
      ? { usernameOrEmail: email, password }
      : { username, email, password };

    try {
      const data = await api<any>(url, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!data) return; else {
        if (isLogin) {
          // Context üzerinden global state'i güncelle
          login(data.user, data.token);
          navigate('/');
        } else {
          setSuccessMsg(data.message || 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
          setIsLogin(true);
          setPassword('');
        }
      }
    } catch (error) {
      setErrorMsg('Sunucuya bağlanılamadı. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center p-4 selection:bg-cyan-500/30 font-sans">
      
      {/* Brutalist Container */}
      <div className="w-full max-w-[440px] bg-[#111216] border-2 border-[#1f2129] flex flex-col relative group transition-all duration-500 hover:border-cyan-400 shadow-xl">
        
        {/* Dekoratif Arka Plan Işığı */}
        <div className="absolute -inset-1 bg-cyan-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
        
        {/* Üst Kısım / Logo */}
        <div className="h-[100px] border-b-2 border-[#1f2129] flex flex-col items-center justify-center bg-[#0b0c10] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/forum.png')] bg-cover bg-center opacity-10 bg-blend-overlay"></div>
          <div className="relative z-10 flex items-center">
            <Hexagon className="w-8 h-8 text-cyan-400 mr-3" strokeWidth={2.5} />
            <h1 className="text-2xl font-black tracking-widest text-white uppercase">KaraLevha</h1>
          </div>
        </div>

        {/* Tab Menüsü */}
        <div className="flex border-b-2 border-[#1f2129]">
          <button 
            type="button"
            onClick={() => handleToggle(true)}
            className={`flex-1 py-4 text-[14px] font-black uppercase tracking-widest transition-colors ${
              isLogin 
                ? 'bg-cyan-400 text-black border-b-4 border-black' 
                : 'text-zinc-500 hover:text-white bg-transparent'
            }`}
          >
            Giriş Yap
          </button>
          <div className="w-[2px] bg-[#1f2129]"></div>
          <button 
            type="button"
            onClick={() => handleToggle(false)}
            className={`flex-1 py-4 text-[14px] font-black uppercase tracking-widest transition-colors ${
              !isLogin 
                ? 'bg-cyan-400 text-black border-b-4 border-black' 
                : 'text-zinc-500 hover:text-white bg-transparent'
            }`}
          >
            Kayıt Ol
          </button>
        </div>

        {/* Form Alanı */}
        <div className="p-8">
          
          {/* Uyarı Mesajları */}
          {errorMsg && (
            <div className="mb-6 p-3 bg-red-500/10 border-l-4 border-red-500 text-red-500 text-sm font-bold tracking-wide">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-3 bg-cyan-500/10 border-l-4 border-cyan-500 text-cyan-400 text-sm font-bold tracking-wide">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Kullanıcı Adı (Sadece Kayıtta) */}
            {!isLogin && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">Kullanıcı Adı</label>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınızı girin"
                  className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 transition-colors font-medium text-[15px]"
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">
                {isLogin ? 'E-Posta veya Kullanıcı Adı' : 'E-Posta'}
              </label>
              <input 
                type="text" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isLogin ? "Kullanıcı adı veya e-posta girin" : "E-posta adresinizi girin"}
                className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 transition-colors font-medium text-[15px]"
              />
            </div>

            {/* Şifre */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest flex justify-between">
                Şifre
                {isLogin && <a href="#" className="text-cyan-400 hover:underline">Şifremi Unuttum</a>}
              </label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0b0c10] border-2 border-[#1f2129] px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 transition-colors font-medium text-[15px]"
              />
            </div>

            {/* Aksiyon Butonu */}
            <button 
              type="submit"
              disabled={loading}
              className={`w-full mt-4 py-4 text-[16px] font-black uppercase tracking-widest transition-all duration-300 border-2 border-black flex items-center justify-center
                ${loading ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed' : 'bg-cyan-400 hover:bg-white text-black shadow-[6px_6px_0px_rgba(255,255,255,0.1)] hover:shadow-[8px_8px_0px_#00e5ff] hover:-translate-y-1 hover:-translate-x-1'}`}
            >
              {loading ? (
                'İŞLENİYOR...'
              ) : isLogin ? (
                <>
                  <LogIn className="w-5 h-5 mr-2" strokeWidth={3} />
                  GİRİŞ YAP
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" strokeWidth={3} />
                  KAYIT OL
                </>
              )}
            </button>
          </form>

          {/* Süsleme Çizgisi */}
          <div className="mt-8 border-t-2 border-dashed border-[#1f2129] pt-6 text-center">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center">
              KaraLevha'ya Hoş Geldiniz
              <ArrowRight className="w-4 h-4 ml-2 text-cyan-400" />
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
