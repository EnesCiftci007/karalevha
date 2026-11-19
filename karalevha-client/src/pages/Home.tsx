import { Suspense, lazy, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ClubEvent, Oba, Post, PrintModel, Project } from '../types';
import CommunityPulse from '../components/home/CommunityPulse';
import ClubNotes, { pickNote, rememberNote } from '../components/home/ClubNotes';
import { lastObaPath } from '../utils/lastOba';

// three.js sahnesi ayrı parça olarak, sayfa açıldıktan sonra yüklenir
const PrintScene = lazy(() => import('../components/home/PrintScene'));

/*
 * Yükseklik bütçesi: üst menü + sahne kartı + rakamlar + footer tek ekrana sığar (sayfa kaymaz).
 * Kartın dışında kalan her şey yaklaşık 25rem; kart ekranın geri kalanını alır.
 */
// Telefonda footer iki satıra kırılır, bu yüzden orada daha çok yer ayrılır
const SCENE_HEIGHT = 'h-[calc(100dvh-40.5rem)] sm:h-[calc(100dvh-29.75rem)] min-h-[180px] sm:min-h-[200px] max-h-[560px]';

/** Başlığın altındaki elle çekilmiş sprey çizgisi (menüdeki etkin sekmenin çizgisiyle aynı) */
function SprayUnderline() {
  return (
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="absolute left-0 -bottom-2 w-full h-2.5 text-isaret" aria-hidden="true">
      <path d="M2 5.5c14-3 26-2.5 38-1.5s27 1.6 40-1.2c6-1.2 11-1 18 .4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

async function list<T>(path: string): Promise<T[] | null> {
  try {
    return await api<T[]>(path);
  } catch {
    return null;
  }
}

interface Lists {
  projects: Project[] | null;
  models: PrintModel[] | null;
  obalar: Oba[] | null;
  posts: Post[] | null;
  /** Yaklaşan ilk etkinlik (yoksa null) */
  event: ClubEvent | null;
}

/**
 * Ana sayfa: bir vitrin. Katman katman baskı yapan 3B sahnenin içinde başlık ve düğmeler,
 * altında kulübün rakamları. Kişiye özel listeler profilde, bölümler üst menüde.
 */
export default function Home() {
  const { user } = useAuth();
  const [lists, setLists] = useState<Lists | null>(null);
  // Her gelişte bir not; sahne o notun modelini basar
  const [note] = useState(pickNote);
  useEffect(() => rememberNote(note), [note]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      list<Project>('/api/projects'),
      list<PrintModel>('/api/printmodels'),
      list<Oba>('/api/obalar'),
      list<Post>('/api/posts'),
      list<ClubEvent>('/api/etkinlik?take=1'),
    ]).then(([projects, models, obalar, posts, events]) =>
      !cancelled && setLists({ projects, models, obalar, posts, event: events?.[0] ?? null })
    );
    return () => {
      cancelled = true;
    };
    // Giriş/çıkışta "senin" sayıları değişir (obalardaki üyelik bilgisi kişiye göre gelir)
  }, [user?.id]);

  // Giriş yapan kişiye kendi sayıları ve kendi içeriğine süzülmüş sayfalar; misafire kulübün toplamı
  const mineOnly = <T,>(items: T[] | null | undefined, isMine: (t: T) => boolean) =>
    items ? (user ? items.filter(isMine).length : items.length) : undefined;
  const stats = [
    { label: user ? 'projen' : 'proje', value: mineOnly(lists?.projects, (p) => p.owner === user?.username || (!!user && !!p.memberIds?.includes(user.id))), to: '/projeler' },
    { label: user ? 'modelin' : 'model', value: mineOnly(lists?.models, (m) => m.userId === user?.id), to: '/projeler' },
    { label: user ? 'oban' : 'oba', value: mineOnly(lists?.obalar, (o) => !!o.isMember || o.owner === user?.username), to: '/e-oba' },
    { label: user ? 'paylaşımın' : 'paylaşım', value: mineOnly(lists?.posts, (p) => p.user?.id === user?.id), to: '/akis' },
  ].map((s) => ({ ...s, to: user ? `${s.to}?${s.to === '/akis' ? 'kapsam' : 'kimin'}=benim` : s.to }));

  return (
    <div>
      <section className="relative" aria-label="KaraLevha">
        <div className="kareli absolute -inset-3 pointer-events-none rounded-lg" aria-hidden="true" />
        <div className="relative kart bg-levha-koyu/70 px-3 pt-3 pb-2 overflow-hidden">
          {/* Başlık ve düğmeler sahnenin üstünde; arkadaki sahne fareyle çevrilebilir kalsın diye yalnızca kendileri tıklanır */}
          <header className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6 pointer-events-none">
            <div className="space-y-10">
              <h1 className="relative inline-block font-display font-bold text-2xl text-tebesir">
                KaraLevha
                <SprayUnderline />
              </h1>
              {/* Kulüp notları: sahne sağa kaydığında solda kalan boşlukta (geniş ekran) */}
              <div className="hidden lg:block">
                <ClubNotes note={note} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pointer-events-auto">
              {user ? (
                <>
                  <Link to="/atolye" className="btn-ikincil">Yazıcı ayır</Link>
                  <Link to={lastObaPath(user?.id)} className="btn-ana">Obalara git</Link>
                </>
              ) : (
                <>
                  <Link to="/projeler" className="btn-ikincil">Projelere bak</Link>
                  <Link to="/auth" className="btn-ana">Kayıt ol</Link>
                </>
              )}
            </div>
          </header>

          <Suspense fallback={<div className={SCENE_HEIGHT} />}>
            <PrintScene className={SCENE_HEIGHT} shiftRight={0.17} model={note.model} />
          </Suspense>
        </div>
      </section>

      {/* Rakamlar: tıklayınca ilgili sayfa (giriş yapılmışsa kişinin kendi içeriğine süzülmüş) */}
      <nav aria-label={user ? 'Senin içeriğin' : 'Kulübün rakamları'} className="mt-8 grid grid-cols-2 sm:grid-cols-4 sm:divide-x divide-levha-cizgi border-y border-levha-cizgi">
        {stats.map(({ label, value, to }) => (
          <Link key={label} to={to} className="group relative py-4 px-4 flex flex-col hover:bg-white/[0.03] focus-visible:bg-white/[0.03] transition-colors">
            {/* Üzerine gelince sağ üstte beliren ok */}
            <ArrowUpRight
              className="absolute top-3 right-3 w-4 h-4 text-isaret opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200"
              aria-hidden="true"
            />
            <span className="font-display font-bold text-xl text-tebesir tabular-nums group-hover:text-isaret transition-colors">{value ?? '—'}</span>
            <span className="etiket mt-0.5 group-hover:text-tebesir-soluk transition-colors">{label}</span>
            {/* Alttaki ince çizgi limon yeşiline döner */}
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-transparent group-hover:bg-isaret group-focus-visible:bg-isaret transition-colors" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      {/* Topluluk nabzı: yaklaşan etkinlik ve en son paylaşım */}
      {/* Veri geldiyse etkinlik ya vardır ya da yoktur (null); undefined yalnızca yüklenirken */}
      <CommunityPulse event={lists ? lists.event ?? null : undefined} projects={lists?.projects} posts={lists?.posts} />
    </div>
  );
}
