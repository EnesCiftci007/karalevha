import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-levha text-tebesir selection:bg-isaret/30">
      {/* Üst Menü (Navbar) */}
      <Navbar />

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
