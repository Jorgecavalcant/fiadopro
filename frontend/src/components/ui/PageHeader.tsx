import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="fp-page-head">
      <div className="fp-page-head-row">
        <button type="button" onClick={onBack} aria-label="Voltar">
          <ChevronLeft size={22} strokeWidth={1.5} />
        </button>
        {actions ? <div className="fp-page-actions">{actions}</div> : null}
      </div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}
