import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home';
import { NotFound } from './pages/NotFound';

// Her sayfa ayrı parça: ilk açılışta yalnızca ana sayfanın kodu iner
const EOba = lazy(() => import('./pages/EOba'));
const ObaDetay = lazy(() => import('./pages/ObaDetay'));
const Akis = lazy(() => import('./pages/Akis'));
const BaskiIstasyonu = lazy(() => import('./pages/BaskiIstasyonu'));
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
            <Route path="baski-istasyonu" element={page(<BaskiIstasyonu />)} />
            <Route path="projeler" element={page(<Projeler />)} />
            <Route path="projeler/:id" element={page(<ProjeDetay />)} />
            <Route path="atolye" element={page(<Atolye />)} />
            <Route path="etkinlikler" element={page(<Etkinlikler />)} />
            <Route path="etkinlikler/:id" element={page(<EtkinlikDetay />)} />
            <Route path="u/:username" element={page(<Profil />)} />
            <Route path="ara" element={page(<Ara />)} />
            <Route path="tasarim" element={page(<Tasarim />)} />
          </Route>

          {/* 404 Hata Sayfası */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
