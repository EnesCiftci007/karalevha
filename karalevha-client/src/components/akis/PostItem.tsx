import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Pencil, Trash2 } from 'lucide-react';
import { useReport } from '../ui/Report';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Post } from '../../types';
import { fullDate, timeAgo } from '../../utils/time';
import Avatar from '../ui/Avatar';
import ConfirmDialog from '../ui/ConfirmDialog';
import ItemMenu from '../ui/ItemMenu';
import UserLink from '../ui/UserLink';
import { HASHTAG, normalizeTag } from '../../utils/hashtags';

const MAX_LENGTH = 1000;
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Düz metindeki #etiketleri Akış süzgecine giden bağlantılara çevirir (X'teki gibi) */
function withHashtags(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(HASHTAG)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <Link key={`${keyPrefix}-${start}`} to={`/akis?etiket=${encodeURIComponent(normalizeTag(m[1]))}`} className="text-isaret hover:underline underline-offset-2">
        {m[0]}
      </Link>
    );
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Gönderi metnindeki bağlantıları ve #etiketleri tıklanabilir yapar; geri kalanı düz metin olarak kalır. */
export function PostText({ text }: { text: string }) {
  return (
    <p className="text-base leading-relaxed text-tebesir whitespace-pre-wrap break-words">
      {text.split(URL_PATTERN).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-isaret hover:underline underline-offset-2">
            {part.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          withHashtags(part, String(i))
        )
      )}
    </p>
  );
}

interface PostItemProps {
  post: Post;
  onUpdated: (post: Post) => void;
  onDeleted: (id: number) => void;
  /** Gönderinin altına eklenecek alan (beğeni, yorum) */
  footer?: React.ReactNode;
}

export default function PostItem({ post, onUpdated, onDeleted, footer }: PostItemProps) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const name = post.user?.username || 'Bilinmeyen';
  const isAuthor = user?.id === post.user?.id;
  const report = useReport();
  const canDelete = isAuthor || !!user?.isAdmin;

  const save = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api<Post>(`/api/posts/${post.id}`, { method: 'PUT', body: JSON.stringify({ content: text }) });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li id={`gonderi-${post.id}`} className="flex gap-3 py-4 scroll-mt-24">
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-2 mb-1 min-w-0">
            <UserLink username={name} className="font-semibold text-tebesir truncate" />
            <time dateTime={post.createdAt} title={fullDate(post.createdAt)} className="text-sm text-tebesir-silik shrink-0">
              · {timeAgo(post.createdAt)}
            </time>
            {post.editedAt && <span className="text-xs text-tebesir-silik shrink-0" title={fullDate(post.editedAt)}>(düzenlendi)</span>}
          </div>
          {!editing && (
            <ItemMenu
              label="Gönderi seçenekleri"
              actions={[
                ...(isAuthor ? [{ label: 'Düzenle', icon: Pencil, onSelect: () => { setDraft(post.content); setEditing(true); } }] : []),
                ...(canDelete ? [{ label: 'Sil', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) }] : []),
                ...(user && !isAuthor ? [{ label: 'Bildir', icon: Flag, onSelect: () => report('post', post.id, `${post.user?.username ?? 'Bir üyenin'} gönderisi`) }] : []),
              ]}
            />
          )}
        </div>

        {editing ? (
          <div className="mt-1">
            <label htmlFor={`duzenle-${post.id}`} className="sr-only">Gönderiyi düzenle</label>
            <textarea
              id={`duzenle-${post.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false);
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
              }}
              maxLength={MAX_LENGTH}
              rows={3}
              autoFocus
              className="girdi resize-y"
            />
            {error && <p className="mt-1.5 text-sm text-hata" role="alert">{error}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="btn-sade">Vazgeç</button>
              <button type="button" onClick={save} disabled={saving || !draft.trim()} className="btn-ana">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </div>
        ) : (
          <PostText text={post.content} />
        )}

        {footer}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Gönderi silinsin mi?"
          confirmLabel="Sil"
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await api(`/api/posts/${post.id}`, { method: 'DELETE' });
            onDeleted(post.id);
          }}
        >
          Bu gönderi akıştan kalıcı olarak kaldırılacak.
        </ConfirmDialog>
      )}
    </li>
  );
}
