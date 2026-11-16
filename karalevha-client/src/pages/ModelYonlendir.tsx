import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../services/api';

/**
 * Modeller artık projelerin içinde. /model/:id ve eski /baski-istasyonu?model=ID bağlantıları
 * modelin projesine (Modeller bölümü, model açık) yönlendirilir.
 */
export default function ModelYonlendir() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const modelId = id ?? params.get('model');

  useEffect(() => {
    if (!modelId) {
      navigate('/projeler', { replace: true });
      return;
    }
    let cancelled = false;
    api<{ id: number; projectId: number | null }>(`/api/printmodels/${modelId}`)
      .then((m) => {
        if (cancelled) return;
        navigate(m.projectId ? `/projeler/${m.projectId}?bolum=modeller&model=${m.id}` : '/projeler', { replace: true });
      })
      .catch(() => !cancelled && navigate('/projeler', { replace: true }));
    return () => {
      cancelled = true;
    };
  }, [modelId, navigate]);

  return (
    <div className="py-20 flex justify-center" role="status" aria-label="Yönlendiriliyor">
      <Loader2 className="w-6 h-6 animate-spin text-tebesir-silik" />
    </div>
  );
}
