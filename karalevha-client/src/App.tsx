import { Suspense, lazy } from 'react';
import { ReportProvider } from './components/ui/Report';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home';
import { NotFound } from './pages/NotFound';

// Her sayfa ayrı parça: ilk açılışta yalnızca ana sayfanın kodu iner
const EOba = lazy(() => import('./pages/EOba'));
const ObaDetay = lazy(() => import('./pages/ObaDetay'));
const Akis = lazy(() => import('./pages/Akis'));
const Market = lazy(() => import('./pages/Market'));
const ModelYonlendir = lazy(() => import('./pages/ModelYonlendir'));
const ObaDavet = lazy(() => import('./pages/ObaDavet'));
const Yonetim = lazy(() => import('./pages/Yonetim'));
const Gizlilik = lazy(() => import('./pages/Gizlilik'));
const Auth = lazy(() => import('./pages/Auth'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Projeler = lazy(() => import('./pages/Projeler'));
const ProjeDetay = lazy(() => import('./pages/ProjeDetay'));
const Tasarim = lazy(() => import('./pages/Tasarim'));
const Atolye = lazy(() => import('./pages/Atolye'));
const Etkinlikler = lazy(() => import('./pages/Etkinlikler'));
const EtkinlikDetay = lazy(() => import('./pages/EtkinlikDetay'));
const Profil = lazy(() => import('./pages/Profil'));
const Ara = lazy(() => import('./pages/Ara'));

const page = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

function App() {
  return (
    <AuthProvider>
      <ReportProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={page(<Auth />)} />
          <Route path="/verify-email" element={page(<VerifyEmail />)} />

          {/* Tüm sayfalar giriş yapmadan gezilebilir; paylaşım ve yazma işlemleri giriş ister. */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="akis" element={page(<Akis />)} />
            <Route path="e-oba" element={page(<EOba />)} />
            <Route path="e-oba/:id" element={page(<ObaDetay />)} />
            <Route path="e-oba/davet/:kod" element={page(<ObaDavet />)} />
            <Route path="market" element={page(<Market />)} />
            {/* Modeller projelere taşındı: eski bağlantılar modelin projesine gider */}
            <Route path="model/:id" element={page(<ModelYonlendir />)} />
            <Route path="baski-istasyonu" element={page(<ModelYonlendir />)} />
            <Route path="projeler" element={page(<Projeler />)} />
            <Route path="projeler/:id" element={page(<ProjeDetay />)} />
            <Route path="atolye" element={page(<Atolye />)} />
            <Route path="etkinlikler" element={page(<Etkinlikler />)} />
            <Route path="etkinlikler/:id" element={page(<EtkinlikDetay />)} />
            <Route path="u/:username" element={page(<Profil />)} />
            <Route path="ara" element={page(<Ara />)} />
            <Route path="yonetim" element={page(<Yonetim />)} />
            <Route path="gizlilik" element={page(<Gizlilik />)} />
            <Route path="tasarim" element={page(<Tasarim />)} />
          </Route>

          {/* 404 Hata Sayfası */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </ReportProvider>
    </AuthProvider>
  );
}

export default App;
