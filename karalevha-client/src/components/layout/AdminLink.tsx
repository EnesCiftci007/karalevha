import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';

/** Yöneticilere menüde şikâyet kutusu; bekleyen varsa sayısı */
export default function AdminLink() {
  const [count, setCount] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => api<{ count: number }>('/api/sikayetler/sayi').then((r) => !cancelled && setCount(r.count)).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('sikayetler:degisti', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('sikayetler:degisti', refresh);
    };
  }, [pathname]);

  return (
    <Link
      to="/yonetim"
      className="relative p-2 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors"
      title={count ? `Yönetim: ${count} bekleyen şikâyet` : 'Yönetim'}
      aria-label={count ? `Yönetim, ${count} bekleyen şikâyet` : 'Yönetim'}
    >
      <ShieldAlert className="w-5 h-5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-isaret text-levha text-[10px] font-bold leading-4 text-center">{count}</span>
      )}
    </Link>
  );
}
