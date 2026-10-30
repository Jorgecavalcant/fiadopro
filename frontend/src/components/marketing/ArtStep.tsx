import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../ui/Button';
import { pageLinkProblem } from './party';
import { SPONSOR_FULL_PX, SPONSOR_STRIP_PX, SponsorFullscreen, SponsorStrip } from './SponsorCreative';
import { sponsorFetch, uploadArt, type Creative } from './sponsorApi';
import { linkProblem } from './sponsorLink';

const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';

export function ArtStep({
  contractId,
  saving,
  onSaving,
  onBack,
  onSaved,
}: {
  contractId: string;
  saving: boolean;
  onSaving: (value: boolean) => void;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [slot, setSlot] = useState<'faixa' | 'tela_cheia'>('faixa');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [size, setSize] = useState('');
  const [link, setLink] = useState('');
  const [alt, setAlt] = useState('');
  const [zoom, setZoom] = useState(1.1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [error, setError] = useState('');
  const [linkHint, setLinkHint] = useState('');
  const recommended = slot === 'faixa' ? SPONSOR_STRIP_PX : SPONSOR_FULL_PX;

  useEffect(() => {
    sponsorFetch<{ contract: { creatives: Creative[] } }>(`/contracts/${contractId}`).then((data) => {
      const current = data.contract.creatives[0];
      if (!current) return;
      setSlot(current.slot);
      setLink(current.link_destino);
      setAlt(current.texto_alt);
      if (current.media_url.startsWith('/api/')) setPreview(`${API_URL.replace(/\/api$/, '')}${current.media_url}`);
      else if (current.media_url) setPreview(current.media_url);
      if (current.zoom) setZoom(current.zoom);
    }).catch(() => undefined);
  }, [contractId]);

  function choose(next: File | null) {
    if (!next) return;
    if (next.size > 2 * 1024 * 1024) {
      setError('A imagem passa de 2 MB.');
      return;
    }
    if (!/image\/(jpeg|png|webp)/.test(next.type) && !/\.(jpe?g|png|webp)$/i.test(next.name)) {
      setError('Envie JPG, PNG ou WebP.');
      return;
    }
    setError('');
    setFile(next);
    const url = URL.createObjectURL(next);
    setPreview(url);
    const image = new Image();
    image.onload = () => {
      const right = image.naturalWidth === recommended.width && image.naturalHeight === recommended.height;
      setSize(right ? `${image.naturalWidth}×${image.naturalHeight} px · ✓ tamanho certo` : `${image.naturalWidth}×${image.naturalHeight} px. O recomendado é ${recommended.width}×${recommended.height} px.`);
    };
    image.src = url;
  }

  function drag(event: ReactPointerEvent) {
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = x;
    const originY = y;
    function move(next: PointerEvent) {
      setX(Math.min(100, Math.max(0, originX + (next.clientX - startX) / 3)));
      setY(Math.min(100, Math.max(0, originY + (next.clientY - startY) / 3)));
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  async function save() {
    const hint = pageLinkProblem(link) || linkProblem(link);
    setLinkHint(hint && !file ? hint : '');
    if (!alt.trim()) {
      setError('Informe o texto alternativo.');
      document.getElementById('art-alt')?.focus();
      return;
    }
    if (linkProblem(link)) {
      setError(linkProblem(link) || 'Confira o link.');
      document.getElementById('art-link')?.focus();
      return;
    }
    if (!file && !preview) {
      setError('Envie a arte ou cole o link de uma imagem.');
      return;
    }
    onSaving(true);
    setError('');
    try {
      if (file) {
        const body = new FormData();
        body.set('arquivo', file);
        body.set('slot', slot);
        body.set('link_destino', link);
        body.set('texto_alt', alt.trim());
        body.set('zoom', String(zoom));
        body.set('x', String(x));
        body.set('y', String(y));
        await uploadArt(contractId, body);
      } else {
        await sponsorFetch(`/contracts/${contractId}/creatives`, {
          method: 'POST',
          body: JSON.stringify({
            tipo: 'imagem',
            slot,
            media_url: preview,
            link_destino: link,
            titulo: alt.trim().slice(0, 80),
            texto_alt: alt.trim(),
            zoom,
            x,
            y,
          }),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar a arte.');
    } finally {
      onSaving(false);
    }
  }

  const frame = { zoom, x, y };
  return (
    <div className="fp-live">
      <form className="fp-flow-card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="fp-flow-head">
          <h3>Arte do anúncio</h3>
          <div className="fp-choice">
            <button type="button" className={slot === 'faixa' ? 'on' : ''} onClick={() => setSlot('faixa')}>Faixa</button>
            <button type="button" className={slot === 'tela_cheia' ? 'on' : ''} onClick={() => setSlot('tela_cheia')}>Tela cheia</button>
          </div>
        </div>
        <p>Tamanho recomendado: faixa {SPONSOR_STRIP_PX.width}×{SPONSOR_STRIP_PX.height} px · tela cheia {SPONSOR_FULL_PX.width}×{SPONSOR_FULL_PX.height} px</p>
        <label className="fp-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files?.[0] || null); }}>
          <input aria-label="Arquivo da arte" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={(event) => choose(event.target.files?.[0] || null)} />
          <span>{file ? file.name : 'Arraste a arte ou clique para escolher · JPG, PNG ou WebP até 2 MB'}</span>
        </label>
        {size ? <p>{size}</p> : null}
        {file ? <button type="button" onClick={() => { setFile(null); setPreview(''); setSize(''); }}>Trocar arquivo</button> : null}
        <label>Zoom {Math.round(zoom * 100)}%<input aria-label="Zoom" type="range" min="100" max="160" value={Math.round(zoom * 100)} onChange={(event) => setZoom(Number(event.target.value) / 100)} /></label>
        <p className="fp-mkt-note">Ajustar posição: arraste a arte na prévia ao lado</p>
        <label>Link de destino<input id="art-link" aria-label="Link de destino" value={link} onChange={(event) => { setLink(event.target.value); setLinkHint(pageLinkProblem(event.target.value) || ''); }} /></label>
        <p className="fp-mkt-note">Site, Instagram ou WhatsApp (wa.me). É para onde a pessoa vai ao tocar em Saiba mais.</p>
        {linkHint ? <p className="fp-field-error">{linkHint}</p> : null}
        <label>ou cole o link de uma imagem<input aria-label="Link da imagem" value={file ? '' : preview} onChange={(event) => { setPreview(event.target.value); setFile(null); setLinkHint(pageLinkProblem(event.target.value) || ''); }} /></label>
        <label>Texto alternativo<input id="art-alt" aria-label="Texto alternativo" value={alt} onChange={(event) => setAlt(event.target.value)} /></label>
        {error ? <p className="fp-field-error">{error}</p> : null}
        <div className="fp-flow-actions">
          <Button type="button" variant="secondary" onClick={onBack}>Voltar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar e continuar'}</Button>
        </div>
      </form>
      <aside>
        <h3>Prévia ao vivo</h3>
        <p className="fp-mkt-note">Muda na hora enquanto você ajusta a arte <span aria-label="ao vivo">ao vivo</span></p>
        <div className="fp-phone" onPointerDown={drag}>
          <p>Olá</p>
          <SponsorStrip tipo="imagem" mediaUrl={preview} alt={alt} href={link || 'https://exemplo.test'} frame={frame} />
          <p>Faixa no Início</p>
        </div>
        <div style={{ width: 140 }}>
          <SponsorFullscreen tipo="imagem" mediaUrl={preview} alt={alt} href={link || 'https://exemplo.test'} frame={frame} />
          <p>Tela cheia (Free)</p>
        </div>
      </aside>
    </div>
  );
}
