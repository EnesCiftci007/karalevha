import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageSquare, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CommentItem, SocialCounts } from '../../types';
import { fullDate, timeAgo } from '../../utils/time';
import { PostText } from '../akis/PostItem';
import Avatar from '../ui/Avatar';
import UserLink from '../ui/UserLink';

export type TargetType = 'post' | 'project' | 'model';

const EMPTY: SocialCounts = { likes: 0, liked: false, comments: 0 };

/** Bir listedeki öğelerin beğeni/yorum sayılarını tek istekte getirir. */
export function useSocialCounts(type: TargetType, ids: number[]) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<number, SocialCounts>>({});
  const key = ids.join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    api<Record<string, SocialCounts>>(`/api/begeni/${type}?ids=${key}`)
      .then((data) => {
        if (cancelled) return;
        const next: Record<number, SocialCounts> = {};
        for (const [id, c] of Object.entries(data)) next[Number(id)] = c;
        setCounts(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, key, user?.id]);

  const get = useCallback((id: number) => counts[id] ?? EMPTY, [counts]);
  const update = useCallback((id: number, patch: Partial<SocialCounts>) => {
    setCounts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY), ...patch } }));
  }, []);
  return { get, update };
}

export function LikeButton({ type, id, counts, onChange }: { type: TargetType; id: number; counts: SocialCounts; onChange: (patch: Partial<SocialCounts>) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!user || busy) return;
    setBusy(true);
    // İyimser güncelleme: önce ekranda değiştir, sunucu cevabıyla düzelt
    onChange({ liked: !counts.liked, likes: counts.likes + (counts.liked ? -1 : 1) });
    try {
      const res = await api<{ liked: boolean; likes: number }>(`/api/begeni/${type}/${id}`, { method: 'POST' });
      onChange(res);
    } catch {
      onChange({ liked: counts.liked, likes: counts.likes });
    } finally {
      setBusy(false);
    }
  };

  const content = (
    <>
      <Heart className={`w-4 h-4 ${counts.liked ? 'fill-isaret text-isaret' : ''}`} aria-hidden="true" />
      <span className="veri text-sm">{counts.likes}</span>
    </>
  );

  if (!user) {
    return (
      <Link to="/auth" className="inline-flex items-center gap-1.5 h-8 px-2 -ml-2 rounded-md text-tebesir-silik hover:text-tebesir hover:bg-levha-yuzey transition-colors" title="Beğenmek için giriş yap">
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={counts.liked}
      aria-label={counts.liked ? 'Beğeniyi geri al' : 'Beğen'}
      className={`inline-flex items-center gap-1.5 h-8 px-2 -ml-2 rounded-md transition-colors hover:bg-levha-yuzey ${counts.liked ? 'text-isaret' : 'text-tebesir-silik hover:text-tebesir'}`}
    >
      {content}
    </button>
  );
}

export function CommentToggle({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`inline-flex items-center gap-1.5 h-8 px-2 rounded-md transition-colors hover:bg-levha-yuzey ${open ? 'text-tebesir' : 'text-tebesir-silik hover:text-tebesir'}`}
    >
      <MessageSquare className="w-4 h-4" aria-hidden="true" />
      <span className="veri text-sm">{count}</span>
      <span className="sr-only">yorum</span>
    </button>
  );
}

/** Yorum dizisi: yorumlar, yorum yazma ve silme. */
export function Comments({ type, id, ownerId, onCountChange }: { type: TargetType; id: number; ownerId?: number; onCountChange?: (count: number) => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<CommentItem[]>(`/api/yorum/${type}/${id}`).then((d) => !cancelled && setComments(d)).catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  const set = (next: CommentItem[]) => {
    setComments(next);
    onCountChange?.(next.length);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      const created = await api<CommentItem>(`/api/yorum/${type}/${id}`, { method: 'POST', body: JSON.stringify({ content }) });
      set([...(comments ?? []), created]);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yorum gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const remove = async (commentId: number) => {
    try {
      await api(`/api/yorum/${commentId}`, { method: 'DELETE' });
      set((comments ?? []).filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yorum silinemedi.');
    }
  };

  return (
    <div className="space-y-4">
      {comments === null ? (
        <p className="text-sm text-tebesir-silik">Yorumlar yükleniyor…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-tebesir-silik">Henüz yorum yok.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const canDelete = user && (user.id === c.userId || user.id === ownerId || user.isAdmin);
            return (
              <li key={c.id} className="group flex gap-3">
                <Avatar name={c.username} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <UserLink username={c.username} className="text-sm font-semibold text-tebesir" />
                    <time dateTime={c.createdAt} title={fullDate(c.createdAt)} className="text-xs text-tebesir-silik">{timeAgo(c.createdAt)}</time>
                    {canDelete && (
                      <button type="button" onClick={() => remove(c.id)} className="ml-auto p-1 rounded text-tebesir-silik hover:text-hata opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label="Yorumu sil">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-sm [&_p]:text-sm"><PostText text={c.content} /></div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {user ? (
        <form onSubmit={submit} className="flex gap-3 items-start">
          <Avatar name={user.username} size="sm" />
          <div className="flex-1 min-w-0">
            <label htmlFor={`yorum-${type}-${id}`} className="sr-only">Yorum yaz</label>
            <textarea
              id={`yorum-${type}-${id}`}
              rows={1}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) submit(e);
              }}
              placeholder="Yorum yaz… (@ad ile birinden bahset)"
              className="girdi resize-none"
            />
            {error && <p className="mt-1.5 text-xs text-hata" role="alert">{error}</p>}
          </div>
          <button type="submit" disabled={sending || !text.trim()} className="btn-ikincil">Gönder</button>
        </form>
      ) : (
        <p className="text-sm text-tebesir-silik">
          Yorum yazmak için <Link to="/auth" className="text-tebesir-soluk underline underline-offset-4">giriş yap</Link>.
        </p>
      )}
    </div>
  );
}
