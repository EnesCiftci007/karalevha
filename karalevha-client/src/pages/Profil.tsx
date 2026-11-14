import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, FolderGit2, MessagesSquare, Pencil, UserRound } from 'lucide-react';
import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../utils/time';
import { PostText } from '../components/akis/PostItem';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import Tabs from '../components/ui/Tabs';
import { AdminPanel, EditProfileModal, FollowButton, FollowListModal } from '../components/profil/ProfileParts';

interface Profile {
  id: number;
  username: string;
  joinedAt: string;
  isAdmin: boolean;
  role: 'User' | 'Admin' | 'Owner';
  bio: string | null;
  interests: string[];
  /** Yalnızca kişinin kendisine ve yöneticilere dolu gelir */
  bannedUntil: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
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
  const [editing, setEditing] = useState(false);
  const [followList, setFollowList] = useState<'takipci' | 'takip' | null>(null);

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
  const patch = (p: Partial<Profile>) => setProfile((prev) => (prev ? { ...prev, ...p } : prev));
  const joined = new Date(profile.joinedAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <header className="flex flex-wrap items-center gap-4 mb-8">
        <div className="scale-150 origin-left mr-4"><Avatar name={profile.username} /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-xl text-tebesir truncate">{profile.username}</h1>
            {profile.role === 'Owner' ? <Badge tone="isaret">Kurucu</Badge> : profile.isAdmin && <Badge tone="isaret">Yönetici</Badge>}
            {isMe && <Badge>Sen</Badge>}
          </div>
          <p className="text-sm text-tebesir-silik">{joined} tarihinden beri üye</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {isMe ? (
            <button type="button" onClick={() => setEditing(true)} className="btn-ikincil">
              <Pencil className="w-4 h-4" aria-hidden="true" /> Profili düzenle
            </button>
          ) : user ? (
            <FollowButton username={profile.username} following={profile.isFollowing} onChange={(isFollowing, followerCount) => patch({ isFollowing, followerCount })} />
          ) : null}
        </div>
      </header>

      {(profile.bio || profile.interests.length > 0) && (
        <div className="-mt-4 mb-6 max-w-okuma">
          {profile.bio && <p className="text-base text-tebesir-soluk whitespace-pre-wrap break-words">{profile.bio}</p>}
          {profile.interests.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {profile.interests.map((t) => (
                <Link key={t} to={`/akis?etiket=${encodeURIComponent(t)}`} className="text-sm text-isaret/90 hover:text-isaret hover:underline underline-offset-4">#{t}</Link>
              ))}
            </div>
          )}
        </div>
      )}

      <dl className="flex flex-wrap gap-x-8 gap-y-3 mb-8 pb-6 border-b border-levha-cizgi">
        {([
          ['Takipçi', profile.followerCount, 'takipci'],
          ['Takip', profile.followingCount, 'takip'],
          ['Proje', profile.projects.length, null],
          ['Model', profile.models.length, null],
          ['Baskı', profile.makes.length, null],
        ] as const).map(([label, count, list]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-xs text-tebesir-silik">{label}</dt>
            <dd className="font-display font-bold text-lg text-tebesir">
              {list ? (
                <button type="button" onClick={() => setFollowList(list)} className="hover:text-isaret" aria-label={`${count} ${label.toLocaleLowerCase('tr')}, listeyi aç`}>{count}</button>
              ) : count}
            </dd>
          </div>
        ))}
      </dl>

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
          {isMe && profile.bannedUntil && (
            <p className="kart p-4 mb-8 text-sm text-hata">Hesabın askıda. Paylaşım yapamazsın.</p>
          )}
          {!isMe && user?.isAdmin && (
            <AdminPanel
              userId={profile.id}
              username={profile.username}
              role={profile.role}
              bannedUntil={profile.bannedUntil}
              viewerIsOwner={user.role === 'Owner'}
              onChange={(p) => patch({ ...p, ...(p.role ? { isAdmin: p.role === 'Admin' } : {}) })}
            />
          )}
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

      {editing && (
        <EditProfileModal
          bio={profile.bio}
          interests={profile.interests}
          onClose={() => setEditing(false)}
          onSaved={(bio, interests) => {
            patch({ bio, interests });
            setEditing(false);
          }}
        />
      )}
      {followList && <FollowListModal username={profile.username} direction={followList} onClose={() => setFollowList(null)} />}
    </div>
  );
}
