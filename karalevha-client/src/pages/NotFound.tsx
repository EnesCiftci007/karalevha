import { Link } from 'react-router-dom';
import { Mascot } from '../components/brand/Brand';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-levha flex flex-col items-center justify-center px-4 text-center">
      <Mascot className="w-28 h-28 mb-6" />
      <p className="font-tag text-2xl text-isaret">404</p>
      <h1 className="mt-1 font-display font-extrabold text-2xl text-tebesir">Sayfa bulunamadı</h1>
      <p className="mt-1 text-base text-tebesir-soluk">Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir.</p>
      <Link to="/" className="btn-ikincil mt-6">Ana sayfaya dön</Link>
    </div>
  );
};
