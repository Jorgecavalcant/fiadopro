import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
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
  lazy,
  onArtError,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
  frame?: ArtFrame;
  lazy?: boolean;
  onArtError?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const safe = mediaUrl.trim() !== '' && (localArt(mediaUrl) || linkProblem(mediaUrl) === null);
  const page = /instagram\.com|facebook\.com|fb\.com/i.test(mediaUrl);
  useEffect(() => {
    if (!safe) onArtError?.();
  }, [safe, onArtError]);
  if (!safe || broken) {
    if (onArtError) return null;
    return (
      <p className="fp-sponsor-fallback">
        {page ? 'Esse link é de uma página, não de uma imagem. Baixe a arte e envie o arquivo.' : 'Não consegui carregar a arte, confira o link'}
      </p>
    );
  }
  const style = frame
    ? { transform: `scale(${frame.zoom})`, objectPosition: `${frame.x}% ${frame.y}%` }
    : undefined;
  const fail = () => {
    setBroken(true);
    onArtError?.();
  };
  if (tipo === 'video') {
    return <video className="fp-sponsor-art" src={mediaUrl} muted playsInline style={style} onError={fail} />;
  }
  return (
    <img
      className="fp-sponsor-art"
      src={mediaUrl}
      alt={alt || ''}
      width={lazy ? 358 : undefined}
      height={lazy ? 92 : undefined}
      loading={lazy ? 'lazy' : undefined}
      style={style}
      onError={fail}
    />
  );
}

function More({ href, onOpen }: { href: string; onOpen?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const safe = linkProblem(href) === null ? href.trim() : '';
  if (!safe) return <span className="fp-sponsor-cta">Saiba mais</span>;
  return (
    <a className="fp-sponsor-cta" href={safe} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
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
  title,
  sponsor,
  lazy,
  onArtError,
  onOpen,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
  href: string;
  frame?: ArtFrame;
  title?: string;
  sponsor?: string;
  lazy?: boolean;
  onArtError?: () => void;
  onOpen?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const caption = Boolean(title || sponsor);
  return (
    <article className={caption ? 'fp-sponsor-strip captioned' : 'fp-sponsor-strip'} aria-label={caption ? 'Patrocinado' : 'Prévia da faixa'}>
      <Art key={mediaUrl} tipo={tipo} mediaUrl={mediaUrl} alt={alt} frame={frame} lazy={lazy} onArtError={onArtError} />
      <span className="fp-sponsor-badge">Patrocinado</span>
      <span className="fp-sponsor-fade" />
      {caption ? (
        <p className="fp-sponsor-copy">
          {title ? <strong>{title}</strong> : null}
          {sponsor ? <span>{sponsor}</span> : null}
        </p>
      ) : null}
      <More href={href} onOpen={onOpen} />
    </article>
  );
}

export function SponsorFullscreen({
  tipo,
  mediaUrl,
  alt,
  href,
  frame,
  app,
  story,
  lazy,
  onArtError,
  onOpen,
  onClose,
}: {
  tipo: 'imagem' | 'video';
  mediaUrl: string;
  alt: string;
  href: string;
  frame?: ArtFrame;
  app?: boolean;
  story?: ReactNode;
  lazy?: boolean;
  onArtError?: () => void;
  onOpen?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onClose?: () => void;
}) {
  return (
    <article className="fp-sponsor-full" aria-label={app ? 'Anúncio' : 'Prévia da tela cheia'}>
      <Art key={mediaUrl} tipo={tipo} mediaUrl={mediaUrl} alt={alt} frame={frame} lazy={lazy} onArtError={onArtError} />
      <span className="fp-sponsor-badge">Patrocinado</span>
      <button type="button" className="fp-sponsor-close" aria-label={app ? 'Fechar anúncio' : 'Fechar'} onClick={onClose}>
        <X size={app ? 32 : 16} />
      </button>
      <span className="fp-sponsor-fade" />
      {story}
      <More href={href} onOpen={onOpen} />
      {app ? <p className="fp-sponsor-note">Você verá isso no máximo 1 vez por período</p> : null}
    </article>
  );
}
