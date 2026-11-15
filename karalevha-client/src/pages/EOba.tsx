import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, MessageSquare, MessagesSquare, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Oba } from '../types';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Field from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Skeleton from '../components/ui/Skeleton';
import ItemMenu from '../components/ui/ItemMenu';
import ListToolbar from '../components/ui/ListToolbar';
import { useMine } from '../components/ui/useMine';
import { fullDate, timeAgo } from '../utils/time';

type SortKey = 'aktif' | 'uye' | 'ad';

export default function EOba() {
  const { user } = useAuth();
  const [obalar, setObalar] = useState<Oba[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('aktif');
  const [mine, setMine] = useMine();

  // Oba kurma
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinPassword, setJoinPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Düzenleme
  const [toEdit, setToEdit] = useState<Oba | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Silme onayı
  const [toDelete, setToDelete] = useState<Oba | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<Oba[]>('/api/obalar')
      .then((data) => !cancelled && setObalar(data))
      .catch(() => {
        if (cancelled) return;
        setObalar([]);
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = (obalar ?? []).filter(
      (o) =>
        (!mine || o.isMember || o.owner === user?.username) &&
        (!q || o.name.toLocaleLowerCase('tr').includes(q) || (o.description ?? '').toLocaleLowerCase('tr').includes(q))
    );
    // "aktif": sunucunun sırası (son mesaj ya da kuruluş zamanı, en yeni üstte)
    if (sort === 'uye') return [...list].sort((a, b) => (b.memberCount ?? 1) - (a.memberCount ?? 1));
    if (sort === 'ad') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return list;
  }, [obalar, query, sort, mine, user]);

  const closeCreate = () => {
    if (saving) return;
    setShowCreate(false);
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    if (isPrivate && !joinPassword.trim()) {
      setFormError('Gizli oba için bir katılım şifresi belirle.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const created = await api<Oba>('/api/obalar', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          isPrivate,
          joinPassword: isPrivate ? joinPassword.trim() : null,
        }),
      });
      setObalar((prev) => [created, ...(prev ?? [])]);
      setName('');
      setDescription('');
      setIsPrivate(false);
      setJoinPassword('');
      setShowCreate(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Oba kurulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (oba: Oba) => {
    setToEdit(oba);
    setEditName(oba.name);
    setEditDescription(oba.description ?? '');
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEdit || !editName.trim() || editSaving) return;
    setEditSaving(true);
    setEditError('');
    try {
      const updated = await api<Oba>(`/api/obalar/${toEdit.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
      });
      setObalar((prev) => (prev ?? []).map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      setToEdit(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/api/obalar/${toDelete.id}`, { method: 'DELETE' });
      setObalar((prev) => (prev ?? []).filter((o) => o.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Oba silinemedi.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="E-Oba"
        description="Kulübün sohbet odaları: ders notları, çıkmış sorular ve proje dosyaları burada paylaşılır."
        action={
          user ? (
            <button type="button" onClick={() => setShowCreate(true)} className="btn-ana">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Oba kur
            </button>
          ) : (
            <Link to="/auth" state={{ from: '/e-oba' }} className="btn-ikincil">Oba kurmak için giriş yap</Link>
          )
        }
      />

      {obalar && obalar.length > 0 && (
        <ListToolbar
          id="oba-ara"
          query={query}
          onQuery={setQuery}
          placeholder="Oba ara"
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: 'aktif', label: 'Son etkinlik' },
            { value: 'uye', label: 'Üye sayısı' },
            { value: 'ad', label: 'Ada göre (A–Z)' },
          ]}
          count={{ shown: visible.length, total: obalar.length, unit: 'oba' }}
          mine={user ? { active: mine, onChange: setMine } : undefined}
        />
      )}

      {obalar === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={loadFailed ? 'Obalar yüklenemedi' : obalar.length === 0 ? 'Henüz kurulmuş oba yok' : 'Sonuç bulunamadı'}
          description={
            loadFailed
              ? 'Sayfayı yenilemeyi dene.'
              : obalar.length === 0
                ? 'Dersin, takımın ya da projen için bir oba kur; notlar ve dosyalar tek yerde dursun.'
                : `"${query.trim()}" adında bir oba yok.`
          }
          action={!loadFailed && obalar.length === 0 && user && (
            <button type="button" onClick={() => setShowCreate(true)} className="btn-ikincil">İlk obayı kur</button>
          )}
        />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((oba) => {
            const isOwner = user?.username === oba.owner;
            return (
              <li key={oba.id} className="relative kart hover:border-tebesir-silik transition-colors">
                <Link to={`/e-oba/${oba.id}`} className="flex flex-col h-full p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={oba.name} />
                    <div className="min-w-0 flex-1 pr-8">
                      <h2 className="text-base font-semibold text-tebesir truncate">{oba.name}</h2>
                      <p className="text-xs text-tebesir-silik truncate">{oba.owner} kurdu</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-tebesir-soluk line-clamp-2 flex-1">
                    {oba.description || 'Açıklama eklenmemiş.'}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-tebesir-silik">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      {oba.memberCount ?? 1} üye
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                      {oba.lastMessageAt ? (
                        <time dateTime={oba.lastMessageAt} title={`Son mesaj: ${fullDate(oba.lastMessageAt)}`}>
                          {oba.messageCount} mesaj · son {timeAgo(oba.lastMessageAt)}
                        </time>
                      ) : (
                        'Henüz mesaj yok'
                      )}
                    </span>
                    {oba.isPrivate && <Badge><Lock className="w-3 h-3" aria-hidden="true" />Gizli</Badge>}
                    {isOwner ? <Badge tone="isaret">Kurucu</Badge> : oba.isMember && <Badge>Üyesin</Badge>}
                  </div>
                </Link>
                {isOwner && (
                  <div className="absolute top-4 right-4">
                    <ItemMenu
                      label={`${oba.name} seçenekleri`}
                      actions={[
                        { label: 'Düzenle', icon: Pencil, onSelect: () => openEdit(oba) },
                        { label: 'Sil', icon: Trash2, danger: true, onSelect: () => { setDeleteError(''); setToDelete(oba); } },
                      ]}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Oba kur */}
      {showCreate && (
        <Modal title="Oba kur" onClose={closeCreate}>
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <Field id="oba-adi" label="Oba adı">
              <input id="oba-adi" type="text" required maxLength={50} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Devre Analizi" className="girdi" />
            </Field>
            <Field id="oba-aciklama" label="Açıklama" note="isteğe bağlı">
              <textarea id="oba-aciklama" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bu oba ne için?" className="girdi resize-y" />
            </Field>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-0.5 w-4 h-4 accent-isaret" />
              <span>
                <span className="block text-sm font-medium text-tebesir">Gizli oba</span>
                <span className="block text-xs text-tebesir-silik">İçeriği yalnızca şifreyle katılan üyeler görür.</span>
              </span>
            </label>
            {isPrivate && (
              <Field id="oba-sifre" label="Katılım şifresi" hint="Bu şifreyi katılmasını istediğin kişilerle paylaş.">
                <input id="oba-sifre" type="text" maxLength={100} value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} className="girdi" />
              </Field>
            )}
            {formError && <p className="text-sm text-hata" role="alert">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeCreate} disabled={saving} className="btn-ikincil">Vazgeç</button>
              <button type="submit" disabled={saving || !name.trim()} className="btn-ana">{saving ? 'Kuruluyor…' : 'Obayı kur'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Düzenleme */}
      {toEdit && (
        <Modal title="Obayı düzenle" onClose={() => !editSaving && setToEdit(null)}>
          <form onSubmit={handleEdit} className="p-5 space-y-4">
            <Field id="oba-duzenle-ad" label="Oba adı">
              <input id="oba-duzenle-ad" type="text" required maxLength={100} autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="girdi" />
            </Field>
            <Field id="oba-duzenle-aciklama" label="Açıklama" note="isteğe bağlı">
              <textarea id="oba-duzenle-aciklama" rows={3} maxLength={500} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="girdi resize-y" />
            </Field>
            {editError && <p className="text-sm text-hata" role="alert">{editError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setToEdit(null)} disabled={editSaving} className="btn-ikincil">Vazgeç</button>
              <button type="submit" disabled={editSaving || !editName.trim()} className="btn-ana">{editSaving ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Silme onayı */}
      {toDelete && (
        <Modal title="Oba silinsin mi?" onClose={() => !deleting && setToDelete(null)}>
          <div className="p-5 space-y-4">
            <p className="text-sm text-tebesir-soluk">
              <span className="font-medium text-tebesir">{toDelete.name}</span> obası, bütün kanalları, mesajları ve
              paylaşılan dosyalarıyla birlikte kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            {deleteError && <p className="text-sm text-hata" role="alert">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setToDelete(null)} disabled={deleting} className="btn-ikincil">Vazgeç</button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="btn-tehlike">{deleting ? 'Siliniyor…' : 'Kalıcı olarak sil'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
