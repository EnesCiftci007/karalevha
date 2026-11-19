import { useCallback, useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Skeleton from '../ui/Skeleton';
import UserLink from '../ui/UserLink';

export interface TeamMember {
  userId: number;
  username: string;
  role: 'sahip' | 'uye';
  addedAt: string | null;
}

/**
 * Proje ekibi: sahip üye ekler ve çıkarır, üye kendisi ayrılabilir. Üyeler model ve dosya ekler,
 * yeni sürüm yükler; projeyi düzenlemek ve silmek sahibindedir.
 */
export default function TeamModal({ projectId, ownerId, onClose, onChange }: {
  projectId: number;
  ownerId: number;
  onClose: () => void;
  /** Ekip değişince (üye kimlikleri) */
  onChange: (memberIds: number[]) => void;
}) {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isOwner = user?.id === ownerId;

  const load = useCallback(() => {
    api<TeamMember[]>(`/api/projects/${projectId}/ekip`)
      .then((t) => {
        setTeam(t);
        onChange(t.filter((m) => m.role === 'uye').map((m) => m.userId));
      })
      .catch(() => setTeam([]));
  }, [projectId, onChange]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/projects/${projectId}/ekip`, { method: 'POST', body: JSON.stringify({ username: username.trim() }) });
      setUsername('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eklenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: TeamMember) => {
    setError('');
    try {
      await api(`/api/projects/${projectId}/ekip/${m.userId}`, { method: 'DELETE' });
      if (m.userId === user?.id) {
        onChange((team ?? []).filter((x) => x.role === 'uye' && x.userId !== m.userId).map((x) => x.userId));
        onClose();
        return;
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Çıkarılamadı.');
    }
  };

  return (
    <Modal title="Proje ekibi" onClose={onClose}>
      <div className="p-5 space-y-4">
        <p className="text-sm text-tebesir-soluk">Ekip üyeleri model ve dosya ekler, yeni sürüm yükler. Projeyi düzenlemek ve silmek sahibindedir.</p>
        {team === null ? (
          <Skeleton className="h-24" />
        ) : (
          <ul className="kart divide-y divide-levha-cizgi">
            {team.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={m.username} size="sm" />
                <UserLink username={m.username} className="flex-1 min-w-0 text-sm font-medium text-tebesir truncate" />
                {m.role === 'sahip' ? (
                  <Badge tone="isaret">Sahip</Badge>
                ) : (isOwner || m.userId === user?.id) && (
                  <button type="button" onClick={() => remove(m)} className="btn-sade h-7 px-2 text-xs">
                    <X className="w-3.5 h-3.5" aria-hidden="true" />{m.userId === user?.id ? 'Ekipten ayrıl' : 'Çıkar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isOwner && (
          <form onSubmit={add} className="flex gap-2">
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Kullanıcı adı" aria-label="Eklenecek kişinin kullanıcı adı" className="girdi" />
            <button type="submit" disabled={!username.trim() || busy} className="btn-ana shrink-0">
              <UserPlus className="w-4 h-4" aria-hidden="true" />Ekle
            </button>
          </form>
        )}
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
