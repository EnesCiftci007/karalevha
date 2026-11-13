import React, { useState } from 'react';
import { api } from '../../services/api';
import { Project } from '../../types';
import Field from '../ui/Field';
import Modal from '../ui/Modal';

interface ProjectFormModalProps {
  /** Verilirse düzenleme, verilmezse yeni proje */
  project?: Project;
  onSaved: (project: Project) => void;
  onClose: () => void;
}

/** Yeni proje ekleme ve proje düzenleme formu. */
export default function ProjectFormModal({ project, onSaved, onClose }: ProjectFormModalProps) {
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [repoUrl, setRepoUrl] = useState(project?.repoUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !repoUrl.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = await api<Project>(project ? `/api/projects/${project.id}` : '/api/projects', {
        method: project ? 'PUT' : 'POST',
        body: JSON.stringify({ title: title.trim(), description: description.trim(), repoUrl: repoUrl.trim() }),
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proje kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal title={project ? 'Projeyi düzenle' : 'Yeni proje'} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <Field id="proje-ad" label="Proje adı">
          <input id="proje-ad" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required autoFocus placeholder="Çizgi izleyen robot" className="girdi" />
        </Field>
        <Field id="proje-aciklama" label="Kısa açıklama">
          <textarea id="proje-aciklama" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} required rows={3} placeholder="Ne yapıyor, hangi donanım ve dille yapıldı?" className="girdi resize-y" />
        </Field>
        <Field id="proje-depo" label="Depo adresi" hint="GitHub depoları sitede kod görüntüleyiciyle açılır.">
          <input id="proje-depo" type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} required placeholder="https://github.com/kullanici/proje" className="girdi font-mono" />
        </Field>
        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ikincil">Vazgeç</button>
          <button type="submit" disabled={saving} className="btn-ana">{saving ? 'Kaydediliyor…' : project ? 'Kaydet' : 'Projeyi ekle'}</button>
        </div>
      </form>
    </Modal>
  );
}
