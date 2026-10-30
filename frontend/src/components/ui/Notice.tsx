import type { HTMLAttributes, ReactNode } from 'react';

export function Notice({
  title,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { title: string; children?: ReactNode }) {
  return (
    <aside className="fp-notice" {...rest}>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </aside>
  );
}
