import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Box, FolderGit2, Lock, MessagesSquare, Newspaper, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Oba, Post, PrintModel, Project } from '../types';

interface HomeData {
  projects: Project[];
  posts: Post[];
  obalar: Oba[];
  models: PrintModel[];
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
        <Link to={to} className="group inline-flex items-center text-sm text-tebesir-soluk hover:text-isaret transition-colors">
          {linkLabel}
          <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
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
      <Link to={to} className="text-tebesir-soluk underline underline-offset-4 decoration-levha-cizgi hover:text-isaret hover:decoration-isaret transition-colors">
        {action}
      </Link>
    </p>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 py-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 rounded-md bg-levha-yuzey/60" />
      ))}
    </div>
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
    ]).then(([projects, posts, obalar, models]) => {
      if (!cancelled) setData({ projects, posts, obalar, models });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const areas: { to: string; icon: LucideIcon; title: string; text: string; count?: number; unit: string }[] = [
    { to: '/projeler', icon: FolderGit2, title: 'Projeler', text: 'Kulüpte geliştirilen açık kaynak işler', count: data?.projects.length, unit: 'proje' },
    { to: '/e-oba', icon: MessagesSquare, title: 'E-Oba', text: 'Sohbet, ders notları ve çıkmış sorular', count: data?.obalar.length, unit: 'oba' },
    { to: '/baski-istasyonu', icon: Box, title: '3B Baskı', text: 'Basılmaya hazır STL modelleri', count: data?.models.length, unit: 'model' },
    { to: '/akis', icon: Newspaper, title: 'Akış', text: 'Duyurular ve kısa paylaşımlar', count: data?.posts.length, unit: 'paylaşım' },
  ];

  return (
    <div className="pb-16">

      {/* Karşılama: solda metin, sağda bölümler. Geniş ekranda sağ taraf boş kalmasın. */}
      <header className="relative -mx-4 sm:-mx-6 md:-mx-8 -mt-6 md:-mt-8 px-4 sm:px-6 md:px-8 pt-10 pb-10 md:pt-14 md:pb-12">
        <div className="kareli absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10 items-center">

          <div className="lg:col-span-7">
            <p className="etiket mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-isaret mr-2 align-middle" />
              Maker kulübü · çevrimiçi atölye
            </p>
            {user ? (
              <h1 className="font-display font-bold text-3xl sm:text-4xl leading-tight tracking-tight text-tebesir">
                Tekrar hoş geldin, <span className="text-isaret break-words">{user.username}</span>.
              </h1>
            ) : (
              <h1 className="font-display font-bold text-4xl sm:text-5xl leading-[1.08] tracking-tight text-tebesir">
                Üretenlerin <span className="text-isaret">ortak tezgâhı</span>.
              </h1>
            )}
            <p className="mt-4 text-base sm:text-[17px] leading-relaxed text-tebesir-soluk max-w-xl">
              Projeni paylaş, obanda ders notlarını ve çıkmış soruları bul, 3B modelini yükle.
              {!user && ' Her şey üye olmadan gezilebilir; katkı vermek istediğinde bir hesap yeter.'}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                to={user ? '/e-oba' : '/auth'}
                className="px-4 py-2 rounded-md bg-isaret text-levha-koyu text-[15px] font-semibold hover:bg-isaret-acik transition-colors"
              >
                {user ? 'Obalara git' : 'Aramıza katıl'}
              </Link>
              <Link to="/projeler" className="group inline-flex items-center text-[15px] font-medium text-tebesir hover:text-isaret transition-colors">
                Projelere göz at
                <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Bölümler */}
          <nav aria-label="Bölümler" className="lg:col-span-5 grid grid-cols-2 gap-px bg-levha-cizgi border border-levha-cizgi rounded-lg overflow-hidden">
            {areas.map(({ to, icon: Icon, title, text, count, unit }) => (
              <Link key={to} to={to} className="group bg-levha hover:bg-levha-yuzey transition-colors p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <Icon className="w-5 h-5 text-tebesir-soluk group-hover:text-isaret transition-colors" strokeWidth={1.75} />
                  <span className="etiket">{count === undefined ? '—' : `${count} ${unit}`}</span>
                </div>
                <span className="font-display font-semibold text-base text-tebesir">{title}</span>
                <span className="mt-0.5 text-[13px] leading-snug text-tebesir-soluk hidden sm:block">{text}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mt-4 md:mt-6 grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-12">

        {/* Son projeler */}
        <div className="lg:col-span-7">
          <Section title="Son projeler" to="/projeler" linkLabel="Tüm projeler">
            {!data ? <Skeleton rows={3} /> : data.projects.length === 0 ? (
              <Empty text="Henüz paylaşılmış proje yok." to="/projeler" action="İlkini sen ekle" />
            ) : (
              <ul className="divide-y divide-levha-cizgi">
                {data.projects.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link to={`/projeler/${p.id}`} className="group block py-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="font-medium text-tebesir group-hover:text-isaret transition-colors truncate">{p.title}</h3>
                        <span className="etiket shrink-0">{timeAgo(p.createdAt)}</span>
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
            {!data ? <Skeleton rows={3} /> : data.posts.length === 0 ? (
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

        {/* Obalar */}
        <div className="lg:col-span-7">
          <Section title="Obalar" to="/e-oba" linkLabel="Tüm obalar">
            {!data ? <Skeleton rows={2} /> : data.obalar.length === 0 ? (
              <Empty text="Henüz kurulmuş bir oba yok." to="/e-oba" action="İlk obayı kur" />
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.obalar.slice(0, 6).map((oba) => (
                  <li key={oba.id}>
                    <Link to={`/e-oba/${oba.id}`} className="group flex items-center gap-3 p-3 rounded-md border border-levha-cizgi hover:border-tebesir-silik hover:bg-levha-yuzey transition-colors">
                      <span className="w-9 h-9 shrink-0 rounded-md bg-levha-yuzey border border-levha-cizgi flex items-center justify-center font-display font-bold text-tebesir">
                        {oba.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-medium text-tebesir truncate">
                          <span className="truncate">{oba.name}</span>
                          {oba.isPrivate && <Lock className="w-3.5 h-3.5 shrink-0 text-tebesir-silik" aria-label="Gizli oba" />}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-tebesir-silik">
                          <Users className="w-3 h-3" aria-hidden="true" />
                          {oba.memberCount ?? 1} üye
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* 3B modeller */}
        <div className="lg:col-span-5">
          <Section title="Yeni 3B modeller" to="/baski-istasyonu" linkLabel="İstasyona git">
            {!data ? <Skeleton rows={2} /> : data.models.length === 0 ? (
              <Empty text="Henüz yüklenmiş model yok." to="/baski-istasyonu" action="STL yükle" />
            ) : (
              <ul className="divide-y divide-levha-cizgi">
                {data.models.slice(0, 4).map((m) => (
                  <li key={m.id} className="py-3 flex items-center gap-3">
                    <Box className="w-4 h-4 shrink-0 text-tebesir-silik" strokeWidth={1.75} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm text-tebesir truncate">{m.title}</span>
                    <span className="text-xs text-tebesir-silik shrink-0">{m.uploader}</span>
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
