import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { SponsorFullscreen, SponsorStrip, SPONSOR_FULL_PX, SPONSOR_STRIP_PX } from './SponsorCreative';
import { sponsorFetch, type ContractDetail, type Creative, type Sponsor } from './sponsorApi';
import { addDays, brDate, linkProblem, saoPauloToday } from './sponsorLink';

const STATUS_LABEL: Record<string, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  rascunho: 'Rascunho',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

type Draft = {
  id: string;
  tipo: 'imagem' | 'video';
  slot: 'faixa' | 'tela_cheia';
  media_url: string;
  link_destino: string;
  titulo: string;
  texto_alt: string;
};

const emptyCreative: Draft = {
  id: '',
  tipo: 'imagem',
  slot: 'faixa',
  media_url: '',
  link_destino: '',
  titulo: '',
  texto_alt: '',
};

export function MarketingContract({
  sponsorId,
  contractId,
  onOpenContract,
}: {
  sponsorId: string | null;
  contractId: string | null;
  onOpenContract: (id: string) => void;
}) {
  const today = saoPauloToday();
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [inicio, setInicio] = useState(today);
  const [fim, setFim] = useState(addDays(today, 30));
  const [free, setFree] = useState(true);
  const [pro, setPro] = useState(true);
  const [faixa, setFaixa] = useState(true);
  const [cheia, setCheia] = useState(false);
  const [creative, setCreative] = useState(emptyCreative);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewInicio, setRenewInicio] = useState('');
  const [renewFim, setRenewFim] = useState('');

  async function load(id: string) {
    setLoading(true);
    setError('');
    try {
      const data = await sponsorFetch<{ contract: ContractDetail }>(`/contracts/${id}`);
      const contract = data.contract;
      setDetail(contract);
      setInicio(contract.inicio.slice(0, 10));
      setFim(contract.fim.slice(0, 10));
      setFree(contract.planos_alvo.includes('free'));
      setPro(contract.planos_alvo.includes('pro'));
      setFaixa(contract.slots.includes('faixa'));
      setCheia(contract.slots.includes('tela_cheia'));
      const first = contract.creatives[0];
      setCreative(first ? { ...first } : emptyCreative);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui abrir o contrato.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (contractId) {
      void load(contractId);
      return;
    }
    setDetail(null);
    if (!sponsorId) return;
    sponsorFetch<{ sponsors: Sponsor[] }>('/')
      .then((data) => setSponsor(data.sponsors.find((item) => item.id === sponsorId) || null))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não consegui abrir o patrocinador.'));
  }, [contractId, sponsorId]);

  function plans() {
    return [free ? 'free' : null, pro ? 'pro' : null].filter(Boolean);
  }
  function spaces() {
    return [faixa ? 'faixa' : null, cheia ? 'tela_cheia' : null].filter(Boolean);
  }

  async function saveContract() {
    const problems: Record<string, string> = {};
    if (fim < inicio) problems.fim = 'A data final não pode ser antes do início.';
    if (fim < today) problems.fim = 'A data final já passou.';
    if (plans().length === 0) problems.planos = 'Escolha Free, Pro ou os dois.';
    if (spaces().length === 0) problems.slots = 'Escolha o espaço do anúncio.';
    setFieldError(problems);
    if (Object.keys(problems).length > 0 || !sponsorId) return;
    setError('');
    try {
      const body = { inicio, fim, planos_alvo: plans(), slots: spaces() };
      if (!detail) {
        const created = await sponsorFetch<{ contract: { id: string } }>(`/${sponsorId}/contracts`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (inicio <= today) {
          await sponsorFetch(`/contracts/${created.contract.id}/activate`, { method: 'POST' });
        }
        onOpenContract(created.contract.id);
        return;
      }
      setError('As datas de um contrato no ar não mudam. Para um período novo, espere vencer e renove.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar o contrato.');
    }
  }

  async function act(path: string) {
    if (!detail) return;
    setError('');
    try {
      await sponsorFetch(path, { method: 'POST' });
      await load(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui atualizar o contrato.');
    }
  }

  async function renew() {
    if (!detail) return;
    if (renewFim < renewInicio) {
      setFieldError({ renew: 'A data final não pode ser antes do início.' });
      return;
    }
    setError('');
    try {
      const created = await sponsorFetch<{ contract: { id: string } }>(`/contracts/${detail.id}/renew`, {
        method: 'POST',
        body: JSON.stringify({
          inicio: renewInicio,
          fim: renewFim,
          planos_alvo: detail.planos_alvo,
          slots: detail.slots,
        }),
      });
      setRenewOpen(false);
      onOpenContract(created.contract.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui renovar.');
    }
  }

  async function saveCreative() {
    const problems: Record<string, string> = {};
    if (!creative.titulo.trim()) problems.titulo = 'Informe o título.';
    if (!creative.texto_alt.trim()) problems.texto_alt = 'Informe o texto alternativo.';
    const media = linkProblem(creative.media_url);
    const dest = linkProblem(creative.link_destino);
    if (media) problems.media_url = media;
    if (dest) problems.link_destino = dest;
    if (!detail) return;
    if (!detail.slots.includes(creative.slot)) problems.slot = 'O criativo precisa usar um espaço do contrato.';
    setFieldError(problems);
    if (Object.keys(problems).length > 0) return;
    const body = {
      tipo: creative.tipo,
      slot: creative.slot,
      media_url: creative.media_url.trim(),
      link_destino: creative.link_destino.trim(),
      titulo: creative.titulo.trim(),
      texto_alt: creative.texto_alt.trim(),
    };
    setError('');
    try {
      if (creative.id) {
        await sponsorFetch(`/creatives/${creative.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await sponsorFetch(`/contracts/${detail.id}/creatives`, { method: 'POST', body: JSON.stringify(body) });
      }
      await load(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar o criativo.');
    }
  }

  const name = detail?.nome || sponsor?.nome || 'Patrocinador';
  const status = detail?.status;

  return (
    <div className="fp-mkt">
      {error ? <p className="fp-mkt-banner">{error}</p> : null}
      {loading ? <p className="fp-mkt-loading">Carregando o contrato...</p> : null}
      {!sponsorId && !contractId ? <p className="fp-mkt-empty">Escolha um patrocinador na visão geral.</p> : null}
      {sponsorId || contractId ? (
        <>
          <div className="fp-mkt-toolbar">
            <div>
              <h3>{name} {status ? <span className="fp-badge fp-badge-muted">{STATUS_LABEL[status] || status}</span> : null}</h3>
              {detail ? <p className="fp-mkt-note">Contrato {brDate(detail.inicio)} – {brDate(detail.fim)}{detail.contato_nome ? ` · contato: ${detail.contato_nome}` : ''}</p> : null}
            </div>
            <div className="fp-mkt-actions">
              {status === 'rascunho' ? <Button onClick={() => act(`/contracts/${detail?.id}/activate`)}>Colocar no ar</Button> : null}
              <Button variant="secondary" disabled={status !== 'ativo'} onClick={() => act(`/contracts/${detail?.id}/pause`)}>Pausar</Button>
              <Button variant="secondary" disabled={status !== 'pausado'} onClick={() => act(`/contracts/${detail?.id}/resume`)}>Retomar</Button>
              <Button variant="secondary" disabled={status !== 'vencido'} onClick={() => { setRenewInicio(addDays(detail?.fim || today, 1)); setRenewFim(addDays(detail?.fim || today, 31)); setRenewOpen(true); }}>Renovar</Button>
              <Button variant="danger" disabled={!detail || status === 'cancelado' || status === 'vencido'} onClick={() => setCancelOpen(true)}>Cancelar</Button>
            </div>
          </div>
          <div className="fp-mkt-grid">
            <div className="fp-mkt-form">
              <article className="fp-mkt-panel">
                <h3>Contrato</h3>
                <div className="fp-mkt-dates">
                  <label>Início<input type="date" aria-label="Início" value={inicio} onChange={(event) => setInicio(event.target.value)} disabled={Boolean(detail)} /></label>
                  <label>Fim<input type="date" aria-label="Fim" value={fim} onChange={(event) => setFim(event.target.value)} disabled={Boolean(detail)} /></label>
                </div>
                {fieldError.fim ? <p className="fp-mkt-error">{fieldError.fim}</p> : null}
                <p className="fp-mkt-note">Quem vê</p>
                <div className="fp-mkt-plans">
                  <button type="button" className={`fp-chip${free ? ' on' : ''}`} onClick={() => setFree((value) => !value)} disabled={Boolean(detail)}>Free</button>
                  <button type="button" className={`fp-chip${pro ? ' on' : ''}`} onClick={() => setPro((value) => !value)} disabled={Boolean(detail)}>Pro</button>
                  <button type="button" className="fp-chip" disabled>Enterprise · sem anúncios</button>
                </div>
                {fieldError.planos ? <p className="fp-mkt-error">{fieldError.planos}</p> : null}
                <div className="fp-mkt-switch">
                  <div><strong>Faixa no Início</strong><p className="fp-mkt-note">Free e Pro · discreta</p></div>
                  <Switch checked={faixa} label="Faixa no Início" onChange={(next) => { if (!detail) setFaixa(next); }} />
                </div>
                <div className="fp-mkt-switch">
                  <div><strong>Tela cheia</strong><p className="fp-mkt-note">Só Free · no máximo 1 por manhã, tarde e noite</p></div>
                  <Switch checked={cheia} label="Tela cheia" onChange={(next) => { if (!detail) setCheia(next); }} />
                </div>
                {fieldError.slots ? <p className="fp-mkt-error">{fieldError.slots}</p> : null}
                <p className="fp-mkt-warn">Vence sozinho em {brDate(fim)}. Só você renova, e a renovação cria um contrato novo.</p>
                {!detail ? <Button onClick={() => void saveContract()}>Salvar contrato</Button> : null}
              </article>
              {detail ? (
                <article className="fp-mkt-panel">
                  <div className="fp-mkt-toolbar">
                    <h3>Criativo</h3>
                    <div className="fp-mkt-plans">
                      <button type="button" className={`fp-chip${creative.tipo === 'imagem' ? ' on' : ''}`} onClick={() => setCreative({ ...creative, tipo: 'imagem' })}>Imagem</button>
                      <button type="button" className={`fp-chip${creative.tipo === 'video' ? ' on' : ''}`} onClick={() => setCreative({ ...creative, tipo: 'video' })}>Vídeo</button>
                    </div>
                  </div>
                  {detail.creatives.length > 0 ? (
                    <div className="fp-mkt-plans">
                      {detail.creatives.map((item: Creative) => (
                        <button type="button" key={item.id} className={`fp-chip${creative.id === item.id ? ' on' : ''}`} onClick={() => setCreative({ ...item })}>
                          {item.titulo}
                        </button>
                      ))}
                      <button type="button" className="fp-chip" onClick={() => setCreative(emptyCreative)}>Novo</button>
                    </div>
                  ) : null}
                  {detail.slots.length > 1 ? (
                    <div className="fp-mkt-plans">
                      {detail.slots.includes('faixa') ? <button type="button" className={`fp-chip${creative.slot === 'faixa' ? ' on' : ''}`} onClick={() => setCreative({ ...creative, slot: 'faixa' })}>Faixa</button> : null}
                      {detail.slots.includes('tela_cheia') ? <button type="button" className={`fp-chip${creative.slot === 'tela_cheia' ? ' on' : ''}`} onClick={() => setCreative({ ...creative, slot: 'tela_cheia' })}>Tela cheia</button> : null}
                    </div>
                  ) : null}
                  <label>Título<input aria-label="Título" value={creative.titulo} onChange={(event) => setCreative({ ...creative, titulo: event.target.value })} /></label>
                  {fieldError.titulo ? <p className="fp-mkt-error">{fieldError.titulo}</p> : null}
                  <label>Link da arte (https)<input aria-label="Link da arte" value={creative.media_url} onChange={(event) => setCreative({ ...creative, media_url: event.target.value })} /></label>
                  {fieldError.media_url ? <p className="fp-mkt-error">{fieldError.media_url}</p> : null}
                  <label>Link de destino (https)<input aria-label="Link de destino" value={creative.link_destino} onChange={(event) => setCreative({ ...creative, link_destino: event.target.value })} /></label>
                  {fieldError.link_destino ? <p className="fp-mkt-error">{fieldError.link_destino}</p> : null}
                  <label>Texto alternativo<input aria-label="Texto alternativo" value={creative.texto_alt} onChange={(event) => setCreative({ ...creative, texto_alt: event.target.value })} /></label>
                  {fieldError.texto_alt ? <p className="fp-mkt-error">{fieldError.texto_alt}</p> : null}
                  <p className="fp-mkt-note">Arte da faixa: {SPONSOR_STRIP_PX.width}×{SPONSOR_STRIP_PX.height} px. Tela cheia: {SPONSOR_FULL_PX.width}×{SPONSOR_FULL_PX.height} px.</p>
                  <div className="fp-mkt-actions">
                    <Button variant="secondary" onClick={() => setCreative(emptyCreative)}>Descartar</Button>
                    <Button onClick={() => void saveCreative()}>Salvar criativo</Button>
                  </div>
                </article>
              ) : null}
            </div>
            <aside className="fp-mkt-panel">
              <div className="fp-mkt-toolbar">
                <h3>Prévia no celular</h3>
                <p className="fp-mkt-note">atualiza enquanto você edita</p>
              </div>
              <div className="fp-mkt-preview">
                <div className="fp-phone">
                  <div className="fp-phone-home">
                    <div className="fp-phone-block" />
                    <div className="fp-phone-block" />
                    <SponsorStrip tipo={creative.tipo} mediaUrl={creative.media_url} alt={creative.texto_alt} href={creative.link_destino} />
                  </div>
                  <p>Faixa no Início</p>
                </div>
                <div className="fp-phone">
                  <div className="fp-phone-screen">
                    <SponsorFullscreen tipo={creative.tipo} mediaUrl={creative.media_url} alt={creative.texto_alt} href={creative.link_destino} />
                  </div>
                  <p>Tela cheia (Free)</p>
                </div>
              </div>
            </aside>
          </div>
        </>
      ) : null}
      {cancelOpen ? (
        <div className="fp-mkt-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="fp-mkt-dialog">
            <h3 id="cancel-title">Cancelar este contrato?</h3>
            <p>Ele sai do ar e não volta. Para anunciar de novo, crie uma renovação.</p>
            <div className="fp-mkt-actions">
              <Button variant="secondary" onClick={() => setCancelOpen(false)}>Voltar</Button>
              <Button variant="danger" onClick={() => { setCancelOpen(false); void act(`/contracts/${detail?.id}/cancel`); }}>Cancelar contrato</Button>
            </div>
          </div>
        </div>
      ) : null}
      {renewOpen ? (
        <div className="fp-mkt-modal" role="dialog" aria-modal="true" aria-labelledby="renew-title">
          <div className="fp-mkt-dialog">
            <h3 id="renew-title">Renovar</h3>
            <p>Isso cria um contrato novo. O vencido continua vencido.</p>
            <label>Início<input type="date" aria-label="Início da renovação" value={renewInicio} onChange={(event) => setRenewInicio(event.target.value)} /></label>
            <label>Fim<input type="date" aria-label="Fim da renovação" value={renewFim} onChange={(event) => setRenewFim(event.target.value)} /></label>
            {fieldError.renew ? <p className="fp-mkt-error">{fieldError.renew}</p> : null}
            <div className="fp-mkt-actions">
              <Button variant="secondary" onClick={() => setRenewOpen(false)}>Voltar</Button>
              <Button onClick={() => void renew()}>Criar renovação</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
