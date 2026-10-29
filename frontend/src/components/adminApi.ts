const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';

interface ApiEnvelope {
  success?: boolean;
  error?: { message?: string };
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/admin${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  let data: ApiEnvelope | null = null;
  try {
    data = await res.json();
  } catch {
    // corpo vazio ou nao-JSON
  }
  if (!res.ok || !data?.success) {
    throw new Error(data?.error?.message || `Falha na requisição (${res.status})`);
  }
  return data as T;
}

export async function adminDownload(path: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/admin${path}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Falha na requisição (${res.status})`);
  }
  return res.blob();
}
