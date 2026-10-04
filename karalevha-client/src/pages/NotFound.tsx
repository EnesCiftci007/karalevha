import { Link } from 'react-router-dom';

export const NotFound = () => {
  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-[#0b0c10]">
      <h1 className="text-[#a855f7] text-6xl font-black mb-4 tracking-tighter">404</h1>
      <h2 className="text-white text-xl font-bold uppercase tracking-widest mb-8">Sayfa Bulunamadı</h2>
      <Link 
        to="/" 
        className="px-6 py-3 border-2 border-[#1f2129] text-zinc-400 hover:text-white hover:border-[#a855f7] transition-colors font-bold tracking-widest uppercase text-sm"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
};
