import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { downloadContract, sponsorFetch } from './sponsorApi';
import { brDate, saoPauloToday } from './sponsorLink';

type DocumentView = { versao: number | null; gerado_em: string | null; atual: boolean; texto: string };
type Detail = {
  nome: string;
  documento?: string;
  telefone?: string;
  email?: string;
  inicio: string;
  fim: string;
  planos_alvo: string[];
  slots: string[];
  valor_centavos?: number;
  forma_pagamento?: string;
  parcelas?: number;
  dia_vencimento?: number;
  status: string;
};

export function ReviewStep({
  contractId,
  onBack,
  onAir,
}: {
  contractId: string;
  onBack: () => void;
  onAir: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [documentView, setDocumentView] = useState<DocumentView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([
      sponsorFetch<{ contract: Detail }>(`/contracts/${contractId}`),
      sponsorFetch<{ document: DocumentView }>(`/contracts/${contractId}/document`).catch(() => ({ document: null })),
    ]).then(([contract, doc]) => {
      if (!live) return;
      setDetail(contract.contract);
      if (doc.document) setDocumentView(doc.document);
    }).catch((err: unknown) => {
      if (live) setError(err instanceof Error ? err.message : 'Não consegui abrir o contrato.');
    });
    return () => {
      live = false;
    };
  }, [contractId, revision]);

  async function generate() {
    setBusy('Gerando…');
    setError('');
    try {
      await sponsorFetch(`/contracts/${contractId}/document`, { method: 'POST', body: '{}' });
      setRevision((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui gerar o contrato.');
    } finally {
      setBusy('');
    }
  }

  async function publish() {
    setBusy('Colocando no ar…');
    try {
      await sponsorFetch(`/contracts/${contractId}/activate`, { method: 'POST', body: '{}' });
      onAir();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui colocar no ar.');
      setBusy('');
    }
  }

  const ready = Boolean(documentView?.versao && documentView.atual);
  const scheduled = detail ? detail.inicio > saoPauloToday() : false;
  return (
    <div className="fp-review">
      <section className="fp-flow-card">
        <h3>Resumo</h3>
        {detail ? (
          <div>
            <p>Patrocinador {detail.nome}{detail.documento ? ` · ${detail.documento}` : ''}</p>
            <p>Contato {detail.telefone || ''} {detail.email || ''}</p>
            <p>Período {brDate(detail.inicio)} – {brDate(detail.fim)}</p>
            {scheduled ? <p>Status Agendado</p> : null}
            <p>Planos {detail.planos_alvo.map((plan) => plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : plan).join(' e ')}</p>
            <p>Espaços {detail.slots.map((slot) => slot === 'faixa' ? 'Faixa no Início' : slot === 'tela_cheia' || slot === 'tela cheia' ? 'Tela cheia (só Free)' : slot).join(' · ')}</p>
            <p>Valor {detail.valor_centavos != null ? (detail.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}{detail.parcelas ? ` · ${detail.parcelas}× via ${detail.forma_pagamento === 'pix' ? 'Pix' : detail.forma_pagamento === 'boleto' ? 'boleto' : 'transferência'}` : ''}{detail.dia_vencimento ? `, dia ${String(detail.dia_vencimento).padStart(2, '0')}` : ''}</p>
          </div>
        ) : null}
        {documentView?.versao ? <p className="fp-flow-note">✓ Contrato gerado em {documentView.gerado_em ? brDate(documentView.gerado_em) : ''} · versão {documentView.versao}</p> : null}
        {documentView && documentView.versao && !documentView.atual ? <p className="fp-field-error">Os dados mudaram, gere a versão {documentView.versao + 1}.</p> : null}
        {error ? <p className="fp-field-error">{error}</p> : null}
        <div className="fp-flow-actions">
          <Button type="button" variant="secondary" onClick={onBack}>Voltar</Button>
          <Button type="button" variant="secondary" onClick={() => void generate()} disabled={Boolean(busy)}>{busy === 'Gerando…' ? 'Salvando…' : 'Gerar contrato'}</Button>
          <Button type="button" variant="secondary" onClick={() => void downloadContract(contractId)} disabled={!documentView?.versao}>Baixar contrato (PDF)</Button>
          <Button type="button" onClick={() => void publish()} disabled={!ready || Boolean(busy)}>Colocar no ar</Button>
        </div>
        <p className="fp-mkt-note">{scheduled ? 'A data de início é futura. Ao colocar no ar, fica agendado e entra sozinho nesse dia.' : 'Ao colocar no ar, o contrato fica ativo e vence sozinho na data final.'}</p>
      </section>
      <article className="fp-contract-preview" aria-label="Prévia do contrato">
        {(documentView?.texto || 'Gere o contrato para ver a primeira página.').split('\n').slice(0, 28).map((line, index) => (
          <p key={index}>{detail?.nome && line.includes(detail.nome) ? <>{line.split(detail.nome)[0]}<mark>{detail.nome}</mark>{line.split(detail.nome).slice(1).join(detail.nome)}</> : line}</p>
        ))}
      </article>
    </div>
  );
}
