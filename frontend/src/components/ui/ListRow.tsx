import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IconCircle } from './IconCircle';

export function ListRow({
  icon,
  title,
  subtitle,
  amount,
  amountTone,
  onClick,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  amount?: string;
  amountTone?: 'in' | 'plain';
  onClick?: () => void;
}) {
  return (
    <button type="button" className="fp-list-row" onClick={onClick}>
      {icon ? <IconCircle icon={icon} /> : null}
      <span className="fp-list-grow">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </span>
      {amount ? <span className={`fp-list-amt${amountTone === 'in' ? ' in' : ''}`}>{amount}</span> : null}
      <ChevronRight className="fp-chev" size={18} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
