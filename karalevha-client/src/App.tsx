import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home';
import EOba from './pages/EOba';
import ObaDetay from './pages/ObaDetay';
import Akis from './pages/Akis';
import BaskiIstasyonu from './pages/BaskiIstasyonu';
import Auth from './pages/Auth';
import Projeler from './pages/Projeler';
import ProjeDetay from './pages/ProjeDetay';
import { NotFound } from './pages/NotFound';
import Tasarim from './pages/Tasarim';
import Atolye from './pages/Atolye';
import Etkinlikler from './pages/Etkinlikler';
import EtkinlikDetay from './pages/EtkinlikDetay';
import Profil from './pages/Profil';
import Ara from './pages/Ara';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />

          {/* Tüm sayfalar giriş yapmadan gezilebilir; paylaşım ve yazma işlemleri giriş ister. */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="akis" element={<Akis />} />
            <Route path="e-oba" element={<EOba />} />
            <Route path="e-oba/:id" element={<ObaDetay />} />
            <Route path="baski-istasyonu" element={<BaskiIstasyonu />} />
            <Route path="projeler" element={<Projeler />} />
            <Route path="projeler/:id" element={<ProjeDetay />} />
            <Route path="atolye" element={<Atolye />} />
            <Route path="etkinlikler" element={<Etkinlikler />} />
            <Route path="etkinlikler/:id" element={<EtkinlikDetay />} />
            <Route path="u/:username" element={<Profil />} />
            <Route path="ara" element={<Ara />} />
            <Route path="tasarim" element={<Tasarim />} />
          </Route>

          {/* 404 Hata Sayfası */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
