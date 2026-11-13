import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ClubEvent } from '../types';
import { AttendButton, DateBlock, EventFormModal, EventMeta } from '../components/etkinlik/EventParts';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';
import Tabs from '../components/ui/Tabs';

type View = 'yaklasan' | 'gecmis';

/** Etkinlikleri ay başlıklarıyla gruplar: "Kasım 2026" */
function groupByMonth(events: ClubEvent[]) {
  const groups: { month: string; items: ClubEvent[] }[] = [];
  for (const e of events) {
    const month = new Date(e.startsAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }
  return groups;
}

export default function Etkinlikler() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('yaklasan');
  const [events, setEvents] = useState<ClubEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setFailed(false);
    api<ClubEvent[]>(`/api/etkinlik${view === 'gecmis' ? '?gecmis=true' : ''}`)
      .then((data) => !cancelled && setEvents(data))
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [view, user?.id]);

  const replace = (updated: ClubEvent) => setEvents((prev) => (prev ?? []).map((e) => (e.id === updated.id ? updated : e)));

  return (
    <div>
      <PageHeader
        title="Etkinlikler"
        description="Atölyeler, toplantılar ve yarışmalar. Katılacağını bildir, saat değişirse haberin olsun."
        action={
          user ? (
            <button type="button" className="btn-ana" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Etkinlik aç
            </button>
          ) : (
            <Link to="/auth" state={{ from: '/etkinlikler' }} className="btn-ikincil">Etkinlik açmak için giriş yap</Link>
          )
        }
      />

      <div className="w-60 mb-6">
        <Tabs label="Görünüm" value={view} onChange={setView} options={[{ value: 'yaklasan', label: 'Yaklaşan' }, { value: 'gecmis', label: 'Geçmiş' }]} />
      </div>

      {events === null ? (
        <div className="space-y-3 max-w-3xl">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={failed ? 'Etkinlikler yüklenemedi' : view === 'yaklasan' ? 'Yaklaşan etkinlik yok' : 'Geçmiş etkinlik yok'}
          description={failed ? 'Sayfayı yenilemeyi dene.' : view === 'yaklasan' ? 'Bir atölye ya da buluşma planlıyorsan buradan duyur.' : undefined}
          action={!failed && view === 'yaklasan' && user && <button className="btn-ikincil" onClick={() => setCreating(true)}>Etkinlik aç</button>}
        />
      ) : (
        <div className="max-w-3xl space-y-10">
          {groupByMonth(events).map(({ month, items }) => (
            <section key={month}>
              <h2 className="text-sm font-semibold text-tebesir-soluk mb-3">{month.charAt(0).toLocaleUpperCase('tr') + month.slice(1)}</h2>
              <ul className="space-y-3">
                {items.map((e) => (
                  <li key={e.id} className="kart p-4 flex gap-4 hover:border-tebesir-silik transition-colors">
                    <DateBlock iso={e.startsAt} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/etkinlikler/${e.id}`} className="text-base font-semibold text-tebesir hover:underline underline-offset-4">{e.title}</Link>
                      <div className="mt-1"><EventMeta event={e} /></div>
                      {e.description && <p className="mt-2 text-sm text-tebesir-soluk line-clamp-2">{e.description}</p>}
                    </div>
                    <div className="hidden sm:block shrink-0 self-center">
                      <AttendButton event={e} onChange={replace} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {creating && (
        <EventFormModal
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setView('yaklasan');
            setEvents((prev) => [...(prev ?? []), created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
          }}
        />
      )}
    </div>
  );
}
