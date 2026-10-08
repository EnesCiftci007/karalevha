import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Ana Sayfa', path: '/' },
    { name: 'Akış', path: '/akis' },
    { name: 'Projeler', path: '/projeler' },
    { name: '3B Baskı', path: '/baski-istasyonu' },
    { name: 'E-Oba', path: '/e-oba' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <header className="h-16 bg-[#0b0c10] border-b-2 border-[#1f2129] flex items-center justify-between px-6 sticky top-0 z-20 shrink-0">
      
      {/* Sol Kısım: Logo & Linkler */}
      <div className="flex items-center space-x-8">
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="KaraLevha" className="w-8 h-8 mr-3 object-contain" />
          <span className="font-black text-[20px] tracking-widest text-white uppercase">KaraLevha</span>
        </div>
        
        <nav className="hidden md:flex items-center space-x-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `px-4 py-2 rounded-none text-[14px] font-bold uppercase tracking-wider transition-all duration-200 border-2 ` +
                (isActive 
                  ? 'bg-white text-black border-white shadow-[4px_4px_0px_rgba(255,255,255,0.2)]' 
                  : 'bg-transparent text-zinc-400 border-transparent hover:text-white hover:border-[#1f2129]')
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Sağ Kısım: Arama, Bildirimler, Profil */}
      <div className="flex items-center space-x-6">
        <div className="hidden lg:flex items-center text-zinc-400 focus-within:text-white transition-colors bg-[#13151a] border-2 border-[#1f2129] focus-within:border-cyan-400 px-3 py-1.5 rounded-none w-64">
          <Search className="w-4 h-4 mr-2" />
          <input 
            type="text" 
            placeholder="Ara..." 
            className="bg-transparent border-none outline-none text-[14px] font-medium w-full placeholder:text-zinc-600 text-white"
          />
        </div>

        {user ? (
          <>
            <button className="text-zinc-400 hover:text-white transition-colors relative">
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#ff0055] rounded-full border-2 border-[#0b0c10]"></span>
            </button>
            
            <div className="flex items-center space-x-3 border-2 border-[#1f2129] p-1 transition-all">
              <img 
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.avatarSeed || user.username}&backgroundColor=transparent`} 
                alt="Profile" 
                className="w-8 h-8 bg-zinc-800"
              />
              <Link to={`/profil/${user.username}`} className="text-[14px] font-black text-white uppercase tracking-widest hidden sm:block hover:text-[#00e5ff] transition-colors cursor-pointer">
                {user.username}
              </Link>
              <button onClick={handleLogout} className="text-zinc-500 hover:text-[#ff0055] p-1 ml-2 transition-colors" title="Çıkış Yap">
                <LogOut className="w-5 h-5" strokeWidth={3} />
              </button>
            </div>
          </>
        ) : (
          <button 
            onClick={() => navigate('/auth')}
            className="flex items-center bg-cyan-400 hover:bg-white text-black px-4 py-2 text-[14px] font-black uppercase tracking-widest transition-all duration-300 border-2 border-black hover:shadow-[4px_4px_0px_#00e5ff] hover:-translate-y-0.5 hover:-translate-x-0.5"
          >
            <User className="w-4 h-4 mr-2" strokeWidth={3} />
            GİRİŞ YAP
          </button>
        )}
      </div>
      
    </header>
  );
}
