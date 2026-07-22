import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Search, Paperclip, X, Send } from 'lucide-react';
import {
  Counterpart,
  CounterpartTransaction,
  fetchCounterpartTransactions,
  createCounterpartPayment,
} from '../services/syncService';

interface CounterpartDetailProps {
  counterpart: Counterpart;
  formatCurrency: (v: number) => string;
  onBack: () => void;
  onChanged: () => void;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const STATUS_LABEL: Record<CounterpartTransaction['status'], { label: string; className: string }> = {
  CONFIRMED: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-700' },
  PENDING: { label: 'Aguardando aprovação', className: 'bg-amber-100 text-amber-700' },
  REJECTED: { label: 'Recusado', className: 'bg-red-100 text-red-700' },
};

const TYPE_LABEL: Record<CounterpartTransaction['type'], string> = {
  DEBT: 'Dívida',
  PAYMENT: 'Pagamento',
  REFUND: 'Devolução',
  ABATIMENTO: 'Abatimento',
};

export default function CounterpartDetail({ counterpart, formatCurrency, onBack, onChanged }: CounterpartDetailProps) {
  const [transactions, setTransactions] = useState<CounterpartTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    setTransactions(await fetchCounterpartTransactions(counterpart.customer_id));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counterpart.customer_id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter((t) => t.description.toLowerCase().includes(term));
  }, [transactions, search]);

  const openDebts = transactions.filter((t) => t.type === 'DEBT' && t.status !== 'REJECTED');

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lancamentos-${counterpart.owner_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800">{counterpart.owner_name}</h2>
          <p className="text-sm text-slate-500">
            Saldo: <span className="font-bold">{formatCurrency(Number(counterpart.balance))}</span>
          </p>
        </div>
        <button onClick={handleExport} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Exportar">
          <Download size={18} />
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lançamento..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium outline-none"
          />
        </div>
        <button
          onClick={() => setIsPayModalOpen(true)}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-black text-sm shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
        >
          Realizar Pagamento
        </button>
      </div>

      {loading && <p className="text-slate-500 text-sm">Carregando…</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-slate-400 py-12">Nenhum lançamento encontrado.</p>
      )}

      <div className="space-y-2">
        {filtered.map((t) => {
          const status = STATUS_LABEL[t.status];
          return (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{t.description || TYPE_LABEL[t.type]}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {TYPE_LABEL[t.type]} · {new Date(t.occurred_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-700">{formatCurrency(Number(t.amount))}</p>
                  <span className={`inline-block mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              </div>
              {t.attachment && (
                <p className="text-xs text-indigo-500 mt-2 flex items-center gap-1">
                  <Paperclip size={12} /> Comprovante anexado
                </p>
              )}
            </div>
          );
        })}
      </div>

      {isPayModalOpen && (
        <PaymentModal
          openDebts={openDebts}
          onClose={() => setIsPayModalOpen(false)}
          onSubmit={async (payload) => {
            const ok = await createCounterpartPayment(counterpart.customer_id, payload);
            if (ok) {
              setIsPayModalOpen(false);
              await reload();
              onChanged();
            }
            return ok;
          }}
        />
      )}
    </div>
  );
}

interface PaymentModalProps {
  openDebts: CounterpartTransaction[];
  onClose: () => void;
  onSubmit: (payload: {
    amount: number;
    description: string;
    payment_method: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'COMPENSATION';
    attachment?: { data: string; mimeType: string; name: string } | null;
    applies_to_transaction_id: string | null;
  }) => Promise<boolean>;
}

function PaymentModal({ openDebts, onClose, onSubmit }: PaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'COMPENSATION'>('PIX');
  const [reference, setReference] = useState<string>('');
  const [attachment, setAttachment] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError('Comprovante muito grande (máx. 10MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachment({ data: ev.target?.result as string, mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    setError('');
    setSubmitting(true);
    const ok = await onSubmit({
      amount: value,
      description: description || 'Pagamento',
      payment_method: paymentMethod,
      attachment,
      applies_to_transaction_id: reference || null,
    });
    setSubmitting(false);
    if (!ok) setError('Não foi possível registrar o pagamento. Tente novamente.');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'flex-end' }}>
      <div className="bg-white w-full rounded-t-[2.5rem] p-6 md:max-w-lg md:mx-auto animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-slate-800">Realizar Pagamento</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Valor (R$)</label>
            <input
              required
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-2xl font-black"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Pagamento via Pix"
              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl font-bold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Referente a</label>
            <select
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
            >
              <option value="">Pagamento avulso (contra o saldo total)</option>
              {openDebts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.description || 'Dívida'} — {new Date(d.occurred_at).toLocaleDateString('pt-BR')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Forma de Pagamento</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold"
            >
              <option value="PIX">Pix</option>
              <option value="CREDIT_CARD">Cartão Crédito</option>
              <option value="DEBIT_CARD">Cartão Débito</option>
              <option value="COMPENSATION">Compensação</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
              Comprovante (opcional)
            </label>
            <label className="flex items-center gap-2 bg-slate-100 text-slate-700 px-5 py-3 rounded-2xl font-bold text-sm cursor-pointer hover:bg-slate-200 transition-all w-fit">
              <Paperclip size={16} /> {attachment ? attachment.name : 'Anexar comprovante'}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <Send size={18} /> {submitting ? 'Enviando...' : 'Enviar Pagamento'}
          </button>
          <p className="text-xs text-slate-400 text-center">
            O comerciante será notificado e precisa aprovar este pagamento.
          </p>
        </form>
      </div>
    </div>
  );
}
