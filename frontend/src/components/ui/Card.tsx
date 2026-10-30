import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ children, ...rest }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <article className="fp-card" {...rest}>
      {children}
    </article>
  );
}
