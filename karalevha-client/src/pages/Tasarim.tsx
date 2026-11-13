import { useState, type ReactNode } from 'react';
import { FolderGit2, Lock, Plus } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Field from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Skeleton, { SkeletonRows } from '../components/ui/Skeleton';
import Tabs from '../components/ui/Tabs';

/**
 * Canlı tasarım kataloğu: bütün ortak parçalar tek ekranda.
 * Menüde yok; /tasarim adresinden açılır. Kurallar için DESIGN.md.
 */

function Bolum({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-12 border-t border-levha-cizgi first:border-t-0 first:pt-0">
      <h2 className="font-display font-semibold text-lg text-tebesir mb-6">{title}</h2>
      {children}
    </section>
  );
}

const renkler: [string, string, string][] = [
  ['levha', 'bg-levha', 'Sayfa zemini'],
  ['levha-koyu', 'bg-levha-koyu', 'Çukur alanlar'],
  ['levha-yuzey', 'bg-levha-yuzey', 'Kart, menü, pencere'],
  ['levha-cizgi', 'bg-levha-cizgi', 'Kenarlık'],
  ['tebesir', 'bg-tebesir', 'Ana yazı'],
  ['tebesir-soluk', 'bg-tebesir-soluk', 'İkincil yazı'],
  ['tebesir-silik', 'bg-tebesir-silik', 'İpucu, tarih'],
  ['isaret', 'bg-isaret', 'Tek vurgu'],
  ['hata', 'bg-hata', 'Hata'],
  ['basari', 'bg-basari', 'Başarı'],
];

const yazilar: [string, string, string][] = [
  ['text-2xl', 'font-display font-bold text-2xl', 'Ana sayfa başlığı · 40'],
  ['text-xl', 'font-display font-bold text-xl', 'Sayfa başlığı · 28'],
  ['text-lg', 'font-display font-semibold text-lg', 'Bölüm başlığı · 20'],
  ['text-base', 'text-base', 'Gövde metni, liste başlığı · 16'],
  ['text-sm', 'text-sm text-tebesir-soluk', 'İkincil metin, buton, form · 14'],
  ['text-xs', 'text-xs text-tebesir-silik', 'Tarih, sayaç, yardım metni · 12'],
];

export default function Tasarim() {
  const [sekme, setSekme] = useState<'giris' | 'kayit'>('giris');
  const [pencere, setPencere] = useState(false);

  return (
    <div>
      <PageHeader
        title="Tasarım kataloğu"
        description="Sitenin bütün ortak parçaları. Kurallar DESIGN.md dosyasında."
      />

      <Bolum title="Renkler">
        <ul className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {renkler.map(([ad, sinif, not]) => (
            <li key={ad}>
              <div className={`h-14 rounded-md border border-levha-cizgi ${sinif}`} />
              <p className="mt-2 text-sm font-medium text-tebesir">{ad}</p>
              <p className="text-xs text-tebesir-silik">{not}</p>
            </li>
          ))}
        </ul>
      </Bolum>

      <Bolum title="Yazı ölçeği">
        <ul className="space-y-4">
          {yazilar.map(([ad, sinif, not]) => (
            <li key={ad} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
              <span className="veri w-20 shrink-0">{ad}</span>
              <span className={sinif}>{not}</span>
            </li>
          ))}
          <li className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
            <span className="veri w-20 shrink-0">.veri</span>
            <span className="veri">github.com/kulup/robot · 2,4 MB · 128</span>
          </li>
        </ul>
      </Bolum>

      <Bolum title="Butonlar">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-ana"><Plus className="w-4 h-4" strokeWidth={2.5} />Ana eylem</button>
          <button className="btn-ikincil">İkincil</button>
          <button className="btn-sade">Sade</button>
          <button className="btn-tehlike">Sil</button>
          <button className="btn-ana" disabled>Pasif</button>
        </div>
        <p className="mt-4 text-sm text-tebesir-soluk">Bir ekranda en fazla bir ana buton.</p>
      </Bolum>

      <Bolum title="Form">
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl">
          <Field id="t-ad" label="Proje adı">
            <input id="t-ad" className="girdi" placeholder="Çizgi izleyen robot" />
          </Field>
          <Field id="t-depo" label="Depo adresi" hint="GitHub ya da GitLab bağlantısı">
            <input id="t-depo" className="girdi font-mono" placeholder="https://github.com/..." />
          </Field>
          <Field id="t-hata" label="Şifre" error="Şifre en az 8 karakter olmalı.">
            <input id="t-hata" type="password" className="girdi border-hata" defaultValue="1234" />
          </Field>
          <Field id="t-secim" label="Sıralama" note="isteğe bağlı">
            <select id="t-secim" className="girdi">
              <option>En yeni</option>
              <option>Ada göre</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field id="t-aciklama" label="Açıklama">
              <textarea id="t-aciklama" className="girdi resize-y" rows={3} placeholder="Ne yapıyor?" />
            </Field>
          </div>
        </div>
      </Bolum>

      <Bolum title="Sekmeler, rozetler, avatarlar">
        <div className="max-w-xs">
          <Tabs
            label="Örnek"
            value={sekme}
            onChange={setSekme}
            options={[{ value: 'giris', label: 'Giriş yap' }, { value: 'kayit', label: 'Kayıt ol' }]}
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Badge><Lock className="w-3 h-3" />Gizli</Badge>
          <Badge tone="isaret">Kurucu</Badge>
          <Badge tone="basari">Yüklendi</Badge>
          <Badge tone="hata">Hata</Badge>
          <span className="w-4" />
          <Avatar name="enes" size="sm" />
          <Avatar name="Maker Kulübü" />
        </div>
      </Bolum>

      <Bolum title="Kart ve liste">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="kart p-5">
            <h3 className="text-base font-semibold text-tebesir">Kart başlığı</h3>
            <p className="mt-1 text-sm text-tebesir-soluk">Kartlar kenarlıkla ayrılır, gölge kullanılmaz.</p>
            <p className="mt-3 veri">2 gün önce · 3 üye</p>
          </div>
          <ul className="kart divide-y divide-levha-cizgi">
            {['Çizgi izleyen robot', 'Hava istasyonu'].map((ad) => (
              <li key={ad} className="flex items-center gap-3 px-4 py-3">
                <FolderGit2 className="w-4 h-4 text-tebesir-silik" strokeWidth={1.75} />
                <span className="flex-1 text-sm font-medium text-tebesir">{ad}</span>
                <span className="text-xs text-tebesir-silik">dün</span>
              </li>
            ))}
          </ul>
        </div>
      </Bolum>

      <Bolum title="Boş, yükleniyor, pencere">
        <div className="grid md:grid-cols-2 gap-6">
          <EmptyState
            icon={FolderGit2}
            title="Henüz proje yok"
            description="Kulüpte üzerinde çalıştığın bir proje varsa ilk sen ekle."
            action={<button className="btn-ikincil">İlk projeyi ekle</button>}
          />
          <div className="kart p-5">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <SkeletonRows rows={2} />
          </div>
        </div>
        <button className="btn-ikincil mt-6" onClick={() => setPencere(true)}>Pencereyi aç</button>
        {pencere && (
          <Modal title="Örnek pencere" onClose={() => setPencere(false)}>
            <div className="p-5 space-y-4">
              <p className="text-sm text-tebesir-soluk">Esc tuşu ya da dışarı tıklama ile kapanır.</p>
              <div className="flex justify-end gap-3">
                <button className="btn-ikincil" onClick={() => setPencere(false)}>Vazgeç</button>
                <button className="btn-ana" onClick={() => setPencere(false)}>Tamam</button>
              </div>
            </div>
          </Modal>
        )}
      </Bolum>
    </div>
  );
}
