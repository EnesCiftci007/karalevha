import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ClubEvent } from '../types';
import { fullDate } from '../utils/time';
import { AttendButton, DateBlock, EventFormModal, EventMeta } from '../components/etkinlik/EventParts';
import Avatar from '../components/ui/Avatar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import ItemMenu from '../components/ui/ItemMenu';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';
import UserLink from '../components/ui/UserLink';

const back = { to: '/etkinlikler', label: 'Etkinlikler' };

export default function EtkinlikDetay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvent(null);
    setFailed(false);
    api<ClubEvent>(`/api/etkinlik/${id}`)
      .then((data) => !cancelled && setEvent(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  if (failed) {
    return (
      <div>
        <PageHeader title="Etkinlik bulunamadı" back={back} />
        <EmptyState icon={CalendarDays} title="Bu etkinlik yok ya da iptal edilmiş" />
      </div>
    );
  }
  if (!event) {
    return <div role="status" aria-label="Yükleniyor"><Skeleton className="h-4 w-24 mb-4" /><Skeleton className="h-8 w-80 mb-3" /><Skeleton className="h-40 max-w-3xl" /></div>;
  }

  const canManage = user && (user.id === event.createdById || user.isAdmin);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={event.title}
        back={back}
        action={
          <div className="flex items-center gap-2">
            <AttendButton event={event} onChange={setEvent} />
            {canManage && (
              <ItemMenu
                label="Etkinlik seçenekleri"
                actions={[
                  { label: 'Düzenle', icon: Pencil, onSelect: () => setEditing(true) },
                  { label: 'Sil', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) },
                ]}
              />
            )}
          </div>
        }
      />

      <div className="flex gap-4 mb-8">
        <DateBlock iso={event.startsAt} />
        <div>
          <p className="text-base text-tebesir">{fullDate(event.startsAt)}</p>
          <div className="mt-1"><EventMeta event={event} /></div>
          <p className="mt-1 text-sm text-tebesir-silik">Düzenleyen: <UserLink username={event.createdBy} className="text-tebesir-soluk" /></p>
        </div>
      </div>

      {event.description && <p className="text-base leading-relaxed text-tebesir whitespace-pre-wrap break-words mb-10">{event.description}</p>}

      <section>
        <h2 className="font-display font-semibold text-lg text-tebesir mb-4">Katılımcılar <span className="veri text-base">{event.attendeeCount}</span></h2>
        {event.attendees.length === 0 ? (
          <p className="text-sm text-tebesir-silik">Henüz katılan yok.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {event.attendees.map((name) => (
              <li key={name} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-levha-cizgi">
                <Avatar name={name} size="sm" />
                <UserLink username={name} className="text-sm text-tebesir" />
              </li>
            ))}
            {event.attendeeCount > event.attendees.length && (
              <li className="self-center text-sm text-tebesir-silik">ve {event.attendeeCount - event.attendees.length} kişi daha</li>
            )}
          </ul>
        )}
      </section>

      {editing && <EventFormModal event={event} onSaved={setEvent} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Etkinlik silinsin mi?"
          confirmLabel="Etkinliği sil"
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api(`/api/etkinlik/${event.id}`, { method: 'DELETE' });
            navigate('/etkinlikler', { replace: true });
          }}
        >
          {new Date(event.startsAt).getTime() > Date.now()
            ? `"${event.title}" iptal edilecek ve ${event.attendeeCount} katılımcıya bildirim gidecek.`
            : `"${event.title}" kalıcı olarak silinecek.`}
        </ConfirmDialog>
      )}
    </div>
  );
}
