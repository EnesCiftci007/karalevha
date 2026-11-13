import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Box, FolderGit2, MessagesSquare, Newspaper, type LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ClubEvent, Oba, Post, PrintModel, Project } from '../types';
import { DateBlock, eventTime } from '../components/etkinlik/EventParts';
import { SkeletonRows } from '../components/ui/Skeleton';

// three.js sahnesi ayrı parça olarak, sayfa açıldıktan sonra yüklenir
const PrintScene = lazy(() => import('../components/home/PrintScene'));

interface HomeData {
  projects: Project[];
  posts: Post[];
  obalar: Oba[];
  models: PrintModel[];
  events: ClubEvent[];
}

const relative = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });

/** "3 gün önce", "dün" gibi kısa zaman ifadesi. */
function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'az önce';
}

async function loadList<T>(path: string): Promise<T[]> {
  try {
    return await api<T[]>(path);
  } catch {
    return []; // bir bölüm yüklenemezse ana sayfanın geri kalanı yine görünsün
  }
}

function Section({ title, to, linkLabel, children }: { title: string; to: string; linkLabel: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-levha-cizgi">
        <h2 className="font-display font-semibold text-lg text-tebesir">{title}</h2>
        <Link to={to} className="inline-flex items-center gap-1 text-sm text-tebesir-soluk hover:text-tebesir transition-colors">
          {linkLabel}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ text, to, action }: { text: string; to: string; action: string }) {
  return (
    <p className="text-sm text-tebesir-silik py-6">
      {text}{' '}
      <Link to={to} className="text-tebesir-soluk underline underline-offset-4 decoration-levha-cizgi hover:text-tebesir hover:decoration-tebesir-silik transition-colors">
        {action}
      </Link>
    </p>
  );
}


export default function Home() {
  const { user } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadList<Project>('/api/projects'),
      loadList<Post>('/api/posts'),
      loadList<Oba>('/api/obalar'),
      loadList<PrintModel>('/api/printmodels'),
      loadList<ClubEvent>('/api/etkinlik?take=3'),
    ]).then(([projects, posts, obalar, models, events]) => {
      if (!cancelled) setData({ projects, posts, obalar, models, events });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const areas: { to: string; icon: LucideIcon; title: string; text: string; count?: number; unit: string }[] = [
    { to: '/projeler', icon: FolderGit2, title: 'Projeler', text: 'Kulüpte geliştirilen açık kaynak işler', count: data?.projects.length, unit: 'proje' },
    { to: '/e-oba', icon: MessagesSquare, title: 'E-Oba', text: 'Sohbet, ders notları ve çıkmış sorular', count: data?.obalar.length, unit: 'oba' },
    { to: '/baski-istasyonu', icon: Box, title: '3B Modeller', text: 'Baskı parçaları ve oyun modelleri', count: data?.models.length, unit: 'model' },
    { to: '/akis', icon: Newspaper, title: 'Akış', text: 'Duyurular ve kısa paylaşımlar', count: data?.posts.length, unit: 'paylaşım' },
  ];

  return (
    <div>

      {/* Karşılama: solda metin, sağda bölümler. Geniş ekranda sağ taraf boş kalmasın. */}
      <header className="relative -mx-4 sm:-mx-6 -mt-8 px-4 sm:px-6 pt-8 pb-12">
        <div className="kareli absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10 items-center">

          <div className="lg:col-span-7">
            <p className="text-sm font-medium text-tebesir-soluk mb-3">Maker kulübü · çevrimiçi atölye</p>
            {user ? (
              <h1 className="font-display font-bold text-xl sm:text-2xl text-tebesir">
                Tekrar hoş geldin, <span className="text-isaret break-words">{user.username}</span>.
              </h1>
            ) : (
              <h1 className="font-display font-bold text-xl sm:text-2xl text-tebesir">
                Üretenlerin <span className="text-isaret">ortak tezgâhı</span>.
              </h1>
            )}
            <p className="mt-4 text-base text-tebesir-soluk max-w-xl">
              Projeni paylaş, obanda ders notlarını ve çıkmış soruları bul, 3B modelini yükle.
              {!user && ' Her şey üye olmadan gezilebilir; katkı vermek istediğinde bir hesap yeter.'}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to={user ? '/e-oba' : '/auth'}
                className="btn-ana"
              >
                {user ? 'Obalara git' : 'Aramıza katıl'}
              </Link>
              <Link to="/projeler" className="btn-sade">
                Projelere göz at
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* 3B sahne */}
          <div className="lg:col-span-5 min-h-[300px] sm:min-h-[360px] lg:min-h-[420px]">
            <Suspense fallback={null}>
              <PrintScene />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Bölümler */}
      <nav aria-label="Bölümler" className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-levha-cizgi border border-levha-cizgi rounded-lg overflow-hidden">
        {areas.map(({ to, icon: Icon, title, text, count, unit }) => (
          <Link key={to} to={to} className="group bg-levha hover:bg-levha-yuzey transition-colors p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <Icon className="w-5 h-5 text-tebesir-silik group-hover:text-tebesir transition-colors" strokeWidth={1.75} aria-hidden="true" />
              <span className="veri">{count === undefined ? '—' : `${count} ${unit}`}</span>
            </div>
            <span className="text-base font-semibold text-tebesir">{title}</span>
            <span className="mt-0.5 text-sm text-tebesir-soluk hidden sm:block">{text}</span>
          </Link>
        ))}
      </nav>

      {/* Yaklaşan etkinlikler: yalnızca varsa görünür */}
      {data && data.events.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-levha-cizgi">
            <h2 className="font-display font-semibold text-lg text-tebesir">Yaklaşan etkinlikler</h2>
            <Link to="/etkinlikler" className="inline-flex items-center gap-1 text-sm text-tebesir-soluk hover:text-tebesir transition-colors">
              Tüm etkinlikler
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.events.map((e) => (
              <li key={e.id}>
                <Link to={`/etkinlikler/${e.id}`} className="kart p-4 flex gap-4 h-full hover:border-tebesir-silik transition-colors">
                  <DateBlock iso={e.startsAt} />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-tebesir line-clamp-2">{e.title}</span>
                    <span className="block mt-1 veri">{eventTime(e)}{e.location ? ` · ${e.location}` : ''}</span>
                    <span className="block mt-1 text-xs text-tebesir-silik">{e.attendeeCount} katılımcı</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">

        {/* Son projeler */}
        <div className="lg:col-span-7">
          <Section title="Son projeler" to="/projeler" linkLabel="Tüm projeler">
            {!data ? <SkeletonRows rows={3} /> : data.projects.length === 0 ? (
              <Empty text="Henüz paylaşılmış proje yok." to="/projeler" action="İlkini sen ekle" />
            ) : (
              <ul className="divide-y divide-levha-cizgi">
                {data.projects.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link to={`/projeler/${p.id}`} className="group block py-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-base font-medium text-tebesir group-hover:underline underline-offset-4 truncate">{p.title}</h3>
                        <span className="text-xs text-tebesir-silik shrink-0">{timeAgo(p.createdAt)}</span>
                      </div>
                      {p.description && <p className="mt-1 text-sm text-tebesir-soluk line-clamp-2">{p.description}</p>}
                      <p className="mt-2 text-xs text-tebesir-silik">{p.owner}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Akıştan */}
        <div className="lg:col-span-5">
          <Section title="Akıştan" to="/akis" linkLabel="Akışa git">
            {!data ? <SkeletonRows rows={3} /> : data.posts.length === 0 ? (
              <Empty text="Akış henüz sessiz." to="/akis" action="Bir şey yaz" />
            ) : (
              <ul className="divide-y divide-levha-cizgi">
                {data.posts.slice(0, 4).map((post) => (
                  <li key={post.id} className="py-4">
                    <p className="text-sm text-tebesir leading-relaxed line-clamp-3 whitespace-pre-line break-words">{post.content}</p>
                    <p className="mt-2 text-xs text-tebesir-silik">
                      {post.user?.username ?? 'Bilinmeyen'} · {timeAgo(post.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
