import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Users } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Oba, Post } from '../types';
import { extractTags, normalizeTag } from '../utils/hashtags';
import FeedFilter, { DEFAULT_FILTER, type FeedFilterValue, type Period, type Scope, type SortKey } from '../components/akis/FeedFilter';
import Avatar from '../components/ui/Avatar';
import PageHeader from '../components/ui/PageHeader';
import PostItem from '../components/akis/PostItem';
import { Comments, CommentToggle, LikeButton, useSocialCounts } from '../components/social/Social';
import { SocialCounts } from '../types';

/** Zaman filtresinin başlangıcı (yerel saatle: bugün gece yarısı, haftanın pazartesisi, ayın biri) */
function periodStart(period: Period): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'hafta') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === 'ay') d.setDate(1);
  return period === 'tum' ? 0 : d.getTime();
}

/** Etiket düğmesi: seçili olunca işaret rengi */
function TagChip({ tag, active, onClick, count }: { tag: string; active?: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded border text-xs transition-colors ${
        active ? 'border-isaret text-isaret bg-isaret/10' : 'border-levha-cizgi text-tebesir-soluk hover:border-tebesir-silik hover:text-tebesir'
      }`}
    >
      #{tag}
      {count !== undefined && count > 0 && <span className="veri">{count}</span>}
    </button>
  );
}

function PostFooter({ post, counts, onChange }: { post: Post; counts: SocialCounts; onChange: (patch: Partial<SocialCounts>) => void }) {
  const [open, setOpen] = useState(() => window.location.hash === `#gonderi-${post.id}`);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <LikeButton type="post" id={post.id} counts={counts} onChange={onChange} />
        <CommentToggle count={counts.comments} open={open} onClick={() => setOpen((v) => !v)} />
      </div>
      {open && (
        <div className="mt-3 pl-1">
          <Comments type="post" id={post.id} ownerId={post.user?.id} onCountChange={(n) => onChange({ comments: n })} />
        </div>
      )}
    </div>
  );
}

const MAX_LENGTH = 1000; // Backend sınırıyla aynı
const PAGE = 20; // bir seferde sunucudan istenen gönderi sayısı

type PostPage = { items: Post[]; nextCursor: string | null };

/** Akış isteğinin adresi: süzgeçler sunucuda uygulanır, sayfalar cursor ile devam eder */
function feedUrl(f: { tag: string | null; scope: Scope; sort: SortKey; period: Period }, cursor?: string | null) {
  const q = new URLSearchParams({ limit: String(PAGE) });
  if (f.tag) q.set('etiket', f.tag);
  if (f.scope !== 'hepsi') q.set('kapsam', f.scope);
  if (f.sort !== 'yeni') q.set('sirala', f.sort);
  if (f.period !== 'tum') q.set('since', new Date(periodStart(f.period)).toISOString());
  if (cursor) q.set('cursor', cursor);
  return `/api/posts?${q}`;
}

export default function Akis() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  // Filtre adreste durur: /akis?etiket=arduino&kapsam=takip&sirala=begeni&zaman=hafta (paylaşılabilir, geri tuşu çalışır)
  const rawTag = params.get('etiket');
  const tagFilter = rawTag ? normalizeTag(rawTag) : null;
  const scopeParam = params.get('kapsam');
  const scope: Scope = user && (scopeParam === 'takip' || scopeParam === 'benim') ? scopeParam : 'hepsi';
  const sortParam = params.get('sirala');
  const sort: SortKey = sortParam === 'begeni' || sortParam === 'yorum' ? sortParam : 'yeni';
  const periodParam = params.get('zaman');
  const period: Period = periodParam === 'gun' || periodParam === 'hafta' || periodParam === 'ay' ? periodParam : 'tum';
  const filter: FeedFilterValue = { scope, sort, period, tag: tagFilter };
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);
  const [trendingRecent, setTrendingRecent] = useState(true);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  // Süzgeç değişince eski isteğin geç gelen sonucu yeni listeye karışmasın
  const feedReqRef = useRef(0);
  const [obalar, setObalar] = useState<Oba[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setFilter = (patch: Partial<FeedFilterValue>) => {
    const next = { ...filter, ...patch };
    const p = new URLSearchParams();
    if (next.tag) p.set('etiket', next.tag);
    if (next.scope !== DEFAULT_FILTER.scope) p.set('kapsam', next.scope);
    if (next.sort !== DEFAULT_FILTER.sort) p.set('sirala', next.sort);
    if (next.period !== DEFAULT_FILTER.period) p.set('zaman', next.period);
    setParams(p);
  };

  useEffect(() => {
    const req = ++feedReqRef.current;
    setPosts(null);
    setNextCursor(null);
    setMoreError('');
    setLoadFailed(false);
    api<PostPage>(feedUrl({ tag: tagFilter, scope, sort, period }))
      .then((page) => {
        if (feedReqRef.current !== req) return;
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (feedReqRef.current !== req) return;
        setPosts([]);
        setLoadFailed(true);
      });
    // user: giriş/çıkışta ilgi alanına göre öne çıkanlar ve "takip" değişir
  }, [tagFilter, scope, sort, period, user]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    const req = feedReqRef.current;
    setLoadingMore(true);
    setMoreError('');
    try {
      const page = await api<PostPage>(feedUrl({ tag: tagFilter, scope, sort, period }, nextCursor));
      if (feedReqRef.current !== req) return;
      // Beğeni/yorum sayısı sayfalar arasında değişebilir: aynı gönderi iki kez gösterilmez
      setPosts((prev) => {
        const seen = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...page.items.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (feedReqRef.current === req) setMoreError(err instanceof Error ? err.message : 'Daha fazla gönderi yüklenemedi.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    api<Oba[]>('/api/obalar').then(setObalar).catch(() => {});
    api<{ recent: boolean; tags: { tag: string; count: number }[] }>('/api/posts/etiketler')
      .then((d) => {
        setTrending(d.tags);
        setTrendingRecent(d.recent);
      })
      .catch(() => {});
  }, []);

  // Yazarken metindeki #etiketler önizlenir (sunucu da aynı kuralla okur)
  const draftTags = useMemo(() => extractTags(content), [content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Yazdıkça uzayan kutu
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text || !user || sending) return;

    setSending(true);
    setError('');
    try {
      const newPost = await api<Post>('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      // Süzgeçle uyuşmayan yeni gönderi listeye eklenmez (ör. başka etiket seçiliyken)
      if (!tagFilter || newPost.tags?.includes(tagFilter)) setPosts((prev) => [newPost, ...(prev ?? [])]);
      // Gündem: var olan etiketlerin sayısı artar, yeni etiketler sona eklenir
      setTrending((prev) => {
        const next = prev.map((t) => (newPost.tags?.includes(t.tag) ? { ...t, count: t.count + 1 } : t));
        for (const t of newPost.tags ?? []) if (!next.some((x) => x.tag === t)) next.push({ tag: t, count: 1 });
        return next.sort((a, b) => b.count - a.count).slice(0, 12);
      });
      setContent('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gönderi paylaşılamadı.');
    } finally {
      setSending(false);
    }
  };

  const social = useSocialCounts('post', (posts ?? []).map((p) => p.id));

  // Etiket, kapsam, zaman ve sıralama sunucuda uygulanır; liste geldiği sırayla gösterilir
  const visible = posts ?? [];

  // Bildirimden #gonderi-ID ile gelindiyse o gönderiye kaydır
  useEffect(() => {
    if (!posts || !window.location.hash.startsWith('#gonderi-')) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [posts]);

  const remaining = MAX_LENGTH - content.length;

  return (
    <div className="pb-16">
      <PageHeader title="Akış" description="Duyurular, sorular ve kısa paylaşımlar." />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10">

        {/* Akış sütunu */}
        <div className="lg:col-span-8 max-w-okuma w-full">

          {/* Yazma kutusu */}
          {user ? (
            <form onSubmit={handlePostSubmit} className="flex gap-3 pb-5 border-b border-levha-cizgi">
              <Avatar name={user.username} />
              <div className="flex-1 min-w-0">
                <label htmlFor="akis-yaz" className="sr-only">Yeni gönderi</label>
                <textarea
                  id="akis-yaz"
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePostSubmit(e);
                  }}
                  placeholder="Ne üzerinde çalışıyorsun? #etiket yazarak konu aç"
                  rows={2}
                  maxLength={MAX_LENGTH}
                  className="w-full resize-none bg-transparent pt-1.5 text-base leading-relaxed text-tebesir placeholder:text-tebesir-silik focus:outline-none max-h-80"
                />
                {error && <p className="text-sm text-hata mb-2" role="alert">{error}</p>}
                <div className="flex items-center justify-end gap-4 mt-3">
                  {/* Metinden okunan etiketler */}
                  {draftTags.length > 0 && (
                    <span className="mr-auto flex flex-wrap gap-x-2 gap-y-1 text-sm text-isaret/90" aria-label="Etiketler">
                      {draftTags.map((t) => <span key={t}>#{t}</span>)}
                    </span>
                  )}
                  {content.length > 0 && (
                    <span className={`veri ${remaining < 50 ? 'text-hata' : ''}`}>
                      {remaining}
                    </span>
                  )}
                  <button type="submit" disabled={sending || !content.trim()} className="btn-ana">
                    {sending ? 'Paylaşılıyor…' : 'Paylaş'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-levha-cizgi">
              <p className="text-sm text-tebesir-soluk">Akışı herkes okuyabilir; yazmak için giriş yapman yeterli.</p>
              <Link to="/auth" state={{ from: '/akis' }} className="btn-ikincil">Giriş yap</Link>
            </div>
          )}

          {/* Filtre */}
          <div className="pt-5 pb-1">
            <FeedFilter value={filter} onChange={setFilter} suggestions={trending.map((t) => t.tag)} signedIn={!!user} />
          </div>
          {/* Telefonda gündem: yan sütun gizli olduğundan etiketler burada */}
          <div className="lg:hidden flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
            {trending.map((t) => (
              <TagChip key={t.tag} tag={t.tag} count={t.count} active={tagFilter === t.tag} onClick={() => setFilter({ tag: tagFilter === t.tag ? null : t.tag })} />
            ))}
          </div>

          {/* Gönderiler */}
          {posts === null ? (
            <div className="divide-y divide-levha-cizgi" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 py-5">
                  <div className="w-10 h-10 rounded-full bg-levha-yuzey/60" />
                  <div className="flex-1 space-y-2.5 pt-1">
                    <div className="h-3 w-32 rounded bg-levha-yuzey/60" />
                    <div className="h-3 w-full rounded bg-levha-yuzey/60" />
                    <div className="h-3 w-2/3 rounded bg-levha-yuzey/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-tebesir-silik">
              {loadFailed
                ? 'Akış yüklenemedi. Sayfayı yenilemeyi dene.'
                : period !== 'tum'
                  ? 'Bu zaman aralığında gönderi yok.'
                : tagFilter
                  ? `#${tagFilter} etiketiyle henüz gönderi yok.`
                  : scope === 'benim'
                    ? 'Henüz bir şey paylaşmadın.'
                    : scope === 'takip'
                    ? 'Takip ettiğin kimse henüz paylaşım yapmadı. Profillerden kişileri takip edebilirsin.'
                    : 'Akış henüz sessiz. İlk paylaşımı sen yap.'}
            </p>
          ) : (
            <>
            <ul className="divide-y divide-levha-cizgi">
              {visible.map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  onUpdated={(updated) => setPosts((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)))}
                  onDeleted={(id) => setPosts((prev) => (prev ?? []).filter((p) => p.id !== id))}
                  footer={<PostFooter post={post} counts={social.get(post.id)} onChange={(patch) => social.update(post.id, patch)} />}
                />
              ))}
            </ul>
            {(nextCursor || moreError) && (
              <div className="pt-4 flex flex-col items-center gap-1">
                <button type="button" className="btn-ikincil" onClick={loadMore} disabled={loadingMore || !nextCursor}>
                  {loadingMore ? 'Yükleniyor…' : 'Daha fazla göster'}
                </button>
                {moreError && <p className="text-xs text-hata" role="alert">{moreError}</p>}
              </div>
            )}
            </>
          )}
        </div>

        {/* Yan sütun */}
        <aside className="hidden lg:block lg:col-span-4">
          <div className="sticky top-24 space-y-8">
            <section className="rounded-lg border border-levha-cizgi">
              <h2 className="text-sm font-semibold text-tebesir px-4 pt-4 pb-1">Gündem</h2>
              <p className="px-4 pb-2 text-xs text-tebesir-silik">{trendingRecent ? 'Son 7 günün etiketleri' : 'En çok kullanılan etiketler'}</p>
              {trending.length === 0 && (
                <p className="px-4 pb-4 text-sm text-tebesir-silik">Henüz etiket yok. Gönderine #kelime yazarak bir konu aç.</p>
              )}
              <ul className="pb-2">
                {trending.map((t) => (
                  <li key={t.tag}>
                    <button
                      type="button"
                      onClick={() => setFilter({ tag: tagFilter === t.tag ? null : t.tag })}
                      aria-pressed={tagFilter === t.tag}
                      className={`w-full flex items-center justify-between px-4 py-1.5 text-sm text-left transition-colors hover:bg-levha-yuzey ${
                        tagFilter === t.tag ? 'text-isaret' : 'text-tebesir-soluk hover:text-tebesir'
                      }`}
                    >
                      <span>#{t.tag}</span>
                      <span className="veri">{t.count > 0 ? `${t.count} gönderi` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-levha-cizgi">
              <h2 className="text-sm font-semibold text-tebesir px-4 pt-4 pb-2">Obalar</h2>
              {obalar.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-tebesir-silik">Henüz oba yok.</p>
              ) : (
                <ul>
                  {obalar.slice(0, 5).map((oba) => (
                    <li key={oba.id}>
                      <Link to={`/e-oba/${oba.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-levha-yuzey transition-colors">
                        <span className="w-8 h-8 shrink-0 rounded-md bg-levha-yuzey border border-levha-cizgi flex items-center justify-center font-display font-bold text-sm text-tebesir">
                          {oba.name.charAt(0).toLocaleUpperCase('tr')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-tebesir">
                            <span className="truncate">{oba.name}</span>
                            {oba.isPrivate && <Lock className="w-3 h-3 shrink-0 text-tebesir-silik" aria-label="Gizli oba" />}
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
              <Link to="/e-oba" className="block px-4 py-3 border-t border-levha-cizgi text-sm text-tebesir-soluk hover:text-tebesir transition-colors">
                Tüm obalar
              </Link>
            </section>

            <p className="text-sm leading-relaxed text-tebesir-silik px-1">
              Uzun sohbetler ve dosya paylaşımı için obaları kullan; akış kısa duyurular ve sorular içindir.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
