const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';

export type BoardRow = {
  sponsor_id: string;
  nome: string;
  categoria: string;
  cidade: string;
  ativo: boolean;
  contract_id: string | null;
  inicio: string | null;
  fim: string | null;
  planos_alvo: string[] | null;
  slots: string[] | null;
  status: string | null;
};

export type Summary = {
  patrocinadores_ativos: number;
  patrocinadores_total: number;
  vencendo_7: number;
  mes_nome: string;
  exibicoes: number;
  cliques: number;
  ctr: number;
  mes_anterior_nome: string;
  ctr_anterior: number | null;
};

export type Creative = {
  id: string;
  tipo: 'imagem' | 'video';
  slot: 'faixa' | 'tela_cheia';
  media_url: string;
  link_destino: string;
  titulo: string;
  texto_alt: string;
  ativo: boolean;
  ordem: number;
};

export type ContractDetail = {
  id: string;
  sponsor_id: string;
  nome: string;
  categoria: string;
  cidade: string;
  contato_nome: string | null;
  inicio: string;
  fim: string;
  planos_alvo: Array<'free' | 'pro'>;
  slots: Array<'faixa' | 'tela_cheia'>;
  status: string;
  creatives: Creative[];
};

export type Sponsor = {
  id: string;
  nome: string;
  categoria: string;
  cidade: string;
  contato_nome: string | null;
  ativo: boolean;
};

async function readBody(res: Response): Promise<{ error?: { message?: string } } | null> {
  try {
    return (await res.json()) as { error?: { message?: string } };
  } catch {
    return null;
  }
}

export async function sponsorFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/admin/sponsors${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await readBody(res);
  if (!res.ok) throw new Error(data?.error?.message || 'Não consegui falar com o servidor.');
  return data as T;
}

export async function downloadReport(id: string, from: string, to: string) {
  const res = await fetch(
    `${API_URL}/admin/sponsors/contracts/${id}/report.pdf?from=${from}&to=${to}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error('Não consegui gerar o PDF.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'resultados.pdf';
  link.click();
  URL.revokeObjectURL(url);
}
