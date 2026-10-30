import type { LucideIcon } from 'lucide-react';

export function IconCircle({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="fp-icon-circle" aria-hidden="true">
      <Icon size={20} strokeWidth={1.5} />
    </span>
  );
}
