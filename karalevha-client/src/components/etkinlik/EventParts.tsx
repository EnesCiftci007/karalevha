import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, MapPin, Users } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ClubEvent } from '../../types';
import { clock, combine, dateInput } from '../../utils/time';
import Field from '../ui/Field';
import Modal from '../ui/Modal';

/** Takvim yaprağı gibi tarih kutusu: "17 / KAS" */
export function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="w-14 shrink-0 rounded-md border border-levha-cizgi bg-levha-koyu text-center py-1.5" aria-hidden="true">
      <p className="text-xs text-tebesir-silik">{d.toLocaleDateString('tr-TR', { month: 'short' })}</p>
      <p className="font-display font-bold text-lg text-tebesir leading-tight">{d.getDate()}</p>
      <p className="text-xs text-tebesir-silik">{d.toLocaleDateString('tr-TR', { weekday: 'short' })}</p>
    </div>
  );
}

export function eventTime(e: ClubEvent): string {
  return e.endsAt ? `${clock(e.startsAt)}–${clock(e.endsAt)}` : clock(e.startsAt);
}

/** Katılıyorum / Katılmıyorum düğmesi */
export function AttendButton({ event, onChange }: { event: ClubEvent; onChange: (e: ClubEvent) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ended = new Date(event.endsAt ?? event.startsAt).getTime() < Date.now();

  if (!user) {
    return <Link to="/auth" state={{ from: `/etkinlikler/${event.id}` }} className="btn-ikincil">Katılmak için giriş yap</Link>;
  }
  if (ended) return <span className="text-sm text-tebesir-silik">Bu etkinlik bitti</span>;

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      onChange(await api<ClubEvent>(`/api/etkinlik/${event.id}/katil`, { method: 'POST' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Olmadı, tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={event.attending} className={event.attending ? 'btn-ikincil' : 'btn-ana'}>
        {event.attending && <Check className="w-4 h-4" aria-hidden="true" />}
        {event.attending ? 'Katılıyorsun' : 'Katılıyorum'}
      </button>
      {error && <span className="text-xs text-hata" role="alert">{error}</span>}
    </span>
  );
}

export function EventMeta({ event }: { event: ClubEvent }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tebesir-soluk">
      <span className="veri text-sm">{eventTime(event)}</span>
      {event.location && (
        <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden="true" />{event.location}</span>
      )}
      <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" aria-hidden="true" />{event.attendeeCount} katılımcı</span>
    </p>
  );
}

/** Etkinlik açma ve düzenleme formu */
export function EventFormModal({ event, onSaved, onClose }: { event?: ClubEvent; onSaved: (e: ClubEvent) => void; onClose: () => void }) {
  const initialStart = event ? new Date(event.startsAt) : (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0); return d; })();
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [date, setDate] = useState(dateInput(initialStart));
  const [start, setStart] = useState(clock(initialStart));
  const [end, setEnd] = useState(event?.endsAt ? clock(event.endsAt) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    const startsAt = combine(date, start);
    const endsAt = end ? combine(date, end) : null;
    if (endsAt && endsAt <= startsAt) {
      setError('Bitiş saati başlangıçtan sonra olmalı.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await api<ClubEvent>(event ? `/api/etkinlik/${event.id}` : '/api/etkinlik', {
        method: event ? 'PUT' : 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt?.toISOString() ?? null,
        }),
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal title={event ? 'Etkinliği düzenle' : 'Etkinlik aç'} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <Field id="etk-baslik" label="Başlık">
          <input id="etk-baslik" className="girdi" required maxLength={150} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lehimlemeye giriş atölyesi" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field id="etk-gun" label="Gün">
            <input id="etk-gun" type="date" className="girdi" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="etk-baslangic" label="Başlangıç">
            <input id="etk-baslangic" type="time" className="girdi" required value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field id="etk-bitis" label="Bitiş" note="isteğe bağlı">
            <input id="etk-bitis" type="time" className="girdi" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field id="etk-yer" label="Yer" note="isteğe bağlı">
          <input id="etk-yer" className="girdi" maxLength={150} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kulüp odası, B-204" />
        </Field>
        <Field id="etk-aciklama" label="Açıklama" note="isteğe bağlı" hint="Ne yapılacak, ne getirmek gerekiyor?">
          <textarea id="etk-aciklama" className="girdi resize-y" rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {event && <p className="text-xs text-tebesir-silik">Saati değiştirirsen katılımcılara bildirim gider.</p>}
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ikincil">Vazgeç</button>
          <button type="submit" disabled={saving || !title.trim()} className="btn-ana">{saving ? 'Kaydediliyor…' : event ? 'Kaydet' : 'Etkinliği aç'}</button>
        </div>
      </form>
    </Modal>
  );
}
