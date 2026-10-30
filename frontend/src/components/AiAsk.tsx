import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

/** Conversa da IA. Sem endpoint de pergunta livre, o Pro não chama o servidor. */
export function AiAsk({
  isPro,
  canUpgrade,
  onUpgrade,
}: {
  isPro: boolean;
  canUpgrade: boolean;
  onUpgrade: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState('');

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setSent(text);
    setDraft('');
  };

  return (
    <div className="fp-ai">
      {isPro && sent ? (
        <div className="fp-bubbles">
          <p className="fp-bubble mine">{sent}</p>
          <p className="fp-bubble theirs">
            <Sparkles size={14} strokeWidth={1.5} />
            Em breve
          </p>
        </div>
      ) : null}
      <form
        className="fp-ask"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Sparkles size={16} strokeWidth={1.5} />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={sent ? 'Pergunte de novo...' : 'Pergunte à IA sobre suas contas'}
          aria-label="Pergunte à IA sobre suas contas"
        />
        <button type="submit" aria-label="Enviar pergunta">
          <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </form>
      {!isPro && sent ? (
        <div className="fp-ai-pro">
          <strong>A IA é do plano Pro</strong>
          <p>Ela lê só os dados da sua conta e responde sobre cobranças, atrasos e o que fazer.</p>
          {canUpgrade ? (
            <button type="button" className="fp-btn fp-btn-primary fp-btn-block" onClick={onUpgrade}>
              Conhecer o Pro
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
