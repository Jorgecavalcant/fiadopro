import { useState } from 'react';
import { Button } from '../ui/Button';
import { MarketingContract } from './MarketingContract';
import { MarketingOverview } from './MarketingOverview';
import { MarketingResults } from './MarketingResults';
import { sponsorFetch, type BoardRow } from './sponsorApi';
import { contactProblem } from './sponsorLink';
import './marketing.css';

type Section = 'geral' | 'contratos' | 'resultados';

export function MarketingTab() {
  const [section, setSection] = useState<Section>('geral');
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cidade, setCidade] = useState('');
  const [contato, setContato] = useState('');
  const [formError, setFormError] = useState('');

  function openRow(row: BoardRow) {
    setCreating(false);
    setSponsorId(row.sponsor_id);
    setContractId(row.contract_id);
    setSection('contratos');
  }

  async function saveSponsor() {
    const contact = contactProblem(contato);
    if (!nome.trim() || !categoria.trim() || !cidade.trim()) {
      setFormError('Informe nome, categoria e cidade.');
      return;
    }
    if (contact) {
      setFormError(contact);
      return;
    }
    setFormError('');
    try {
      const data = await sponsorFetch<{ sponsor: { id: string } }>('/', {
        method: 'POST',
        body: JSON.stringify({
          nome: nome.trim(),
          categoria: categoria.trim(),
          cidade: cidade.trim(),
          contato_nome: contato.trim() || null,
        }),
      });
      setSponsorId(data.sponsor.id);
      setContractId(null);
      setCreating(false);
      setSection('contratos');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não consegui salvar o patrocinador.');
    }
  }

  return (
    <div className="fp-mkt">
      <div className="fp-mkt-sub" role="tablist" aria-label="Marketing">
        {([
          ['geral', 'Visão geral'],
          ['contratos', 'Contratos'],
          ['resultados', 'Resultados'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={section === id ? 'on' : ''} onClick={() => { setSection(id); setCreating(false); }}>{label}</button>
        ))}
      </div>
      {section === 'geral' && !creating ? (
        <MarketingOverview onOpen={openRow} onCreate={() => { setCreating(true); setFormError(''); }} />
      ) : null}
      {creating ? (
        <form className="fp-mkt-panel fp-mkt-form" onSubmit={(event) => { event.preventDefault(); void saveSponsor(); }}>
          <h3>Novo patrocinador</h3>
          <label>Nome<input aria-label="Nome" value={nome} onChange={(event) => setNome(event.target.value)} /></label>
          <label>Categoria<input aria-label="Categoria" value={categoria} onChange={(event) => setCategoria(event.target.value)} /></label>
          <label>Cidade<input aria-label="Cidade" value={cidade} onChange={(event) => setCidade(event.target.value)} /></label>
          <label>Contato (só o nome)<input aria-label="Contato" value={contato} onChange={(event) => setContato(event.target.value)} /></label>
          {formError ? <p className="fp-mkt-error">{formError}</p> : null}
          <div className="fp-mkt-actions">
            <Button variant="secondary" onClick={() => setCreating(false)}>Voltar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      ) : null}
      {section === 'contratos' && !creating ? (
        <MarketingContract sponsorId={sponsorId} contractId={contractId} onOpenContract={(id) => { setContractId(id); }} />
      ) : null}
      {section === 'resultados' && !creating ? <MarketingResults /> : null}
    </div>
  );
}
