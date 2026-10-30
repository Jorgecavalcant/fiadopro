import { ChevronLeft } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <header className="fp-page-head">
      <button type="button" onClick={onBack} aria-label="Voltar">
        <ChevronLeft size={22} strokeWidth={1.5} />
      </button>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}
