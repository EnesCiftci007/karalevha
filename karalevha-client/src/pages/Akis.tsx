import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Users, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Oba, POST_TAGS, Post } from '../types';
import Avatar from '../components/ui/Avatar';
import PageHeader from '../components/ui/PageHeader';
import PostItem from '../components/akis/PostItem';
import { Comments, CommentToggle, LikeButton, useSocialCounts } from '../components/social/Social';
import Tabs from '../components/ui/Tabs';
import { SocialCounts } from '../types';

const MAX_TAGS = 3;

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

function PostFooter({ post, counts, onChange, onTag }: { post: Post; counts: SocialCounts; onChange: (patch: Partial<SocialCounts>) => void; onTag: (tag: string) => void }) {
  const [open, setOpen] = useState(() => window.location.hash === `#gonderi-${post.id}`);
  return (
    <div className="mt-2">
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
          {post.tags.map((t) => (
            <button key={t} type="button" onClick={() => onTag(t)} className="text-sm text-isaret/90 hover:text-isaret hover:underline underline-offset-4">
              #{t}
            </button>
          ))}
        </div>
      )}
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
const PAGE = 20; // bir seferde gösterilen gönderi sayısı

export default function Akis() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tagFilter = params.get('etiket');
  const scope = params.get('kapsam') === 'takip' && user ? 'takip' : 'hepsi';
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [loadFailed, setLoadFailed] = useState(false);
  const [obalar, setObalar] = useState<Oba[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Süzgeç adreste durur: /akis?etiket=Robotik&kapsam=takip (paylaşılabilir, geri tuşu çalışır)
  const setFilter = (next: { etiket?: string | null; kapsam?: 'hepsi' | 'takip' }) => {
    const p = new URLSearchParams(params);
    if (next.etiket !== undefined) (next.etiket ? p.set('etiket', next.etiket) : p.delete('etiket'));
    if (next.kapsam !== undefined) (next.kapsam === 'takip' ? p.set('kapsam', 'takip') : p.delete('kapsam'));
    setParams(p);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    setShown(PAGE);
    setLoadFailed(false);
    const q = new URLSearchParams();
    if (tagFilter) q.set('etiket', tagFilter);
    if (scope === 'takip') q.set('kapsam', 'takip');
    api<Post[]>(`/api/posts${q.size ? `?${q}` : ''}`)
      .then((data) => !cancelled && setPosts(data))
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tagFilter, scope]);

  useEffect(() => {
    api<Oba[]>('/api/obalar').then(setObalar).catch(() => {});
    api<{ tag: string; count: number }[]>('/api/posts/etiketler').then(setTrending).catch(() => {});
  }, []);

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < MAX_TAGS ? [...prev, tag] : prev));

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
        body: JSON.stringify({ content: text, tags }),
      });
      // Süzgeçle uyuşmayan yeni gönderi listeye eklenmez (ör. başka etiket seçiliyken)
      if (!tagFilter || newPost.tags?.includes(tagFilter)) setPosts((prev) => [newPost, ...(prev ?? [])]);
      setTrending((prev) => prev.map((t) => (newPost.tags?.includes(t.tag) ? { ...t, count: t.count + 1 } : t)));
      setContent('');
      setTags([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gönderi paylaşılamadı.');
    } finally {
      setSending(false);
    }
  };

  const social = useSocialCounts('post', (posts ?? []).map((p) => p.id));

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
                  placeholder="Ne üzerinde çalışıyorsun?"
                  rows={2}
                  maxLength={MAX_LENGTH}
                  className="w-full resize-none bg-transparent pt-1.5 text-base leading-relaxed text-tebesir placeholder:text-tebesir-silik focus:outline-none max-h-80"
                />
                {error && <p className="text-sm text-hata mb-2" role="alert">{error}</p>}
                {(content.length > 0 || tags.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1" role="group" aria-label={`Etiketler, en fazla ${MAX_TAGS}`}>
                    {POST_TAGS.map((t) => (
                      <TagChip key={t} tag={t} active={tags.includes(t)} onClick={() => toggleTag(t)} />
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-end gap-4 mt-3">
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

          {/* Süzgeç */}
          <div className="flex flex-wrap items-center gap-3 pt-5 pb-1">
            {user && (
              <div className="w-64 max-w-full">
              <Tabs
                label="Akış"
                value={scope}
                onChange={(v) => setFilter({ kapsam: v })}
                options={[{ value: 'hepsi', label: 'Herkes' }, { value: 'takip', label: 'Takip ettiklerim' }]}
              />
              </div>
            )}
            {tagFilter && (
              <button type="button" onClick={() => setFilter({ etiket: null })} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded border border-isaret text-sm text-isaret bg-isaret/10">
                #{tagFilter}
                <X className="w-3.5 h-3.5" aria-label="Etiket süzgecini kaldır" />
              </button>
            )}
          </div>
          {/* Telefonda gündem: yan sütun gizli olduğundan etiketler burada */}
          <div className="lg:hidden flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
            {trending.map((t) => (
              <TagChip key={t.tag} tag={t.tag} count={t.count} active={tagFilter === t.tag} onClick={() => setFilter({ etiket: tagFilter === t.tag ? null : t.tag })} />
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
          ) : posts.length === 0 ? (
            <p className="py-12 text-center text-tebesir-silik">
              {loadFailed
                ? 'Akış yüklenemedi. Sayfayı yenilemeyi dene.'
                : tagFilter
                  ? `#${tagFilter} etiketiyle henüz gönderi yok.`
                  : scope === 'takip'
                    ? 'Takip ettiğin kimse henüz paylaşım yapmadı. Profillerden kişileri takip edebilirsin.'
                    : 'Akış henüz sessiz. İlk paylaşımı sen yap.'}
            </p>
          ) : (
            <>
            <ul className="divide-y divide-levha-cizgi">
              {posts.slice(0, shown).map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  onUpdated={(updated) => setPosts((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)))}
                  onDeleted={(id) => setPosts((prev) => (prev ?? []).filter((p) => p.id !== id))}
                  footer={<PostFooter post={post} counts={social.get(post.id)} onChange={(patch) => social.update(post.id, patch)} onTag={(t) => setFilter({ etiket: t })} />}
                />
              ))}
            </ul>
            {posts.length > shown && (
              <div className="pt-4 text-center">
                <button type="button" className="btn-ikincil" onClick={() => setShown((n) => n + PAGE)}>
                  Daha fazla göster <span className="veri">{posts.length - shown}</span>
                </button>
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
              <p className="px-4 pb-2 text-xs text-tebesir-silik">Son 7 günün etiketleri</p>
              <ul className="pb-2">
                {trending.map((t) => (
                  <li key={t.tag}>
                    <button
                      type="button"
                      onClick={() => setFilter({ etiket: tagFilter === t.tag ? null : t.tag })}
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
