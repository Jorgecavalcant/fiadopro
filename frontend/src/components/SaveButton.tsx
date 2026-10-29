import { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  saving: boolean;
  label: string;
};

export default function SaveButton({ saving, label, disabled, type, ...rest }: Props) {
  return (
    <button {...rest} type={type ?? 'submit'} disabled={disabled || saving} aria-busy={saving}>
      {saving ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : null}
      {saving ? 'Salvando...' : label}
    </button>
  );
}
