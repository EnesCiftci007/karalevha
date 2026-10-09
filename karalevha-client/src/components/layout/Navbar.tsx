import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      setShowResults(true);
      try {
        const results = await api<any[]>(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal
        });
        setSearchResults(results);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Arama hatası", err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [searchQuery]);

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
        <div ref={searchRef} className="relative hidden lg:block">
          <div className="flex items-center text-zinc-400 focus-within:text-white transition-colors bg-[#13151a] border-2 border-[#1f2129] focus-within:border-cyan-400 px-3 py-1.5 rounded-none w-64">
            <Search className="w-4 h-4 mr-2" />
            <input 
              type="text" 
              placeholder="Ara..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if(searchQuery.trim().length >= 2) setShowResults(true); }}
              className="bg-transparent border-none outline-none text-[14px] font-medium w-full placeholder:text-zinc-600 text-white"
            />
          </div>
          
          {showResults && (
            <div className="absolute top-full left-0 mt-2 w-full bg-[#0b0c10] border-2 border-[#1f2129] shadow-[4px_4px_0px_rgba(0,229,255,0.2)] z-50 max-h-80 overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-zinc-500 text-[13px] font-bold">ARANIYOR...</div>
              ) : searchResults.length > 0 ? (
                <div className="flex flex-col">
                  {searchResults.map(resultUser => (
                    <div 
                      key={resultUser.username}
                      onClick={() => {
                        setShowResults(false);
                        setSearchQuery('');
                        navigate(`/profil/${resultUser.username}`);
                      }}
                      className="flex items-center p-3 hover:bg-[#13151a] border-b border-[#1f2129] last:border-b-0 cursor-pointer transition-colors group"
                    >
                      <img 
                        src={`https://api.dicebear.com/7.x/bottts/svg?seed=${resultUser.avatarSeed || resultUser.username}&backgroundColor=transparent`}
                        alt={resultUser.username}
                        className="w-8 h-8 bg-zinc-800 mr-3 group-hover:scale-110 transition-transform"
                      />
                      <span className="text-white font-black text-[13px] uppercase tracking-widest group-hover:text-cyan-400 transition-colors">
                        {resultUser.username}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-zinc-500 text-[13px] font-bold">SONUÇ BULUNAMADI</div>
              )}
            </div>
          )}
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
