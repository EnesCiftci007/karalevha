import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Flame, Pencil, Plus, Printer, Scissors, Trash2, Wrench, type LucideIcon } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Equipment, PrintModel, Reservation } from '../types';
import { addDays, clock, combine, dateInput, shortDay, startOfWeek } from '../utils/time';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Field from '../components/ui/Field';
import ItemMenu from '../components/ui/ItemMenu';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';

const KINDS: Record<Equipment['kind'], { label: string; icon: LucideIcon }> = {
  yazici: { label: '3B yazıcı', icon: Printer },
  lehim: { label: 'Lehim istasyonu', icon: Flame },
  lazer: { label: 'Lazer kesici', icon: Scissors },
  diger: { label: 'Diğer', icon: Wrench },
};

const FIRST_HOUR = 8;
const LAST_HOUR = 23; // takvim 08:00–23:00
const HOUR_PX = 40;
const TIMES = Array.from({ length: (LAST_HOUR - FIRST_HOUR) * 2 + 1 }, (_, i) => {
  const minutes = FIRST_HOUR * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

function statusOf(e: Equipment) {
  if (e.status === 'bakimda') return <Badge tone="hata">Bakımda</Badge>;
  if (e.inUse) return <Badge tone="isaret">Kullanımda</Badge>;
  return <Badge tone="basari">Boş</Badge>;
}

/* ------------------------------------------------------------------ Ekipman formu (yönetici) */

function EquipmentForm({ item, onSaved, onClose }: { item?: Equipment; onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState<Equipment['kind']>(item?.kind ?? 'yazici');
  const [description, setDescription] = useState(item?.description ?? '');
  const [status, setStatus] = useState<Equipment['status']>(item?.status ?? 'hazir');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await api(item ? `/api/atolye/ekipman/${item.id}` : '/api/atolye/ekipman', {
        method: item ? 'PUT' : 'POST',
        body: JSON.stringify({ name: name.trim(), kind, description: description.trim(), status }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? 'Ekipmanı düzenle' : 'Ekipman ekle'} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <Field id="ekipman-ad" label="Ad">
          <input id="ekipman-ad" className="girdi" required maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ender 3 V2 (sol)" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="ekipman-tur" label="Tür">
            <select id="ekipman-tur" className="girdi" value={kind} onChange={(e) => setKind(e.target.value as Equipment['kind'])}>
              {Object.entries(KINDS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field id="ekipman-durum" label="Durum">
            <select id="ekipman-durum" className="girdi" value={status} onChange={(e) => setStatus(e.target.value as Equipment['status'])}>
              <option value="hazir">Kullanılabilir</option>
              <option value="bakimda">Bakımda</option>
            </select>
          </Field>
        </div>
        <Field id="ekipman-aciklama" label="Not" note="isteğe bağlı" hint="Nozul, tabla boyutu, kullanım kuralı…">
          <textarea id="ekipman-aciklama" className="girdi resize-y" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ikincil">Vazgeç</button>
          <button type="submit" disabled={saving || !name.trim()} className="btn-ana">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Rezervasyon formu */

interface ReserveDraft {
  equipmentId: number;
  date: string;
  start: string;
  end: string;
}

function ReserveForm({
  equipment,
  models,
  draft,
  initialModelId,
  onSaved,
  onClose,
}: {
  equipment: Equipment[];
  models: PrintModel[];
  draft: ReserveDraft;
  initialModelId: number | null;
  onSaved: (r: Reservation) => void;
  onClose: () => void;
}) {
  const [equipmentId, setEquipmentId] = useState(draft.equipmentId);
  const [date, setDate] = useState(draft.date);
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end);
  const [note, setNote] = useState('');
  const [modelId, setModelId] = useState<string>(initialModelId ? String(initialModelId) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = equipment.find((e) => e.id === equipmentId);
  const usable = equipment.filter((e) => e.status === 'hazir');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const startsAt = combine(date, start);
    const endsAt = combine(date, end);
    if (endsAt <= startsAt) {
      setError('Bitiş saati başlangıçtan sonra olmalı.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api<Reservation>('/api/atolye/rezervasyon', {
        method: 'POST',
        body: JSON.stringify({
          equipmentId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          note: note.trim(),
          printModelId: modelId ? Number(modelId) : null,
        }),
      });
      onSaved(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rezervasyon yapılamadı.');
      setSaving(false);
    }
  };

  return (
    <Modal title="Rezervasyon yap" onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <Field id="rez-ekipman" label="Ekipman">
          <select id="rez-ekipman" className="girdi" value={equipmentId} onChange={(e) => setEquipmentId(Number(e.target.value))}>
            {usable.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field id="rez-tarih" label="Gün">
            <input id="rez-tarih" type="date" className="girdi" required value={date} min={dateInput(new Date())} max={dateInput(addDays(new Date(), 30))} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="rez-baslangic" label="Başlangıç">
            <select
              id="rez-baslangic"
              className="girdi"
              value={start}
              onChange={(e) => {
                const nextStart = e.target.value;
                setStart(nextStart);
                if (end <= nextStart) {
                  const nextEnd = TIMES.find((t) => t > nextStart);
                  if (nextEnd) setEnd(nextEnd);
                }
              }}
            >
              {TIMES.slice(0, -1).map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field id="rez-bitis" label="Bitiş">
            <select id="rez-bitis" className="girdi" value={end} onChange={(e) => setEnd(e.target.value)}>
              {TIMES.filter((t) => t > start).map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        {selected?.kind === 'yazici' && (
          <Field id="rez-model" label="Basılacak model" note="isteğe bağlı">
            <select id="rez-model" className="girdi" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              <option value="">Seçilmedi</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </Field>
        )}
        <Field id="rez-not" label="Not" note="isteğe bağlı">
          <input id="rez-not" className="girdi" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="PLA, %20 dolgu, ~3 saat" />
        </Field>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ikincil">Vazgeç</button>
          <button type="submit" disabled={saving} className="btn-ana">{saving ? 'Kaydediliyor…' : 'Rezerve et'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Sayfa */

export default function Atolye() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [mine, setMine] = useState<Reservation[]>([]);
  const [models, setModels] = useState<PrintModel[]>([]);

  const [draft, setDraft] = useState<ReserveDraft | null>(null);
  const [equipmentForm, setEquipmentForm] = useState<{ item?: Equipment } | null>(null);
  const [toDeleteEquipment, setToDeleteEquipment] = useState<Equipment | null>(null);
  const [toCancel, setToCancel] = useState<Reservation | null>(null);

  // 3B Modeller'deki "Bunu basmak istiyorum" bağlantısı ?model=ID ile gelir
  const requestedModel = params.get('model') ? Number(params.get('model')) : null;

  const loadEquipment = useCallback(() => {
    api<Equipment[]>('/api/atolye/ekipman')
      .then((list) => {
        setEquipment(list);
        setSelectedId((current) => current ?? list.find((e) => e.kind === 'yazici')?.id ?? list[0]?.id ?? null);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Ekipmanlar yüklenemedi.');
        setEquipment([]);
      });
  }, []);

  const loadWeek = useCallback(() => {
    if (selectedId == null) return;
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    api<Reservation[]>(`/api/atolye/rezervasyon?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&equipmentId=${selectedId}`)
      .then(setReservations)
      .catch(() => setReservations([]));
  }, [selectedId, weekStart]);

  const loadMine = useCallback(() => {
    if (!user) return setMine([]);
    api<Reservation[]>('/api/atolye/rezervasyon/benim').then(setMine).catch(() => setMine([]));
  }, [user]);

  useEffect(loadEquipment, [loadEquipment]);
  useEffect(loadWeek, [loadWeek]);
  useEffect(loadMine, [loadMine]);
  useEffect(() => {
    api<PrintModel[]>('/api/printmodels?category=baski&take=100').then(setModels).catch(() => {});
  }, []);

  // Model bağlantısıyla gelindiyse ilk boş yazıcı için formu aç
  useEffect(() => {
    if (!requestedModel || !user || !equipment || draft) return;
    const printer = equipment.find((e) => e.kind === 'yazici' && e.status === 'hazir');
    if (!printer) return;
    const next = new Date();
    next.setMinutes(next.getMinutes() < 30 ? 30 : 60, 0, 0);
    const hh = Math.min(Math.max(next.getHours(), FIRST_HOUR), LAST_HOUR - 2);
    const time = `${String(hh).padStart(2, '0')}:${next.getHours() === hh ? String(next.getMinutes()).padStart(2, '0') : '00'}`;
    setDraft({ equipmentId: printer.id, date: dateInput(next), start: time, end: TIMES[TIMES.indexOf(time) + 4] ?? TIMES[TIMES.length - 1] });
  }, [requestedModel, user, equipment, draft]);

  const selected = equipment?.find((e) => e.id === selectedId) ?? null;
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = dateInput(new Date());

  const openSlot = (day: Date, hour: number) => {
    if (!selected) return;
    if (!user) return;
    const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
    if (slot.getTime() + 60 * 60 * 1000 < Date.now()) return; // geçmiş saat
    const start = `${String(hour).padStart(2, '0')}:00`;
    setDraft({ equipmentId: selected.id, date: dateInput(day), start, end: TIMES[TIMES.indexOf(start) + 2] ?? TIMES[TIMES.length - 1] });
  };

  return (
    <div>
      <PageHeader
        title="Atölye"
        description="Yazıcı, lehim istasyonu ve diğer ekipmanların takvimi. Boş bir saate tıklayarak yerini ayır."
        action={
          user?.isAdmin ? (
            <button type="button" className="btn-ikincil" onClick={() => setEquipmentForm({})}>
              <Plus className="w-4 h-4" />
              Ekipman ekle
            </button>
          ) : !user ? (
            <Link to="/auth" state={{ from: '/atolye' }} className="btn-ikincil">Rezervasyon için giriş yap</Link>
          ) : undefined
        }
      />

      {loadError && (
        <p role="alert" className="mb-4 text-sm text-hata">{loadError}</p>
      )}
      {equipment === null ? (
        <div className="grid sm:grid-cols-3 gap-3 mb-8">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : equipment.length === 0 ? (
        <EmptyState
          icon={Printer}
          title="Henüz ekipman eklenmemiş"
          description={user?.isAdmin ? 'Kulübün yazıcılarını ve istasyonlarını ekle; üyeler takvimden yer ayırsın.' : 'Kulüp yöneticisi ekipmanları eklediğinde burada görünecek.'}
          action={user?.isAdmin && <button className="btn-ikincil" onClick={() => setEquipmentForm({})}>İlk ekipmanı ekle</button>}
        />
      ) : (
        <>
          {/* Ekipmanlar */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8" aria-label="Ekipmanlar">
            {equipment.map((e) => {
              const { label, icon: Icon } = KINDS[e.kind] ?? KINDS.diger;
              const active = e.id === selectedId;
              return (
                <li key={e.id} className={`kart relative transition-colors ${active ? 'border-isaret' : 'hover:border-tebesir-silik'}`}>
                  <button type="button" onClick={() => setSelectedId(e.id)} aria-pressed={active} className="w-full text-left p-4 pr-10">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-tebesir-silik" aria-hidden="true" />
                      <span className="text-xs text-tebesir-silik">{label}</span>
                    </div>
                    <p className="text-base font-semibold text-tebesir truncate">{e.name}</p>
                    <div className="mt-2">{statusOf(e)}</div>
                  </button>
                  {user?.isAdmin && (
                    <div className="absolute top-3 right-3">
                      <ItemMenu
                        label={`${e.name} seçenekleri`}
                        actions={[
                          { label: 'Düzenle', icon: Pencil, onSelect: () => setEquipmentForm({ item: e }) },
                          { label: 'Sil', icon: Trash2, danger: true, onSelect: () => setToDeleteEquipment(e) },
                        ]}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Takvim */}
          {selected && (
            <section aria-label={`${selected.name} takvimi`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-display font-semibold text-lg text-tebesir">{selected.name}</h2>
                  {selected.description && <p className="text-sm text-tebesir-soluk">{selected.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="btn-sade px-2" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Önceki hafta">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button type="button" className="btn-ikincil" onClick={() => setWeekStart(startOfWeek(new Date()))}>Bu hafta</button>
                  <button type="button" className="btn-sade px-2" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Sonraki hafta">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {selected.status === 'bakimda' && (
                <p className="mb-4 rounded-md border border-hata/40 bg-hata/10 px-3 py-2 text-sm text-hata">Bu ekipman bakımda; şu an rezervasyon alınmıyor.</p>
              )}

              <div className="kart overflow-x-auto">
                <div className="grid min-w-[760px]" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
                  {/* Başlık satırı */}
                  <div className="border-b border-levha-cizgi" />
                  {days.map((d) => (
                    <div key={d.toISOString()} className={`px-2 py-2 border-b border-l border-levha-cizgi text-sm ${dateInput(d) === today ? 'text-isaret font-semibold' : 'text-tebesir-soluk'}`}>
                      {shortDay(d)}
                    </div>
                  ))}

                  {/* Saat sütunu */}
                  <div className="relative" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
                    {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                      <span key={i} className="absolute right-2 veri" style={{ top: i * HOUR_PX - 6 }}>{i === 0 ? '' : `${FIRST_HOUR + i}:00`}</span>
                    ))}
                  </div>

                  {/* Günler */}
                  {days.map((day) => {
                    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), FIRST_HOUR).getTime();
                    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), LAST_HOUR).getTime();
                    const items = reservations.filter((r) => new Date(r.endsAt).getTime() > dayStart && new Date(r.startsAt).getTime() < dayEnd);
                    return (
                      <div key={day.toISOString()} className="relative border-l border-levha-cizgi" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
                        {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => {
                          const hour = FIRST_HOUR + i;
                          const past = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour + 1).getTime() < Date.now();
                          const clickable = !!user && !past && selected.status === 'hazir';
                          return (
                            <button
                              key={hour}
                              type="button"
                              disabled={!clickable}
                              onClick={() => openSlot(day, hour)}
                              aria-label={`${shortDay(day)} ${hour}:00 rezerve et`}
                              className={`absolute inset-x-0 border-t border-levha-cizgi/60 ${past ? 'bg-levha-koyu/60' : ''} ${clickable ? 'hover:bg-levha-yuzey cursor-pointer' : 'cursor-default'}`}
                              style={{ top: i * HOUR_PX, height: HOUR_PX }}
                            />
                          );
                        })}
                        {items.map((r) => {
                          const s = Math.max(new Date(r.startsAt).getTime(), dayStart);
                          const e = Math.min(new Date(r.endsAt).getTime(), dayEnd);
                          const top = ((s - dayStart) / 3_600_000) * HOUR_PX;
                          const height = Math.max(((e - s) / 3_600_000) * HOUR_PX - 2, 18);
                          const isMine = r.userId === user?.id;
                          return (
                            <div
                              key={r.id}
                              className={`absolute inset-x-1 rounded-md px-1.5 py-1 overflow-hidden text-xs border ${
                                isMine ? 'bg-isaret/15 border-isaret/60 text-tebesir' : 'bg-levha-yuzey border-levha-cizgi text-tebesir-soluk'
                              }`}
                              style={{ top: top + 1, height }}
                              title={`${r.username} · ${clock(r.startsAt)}–${clock(r.endsAt)}${r.printModelTitle ? ` · ${r.printModelTitle}` : ''}${r.note ? ` · ${r.note}` : ''}`}
                            >
                              <p className="font-medium truncate">{isMine ? 'Sen' : r.username}</p>
                              <p className="veri truncate">{clock(r.startsAt)}–{clock(r.endsAt)}</p>
                              {height > 52 && (r.printModelTitle || r.note) && <p className="truncate">{r.printModelTitle ?? r.note}</p>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              {user && selected.status === 'hazir' && (
                <p className="mt-2 text-xs text-tebesir-silik">Boş bir saate tıkla; süreyi formda değiştirebilirsin. En fazla 12 saat, 30 gün ileriye.</p>
              )}
            </section>
          )}

          {/* Rezervasyonlarım */}
          {user && (
            <section className="mt-12">
              <h2 className="font-display font-semibold text-lg text-tebesir mb-4">Rezervasyonlarım</h2>
              {mine.length === 0 ? (
                <p className="text-sm text-tebesir-silik">Yaklaşan rezervasyonun yok.</p>
              ) : (
                <ul className="kart divide-y divide-levha-cizgi">
                  {mine.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                      <span className="text-sm font-medium text-tebesir">{r.equipmentName}</span>
                      <span className="text-sm text-tebesir-soluk">{shortDay(new Date(r.startsAt))} · <span className="veri">{clock(r.startsAt)}–{clock(r.endsAt)}</span></span>
                      {r.printModelTitle && <span className="text-sm text-tebesir-silik truncate">{r.printModelTitle}</span>}
                      <button type="button" className="btn-sade ml-auto h-8" onClick={() => setToCancel(r)}>İptal et</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {draft && equipment && (
        <ReserveForm
          equipment={equipment}
          models={models}
          draft={draft}
          initialModelId={requestedModel}
          onClose={() => {
            setDraft(null);
            if (requestedModel) setParams({}, { replace: true });
          }}
          onSaved={(r) => {
            if (r.equipmentId !== selectedId) setSelectedId(r.equipmentId);
            else loadWeek();
            loadMine();
            loadEquipment();
          }}
        />
      )}
      {equipmentForm && <EquipmentForm item={equipmentForm.item} onSaved={loadEquipment} onClose={() => setEquipmentForm(null)} />}
      {toDeleteEquipment && (
        <ConfirmDialog
          title="Ekipman silinsin mi?"
          confirmLabel="Sil"
          onClose={() => setToDeleteEquipment(null)}
          onConfirm={async () => {
            await api(`/api/atolye/ekipman/${toDeleteEquipment.id}`, { method: 'DELETE' });
            if (selectedId === toDeleteEquipment.id) setSelectedId(null);
            loadEquipment();
          }}
        >
          <span className="font-medium text-tebesir">{toDeleteEquipment.name}</span> ve bütün rezervasyonları silinecek. Geçici olarak kullanılamıyorsa silmek yerine "Bakımda" yapabilirsin.
        </ConfirmDialog>
      )}
      {toCancel && (
        <ConfirmDialog
          title="Rezervasyon iptal edilsin mi?"
          confirmLabel="İptal et"
          onClose={() => setToCancel(null)}
          onConfirm={async () => {
            await api(`/api/atolye/rezervasyon/${toCancel.id}`, { method: 'DELETE' });
            loadMine();
            loadWeek();
            loadEquipment();
          }}
        >
          {toCancel.equipmentName}, {shortDay(new Date(toCancel.startsAt))} {clock(toCancel.startsAt)}–{clock(toCancel.endsAt)} başkalarına açılacak.
        </ConfirmDialog>
      )}
    </div>
  );
}

