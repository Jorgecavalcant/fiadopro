import type { ReactNode } from 'react';
import { formatPhoneDisplay } from '../utils/formatPhoneDisplay';

/** Cartão do cliente sem repetir o nome, que fica só no cabeçalho. */
export function CustomerIdentity({
  name,
  phone,
  balanceText,
  balanceColor,
  score,
  scoreLabel,
  trusted,
  onToggleTrusted,
  children,
}: {
  name: string;
  phone?: string;
  balanceText: string;
  balanceColor: string;
  score: number;
  scoreLabel: string;
  trusted?: boolean;
  onToggleTrusted?: () => void;
  children?: ReactNode;
}) {
  return (
    <article className="fp-card fp-identity">
      <div className="fp-identity-top">
        <span className="fp-avatar" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <div>
          {phone ? (
            <p>{formatPhoneDisplay(phone)}</p>
          ) : (
            <p>Telefone pendente — adicione para não perder este cadastro</p>
          )}
        </div>
      </div>
      <p className="fp-kicker">Dívida atual</p>
      <p className="fp-identity-balance" style={{ color: balanceColor }}>
        {balanceText}
      </p>
      <div className="fp-score">
        <span>Pontualidade</span>
        <div className="fp-score-track" aria-hidden="true">
          <span style={{ width: `${Math.min(100, score / 10)}%` }} />
        </div>
        <strong aria-label={`${score} ${scoreLabel}`}>{score}</strong>
        {onToggleTrusted ? (
          <button type="button" className="fp-text-link" onClick={onToggleTrusted}>
            {trusted ? 'Confiável' : 'Marcar'}
          </button>
        ) : null}
      </div>
      {children}
    </article>
  );
}
