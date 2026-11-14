import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';
import { Logo, Wordmark } from '../brand/Brand';

const menuItems = [
  { name: 'Ana sayfa', path: '/', end: true },
  { name: 'Akış', path: '/akis' },
  { name: 'Projeler', path: '/projeler' },
  { name: '3B Modeller', path: '/baski-istasyonu' },
  { name: 'E-Oba', path: '/e-oba' },
  { name: 'Atölye', path: '/atolye' },
  { name: 'Etkinlikler', path: '/etkinlikler' },
];

/** Üst menüdeki arama kutusu; Enter ile /ara sayfasına gider. "/" tuşu kutuya odaklanır. */
function SearchBox({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => (location.pathname === '/ara' ? new URLSearchParams(location.search).get('q') ?? '' : ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        if (term.length < 2) return;
        navigate(`/ara?q=${encodeURIComponent(term)}`);
        inputRef.current?.blur();
        onDone?.();
      }}
      className="relative w-full"
    >
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tebesir-silik pointer-events-none" aria-hidden="true" />
      <label htmlFor="genel-arama" className="sr-only">Sitede ara</label>
      <input
        id="genel-arama"
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ara"
        className="girdi h-8 pl-8 pr-8 bg-levha-yuzey"
      />
      <kbd className="hidden xl:block absolute right-2 top-1/2 -translate-y-1/2 veri px-1.5 rounded border border-levha-cizgi" aria-hidden="true">/</kbd>
    </form>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/'); // çıkıştan sonra giriş ekranına atma, sitede kal
  };

  return (
    <header className="sticky top-0 z-20 shrink-0 bg-levha/95 backdrop-blur border-b border-levha-cizgi">
      <div className="max-w-sayfa mx-auto h-16 px-4 sm:px-6 flex items-center gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="KaraLevha ana sayfa">
          <Logo className="w-7 h-7 text-isaret" />
          <Wordmark className="text-lg" />
        </Link>

        {/* Bölümler (geniş ekran) */}
        <nav className="hidden xl:flex items-center gap-0.5 ml-4" aria-label="Bölümler">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                'relative px-2.5 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ' +
                (isActive
                  ? 'text-tebesir sprey-alti'
                  : 'text-tebesir-soluk hover:text-tebesir hover:bg-levha-yuzey')
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Arama */}
        <div className="hidden md:block w-48 lg:w-56">
          <SearchBox />
        </div>

        {/* Hesap */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <NotificationBell />
              <Link to={`/u/${encodeURIComponent(user.username)}`} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-levha-yuzey transition-colors" title="Profilin">
                <span className="w-7 h-7 rounded-full bg-isaret/15 text-isaret border border-isaret/40 flex items-center justify-center font-display font-bold text-sm" aria-hidden="true">
                  {user.username.charAt(0).toLocaleUpperCase('tr')}
                </span>
                <span className="hidden sm:block text-sm font-medium text-tebesir max-w-[120px] truncate">{user.username}</span>
              </Link>
              <button onClick={handleLogout} className="p-2 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors" title="Çıkış yap" aria-label="Çıkış yap">
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="btn-ana">Giriş yap</Link>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="xl:hidden p-2 rounded-md text-tebesir-soluk hover:text-tebesir hover:bg-levha-yuzey transition-colors"
            aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Dar ekran menüsü */}
      {menuOpen && (
        <nav className="xl:hidden border-t border-levha-cizgi bg-levha px-4 py-3 space-y-3" aria-label="Bölümler">
          <div className="md:hidden"><SearchBox onDone={() => setMenuOpen(false)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  'block px-3 py-2.5 rounded-md text-base font-medium border-l-2 ' +
                  (isActive ? 'text-tebesir border-isaret bg-levha-yuzey' : 'text-tebesir-soluk border-transparent hover:text-tebesir')
                }
              >
                {item.name}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
