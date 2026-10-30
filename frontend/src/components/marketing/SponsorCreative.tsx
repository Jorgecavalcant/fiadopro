import { useState } from 'react';
import { X } from 'lucide-react';
import { linkProblem } from './sponsorLink';

export const SPONSOR_STRIP_PX = { width: 358, height: 132 };
export const SPONSOR_FULL_PX = { width: 390, height: 844 };

function Art({
  tipo,
  mediaUrl,
  alt,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
}) {
  const [broken, setBroken] = useState(false);
  const safe = mediaUrl.trim() !== '' && linkProblem(mediaUrl) === null;
  if (!safe || broken) {
    return <p className="fp-sponsor-fallback">Não consegui carregar a arte, confira o link</p>;
  }
  if (tipo === 'video') {
    return <video className="fp-sponsor-art" src={mediaUrl} muted playsInline onError={() => setBroken(true)} />;
  }
  return <img className="fp-sponsor-art" src={mediaUrl} alt={alt || ''} onError={() => setBroken(true)} />;
}

function More({ href }: { href: string }) {
  const safe = linkProblem(href) === null ? href.trim() : '';
  if (!safe) return <span className="fp-sponsor-cta">Saiba mais</span>;
  return (
    <a className="fp-sponsor-cta" href={safe} target="_blank" rel="noopener noreferrer">
      Saiba mais
    </a>
  );
}

export function SponsorStrip({
  tipo,
  mediaUrl,
  alt,
  href,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
  href: string;
}) {
  return (
    <article className="fp-sponsor-strip" aria-label="Prévia da faixa">
      <Art key={mediaUrl} tipo={tipo} mediaUrl={mediaUrl} alt={alt} />
      <span className="fp-sponsor-badge">Patrocinado</span>
      <span className="fp-sponsor-fade" />
      <More href={href} />
    </article>
  );
}

export function SponsorFullscreen({
  tipo,
  mediaUrl,
  alt,
  href,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
  href: string;
}) {
  return (
    <article className="fp-sponsor-full" aria-label="Prévia da tela cheia">
      <Art key={mediaUrl} tipo={tipo} mediaUrl={mediaUrl} alt={alt} />
      <span className="fp-sponsor-badge">Patrocinado</span>
      <button type="button" className="fp-sponsor-close" aria-label="Fechar">
        <X size={16} />
      </button>
      <span className="fp-sponsor-fade" />
      <More href={href} />
    </article>
  );
}
