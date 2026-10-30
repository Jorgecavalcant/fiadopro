import type { LucideIcon } from 'lucide-react';

export function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="fp-quick" onClick={onClick}>
      <span className="fp-quick-pill">
        <Icon size={22} strokeWidth={1.5} color="#fff" />
      </span>
      <span className="fp-quick-label">{label}</span>
    </button>
  );
}
