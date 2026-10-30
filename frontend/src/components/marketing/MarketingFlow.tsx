import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { ArtStep } from './ArtStep';
import { ContractStep } from './ContractStep';
import { ReviewStep } from './ReviewStep';
import { SponsorStep } from './SponsorStep';
import { sponsorFetch } from './sponsorApi';
import './wizard.css';

const STEPS = ['Patrocinador', 'Contrato', 'Arte', 'Revisar e gerar contrato'] as const;

export function MarketingFlow({
  sponsorId,
  contractId,
  onClose,
  onOpen,
}: {
  sponsorId: string | null;
  contractId: string | null;
  onClose: () => void;
  onOpen: (sponsorId: string, contractId: string | null) => void;
}) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<boolean[]>([false, false, false, false]);
  const [toast, setToast] = useState('');
  const [sponsor, setSponsor] = useState(sponsorId);
  const [contract, setContract] = useState(contractId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!contract) return;
    let live = true;
    sponsorFetch<{ contract: { tipo_pessoa?: string; creatives?: unknown[]; forma_pagamento?: string } }>(`/contracts/${contract}`)
      .then((data) => {
        if (!live) return;
        const next = [Boolean(data.contract.tipo_pessoa), true, (data.contract.creatives || []).length > 0, false];
        setDone(next);
        setStep(next.findIndex((item) => !item) === -1 ? 3 : Math.max(0, next.findIndex((item) => !item)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [contract]);

  function saved(message: string, index: number) {
    setToast(message);
    setDone((current) => current.map((item, itemIndex) => item || itemIndex === index));
    setStep(Math.min(3, index + 1));
    window.setTimeout(() => setToast(''), 2500);
  }

  async function cancelDraft() {
    if (!window.confirm('Cancelar este rascunho?')) return;
    if (contract) {
      setBusy(true);
      try {
        await sponsorFetch(`/contracts/${contract}/cancel`, { method: 'POST', body: '{}' });
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : 'Não consegui cancelar o rascunho.');
        return;
      }
    }
    onClose();
  }

  return (
    <div className="fp-flow">
      <div className="fp-flow-head">
        <div>
          <h3>Novo patrocínio</h3>
          <p className="fp-mkt-note">Preencha em 4 passos. Você pode parar e voltar depois, fica salvo como rascunho.</p>
        </div>
        <div className="fp-flow-tools">
          {toast ? <span className="fp-toast" role="status">{toast}</span> : null}
          <Button type="button" variant="secondary" onClick={() => void cancelDraft()} disabled={busy}>Cancelar rascunho</Button>
        </div>
      </div>
      <div className="fp-flow-steps" aria-label="Passos do patrocínio">
        {STEPS.map((label, index) => (
          <span key={label} style={{ display: 'contents' }}>
            {index > 0 ? <span className="fp-flow-line" /> : null}
            <button type="button" className={`${step === index ? 'on' : ''} ${done[index] ? 'done' : ''}`} disabled={!done[index] && index > step} onClick={() => { if (done[index] || index <= step) setStep(index); }}>
              <span className="fp-step-n">{done[index] && step !== index ? '✓' : index + 1}</span>
              {label}
            </button>
          </span>
        ))}
      </div>
      {error ? <p className="fp-field-error">{error}</p> : null}
      {step === 0 ? <SponsorStep sponsorId={sponsor} saving={busy} onSaving={setBusy} onSaved={(id) => { setSponsor(id); onOpen(id, contract); saved('✓ Patrocinador salvo', 0); }} /> : null}
      {step === 1 && sponsor ? <ContractStep sponsorId={sponsor} contractId={contract} saving={busy} onSaving={setBusy} onBack={() => setStep(0)} onSaved={(id) => { setContract(id); onOpen(sponsor, id); saved('✓ Contrato salvo', 1); }} /> : null}
      {step === 2 && contract ? <ArtStep contractId={contract} saving={busy} onSaving={setBusy} onBack={() => setStep(1)} onSaved={() => saved('✓ Arte salva', 2)} /> : null}
      {step === 3 && contract ? <ReviewStep contractId={contract} onBack={() => setStep(2)} onAir={onClose} /> : null}
    </div>
  );
}
