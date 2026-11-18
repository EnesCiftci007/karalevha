import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, CircuitBoard, Cpu, Download, File, Inbox, Package, Printer, Scissors, UploadCloud, X, type LucideIcon } from 'lucide-react';
import { api, apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MarketOrder, MarketService, MarketStatus } from '../types';
import { formatSize } from '../services/files';
import { fullDate, timeAgo } from '../utils/time';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Field from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';

const MAX_UPLOAD = 50 * 1024 * 1024; // Backend sınırıyla aynı

const ICONS: Record<MarketService['id'], LucideIcon> = { cnc: Cpu, lazer: Scissors, baski: Printer, pcb: CircuitBoard };

/** Siparişin ilerlediği adımlar (iptal ayrı gösterilir) */
const STEPS: { id: MarketStatus; label: string }[] = [
  { id: 'alindi', label: 'Alındı' },
  { id: 'fiyatlandi', label: 'Fiyat verildi' },
  { id: 'onaylandi', label: 'Onaylandı' },
  { id: 'uretimde', label: 'Üretimde' },
  { id: 'hazir', label: 'Teslime hazır' },
  { id: 'teslim', label: 'Teslim edildi' },
];
const ALL_STATUSES: { id: MarketStatus; label: string }[] = [...STEPS, { id: 'iptal', label: 'İptal' }];

const money = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

/** Sipariş dosyası herkese açık değil: oturumla indirilir */
async function downloadOrderFile(order: MarketOrder) {
  const res = await apiFetch(`/api/market/siparis/${order.id}/dosya`);
  if (!res.ok) throw new Error('Dosya indirilemedi.');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = order.fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatusBadge({ order }: { order: MarketOrder }) {
  const tone = order.status === 'iptal' ? 'hata' : order.status === 'teslim' ? 'basari' : order.status === 'fiyatlandi' ? 'isaret' : 'notr';
  return <Badge tone={tone}>{ALL_STATUSES.find((s) => s.id === order.status)?.label ?? order.statusLabel}</Badge>;
}

/** Siparişin hangi adımda olduğunu gösteren çizgi */
function Stepper({ status }: { status: MarketStatus }) {
  if (status === 'iptal') return null;
  const at = STEPS.findIndex((s) => s.id === status);
  return (
    <ol className="flex items-center gap-1 mt-3" aria-label="Sipariş durumu">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex-1 min-w-0" title={s.label}>
          <span className={`block h-1 rounded-full ${i <= at ? 'bg-isaret' : 'bg-levha-cizgi'}`} />
          <span className={`hidden md:block mt-1 text-[11px] truncate ${i === at ? 'text-tebesir' : 'text-tebesir-silik'}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function OrderMeta({ order }: { order: MarketOrder }) {
  return (
    <p className="text-xs text-tebesir-silik">
      {order.material} · {order.quantity} adet{order.dimensions ? ` · ${order.dimensions}` : ''} ·{' '}
      <time dateTime={order.createdAt} title={fullDate(order.createdAt)}>{timeAgo(order.createdAt)}</time>
    </p>
  );
}

function FileButton({ order }: { order: MarketOrder }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => { setBusy(true); downloadOrderFile(order).catch(() => {}).finally(() => setBusy(false)); }}
      className="inline-flex items-center gap-1.5 max-w-full text-xs text-tebesir-soluk hover:text-tebesir"
      title="Dosyayı indir"
    >
      <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate font-mono">{order.fileName}</span>
      <span className="veri shrink-0">{formatSize(order.fileSize)}</span>
    </button>
  );
}

/* ---------------- Sipariş formu ---------------- */

function OrderModal({ service, onClose, onCreated }: { service: MarketService; onClose: () => void; onCreated: (o: MarketOrder) => void }) {
  const [material, setMaterial] = useState(service.materials[0]);
  const [quantity, setQuantity] = useState(1);
  const [dimensions, setDimensions] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')).toLowerCase() : '';
    if (!service.extensions.includes(ext)) return setError(`Bu hizmet için ${service.extensions.join(', ')} dosyaları kabul edilir.`);
    if (f.size > MAX_UPLOAD) return setError(`Dosya en fazla ${formatSize(MAX_UPLOAD)} olabilir.`);
    setError('');
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || saving) return;
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('service', service.id);
    form.append('material', material);
    form.append('quantity', String(quantity));
    if (dimensions.trim()) form.append('dimensions', dimensions.trim());
    if (note.trim()) form.append('note', note.trim());
    form.append('file', file);
    try {
      onCreated(await api<MarketOrder>('/api/market/siparis', { method: 'POST', body: form }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sipariş gönderilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal title={`${service.name} siparişi`} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <p className="text-sm text-tebesir-soluk">{service.hint}</p>
        <input ref={inputRef} type="file" accept={service.extensions.join(',')} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        {file ? (
          <div className="flex items-center gap-3 rounded-md border border-levha-cizgi bg-levha-koyu px-3 py-2.5">
            <File className="w-5 h-5 shrink-0 text-tebesir-silik" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-tebesir truncate">{file.name}</span>
              <span className="block veri">{formatSize(file.size)}</span>
            </span>
            <button type="button" onClick={() => setFile(null)} className="p-1 text-tebesir-silik hover:text-tebesir" aria-label="Dosyayı kaldır"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0]); }}
            className={`w-full rounded-md border border-dashed px-4 py-7 text-center transition-colors ${dragOver ? 'border-isaret bg-isaret/5' : 'border-levha-cizgi hover:border-tebesir-silik'}`}
          >
            <UploadCloud className="w-6 h-6 mx-auto mb-2 text-tebesir-silik" strokeWidth={1.5} aria-hidden="true" />
            <span className="block text-sm font-medium text-tebesir">Üretim dosyasını sürükle ya da seç</span>
            <span className="block mt-1 text-xs text-tebesir-silik font-mono">{service.extensions.join(' ')} · en fazla {formatSize(MAX_UPLOAD)}</span>
          </button>
        )}
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field id="m-malzeme" label="Malzeme">
            <select id="m-malzeme" value={material} onChange={(e) => setMaterial(e.target.value)} className="girdi">
              {service.materials.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field id="m-adet" label="Adet">
            <input id="m-adet" type="number" min={1} max={100} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="girdi veri" />
          </Field>
        </div>
        <Field id="m-olcu" label="Ölçüler" note="isteğe bağlı">
          <input id="m-olcu" value={dimensions} onChange={(e) => setDimensions(e.target.value)} maxLength={100} placeholder="Ör. 120 x 80 x 3 mm" className="girdi" />
        </Field>
        <Field id="m-not" label="Not" note="isteğe bağlı">
          <textarea id="m-not" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="Renk, doluluk, teslim tarihi…" className="girdi resize-y" />
        </Field>
        <p className="text-xs text-tebesir-silik">Ödeme alınmaz: atölye ekibi siparişe fiyat verir, sen onaylarsan üretime alınır.</p>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ikincil">Vazgeç</button>
          <button type="submit" disabled={saving || !file} className="btn-ana">{saving ? 'Gönderiliyor…' : 'Sipariş ver'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Yönetici: sipariş düzenleme ---------------- */

function StaffRow({ order, onSaved }: { order: MarketOrder; onSaved: (o: MarketOrder) => void }) {
  const [status, setStatus] = useState<MarketStatus>(order.status);
  const [price, setPrice] = useState(order.price != null ? String(order.price) : '');
  const [staffNote, setStaffNote] = useState(order.staffNote ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = status !== order.status || price !== (order.price != null ? String(order.price) : '') || staffNote !== (order.staffNote ?? '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { status, price: price.trim() ? Number(price.replace(',', '.')) : null, staffNote: staffNote.trim() || null };
      onSaved(await api<MarketOrder>(`/api/market/siparis/${order.id}`, { method: 'PUT', body: JSON.stringify(body) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="kart p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="veri">#{order.id}</span>
        <span className="font-semibold text-tebesir">{order.serviceName}</span>
        <StatusBadge order={order} />
        <span className="ml-auto text-xs text-tebesir-silik">
          <Link to={`/u/${order.username}`} className="text-tebesir-soluk hover:underline">{order.username}</Link>
        </span>
      </div>
      <OrderMeta order={order} />
      {order.note && <p className="mt-2 text-sm text-tebesir-soluk whitespace-pre-wrap">{order.note}</p>}
      <div className="mt-2"><FileButton order={order} /></div>
      <form onSubmit={save} className="mt-3 grid gap-2 sm:grid-cols-[10rem_8rem_1fr_auto] items-start">
        <select value={status} onChange={(e) => setStatus(e.target.value as MarketStatus)} className="girdi" aria-label="Durum">
          {ALL_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Fiyat (₺)" className="girdi veri" aria-label="Fiyat" />
        <input value={staffNote} onChange={(e) => setStaffNote(e.target.value)} maxLength={500} placeholder="Müşteriye not" className="girdi" aria-label="Müşteriye not" />
        <button type="submit" disabled={!dirty || saving} className="btn-ana">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </form>
      {error && <p className="mt-2 text-sm text-hata" role="alert">{error}</p>}
    </li>
  );
}

/* ---------------- Sayfa ---------------- */

type Tab = 'hizmetler' | 'siparislerim' | 'gelen';

export default function Market() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [services, setServices] = useState<MarketService[] | null>(null);
  const [mine, setMine] = useState<MarketOrder[] | null>(null);
  const [incoming, setIncoming] = useState<MarketOrder[] | null>(null);
  const [filter, setFilter] = useState<'acik' | MarketStatus | ''>('acik');
  const [ordering, setOrdering] = useState<MarketService | null>(null);
  const [cancelling, setCancelling] = useState<MarketOrder | null>(null);
  const [actionError, setActionError] = useState('');

  const askedTab = params.get('sekme') as Tab | null;
  const tab: Tab = askedTab === 'siparislerim' && user ? 'siparislerim' : askedTab === 'gelen' && user?.isAdmin ? 'gelen' : 'hizmetler';
  const setTab = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); n.set('sekme', t); n.delete('hizmet'); return n; }, { replace: true });

  useEffect(() => {
    api<MarketService[]>('/api/market/hizmetler').then(setServices).catch(() => setServices([]));
  }, []);

  const loadMine = useCallback(() => {
    if (user) api<MarketOrder[]>('/api/market/siparislerim').then(setMine).catch(() => setMine([]));
  }, [user]);
  useEffect(loadMine, [loadMine]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    api<MarketOrder[]>('/api/market/siparisler').then(setIncoming).catch(() => setIncoming([]));
  }, [user?.isAdmin]);

  // ?hizmet=baski: projedeki "Bastır" bağlantısı formu açık getirir
  useEffect(() => {
    const id = params.get('hizmet');
    if (!id || !services || !user) return;
    const s = services.find((x) => x.id === id);
    if (s) setOrdering(s);
    setParams((p) => { const n = new URLSearchParams(p); n.delete('hizmet'); return n; }, { replace: true });
  }, [params, services, user, setParams]);

  const replaceMine = (o: MarketOrder) => setMine((prev) => (prev ?? []).map((x) => (x.id === o.id ? o : x)));
  const approve = async (o: MarketOrder) => {
    setActionError('');
    try {
      replaceMine(await api<MarketOrder>(`/api/market/siparis/${o.id}/onay`, { method: 'POST' }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Onaylanamadı.');
    }
  };

  const openCount = (mine ?? []).filter((o) => o.status !== 'teslim' && o.status !== 'iptal').length;
  const pendingCount = (incoming ?? []).filter((o) => o.status === 'alindi' || o.status === 'onaylandi').length;
  const shownIncoming = (incoming ?? []).filter((o) => (filter === 'acik' ? o.status !== 'teslim' && o.status !== 'iptal' : !filter || o.status === filter));

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'hizmetler', label: 'Hizmetler' },
    ...(user ? [{ id: 'siparislerim' as Tab, label: 'Siparişlerim', count: openCount }] : []),
    ...(user?.isAdmin ? [{ id: 'gelen' as Tab, label: 'Gelen siparişler', count: pendingCount }] : []),
  ];

  return (
    <div>
      <PageHeader title="Market" description="Atölyeden CNC, lazer kesim, 3B baskı ve devre kartı siparişi ver. Ekip fiyat verir, onaylarsan üretilir." />

      <div className="flex items-center gap-1 mb-6 border-b border-levha-cizgi" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-isaret text-tebesir' : 'border-transparent text-tebesir-silik hover:text-tebesir'}`}
          >
            {t.label}
            {!!t.count && <span className="veri text-isaret">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'hizmetler' && (
        services === null ? (
          <div className="grid sm:grid-cols-2 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}</div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-4">
            {services.map((s) => {
              const Icon = ICONS[s.id] ?? Package;
              return (
                <li key={s.id} className="kart p-5 flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="grid place-items-center w-9 h-9 rounded-md border border-levha-cizgi text-isaret"><Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" /></span>
                    <h2 className="font-display font-semibold text-base text-tebesir">{s.name}</h2>
                  </div>
                  <p className="mt-3 text-sm text-tebesir-soluk">{s.description}</p>
                  <p className="mt-3 text-xs text-tebesir-silik"><span className="etiket mr-1">Malzeme</span>{s.materials.join(', ')}</p>
                  <p className="mt-1 text-xs text-tebesir-silik font-mono">{s.extensions.join(' ')}</p>
                  <div className="mt-auto pt-4">
                    {user ? (
                      <button type="button" onClick={() => setOrdering(s)} className="btn-ikincil">Sipariş ver</button>
                    ) : (
                      <Link to="/auth" state={{ from: `/market?hizmet=${s.id}` }} className="btn-ikincil">Sipariş için giriş yap</Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === 'siparislerim' && (
        mine === null ? (
          <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : mine.length === 0 ? (
          <EmptyState icon={Inbox} title="Henüz siparişin yok" description="Hizmetler sekmesinden dosyanı yükleyip sipariş verebilirsin." action={<button type="button" onClick={() => setTab('hizmetler')} className="btn-ikincil">Hizmetlere bak</button>} />
        ) : (
          <>
            {actionError && <p className="mb-3 text-sm text-hata" role="alert">{actionError}</p>}
            <ul className="space-y-3">
              {mine.map((o) => (
                <li key={o.id} className="kart p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="veri">#{o.id}</span>
                    <span className="font-semibold text-tebesir">{o.serviceName}</span>
                    <StatusBadge order={o} />
                    {o.price != null && <span className="ml-auto veri text-base text-tebesir">{money(o.price)}</span>}
                  </div>
                  <OrderMeta order={o} />
                  <Stepper status={o.status} />
                  {o.staffNote && <p className="mt-3 text-sm text-tebesir-soluk"><span className="etiket mr-1">Atölye</span>{o.staffNote}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1"><FileButton order={o} /></span>
                    {o.status === 'fiyatlandi' && (
                      <button type="button" onClick={() => approve(o)} className="btn-ana"><Check className="w-4 h-4" aria-hidden="true" />Fiyatı onayla</button>
                    )}
                    {(o.status === 'alindi' || o.status === 'fiyatlandi' || o.status === 'onaylandi') && (
                      <button type="button" onClick={() => setCancelling(o)} className="btn-sade">İptal et</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      )}

      {tab === 'gelen' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <label htmlFor="m-filtre" className="etiket">Durum</label>
            <select id="m-filtre" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="girdi w-auto">
              <option value="acik">Açık olanlar</option>
              <option value="">Hepsi</option>
              {ALL_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          {incoming === null ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : shownIncoming.length === 0 ? (
            <EmptyState icon={Inbox} title="Bu durumda sipariş yok" description="Yeni sipariş gelince bildirim alırsın." />
          ) : (
            <ul className="space-y-3">
              {shownIncoming.map((o) => (
                <StaffRow key={`${o.id}-${o.updatedAt}`} order={o} onSaved={(n) => setIncoming((prev) => (prev ?? []).map((x) => (x.id === n.id ? n : x)))} />
              ))}
            </ul>
          )}
        </>
      )}

      {ordering && (
        <OrderModal
          service={ordering}
          onClose={() => setOrdering(null)}
          onCreated={(o) => {
            setMine((prev) => [o, ...(prev ?? [])]);
            setTab('siparislerim');
          }}
        />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Sipariş iptal edilsin mi?"
          confirmLabel="İptal et"
          onClose={() => setCancelling(null)}
          onConfirm={async () => replaceMine(await api<MarketOrder>(`/api/market/siparis/${cancelling.id}/iptal`, { method: 'POST' }))}
        >
          <span className="font-medium text-tebesir">#{cancelling.id} {cancelling.serviceName}</span> siparişi iptal edilecek.
        </ConfirmDialog>
      )}
    </div>
  );
}
