import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-levha text-tebesir selection:bg-isaret/30">
      {/* Üst Menü (Navbar) */}
      <Navbar />

      {/* Değişen Sayfa İçeriği */}
      <main className="flex-1 px-4 py-6 sm:px-6 md:p-8 relative">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
