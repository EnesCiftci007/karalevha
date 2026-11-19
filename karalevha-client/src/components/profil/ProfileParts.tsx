import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, ShieldCheck, UserCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { POST_TAGS } from '../../types';
import { fullDate } from '../../utils/time';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Avatar from '../ui/Avatar';
import ConfirmDialog from '../ui/ConfirmDialog';

/** Takip et / Takiptesin. Takiptesin üstüne gelince "Bırak" olur. */
export function FollowButton({ username, following, onChange }: { username: string; following: boolean; onChange: (following: boolean, followerCount: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      const d = await api<{ isFollowing: boolean; followerCount: number }>(`/api/users/${encodeURIComponent(username)}/follow`, { method: following ? 'DELETE' : 'POST' });
      onChange(d.isFollowing, d.followerCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem yapılamadı.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="inline-flex flex-col items-start gap-1">
      {following ? (
        <button type="button" onClick={toggle} disabled={busy} className="btn-ikincil group">
          <UserCheck className="w-4 h-4" aria-hidden="true" />
          <span className="group-hover:hidden">Takiptesin</span>
          <span className="hidden group-hover:inline">Takibi bırak</span>
        </button>
      ) : (
        <button type="button" onClick={toggle} disabled={busy} className="btn-ana">
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          Takip et
        </button>
      )}
      {error && <p role="alert" className="text-xs text-hata">{error}</p>}
    </div>
  );
}

/** Takipçiler ya da takip edilenler */
export function FollowListModal({ username, direction, onClose }: { username: string; direction: 'takipci' | 'takip'; onClose: () => void }) {
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => {
    api<string[]>(`/api/users/${encodeURIComponent(username)}/takip?yon=${direction}`).then(setNames).catch(() => setNames([]));
  }, [username, direction]);

  return (
    <Modal title={direction === 'takipci' ? 'Takipçiler' : 'Takip ettikleri'} onClose={onClose}>
      <ul className="p-2 max-h-[60vh] overflow-y-auto">
        {names === null ? (
          <li className="px-3 py-4 text-sm text-tebesir-silik">Yükleniyor…</li>
        ) : names.length === 0 ? (
          <li className="px-3 py-4 text-sm text-tebesir-silik">{direction === 'takipci' ? 'Henüz takipçisi yok.' : 'Henüz kimseyi takip etmiyor.'}</li>
        ) : (
          names.map((n) => (
            <li key={n}>
              <Link to={`/u/${encodeURIComponent(n)}`} onClick={onClose} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-levha transition-colors">
                <Avatar name={n} size="sm" />
                <span className="text-sm text-tebesir">{n}</span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </Modal>
  );
}

/** Kendi profilini düzenle: tanıtım ve ilgi alanları */
export function EditProfileModal({ bio, interests, onSaved, onClose }: { bio: string | null; interests: string[]; onSaved: (bio: string | null, interests: string[]) => void; onClose: () => void }) {
  const [text, setText] = useState(bio ?? '');
  const [picked, setPicked] = useState<string[]>(interests);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const d = await api<{ bio: string | null; interests: string[] }>('/api/users/me', { method: 'PUT', body: JSON.stringify({ bio: text, interests: picked }) });
      onSaved(d.bio, d.interests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal title="Profili düzenle" onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-5">
        <Field id="profil-bio" label="Tanıtım" note="isteğe bağlı" hint={`${300 - text.length} karakter kaldı`}>
          <textarea id="profil-bio" value={text} maxLength={300} rows={3} onChange={(e) => setText(e.target.value)} className="girdi resize-none" placeholder="Ne üzerinde çalışıyorsun, neyle ilgileniyorsun?" />
        </Field>
        <fieldset>
          <legend className="alan-etiketi">İlgi alanları</legend>
          <p className="text-xs text-tebesir-silik mb-2">Akışta bu etiketlerin son bir haftadaki gönderileri öne çıkar.</p>
          <div className="flex flex-wrap gap-1.5">
            {POST_TAGS.filter((t) => t !== 'Duyuru').map((t) => {
              const on = picked.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== t) : [...p, t]))}
                  className={`h-8 px-3 rounded border text-sm transition-colors ${on ? 'border-isaret text-isaret bg-isaret/10' : 'border-levha-cizgi text-tebesir-soluk hover:border-tebesir-silik'}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-sade">Vazgeç</button>
          <button type="submit" disabled={saving} className="btn-ana">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </form>
    </Modal>
  );
}

const BAN_OPTIONS = [
  { minutes: 60, label: '1 saat' },
  { minutes: 24 * 60, label: '1 gün' },
  { minutes: 7 * 24 * 60, label: '7 gün' },
  { minutes: 30 * 24 * 60, label: '30 gün' },
];

interface AdminPanelProps {
  userId: number;
  username: string;
  role: 'User' | 'Admin' | 'Owner';
  bannedUntil: string | null;
  /** Bakan kişi Owner mı (rol verebilir) */
  viewerIsOwner: boolean;
  onChange: (patch: { role?: 'User' | 'Admin' | 'Owner'; bannedUntil?: string | null }) => void;
}

/** Yöneticilere görünen kutu: askıya al / askıdan çıkar, Owner için yönetici yap. */
export function AdminPanel({ userId, username, role, bannedUntil, viewerIsOwner, onChange }: AdminPanelProps) {
  const [minutes, setMinutes] = useState(BAN_OPTIONS[1].minutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmBan, setConfirmBan] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [password, setPassword] = useState('');
  const { refreshUser } = useAuth();
  const banned = bannedUntil && new Date(bannedUntil) > new Date();

  // Kuruculuğu (Owner) bu kişiye devret: şifre yeniden istenir, devreden aynı işlemde Admin olur
  const transfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/owner-devret', { method: 'POST', body: JSON.stringify({ userId, password }) });
      setTransferring(false);
      onChange({ role: 'Owner' });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Devredilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Olmadı.');
    } finally {
      setBusy(false);
    }
  };

  const banLabel = BAN_OPTIONS.find((o) => o.minutes === minutes)?.label;
  const unban = () =>
    run(async () => {
      await api(`/api/admin/unban-user/${userId}`, { method: 'POST' });
      onChange({ bannedUntil: null });
    });
  const setRole = (next: 'User' | 'Admin') =>
    run(async () => {
      await api('/api/admin/set-role', { method: 'POST', body: JSON.stringify({ userId, role: next }) });
      onChange({ role: next });
    });

  // Owner'a kimse dokunamaz; yönetici başka yöneticiye dokunamaz
  if (role === 'Owner' || (role === 'Admin' && !viewerIsOwner)) return null;

  return (
    <section className="kart p-4 mb-8" aria-label="Yönetim">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-tebesir mb-3">
        <ShieldCheck className="w-4 h-4 text-isaret" aria-hidden="true" /> Yönetim
      </h2>
      {banned ? (
        <div className="space-y-2">
          <p className="text-sm text-hata">{fullDate(bannedUntil!)} tarihine kadar askıda.</p>
          <button type="button" onClick={unban} disabled={busy} className="btn-ikincil w-full">Askıdan çıkar</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <label htmlFor="aski-sure" className="sr-only">Askı süresi</label>
          <select id="aski-sure" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="girdi flex-1">
            {BAN_OPTIONS.map((o) => <option key={o.minutes} value={o.minutes}>{o.label}</option>)}
          </select>
          <button type="button" onClick={() => setConfirmBan(true)} disabled={busy} className="btn-tehlike">Askıya al</button>
        </div>
      )}
      {viewerIsOwner && (
        <button type="button" onClick={() => setRole(role === 'Admin' ? 'User' : 'Admin')} disabled={busy} className="btn-sade w-full mt-3">
          {role === 'Admin' ? 'Yöneticiliği al' : 'Yönetici yap'}
        </button>
      )}
      {viewerIsOwner && !banned && (
        <button type="button" onClick={() => { setPassword(''); setTransferring(true); }} disabled={busy} className="btn-sade w-full mt-1">
          <Crown className="w-4 h-4" aria-hidden="true" />Kuruculuğu devret
        </button>
      )}
      {transferring && (
        <Modal title="Kuruculuğu devret" onClose={() => !busy && setTransferring(false)}>
          <form onSubmit={transfer} className="p-5 space-y-4">
            <p className="text-sm text-tebesir-soluk">
              <span className="font-medium text-tebesir">{username}</span> kulübün kurucusu (Owner) olur; sen yönetici (Admin) olarak kalırsın.
              Kulübün tek bir kurucusu olabilir; geri almak için yeni kurucunun devretmesi gerekir.
            </p>
            <Field id="devir-sifre" label="Şifren">
              <input id="devir-sifre" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="girdi" />
            </Field>
            {error && <p className="text-sm text-hata" role="alert">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setTransferring(false)} disabled={busy} className="btn-ikincil">Vazgeç</button>
              <button type="submit" disabled={busy || !password} className="btn-ana">{busy ? 'Devrediliyor…' : 'Devret'}</button>
            </div>
          </form>
        </Modal>
      )}
      {error && <p className="mt-2 text-sm text-hata" role="alert">{error}</p>}
      {confirmBan && (
        <ConfirmDialog
          title={`${username} ${banLabel} askıya alınsın mı?`}
          confirmLabel="Askıya al"
          onClose={() => setConfirmBan(false)}
          onConfirm={async () => {
            const d = await api<{ bannedUntil: string }>('/api/admin/ban-user', { method: 'POST', body: JSON.stringify({ userId, durationMinutes: minutes }) });
            onChange({ bannedUntil: d.bannedUntil });
          }}
        >
          Bu sürede giriş yapamaz ve paylaşım yapamaz. Süre dolmadan askıdan çıkarabilirsin.
        </ConfirmDialog>
      )}
    </section>
  );
}
