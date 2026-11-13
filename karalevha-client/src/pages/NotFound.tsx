import { Link } from 'react-router-dom';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-levha flex flex-col items-center justify-center px-4 text-center">
      <p className="veri text-base">404</p>
      <h1 className="mt-2 font-display font-bold text-xl text-tebesir">Bu sayfa levhada yok</h1>
      <p className="mt-1 text-base text-tebesir-soluk">Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir.</p>
      <Link to="/" className="btn-ikincil mt-6">Ana sayfaya dön</Link>
    </div>
  );
};
