import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Sağdaki ana eylem (ör. "Yeni proje" butonu). Sayfa başına en fazla bir ana buton. */
  action?: ReactNode;
  /** Üst sayfaya dönüş bağlantısı */
  back?: { to: string; label: string };
}

/** Bütün bölüm sayfalarının ortak başlığı: aynı boyut, aynı boşluk. */
export default function PageHeader({ title, description, action, back }: PageHeaderProps) {
  return (
    <header className="mb-8">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1 mb-3 text-sm text-tebesir-soluk hover:text-tebesir transition-colors">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl text-tebesir">{title}</h1>
          {description && <p className="mt-1 text-base text-tebesir-soluk max-w-2xl">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
