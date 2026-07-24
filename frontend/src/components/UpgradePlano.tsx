import React, { useCallback, useEffect, useState } from 'react';
import { Crown, CheckCircle2, Loader2, RefreshCcw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';

type PlanName = 'FREE' | 'PRO' | 'ADMIN';

interface BillingStatus {
  plan: PlanName;
  status: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  canCancel: boolean;
  maxReportMonths: number;
}

const PRO_BENEFITS = [
  'Relatórios de até 12 meses (vs. 6 no gratuito)',
  'Análise de IA por cliente',
  'Sem anúncios',
  'Suporte prioritário',
];

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
};

const onlyDigits = (v: string): string => v.replace(/\D/g, '');

/**
 * Componente de assinatura do Plano PRO via Asaas.
 * Consulta /api/billing/status e permite assinar via /api/billing/subscribe,
 * abrindo o link de pagamento (invoiceUrl) em nova aba.
 */
const UpgradePlano: React.FC = () => {
  const [statusData, setStatusData] = useState<BillingStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCpf, setNeedsCpf] = useState(false);
  const [cpf, setCpf] = useState('');

  const loadStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/billing/status`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Não foi possível consultar o plano.');
      }
      setStatusData({
        plan: data.plan,
        status: data.status,
        currentPeriodEnd: data.currentPeriodEnd,
        canceledAt: data.canceledAt,
        canCancel: Boolean(data.canCancel),
        maxReportMonths: data.maxReportMonths,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o plano.');
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    setError(null);
    try {
      const body: { cpf?: string } = {};
      if (needsCpf) {
        if (onlyDigits(cpf).length !== 11 && onlyDigits(cpf).length !== 14) {
          setError('Informe um CPF ou CNPJ válido.');
          setIsSubscribing(false);
          return;
        }
        body.cpf = onlyDigits(cpf);
      }

      const res = await fetch(`${API_URL}/billing/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 400 && data.error?.code === 'CPF_REQUIRED') {
        setNeedsCpf(true);
        setError('Para assinar o plano PRO, informe seu CPF ou CNPJ.');
        return;
      }
      if (res.status === 503) {
        setError('Pagamentos ainda não estão disponíveis neste ambiente.');
        return;
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Não foi possível iniciar a assinatura.');
      }

      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank', 'noopener,noreferrer');
      }
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar a assinatura.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!statusData) return;
    const confirmMsg = statusData.currentPeriodEnd
      ? `Tem certeza que deseja cancelar sua assinatura PRO? Você continua com acesso completo até ${formatDate(statusData.currentPeriodEnd)} (fim do período já pago) — depois disso o plano volta para o Gratuito.`
      : 'Tem certeza que deseja cancelar sua assinatura PRO?';
    if (!window.confirm(confirmMsg)) return;

    setIsCanceling(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/billing/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Não foi possível cancelar a assinatura.');
      }
      await loadStatus();
      window.alert(
        data.currentPeriodEnd
          ? `Assinatura cancelada. Você ainda pode usar o plano PRO até ${formatDate(data.currentPeriodEnd)}.`
          : 'Assinatura cancelada.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar a assinatura.');
    } finally {
      setIsCanceling(false);
    }
  };

  const isPro = statusData?.plan === 'PRO' || statusData?.plan === 'ADMIN';

  return (
    <div className="bg-white p-8 rounded-t42lg border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-amber-300 shadow-lg shrink-0">
          <Crown className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Plano PRO</h3>
          <p className="text-sm text-slate-400 font-medium">Assinatura via Asaas</p>
        </div>
      </div>

      {isLoadingStatus && (
        <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando seu plano...
        </div>
      )}

      {!isLoadingStatus && statusData && (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 rounded-2xl p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Plano atual
            </p>
            <p className="text-xl font-black text-slate-800">
              {statusData.plan === 'ADMIN'
                ? 'Administrador'
                : statusData.plan === 'PRO'
                  ? 'PRO'
                  : 'Gratuito'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Relatórios até
            </p>
            <p className="text-sm font-bold text-slate-600">{statusData.maxReportMonths} meses</p>
          </div>
          {statusData.currentPeriodEnd && (
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Válido até
              </p>
              <p className="text-sm font-bold text-slate-600">
                {formatDate(statusData.currentPeriodEnd)}
              </p>
            </div>
          )}
        </div>
      )}

      {!isPro && (
        <>
          <ul className="space-y-2">
            {PRO_BENEFITS.map((benefit) => (
              <li
                key={benefit}
                className="text-sm font-bold text-slate-600 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> {benefit}
              </li>
            ))}
          </ul>

          {needsCpf && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                CPF ou CNPJ
              </label>
              <input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl font-bold"
              />
            </div>
          )}

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <button
            onClick={handleSubscribe}
            disabled={isSubscribing}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Crown className="w-4 h-4" />
            )}
            Assinar PRO
          </button>
        </>
      )}

      {isPro && statusData?.canceledAt && (
        <p className="text-sm font-bold text-amber-600 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Assinatura cancelada — você ainda pode usar o PRO até{' '}
          {formatDate(statusData.currentPeriodEnd)}.
        </p>
      )}

      {isPro && !statusData?.canceledAt && (
        <p className="text-sm font-bold text-emerald-600 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Sua assinatura está ativa.
        </p>
      )}

      {isPro && statusData?.canCancel && !statusData.canceledAt && (
        <button
          onClick={handleCancelSubscription}
          disabled={isCanceling}
          className="w-full flex items-center justify-center gap-2 bg-white border-2 border-red-200 text-red-600 py-3 rounded-2xl font-black text-sm hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
        >
          {isCanceling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Cancelar assinatura
        </button>
      )}

      <button
        onClick={loadStatus}
        disabled={isLoadingStatus}
        className="w-full flex items-center justify-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
      >
        <RefreshCcw className="w-3 h-3" /> Já paguei, verificar novamente
      </button>
    </div>
  );
};

export default UpgradePlano;
