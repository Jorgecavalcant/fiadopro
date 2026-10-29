import React, { useCallback, useEffect, useState } from 'react';
import { formatBrDateTime } from '../utils/formatBr';
import { adminFetch } from './adminApi';

interface ClosedAccount {
  id: string;
  name: string;
  deleted_at: string;
  days_left: number;
  status: string;
}

interface ClosedDetail extends ClosedAccount {
  purge_after: string | null;
  deleted_reason: string | null;
}

interface ClosedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function formatWhen(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatBrDateTime(date);
}

export const AdminClosedTab: React.FC = () => {
  const [users, setUsers] = useState<ClosedAccount[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<ClosedDetail | null>(null);
  const [target, setTarget] = useState<ClosedAccount | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<{ users: ClosedAccount[]; meta: ClosedMeta }>(
        `/users/closed?page=${page}&limit=20`,
      );
      setUsers(data.users);
      setTotalPages(data.meta.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar as contas encerradas');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    setError('');
    try {
      const data = await adminFetch<{ user: ClosedDetail }>(`/users/closed/${id}`);
      setDetail(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir o detalhe');
    }
  };

  const reactivate = async () => {
    if (!target || note.trim().length < 8 || saving) return;
    setSaving(true);
    setDialogError('');
    try {
      const data = await adminFetch<{ message?: string }>(`/users/${target.id}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() }),
      });
      setTarget(null);
      setNote('');
      setDetail(null);
      await load();
      if (data.message) setError(data.message);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Não foi possível reativar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 font-medium">
        Contas que ainda podem voltar. O nome aparece só com a inicial. E-mail, telefone, CPF e Pix
        não entram nesta lista.
      </p>
      {error && <p className="text-sm font-semibold text-slate-700">{error}</p>}
      <div className="fp-card">
        {loading ? (
          <p className="text-slate-400 font-semibold py-16 text-center">Carregando...</p>
        ) : (
          <table className="fp-table">
            <thead className="hidden sm:table-header-group">
              <tr>
                <th>Nome</th>
                <th>Encerrada</th>
                <th>Prazo</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="block cursor-pointer border-b border-slate-100 sm:table-row"
                  onClick={() => void openDetail(user.id)}
                >
                  <td className="block font-bold text-slate-800 sm:table-cell">{user.name}</td>
                  <td className="block sm:table-cell">{formatWhen(user.deleted_at)}</td>
                  <td className="block sm:table-cell">{user.days_left} dias</td>
                  <td className="block sm:table-cell">
                    <span
                      className={`fp-badge ${user.status === 'Ordem judicial' ? 'fp-badge-danger' : 'fp-badge-warning'}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="block sm:table-cell">
                    <button
                      type="button"
                      className="fp-btn fp-btn-primary w-full shrink-0 sm:w-auto"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDialogError('');
                        setNote('');
                        setTarget(user);
                      }}
                    >
                      Reativar
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 py-10">
                    Nenhuma conta encerrada neste prazo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <div className="fp-card p-5 space-y-2">
          <p className="font-black text-slate-900">{detail.name}</p>
          <p className="text-sm text-slate-600">Encerrada em {formatWhen(detail.deleted_at)}</p>
          <p className="text-sm text-slate-600">
            Exclusão prevista em {formatWhen(detail.purge_after)}
          </p>
          <p className="text-sm text-slate-600">Motivo informado: {detail.deleted_reason || '—'}</p>
          <span
            className={`fp-badge ${detail.status === 'Ordem judicial' ? 'fp-badge-danger' : 'fp-badge-warning'}`}
          >
            {detail.status}
          </span>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm font-semibold text-slate-500">
          <button
            type="button"
            className="fp-btn fp-btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Anterior
          </button>
          <span>
            página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="fp-btn fp-btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </button>
        </div>
      )}

      {target && (
        <div
          className="fp-overlay flex items-center justify-center p-4"
          onClick={() => setTarget(null)}
        >
          <div
            className="fp-modal box-border w-full max-w-md p-6 sm:p-8"
            role="dialog"
            aria-labelledby="reactivate-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="reactivate-title" className="text-lg font-black text-slate-900 mb-2">
              Reativar conta
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {target.name} volta para a mesma conta. A observação fica no registro, sem e-mail,
              telefone, CPF ou Pix.
            </p>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void reactivate();
              }}
            >
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
                  htmlFor="reactivate-note"
                >
                  Observação
                </label>
                <textarea
                  id="reactivate-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="fp-input min-h-24"
                  maxLength={500}
                  required
                  placeholder="Por que esta conta volta"
                />
                <p className="text-xs text-amber-700">
                  Não cole CPF, senha ou chave Pix nesta observação.
                </p>
              </div>
              {dialogError && <p className="text-sm font-semibold text-red-600">{dialogError}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="fp-btn fp-btn-ghost w-full shrink-0 sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={note.trim().length < 8 || saving}
                  className="fp-btn fp-btn-primary w-full shrink-0 disabled:opacity-40 sm:w-auto"
                >
                  Reativar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
