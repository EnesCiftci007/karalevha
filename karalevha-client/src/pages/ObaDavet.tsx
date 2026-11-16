import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Link2Off, Users } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';

interface InvitePreview {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  isUnlisted: boolean;
  owner: string;
  isMember: boolean;
}

/** /e-oba/davet/:kod — davet bağlantısıyla gelen kişiye obayı gösterir ve katılır. */
export default function ObaDavet() {
  const { kod } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [oba, setOba] = useState<InvitePreview | null>(null);
  const [failed, setFailed] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<InvitePreview>(`/api/obalar/davet/${encodeURIComponent(kod ?? '')}`)
      .then((o) => !cancelled && setOba(o))
      .catch((err) => !cancelled && setFailed(err instanceof Error ? err.message : 'Bu davet bağlantısı geçersiz.'));
    return () => {
      cancelled = true;
    };
  }, [kod, user?.id]);

  const join = async () => {
    setJoining(true);
    setError('');
    try {
      const r = await api<{ id: number }>(`/api/obalar/davet/${encodeURIComponent(kod ?? '')}/katil`, { method: 'POST' });
      navigate(`/e-oba/${r.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Katılınamadı.');
      setJoining(false);
    }
  };

  if (failed) {
    return (
      <div className="max-w-md mx-auto pt-10">
        <EmptyState icon={Link2Off} title="Davet bağlantısı geçersiz" description="Bağlantı yenilenmiş ya da oba kaldırılmış olabilir. Seni davet eden kişiden yenisini iste." action={<Link to="/e-oba" className="btn-ikincil">Obalara bak</Link>} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pt-10">
      <div className="kart p-6 text-center">
        {!oba ? (
          <div role="status" aria-label="Yükleniyor" className="space-y-3">
            <Skeleton className="w-14 h-14 mx-auto rounded-full" />
            <Skeleton className="h-5 w-40 mx-auto" />
            <Skeleton className="h-4 w-56 mx-auto" />
          </div>
        ) : (
          <>
            <p className="etiket mb-4">Obaya davet edildin</p>
            <div className="flex justify-center"><Avatar name={oba.name} /></div>
            <h1 className="mt-3 font-display font-bold text-xl text-tebesir">{oba.name}</h1>
            {oba.description && <p className="mt-2 text-sm text-tebesir-soluk">{oba.description}</p>}
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-tebesir-silik">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="veri">{oba.memberCount}</span> üye · kurucu {oba.owner}
            </p>
            <div className="mt-6">
              {oba.isMember ? (
                <Link to={`/e-oba/${oba.id}`} className="btn-ana w-full justify-center">Obayı aç</Link>
              ) : user ? (
                <button type="button" onClick={join} disabled={joining} className="btn-ana w-full justify-center">{joining ? 'Katılınıyor…' : 'Obaya katıl'}</button>
              ) : (
                <Link to="/auth" state={{ from: `/e-oba/davet/${kod}` }} className="btn-ana w-full justify-center">Katılmak için giriş yap</Link>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-hata" role="alert">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
