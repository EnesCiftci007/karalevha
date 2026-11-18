import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Loader2, UploadCloud, X } from 'lucide-react';
import { api } from '../../services/api';
import { Project } from '../../types';
import { formatSize } from '../../services/files';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import { PROJECT_CATEGORIES, type ProjectCategory } from '../../utils/projectCategories';
import { KIND_FORMATS, KIND_LABEL, classify, fits, loadFileTypes, type FileTypes, type PartKind } from '../../utils/projectFileTypes';

interface ProjectFormModalProps {
  /** Verilirse düzenleme, verilmezse yeni proje */
  project?: Project;
  onSaved: (project: Project) => void;
  onClose: () => void;
}

/** Sunucu sınırları: modeller 50 MB, diğer dosyalar 25 MB */
const LIMIT: Record<PartKind, number> = { model: 50 * 1024 * 1024, cizim: 25 * 1024 * 1024, elektronik: 25 * 1024 * 1024, kod: 25 * 1024 * 1024 };
const KINDS: PartKind[] = ['model', 'cizim', 'elektronik', 'kod'];

interface Part {
  key: string;
  file: File;
  kind: PartKind;
  state: 'bekliyor' | 'yukleniyor' | 'tamam' | 'hata';
  error?: string;
}

const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 100) || 'Parça';

/** Bir parçayı projenin ilgili bölümüne yükler */
function uploadPart(projectId: number, part: Part) {
  const form = new FormData();
  form.append('file', part.file);
  if (part.kind === 'model') {
    form.append('title', titleOf(part.file.name));
    form.append('category', 'baski');
    form.append('projectId', String(projectId));
    return api('/api/printmodels', { method: 'POST', body: form });
  }
  form.append('kind', part.kind);
  form.append('title', titleOf(part.file.name));
  return api(`/api/projects/${projectId}/dosyalar`, { method: 'POST', body: form });
}

/**
 * Yeni proje ekleme ve proje düzenleme formu. Yeni projede kodun yanında modeller, çizimler,
 * devre ve kod dosyaları da hemen eklenebilir: her dosya uzantısına göre kendi bölümüne gider.
 */
export default function ProjectFormModal({ project, onSaved, onClose }: ProjectFormModalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [repoUrl, setRepoUrl] = useState(project?.repoUrl ?? '');
  const [category, setCategory] = useState<ProjectCategory>((project?.category as ProjectCategory) ?? 'robotik');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Parçalar (yalnızca yeni projede)
  const [types, setTypes] = useState<FileTypes | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [created, setCreated] = useState<Project | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!project) loadFileTypes().then(setTypes).catch(() => {});
  }, [project]);

  const addFiles = (list: FileList | null) => {
    if (!list || !types) return;
    const bad: string[] = [];
    const next: Part[] = [];
    for (const file of Array.from(list)) {
      // Aynı dosya ikinci kez seçildiyse listeye bir daha girmesin
      if ([...parts, ...next].some((p) => p.file.name === file.name && p.file.size === file.size)) continue;
      const kind = classify(types, file.name);
      if (!kind) bad.push(`${file.name}: desteklenmeyen biçim`);
      else if (file.size > LIMIT[kind]) bad.push(`${file.name}: en fazla ${formatSize(LIMIT[kind])}`);
      else next.push({ key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, kind, state: 'bekliyor' });
    }
    setRejected(bad);
    setParts((prev) => [...prev, ...next]);
  };

  const setPart = (key: string, patch: Partial<Part>) => setParts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || saving) return;
    setSaving(true);
    setError('');

    let saved = created;
    try {
      // Yükleme yarıda kaldıysa proje ikinci kez açılmasın
      if (!saved) {
        saved = await api<Project>(project ? `/api/projects/${project.id}` : '/api/projects', {
          method: project ? 'PUT' : 'POST',
          body: JSON.stringify({ title: title.trim(), description: description.trim(), repoUrl: repoUrl.trim(), category }),
        });
        onSaved(saved);
        if (!project) setCreated(saved);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proje kaydedilemedi.');
      setSaving(false);
      return;
    }

    if (project) {
      onClose();
      return;
    }

    // Parçaları sırayla yükle; biri olmazsa diğerleri devam eder
    let failed = 0;
    for (const part of parts.filter((p) => p.state !== 'tamam')) {
      setPart(part.key, { state: 'yukleniyor', error: undefined });
      try {
        await uploadPart(saved.id, part);
        setPart(part.key, { state: 'tamam' });
      } catch (err) {
        failed++;
        setPart(part.key, { state: 'hata', error: err instanceof Error ? err.message : 'Yüklenemedi.' });
      }
    }
    setSaving(false);
    if (failed === 0) {
      onClose();
      navigate(`/projeler/${saved.id}`);
    } else {
      setError(`Proje açıldı ama ${failed} dosya yüklenemedi. Bölümünü değiştirip yeniden dene ya da proje sayfasından ekle.`);
    }
  };

  const counts = KINDS.map((k) => ({ kind: k, n: parts.filter((p) => p.kind === k).length })).filter((c) => c.n > 0);

  return (
    <Modal title={project ? 'Projeyi düzenle' : 'Yeni proje'} onClose={() => !saving && onClose()}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <Field id="proje-ad" label="Proje adı">
          <input id="proje-ad" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required autoFocus disabled={!!created} placeholder="Çizgi izleyen robot" className="girdi" />
        </Field>
        <Field id="proje-aciklama" label="Kısa açıklama">
          <textarea id="proje-aciklama" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} required rows={3} disabled={!!created} placeholder="Ne yapıyor, hangi donanım ve dille yapıldı?" className="girdi resize-y" />
        </Field>
        <fieldset disabled={!!created}>
          <legend className="mb-2 text-sm font-medium text-tebesir">Dal</legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_CATEGORIES.map((c) => (
              <label
                key={c.id}
                title={c.hint}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-sm cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-isaret ${category === c.id ? 'border-isaret/60 bg-isaret/10 text-tebesir' : 'border-levha-cizgi text-tebesir-soluk hover:border-tebesir-silik'}`}
              >
                <input type="radio" name="proje-dal" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} className="sr-only" />
                <c.icon className="w-4 h-4" aria-hidden="true" />
                {c.label}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-tebesir-silik">{PROJECT_CATEGORIES.find((c) => c.id === category)?.hint}</p>
        </fieldset>
        <Field id="proje-depo" label="GitHub deposu" note="isteğe bağlı" hint="Kodun bir depoda duruyorsa: sitede kod görüntüleyiciyle açılır.">
          <input id="proje-depo" type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} disabled={!!created} placeholder="https://github.com/kullanici/proje" className="girdi font-mono" />
        </Field>

        {/* Parçalar: model, çizim/CAD, elektronik, kod */}
        {!project && (
          <div>
            <p className="mb-2 text-sm font-medium text-tebesir">
              Dosyalar <span className="font-normal text-tebesir-silik">isteğe bağlı</span>
            </p>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <button
              type="button"
              disabled={!types || saving}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`w-full rounded-md border border-dashed px-4 py-5 text-center transition-colors ${dragOver ? 'border-isaret bg-isaret/5' : 'border-levha-cizgi hover:border-tebesir-silik'}`}
            >
              <UploadCloud className="w-5 h-5 mx-auto mb-1.5 text-tebesir-silik" strokeWidth={1.5} aria-hidden="true" />
              <span className="block text-sm font-medium text-tebesir">Modelleri, çizimleri, devre ve kod dosyalarını sürükle ya da seç</span>
              <span className="block mt-1 text-xs text-tebesir-silik">Her dosya biçimine göre kendi bölümüne gider; istersen değiştirebilirsin.</span>
            </button>
            <details className="mt-2 text-xs text-tebesir-silik">
              <summary className="cursor-pointer hover:text-tebesir">Hangi biçimler?</summary>
              <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1">
                {KINDS.map((k) => (
                  <React.Fragment key={k}>
                    <dt className="text-tebesir-soluk">{KIND_LABEL[k]}</dt>
                    <dd>{KIND_FORMATS[k]}</dd>
                  </React.Fragment>
                ))}
                <dt className="text-tebesir-soluk">Her bölüm</dt>
                <dd>Görsel, PDF, ZIP, metin</dd>
              </dl>
            </details>

            {rejected.length > 0 && (
              <ul className="mt-2 text-xs text-hata space-y-0.5" role="alert">
                {rejected.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}

            {parts.length > 0 && (
              <>
                <p className="mt-3 mb-1.5 text-xs text-tebesir-silik">
                  {counts.map((c) => `${c.n} ${KIND_LABEL[c.kind].toLocaleLowerCase('tr')}`).join(' · ')}
                </p>
                <ul className="max-h-56 overflow-y-auto rounded-md border border-levha-cizgi divide-y divide-levha-cizgi">
                  {parts.map((p) => (
                    <li key={p.key} className="flex items-center gap-2 px-3 py-2">
                      <span className="w-4 shrink-0" aria-hidden="true">
                        {p.state === 'yukleniyor' && <Loader2 className="w-4 h-4 animate-spin text-tebesir-silik" />}
                        {p.state === 'tamam' && <Check className="w-4 h-4 text-basari" />}
                        {p.state === 'hata' && <AlertCircle className="w-4 h-4 text-hata" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-tebesir truncate" title={p.file.name}>{p.file.name}</span>
                        <span className={`block text-xs truncate ${p.error ? 'text-hata' : 'text-tebesir-silik'}`}>{p.error ?? formatSize(p.file.size)}</span>
                      </span>
                      <select
                        value={p.kind}
                        disabled={saving || p.state === 'tamam'}
                        onChange={(e) => setPart(p.key, { kind: e.target.value as PartKind, state: 'bekliyor', error: undefined })}
                        className="girdi w-auto h-8 py-0 text-xs"
                        aria-label={`${p.file.name} bölümü`}
                      >
                        {KINDS.filter((k) => types && fits(types, p.file.name, k)).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                      </select>
                      <button
                        type="button"
                        disabled={saving || p.state === 'tamam'}
                        onClick={() => setParts((prev) => prev.filter((x) => x.key !== p.key))}
                        className="p-1 text-tebesir-silik hover:text-tebesir disabled:opacity-40"
                        aria-label={`${p.file.name} dosyasını çıkar`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-hata" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          {created ? (
            <button type="button" onClick={() => { onClose(); navigate(`/projeler/${created.id}`); }} disabled={saving} className="btn-ikincil">Projeye git</button>
          ) : (
            <button type="button" onClick={onClose} disabled={saving} className="btn-ikincil">Vazgeç</button>
          )}
          <button type="submit" disabled={saving} className="btn-ana">
            {saving
              ? parts.some((p) => p.state === 'yukleniyor') ? `Yükleniyor ${parts.filter((p) => p.state === 'tamam').length + 1}/${parts.length}…` : 'Kaydediliyor…'
              : project ? 'Kaydet' : created ? 'Yeniden dene' : 'Projeyi ekle'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
