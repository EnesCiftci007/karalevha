import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Users } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Oba, Post } from '../types';
import Avatar from '../components/ui/Avatar';
import PageHeader from '../components/ui/PageHeader';
import PostItem from '../components/akis/PostItem';
import { Comments, CommentToggle, LikeButton, useSocialCounts } from '../components/social/Social';
import { SocialCounts } from '../types';

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
const PAGE = 20; // bir seferde gösterilen gönderi sayısı

export default function Akis() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [loadFailed, setLoadFailed] = useState(false);
  const [obalar, setObalar] = useState<Oba[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    api<Post[]>('/api/posts')
      .then((data) => !cancelled && setPosts(data))
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setLoadFailed(true);
      });
    api<Oba[]>('/api/obalar')
      .then((data) => !cancelled && setObalar(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
      setPosts((prev) => [newPost, ...(prev ?? [])]);
      setContent('');
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
                <div className="flex items-center justify-end gap-4 mt-1">
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
              {loadFailed ? 'Akış yüklenemedi. Sayfayı yenilemeyi dene.' : 'Akış henüz sessiz. İlk paylaşımı sen yap.'}
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
                  footer={<PostFooter post={post} counts={social.get(post.id)} onChange={(patch) => social.update(post.id, patch)} />}
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
