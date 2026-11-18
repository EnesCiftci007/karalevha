import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageSquare, Reply, Trash2 } from 'lucide-react';
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

/** Yorum beğenisi: küçük kalp ve sayı (iyimser güncelleme) */
function CommentLike({ comment, onChange }: { comment: CommentItem; onChange: (patch: Partial<CommentItem>) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!user || busy) return;
    setBusy(true);
    const before = { liked: comment.liked, likes: comment.likes };
    onChange({ liked: !before.liked, likes: before.likes + (before.liked ? -1 : 1) });
    try {
      onChange(await api<{ liked: boolean; likes: number }>(`/api/begeni/comment/${comment.id}`, { method: 'POST' }));
    } catch {
      onChange(before);
    } finally {
      setBusy(false);
    }
  };

  const look = `inline-flex items-center gap-1 text-xs transition-colors ${comment.liked ? 'text-isaret' : 'text-tebesir-silik hover:text-tebesir'}`;
  const inner = (
    <>
      <Heart className={`w-3.5 h-3.5 ${comment.liked ? 'fill-isaret' : ''}`} aria-hidden="true" />
      {comment.likes > 0 && <span className="veri">{comment.likes}</span>}
    </>
  );
  return user ? (
    <button type="button" onClick={toggle} aria-pressed={comment.liked} aria-label={comment.liked ? 'Yorumun beğenisini geri al' : 'Yorumu beğen'} className={look}>
      {inner}
    </button>
  ) : (
    <Link to="/auth" className={look} title="Beğenmek için giriş yap">{inner}</Link>
  );
}

/** Yorum yazma kutusu: ana yorum ya da yanıt */
function CommentForm({
  id, initial = '', placeholder, autoFocus, submitLabel, onSubmit, onCancel,
}: {
  id: string;
  initial?: string;
  placeholder: string;
  autoFocus?: boolean;
  submitLabel: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState(initial);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  // Yanıt kutusu "@ad " ile açılır; imleç sona gelsin
  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(initial.length, initial.length);
  }, [autoFocus, initial]);

  if (!user) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      await onSubmit(content);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yorum gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-3 items-start">
      <Avatar name={user.username} size="sm" />
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="sr-only">{placeholder}</label>
        <textarea
          ref={ref}
          id={id}
          rows={1}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
            if (e.key === 'Escape') onCancel?.();
          }}
          placeholder={placeholder}
          className="girdi resize-none"
        />
        {error && <p className="mt-1.5 text-xs text-hata" role="alert">{error}</p>}
      </div>
      <div className="flex items-center gap-1">
        {onCancel && <button type="button" onClick={onCancel} className="btn-sade">Vazgeç</button>}
        <button type="submit" disabled={sending || !text.trim()} className="btn-ikincil">{submitLabel}</button>
      </div>
    </form>
  );
}

/**
 * Yorum dizisi: yorumlar ve tek seviye yanıtlar, yorum beğenisi, yazma ve silme.
 * Yanıta yanıt da ana yorumun altına gider; kutu "@ad " ile açılır.
 */
export function Comments({ type, id, ownerId, onCountChange }: { type: TargetType; id: number; ownerId?: number; onCountChange?: (count: number) => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  // Hangi ana yorumun altında yanıt kutusu açık, kutu hangi metinle başlıyor
  const [replying, setReplying] = useState<{ parentId: number; initial: string } | null>(null);
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
  const patch = (commentId: number, p: Partial<CommentItem>) =>
    setComments((prev) => (prev ?? []).map((c) => (c.id === commentId ? { ...c, ...p } : c)));

  const post = async (content: string, parentId?: number) => {
    const created = await api<CommentItem>(`/api/yorum/${type}/${id}`, { method: 'POST', body: JSON.stringify({ content, parentId }) });
    set([...(comments ?? []), created]);
    if (parentId) setReplying(null);
  };

  const remove = async (commentId: number) => {
    try {
      const res = await api<{ removed?: number[] }>(`/api/yorum/${commentId}`, { method: 'DELETE' });
      const gone = new Set(res.removed ?? [commentId]);
      set((comments ?? []).filter((c) => !gone.has(c.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yorum silinemedi.');
    }
  };

  const roots = (comments ?? []).filter((c) => !c.parentId);
  const repliesOf = (rootId: number) => (comments ?? []).filter((c) => c.parentId === rootId);

  const item = (c: CommentItem, rootId: number) => {
    const canDelete = user && (user.id === c.userId || user.id === ownerId || user.isAdmin);
    return (
      <div className="group flex gap-3">
        <Avatar name={c.username} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <UserLink username={c.username} className="text-sm font-semibold text-tebesir" />
            <time dateTime={c.createdAt} title={fullDate(c.createdAt)} className="text-xs text-tebesir-silik">{timeAgo(c.createdAt)}</time>
            {canDelete && (
              <button type="button" onClick={() => remove(c.id)} className="ml-auto p-1 rounded text-tebesir-silik hover:text-hata opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label={c.parentId ? 'Yanıtı sil' : 'Yorumu ve yanıtlarını sil'}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="text-sm [&_p]:text-sm"><PostText text={c.content} /></div>
          <div className="mt-1 flex items-center gap-4">
            <CommentLike comment={c} onChange={(p) => patch(c.id, p)} />
            {user && (
              <button
                type="button"
                onClick={() => setReplying({ parentId: rootId, initial: c.parentId ? `@${c.username} ` : '' })}
                className="inline-flex items-center gap-1 text-xs text-tebesir-silik hover:text-tebesir transition-colors"
              >
                <Reply className="w-3.5 h-3.5" aria-hidden="true" />
                Yanıtla
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {comments === null ? (
        <p className="text-sm text-tebesir-silik">Yorumlar yükleniyor…</p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-tebesir-silik">Henüz yorum yok.</p>
      ) : (
        <ul className="space-y-5">
          {roots.map((root) => {
            const replies = repliesOf(root.id);
            const open = replying?.parentId === root.id;
            return (
              <li key={root.id}>
                {item(root, root.id)}
                {(replies.length > 0 || open) && (
                  <ul className="mt-3 ml-4 pl-5 border-l border-levha-cizgi space-y-3">
                    {replies.map((r) => <li key={r.id}>{item(r, root.id)}</li>)}
                    {open && (
                      <li>
                        <CommentForm
                          key={`${root.id}-${replying.initial}`}
                          id={`yanit-${type}-${id}-${root.id}`}
                          initial={replying.initial}
                          autoFocus
                          placeholder={`${root.username} kişisine yanıt yaz`}
                          submitLabel="Yanıtla"
                          onSubmit={(content) => post(content, root.id)}
                          onCancel={() => setReplying(null)}
                        />
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-xs text-hata" role="alert">{error}</p>}

      {user ? (
        <CommentForm id={`yorum-${type}-${id}`} placeholder="Yorum yaz… (@ad ile birinden bahset, #etiket kullan)" submitLabel="Gönder" onSubmit={(content) => post(content)} />
      ) : (
        <p className="text-sm text-tebesir-silik">
          Yorum yazmak için <Link to="/auth" className="text-tebesir-soluk underline underline-offset-4">giriş yap</Link>.
        </p>
      )}
    </div>
  );
}
