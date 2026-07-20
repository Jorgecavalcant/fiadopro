import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { InboxItem, fetchInbox, approveTransaction, rejectTransaction } from '../services/syncService';

interface InboxAprovacoesProps {
  formatCurrency: (v: number) => string;
  onChanged: () => void;
}

const typeLabel: Record<string, string> = {
  DEBT: 'Despesa lançada contra você',
  PAYMENT: 'Pagamento registrado',
  REFUND: 'Reembolso',
  ABATIMENTO: 'Abatimento',
};

/**
 * Lançamentos PENDING contra MIM (sou o usuário vinculado do cliente).
 * Ex.: Jorge lançou uma despesa para o Dyllan — aparece aqui para o
 * Dyllan aprovar ou recusar.
 */
export default function InboxAprovacoes({ formatCurrency, onChanged }: InboxAprovacoesProps) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setItems(await fetchInbox());
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const decide = async (id: string, approve: boolean, note?: string) => {
    setBusyId(id);
    const ok = approve ? await approveTransaction(id) : await rejectTransaction(id, note);
    setBusyId(null);
    setRejectingId(null);
    setRejectNote('');
    if (ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      onChanged();
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">Aprovações pendentes</h2>
        <button
          onClick={() => void reload()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          title="Atualizar"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {loading && <p className="text-slate-500 text-sm">Carregando…</p>}

      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Clock size={40} className="mx-auto mb-3" />
          <p>Nenhum lançamento aguardando sua aprovação.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {typeLabel[item.type] ?? item.type} por <span className="text-indigo-600">{item.owner_name}</span>
                </p>
                <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(Number(item.amount))}</p>
                {item.description && <p className="text-sm text-slate-500 mt-1">{item.description}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(item.occurred_at).toLocaleDateString('pt-BR')}
                  {item.due_date ? ` · vence ${new Date(item.due_date).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
            </div>

            {rejectingId === item.id ? (
              <div className="mt-3 space-y-2">
                <input
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Motivo da recusa (opcional)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  maxLength={500}
                />
                <div className="flex gap-2">
                  <button
                    disabled={busyId === item.id}
                    onClick={() => void decide(item.id, false, rejectNote || undefined)}
                    className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Confirmar recusa
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    className="flex-1 bg-slate-100 text-slate-600 rounded-lg py-2 text-sm font-semibold"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <button
                  disabled={busyId === item.id}
                  onClick={() => void decide(item.id, true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <CheckCircle size={16} /> Aprovar
                </button>
                <button
                  disabled={busyId === item.id}
                  onClick={() => setRejectingId(item.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <XCircle size={16} /> Recusar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
