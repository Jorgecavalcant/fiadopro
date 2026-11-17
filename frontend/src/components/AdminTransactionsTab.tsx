import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminFetch } from './adminApi';

type Transaction = {
  id: string | number;
  owner_name?: string | null;
  customer_name?: string | null;
  linked_user_name?: string | null;
  type?: string | null;
  status?: string | null;
  amount?: number | string | null;
  created_at?: string | null;
  dono?: string | null;
  cliente?: string | null;
  tipo?: string | null;
  valor?: number | string | null;
  data?: string | null;
};

type TransactionsResponse = {
  success: boolean;
  transactions: Transaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';

  const amount = Number(value);
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : '—';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

export function AdminTransactionsTab() {
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<TransactionsResponse['meta']>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      setLoading(true);
      setError('');

      try {
        const response = await adminFetch<TransactionsResponse>(
          `/transactions?page=${page}&limit=20`,
        );

        if (cancelled) return;

        if (!response.success) {
          throw new Error('Não foi possível carregar as transações.');
        }

        setTransactions(response.transactions ?? []);
        setMeta(response.meta ?? {
          total: 0,
          page,
          limit: 20,
          totalPages: 0,
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar as transações.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = meta.totalPages || 0;

  return (
    <section className="fp-card">
      <div className="fp-card-header">
        <h2>Transações</h2>
        <span>{meta.total} transações</span>
      </div>

      {error && (
        <div className="fp-error" role="alert">
          {error}
        </div>
      )}

      <div className="fp-table-container">
        <table className="fp-table">
          <thead>
            <tr>
              <th>Dono</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Valor</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="fp-table-loading">
                  <Loader2 size={18} className="fp-spinner" aria-hidden="true" />
                  <span>Carregando transações...</span>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="fp-table-empty">
                  Nenhuma transação encontrada.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.dono || transaction.owner_name || '—'}</td>
                  <td>{transaction.cliente || transaction.customer_name || '—'}</td>
                  <td>{transaction.tipo || transaction.type || '—'}</td>
                  <td>{transaction.status || '—'}</td>
                  <td>{formatAmount(transaction.valor ?? transaction.amount)}</td>
                  <td>{formatDate(transaction.data || transaction.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="fp-pagination">
        <button
          type="button"
          className="fp-button fp-button-secondary"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={loading || page <= 1}
        >
          Anterior
        </button>
        <span>
          Página {meta.page || page} de {totalPages}
        </span>
        <button
          type="button"
          className="fp-button fp-button-secondary"
          onClick={() => setPage((current) => current + 1)}
          disabled={loading || totalPages === 0 || page >= totalPages}
        >
          Próxima
        </button>
      </div>
    </section>
  );
}
