import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, FolderGit2, MessagesSquare, UserRound } from 'lucide-react';
import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../utils/time';
import { PostText } from '../components/akis/PostItem';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import Tabs from '../components/ui/Tabs';

interface Profile {
  username: string;
  joinedAt: string;
  isAdmin: boolean;
  projects: { id: number; title: string; description: string; repoUrl: string; createdAt: string }[];
  models: { id: number; title: string; category: 'baski' | 'oyun'; format: string; uploadedAt: string }[];
  posts: { id: number; content: string; createdAt: string }[];
  makes: { id: number; photoPath: string; printModelId: number; modelTitle: string; createdAt: string }[];
  obalar: { id: number; name: string }[];
}

type Tab = 'projeler' | 'modeller' | 'baskilar' | 'paylasimlar';

export default function Profil() {
  const { username = '' } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('projeler');

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setFailed(false);
    api<Profile>(`/api/users/${encodeURIComponent(username)}`)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        // Boş sekmede açılmasın: içeriği olan ilk sekmeyi seç
        setTab(p.projects.length ? 'projeler' : p.models.length ? 'modeller' : p.makes.length ? 'baskilar' : 'paylasimlar');
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (failed) {
    return <EmptyState icon={UserRound} title="Böyle bir üye yok" description="Kullanıcı adı yanlış yazılmış olabilir." action={<Link to="/" className="btn-ikincil">Ana sayfaya dön</Link>} />;
  }
  if (!profile) {
    return (
      <div role="status" aria-label="Yükleniyor">
        <div className="flex items-center gap-4 mb-8"><Skeleton className="w-16 h-16 rounded-full" /><Skeleton className="h-6 w-48" /></div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const isMe = user?.username === profile.username;
  const joined = new Date(profile.joinedAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <header className="flex flex-wrap items-center gap-4 mb-8">
        <div className="scale-150 origin-left mr-4"><Avatar name={profile.username} /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-extrabold text-2xl text-tebesir truncate">{profile.username}</h1>
            {profile.isAdmin && <Badge tone="isaret">Yönetici</Badge>}
            {isMe && <Badge>Sen</Badge>}
          </div>
          <p className="text-sm text-tebesir-silik">{joined} tarihinden beri üye</p>
        </div>
        <dl className="flex gap-6 sm:ml-auto">
          {[
            ['Proje', profile.projects.length],
            ['Model', profile.models.length],
            ['Baskı', profile.makes.length],
          ].map(([label, count]) => (
            <div key={label as string} className="text-center">
              <dd className="font-display font-bold text-lg text-tebesir">{count}</dd>
              <dt className="text-xs text-tebesir-silik">{label}</dt>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid lg:grid-cols-12 gap-x-12 gap-y-8">
        <div className="lg:col-span-8">
          <div className="mb-6 max-w-md">
            <Tabs
              label="Profil bölümleri"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'projeler', label: 'Projeler' },
                { value: 'modeller', label: 'Modeller' },
                { value: 'baskilar', label: 'Baskılar' },
                { value: 'paylasimlar', label: 'Paylaşımlar' },
              ]}
            />
          </div>

          {tab === 'projeler' && (
            profile.projects.length === 0 ? <p className="text-sm text-tebesir-silik">Henüz proje yok.</p> : (
              <ul className="kart divide-y divide-levha-cizgi">
                {profile.projects.map((p) => (
                  <li key={p.id} className="p-4">
                    <Link to={`/projeler/${p.id}`} className="flex items-center gap-2 text-base font-semibold text-tebesir hover:underline underline-offset-4">
                      <FolderGit2 className="w-4 h-4 text-tebesir-silik" aria-hidden="true" />{p.title}
                    </Link>
                    <p className="mt-1 text-sm text-tebesir-soluk line-clamp-2">{p.description}</p>
                    <p className="mt-2 text-xs text-tebesir-silik">{timeAgo(p.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'modeller' && (
            profile.models.length === 0 ? <p className="text-sm text-tebesir-silik">Henüz model yok.</p> : (
              <ul className="kart divide-y divide-levha-cizgi">
                {profile.models.map((m) => (
                  <li key={m.id}>
                    <Link to={`/baski-istasyonu?model=${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-levha-yuzey/50 transition-colors">
                      <Box className="w-4 h-4 text-tebesir-silik" aria-hidden="true" />
                      <span className="flex-1 min-w-0 text-sm font-medium text-tebesir truncate">{m.title}</span>
                      <Badge>{m.category === 'oyun' ? 'Oyun' : 'Baskı'}</Badge>
                      <span className="veri">{m.format.toUpperCase()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'baskilar' && (
            profile.makes.length === 0 ? <p className="text-sm text-tebesir-silik">Henüz baskı fotoğrafı yok.</p> : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {profile.makes.map((m) => (
                  <li key={m.id} className="kart overflow-hidden">
                    <Link to={`/baski-istasyonu?model=${m.printModelId}`}>
                      <img src={`${API_URL}${m.photoPath}`} alt={m.modelTitle} loading="lazy" className="w-full aspect-square object-cover" />
                      <p className="px-3 py-2 text-sm text-tebesir truncate">{m.modelTitle}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'paylasimlar' && (
            profile.posts.length === 0 ? <p className="text-sm text-tebesir-silik">Henüz paylaşım yok.</p> : (
              <ul className="divide-y divide-levha-cizgi max-w-okuma">
                {profile.posts.map((p) => (
                  <li key={p.id} className="py-4">
                    <PostText text={p.content} />
                    <p className="mt-1 text-xs text-tebesir-silik">{timeAgo(p.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>

        <aside className="lg:col-span-4">
          <h2 className="text-sm font-semibold text-tebesir mb-3">Obaları</h2>
          {profile.obalar.length === 0 ? (
            <p className="text-sm text-tebesir-silik">Açık bir obaya üye değil.</p>
          ) : (
            <ul className="space-y-1">
              {profile.obalar.map((o) => (
                <li key={o.id}>
                  <Link to={`/e-oba/${o.id}`} className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md text-sm text-tebesir-soluk hover:text-tebesir hover:bg-levha-yuzey transition-colors">
                    <MessagesSquare className="w-4 h-4 text-tebesir-silik" aria-hidden="true" />{o.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
