/**
 * Cache local de dados de negócio (clientes, lançamentos, etc.).
 * Preferências inofensivas (idioma em STORAGE_KEY, esconder valores) ficam de fora.
 */

export const STORAGE_KEY = 'fiado_pro_data_v14';
export const MIGRATED_FLAG = 'fiado_pro_migrated_v1';
export const DATA_EPOCH_KEY = 'fiado_pro_data_epoch';

export type StoredUserIdentity = { id?: string; email?: string };

/** Lê id/e-mail do usuário gravado no STORAGE_KEY (sem carregar o restante). */
export function readStoredUserIdentity(): StoredUserIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { user?: StoredUserIdentity | null };
    if (!data.user || typeof data.user !== 'object') return null;
    return {
      id: typeof data.user.id === 'string' ? data.user.id : undefined,
      email: typeof data.user.email === 'string' ? data.user.email : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * True quando o cache tem um usuário e ele não é o que acabou de entrar
 * (id ou e-mail divergente). Cache sem usuário → não é mismatch.
 */
export function isStoredUserMismatch(incoming: {
  id: string;
  email?: string | null;
}): boolean {
  const stored = readStoredUserIdentity();
  if (!stored?.id && !stored?.email) return false;
  if (stored.id && stored.id !== incoming.id) return true;
  if (
    stored.email &&
    incoming.email &&
    stored.email.trim().toLowerCase() !== incoming.email.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Apaga dados de negócio do localStorage e a flag de import.
 * Mantém idioma no STORAGE_KEY (e deixa HIDE_KEY intacta — chave separada).
 * @param clearEpoch — true no logout/mismatch de usuário; false após bump de
 *   data_epoch (o bootstrap já gravou o epoch novo e não pode perdê-lo).
 */
export function clearBusinessLocalCache(options?: { clearEpoch?: boolean }): void {
  let language: string | undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { language?: string };
      if (typeof data.language === 'string') language = data.language;
    }
  } catch {
    /* ignore */
  }

  if (options?.clearEpoch === false) {
    // Bootstrap já gravou epoch + migrated; só limpa o STORAGE_KEY de negócio.
    localStorage.setItem(MIGRATED_FLAG, '1');
  } else {
    localStorage.removeItem(MIGRATED_FLAG);
    localStorage.removeItem(DATA_EPOCH_KEY);
  }

  if (language) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ language }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
