import { InputHTMLAttributes } from 'react';
import { formatBrCurrencyInput, parseBrCurrencyInput } from '../utils/formatBr';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null;
  onChange: (value: number | null) => void;
};

/**
 * Campo de moeda. A tela mostra R$ 1.000,00.
 * O onChange entrega número (10 ou 1234.56), nunca o texto formatado.
 */
export default function CurrencyInput({ value, onChange, inputMode, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="text"
      inputMode={inputMode ?? 'decimal'}
      autoComplete="off"
      value={formatBrCurrencyInput(value)}
      onChange={(event) => onChange(parseBrCurrencyInput(event.target.value))}
    />
  );
}
