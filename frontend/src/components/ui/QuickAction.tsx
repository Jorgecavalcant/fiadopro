import type { LucideIcon } from 'lucide-react';

export function QuickAction({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  tone?: 'debt' | 'paid';
}) {
  const pillClass =
    tone === 'debt'
      ? 'fp-quick-pill fp-quick-pill--debt'
      : tone === 'paid'
        ? 'fp-quick-pill fp-quick-pill--paid'
        : 'fp-quick-pill';

  return (
    <button type="button" className="fp-quick" onClick={onClick} aria-label={label} title={label}>
      <span className={pillClass}>
        <Icon size={22} strokeWidth={1.5} color="#fff" />
      </span>
      <span className="fp-quick-label">{label}</span>
    </button>
  );
}
