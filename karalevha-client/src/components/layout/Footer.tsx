import { Link } from 'react-router-dom';
import { Logo, Mascot, Wordmark } from '../brand/Brand';

const links = [
  { to: '/akis', label: 'Akış' },
  { to: '/projeler', label: 'Projeler' },
  { to: '/baski-istasyonu', label: '3B Modeller' },
  { to: '/e-oba', label: 'E-Oba' },
  { to: '/atolye', label: 'Atölye' },
  { to: '/etkinlikler', label: 'Etkinlikler' },
];

/** Sayfa altı: imza, bölüm bağlantıları, maskot. */
export default function Footer() {
  return (
    <footer className="border-t border-levha-cizgi">
      <div className="max-w-sayfa mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center gap-6">
        <Link to="/" className="inline-flex items-center gap-2.5 shrink-0" aria-label="KaraLevha ana sayfa">
          <Logo className="w-6 h-6 text-isaret" />
          <Wordmark className="text-lg" />
        </Link>
        <nav aria-label="Alt menü" className="flex flex-wrap gap-x-5 gap-y-2 sm:ml-6">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm text-tebesir-soluk hover:text-tebesir transition-colors">{l.label}</Link>
          ))}
        </nav>
        <Mascot className="w-9 h-9 shrink-0 sm:ml-auto" />
      </div>
    </footer>
  );
}
