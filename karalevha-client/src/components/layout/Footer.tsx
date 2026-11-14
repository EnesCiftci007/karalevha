import { Link } from 'react-router-dom';
import { Logo, Mascot } from '../brand/Brand';

const columns = [
  {
    title: 'Liman',
    links: [
      { to: '/akis', label: 'Akış' },
      { to: '/projeler', label: 'Projeler' },
      { to: '/baski-istasyonu', label: '3B Modeller' },
    ],
  },
  {
    title: 'Tersane',
    links: [
      { to: '/e-oba', label: 'E-Oba' },
      { to: '/atolye', label: 'Atölye' },
      { to: '/etkinlikler', label: 'Etkinlikler' },
    ],
  },
];

/** Sayfa altı: marka, bölüm bağlantıları ve kulübün maskotu. */
export default function Footer() {
  return (
    <footer className="border-t border-levha-cizgi">
      <div className="max-w-sayfa mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="KaraLevha ana sayfa">
            <Logo className="w-6 h-6 text-isaret" />
            <span className="font-display font-bold text-base text-tebesir">KaraLevha</span>
          </Link>
          <p className="mt-2 max-w-xs text-sm text-tebesir-soluk">
            Maker kulübünün çevrimiçi tersanesi: fikirler burada çizilir, parçalar burada basılır.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-semibold text-tebesir mb-3">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-tebesir-soluk hover:text-tebesir transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="max-w-sayfa mx-auto px-4 sm:px-6 py-4 border-t border-levha-cizgi flex items-center justify-between gap-4">
        <p className="text-xs text-tebesir-silik">Baskı Korsanları tarafından, tebeşir tozu ve PLA ile yapıldı.</p>
        <Mascot className="w-8 h-8 shrink-0" />
      </div>
    </footer>
  );
}
