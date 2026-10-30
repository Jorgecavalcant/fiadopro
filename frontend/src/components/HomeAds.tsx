import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { SponsorFullscreen, SponsorStrip } from './marketing/SponsorCreative';
import { linkProblem } from './marketing/sponsorLink';
import './marketing/marketing.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';
const SKIP_KEY = 'fiado_skip_fullscreen';
const sent = new Set<string>();

export type AdPlan = 'free' | 'pro' | 'enterprise' | 'admin';

type PublicAd = {
  id: string;
  tipo: 'imagem' | 'video';
  media_url: string;
  link_destino: string;
  titulo: string;
  texto_alt: string;
  patrocinador: string;
};

export function resetSponsorSession() {
  sent.clear();
}

export function skipFullscreenThisSession() {
  try {
    sessionStorage.setItem(SKIP_KEY, '1');
  } catch {
    /* modo privado: a tela cheia fica para a próxima abertura */
  }
}

function held(): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return true;
  }
}

function mediaSrc(url: string): string {
  if (!url.startsWith('/api/')) return url;
  return `${API_URL.replace(/\/api$/, '')}${url}`;
}

function asAd(value: unknown): PublicAd | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const tipo = row.tipo === 'video' ? 'video' : row.tipo === 'imagem' ? 'imagem' : null;
  if (!tipo) return null;
  if (
    typeof row.id !== 'string'
    || typeof row.media_url !== 'string'
    || typeof row.link_destino !== 'string'
    || typeof row.titulo !== 'string'
    || typeof row.texto_alt !== 'string'
    || typeof row.patrocinador !== 'string'
  ) {
    return null;
  }
  return {
    id: row.id,
    tipo,
    media_url: mediaSrc(row.media_url),
    link_destino: row.link_destino,
    titulo: row.titulo,
    texto_alt: row.texto_alt,
    patrocinador: row.patrocinador,
  };
}

async function loadSlot(slot: 'faixa' | 'tela_cheia'): Promise<PublicAd | null> {
  const response = await fetch(`${API_URL}/sponsors/slot?slot=${slot}`, { credentials: 'include' });
  if (!response.ok) return null;
  const body = (await response.json()) as { creative?: unknown };
  return asAd(body.creative);
}

function once(id: string, tipo: 'exibicao' | 'clique'): boolean {
  const key = `${id}|${tipo}`;
  if (sent.has(key)) return false;
  try {
    const stored = `fiado_ad_${key}`;
    if (sessionStorage.getItem(stored) === '1') {
      sent.add(key);
      return false;
    }
    sessionStorage.setItem(stored, '1');
  } catch {
    /* a memória da aba segura a repetição */
  }
  sent.add(key);
  return true;
}

function send(id: string, tipo: 'exibicao' | 'clique') {
  if (!once(id, tipo)) return;
  const body = JSON.stringify({ creative_id: id, tipo });
  void fetch(`${API_URL}/sponsors/event`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => undefined);
}

function nativeClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!Capacitor.isNativePlatform()) return;
  event.preventDefault();
  window.open(href, '_blank', 'noopener,noreferrer');
}

function useSeen(id: string, node: HTMLElement | null) {
  useEffect(() => {
    if (!id || !node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
          observer.disconnect();
          send(id, 'exibicao');
        }
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, node]);
}

export function useHomeAds(plan: AdPlan, flowOpen = false) {
  const [creative, setCreative] = useState<PublicAd | null>(null);
  const [full, setFull] = useState<PublicAd | null>(null);
  const [stripHidden, setStripHidden] = useState(false);
  const [fullHidden, setFullHidden] = useState(false);
  const [closed, setClosed] = useState(false);
  const askedFull = useRef(false);
  const quiet = plan === 'pro';
  const hideStrip = useCallback(() => setStripHidden(true), []);
  const hideFull = useCallback(() => setFullHidden(true), []);
  const dismissFull = useCallback(() => setClosed(true), []);

  useEffect(() => {
    if (plan === 'enterprise' || plan === 'admin') return;
    let stop = false;
    loadSlot('faixa')
      .then((item) => {
        if (!stop) setCreative(item);
      })
      .catch(() => {
        if (!stop) setCreative(null);
      });
    return () => {
      stop = true;
    };
  }, [plan]);

  useEffect(() => {
    if (plan !== 'free' || flowOpen || held() || askedFull.current || closed) return;
    askedFull.current = true;
    loadSlot('tela_cheia')
      .then(setFull)
      .catch(() => setFull(null));
  }, [plan, flowOpen, closed]);

  return {
    creative: stripHidden ? null : creative,
    quiet,
    hideStrip,
    full: plan === 'free' && full && !flowOpen && !closed && !fullHidden ? full : null,
    dismissFull,
    hideFull,
  };
}

function openAd(id: string, href: string, event: MouseEvent<HTMLAnchorElement>) {
  send(id, 'clique');
  if (linkProblem(href) === null) nativeClick(event, href);
}

export function HomeStrip({
  creative,
  quiet,
  onHide,
}: {
  creative: PublicAd;
  quiet: boolean;
  onHide: () => void;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useSeen(creative.id, node);
  const onOpen = (event: MouseEvent<HTMLAnchorElement>) => openAd(creative.id, creative.link_destino, event);
  if (quiet) {
    const href = linkProblem(creative.link_destino) === null ? creative.link_destino : '';
    return (
      <div ref={setNode}>
        <article className="fp-sponsor-quiet" aria-label="Patrocinado">
          <em>PATROCINADO</em>
          <span>{creative.patrocinador} · {creative.titulo}</span>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
              Saiba mais
            </a>
          ) : (
            <span>Saiba mais</span>
          )}
        </article>
      </div>
    );
  }
  return (
    <div ref={setNode}>
      <SponsorStrip
        tipo={creative.tipo}
        mediaUrl={creative.media_url}
        alt={creative.texto_alt}
        href={creative.link_destino}
        title={creative.titulo}
        sponsor={creative.patrocinador}
        lazy
        onArtError={onHide}
        onOpen={onOpen}
      />
    </div>
  );
}

export function HomeFull({
  creative,
  onClose,
  onHide,
}: {
  creative: PublicAd;
  onClose: () => void;
  onHide: () => void;
}) {
  useEffect(() => {
    send(creative.id, 'exibicao');
    const button = document.querySelector('.fp-sponsor-overlay .fp-sponsor-close');
    if (button instanceof HTMLButtonElement) button.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onLeave = () => {
      if (document.visibilityState === 'hidden') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onLeave);
    };
  }, [creative.id, onClose]);

  const story = (
    <p className="fp-sponsor-story">
      <em>{creative.patrocinador}</em>
      <strong>{creative.titulo}</strong>
      {creative.texto_alt !== creative.titulo ? <span>{creative.texto_alt}</span> : null}
    </p>
  );
  return createPortal(
    <div className="fp-sponsor-overlay">
      <SponsorFullscreen
        tipo={creative.tipo}
        mediaUrl={creative.media_url}
        alt={creative.texto_alt}
        href={creative.link_destino}
        app
        lazy
        story={story}
        onClose={onClose}
        onArtError={onHide}
        onOpen={(event) => openAd(creative.id, creative.link_destino, event)}
      />
    </div>,
    document.body,
  );
}
