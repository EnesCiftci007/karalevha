import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, Download, Pencil, Rotate3d, Search, Trash2, Upload, UploadCloud, X } from 'lucide-react';
import { api, API_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PrintModel } from '../types';
import { fullDate, timeAgo } from '../utils/time';
import { modelThumbnail } from '../utils/modelThumbnail';
import { GAME_FORMATS, MODEL_ACCEPT, formatOf, type ModelFormat } from '../utils/loadModel';
import { formatSize } from '../services/files';
import ModelPreview from '../components/ModelPreview';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Field from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';
import Tabs from '../components/ui/Tabs';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ItemMenu from '../components/ui/ItemMenu';
import UserLink from '../components/ui/UserLink';
import ModelEditModal from '../components/modeller/ModelEditModal';
import MakesSection from '../components/modeller/MakesSection';
import { Comments, LikeButton, useSocialCounts } from '../components/social/Social';

const MAX_UPLOAD = 50 * 1024 * 1024; // Backend sınırıyla aynı (50 MB)

type Category = PrintModel['category'];
type Filter = 'hepsi' | Category;

const CATEGORY_LABEL: Record<Category, string> = { baski: 'Baskı', oyun: 'Oyun' };

const fileUrlOf = (model: PrintModel) => `${API_URL}${model.fileUrl}`;
const downloadName = (model: PrintModel) => `${model.title}.${model.format}`;

/** Kart görseli: ekrana girince modelden küçük resim üretir. */
function ModelThumbnail({ url, format }: { url: string; format: ModelFormat }) {
  const ref = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [state, setState] = useState<'bekliyor' | 'hazir' | 'yok'>('bekliyor');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        modelThumbnail(url, format).then((data) => {
          if (cancelled) return;
          setImage(data);
          setState(data ? 'hazir' : 'yok');
        });
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [url, format]);

  return (
    <div ref={ref} className="relative aspect-[4/3] bg-levha-koyu overflow-hidden">
      <div className="kareli absolute inset-0" aria-hidden="true" />
      {image ? (
        <img src={image} alt="" className="relative w-full h-full object-contain" />
      ) : (
        <div className="relative w-full h-full flex items-center justify-center">
          <Box className={`w-8 h-8 text-levha-cizgi ${state === 'bekliyor' ? 'animate-pulse' : ''}`} strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}

export default function BaskiIstasyonu() {
  const { user } = useAuth();
  const [models, setModels] = useState<PrintModel[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('hepsi');
  const [preview, setPreview] = useState<PrintModel | null>(null);
  const [params, setParams] = useSearchParams();
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<PrintModel | null>(null);
  const [deleting, setDeleting] = useState<PrintModel | null>(null);

  // Yükleme formu
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('baski');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchModels = () =>
    api<PrintModel[]>('/api/printmodels?take=100')
      .then((data) => {
        setModels(data);
        setLoadFailed(false);
      })
      .catch(() => {
        setModels((prev) => prev ?? []);
        setLoadFailed(true);
      });

  useEffect(() => {
    fetchModels();
  }, []);

  // Bildirimlerdeki bağlantılar ?model=ID ile gelir: o modelin penceresini aç
  useEffect(() => {
    const id = Number(params.get('model'));
    if (!id || !models) return;
    const found = models.find((m) => m.id === id);
    if (found) setPreview(found);
    setParams({}, { replace: true });
  }, [models, params, setParams]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return (models ?? []).filter(
      (m) =>
        (filter === 'hepsi' || m.category === filter) &&
        (!q ||
          m.title.toLocaleLowerCase('tr').includes(q) ||
          (m.description ?? '').toLocaleLowerCase('tr').includes(q) ||
          m.uploader.toLocaleLowerCase('tr').includes(q))
    );
  }, [models, query, filter]);

  const social = useSocialCounts('model', (models ?? []).map((m) => m.id));

  const count = (c: Category) => (models ?? []).filter((m) => m.category === c).length;

  const pickFile = (picked: File | undefined | null) => {
    if (!picked) return;
    const format = formatOf(picked.name);
    if (!format) {
      setFormError('Desteklenen biçimler: STL, 3MF, OBJ, FBX, GLB.');
      return;
    }
    if (picked.size > MAX_UPLOAD) {
      setFormError(`Dosya en fazla ${formatSize(MAX_UPLOAD)} olabilir.`);
      return;
    }
    setFormError('');
    setFile(picked);
    // Oyun motoru biçimleri için kategoriyi öner; kullanıcı değiştirebilir
    setCategory(GAME_FORMATS.includes(format) ? 'oyun' : 'baski');
    setTitle((current) => current || picked.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const closeUpload = () => {
    if (uploading) return;
    setShowUpload(false);
    setFormError('');
    setDragOver(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim() || uploading) return;

    setUploading(true);
    setFormError('');
    const formData = new FormData();
    formData.append('title', title.trim());
    if (description.trim()) formData.append('description', description.trim());
    formData.append('category', category);
    formData.append('file', file);

    try {
      await api<{ message: string }>('/api/printmodels', { method: 'POST', body: formData });
      await fetchModels();
      setTitle('');
      setDescription('');
      setFile(null);
      setShowUpload(false);
      setFilter((f) => (f === 'hepsi' || f === category ? f : category));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Yükleme başarısız.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="3B Modeller"
        description="Basılmaya hazır parçalar ve oyun modelleri. Tarayıcıda çevirerek incele, dosyayı indir."
        action={
          user ? (
            <button type="button" onClick={() => setShowUpload(true)} className="btn-ana">
              <Upload className="w-4 h-4" strokeWidth={2.5} />
              Model yükle
            </button>
          ) : (
            <Link to="/auth" state={{ from: '/baski-istasyonu' }} className="btn-ikincil">Model yüklemek için giriş yap</Link>
          )
        }
      />

      {/* Filtre ve arama */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="sm:w-80">
          <Tabs
            label="Kategori"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'hepsi', label: models ? `Hepsi ${models.length}` : 'Hepsi' },
              { value: 'baski', label: models ? `Baskı ${count('baski')}` : 'Baskı' },
              { value: 'oyun', label: models ? `Oyun ${count('oyun')}` : 'Oyun' },
            ]}
          />
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tebesir-silik pointer-events-none" aria-hidden="true" />
          <label htmlFor="model-ara" className="sr-only">Modellerde ara</label>
          <input id="model-ara" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Model ya da yükleyen ara" className="girdi pl-9" />
        </div>
      </div>

      {/* Izgara */}
      {models === null ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Box}
          title={
            loadFailed
              ? 'Modeller yüklenemedi'
              : query.trim()
                ? 'Sonuç bulunamadı'
                : filter === 'oyun'
                  ? 'Henüz oyun modeli yok'
                  : filter === 'baski'
                    ? 'Henüz baskı modeli yok'
                    : 'Henüz yüklenmiş model yok'
          }
          description={
            loadFailed
              ? 'Sayfayı yenilemeyi dene.'
              : query.trim()
                ? `"${query.trim()}" ile eşleşen model yok.`
                : 'STL, 3MF, OBJ, FBX ya da GLB dosyası yükleyebilirsin.'
          }
          action={!loadFailed && !query.trim() && user && (
            <button type="button" onClick={() => setShowUpload(true)} className="btn-ikincil">Model yükle</button>
          )}
        />
      ) : (
        <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map((model) => (
            <li key={model.id} className="kart overflow-hidden flex flex-col hover:border-tebesir-silik transition-colors">
              <button type="button" onClick={() => setPreview(model)} className="block text-left" aria-label={`${model.title} modelini 3B incele`}>
                <ModelThumbnail url={fileUrlOf(model)} format={model.format} />
              </button>
              <div className="flex-1 flex flex-col p-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-tebesir line-clamp-2">{model.title}</h2>
                  <span className="veri shrink-0 pt-0.5">{model.format.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-xs text-tebesir-silik truncate">
                  {social.get(model.id).likes > 0 && <span className="text-tebesir-soluk">♥ {social.get(model.id).likes} · </span>}
                  {model.uploader} · <time dateTime={model.uploadedAt} title={fullDate(model.uploadedAt)}>{timeAgo(model.uploadedAt)}</time>
                </p>
                <div className="mt-auto pt-3">
                  <div className="pt-3 border-t border-levha-cizgi flex items-center justify-between gap-2 text-sm">
                    <button type="button" onClick={() => setPreview(model)} className="inline-flex items-center gap-1.5 text-tebesir-soluk hover:text-tebesir transition-colors">
                      <Rotate3d className="w-4 h-4" aria-hidden="true" />
                      İncele
                    </button>
                    <a href={fileUrlOf(model)} download={downloadName(model)} className="inline-flex items-center gap-1.5 text-tebesir-soluk hover:text-tebesir transition-colors">
                      <Download className="w-4 h-4" aria-hidden="true" />
                      İndir
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 3B inceleme */}
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)} wide>
          <div className="h-[55vh] min-h-[280px]">
            <ModelPreview url={fileUrlOf(preview)} format={preview.format} />
          </div>
          <div className="p-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge>{CATEGORY_LABEL[preview.category]}</Badge>
                <span className="veri">{preview.format.toUpperCase()}</span>
              </div>
              {preview.description && <p className="text-sm text-tebesir-soluk whitespace-pre-wrap break-words">{preview.description}</p>}
              <p className="mt-2 text-xs text-tebesir-silik">
                <UserLink username={preview.uploader} className="text-tebesir-soluk" /> · {fullDate(preview.uploadedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LikeButton type="model" id={preview.id} counts={social.get(preview.id)} onChange={(p) => social.update(preview.id, p)} />
              <ItemMenu
                label="Model seçenekleri"
                actions={[
                  ...(user?.id === preview.userId ? [{ label: 'Düzenle', icon: Pencil, onSelect: () => setEditing(preview) }] : []),
                  ...(user?.id === preview.userId || user?.isAdmin ? [{ label: 'Sil', icon: Trash2, danger: true, onSelect: () => setDeleting(preview) }] : []),
                ]}
              />
              {preview.category === 'baski' && (
                <Link to={`/atolye?model=${preview.id}`} className="btn-ikincil">Yazıcı ayır</Link>
              )}
              <a href={fileUrlOf(preview)} download={downloadName(preview)} className="btn-ana">
                <Download className="w-4 h-4" strokeWidth={2.5} />
                {preview.format.toUpperCase()} indir
              </a>
            </div>
          </div>
          <MakesSection modelId={preview.id} />
          <section className="px-5 pb-5" aria-label="Yorumlar">
            <h3 className="text-sm font-semibold text-tebesir mb-3">
              Yorumlar {social.get(preview.id).comments > 0 && <span className="veri">{social.get(preview.id).comments}</span>}
            </h3>
            <Comments type="model" id={preview.id} ownerId={preview.userId} onCountChange={(n) => social.update(preview.id, { comments: n })} />
          </section>
        </Modal>
      )}

      {/* Yükleme */}
      {showUpload && (
        <Modal title="Model yükle" onClose={closeUpload}>
          <form onSubmit={handleUpload} className="p-5 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept={MODEL_ACCEPT}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-md border border-levha-cizgi bg-levha-koyu px-3 py-2.5">
                <Box className="w-5 h-5 shrink-0 text-tebesir-silik" strokeWidth={1.75} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-tebesir truncate">{file.name}</span>
                  <span className="block veri">{formatSize(file.size)}</span>
                </span>
                <button type="button" onClick={() => setFile(null)} className="p-1 text-tebesir-silik hover:text-tebesir" aria-label="Dosyayı kaldır">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                className={`w-full rounded-md border border-dashed px-4 py-8 text-center transition-colors ${
                  dragOver ? 'border-isaret bg-isaret/5' : 'border-levha-cizgi hover:border-tebesir-silik'
                }`}
              >
                <UploadCloud className="w-6 h-6 mx-auto mb-2 text-tebesir-silik" strokeWidth={1.5} aria-hidden="true" />
                <span className="block text-sm font-medium text-tebesir">Model dosyasını sürükle ya da seç</span>
                <span className="block mt-1 text-xs text-tebesir-silik">STL, 3MF, OBJ, FBX, GLB · en fazla {formatSize(MAX_UPLOAD)}</span>
              </button>
            )}

            <div>
              <span className="alan-etiketi" id="model-kategori">Kategori</span>
              <Tabs
                label="Kategori"
                value={category}
                onChange={setCategory}
                options={[{ value: 'baski', label: 'Baskı modeli' }, { value: 'oyun', label: 'Oyun modeli' }]}
              />
            </div>
            <Field id="model-ad" label="Model adı">
              <input id="model-ad" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required placeholder={category === 'oyun' ? 'Düşük poligon şövalye' : 'Telefon standı'} className="girdi" />
            </Field>
            <Field
              id="model-aciklama"
              label="Açıklama"
              note="isteğe bağlı"
              hint={category === 'oyun' ? 'Poligon sayısı, rig ve animasyonlar, hangi motorda denendiği…' : 'Baskı ayarları, malzeme, destek gerekip gerekmediği…'}
            >
              <textarea id="model-aciklama" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className="girdi resize-y" />
            </Field>
            {file && formatOf(file.name) === 'obj' && (
              <p className="text-xs text-tebesir-silik">OBJ'nin malzeme ve doku dosyaları (.mtl, resimler) yüklenmez; model düz renkte görünür.</p>
            )}

            {formError && <p className="text-sm text-hata" role="alert">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeUpload} disabled={uploading} className="btn-ikincil">Vazgeç</button>
              <button type="submit" disabled={uploading || !file || !title.trim()} className="btn-ana">
                {uploading ? 'Yükleniyor…' : 'Yükle'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <ModelEditModal
          model={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setModels((prev) => (prev ?? []).map((m) => (m.id === updated.id ? updated : m)));
            setPreview(updated);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Model silinsin mi?"
          confirmLabel="Modeli sil"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`/api/printmodels/${deleting.id}`, { method: 'DELETE' });
            setModels((prev) => (prev ?? []).filter((m) => m.id !== deleting.id));
            setPreview(null);
          }}
        >
          <span className="font-medium text-tebesir">{deleting.title}</span> ve dosyası kalıcı olarak silinecek.
        </ConfirmDialog>
      )}
    </div>
  );
}
