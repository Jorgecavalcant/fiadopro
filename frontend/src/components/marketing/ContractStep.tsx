import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { sponsorFetch } from './sponsorApi';
import { brDate } from './sponsorLink';

export function ContractStep({
  sponsorId,
  contractId,
  saving,
  onSaving,
  onBack,
  onSaved,
}: {
  sponsorId: string;
  contractId: string | null;
  saving: boolean;
  onSaving: (value: boolean) => void;
  onBack: () => void;
  onSaved: (id: string) => void;
}) {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [free, setFree] = useState(true);
  const [pro, setPro] = useState(true);
  const [faixa, setFaixa] = useState(true);
  const [cheia, setCheia] = useState(false);
  const [valor, setValor] = useState('');
  const [pagamento, setPagamento] = useState<'pix' | 'boleto' | 'transferencia'>('pix');
  const [parcelas, setParcelas] = useState('1');
  const [dia, setDia] = useState('5');
  const [aviso, setAviso] = useState('15');
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!contractId) return;
    sponsorFetch<{ contract: Record<string, unknown> }>(`/contracts/${contractId}`).then((data) => {
      const row = data.contract;
      setInicio(String(row.inicio || '').slice(0, 10));
      setFim(String(row.fim || '').slice(0, 10));
      const plans = (row.planos_alvo as string[]) || [];
      const slots = (row.slots as string[]) || [];
      setFree(plans.includes('free'));
      setPro(plans.includes('pro'));
      setFaixa(slots.includes('faixa'));
      setCheia(slots.includes('tela_cheia'));
      if (row.valor_centavos != null) setValor((Number(row.valor_centavos) / 100).toFixed(2).replace('.', ','));
      if (row.forma_pagamento) setPagamento(row.forma_pagamento as 'pix');
      if (row.parcelas) setParcelas(String(row.parcelas));
      if (row.dia_vencimento) setDia(String(row.dia_vencimento));
      if (row.aviso_previo_dias) setAviso(String(row.aviso_previo_dias));
      setObservacao(String(row.observacao || ''));
    }).catch(() => undefined);
  }, [contractId]);

  async function save() {
    const plans = [free ? 'free' : '', pro ? 'pro' : ''].filter(Boolean);
    const slots = [faixa ? 'faixa' : '', cheia ? 'tela_cheia' : ''].filter(Boolean);
    const cents = Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100);
    if (!inicio || !fim || fim < inicio) {
      setError('Confira as datas.');
      return;
    }
    if (!plans.length || !slots.length || !Number.isFinite(cents) || cents <= 0) {
      setError('Informe os planos, os espaços e o valor.');
      return;
    }
    setError('');
    onSaving(true);
    const body = {
      inicio,
      fim,
      planos_alvo: plans,
      slots,
      valor_centavos: cents,
      forma_pagamento: pagamento,
      parcelas: Number(parcelas),
      dia_vencimento: Number(dia),
      aviso_previo_dias: Number(aviso) || 15,
      observacao: observacao.trim() || null,
    };
    try {
      const data = contractId
        ? await sponsorFetch<{ contract: { id: string } }>(`/contracts/${contractId}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await sponsorFetch<{ contract: { id: string } }>(`/${sponsorId}/contracts`, { method: 'POST', body: JSON.stringify(body) });
      onSaved(data.contract.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar.');
    } finally {
      onSaving(false);
    }
  }

  return (
    <form className="fp-flow-card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <h3>Contrato</h3>
      <div className="fp-flow-grid">
        <label>Início<input aria-label="Início" type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} /></label>
        <label>Fim<input aria-label="Fim" type="date" value={fim} onChange={(event) => setFim(event.target.value)} /></label>
      </div>
      <p>Quem vê</p>
      <div className="fp-choice">
        <button type="button" className={free ? 'on' : ''} onClick={() => setFree((value) => !value)}>Free</button>
        <button type="button" className={pro ? 'on' : ''} onClick={() => setPro((value) => !value)}>Pro</button>
        <button type="button" disabled>Enterprise · sem anúncios</button>
      </div>
      <Switch label="Faixa no Início" checked={faixa} onChange={setFaixa} />
      <p className="fp-mkt-note">Free e Pro · discreta</p>
      <Switch label="Tela cheia" checked={cheia} onChange={setCheia} />
      <p className="fp-mkt-note">Só Free · no máximo 1 por manhã, tarde e noite</p>
      <div className="fp-flow-grid">
        <label>Valor (R$)<input aria-label="Valor" value={valor} onChange={(event) => setValor(event.target.value)} /></label>
        <label>Forma de pagamento<select aria-label="Pagamento" value={pagamento} onChange={(event) => setPagamento(event.target.value as 'pix')}><option value="pix">Pix</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option></select></label>
        <label>Parcelas<input aria-label="Parcelas" value={parcelas} onChange={(event) => setParcelas(event.target.value)} /></label>
        <label>Dia de vencimento<input aria-label="Vencimento" value={dia} onChange={(event) => setDia(event.target.value)} /></label>
        <label>Aviso prévio (dias)<input aria-label="Aviso prévio" value={aviso} onChange={(event) => setAviso(event.target.value)} /></label>
      </div>
      <label>Observação<textarea aria-label="Observação" value={observacao} onChange={(event) => setObservacao(event.target.value)} /></label>
      <p className="fp-mkt-warn">{fim ? `Vence sozinho em ${brDate(fim)}. Só você renova, e a renovação cria um contrato novo.` : 'Vence sozinho na data final. Só você renova, e a renovação cria um contrato novo.'}</p>
      {error ? <p className="fp-field-error">{error}</p> : null}
      <div className="fp-flow-actions">
        <Button type="button" variant="secondary" onClick={onBack}>Voltar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar e continuar'}</Button>
      </div>
    </form>
  );
}
