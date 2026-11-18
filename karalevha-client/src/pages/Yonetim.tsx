import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronDown, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fullDate, timeAgo } from '../utils/time';
import { REPORT_REASONS, TARGET_LABEL, type ReportTarget } from '../components/ui/Report';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';
import Tabs from '../components/ui/Tabs';

interface ReportGroup {
  targetType: ReportTarget;
  targetId: number;
  exists: boolean;
  summary: string | null;
  link: string | null;
  authorId: number | null;
  author: string | null;
  count: number;
  reasons: { reason: string; count: number }[];
  reports: { id: number; reporter: string; reason: string; note: string | null; createdAt: string }[];
  lastAt: string;
  status: 'acik' | 'kaldirildi' | 'reddedildi';
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

/** İçeriği kaldıran mevcut uçlar (yönetici yetkisiyle) */
const REMOVE: Record<Exclude<ReportTarget, 'user'>, (id: number) => string> = {
  project: (id) => `/api/projects/${id}`,
  model: (id) => `/api/printmodels/${id}`,
  post: (id) => `/api/posts/${id}`,
  comment: (id) => `/api/yorum/${id}`,
  obamessage: (id) => `/api/obamessages/message/${id}`,
};

const BAN_OPTIONS = [
  { hours: 24, label: '1 gün' },
  { hours: 24 * 7, label: '7 gün' },
  { hours: 24 * 30, label: '30 gün' },
];

type Action = { group: ReportGroup; kind: 'kaldir' | 'yoksay' | 'askiya'; hours?: number };

function GroupCard({ g, onAction }: { g: ReportGroup; onAction?: (a: Action) => void }) {
  const [open, setOpen] = useState(false);
  const [banHours, setBanHours] = useState(BAN_OPTIONS[0].hours);
  const isUser = g.targetType === 'user';

  return (
    <li className="kart p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge>{TARGET_LABEL[g.targetType]}</Badge>
        <span className="veri text-isaret">{g.count} şikâyet</span>
        <span className="text-xs text-tebesir-silik">
          son <time dateTime={g.lastAt} title={fullDate(g.lastAt)}>{timeAgo(g.lastAt)}</time>
        </span>
        {g.status !== 'acik' && (
          <Badge tone={g.status === 'kaldirildi' ? 'hata' : 'notr'}>{g.status === 'kaldirildi' ? 'Kaldırıldı' : 'Yok sayıldı'}</Badge>
        )}
      </div>

      <div className="mt-2">
        {g.exists ? (
          <p className="text-sm text-tebesir">
            {g.summary}
            {g.author && !isUser && (
              <span className="text-tebesir-silik"> · <Link to={`/u/${g.author}`} className="hover:underline">{g.author}</Link></span>
            )}
          </p>
        ) : (
          <p className="text-sm text-tebesir-silik">İçerik artık yok (sahibi ya da bir yönetici kaldırmış).</p>
        )}
        <p className="mt-1 text-xs text-tebesir-silik">{g.reasons.map((r) => `${reasonLabel(r.reason)} (${r.count})`).join(' · ')}</p>
      </div>

      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 inline-flex items-center gap-1 text-xs text-tebesir-soluk hover:text-tebesir">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        Bildirenler ve açıklamalar
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 border-l border-levha-cizgi pl-3">
          {g.reports.map((r) => (
            <li key={r.id} className="text-xs text-tebesir-soluk">
              <span className="text-tebesir">{r.reporter}</span> · {reasonLabel(r.reason)} · {timeAgo(r.createdAt)}
              {r.note && <p className="mt-0.5 text-tebesir-silik whitespace-pre-wrap">{r.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {g.status !== 'acik' && (
        <p className="mt-3 text-xs text-tebesir-silik">
          {g.resolvedBy ?? 'Bir yönetici'} · {g.resolvedAt && timeAgo(g.resolvedAt)}{g.resolutionNote && ` · ${g.resolutionNote}`}
        </p>
      )}

      {onAction && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {g.exists && g.link && (
            <Link to={g.link} className="btn-sade"><ExternalLink className="w-4 h-4" aria-hidden="true" />İçeriğe git</Link>
          )}
          <span className="flex-1" />
          <button type="button" onClick={() => onAction({ group: g, kind: 'yoksay' })} className="btn-ikincil">Yok say</button>
          {!g.exists ? (
            <button type="button" onClick={() => onAction({ group: g, kind: 'kaldir' })} className="btn-ana">Kapat</button>
          ) : isUser ? (
            <span className="inline-flex items-center gap-2">
              <select value={banHours} onChange={(e) => setBanHours(Number(e.target.value))} className="girdi w-auto h-9 py-0" aria-label="Askı süresi">
                {BAN_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
              </select>
              <button type="button" onClick={() => onAction({ group: g, kind: 'askiya', hours: banHours })} className="btn-ana">Askıya al</button>
            </span>
          ) : (
            <button type="button" onClick={() => onAction({ group: g, kind: 'kaldir' })} className="btn-ana">İçeriği kaldır</button>
          )}
        </div>
      )}
    </li>
  );
}

/** /yonetim — kulüp yöneticilerinin şikâyet kutusu */
export default function Yonetim() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<'acik' | 'kapali'>('acik');
  const [groups, setGroups] = useState<ReportGroup[] | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setGroups(null);
    api<ReportGroup[]>(`/api/sikayetler?durum=${tab}`).then(setGroups).catch(() => setGroups([]));
  }, [tab]);
  useEffect(() => {
    if (user?.isAdmin) load();
  }, [load, user?.isAdmin]);

  if (!loading && !user?.isAdmin) return <Navigate to="/" replace />;

  const decide = async (a: Action) => {
    setError('');
    const g = a.group;
    if (a.kind === 'kaldir' && g.exists && g.targetType !== 'user') {
      await api(REMOVE[g.targetType](g.targetId), { method: 'DELETE' });
    }
    if (a.kind === 'askiya') {
      await api('/api/admin/ban-user', { method: 'POST', body: JSON.stringify({ userId: g.targetId, durationHours: a.hours }) });
    }
    await api('/api/sikayetler/karar', {
      method: 'POST',
      body: JSON.stringify({ targetType: g.targetType, targetId: g.targetId, status: a.kind === 'yoksay' ? 'reddedildi' : 'kaldirildi' }),
    });
    setGroups((prev) => (prev ?? []).filter((x) => !(x.targetType === g.targetType && x.targetId === g.targetId)));
    window.dispatchEvent(new Event('sikayetler:degisti'));
  };

  return (
    <div>
      <PageHeader title="Yönetim" description="Üyelerin bildirdiği içerikler. Kaldırınca ya da yok sayınca bildirenlere sonuç haber verilir." />
      <div className="mb-5">
        <Tabs label="Şikâyetler" value={tab} onChange={setTab} options={[{ value: 'acik', label: 'Bekleyenler' }, { value: 'kapali', label: 'Sonuçlananlar' }]} />
      </div>
      {error && <p className="mb-3 text-sm text-hata" role="alert">{error}</p>}

      {groups === null ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : groups.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={tab === 'acik' ? 'Bekleyen şikâyet yok' : 'Henüz sonuçlanan şikâyet yok'} description={tab === 'acik' ? 'Yeni bir bildirim gelince zil haber verir.' : 'Kaldırılan ya da yok sayılan bildirimler burada listelenir.'} />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <GroupCard key={`${g.targetType}-${g.targetId}`} g={g} onAction={tab === 'acik' ? setAction : undefined} />
          ))}
        </ul>
      )}

      {action && (
        <ConfirmDialog
          title={action.kind === 'yoksay' ? 'Şikâyetler yok sayılsın mı?' : action.kind === 'askiya' ? 'Kullanıcı askıya alınsın mı?' : action.group.exists ? 'İçerik kaldırılsın mı?' : 'Şikâyetler kapatılsın mı?'}
          confirmLabel={action.kind === 'yoksay' ? 'Yok say' : action.kind === 'askiya' ? 'Askıya al' : action.group.exists ? 'Kaldır' : 'Kapat'}
          danger={action.kind !== 'yoksay'}
          onClose={() => setAction(null)}
          onConfirm={async () => {
            try {
              await decide(action);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'İşlem yapılamadı.');
            }
          }}
        >
          {action.kind === 'yoksay'
            ? 'İçerik yerinde kalır; bildirenlere kurallara aykırı bulunmadığı haber verilir.'
            : action.kind === 'askiya'
              ? `${action.group.summary} ${BAN_OPTIONS.find((o) => o.hours === action.hours)?.label} boyunca giriş yapamaz ve paylaşım yapamaz.`
              : action.group.exists
                ? `${TARGET_LABEL[action.group.targetType]} kalıcı olarak silinir: "${action.group.summary}"`
                : 'İçerik zaten yok; bildirenlere kaldırıldığı haber verilir.'}
        </ConfirmDialog>
      )}
    </div>
  );
}
