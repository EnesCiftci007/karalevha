import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Home from './pages/Home';
import EOba from './pages/EOba';
import ObaDetay from './pages/ObaDetay';
import Akis from './pages/Akis';
import BaskiIstasyonu from './pages/BaskiIstasyonu';
import Auth from './pages/Auth';
import Projeler from './pages/Projeler';
import ProjeDetay from './pages/ProjeDetay';
import Profil from './pages/Profil';
import { NotFound } from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Herkese Açık Yollar */}
          <Route path="/auth" element={<Auth />} />

          {/* Korumalı Yollar */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="akis" element={<Akis />} />
              <Route path="e-oba" element={<EOba />} />
              <Route path="e-oba/:id" element={<ObaDetay />} />
              <Route path="baski-istasyonu" element={<BaskiIstasyonu />} />
              <Route path="projeler" element={<Projeler />} />
              <Route path="projeler/:id" element={<ProjeDetay />} />
              <Route path="profil/:username" element={<Profil />} />
            </Route>
          </Route>

          {/* 404 Hata Sayfası */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
