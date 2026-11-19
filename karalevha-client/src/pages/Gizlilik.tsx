import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KVKK } from '../utils/kvkk';
import PageHeader from '../components/ui/PageHeader';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display font-semibold text-base text-tebesir mb-2">{title}</h2>
      <div className="space-y-2 text-sm text-tebesir-soluk leading-relaxed">{children}</div>
    </section>
  );
}

/** /gizlilik — KVKK aydınlatma metni ve çerez bilgisi */
export default function Gizlilik() {
  const { user } = useAuth();
  return (
    <div className="max-w-okuma pb-16">
      <PageHeader title="Aydınlatma Metni" description="Kişisel verilerin KaraLevha'da nasıl işlendiği (6698 sayılı KVKK, madde 10)." />
      <p className="text-xs text-tebesir-silik">Son güncelleme: {KVKK.updatedAt}</p>

      <Section title="Veri sorumlusu">
        <p>Bu sitedeki kişisel verilerin sorumlusu {KVKK.dataController}'dır. Başvuruların için: {KVKK.contactEmail}</p>
      </Section>

      <Section title="Hangi verileri işliyoruz">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-tebesir">Hesap:</strong> kullanıcı adı, e-posta adresi ve şifrenin geri çevrilemeyen özeti (şifrenin kendisi saklanmaz).</li>
          <li><strong className="text-tebesir">Paylaştıkların:</strong> projeler, modeller, çizim ve devre dosyaları, gönderiler, yorumlar, beğeniler, oba mesajları ve dosyaları, baskı fotoğrafları.</li>
          <li><strong className="text-tebesir">Siparişler ve rezervasyonlar:</strong> Market siparişlerinin ayrıntıları ve dosyaları, atölye rezervasyonları.</li>
          <li><strong className="text-tebesir">Teknik veriler:</strong> oturumu açık tutan çerez; kötüye kullanımı önlemek için IP adresi (istek sınırları için yalnızca bellekte tutulur, kaydedilmez; barındırma sağlayıcılarının kayıtlarında kısa süre kalabilir).</li>
        </ul>
      </Section>

      <Section title="Neden işliyoruz">
        <ul className="list-disc pl-5 space-y-1">
          <li>Hesabını açmak ve yürütmek, giriş yapmanı sağlamak.</li>
          <li>Kulüp etkinliklerini, projeleri ve obaları sunmak; paylaştıklarını diğer üyelere göstermek.</li>
          <li>Market siparişlerini üretmek ve sana durumlarını bildirmek.</li>
          <li>Güvenliği sağlamak, spam ve kötüye kullanımı önlemek, şikâyetleri incelemek.</li>
        </ul>
        <p>Bu işlemler KVKK'nın 5. maddesindeki hukuki sebeplere, özellikle üyelik ilişkisinin kurulması ve yürütülmesi ile kulübün meşru menfaatine dayanır.</p>
      </Section>

      <Section title="Kimlerle paylaşılıyor">
        <p>Veriler satılmaz ve reklam amacıyla paylaşılmaz. Sitenin çalışması için şu hizmet sağlayıcılar kullanılır; bazılarının sunucuları yurt dışındadır:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Barındırma: Vercel (site), API sunucusu ve veritabanı sağlayıcısı.</li>
          <li>Dosya deposu: Cloudflare R2.</li>
          <li>E-posta gönderimi: Resend (yalnızca hesap doğrulama e-postaları).</li>
        </ul>
        <p>Projelerin, modellerin, gönderilerin ve açık obaların içeriği sitenin ziyaretçilerine açıktır; gizli ve davetli obaların içeriği yalnızca üyelerine.</p>
      </Section>

      <Section title="Ne kadar saklanıyor">
        <p>Verilerin hesabın açık olduğu sürece saklanır. Hesabını silince verilerin kalıcı olarak silinir. Başkalarıyla ortak yürüttüğün işler bunun dışındadır: ekibi olan projelerin ekipte kalan en eski üyeye, üyesi olan obaların en eski üyeye devredilir. Başkasının projesine yüklediğin dosyalar o projede kalır.</p>
      </Section>

      <Section title="Çerezler">
        <p>Yalnızca oturumunu açık tutan zorunlu çerez kullanılır. Bu çerezi tarayıcıdaki betikler okuyamaz. Takip, analiz ya da reklam çerezi kullanılmaz. Tarayıcında kullanıcı adın ve son açtığın oba gibi tercihlerin de saklanır; bunlar çıkış yapınca silinir.</p>
      </Section>

      <Section title="Hakların (KVKK madde 11)">
        <ul className="list-disc pl-5 space-y-1">
          <li>Verilerinin işlenip işlenmediğini ve nasıl işlendiğini öğrenmek,</li>
          <li>Eksik ya da yanlış işlenmişse düzeltilmesini, silinmesini istemek,</li>
          <li>Aktarıldığı üçüncü kişileri bilmek,</li>
          <li>Kanuna aykırı işlenmesi nedeniyle zarara uğrarsan zararın giderilmesini talep etmek.</li>
        </ul>
        <p>
          Verilerinin bir kopyasını indirmek ve hesabını silmek için {user ? (
            <Link to={`/u/${encodeURIComponent(user.username)}`} className="underline underline-offset-4 hover:text-tebesir">profil sayfandaki</Link>
          ) : 'profil sayfandaki'} "Hesap" bölümünü kullanabilirsin.
          Diğer başvuruların için: {KVKK.contactEmail}
        </p>
      </Section>
    </div>
  );
}
