import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const menuItems = [
  { name: 'Ana sayfa', path: '/', end: true },
  { name: 'Akış', path: '/akis' },
  { name: 'Projeler', path: '/projeler' },
  { name: '3B Modeller', path: '/baski-istasyonu' },
  { name: 'E-Oba', path: '/e-oba' },
];

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
      <div className="max-w-sayfa mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-6">

        {/* Logo ve bölümler */}
        <div className="flex items-center gap-8 min-w-0">
          <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="KaraLevha ana sayfa">
            <img src="/logo.png" alt="" className="w-7 h-7 object-contain" />
            <span className="font-display font-bold text-lg text-tebesir">KaraLevha</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Bölümler">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  'relative px-3 py-2 text-sm font-medium rounded-md transition-colors ' +
                  (isActive
                    ? 'text-tebesir after:absolute after:left-3 after:right-3 after:-bottom-[13px] after:h-0.5 after:bg-isaret'
                    : 'text-tebesir-soluk hover:text-tebesir hover:bg-levha-yuzey')
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Hesap */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-full bg-isaret/15 text-isaret border border-isaret/40 flex items-center justify-center font-display font-bold text-sm"
                aria-hidden="true"
              >
                {user.username.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:block text-sm font-medium text-tebesir max-w-[140px] truncate">
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors"
                title="Çıkış yap"
                aria-label="Çıkış yap"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="btn-ana"
            >
              Giriş yap
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-md text-tebesir-soluk hover:text-tebesir hover:bg-levha-yuzey transition-colors"
            aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobil menü */}
      {menuOpen && (
        <nav className="md:hidden border-t border-levha-cizgi bg-levha px-4 py-2" aria-label="Bölümler">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                'block px-3 py-3 rounded-md text-base font-medium border-l-2 ' +
                (isActive
                  ? 'text-tebesir border-isaret bg-levha-yuzey'
                  : 'text-tebesir-soluk border-transparent hover:text-tebesir')
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
