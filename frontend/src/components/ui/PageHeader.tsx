import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
  badge,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="fp-page-head">
      <button type="button" onClick={onBack} aria-label="Voltar">
        <ChevronLeft size={22} strokeWidth={1.5} />
      </button>
      <div className="fp-page-titles">
        <div className="fp-page-title-line">
          <h1>{title}</h1>
          {badge}
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="fp-page-actions">{actions}</div> : null}
    </header>
  );
}
