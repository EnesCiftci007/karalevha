import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Home from './pages/Home';
import Auth from './pages/Auth';
import { NotFound } from './pages/NotFound';
import { PageLoader } from './components/layout/PageLoader';

// Ağır sayfalar (Three.js, SignalR, kod görüntüleyici) yalnızca açıldıklarında indirilir.
const EOba = lazy(() => import('./pages/EOba'));
const ObaDetay = lazy(() => import('./pages/ObaDetay'));
const Akis = lazy(() => import('./pages/Akis'));
const BaskiIstasyonu = lazy(() => import('./pages/BaskiIstasyonu'));
const Projeler = lazy(() => import('./pages/Projeler'));
const ProjeDetay = lazy(() => import('./pages/ProjeDetay'));
const Profil = lazy(() => import('./pages/Profil'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Herkese Açık Yollar */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/verify-email" element={<Suspense fallback={<PageLoader />}><VerifyEmail /></Suspense>} />

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

