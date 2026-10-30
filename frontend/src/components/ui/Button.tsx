import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

export function Button({
  variant = 'primary',
  block = false,
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}) {
  return (
    <button type={type} className={`fp-btn fp-btn-${variant}${block ? ' fp-btn-block' : ''}`} {...rest}>
      {children}
    </button>
  );
}
