export function deletionErrorMessage(data: unknown): string {
  const fallback = 'Não foi possível excluir a conta. Tente de novo.';
  if (!data || typeof data !== 'object') return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function canConfirmDeletion(googleOnly: boolean, value: string): boolean {
  if (googleOnly) return value.trim() === 'CANCELAR';
  return value.length > 0;
}

export async function requestAccountDeletion(
  url: string,
  confirmation: string,
  request: typeof fetch = fetch,
): Promise<string | null> {
  const res = await request(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password: confirmation }),
  });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  const success =
    typeof data === 'object' &&
    data !== null &&
    (data as { success?: boolean }).success === true;
  if (!res.ok || !success) return deletionErrorMessage(data);
  return null;
}
