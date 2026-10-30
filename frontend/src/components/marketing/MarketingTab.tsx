import { useState } from 'react';
import { MarketingFlow } from './MarketingFlow';
import { MarketingOverview } from './MarketingOverview';
import { MarketingResults } from './MarketingResults';
import type { BoardRow } from './sponsorApi';
import './marketing.css';
import './wizard.css';

type Section = 'geral' | 'contratos' | 'resultados';

export function MarketingTab() {
  const [section, setSection] = useState<Section>('geral');
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function openRow(row: BoardRow) {
    setCreating(false);
    setSponsorId(row.sponsor_id);
    setContractId(row.contract_id);
    setSection('contratos');
  }

  const flow = creating || section === 'contratos';

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
        <MarketingOverview onOpen={openRow} onCreate={() => { setCreating(true); setSponsorId(null); setContractId(null); }} />
      ) : null}
      {flow && (creating || sponsorId) ? (
        <MarketingFlow
          sponsorId={sponsorId}
          contractId={contractId}
          onClose={() => { setCreating(false); setSection('geral'); }}
          onOpen={(nextSponsor, nextContract) => { setSponsorId(nextSponsor); setContractId(nextContract); }}
        />
      ) : null}
      {section === 'contratos' && !creating && !sponsorId ? <p>Escolha um patrocinador na visão geral ou comece um novo.</p> : null}
      {section === 'resultados' && !creating ? <MarketingResults /> : null}
    </div>
  );
}
