import { CSSProperties, useEffect, useState } from 'react';
import { brDisplayToIso, formatBrDate, maskBrDateTyping } from '../utils/formatBr';

type Props = {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Mostra dd/mm/aaaa em qualquer navegador.
 * O valor entregue continua YYYY-MM-DD, o mesmo do input nativo,
 * para o vencimento seguir gravado ao meio-dia de São Paulo.
 */
export default function BrDateField({ id, value, onChange, ariaLabel, className, style }: Props) {
  const [text, setText] = useState(() => (value ? formatBrDate(value) : ''));

  useEffect(() => {
    if (!value) {
      setText((prev) => (brDisplayToIso(prev) ? '' : prev));
      return;
    }
    setText(formatBrDate(value));
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      aria-label={ariaLabel}
      className={className}
      style={style}
      value={text}
      onChange={(event) => {
        const masked = maskBrDateTyping(event.target.value);
        setText(masked);
        if (!masked) {
          onChange('');
          return;
        }
        onChange(brDisplayToIso(masked) ?? '');
      }}
    />
  );
}
