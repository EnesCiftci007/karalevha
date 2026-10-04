import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home';
import EOba from './pages/EOba';
import Akis from './pages/Akis';
import BaskiIstasyonu from './pages/BaskiIstasyonu';
import Auth from './pages/Auth';
import Projeler from './pages/Projeler';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Kimlik Doğrulama Ekranı (Standalone, Menüsüz) */}
          <Route path="/auth" element={<Auth />} />

          {/* Ana Uygulama Düzeni (Menülü) */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="akis" element={<Akis />} />
            <Route path="e-oba" element={<EOba />} />
            <Route path="baski-istasyonu" element={<BaskiIstasyonu />} />
            <Route path="projeler" element={<Projeler />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
