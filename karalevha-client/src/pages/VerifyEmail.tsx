import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Email adresiniz doğrulanıyor...');

  const email = searchParams.get('email');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!email || !token) {
      setStatus('error');
      setMessage('Geçersiz doğrulama bağlantısı.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api<any>('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ email, token })
        });
        setStatus('success');
        setMessage(res.message || 'Email başarıyla doğrulandı, giriş yapabilirsiniz.');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Geçersiz veya süresi dolmuş bağlantı.');
      }
    };

    verify();
  }, [email, token]);

  return (
    <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-[#111216] border-2 border-[#1f2129] p-8 text-center relative z-10 animate-in zoom-in duration-300">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-[#ff5500] animate-spin mb-6" />
            <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">DOĞRULANIYOR</h1>
            <p className="text-zinc-400 font-medium">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-16 h-16 text-[#39ff14] mb-6" />
            <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">BAŞARILI</h1>
            <p className="text-zinc-400 font-medium mb-8">{message}</p>
            <Link 
              to="/auth"
              className="w-full inline-block py-4 text-[16px] font-black uppercase tracking-widest border-2 border-black bg-[#39ff14] text-black hover:bg-white hover:-translate-y-1 hover:shadow-[4px_4px_0px_#39ff14] transition-all"
            >
              GİRİŞ YAP
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <XCircle className="w-16 h-16 text-red-500 mb-6" />
            <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">HATA</h1>
            <p className="text-zinc-400 font-medium mb-8">{message}</p>
            <Link 
              to="/auth"
              className="w-full inline-block py-4 text-[16px] font-black uppercase tracking-widest border-2 border-black bg-zinc-800 text-white hover:bg-red-500 hover:-translate-y-1 hover:shadow-[4px_4px_0px_#ef4444] transition-all"
            >
              ANA SAYFAYA DÖN
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
