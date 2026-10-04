import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="flex flex-col items-center py-10 px-4 max-w-[1250px] mx-auto animate-in fade-in duration-300">
      
      {/* Hero Section */}
      <div className="text-center max-w-3xl mb-14 relative">
        <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 mb-6 tracking-tighter uppercase">
          KaraLevha'ya Hoş Geldin
        </h1>
        <p className="text-zinc-400 text-[16px] md:text-[18px] font-medium leading-relaxed tracking-wide">
          Burası makerlar, yazılımcılar ve donanım geliştiricileri için dijital bir buluşma noktasıdır. 
          Kendi Oba'nı kur, projelere katıl ve üretmeye başla!
        </p>
      </div>

      {/* Cards Grid - Sokak Tarzı (Brutalist/Neon) */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        
        {/* 1. Akış Kartı (Neon Turuncu) */}
        <Link to="/akis" className="group h-[340px] bg-[#111216] flex flex-col transition-all duration-300 ease-out hover:-translate-y-2 hover:-translate-x-2 border-2 border-[#ff5500]/50 hover:border-[#ff5500] hover:shadow-[8px_8px_0px_#ff5500]">
          <div className="flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1">
            <img src="/forum.png" alt="Akış" className="w-full h-full object-cover group-hover:scale-110 group-hover:rotate-1 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
          </div>
          <div className="h-[70px] bg-[#0b0c10] flex flex-col justify-center px-5 border-t-2 border-[#ff5500]/50 group-hover:border-[#ff5500] transition-colors relative overflow-hidden">
            <span className="text-white font-black uppercase text-[18px] tracking-widest relative z-10">Akış</span>
            <span className="text-[#ff5500] text-xs font-bold uppercase tracking-widest relative z-10">Meydan</span>
            <div className="absolute inset-0 bg-[#ff5500]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </div>
        </Link>

        {/* 2. Projeler Kartı (Neon Mavi/Cyan) */}
        <Link to="/projeler" className="group h-[340px] bg-[#111216] flex flex-col transition-all duration-300 ease-out hover:-translate-y-2 hover:-translate-x-2 border-2 border-[#00e5ff]/50 hover:border-[#00e5ff] hover:shadow-[8px_8px_0px_#00e5ff]">
          <div className="flex-1 w-full h-full flex items-center justify-center bg-[url('/baskikorsanlari.png')] bg-cover bg-center bg-blend-overlay bg-[#00e5ff]/5 group-hover:bg-[#00e5ff]/10 transition-colors">
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_15px_rgba(0,229,255,0.8)]">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div className="h-[70px] bg-[#0b0c10] flex flex-col justify-center px-5 border-t-2 border-[#00e5ff]/50 group-hover:border-[#00e5ff] transition-colors relative overflow-hidden">
            <span className="text-white font-black uppercase text-[18px] tracking-widest relative z-10">Projeler</span>
            <span className="text-[#00e5ff] text-xs font-bold uppercase tracking-widest relative z-10">Açık Kaynak</span>
            <div className="absolute inset-0 bg-[#00e5ff]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </div>
        </Link>

        {/* 3. 3B Baskı Kartı (Neon Mor) */}
        <Link to="/baski-istasyonu" className="group h-[340px] bg-[#111216] flex flex-col transition-all duration-300 ease-out hover:-translate-y-2 hover:-translate-x-2 border-2 border-[#a855f7]/50 hover:border-[#a855f7] hover:shadow-[8px_8px_0px_#a855f7]">
          <div className="flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1">
            <img src="/baski.png" alt="3B Baskı İstasyonu" className="w-full h-full object-cover group-hover:scale-110 group-hover:-rotate-1 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
          </div>
          <div className="h-[70px] bg-[#0b0c10] flex flex-col justify-center px-5 border-t-2 border-[#a855f7]/50 group-hover:border-[#a855f7] transition-colors relative overflow-hidden">
            <span className="text-white font-black uppercase text-[18px] tracking-widest relative z-10">3B Baskı</span>
            <span className="text-[#a855f7] text-xs font-bold uppercase tracking-widest relative z-10">İstasyon</span>
            <div className="absolute inset-0 bg-[#a855f7]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </div>
        </Link>

        {/* 4. E-Oba Kartı (Neon Yeşil) */}
        <Link to="/e-oba" className="group h-[340px] bg-[#111216] flex flex-col transition-all duration-300 ease-out hover:-translate-y-2 hover:-translate-x-2 border-2 border-[#39ff14]/50 hover:border-[#39ff14] hover:shadow-[8px_8px_0px_#39ff14]">
          <div className="flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1">
            <img src="/eoba.jpg" alt="E-Oba" className="w-full h-full object-cover group-hover:scale-110 group-hover:rotate-1 transition-transform duration-500 opacity-80 group-hover:opacity-100 filter contrast-125" />
          </div>
          <div className="h-[70px] bg-[#0b0c10] flex flex-col justify-center px-5 border-t-2 border-[#39ff14]/50 group-hover:border-[#39ff14] transition-colors relative overflow-hidden">
            <span className="text-white font-black uppercase text-[18px] tracking-widest relative z-10">E-Oba</span>
            <span className="text-[#39ff14] text-xs font-bold uppercase tracking-widest relative z-10">Sunucular</span>
            <div className="absolute inset-0 bg-[#39ff14]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </div>
        </Link>

      </div>
    </div>
  );
}
