import type { LucideIcon } from 'lucide-react';

export function IconCircle({ icon: Icon, tone = 'navy' }: { icon: LucideIcon; tone?: 'navy' | 'danger' | 'warn' | 'ok' }) {
  return (
    <span className={`fp-icon-circle ${tone}`} aria-hidden="true">
      <Icon size={20} strokeWidth={1.5} />
    </span>
  );
}
