import React, { useEffect, useState } from 'react';
import { Wallet, MessageCircle, RefreshCw } from 'lucide-react';
import { Counterpart, fetchCounterparts } from '../services/syncService';
import { normalizeWhatsAppPhone } from '../utils/credit';

interface MinhasDividasProps {
  formatCurrency: (v: number) => string;
}

/**
 * Minha visão como CLIENTE de outros usuários: o que devo (saldo positivo)
 * ou tenho a receber (saldo negativo) por comerciante, só com lançamentos
 * confirmados.
 */
export default function MinhasDividas({ formatCurrency }: MinhasDividasProps) {
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    setCounterparts(await fetchCounterparts());
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">Minhas dívidas</h2>
        <button onClick={() => void reload()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Atualizar">
          <RefreshCw size={18} />
        </button>
      </div>

      {loading && <p className="text-slate-500 text-sm">Carregando…</p>}

      {!loading && counterparts.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Wallet size={40} className="mx-auto mb-3" />
          <p>Você ainda não está vinculado como cliente de ninguém.</p>
          <p className="text-xs mt-2">
            Quando alguém cadastrar você (pelo seu telefone ou e-mail), os lançamentos aprovados aparecem aqui.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {counterparts.map((cp) => {
          const balance = Number(cp.balance);
          const devo = balance > 0;
          const wa = cp.owner_phone ? normalizeWhatsAppPhone(cp.owner_phone) : null;
          return (
            <div key={cp.customer_id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <div className="flex justify-between items-center gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{cp.owner_name}</p>
                  <p className={`text-lg font-bold mt-1 ${devo ? 'text-red-600' : balance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {devo
                      ? `Você deve ${formatCurrency(balance)}`
                      : balance < 0
                        ? `A receber ${formatCurrency(-balance)}`
                        : 'Em dia'}
                  </p>
                  {Number(cp.pending_count) > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      {cp.pending_count} lançamento(s) aguardando sua aprovação
                    </p>
                  )}
                </div>
                {wa && (
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 text-sm font-semibold"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                )}
              </div>
              {cp.owner_pix_key && (
                <p className="text-xs text-slate-400 mt-2">
                  PIX para pagamento: <span className="font-mono text-slate-600">{cp.owner_pix_key}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
