import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Liste boşken ya da yüklenemediğinde gösterilen kutu. */
export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-levha-cizgi px-6 py-12 text-center">
      <Icon className="w-6 h-6 mx-auto mb-3 text-tebesir-silik" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-base font-medium text-tebesir">{title}</p>
      {description && <p className="mt-1 text-sm text-tebesir-soluk max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
