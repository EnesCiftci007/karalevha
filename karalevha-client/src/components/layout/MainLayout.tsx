import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0b0c10] text-zinc-100 selection:bg-cyan-500/30">
      {/* Üst Menü (Navbar) */}
      <Navbar />

      {/* Değişen Sayfa İçeriği */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
