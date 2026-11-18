import { Link } from 'react-router-dom';
import { ArrowRight, CalendarX2, FolderGit2, Newspaper } from 'lucide-react';
import { ClubEvent, Post, Project } from '../../types';
import { eventTime } from '../etkinlik/EventParts';
import { timeAgo } from '../../utils/time';

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** Şeride sığan küçük tarih rozeti: "18 / Kas" */
function DateBadge({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="shrink-0 w-10 h-10 rounded border border-levha-cizgi bg-levha flex flex-col items-center justify-center leading-none" aria-hidden="true">
      <span className="font-display font-bold text-base text-tebesir">{d.getDate()}</span>
      <span className="mt-0.5 text-[10px] text-tebesir-silik">{MONTHS[d.getMonth()]}</span>
    </span>
  );
}

interface CommunityPulseProps {
  /** Yaklaşan ilk etkinlik; undefined: yükleniyor, null: yok */
  event: ClubEvent | null | undefined;
  projects: Project[] | null | undefined;
  posts: Post[] | null | undefined;
}

/**
 * Topluluk nabzı: istatistiklerin altında ince, iki sütunlu şerit. Solda yaklaşan ilk etkinlik,
 * sağda kulüpte paylaşılan en son proje ya da akış gönderisi.
 */
export default function CommunityPulse({ event, projects, posts }: CommunityPulseProps) {
  // En son paylaşım: en yeni proje ile en yeni gönderiden hangisi daha yeniyse
  const latestProject = projects?.[0];
  const latestPost = posts?.[0];
  const latest =
    latestProject && (!latestPost || latestProject.createdAt >= latestPost.createdAt)
      ? { icon: FolderGit2, who: latestProject.owner, kind: 'proje', text: latestProject.title, at: latestProject.createdAt, to: `/projeler/${latestProject.id}` }
      : latestPost
        ? { icon: Newspaper, who: latestPost.user?.username ?? 'Biri', kind: 'gönderi', text: latestPost.content, at: latestPost.createdAt, to: `/akis#gonderi-${latestPost.id}` }
        : null;

  const cell = 'flex items-center gap-3 min-w-0 px-4 py-2.5';

  return (
    <section aria-label="Topluluk nabzı" className="mt-4 kart grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-levha-cizgi">
      {/* Yaklaşan etkinlik */}
      {event === undefined ? (
        <div className={`${cell} h-[60px]`} />
      ) : event ? (
        <div className={cell}>
          <DateBadge iso={event.startsAt} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-tebesir truncate">{event.title}</p>
            <p className="veri truncate">{eventTime(event)}{event.location ? ` · ${event.location}` : ''}</p>
          </div>
          <Link to={`/etkinlikler/${event.id}`} className="shrink-0 inline-flex items-center gap-1 text-sm text-tebesir-soluk hover:text-isaret transition-colors">
            {event.attending ? 'Detay' : 'Detay / Katıl'}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className={cell}>
          <CalendarX2 className="w-4 h-4 shrink-0 text-tebesir-silik" aria-hidden="true" />
          <p className="text-sm text-tebesir-silik">Yaklaşan etkinlik bulunmuyor.</p>
        </div>
      )}

      {/* En son paylaşım */}
      {latest ? (
        <Link to={latest.to} className={`${cell} group hover:bg-white/[0.03] transition-colors`}>
          <latest.icon className="w-4 h-4 shrink-0 text-tebesir-silik group-hover:text-isaret transition-colors" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-tebesir-soluk truncate">
            <span className="font-medium text-tebesir">{latest.who}</span> · {latest.kind}: <span className="text-tebesir">{latest.text}</span>
          </p>
          <time dateTime={latest.at} className="veri shrink-0">{timeAgo(latest.at)}</time>
        </Link>
      ) : (
        <div className={cell}>
          <p className="text-sm text-tebesir-silik">{projects === undefined ? '' : 'Henüz paylaşım yok.'}</p>
        </div>
      )}
    </section>
  );
}
