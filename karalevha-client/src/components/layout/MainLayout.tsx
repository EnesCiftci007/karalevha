import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '../../context/AuthContext';
import { fullDate } from '../../utils/time';

export default function MainLayout() {
  const { user } = useAuth();
  const bannedUntil = user?.bannedUntil && new Date(user.bannedUntil) > new Date() ? user.bannedUntil : null;

  return (
    <div className="flex flex-col min-h-screen bg-levha text-tebesir selection:bg-isaret/30">
      {/* Üst Menü (Navbar) */}
      <Navbar />

      {bannedUntil && (
        <div role="alert" className="border-b border-hata/40 bg-hata/10 px-4 py-2.5 text-center text-sm text-tebesir">
          Hesabın <span className="font-semibold">{fullDate(bannedUntil)}</span> tarihine kadar askıda. Gezebilir ve okuyabilirsin; paylaşım yapamazsın.
        </div>
      )}

      {/* Değişen Sayfa İçeriği */}
      <main className="flex-1 px-4 sm:px-6 pt-8 pb-16 relative">
        <div className="max-w-sayfa mx-auto">
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}
