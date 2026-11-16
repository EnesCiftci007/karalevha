import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, CalendarDays, FolderGit2, Lock, MessagesSquare, Newspaper, Search, UserRound, type LucideIcon } from 'lucide-react';
import { api } from '../services/api';
import { shortDay, timeAgo } from '../utils/time';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import { SkeletonRows } from '../components/ui/Skeleton';

interface Results {
  projects: { id: number; title: string; owner: string }[];
  models: { id: number; title: string; category: 'baski' | 'oyun'; uploader: string }[];
  obalar: { id: number; name: string; isPrivate: boolean; memberCount: number }[];
  users: { username: string }[];
  events: { id: number; title: string; startsAt: string; location?: string | null }[];
  posts: { id: number; content: string; createdAt: string; username: string }[];
}

interface Row {
  to: string;
  title: string;
  meta?: ReactNode;
}

/** Aranan kelimeyi metin içinde vurgular (büyük/küçük harf duyarsız). */
function Highlight({ text, term }: { text: string; term: string }) {
  const i = text.toLocaleLowerCase('tr').indexOf(term.toLocaleLowerCase('tr'));
  if (i < 0 || !term) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-isaret/25 text-tebesir rounded-sm">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

function Group({ title, icon: Icon, rows, term }: { title: string; icon: LucideIcon; rows: Row[]; term: string }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-tebesir-soluk mb-2">
        <Icon className="w-4 h-4" aria-hidden="true" />
        {title}
      </h2>
      <ul className="kart divide-y divide-levha-cizgi">
        {rows.map((r) => (
          <li key={r.to}>
            <Link to={r.to} className="flex items-baseline justify-between gap-4 px-4 py-3 hover:bg-levha-yuzey/50 transition-colors">
              <span className="min-w-0 text-sm text-tebesir truncate"><Highlight text={r.title} term={term} /></span>
              {r.meta && <span className="shrink-0 text-xs text-tebesir-silik">{r.meta}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Ara() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    if (q.length < 2) return setResults(null);
    let cancelled = false;
    setResults(null);
    api<Results>(`/api/search?q=${encodeURIComponent(q)}`)
      .then((d) => !cancelled && setResults(d))
      .catch(() => !cancelled && setResults({ projects: [], models: [], obalar: [], users: [], events: [], posts: [] }));
    return () => {
      cancelled = true;
    };
  }, [q]);

  const total = results ? Object.values(results).reduce((n, list) => n + list.length, 0) : 0;

  return (
    <div className="max-w-3xl">
      <PageHeader title={q ? `"${q}" için sonuçlar` : 'Arama'} description={q.length < 2 ? 'Üst menüdeki kutuya en az iki harf yaz.' : undefined} />

      {q.length < 2 ? null : results === null ? (
        <SkeletonRows rows={4} />
      ) : total === 0 ? (
        <EmptyState icon={Search} title="Sonuç bulunamadı" description="Başka bir kelime dene ya da yazımı kontrol et." />
      ) : (
        <div className="space-y-8">
          <Group title="Kişiler" icon={UserRound} term={q} rows={results.users.map((u) => ({ to: `/u/${encodeURIComponent(u.username)}`, title: u.username }))} />
          <Group title="Projeler" icon={FolderGit2} term={q} rows={results.projects.map((p) => ({ to: `/projeler/${p.id}`, title: p.title, meta: p.owner }))} />
          <Group title="3B modeller" icon={Box} term={q} rows={results.models.map((m) => ({ to: `/model/${m.id}`, title: m.title, meta: `${m.category === 'oyun' ? 'Oyun' : 'Baskı'} · ${m.uploader}` }))} />
          <Group
            title="Obalar"
            icon={MessagesSquare}
            term={q}
            rows={results.obalar.map((o) => ({
              to: `/e-oba/${o.id}`,
              title: o.name,
              meta: <span className="inline-flex items-center gap-1">{o.isPrivate && <Lock className="w-3 h-3" aria-label="Gizli" />}{o.memberCount} üye</span>,
            }))}
          />
          <Group title="Etkinlikler" icon={CalendarDays} term={q} rows={results.events.map((e) => ({ to: `/etkinlikler/${e.id}`, title: e.title, meta: `${shortDay(new Date(e.startsAt))}${e.location ? ` · ${e.location}` : ''}` }))} />
          <Group title="Akış" icon={Newspaper} term={q} rows={results.posts.map((p) => ({ to: `/akis#gonderi-${p.id}`, title: p.content.length > 120 ? p.content.slice(0, 120) + '…' : p.content, meta: `${p.username} · ${timeAgo(p.createdAt)}` }))} />
        </div>
      )}
    </div>
  );
}
