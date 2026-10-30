import { useState } from 'react';
import { X } from 'lucide-react';
import { linkProblem } from './sponsorLink';

export const SPONSOR_STRIP_PX = { width: 358, height: 92 };
export const SPONSOR_FULL_PX = { width: 390, height: 844 };

export type ArtFrame = { zoom: number; x: number; y: number };

function localArt(mediaUrl: string): boolean {
  return mediaUrl.startsWith('blob:') || mediaUrl.startsWith('/api/sponsors/media/');
}

function Art({
  tipo,
  mediaUrl,
  alt,
  frame,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
  frame?: ArtFrame;
}) {
  const [broken, setBroken] = useState(false);
  const safe = mediaUrl.trim() !== '' && (localArt(mediaUrl) || linkProblem(mediaUrl) === null);
  const page = /instagram\.com|facebook\.com|fb\.com/i.test(mediaUrl);
  if (!safe || broken) {
    return (
      <p className="fp-sponsor-fallback">
        {page ? 'Esse link é de uma página, não de uma imagem. Baixe a arte e envie o arquivo.' : 'Não consegui carregar a arte, confira o link'}
      </p>
    );
  }
  const style = frame
    ? { transform: `scale(${frame.zoom})`, objectPosition: `${frame.x}% ${frame.y}%` }
    : undefined;
  if (tipo === 'video') {
    return <video className="fp-sponsor-art" src={mediaUrl} muted playsInline style={style} onError={() => setBroken(true)} />;
  }
  return <img className="fp-sponsor-art" src={mediaUrl} alt={alt || ''} style={style} onError={() => setBroken(true)} />;
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
  frame,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
  href: string;
  frame?: ArtFrame;
}) {
  return (
    <article className="fp-sponsor-strip" aria-label="Prévia da faixa">
      <Art key={mediaUrl} tipo={tipo} mediaUrl={mediaUrl} alt={alt} frame={frame} />
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
  frame,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
  href: string;
  frame?: ArtFrame;
}) {
  return (
    <article className="fp-sponsor-full" aria-label="Prévia da tela cheia">
      <Art key={mediaUrl} tipo={tipo} mediaUrl={mediaUrl} alt={alt} frame={frame} />
      <span className="fp-sponsor-badge">Patrocinado</span>
      <button type="button" className="fp-sponsor-close" aria-label="Fechar">
        <X size={16} />
      </button>
      <span className="fp-sponsor-fade" />
      <More href={href} />
    </article>
  );
}
