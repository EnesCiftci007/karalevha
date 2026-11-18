import React, { useState } from 'react';
import { api } from '../../services/api';
import { PrintModel } from '../../types';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import Tabs from '../ui/Tabs';

interface ModelEditModalProps {
  model: PrintModel;
  onSaved: (model: PrintModel) => void;
  onClose: () => void;
}

/** Yüklenmiş bir modelin adını, açıklamasını ve kategorisini düzenler. Dosya değiştirilmez. */
export default function ModelEditModal({ model, onSaved, onClose }: ModelEditModalProps) {
  const [title, setTitle] = useState(model.title);
  const [description, setDescription] = useState(model.description ?? '');
  const [category, setCategory] = useState(model.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/printmodels/${model.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category }),
      });
      onSaved({ ...model, title: title.trim(), description: description.trim(), category });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal title="Modeli düzenle" onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <span className="alan-etiketi">Kategori</span>
          <Tabs
            label="Kategori"
            value={category}
            onChange={setCategory}
            options={[{ value: 'baski', label: 'Baskı modeli' }, { value: 'oyun', label: 'Oyun modeli' }]}
          />
        </div>
        <Field id="model-duzenle-ad" label="Model adı">
          <input id="model-duzenle-ad" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required autoFocus className="girdi" />
        </Field>
        <Field id="model-duzenle-aciklama" label="Açıklama" note="isteğe bağlı">
          <textarea id="model-duzenle-aciklama" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className="girdi resize-y" />
        </Field>
        <p className="text-xs text-tebesir-silik">Dosyayı değiştirmek için modeli silip yeniden yükle.</p>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ikincil">Vazgeç</button>
          <button type="submit" disabled={saving || !title.trim()} className="btn-ana">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </form>
    </Modal>
  );
}
