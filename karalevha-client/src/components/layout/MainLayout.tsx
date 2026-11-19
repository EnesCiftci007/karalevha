import { useEffect } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '../../context/AuthContext';
import { fullDate } from '../../utils/time';

/**
 * Sayfa iskeleti. Çoğu sayfa ortadaki içerik genişliğinde (max-w-sayfa) durur. İki istisna:
 * - Oba sohbeti (/e-oba/:id) bir uygulama gibi üst menünün altındaki alanın tamamını kaplar; footer yok,
 *   sayfa kaymaz, yalnızca içindeki bölmeler kayar.
 * - Proje (/projeler/:id) kod görüntüleyiciye yer açmak için daha geniş.
 */
export default function MainLayout() {
  const { user } = useAuth();
  const bannedUntil = user?.bannedUntil && new Date(user.bannedUntil) > new Date() ? user.bannedUntil : null;
  const fullScreen = useMatch('/e-oba/:id') !== null;
  const wide = useMatch('/projeler/:id') !== null;
  // Ana sayfa tek ekrana sığacak şekilde ölçülü: altta daha az boşluk
  const home = useMatch('/') !== null;
  const { pathname, hash } = useLocation();

  // Yeni sayfa en üstten açılsın (tarayıcı tek sayfalık uygulamada kaydırmayı sıfırlamaz).
  // Adreste #hedef varsa (ör. bildirimden gelen #gonderi-5) o sayfa kendisi kaydırır.
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  // Sekme başlığını geçerli bölüme göre güncelle (okunmamış bildirim önekini koru)
  useEffect(() => {
    const prefix = document.title.match(/^\(\d+\+?\) /)?.[0] ?? '';
    const map: [RegExp, string][] = [
      [/^\/$/, 'KaraLevha'],
      [/^\/akis/, 'Akış · KaraLevha'],
      [/^\/projeler/, 'Projeler · KaraLevha'],
      [/^\/market/, 'Market · KaraLevha'],
      [/^\/e-oba/, 'E-Oba · KaraLevha'],
      [/^\/atolye/, 'Atölye · KaraLevha'],
      [/^\/etkinlikler/, 'Etkinlikler · KaraLevha'],
      [/^\/ara/, 'Arama · KaraLevha'],
      [/^\/yonetim/, 'Yönetim · KaraLevha'],
      [/^\/gizlilik/, 'Gizlilik ve KVKK · KaraLevha'],
      [/^\/kurulum/, 'Kurulum · KaraLevha'],
      [/^\/u\/([^/]+)/, 'Profil · KaraLevha'],
    ];
    const matched = map.find(([re]) => re.test(pathname))?.[1] ?? 'KaraLevha';
    document.title = `${prefix}${matched}`;
  }, [pathname]);

  // Tam ekran sayfada kaydırma çubuğu için boşluk ayrılmasın (index.css: html.tam-ekran)
  useEffect(() => {
    document.documentElement.classList.toggle('tam-ekran', fullScreen);
    return () => document.documentElement.classList.remove('tam-ekran');
  }, [fullScreen]);

  const banner = bannedUntil && (
    <div role="alert" className="shrink-0 border-b border-hata/40 bg-hata/10 px-4 py-2.5 text-center text-sm text-tebesir">
      Hesabın <span className="font-semibold">{fullDate(bannedUntil)}</span> tarihine kadar askıda. Gezebilir ve okuyabilirsin; paylaşım yapamazsın.
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex flex-col h-dvh overflow-hidden bg-levha text-tebesir selection:bg-isaret/30">
        <Navbar fluid />
        {banner}
        <main className="flex-1 min-h-0">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-levha text-tebesir selection:bg-isaret/30">
      {/* Üst Menü (Navbar) */}
      <Navbar />
      {banner}

      {/* Değişen Sayfa İçeriği */}
      <main className={`flex-1 px-4 sm:px-6 ${wide ? 'pt-0' : 'pt-8'} ${home ? 'pb-8' : 'pb-16'} relative`}>
        <div className={`${wide ? 'max-w-[88rem]' : 'max-w-sayfa'} mx-auto`}>
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}
