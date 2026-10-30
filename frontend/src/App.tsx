import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  UserPlus,
  History,
  Sparkles,
  Phone,
  Trash2,
  Users,
  User as UserIcon,
  TrendingUp,
  Crown,
  CheckCircle2,
  Receipt,
  ArrowLeft,
  Share2,
  Wallet,
  XCircle,
  Edit3,
  FileText,
  Printer,
  CheckCircle,
  Loader2,
  RefreshCcw,
  MapPin,
  Mail,
  Filter,
  MessageCircle,
  Bell,
  Download,
  Upload,
  ThumbsUp,
  ThumbsDown,
  ClipboardList,
  Camera,
  Percent,
  Undo2,
} from 'lucide-react';
import {
  AppView,
  Customer,
  Transaction,
  CustomerWithBalance,
  TransactionType,
  Language,
  User,
  BillEvent,
  BillItem,
  Participant,
  PaymentMethod,
  CustomerNote,
  Debt,
  AuditEntry,
  PlanType,
  SubscriptionPlan,
  OwnerExpense,
  UserCredentials,
} from './types';
import Layout from './components/Layout';
import AdminPanel from './components/AdminPanel';
import { adminPanelFor } from './utils/adminAccess';
import UpgradePlano from './components/UpgradePlano';
import FullScreenModal from './components/FullScreenModal';
import DeleteAccountPanels from './components/DeleteAccountPanels';
import { requestAccountDeletion } from './utils/deleteAccountFlow';
import {
  getFinancialAdvice,
  getGeneralBusinessAdvice,
  extractItemsFromInvoice,
} from './services/aiService';
import { translations, Translation } from './translations';
import HelpView from './components/HelpView';
import { MenuView } from './components/MenuView';
import { StatementView } from './components/StatementView';
import { HomePanel } from './components/HomePanel';
import { skipFullscreenThisSession } from './components/HomeAds';
import { CustomerIdentity } from './components/CustomerIdentity';
import { EmptyState } from './components/ui/EmptyState';
import { PageHeader } from './components/ui/PageHeader';
import { IconCircle } from './components/ui/IconCircle';
import { Chip } from './components/ui/Chip';
import { LedgerTitle } from './components/ui/LedgerTitle';
import { ledgerDueText } from './components/ui/ledgerDue';
import { Switch } from './components/ui/Switch';
import { esc } from './utils/escapeHtml';
import { cumulativeThrough, periodRange, periodToReceive, sumConfirmed, type PeriodPreset } from './utils/ledgerPeriod';
import { showQuickFab } from './utils/quickFab';
import { formatPhoneDisplay } from './utils/formatPhoneDisplay';
import { attentionItems } from './utils/attention';
import { SearchField } from './components/ui/SearchField';
import CurrencyInput from './components/CurrencyInput';
import BrDateField from './components/BrDateField';
import SaveButton from './components/SaveButton';
import {
  balanceDirection,
  CreditBalanceNotice,
  CurrentBalanceBanner,
  WholeBalanceButton,
} from './components/BalancePanels';
import ReceivablesListView from './components/ReceivablesListView';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { App as CapacitorApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';
import { hapticMedium, hapticSuccess } from './utils/haptics';
import { showToast } from './utils/toast';
import { canShowCheckout } from './utils/androidStore';
import {
  DuplicateCustomerNotice,
  normalizeCustomerPhone,
} from './components/DuplicateCustomerNotice';
import { planPricesFromStatus, showsFullscreenAd } from './utils/planPrice';
import InboxAprovacoes from './components/InboxAprovacoes';
import MinhasDividas from './components/MinhasDividas';
import AccountClosedConfirm from './components/AccountClosedConfirm';
import {
  bootstrapSync,
  schedulePush,
  resetSyncState,
  fetchInbox,
  resendTransaction,
  cancelTransaction,
  saveCustomerToServer,
  updateProfile,
} from './services/syncService';
import {
  calculateScore,
  balanceSign,
  computeRawBalance,
  buildChargeMessage,
  buildWhatsAppUrl,
} from './utils/credit';
import { isOverdueDebt, summarizeOverdue } from './utils/overdue';
import {
  computeItemPrice,
  getItemQuantity,
  getItemUnitPrice,
  planEventSplitRecords,
} from './utils/billSplit';
import {
  amountFieldMessage,
  brDateInputToTimestamp,
  descriptionFieldMessage,
  formatBrDate,
  formatBrDateTime,
  timestampToIsoDate,
} from './utils/formatBr';
import { pastZeroPrompt } from './utils/launchBalance';

function balanceBeforeEdit(rawBalance: number, edited: Transaction | null): number {
  if (!edited || edited.status !== 'CONFIRMED') return rawBalance;
  const cents = Math.round(rawBalance * 100);
  const amount = Math.round(edited.amount * 100);
  return (cents - balanceSign(edited.type) * amount) / 100;
}

const STORAGE_KEY = 'fiado_pro_data_v14';
const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';
// JWT gerenciado via httpOnly cookie
const GOOGLE_CLIENT_ID = '488168583801-r8pvtmis98qq12bonh2h1pkrp0rmt2v5.apps.googleusercontent.com';

const generateId = (): string => crypto.randomUUID();

// Password hashing — PBKDF2 with per-user random salt (100 000 iterations, SHA-256)
// Plan definitions
const PLANS: Record<PlanType, SubscriptionPlan> = {
  FREE: {
    type: 'FREE',
    maxCustomers: 20,
    maxEvents: 15,
    maxParticipantsPerEvent: 20,
    hasAI: false,
    hasAds: false,
    monthlyPrice: 0,
  },
  PRO: {
    type: 'PRO',
    maxCustomers: 500,
    maxEvents: Infinity,
    maxParticipantsPerEvent: 500,
    hasAI: true,
    hasAds: false,
    monthlyPrice: null,
  },
  ENTERPRISE: {
    type: 'ENTERPRISE',
    maxCustomers: Infinity,
    maxEvents: Infinity,
    maxParticipantsPerEvent: 500,
    hasAI: true,
    hasAds: false,
    monthlyPrice: null,
  },
};

// Credit score calculation
const scoreCategory = (score: number, t: any) => {
  if (score >= 800)
    return { label: t.excellent, color: 'text-green-600', bg: 'bg-green-100', bar: 'bg-green-500' };
  if (score >= 600)
    return { label: t.positive, color: 'text-green-500', bg: 'bg-green-50', bar: 'bg-green-400' };
  if (score >= 400)
    return { label: t.risk, color: 'text-amber-600', bg: 'bg-amber-100', bar: 'bg-amber-500' };
  if (score >= 300)
    return {
      label: t.highRisk,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      bar: 'bg-orange-500',
    };
  return { label: t.banned, color: 'text-red-600', bg: 'bg-red-100', bar: 'bg-red-500' };
};

// AdBanner component
const AdBanner = ({ onUpgrade, t }: { onUpgrade: () => void; t: any }) => (
  <div className="w-full bg-amber-50 border-b border-amber-200 flex items-center justify-center h-10 text-xs text-amber-700 font-medium shrink-0 px-4 gap-3">
    <span className="bg-amber-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
      Anúncio
    </span>
    <span className="hidden sm:inline">{t.adBannerText}</span>
    {canShowCheckout() && (
      <button
        onClick={onUpgrade}
        className="text-indigo-600 font-black hover:underline whitespace-nowrap"
      >
        {t.subscribePro}
      </button>
    )}
  </div>
);

// MyExpensesView component
const MyExpensesView = ({
  ownerExpenses,
  setOwnerExpenses,
  formatCurrency,
  t,
}: {
  ownerExpenses: OwnerExpense[];
  setOwnerExpenses: React.Dispatch<React.SetStateAction<OwnerExpense[]>>;
  formatCurrency: (v: number) => string;
  t: any;
}) => {
  const pending = ownerExpenses.filter((e) => !e.isPaid);
  const paid = ownerExpenses.filter((e) => e.isPaid);
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900">{t.myExpenses}</h2>
        <span className="text-sm font-bold text-slate-400">
          {ownerExpenses.length} despesa{ownerExpenses.length !== 1 ? 's' : ''}
        </span>
      </div>
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            {t.ownerExpensePending}
          </h3>
          {pending.map((exp) => (
            <div
              key={exp.id}
              className="bg-white p-6 rounded-3xl border border-amber-200 shadow-sm flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-900 truncate">{exp.description}</p>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  {exp.eventName} · {formatBrDate(exp.date)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-black text-red-600">{formatCurrency(exp.amount)}</p>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Confirmar pagamento de ${formatCurrency(exp.amount)} para ${exp.eventName}?`,
                      )
                    ) {
                      setOwnerExpenses((prev) =>
                        prev.map((e) =>
                          e.id === exp.id ? { ...e, isPaid: true, paidAt: Date.now() } : e,
                        ),
                      );
                    }
                  }}
                  className="mt-2 px-4 py-2 bg-green-600 text-white text-xs font-black rounded-xl hover:bg-green-700 transition-all"
                >
                  {t.payNow}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {paid.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            {t.ownerExpensePaid}
          </h3>
          {paid.map((exp) => (
            <div
              key={exp.id}
              className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between gap-4 opacity-70"
            >
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-700 truncate">{exp.description}</p>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  {exp.eventName} · {formatBrDate(exp.date)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-slate-400">{formatCurrency(exp.amount)}</p>
                <p className="text-xs text-green-600 font-bold mt-1">✓ {t.ownerExpensePaid}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {ownerExpenses.length === 0 && (
        <div className="py-20 text-center text-slate-400">
          <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-bold">Nenhuma despesa pessoal registrada.</p>
          <p className="text-sm mt-1">
            Participe de um evento de divisão de conta para ver sua parte aqui.
          </p>
        </div>
      )}
    </div>
  );
};

// --- Sub-components ---

const DashboardView = ({
  stats,
  formatCurrency,
  setActiveView,
  isPro,
  adPlan,
  flowOpen,
  userName,
  customersWithBalance,
  transactions,
  onNewDebt,
  onReceive,
  onNewCustomer,
  onOpenCustomer,
  onUpgrade,
  canUpgrade,
  language,
  onLanguage,
}: any) => {
  const payable = (customersWithBalance || [])
    .filter((c: { rawBalance: number; overpaymentStrategy?: string }) => c.rawBalance < 0 && c.overpaymentStrategy === 'RETURN')
    .reduce((sum: number, c: { rawBalance: number }) => sum + Math.abs(c.rawBalance), 0);
  const month = sumConfirmed(transactions || [], periodRange('month', Date.now()));
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
  const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <HomePanel
      userName={userName}
      initial={userName}
      formatCurrency={formatCurrency}
      receivable={stats.totalReceivable || 0}
      payable={payable}
      overdue={stats.totalOverdue || 0}
      activeDebtors={stats.activeDebtors || 0}
      onNewDebt={onNewDebt}
      onReceive={onReceive}
      onSplit={() => setActiveView(AppView.SPLIT_BILL)}
      onNewCustomer={onNewCustomer}
      onStatement={() => setActiveView(AppView.STATEMENT)}
      onOpenCustomer={onOpenCustomer}
      onSeeAll={() => setActiveView(AppView.CUSTOMERS)}
      onAvatar={() => setActiveView(AppView.PROFILE)}
      onLanguage={onLanguage}
      language={language}
      isPro={isPro}
      adPlan={adPlan}
      flowOpen={flowOpen}
      canUpgrade={canUpgrade}
      onUpgrade={onUpgrade}
      attention={attentionItems(customersWithBalance || [], transactions || [])}
      monthLabel={label}
      launched={month.debt}
      received={month.payment}
      stillToReceive={periodToReceive(month)}
      evolution={stats.evolutionData || []}
    />
  );
};

type RankingType =
  | 'maiores_devedores'
  | 'maiores_pagadores'
  | 'mais_dias_atraso'
  | 'maior_saldo_atraso'
  | 'menor_score'
  | 'maior_score';

const CustomerManagementView = ({
  customersWithBalance,
  transactions,
  navigateToCustomer,
  formatCurrency,
}: {
  customersWithBalance: any[];
  transactions: any[];
  navigateToCustomer: (id: string) => void;
  formatCurrency: (v: number) => string;
}) => {
  const [activeTab, setActiveTab] = React.useState<'todos' | RankingType>('todos');
  const [search, setSearch] = React.useState('');

  const computed = React.useMemo(() => {
    const paidTotals: Record<string, number> = {};
    const txCount: Record<string, number> = {};
    const oldestDueDates: Record<string, number> = {};
    transactions.forEach((tx: any) => {
      if (tx.status !== 'CONFIRMED') return;
      txCount[tx.customerId] = (txCount[tx.customerId] || 0) + 1;
      if (tx.type === 'PAYMENT')
        paidTotals[tx.customerId] = (paidTotals[tx.customerId] || 0) + tx.amount;
      if (tx.type === 'DEBT' && tx.dueDate) {
        if (!oldestDueDates[tx.customerId] || tx.dueDate < oldestDueDates[tx.customerId]) {
          oldestDueDates[tx.customerId] = tx.dueDate;
        }
      }
    });
    return { paidTotals, txCount, oldestDueDates };
  }, [transactions]);

  const stats = React.useMemo(
    () => ({
      total: customersWithBalance.length,
      withDebt: customersWithBalance.filter((c) => c.rawBalance > 0).length,
      overdue: summarizeOverdue(transactions, customersWithBalance).count,
      creditBalance: customersWithBalance.filter((c) => c.rawBalance < 0).length,
      avgScore: customersWithBalance.length
        ? Math.round(
            customersWithBalance.reduce((s, c) => s + (c.score ?? 700), 0) /
              customersWithBalance.length,
          )
        : 0,
      totalReceivable: customersWithBalance.reduce((s, c) => s + Math.max(0, c.rawBalance), 0),
    }),
    [customersWithBalance],
  );

  const rankingLists = React.useMemo(
    () => ({
      maiores_devedores: [...customersWithBalance]
        .filter((c) => c.rawBalance > 0)
        .sort((a, b) => b.rawBalance - a.rawBalance)
        .slice(0, 10),
      maiores_pagadores: [...customersWithBalance]
        .filter((c) => (computed.paidTotals[c.id] || 0) > 0)
        .sort((a, b) => (computed.paidTotals[b.id] || 0) - (computed.paidTotals[a.id] || 0))
        .slice(0, 10),
      mais_dias_atraso: [...customersWithBalance]
        .filter((c) => c.isOverdue && computed.oldestDueDates[c.id])
        .sort((a, b) => (computed.oldestDueDates[a.id] || 0) - (computed.oldestDueDates[b.id] || 0))
        .slice(0, 10),
      maior_saldo_atraso: [...customersWithBalance]
        .filter((c) => c.isOverdue)
        .sort((a, b) => b.rawBalance - a.rawBalance)
        .slice(0, 10),
      menor_score: [...customersWithBalance]
        .sort((a, b) => (a.score ?? 700) - (b.score ?? 700))
        .slice(0, 10),
      maior_score: [...customersWithBalance]
        .sort((a, b) => (b.score ?? 700) - (a.score ?? 700))
        .slice(0, 10),
    }),
    [customersWithBalance, computed],
  );

  const allFiltered = React.useMemo(
    () =>
      customersWithBalance.filter(
        (c) =>
          !search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone || '').includes(search),
      ),
    [customersWithBalance, search],
  );

  const tabs: { id: 'todos' | RankingType; label: string; badge?: number }[] = [
    { id: 'todos', label: 'Todos os clientes', badge: customersWithBalance.length },
    {
      id: 'maiores_devedores',
      label: 'Maiores Devedores',
      badge: rankingLists.maiores_devedores.length,
    },
    {
      id: 'maiores_pagadores',
      label: 'Maiores Pagadores',
      badge: rankingLists.maiores_pagadores.length,
    },
    { id: 'mais_dias_atraso', label: 'Em Atraso', badge: rankingLists.mais_dias_atraso.length },
    { id: 'menor_score', label: 'Menor pontualidade' },
    { id: 'maior_score', label: 'Maior pontualidade' },
  ];

  const getRankingMetric = (c: any) => {
    if (activeTab === 'maiores_devedores')
      return { label: 'Deve', value: formatCurrency(c.rawBalance), color: '#DC2626' };
    if (activeTab === 'maiores_pagadores')
      return {
        label: 'Pagou',
        value: formatCurrency(computed.paidTotals[c.id] || 0),
        color: '#059669',
      };
    if (activeTab === 'mais_dias_atraso') {
      const days = computed.oldestDueDates[c.id]
        ? Math.floor((Date.now() - computed.oldestDueDates[c.id]) / 86400000)
        : 0;
      return { label: 'Dias', value: `${days}d`, color: '#D97706' };
    }
    if (activeTab === 'maior_saldo_atraso')
      return { label: 'Atraso', value: formatCurrency(c.rawBalance), color: '#DC2626' };
    const score = c.score ?? 700;
    return {
      label: 'Score',
      value: String(score),
      color: score >= 800 ? '#059669' : score >= 600 ? '#D97706' : '#DC2626',
    };
  };

  const scoreBar = (score: number) => {
    const pct = Math.round(score / 10);
    const color = score >= 800 ? '#10B981' : score >= 600 ? '#F59E0B' : '#EF4444';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            flex: 1,
            height: 6,
            background: '#F1F5F9',
            borderRadius: 99,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: color,
              borderRadius: 99,
              transition: 'width 600ms',
            }}
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 32 }}>{score}</span>
      </div>
    );
  };

  const statusBadge = (c: any) => {
    if (c.isOverdue)
      return (
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            background: '#FEE2E2',
            color: '#DC2626',
            padding: '2px 8px',
            borderRadius: 99,
          }}
        >
          Em Atraso
        </span>
      );
    if (c.rawBalance < 0)
      return (
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            background: '#D1FAE5',
            color: '#059669',
            padding: '2px 8px',
            borderRadius: 99,
          }}
        >
          A Pagar
        </span>
      );
    if (c.rawBalance > 0)
      return (
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            background: '#FEF3C7',
            color: '#D97706',
            padding: '2px 8px',
            borderRadius: 99,
          }}
        >
          Devedor
        </span>
      );
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          background: '#F1F5F9',
          color: '#64748B',
          padding: '2px 8px',
          borderRadius: 99,
        }}
      >
        Quitado
      </span>
    );
  };

  const currentRankingList =
    activeTab !== 'todos' ? rankingLists[activeTab as RankingType] || [] : [];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { label: 'Clientes', value: stats.total, color: '#2B2F77', bg: '#ECEDF7' },
          {
            label: 'A Receber',
            value: formatCurrency(stats.totalReceivable),
            color: '#DC2626',
            bg: '#FEF2F2',
          },
          { label: 'Em Atraso', value: stats.overdue, color: '#D97706', bg: '#FFFBEB' },
          {
            label: 'Score Médio',
            value: stats.avgScore,
            color: stats.avgScore >= 700 ? '#059669' : '#D97706',
            bg: '#F0FDF4',
          },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 20, padding: '16px 20px' }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: s.color,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {s.label}
            </p>
            <p style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 13,
              background: activeTab === tab.id ? '#4F46E5' : 'white',
              color: activeTab === tab.id ? 'white' : '#475569',
              boxShadow:
                activeTab === tab.id
                  ? '0 4px 12px rgba(79,70,229,0.3)'
                  : '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'all 150ms',
            }}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 99,
                  fontSize: 10,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : '#EEF2FF',
                  color: activeTab === tab.id ? 'white' : '#6366F1',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TODOS: full customer table */}
      {activeTab === 'todos' && (
        <>
          <div style={{ position: 'relative' }}>
            <Search
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                color: '#94A3B8',
              }}
            />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 40,
                paddingRight: 16,
                paddingTop: 12,
                paddingBottom: 12,
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: 14,
                fontWeight: 600,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {allFiltered.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 0',
                background: 'white',
                borderRadius: 24,
                border: '1px solid #F1F5F9',
              }}
            >
              <Users style={{ width: 48, height: 48, color: '#CBD5E1', margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 800, color: '#5C5C5C' }}>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allFiltered.map((c: any) => {
                const txQty = computed.txCount[c.id] || 0;
                const paid = computed.paidTotals[c.id] || 0;
                return (
                  <div
                    key={c.id}
                    onClick={() => navigateToCustomer(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 18px',
                      background: 'white',
                      borderRadius: 18,
                      border: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#C7D2FE';
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        '0 4px 16px rgba(99,102,241,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#F1F5F9';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: '#ECEDF7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 18,
                        color: '#6366F1',
                        flexShrink: 0,
                      }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                      >
                        <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>
                          {c.name}
                        </span>
                        {statusBadge(c)}
                      </div>
                      <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                          {c.phone ? formatPhoneDisplay(c.phone) : 'Sem telefone'}
                        </span>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                          {txQty} transaç{txQty === 1 ? 'ão' : 'ões'}
                        </span>
                        {paid > 0 && (
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                            Pagou {formatCurrency(paid)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
                      {scoreBar(c.score ?? 700)}
                      {(() => {
                        const sense = balanceDirection(c.rawBalance, formatCurrency);
                        return (
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 900,
                              marginTop: 6,
                              color: sense.color,
                            }}
                          >
                            {sense.text}
                          </p>
                        );
                      })()}
                    </div>
                    <ChevronRight
                      style={{ width: 16, height: 16, color: '#CBD5E1', flexShrink: 0 }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* RANKING tabs */}
      {activeTab !== 'todos' &&
        (currentRankingList.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 0',
              background: 'white',
              borderRadius: 24,
              border: '1px solid #F1F5F9',
            }}
          >
            <TrendingUp
              style={{ width: 48, height: 48, color: '#CBD5E1', margin: '0 auto 12px' }}
            />
            <p style={{ fontWeight: 800, color: '#5C5C5C' }}>Nenhum cliente neste ranking ainda</p>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              Registre transações para ver os rankings
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {currentRankingList.map((c: any, index: number) => {
              const { label, value, color } = getRankingMetric(c);
              const medalBg =
                index === 0
                  ? '#FEF3C7'
                  : index === 1
                    ? '#F1F5F9'
                    : index === 2
                      ? '#FEF3C7'
                      : '#EEF2FF';
              const medalColor =
                index === 0
                  ? '#D97706'
                  : index === 1
                    ? '#64748B'
                    : index === 2
                      ? '#92400E'
                      : '#6366F1';
              return (
                <div
                  key={c.id}
                  onClick={() => navigateToCustomer(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 18px',
                    background: 'white',
                    borderRadius: 18,
                    border: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#C7D2FE';
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 4px 16px rgba(99,102,241,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#F1F5F9';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: medalBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 15,
                      color: medalColor,
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: '#EEF2FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 17,
                      color: '#6366F1',
                      flexShrink: 0,
                    }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontWeight: 800,
                        color: '#0F172A',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                      {c.phone ? formatPhoneDisplay(c.phone) : '—'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {label}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 900, color }}>{value}</p>
                  </div>
                  <ChevronRight
                    style={{ width: 16, height: 16, color: '#CBD5E1', flexShrink: 0 }}
                  />
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
};

const DebtorsListView: React.FC<{
  debts: Debt[];
  setDebts: React.Dispatch<React.SetStateAction<Debt[]>>;
  customers: Customer[];
  events: BillEvent[];
  formatCurrency: (amount: number) => string;
  navigateToCustomer: (id: string) => void;
  t: Translation;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}> = ({
  debts,
  setDebts,
  customers,
  events,
  formatCurrency,
  navigateToCustomer,
  t,
  setTransactions,
}) => {
  const pendingDebts = debts.filter((d) => !d.isPaid);

  const handleMarkAsPaid = (debtId: string) => {
    const debtToMark = pendingDebts.find((d) => d.id === debtId);
    if (!debtToMark) return;

    setDebts((prev) => prev.map((d) => (d.id === debtId ? { ...d, isPaid: true } : d)));

    // Criar uma transação de pagamento correspondente
    setTransactions((prev) => [
      ...prev,
      {
        id: generateId(),
        customerId: debtToMark.customerId,
        amount: debtToMark.amount,
        type: 'PAYMENT',
        description: `${t.paymentFor} ${debtToMark.description}`,
        timestamp: Date.now(),
        eventId: debtToMark.eventId,
        status: 'CONFIRMED',
      },
    ]);
  };

  if (pendingDebts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
        <CheckCircle2 className="w-24 h-24 mb-6" />
        <p className="text-xl font-semibold">{t.noPendingDebts}</p>
        <p className="text-sm text-slate-500 mt-2">{t.allGoodHere}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-slate-900 mb-6">{t.debtorsList}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pendingDebts.map((debt) => {
          const customer = customers.find((c) => c.id === debt.customerId);
          const event = events.find((e) => e.id === debt.eventId);
          return (
            <div
              key={debt.id}
              onClick={() => navigateToCustomer(debt.customerId)}
              className="bg-white p-8 rounded-t42xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  {customer?.name.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {customer?.name || t.unknownCustomer}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    {event?.name || t.unknownEvent}
                  </p>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-50 flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
                    {t.amountDue}
                  </p>
                  <p className={`text-2xl font-black text-rose-500`}>
                    {formatCurrency(debt.amount)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsPaid(debt.id);
                  }}
                  className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> {t.markAsPaid}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SplitBillView = ({
  events,
  setEvents,
  setIsEventModalOpen,
  setSelectedEventId,
  setActiveView,
  formatCurrency,
  t,
  setTransactions,
  setDebts,
}: any) => (
  <div className="fp-flow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <p style={{ margin: 0, fontSize: 13, color: 'var(--fp-muted)', overflowWrap: 'break-word' }}>
      Divida uma conta entre clientes e acompanhe quem já pagou.
    </p>
    <button type="button" className="fp-btn fp-btn-primary fp-btn-block" onClick={() => setIsEventModalOpen(true)}>
      <Plus size={18} strokeWidth={1.5} /> {t.newEvent}
    </button>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.length === 0 ? (
        <EmptyState text="Nenhum evento criado ainda." />
      ) : (
        events.map((event: any) => {
          const total = event.items.reduce((sum: number, i: any) => sum + i.price, 0);
          return (
            <div key={event.id} className="relative group">
              <div
                onClick={() => {
                  setSelectedEventId(event.id);
                  setActiveView(AppView.EVENT_DETAIL);
                }}
                className="fp-list-row"
                style={{ cursor: 'pointer', width: '100%', background: '#fff', border: '1px solid #eaeae5', borderRadius: 16, padding: 12 }}
              >
                <span className="fp-list-grow">
                  <strong>{event.name}</strong>
                  <span>{formatBrDate(event.date)}</span>
                </span>
                <span className="fp-chip">{event.isCompleted ? 'Quitado' : 'Aberto'}</span>
                <strong style={{ fontSize: 15, fontWeight: 600 }}>{formatCurrency(total)}</strong>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      aria-label="Excluir"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(t.confirmDelete)) {
                          setEvents((prev: BillEvent[]) =>
                            prev.filter((ev: BillEvent) => ev.id !== event.id),
                          );
                          setTransactions((prev: Transaction[]) =>
                            prev.filter((tx: Transaction) => tx.eventId !== event.id),
                          );
                          setDebts((prev: Debt[]) => prev.filter((d: Debt) => d.eventId !== event.id));
                        }
                      }}
                      style={{ border: 0, background: 'transparent', color: '#B3261E', padding: 4, cursor: 'pointer' }}
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);

const EventDetailView = ({
  selectedEventId,
  events,
  setEvents,
  setActiveView,
  customers,
  setCustomers,
  transactions,
  setTransactions,
  debts,
  setDebts,
  setOwnerExpenses,
  formatCurrency,
  t,
  user,
  addAuditEntry,
  maxParticipantsPerEvent,
  onParticipantsLimit,
}: any) => {
  const [isScanning, setIsScanning] = useState(false);
  const [participantDropdown, setParticipantDropdown] = useState<string | null>(null);
  const [participantSearch, setParticipantSearch] = useState<Record<string, string>>({});
  const [lastAddedParticipantId, setLastAddedParticipantId] = useState<string | null>(null);
  const participantRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
  const [splitDueDate, setSplitDueDate] = useState('');
  const itemRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const event = events.find((e: any) => e.id === selectedEventId);

  // Foca e rola até o participante recém-criado (adicionado via botão "Adicionar Pessoa").
  useEffect(() => {
    if (!lastAddedParticipantId) return;
    const el = participantRefs.current.get(lastAddedParticipantId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
    setLastAddedParticipantId(null);
  }, [lastAddedParticipantId]);

  // Foca e rola até o item recém-criado (adicionado via botão "Adicionar Item").
  useEffect(() => {
    if (!lastAddedItemId) return;
    const el = itemRefs.current.get(lastAddedItemId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
    setLastAddedItemId(null);
  }, [lastAddedItemId]);

  useEffect(() => {
    setSplitDueDate('');
  }, [selectedEventId]);

  if (!event) return null;

  // Aplica uma edição de conteúdo (itens/participantes) ao evento e marca splitDirty
  // quando o evento já tinha sido confirmado antes (isCompleted) — sinaliza que a
  // divisão precisa ser reconfirmada. Toggle manual de "Quitado/Pendente" (fora daqui)
  // não passa por esta função, então não marca dirty.
  const updateEventContent = (updater: (ev: BillEvent) => BillEvent) => {
    setEvents((prev: BillEvent[]) =>
      prev.map((ev: BillEvent) => {
        if (ev.id !== event.id) return ev;
        const updated = updater(ev);
        return ev.isCompleted ? { ...updated, splitDirty: true } : updated;
      }),
    );
  };

  const calculateShares = () => {
    const result: Record<string, number> = {};
    event.items.forEach((item: any) => {
      if (item.price <= 0) return;
      const itemParticipants = event.participants.filter((p: any) => p.itemIds.includes(item.id));
      if (itemParticipants.length === 0) return;
      const share = item.price / itemParticipants.length;
      itemParticipants.forEach((p: any) => {
        result[p.id] = (result[p.id] || 0) + share;
      });
    });
    return result;
  };

  const shares = calculateShares();
  const totalBill = event.items.reduce((sum: number, item: any) => sum + item.price, 0);

  const handleScanInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert(t.fileTooLarge);
      return;
    }

    setIsScanning(true);
    const inputRef = e.target;
    const reader = new FileReader();
    reader.onload = async (readerEvent) => {
      try {
        const base64 = readerEvent.target?.result as string;
        const items = await extractItemsFromInvoice(base64, file.type);
        if (items && items.length > 0) {
          // A extração de nota fiscal não detecta quantidade — assume 1 por item lido,
          // o usuário ajusta manualmente depois se precisar.
          updateEventContent((ev) => ({
            ...ev,
            items: [
              ...ev.items,
              ...items.map((it: any) => ({
                id: generateId(),
                name: it.name,
                quantity: 1,
                unitPrice: it.price,
                price: it.price,
              })),
            ],
          }));
          alert(t.scanSuccess);
        } else {
          alert(t.scanError);
        }
      } catch {
        alert(t.scanError);
      } finally {
        setIsScanning(false);
        if (inputRef) inputRef.value = '';
      }
    };
    reader.onerror = () => {
      alert(t.scanError);
      setIsScanning(false);
      if (inputRef) inputRef.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handlePrintEvent = () => {
    // Sem noopener/noreferrer: é uma janela de impressão própria (gerada por nós, não
    // um link externo) — com noopener o navegador sempre retorna null de window.open,
    // então a função saía em silêncio sem imprimir nem avisar (bug corrigido aqui).
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Ative popups no navegador para imprimir o recibo do evento.');
      return;
    }

    const itemsList = event.items
      .map((i: any) => {
        const quantity = getItemQuantity(i);
        const unitPrice = getItemUnitPrice(i);
        return `<tr><td>${esc(i.name)}</td><td style="text-align:right">${quantity}</td><td style="text-align:right">${formatCurrency(unitPrice)}</td><td style="text-align:right">${formatCurrency(i.price)}</td></tr>`;
      })
      .join('');
    const participantsList = event.participants
      .map((p: any) => {
        const amount = shares[p.id] || 0;
        const pItems = event.items
          .filter((i: any) => p.itemIds.includes(i.id))
          .map((i: any) => esc(i.name))
          .join(', ');
        return `<tr><td>${esc(p.name)} ${p.isOwner ? '(Eu)' : ''}</td><td>${pItems}</td><td style="text-align:right">${formatCurrency(amount)}</td></tr>`;
      })
      .join('');

    const statusColor = event.isCompleted ? '#10b981' : '#f59e0b';
    const content = `<html><head><title>${esc(event.name)}</title><style>body { font-family: sans-serif; padding: 40px; color: #334155; } table { width: 100%; border-collapse: collapse; margin-bottom: 30px; } th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; } th { font-size: 12px; text-transform: uppercase; color: #94a3b8; } .status { font-weight: bold; color: ${statusColor}; }</style></head><body><h1>${esc(event.name)} <span class="status">[${event.isCompleted ? 'QUITADO' : 'PENDENTE'}]</span></h1><p>Data: ${esc(formatBrDate(event.date))} | Total: ${formatCurrency(totalBill)}</p><h3>Itens Consumidos</h3><table><thead><tr><th>Item</th><th style="text-align:right">Qtd</th><th style="text-align:right">Valor Unit.</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemsList}</tbody></table><h3>Divisão por cliente</h3><table><thead><tr><th>Nome</th><th>Itens</th><th style="text-align:right">Parte</th></tr></thead><tbody>${participantsList}</tbody></table><script>window.onload = () => window.print();</script></body></html>`;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleConfirmSplit = () => {
    if (!confirm(t.confirmSplitQuestion || t.confirmSplit + '?')) return;

    const chosenDue = brDateInputToTimestamp(splitDueDate);
    const wasAlreadyConfirmed = event.isCompleted;
    const newCustomersList: Customer[] = [];
    // Um item por participante com valor a pagar — usado por planEventSplitRecords para
    // decidir se a transação/dívida deste evento deve ser ATUALIZADA (participante já
    // tinha um registro para este evento) ou CRIADA (participante novo no rateio).
    const participantShares: Array<{
      participantId: string;
      customerId: string;
      amount: number;
      description: string;
    }> = [];

    // Processar cada participante
    event.participants.forEach((p: Participant) => {
      if (p.isOwner) return;

      const pName = p.name ? p.name.trim() : '';
      if (!pName) return;

      // Tentar encontrar cliente existente (na lista global ou nos novos desta rodada)
      let targetCustomerId = '';
      // Normalize name for comparison (remove accents, extra spaces, lowercase)
      const normalizeName = (name: string) =>
        name
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ');
      const normalizedPName = normalizeName(pName);
      const existing = customers.find((c: Customer) => normalizeName(c.name) === normalizedPName);
      const newlyCreated = newCustomersList.find(
        (c: Customer) => normalizeName(c.name) === normalizedPName,
      );

      if (existing) {
        targetCustomerId = existing.id;
      } else if (newlyCreated) {
        targetCustomerId = newlyCreated.id;
      } else {
        // Criar novo cliente
        const newId = generateId();
        const newCust: Customer = {
          id: newId,
          name: pName,
          phone: '',
          email: '',
          notes: [],
          createdAt: Date.now(),
          overpaymentStrategy: 'PROFIT',
        };
        newCustomersList.push(newCust);
        targetCustomerId = newId;
      }

      // Calcular valor devido por este participante
      const amount = shares[p.id] || 0;
      if (amount > 0) {
        const itemsNames = event.items
          .filter((i: BillItem) => p.itemIds.includes(i.id))
          .map((i: BillItem) => i.name)
          .join(', ');

        const desc = itemsNames ? `${event.name}: ${itemsNames}` : `${event.name} (Rateio)`;
        participantShares.push({
          participantId: p.id,
          customerId: targetCustomerId,
          amount,
          description: desc,
        });
      }
    });

    // Decide, por participante, se atualiza um registro já existente para este evento
    // (reconfirmação) ou cria um novo — nunca duplica (ver utils/billSplit.ts).
    const txPlan = planEventSplitRecords(participantShares, transactions, event.id);
    const debtPlan = planEventSplitRecords(participantShares, debts, event.id);
    const updatedCustomerIds = new Set(
      txPlan.updates
        .map((u) => transactions.find((tx: Transaction) => tx.id === u.id)?.customerId)
        .filter((id): id is string => Boolean(id)),
    );

    // Atualizar todos os estados
    if (newCustomersList.length > 0) {
      setCustomers((prev: Customer[]) => [...prev, ...newCustomersList]);
    }

    setTransactions((prev: Transaction[]) => {
      const updatesById = new Map(txPlan.updates.map((u) => [u.id, u]));
      const mapped = prev.map((tx) => {
        const upd = updatesById.get(tx.id);
        if (!upd) return tx;
        return {
          ...tx,
          amount: upd.amount,
          description: upd.description,
          ...(chosenDue ? { dueDate: chosenDue } : {}),
        };
      });
      const created: Transaction[] = txPlan.creates.map((c) => ({
        id: generateId(),
        customerId: c.customerId,
        amount: c.amount,
        type: 'DEBT',
        description: c.description,
        timestamp: Date.now(),
        eventId: event.id,
        status: 'CONFIRMED',
        ...(chosenDue ? { dueDate: chosenDue } : {}),
      }));
      return created.length > 0 ? [...mapped, ...created] : mapped;
    });

    setDebts((prev: Debt[]) => {
      const updatesById = new Map(debtPlan.updates.map((u) => [u.id, u]));
      const mapped = prev.map((d) => {
        const upd = updatesById.get(d.id);
        return upd ? { ...d, amount: upd.amount, description: upd.description } : d;
      });
      const created: Debt[] = debtPlan.creates.map((c) => ({
        id: generateId(),
        customerId: c.customerId,
        eventId: event.id,
        amount: c.amount,
        description: c.description,
        createdAt: Date.now(),
        isPaid: false,
      }));
      return created.length > 0 ? [...mapped, ...created] : mapped;
    });

    // Histórico da reconfirmação: só quando o evento já tinha sido confirmado antes e
    // algum participante teve a transação ATUALIZADA (não criada agora pela 1ª vez).
    if (wasAlreadyConfirmed && updatedCustomerIds.size > 0) {
      const noteText = `Divisão atualizada em ${formatBrDate(new Date())}`;
      setCustomers((prev: Customer[]) =>
        prev.map((c) =>
          updatedCustomerIds.has(c.id)
            ? {
                ...c,
                notes: [
                  ...(c.notes || []),
                  { id: generateId(), text: noteText, createdAt: Date.now() },
                ],
              }
            : c,
        ),
      );
      if (addAuditEntry) {
        updatedCustomerIds.forEach((customerId) => {
          addAuditEntry('SPLIT_CONFIRMED', 'CUSTOMER', customerId as string, noteText);
        });
      }
    }

    setEvents((prev: BillEvent[]) =>
      prev.map((e) => (e.id === event.id ? { ...e, isCompleted: true, splitDirty: false } : e)),
    );

    // If owner participating, create (or update, numa reconfirmação) owner expense
    if (event.ownerParticipating) {
      const ownerParticipant = event.participants.find((p: Participant) => p.isOwner);
      if (ownerParticipant) {
        const ownerShare = shares[ownerParticipant.id] || 0;
        if (ownerShare > 0 && setOwnerExpenses) {
          const roundedShare = Math.round(ownerShare * 100) / 100;
          setOwnerExpenses((prev: OwnerExpense[]) => {
            const existingIdx = prev.findIndex((oe) => oe.eventId === event.id);
            if (existingIdx >= 0) {
              return prev.map((oe, idx) =>
                idx === existingIdx ? { ...oe, amount: roundedShare } : oe,
              );
            }
            return [
              ...prev,
              {
                id: generateId(),
                eventId: event.id,
                eventName: event.name,
                amount: roundedShare,
                description: `Minha parte — ${event.name}`,
                date: Date.now(),
                isPaid: false,
              },
            ];
          });
        }
      }
    }

    showToast(t.splitConfirmedSuccess || 'Divisão confirmada! Devedores atualizados.');
    setActiveView(AppView.CUSTOMERS);
  };

  return (
    <div className="fp-flow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        title={event.name}
        badge={
          <button
            type="button"
            className="fp-chip"
            onClick={() =>
              setEvents((prev: BillEvent[]) =>
                prev.map((e) => (e.id === event.id ? { ...e, isCompleted: !e.isCompleted } : e)),
              )
            }
          >
            {event.isCompleted ? 'Quitado' : 'Aberto'}
          </button>
        }
        onBack={() => setActiveView(AppView.SPLIT_BILL)}
        actions={
          <>
            <button type="button" aria-label="Baixar PDF" onClick={handlePrintEvent}>
              <Printer size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Excluir"
              onClick={() => {
                if (confirm(t.confirmDelete)) {
                  setEvents((prev: any) => prev.filter((ev: any) => ev.id !== event.id));
                  setActiveView(AppView.SPLIT_BILL);
                }
              }}
            >
              <Trash2 size={18} strokeWidth={1.5} />
            </button>
          </>
        }
      />
      <div className="fp-card" style={{ padding: 16 }}>
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-12">
          <div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--fp-muted)' }}>{formatBrDate(event.date)}</p>
          </div>
          <div className="md:text-right">
            <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--fp-muted)' }}>
              {t.totalBill}
            </p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{formatCurrency(totalBill)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="flex justify-between items-center gap-2 flex-wrap pb-4 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Receipt className="w-6 h-6 text-indigo-600" /> {t.itemsList}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="fp-btn fp-btn-secondary">
                  {isScanning ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isScanning ? t.thinking : t.scanInvoice}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleScanInvoice}
                    disabled={isScanning}
                  />
                </label>
                <button
                  onClick={() => {
                    const newItemId = generateId();
                    updateEventContent((ev: BillEvent) => ({
                      ...ev,
                      items: [
                        ...ev.items,
                        { id: newItemId, name: '', price: 0, quantity: 1, unitPrice: 0 },
                      ],
                    }));
                    setLastAddedItemId(newItemId);
                  }}
                  className="fp-btn fp-btn-secondary"
                >
                  {t.addItem}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {event.items.map((item: any) => {
                const quantity = getItemQuantity(item);
                const unitPrice = getItemUnitPrice(item);
                return (
                  <div key={item.id} className="fp-item-row">
                    <div className="flex gap-3">
                      <input
                        ref={(el) => {
                          if (el) itemRefs.current.set(item.id, el);
                          else itemRefs.current.delete(item.id);
                        }}
                        value={item.name}
                        onChange={(e) =>
                          updateEventContent((ev: BillEvent) => ({
                            ...ev,
                            items: ev.items.map((i: any) =>
                              i.id === item.id ? { ...i, name: e.target.value } : i,
                            ),
                          }))
                        }
                        placeholder={t.itemName}
                        className="flex-1 px-5 py-3 bg-white border-2 border-[#E4E8F5] rounded-t42md font-bold text-sm outline-none focus:border-[#5967D8]"
                      />
                      <button
                        onClick={() =>
                          updateEventContent((ev: BillEvent) => ({
                            ...ev,
                            items: ev.items.filter((i: any) => i.id !== item.id),
                          }))
                        }
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="flex flex-col">
                        <label className="fp-label">
                          {t.quantity}
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={quantity === 0 ? '' : quantity}
                          onChange={(e) => {
                            const newQuantity = parseFloat(e.target.value) || 0;
                            updateEventContent((ev: BillEvent) => ({
                              ...ev,
                              items: ev.items.map((i: any) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      quantity: newQuantity,
                                      unitPrice: getItemUnitPrice(i),
                                      price: computeItemPrice({
                                        quantity: newQuantity,
                                        unitPrice: getItemUnitPrice(i),
                                        price: i.price,
                                      }),
                                    }
                                  : i,
                              ),
                            }));
                          }}
                          placeholder="1"
                          className="w-16 px-3 py-2 bg-white border-2 border-[#E4E8F5] rounded-t42sm font-black text-sm text-center outline-none focus:border-[#5967D8]"
                        />
                      </div>
                      <div className="relative flex-1">
                        <label className="fp-label">
                          {t.unitPrice}
                        </label>
                        <CurrencyInput
                          aria-label={t.unitPrice}
                          value={unitPrice === 0 ? null : unitPrice}
                          onChange={(next) => {
                            const newUnitPrice = next ?? 0;
                            updateEventContent((ev: BillEvent) => ({
                              ...ev,
                              items: ev.items.map((i: any) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      unitPrice: newUnitPrice,
                                      quantity: getItemQuantity(i),
                                      price: computeItemPrice({
                                        quantity: getItemQuantity(i),
                                        unitPrice: newUnitPrice,
                                        price: i.price,
                                      }),
                                    }
                                  : i,
                              ),
                            }));
                          }}
                          placeholder="R$ 0,00"
                          className="w-full px-4 py-2 bg-white border-2 border-[#E4E8F5] rounded-t42sm font-black text-sm text-right outline-none focus:border-[#5967D8]"
                        />
                      </div>
                      <div className="flex flex-col items-end">
                        <label className="fp-label">
                          {t.itemTotal}
                        </label>
                        <p className="px-2 py-2 font-black text-sm text-indigo-600 whitespace-nowrap">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-8">
            <div className="flex justify-between items-center gap-2 flex-wrap pb-4 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Users className="w-6 h-6 text-emerald-600" /> {t.participants}
              </h3>
              <div className="flex items-center gap-4 flex-wrap">
                <Switch
                  checked={event.ownerParticipating}
                  label={t.ownerParticipating}
                  onChange={(isChecked) => {
                      const participantCeiling = Number(maxParticipantsPerEvent);
                      if (
                        isChecked &&
                        !event.participants.some((p: { isOwner?: boolean }) => p.isOwner) &&
                        Number.isFinite(participantCeiling) &&
                        event.participants.length >= participantCeiling &&
                        onParticipantsLimit
                      ) {
                        onParticipantsLimit();
                        return;
                      }
                      updateEventContent((ev: BillEvent) => {
                        let newParticipants = [...ev.participants];
                        if (isChecked && !newParticipants.some((p) => p.isOwner)) {
                          newParticipants = [
                            {
                              id: generateId(),
                              name: user?.name || 'Eu',
                              itemIds: [],
                              isOwner: true,
                            },
                            ...newParticipants,
                          ];
                        } else if (!isChecked) {
                          newParticipants = newParticipants.filter((p) => !p.isOwner);
                        }
                        return {
                          ...ev,
                          ownerParticipating: isChecked,
                          participants: newParticipants,
                        };
                      });
                    }}
                />
                <button
                  onClick={() => {
                    const participantCeiling = Number(maxParticipantsPerEvent);
                    if (
                      Number.isFinite(participantCeiling) &&
                      event.participants.length >= participantCeiling &&
                      onParticipantsLimit
                    ) {
                      onParticipantsLimit();
                      return;
                    }
                    const newParticipantId = generateId();
                    updateEventContent((ev: BillEvent) => ({
                      ...ev,
                      participants: [
                        ...ev.participants,
                        { id: newParticipantId, name: '', itemIds: [] },
                      ],
                    }));
                    setLastAddedParticipantId(newParticipantId);
                  }}
                  className="fp-btn fp-btn-secondary"
                >
                  {t.addParticipant}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  const allItemIds = event.items.map((item: BillItem) => item.id);
                  if (allItemIds.length === 0 || event.participants.length === 0) return;
                  updateEventContent((ev: BillEvent) => ({
                    ...ev,
                    participants: ev.participants.map((person) => ({
                      ...person,
                      itemIds: allItemIds,
                    })),
                  }));
                }}
                disabled={event.items.length === 0 || event.participants.length === 0}
                className="fp-btn fp-btn-secondary fp-btn-block"
              >
                Dividir igualmente entre todos
              </button>
              <p className="fp-help">
                Toque no nome de cada item, embaixo do cliente, para marcar o que ela consumiu. O
                botão acima marca todos os itens para todos os clientes. Cada item continua dividido
                só entre quem está marcado.
              </p>
            </div>

            <div className="space-y-6">
              {event.participants.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-slate-50 p-6 rounded-t42lg border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-200"
                >
                  <div className="fp-participant">
                    <div className="relative" style={{ minWidth: 0 }}>
                      <textarea
                        rows={2}
                        ref={(el) => {
                          if (el) participantRefs.current.set(p.id, el);
                          else participantRefs.current.delete(p.id);
                        }}
                        value={
                          p.isOwner
                            ? p.name
                            : participantSearch[p.id] !== undefined
                              ? participantSearch[p.id]
                              : p.name
                        }
                        onChange={(e) => {
                          if (p.isOwner) return;
                          const val = e.target.value;
                          setParticipantSearch((prev) => ({ ...prev, [p.id]: val }));
                          setParticipantDropdown(p.id);
                          setEvents((prev: any) =>
                            prev.map((ev: any) =>
                              ev.id === event.id
                                ? {
                                    ...ev,
                                    participants: ev.participants.map((par: any) =>
                                      par.id === p.id ? { ...par, name: val } : par,
                                    ),
                                  }
                                : ev,
                            ),
                          );
                        }}
                        onFocus={() => {
                          if (!p.isOwner) setParticipantDropdown(p.id);
                        }}
                        onBlur={() => setTimeout(() => setParticipantDropdown(null), 150)}
                        placeholder={t.fullName}
                        className="fp-participant-name"
                        disabled={p.isOwner}
                      />
                      {participantDropdown === p.id &&
                        !p.isOwner &&
                        (() => {
                          const query = (participantSearch[p.id] || p.name || '').toLowerCase();
                          const filtered = customers.filter(
                            (c: any) =>
                              c.name.toLowerCase().includes(query) &&
                              !event.participants.some(
                                (par: any) => par.name === c.name && par.id !== p.id,
                              ),
                          );
                          if (filtered.length === 0) return null;
                          return (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'white',
                                borderRadius: 14,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                border: '1px solid #E2E8F0',
                                zIndex: 50,
                                maxHeight: 200,
                                overflowY: 'auto',
                                marginTop: 4,
                              }}
                            >
                              {filtered.map((c: any) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setEvents((prev: any) =>
                                      prev.map((ev: any) =>
                                        ev.id === event.id
                                          ? {
                                              ...ev,
                                              participants: ev.participants.map((par: any) =>
                                                par.id === p.id ? { ...par, name: c.name } : par,
                                              ),
                                            }
                                          : ev,
                                      ),
                                    );
                                    setParticipantSearch((prev) => ({ ...prev, [p.id]: c.name }));
                                    setParticipantDropdown(null);
                                  }}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: '#1E293B',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #F1F5F9',
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = '#EEF2FF')
                                  }
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                >
                                  {c.name}
                                  {c.phone && (
                                    <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>
                                      {formatPhoneDisplay(c.phone)}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                    </div>
                    <div className="fp-participant-share">
                      <p>{t.sharePerPerson}</p>
                      <strong>{formatCurrency(shares[p.id] || 0)}</strong>
                    </div>
                    {!p.isOwner && (
                      <button
                        onClick={() =>
                          updateEventContent((ev: BillEvent) => ({
                            ...ev,
                            participants: ev.participants.filter((par: any) => par.id !== p.id),
                          }))
                        }
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.items.map((it: any) => (
                      <button
                        key={it.id}
                        onClick={() => {
                          updateEventContent((ev: BillEvent) => ({
                            ...ev,
                            participants: ev.participants.map((par: any) => {
                              if (par.id !== p.id) return par;
                              const itemIds = par.itemIds.includes(it.id)
                                ? par.itemIds.filter((id: string) => id !== it.id)
                                : [...par.itemIds, it.id];
                              return { ...par, itemIds };
                            }),
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${p.itemIds.includes(it.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-200'}`}
                      >
                        {it.name || '...'}
                      </button>
                    ))}
                  </div>
                  {p.itemIds.length === 0 && event.items.length > 0 && (
                    <p className="fp-help">
                      Nenhum item marcado para este cliente.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="fp-form-card">
              <h2>Vencimento e confirmação</h2>
              <label htmlFor="split-due-date" className="fp-label">
                Vencimento das dívidas (opcional)
              </label>
              <BrDateField
                id="split-due-date"
                ariaLabel="Vencimento das dívidas"
                value={splitDueDate}
                onChange={setSplitDueDate}
                className="fp-participant-name"
              />
              <p className="fp-help">
                {splitDueDate
                  ? `Vence em ${formatBrDate(splitDueDate)}`
                  : 'Se ficar em branco, a dívida fica sem vencimento.'}
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--fp-muted)' }}>
                Cálculo final
              </p>
              <button
                onClick={handleConfirmSplit}
                disabled={totalBill <= 0 || event.isCompleted}
                className="fp-btn fp-btn-primary fp-btn-block"
              >
                {event.isCompleted
                  ? 'Divisão já confirmada'
                  : t.confirmSplitBtn || 'Confirmar Divisão'}
              </button>
              {event.splitDirty && (
                <button
                  onClick={handleConfirmSplit}
                  className="fp-btn fp-btn-primary fp-btn-block" style={{ marginTop: 12 }}
                >
                  {t.updateSplitBtn || 'Atualizar Divisão'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- InstallmentGroupCard Component ---
interface InstallmentGroup {
  groupId: string;
  baseDescription: string;
  totalInstallments: number;
  installmentValue: number;
  totalAmount: number;
  totalPaid: number;
  interestRate?: number;
  firstDate: number;
  installments: Transaction[];
}

const InstallmentGroupCard = ({
  group,
  formatCurrency,
  t,
  onPayInstallment,
  customerRawBalance = 0,
}: {
  group: InstallmentGroup;
  formatCurrency: (v: number) => string;
  t: any;
  onPayInstallment: (tx: Transaction) => void;
  customerRawBalance?: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isPaidByRunningBalance = (installmentNumber: number): boolean => {
    // Parcelas são quitadas em ordem: 1, 2, 3...
    // A parcela N está paga se o total pago cobre installmentValue * N.
    // Ex: totalPaid=200, installmentValue=100 → parcelas 1 e 2 pagas, parcela 3 pendente.
    // Isso garante que parcelas anteriores sejam sempre quitadas antes das seguintes.
    return group.totalPaid >= group.installmentValue * installmentNumber;
  };

  const getInstallmentStatus = (tx: Transaction) => {
    const isPaid = isPaidByRunningBalance(tx.installmentNumber ?? 0);
    if (isPaid) return 'paid';
    const isOverdue = isOverdueDebt(tx, customerRawBalance);
    return isOverdue ? 'overdue' : 'pending';
  };

  const paidCount = group.installments.filter((tx) => getInstallmentStatus(tx) === 'paid').length;
  const saldo = group.totalAmount - group.totalPaid;

  return (
    <div className="bg-white rounded-t42lg border border-slate-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4 text-left">
          <div className="bg-indigo-50 p-3 rounded-2xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <p className="font-black text-slate-900 text-base">{group.baseDescription}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {group.totalInstallments}x {formatCurrency(group.installmentValue)}
              </span>
              {group.interestRate && group.interestRate > 0 && (
                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  {group.interestRate}% a.m.
                </span>
              )}
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {paidCount}/{group.totalInstallments} {t.installmentStatus_paid || 'Pagas'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-slate-400 uppercase">
              {t.installmentBalance || 'Saldo'}
            </p>
            <p className={`font-black text-lg ${saldo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatCurrency(saldo)}
            </p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase">
                    {t.installmentHeader_number || '#'}
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase">
                    {t.installmentHeader_dueDate || 'Vencimento'}
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-400 uppercase">
                    {t.installmentHeader_amount || 'Valor'}
                  </th>
                  <th className="text-center py-3 px-4 text-[10px] font-black text-slate-400 uppercase">
                    {t.installmentHeader_status || 'Status'}
                  </th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {group.installments.map((tx) => {
                  const status = getInstallmentStatus(tx);
                  const rowClass =
                    status === 'overdue'
                      ? 'border-t border-red-100 bg-red-50/40 hover:bg-red-50/70 transition-colors'
                      : status === 'paid'
                        ? 'border-t border-slate-50 bg-emerald-50/20 hover:bg-emerald-50/40 transition-colors'
                        : 'border-t border-slate-50 hover:bg-slate-50/50 transition-colors';
                  return (
                    <tr key={tx.id} className={rowClass}>
                      <td className="py-3 px-4 font-black text-slate-600">
                        {tx.installmentNumber}
                      </td>
                      <td
                        className={`py-3 px-4 font-bold text-xs ${status === 'overdue' ? 'text-red-600 font-black' : 'text-slate-500'}`}
                      >
                        {tx.dueDate ? formatBrDate(tx.dueDate) : 'Sem vencimento'}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-black ${status === 'overdue' ? 'text-red-700' : 'text-slate-900'}`}
                      >
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {status === 'paid' ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                            {t.installmentStatus_paid || 'Pago'}
                          </span>
                        ) : status === 'overdue' ? (
                          <span className="text-[10px] font-black text-red-700 bg-red-50 px-2 py-1 rounded-full">
                            {t.installmentStatus_overdue || 'Em Atraso'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                            ⏳ {t.installmentStatus_pending || 'Pendente'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {status !== 'paid' && (
                          <button
                            onClick={() => onPayInstallment(tx)}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-black rounded-xl hover:bg-indigo-700 active:scale-95 transition-all whitespace-nowrap"
                          >
                            {t.installmentPay || 'Pagar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100 flex-wrap gap-3">
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">
                  {t.installmentTotal || 'Total'}
                </p>
                <p className="font-black text-slate-900">{formatCurrency(group.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">
                  {t.installmentPaid || 'Pago'}
                </p>
                <p className="font-black text-emerald-600">{formatCurrency(group.totalPaid)}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">
                {t.installmentBalance || 'Saldo'}
              </p>
              <p
                className={`font-black text-lg ${saldo > 0 ? 'text-red-600' : 'text-emerald-600'}`}
              >
                {formatCurrency(Math.max(0, saldo))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- CustomerDetailView Component ---
const CustomerDetailView = ({
  selectedCustomer,
  transactions,
  setTransactions,
  setActiveView,
  setTransactionType,
  setIsTransactionModalOpen,
  handleGetAdvice,
  isAILoading,
  aiAdvice,
  isPro,
  setIsUpgradeModalOpen,
  handleShareWhatsApp,
  deleteCustomer,
  setIsEditCustomerModalOpen,
  setCustomers,
  formatCurrency,
  t,
  setEditTransactionData,
  setIsNotesModalOpen,
  handleUpdateNote,
  editingNoteId,
  setEditingNoteId,
  editingNoteText,
  setEditingNoteText,
  onPayInstallment,
}: any) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerPreset, setLedgerPreset] = useState<'all' | PeriodPreset>('all');
  const [noteText, setNoteText] = useState('');

  // Hooks precisam rodar sempre, na mesma ordem — o early return fica
  // depois deles (react-hooks/rules-of-hooks); por isso o acesso a
  // selectedCustomer aqui dentro é feito com optional chaining.
  const filteredTransactions = useMemo(() => {
    let list = transactions.filter((tx: Transaction) => tx.customerId === selectedCustomer?.id);
    if (ledgerPreset === 'custom') {
      if (startDate) {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        list = list.filter((tx) => tx.timestamp >= start);
      }
      if (endDate) {
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        list = list.filter((tx) => tx.timestamp <= end);
      }
    } else if (ledgerPreset !== 'all') {
      const range = periodRange(ledgerPreset, Date.now());
      list = list.filter((tx) => tx.timestamp >= range.from && tx.timestamp <= range.to);
    }
    return list.sort((a: Transaction, b: Transaction) => b.timestamp - a.timestamp);
  }, [transactions, selectedCustomer?.id, startDate, endDate, ledgerPreset]);

  const installmentGroups = useMemo((): InstallmentGroup[] => {
    const installmentTxs = transactions.filter(
      (tx: Transaction) =>
        tx.customerId === selectedCustomer?.id && tx.installmentGroupId && tx.type === 'DEBT',
    );
    const groups: Record<string, Transaction[]> = {};
    installmentTxs.forEach((tx: Transaction) => {
      const gid = tx.installmentGroupId!;
      if (!groups[gid]) groups[gid] = [];
      groups[gid].push(tx);
    });
    return Object.entries(groups).map(([groupId, txs]) => {
      const sorted = [...txs].sort(
        (a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0),
      );
      const first = sorted[0];
      const baseDescription = first.description.replace(/ — Parcela \d+\/\d+$/, '');
      const totalAmount = sorted.reduce((s, t) => s + t.amount, 0);
      const totalPaid = transactions
        .filter(
          (t: Transaction) =>
            t.customerId === selectedCustomer?.id &&
            t.type === 'PAYMENT' &&
            t.status === 'CONFIRMED' &&
            (t as { installmentGroupId?: string }).installmentGroupId === groupId,
        )
        .reduce((s: number, t: Transaction) => s + t.amount, 0);
      return {
        groupId,
        baseDescription,
        totalInstallments: first.totalInstallments ?? sorted.length,
        installmentValue: first.amount,
        totalAmount,
        totalPaid,
        interestRate: first.interestRate,
        firstDate: first.timestamp,
        installments: sorted,
      };
    });
  }, [transactions, selectedCustomer?.id]);

  if (!selectedCustomer) return null;

  const handleAddNote = () => {
    if (noteText.trim()) {
      setCustomers((prev: Customer[]) =>
        prev.map((c) =>
          c.id === selectedCustomer.id
            ? {
                ...c,
                notes: [
                  ...(c.notes || []),
                  { id: generateId(), text: noteText.trim(), createdAt: Date.now() },
                ],
              }
            : c,
        ),
      );
      setNoteText('');
    }
  };

  const handlePrintStatement = () => {
    const typeLabel = (type: string) => {
      if (type === 'DEBT') return { label: 'Débito', color: '#DC2626', sign: '+' };
      if (type === 'PAYMENT') return { label: 'Pagamento', color: '#059669', sign: '-' };
      if (type === 'ABATIMENTO') return { label: 'Abatimento', color: '#7C3AED', sign: '-' };
      if (type === 'REFUND') return { label: 'Devolução', color: '#2563EB', sign: '+' };
      return { label: type, color: '#334155', sign: '' };
    };
    const items = filteredTransactions
      .map((tx: Transaction) => {
        const { label, color, sign } = typeLabel(tx.type);
        return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${formatBrDate(tx.timestamp)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600">${esc(tx.description)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;font-weight:700;text-align:center"><span style="background:${color}18;color:${color};padding:2px 8px;border-radius:99px">${label}</span></td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:800;text-align:right;color:${color}">${sign}${formatCurrency(tx.amount)}</td>
      </tr>`;
      })
      .join('');
    const saldoColor =
      selectedCustomer.rawBalance > 0
        ? '#DC2626'
        : selectedCustomer.rawBalance < 0
          ? '#059669'
          : '#64748B';
    const filterInfo =
      startDate || endDate
        ? `<p style="font-size:12px;color:#64748b;margin:4px 0 0">Período: ${startDate ? formatBrDate(startDate) : 'Início'} até ${endDate ? formatBrDate(endDate) : 'Hoje'}</p>`
        : '';
    const html = `<!DOCTYPE html><html lang="pt-BR">
<head><meta charset="utf-8"><title>Extrato — ${esc(selectedCustomer.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #0f172a; padding: 40px; }
  .logo { font-size: 20px; font-weight: 900; color: #4F46E5; margin-bottom: 28px; }
  .logo span { color: #94a3b8; font-weight: 400; font-size: 13px; margin-left: 10px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
  .customer-name { font-size: 22px; font-weight: 900; }
  .customer-phone { font-size: 13px; color: #64748b; margin-top: 4px; }
  .balance-box { text-align: right; }
  .balance-label { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8; }
  .balance-value { font-size: 28px; font-weight: 900; color: ${saldoColor}; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; border-bottom: 2px solid #e2e8f0; }
  th:last-child { text-align: right; }
  @media print { body { padding: 20px; } }
</style></head>
<body>
<div class="logo">Fiado Pro <span>Extrato</span></div>
<div class="header">
  <div><div class="customer-name">${esc(selectedCustomer.name)}</div><div class="customer-phone">${esc(selectedCustomer.phone || '')}</div>${filterInfo}</div>
  <div class="balance-box"><div class="balance-label">Saldo atual</div><div class="balance-value">${formatCurrency(Math.abs(selectedCustomer.rawBalance))}</div><div style="font-size:11px;color:${saldoColor};font-weight:700;margin-top:2px">${selectedCustomer.rawBalance > 0 ? 'A receber' : selectedCustomer.rawBalance < 0 ? 'A pagar' : 'Quitado'}</div></div>
</div>
<table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th style="text-align:right">Valor</th></tr></thead>
<tbody>${items}</tbody></table>
<p style="margin-top:24px;font-size:11px;color:#94a3b8;text-align:center">Gerado em ${formatBrDateTime(new Date())} via FiadoPro</p>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      alert('Ative popups no navegador para imprimir o extrato.');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm(t.confirmDelete)) {
      setTransactions((prev: Transaction[]) => prev.filter((tx) => tx.id !== id));
    }
  };

  return (
    <div className="fp-flow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        title={selectedCustomer.name}
        onBack={() => setActiveView(AppView.CUSTOMERS)}
        actions={
          <>
            <button type="button" aria-label="Editar" onClick={() => setIsEditCustomerModalOpen()}>
              <Edit3 size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Excluir"
              onClick={() => {
                if (window.confirm(t.confirmDelete)) deleteCustomer(selectedCustomer.id);
              }}
            >
              <Trash2 size={18} strokeWidth={1.5} />
            </button>
          </>
        }
      />
      <CustomerIdentity
        name={selectedCustomer.name}
        phone={selectedCustomer.phone}
        balanceText={balanceDirection(selectedCustomer.rawBalance, formatCurrency).text}
        balanceColor={balanceDirection(selectedCustomer.rawBalance, formatCurrency).color}
        score={calculateScore(selectedCustomer, transactions)}
        scoreLabel={scoreCategory(calculateScore(selectedCustomer, transactions), t).label}
        trusted={selectedCustomer.trusted}
        onToggleTrusted={() => {
          setCustomers((prev: Customer[]) =>
            prev.map((c) => (c.id === selectedCustomer.id ? { ...c, trusted: !c.trusted } : c)),
          );
        }}
      />
      {selectedCustomer.email ? <p style={{ margin: 0, fontSize: 13, color: 'var(--fp-muted)' }}>{selectedCustomer.email}</p> : null}
      {selectedCustomer.counterpartClosed ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--fp-warn-text)' }}>conta encerrada</p>
      ) : (
        <div className="fp-shortcuts fp-detail-actions">
          <button type="button" className="fp-quick" onClick={() => { setTransactionType('DEBT'); setEditTransactionData(null); setIsTransactionModalOpen(true); }}>
            <span className="fp-quick-pill"><ArrowUpRight size={22} strokeWidth={1.5} color="#fff" /></span>
            <span className="fp-quick-label">Nova despesa</span>
          </button>
          <button type="button" className="fp-quick" onClick={() => { setTransactionType('PAYMENT'); setEditTransactionData(null); setIsTransactionModalOpen(true); }}>
            <span className="fp-quick-pill"><ArrowDownLeft size={22} strokeWidth={1.5} color="#fff" /></span>
            <span className="fp-quick-label">Receber</span>
          </button>
          <button type="button" className="fp-quick" onClick={() => { setTransactionType('ABATIMENTO'); setEditTransactionData(null); setIsTransactionModalOpen(true); }}>
            <span className="fp-quick-pill"><RefreshCcw size={22} strokeWidth={1.5} color="#fff" /></span>
            <span className="fp-quick-label">Abatimento</span>
          </button>
          <button type="button" className="fp-quick" onClick={() => { setTransactionType('REFUND'); setEditTransactionData(null); setIsTransactionModalOpen(true); }}>
            <span className="fp-quick-pill"><Undo2 size={22} strokeWidth={1.5} color="#fff" /></span>
            <span className="fp-quick-label">Devolução</span>
          </button>
        </div>
      )}

        {selectedCustomer && !selectedCustomer.counterpartClosed && (
          <CreditBalanceNotice
            rawBalance={selectedCustomer.rawBalance}
            formatCurrency={formatCurrency}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
          <div className="lg:col-span-2 space-y-8">
            <div className="fp-card-head">
              <h2>Extrato</h2>
              <button type="button" onClick={handlePrintStatement}>Baixar PDF</button>
            </div>
            <div className="fp-chips">
                {(
                  [
                    { id: 'all', label: 'Tudo' },
                    { id: '7', label: '7 dias' },
                    { id: '30', label: '30 dias' },
                    { id: 'month', label: 'Este mês' },
                    { id: 'lastMonth', label: 'Mês passado' },
                    { id: 'custom', label: 'Personalizado' },
                  ] as const
                ).map((item) => (
                  <Chip
                    key={item.id}
                    label={item.label}
                    selected={ledgerPreset === item.id}
                    onClick={() => setLedgerPreset(item.id)}
                  />
                ))}
                {ledgerPreset === 'custom' ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <BrDateField value={startDate} onChange={setStartDate} ariaLabel={t.startDate} />
                    <BrDateField value={endDate} onChange={setEndDate} ariaLabel={t.endDate} />
                  </div>
                ) : null}
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-xs font-black text-indigo-600 uppercase hover:underline"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
            {filteredTransactions.length > 0 && (
              <p className="text-xs text-slate-400 font-bold">
                Mostrando {filteredTransactions.length} transaç
                {filteredTransactions.length === 1 ? 'ão' : 'ões'}
              </p>
            )}
            <div className="space-y-3">
              {filteredTransactions.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-slate-200" />
                  </div>
                  {transactions.some((tx: Transaction) => tx.customerId !== selectedCustomer.id) &&
                  !transactions.some((tx: Transaction) => tx.customerId === selectedCustomer.id) ? (
                    <p className="text-slate-500 font-bold px-4">
                      Nenhuma transação registrada para este cliente ainda. Clique em &quot;Nova
                      Despesa&quot; ou &quot;Registrar Pagamento&quot; para começar.
                    </p>
                  ) : (
                    <p className="text-slate-400 font-bold italic">{t.noTransactions}</p>
                  )}
                </div>
              ) : (
                filteredTransactions.map((tx: Transaction, index: number) => {
                  const overdue = isOverdueDebt(tx, selectedCustomer.rawBalance);
                  const day = formatBrDate(tx.timestamp);
                  const previousDay = index > 0 ? formatBrDate(filteredTransactions[index - 1].timestamp) : '';
                  return (
                    <div key={tx.id}>
                    {day !== previousDay ? <p className="fp-day">{day}</p> : null}
                    <div className="fp-list-row fp-ledger">
                      <div className="flex items-center gap-5">
                        <IconCircle
                          icon={
                            tx.type === 'DEBT'
                              ? ArrowUpRight
                              : tx.type === 'ABATIMENTO'
                                ? RefreshCcw
                                : tx.type === 'REFUND'
                                  ? Undo2
                                  : ArrowDownLeft
                          }
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <LedgerTitle text={tx.description || 'Lançamento'} />
                            {overdue ? <span className="fp-chip danger">Vencido</span> : null}
                            {tx.status !== 'CONFIRMED' && (
                              <span
                                className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
                              >
                                {tx.status === 'PENDING'
                                  ? 'Pendente'
                                  : tx.status === 'CANCELLED'
                                    ? 'Cancelado'
                                    : 'Rejeitado'}
                              </span>
                            )}
                            {selectedCustomer.counterpartClosed && tx.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void cancelTransaction(tx.id).then((ok: boolean) => {
                                    if (ok)
                                      setTransactions((prev: Transaction[]) =>
                                        prev.map((p: Transaction) =>
                                          p.id === tx.id ? { ...p, status: 'CANCELLED' } : p,
                                        ),
                                      );
                                  });
                                }}
                                className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-slate-200 text-slate-700"
                              >
                                Cancelar
                              </button>
                            )}
                            {tx.status === 'REJECTED' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void resendTransaction(tx.id).then((ok: boolean) => {
                                    if (ok)
                                      setTransactions((prev: Transaction[]) =>
                                        prev.map((p: Transaction) =>
                                          p.id === tx.id ? { ...p, status: 'PENDING' as const } : p,
                                        ),
                                      );
                                  });
                                }}
                                className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                title="Reenviar para aprovação"
                              >
                                Reenviar
                              </button>
                            )}
                          </div>
                          <p className="fp-ledger-when">{formatBrDateTime(tx.timestamp)}</p>
                          {ledgerDueText(overdue, tx.dueDate) ? (
                            <p className="fp-ledger-when">{ledgerDueText(overdue, tx.dueDate)}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        {tx.attachment &&
                          /^data:(image\/(jpeg|png|gif|webp)|application\/pdf);base64,/.test(
                            tx.attachment.data,
                          ) && (
                            <a
                              href={tx.attachment.data}
                              target="_blank"
                              rel="noreferrer noopener"
                              download={tx.attachment.name}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-indigo-400 hover:text-indigo-600 transition-colors"
                              title={`Ver comprovante: ${tx.attachment.name}`}
                            >
                              <Receipt className="w-4 h-4" />
                            </a>
                          )}
                        <p
                          className="text-lg whitespace-nowrap"
                          style={{
                            fontWeight: 600,
                            color:
                              tx.type === 'PAYMENT' || tx.type === 'ABATIMENTO' ? '#1F7A4D' : '#B3261E',
                          }}
                        >
                          {balanceSign(tx.type) < 0 ? '−' : '+'}
                          {formatCurrency(tx.amount)}
                        </p>
                        <div className="flex">
                          <button
                            onClick={() => {
                              setEditTransactionData(tx);
                              setTransactionType(tx.type);
                              setIsTransactionModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="fp-card" style={{ padding: 16 }}>
              <h3>
                <Sparkles size={16} strokeWidth={1.5} /> {t.aiAnalysis}
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--fp-muted)' }}>
                {t.proFeatureTitle}
              </p>
              {!isPro && canShowCheckout() && (
                <button
                  type="button"
                  onClick={setIsUpgradeModalOpen}
                  className="fp-btn fp-btn-secondary"
                >
                  Conhecer o Pro
                </button>
              )}
              {isPro && (
                <button
                  type="button"
                  onClick={handleGetAdvice}
                  disabled={isAILoading}
                  className="fp-btn fp-btn-secondary"
                >
                  {isAILoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles size={16} strokeWidth={1.5} />
                  )}
                  {t.aiAnalysis}
                </button>
              )}
              {aiAdvice && (
                <p style={{ marginTop: 12, fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--fp-text)' }}>
                  {aiAdvice}
                </p>
              )}
            </div>

            <div className="fp-card" style={{ padding: 16 }}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsNotesModalOpen(true)}
                  className="flex items-center gap-3"
                  style={{ background: 'none', border: 0, padding: 0, color: 'inherit' }}
                >
                  <h3>
                    <FileText size={16} strokeWidth={1.5} /> {t.customerNotes}
                  </h3>
                </button>
                <button
                  onClick={() => setIsNotesModalOpen(true)}
                  className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all shadow-sm"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={t.anyDetails}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                    style={{ fontSize: 13, fontWeight: 400 }}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim()}
                    className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {(selectedCustomer.notes || []).length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="fp-help">{t.noNotes}</p>
                  </div>
                ) : (
                  selectedCustomer.notes
                    .slice(-3)
                    .reverse()
                    .map((note: CustomerNote) => (
                      <div
                        key={note.id}
                        className="p-5 bg-slate-50 rounded-2xl border border-slate-100 relative group hover:border-indigo-100 transition-all"
                      >
                        {editingNoteId === note.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              className="w-full p-3 bg-white border border-indigo-200 rounded-xl font-bold text-sm outline-none h-20 resize-none"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="px-3 py-1 text-[10px] font-black uppercase text-slate-400"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleUpdateNote(note.id)}
                                className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase"
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 400, lineHeight: 1.4, paddingRight: 112 }}>
                              {note.text}
                            </p>
                            <p className="fp-help">{formatBrDateTime(note.createdAt)}</p>
                            <div className="absolute top-4 right-4 flex gap-1">
                              <button
                                type="button"
                                aria-label="Editar nota"
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteText(note.text);
                                }}
                                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Excluir nota"
                                onClick={() => {
                                  if (window.confirm(t.confirmDelete))
                                    setCustomers((prev: Customer[]) =>
                                      prev.map((c) =>
                                        c.id === selectedCustomer.id
                                          ? {
                                              ...c,
                                              notes: (c.notes || []).filter(
                                                (n) => n.id !== note.id,
                                              ),
                                            }
                                          : c,
                                      ),
                                    );
                                }}
                                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                )}
                {(selectedCustomer.notes || []).length > 3 && (
                  <button
                    onClick={() => setIsNotesModalOpen(true)}
                    className="fp-help"
                    style={{ background: 'none', border: 0, width: '100%', cursor: 'pointer' }}
                  >
                    {t.viewAllNotes}
                  </button>
                )}
              </div>
            </div>

            <div className="fp-card" style={{ padding: 16 }}>
              <h3>
                <Phone size={16} strokeWidth={1.5} /> {t.notifyCustomer}
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--fp-muted)' }}>
                Envie um lembrete gentil com o resumo atualizado da conta diretamente para o
                WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => handleShareWhatsApp('GENTLE')}
                className="fp-btn fp-btn-primary fp-btn-block"
              >
                <Share2 size={18} strokeWidth={1.5} />
                {t.sendSummary}
              </button>
            </div>
          </div>
        </div>

        {/* Installment / Loan Management Panel */}
        {installmentGroups.length > 0 && (
          <div className="mt-8 space-y-4 animate-in fade-in duration-500">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {t.installmentsSection || 'Empréstimos e Parcelas'}
              <span className="text-sm font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {installmentGroups.length}
              </span>
            </h3>
            {installmentGroups.map((group) => (
              <InstallmentGroupCard
                key={group.groupId}
                group={group}
                formatCurrency={formatCurrency}
                t={t}
                customerRawBalance={selectedCustomer.rawBalance}
                onPayInstallment={(tx: Transaction) =>
                  onPayInstallment && onPayInstallment(tx, group)
                }
              />
            ))}
          </div>
        )}
    </div>
  );
};

const ProfileView = ({
  user,
  setUser,
  t,
  setActiveView,
  onExport,
  onImport,
  onDeleteAccount,
}: any) => {
  const [editUser, setEditUser] = useState({ ...user });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSyncWarning, setProfileSyncWarning] = useState('');

  const handleWhatsAppProfile = () => {
    if (editUser.phone) {
      window.open(`https://wa.me/55${editUser.phone.replace(/\D/g, '')}`, '_blank');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSyncWarning('');
    // Servidor é a fonte de verdade para o vínculo cliente↔usuário (por
    // telefone/e-mail) — sem sincronizar aqui, quem cadastrar você pelo
    // telefone nunca vai gerar lançamento, mesmo com o número certo.
    const synced = await updateProfile({
      full_name: editUser.name,
      phone: editUser.phone || null,
      pix_key: editUser.pixKey || null,
    });
    if (!synced) {
      setProfileSyncWarning(
        'Não foi possível sincronizar com o servidor agora (sem conexão?). Os dados foram salvos só neste dispositivo — o vínculo por telefone/e-mail com outros usuários não vai funcionar até você conseguir salvar online.',
      );
    }
    setUser(editUser);
    setSavingProfile(false);
    setActiveView(AppView.DASHBOARD);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 md:p-12 rounded-t42xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6 mb-12 pb-12 border-b border-slate-100">
          <div className="w-24 h-24 bg-indigo-600 rounded-t42lg flex items-center justify-center text-white font-black text-4xl shadow-xl shadow-indigo-100">
            {user.name.charAt(0)}
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-black text-slate-900">{user.name}</h2>
            <p className="text-slate-400 font-bold">{user.email}</p>
          </div>
        </div>
        {profileSyncWarning && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-semibold">
            {profileSyncWarning}
          </div>
        )}
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <UserIcon className="w-3 h-3" /> {t.fullName}
            </label>
            <input
              value={editUser.name}
              onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Mail className="w-3 h-3" /> {t.email}
            </label>
            <input
              value={editUser.email}
              onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Phone className="w-3 h-3" /> {t.phoneNumber}
            </label>
            <div className="relative">
              <input
                value={editUser.phone || ''}
                onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold pr-16"
              />
              {editUser.phone && (
                <button
                  type="button"
                  onClick={handleWhatsAppProfile}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-3 h-3" /> {t.address}
            </label>
            <input
              value={editUser.address || ''}
              onChange={(e) => setEditUser({ ...editUser, address: e.target.value })}
              placeholder="Rua, Número, Bairro, Cidade"
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ZapIcon className="w-3 h-3" /> {t.pixKeyLabel}
            </label>
            <input
              value={editUser.pixKey || ''}
              onChange={(e) => setEditUser({ ...editUser, pixKey: e.target.value })}
              placeholder={t.pixKeyPlaceholder}
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Percent className="w-3 h-3" /> Taxa de Juros Padrão (% ao mês)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={editUser.defaultInterestRate || 0}
              onChange={(e) =>
                setEditUser({ ...editUser, defaultInterestRate: parseFloat(e.target.value) || 0 })
              }
              placeholder="Ex: 2.5"
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold"
            />
          </div>
          <div className="md:col-span-2 pt-6">
            <SaveButton
              saving={savingProfile}
              label={t.saveChanges}
              className="w-full bg-indigo-600 text-white py-5 rounded-t42lg font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            />
          </div>
        </form>
      </div>

      <div className="bg-white p-8 rounded-t42lg border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
          <Download className="w-5 h-5 text-indigo-600" /> {t.exportData} / {t.importData}
        </h3>
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={onExport}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" /> {t.exportData}
          </button>
          <label className="flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black text-sm cursor-pointer hover:bg-slate-200 transition-all active:scale-95">
            <Upload className="w-4 h-4" /> {t.importData}
            <input type="file" accept=".json" className="hidden" onChange={onImport} />
          </label>
          <button
            onClick={() => setActiveView(AppView.AUDIT_LOG)}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
          >
            <ClipboardList className="w-4 h-4" /> {t.auditLog}
          </button>
        </div>
      </div>

      <UpgradePlano />

      <DeleteAccountPanels googleOnly={user?.hasPassword === false} onDelete={onDeleteAccount} />
    </div>
  );
};

const ToPayView: React.FC<{
  customers: CustomerWithBalance[];
  formatCurrency: (amount: number) => string;
  navigateToCustomer: (id: string) => void;
  t: Translation;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}> = ({ customers, formatCurrency, navigateToCustomer, t, setTransactions }) => {
  const debtsToPay = customers.filter((c) => c.rawBalance < 0);

  if (debtsToPay.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
        <CheckCircle2 className="w-24 h-24 mb-6" />
        <p className="text-xl font-semibold">{t.noDebtsToPay}</p>
        <p className="text-sm text-slate-500 mt-2">{t.allGoodHere}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-slate-900 mb-6">{t.toPay}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {debtsToPay.map((c) => (
          <div
            key={c.id}
            className="bg-white p-8 rounded-t42xl border border-slate-200 hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center gap-5 mb-8">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                {c.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {c.name}
                </h3>
                <p className="text-xs text-slate-400 font-bold">{c.phone ? formatPhoneDisplay(c.phone) : ''}</p>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-50 mb-6">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
                {t.youOwe}
              </p>
              <p className="text-2xl font-black text-emerald-600">
                {formatCurrency(Math.abs(c.rawBalance))}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Registrar devolução de ${formatCurrency(Math.abs(c.rawBalance))} para ${c.name}?`,
                    )
                  ) {
                    setTransactions((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        customerId: c.id,
                        amount: Math.abs(c.rawBalance),
                        type: 'DEBT' as TransactionType,
                        description: 'Devolução em dinheiro',
                        timestamp: Date.now(),
                        status: 'CONFIRMED' as const,
                      },
                    ]);
                  }
                }}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-xl font-black text-xs hover:bg-green-700 transition-all active:scale-95"
              >
                Devolver
              </button>
              <button
                onClick={() => navigateToCustomer(c.id)}
                className="flex-1 px-3 py-2 bg-slate-700 text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-all active:scale-95"
              >
                Ver Extrato
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- NotificationsView: aprovação/rejeição de pagamentos pendentes ---
const NotificationsView = ({
  transactions,
  setTransactions,
  customers,
  formatCurrency,
  t,
  user,
  setAuditLog,
}: {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  customers: Customer[];
  formatCurrency: (n: number) => string;
  t: Translation;
  user: { id: string; name: string } | null;
  setAuditLog: React.Dispatch<React.SetStateAction<AuditEntry[]>>;
}) => {
  const pending = transactions.filter((tx) => tx.status === 'PENDING');

  const handleApprove = (txId: string) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === txId ? { ...tx, status: 'CONFIRMED' } : tx)),
    );
    setAuditLog((prev) => [
      ...prev,
      {
        id: generateId(),
        timestamp: Date.now(),
        userId: user?.id || '',
        userName: user?.name || '',
        action: 'PAYMENT_CONFIRM',
        entity: 'TRANSACTION',
        entityId: txId,
        description: t.paymentApproved || 'Pagamento aprovado',
      },
    ]);
  };

  const handleReject = (txId: string) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === txId ? { ...tx, status: 'REJECTED' } : tx)),
    );
    setAuditLog((prev) => [
      ...prev,
      {
        id: generateId(),
        timestamp: Date.now(),
        userId: user?.id || '',
        userName: user?.name || '',
        action: 'PAYMENT_REJECT',
        entity: 'TRANSACTION',
        entityId: txId,
        description: t.paymentRejected || 'Pagamento recusado',
      },
    ]);
  };

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
        <Bell className="w-24 h-24 mb-6" />
        <p className="text-xl font-semibold">{t.noPendingPayments}</p>
        <p className="text-sm text-slate-500 mt-2">{t.allGoodHere}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3">
        <Bell className="w-8 h-8 text-indigo-600" /> {t.pendingPayments}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pending.map((tx) => {
          const customer = customers.find((c) => c.id === tx.customerId);
          return (
            <div
              key={tx.id}
              className="bg-white p-8 rounded-t42xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-5 mb-6">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 font-black text-2xl shadow-sm">
                  {customer?.name.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {customer?.name || t.unknownCustomer}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">{tx.description}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-50 mb-6">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
                  {t.amount}
                </p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(tx.amount)}</p>
                <p className="text-xs text-slate-400 mt-1">{formatBrDateTime(tx.timestamp)}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(tx.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white py-3 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all"
                >
                  <ThumbsUp className="w-4 h-4" /> {t.approvePayment}
                </button>
                <button
                  onClick={() => handleReject(tx.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-600 py-3 rounded-2xl font-black text-sm active:scale-95 transition-all hover:bg-red-500 hover:text-white"
                >
                  <ThumbsDown className="w-4 h-4" /> {t.rejectPaymentBtn}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- AuditLogView: histórico de todas as alterações ---
const AuditLogView = ({ auditLog, t }: { auditLog: AuditEntry[]; t: Translation }) => {
  const sorted = [...auditLog].sort((a, b) => b.timestamp - a.timestamp);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
        <ClipboardList className="w-24 h-24 mb-6" />
        <p className="text-xl font-semibold">{t.noAuditEntries}</p>
      </div>
    );
  }

  const actionColors: Record<string, string> = {
    CREATE: 'bg-emerald-100 text-emerald-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    PAYMENT_CONFIRM: 'bg-emerald-100 text-emerald-700',
    PAYMENT_REJECT: 'bg-red-100 text-red-700',
    SPLIT_CONFIRMED: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3">
        <ClipboardList className="w-8 h-8 text-indigo-600" /> {t.auditLog}
      </h2>
      <div className="space-y-3">
        {sorted.map((entry) => (
          <div
            key={entry.id}
            className="bg-white p-6 rounded-t42lg border border-slate-100 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <span
                className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${actionColors[entry.action] || 'bg-slate-100 text-slate-600'}`}
              >
                {entry.action}
              </span>
              <div>
                <p className="font-black text-slate-800 text-sm">{entry.description}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {t.editedBy}: <span className="font-bold text-slate-600">{entry.userName}</span>
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-bold whitespace-nowrap">
              {formatBrDateTime(entry.timestamp)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const calcInstallment = (principal: number, ratePercent: number, n: number): number => {
  if (n <= 1) return principal;
  if (ratePercent === 0) return principal / n;
  const r = ratePercent / 100;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
};

// Simple Zap icon since lucide zap is often used for Pix in BR context
const ZapIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('pt-BR');
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [events, setEvents] = useState<BillEvent[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlan>(PLANS.FREE);
  const [ownerExpenses, setOwnerExpenses] = useState<OwnerExpense[]>([]);
  const [credentials, setCredentials] = useState<UserCredentials | null>(null);
  const [loginMode, setLoginMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [recoverAccount, setRecoverAccount] = useState<null | {
    channel: 'login' | 'google' | 'register';
    idToken?: string;
  }>(null);
  const [customerFormWarning, setCustomerFormWarning] = useState('');
  const [duplicateCustomer, setDuplicateCustomer] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [planLimitReason, setPlanLimitReason] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const savingCustomerRef = useRef(false);
  const savingTransactionRef = useRef(false);
  const savingEventRef = useRef(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddStep, setQuickAddStep] = useState<1 | 2>(1);
  const [quickAddType, setQuickAddType] = useState<'DEBT' | 'PAYMENT'>('DEBT');
  const [pendingTransactionAfterCreate, setPendingTransactionAfterCreate] = useState(false);
  const [pendingNewCustomerName, setPendingNewCustomerName] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [hasInterest, setHasInterest] = useState(false);
  const [installmentInterestRate, setInstallmentInterestRate] = useState(2.5);
  const [currentAmountValue, setCurrentAmountValue] = useState<number | null>(null);
  const [draftDescription, setDraftDescription] = useState('');
  const [amountError, setAmountError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [customerNameError, setCustomerNameError] = useState('');
  const [eventNameError, setEventNameError] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<{
    prices?: { free?: number; pro?: number } | null;
    adPolicy?: string | null;
  } | null>(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [noteFilterDate, setNoteFilterDate] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('DEBT');
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiAdvice, setAIAdvice] = useState<string | null>(null);
  const [editTransactionData, setEditTransactionData] = useState<Transaction | null>(null);
  const [installmentPreFill, setInstallmentPreFill] = useState<{
    amount: number;
    description: string;
    installmentGroupId: string;
    installmentNumber: number;
  } | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const t = translations[language];

  // ===== Sincronização com o servidor (fonte de verdade quando logado) =====
  const [inboxCount, setInboxCount] = useState(0);
  const syncBootstrapped = useRef(false);

  const refreshInbox = useCallback(async () => {
    const items = await fetchInbox();
    setInboxCount(items.length);
  }, []);

  useEffect(() => {
    if (!user) {
      syncBootstrapped.current = false;
      return;
    }
    if (syncBootstrapped.current) return;
    syncBootstrapped.current = true;
    void bootstrapSync(customers, transactions).then((result) => {
      if (result.online) {
        setCustomers(result.customers);
        setTransactions(result.transactions);
      }
      void refreshInbox();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCatalog(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/billing/status`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        const adPolicy = typeof data.adPolicy === 'string' ? data.adPolicy : null;
        const prices =
          canShowCheckout() && data.prices && typeof data.prices === 'object' ? data.prices : null;
        setCatalog({ prices, adPolicy });
        const serverPlan = typeof data.plan === 'string' ? data.plan : 'FREE';
        const template =
          serverPlan === 'ENTERPRISE'
            ? PLANS.ENTERPRISE
            : serverPlan === 'PRO' || serverPlan === 'ADMIN'
              ? PLANS.PRO
              : PLANS.FREE;
        setPlan({
          ...template,
          monthlyPrice: template.type === 'FREE' ? 0 : null,
          hasAds: showsFullscreenAd(adPolicy),
        });
        setIsPro(serverPlan === 'PRO' || serverPlan === 'ENTERPRISE' || serverPlan === 'ADMIN');
      })
      .catch(() => {
        /* Sem o preço na resposta, o plano aparece sem número. */
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    schedulePush(
      true,
      customers,
      transactions,
      (patches) => {
        setTransactions((prev) =>
          prev.map((tx) => {
            const patch = patches.find((p) => p.id === tx.id);
            return patch ? { ...tx, status: patch.status } : tx;
          }),
        );
      },
      (txId) => {
        const tx = transactions.find((item) => item.id === txId);
        if (!tx || tx.creditConfirmed) return;
        const customer = customers.find((item) => item.id === tx.customerId);
        const others = transactions.filter(
          (item) =>
            item.customerId === tx.customerId && item.status === 'CONFIRMED' && item.id !== tx.id,
        );
        const balance = computeRawBalance(others);
        const owed = Math.max(0, balance);
        const extra = Math.max(0, Math.round((tx.amount - owed) * 100) / 100);
        const confirmed = window.confirm(
          `${customer?.name ?? 'Este cliente'} devia ${formatCurrency(owed)}. Os ${formatCurrency(extra)} a mais vão ficar como crédito (você vai dever). Confirmar?`,
        );
        if (!confirmed) {
          showToast('O pagamento continua neste aparelho até você confirmar o crédito.');
          return;
        }
        setTransactions((prev) =>
          prev.map((item) => (item.id === txId ? { ...item, creditConfirmed: true } : item)),
        );
      },
      (notice) => setDuplicateCustomer(notice),
    );
  }, [user, customers, transactions]);

  const handleUpdateNote = (noteId: string) => {
    if (editingNoteText.trim() && selectedCustomerId) {
      setCustomers((prev: Customer[]) =>
        prev.map((c) =>
          c.id === selectedCustomerId
            ? {
                ...c,
                notes: (c.notes || []).map((n) =>
                  n.id === noteId ? { ...n, text: editingNoteText.trim() } : n,
                ),
              }
            : c,
        ),
      );
      setEditingNoteId(null);
      setEditingNoteText('');
    }
  };

  const navigateToCustomer = (id: string) => {
    setSelectedCustomerId(id);
    setActiveView(AppView.CUSTOMER_DETAIL);
    setAIAdvice(null);
  };

  const formatCurrency = useCallback(
    (val: number) =>
      `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [],
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setCustomers(data.customers || []);
        setTransactions(data.transactions || []);
        setEvents(data.events || []);
        if (data.language) setLanguage(data.language);
        if (data.isPro !== undefined) setIsPro(data.isPro);
        if (data.debts) setDebts(data.debts);
        if (data.auditLog) setAuditLog(data.auditLog);
        if (
          data.plan?.type === 'FREE' ||
          data.plan?.type === 'PRO' ||
          data.plan?.type === 'ENTERPRISE'
        ) {
          const storedType = data.plan.type as PlanType;
          const expired =
            typeof data.plan.expiresAt === 'number' && data.plan.expiresAt < Date.now();
          if (expired) {
            setPlan(PLANS.FREE);
            setIsPro(false);
          } else {
            setPlan({
              ...PLANS[storedType],
              expiresAt: data.plan.expiresAt,
              monthlyPrice: storedType === 'FREE' ? 0 : null,
              hasAds: false,
            });
          }
        }
        if (data.ownerExpenses) setOwnerExpenses(data.ownerExpenses);
        if (data.credentials) setCredentials(data.credentials);
      } catch (e) {
        console.warn(
          '[Fiado PRO] Dados corrompidos no localStorage — iniciando com estado limpo.',
          e,
        );
      }
    }
    // Validar sessao via httpOnly cookie
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) {
          setUser((prev: User | null) => ({
            ...(prev ?? {}),
            id: data.user.id,
            name: data.user.full_name || data.user.email,
            email: data.user.email,
            role: data.user.role,
            hasPassword:
              typeof data.user.has_password === 'boolean'
                ? data.user.has_password
                : prev?.hasPassword,
            phone: data.user.phone ?? prev?.phone,
            pixKey: data.user.pix_key ?? prev?.pixKey,
            avatar: data.user.avatar_url ?? prev?.avatar,
          }));
        }
      })
      .catch(() => {
        /* sessao nao existe */
      })
      .finally(() => setIsAuthLoading(false));

    const initCapacitor = async () => {
      try {
        await SplashScreen.hide();
      } catch {}
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#4f46e5' });
      } catch {}
      try {
        const status = await Network.getStatus();
        setIsOffline(!status.connected);
        await Network.addListener('networkStatusChange', (s) => setIsOffline(!s.connected));
      } catch {}
      try {
        await CapacitorApp.addListener('appUrlOpen', (event) => {
          try {
            const url = new URL(event.url);
            const token = url.searchParams.get('reset_token');
            if (token) setResetToken(token);
          } catch {}
        });
        await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (!canGoBack) CapacitorApp.exitApp();
        });
      } catch {}
      try {
        await Keyboard.addListener('keyboardWillShow', () =>
          document.body.classList.add('keyboard-open'),
        );
        await Keyboard.addListener('keyboardWillHide', () =>
          document.body.classList.remove('keyboard-open'),
        );
      } catch {}
      try {
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') await PushNotifications.register();
        await PushNotifications.addListener('registration', (_token) => {
          // TODO Sprint 4: enviar token FCM para o backend
        });
        await PushNotifications.addListener('pushNotificationReceived', (_notification) => {
          // TODO Sprint 4: exibir notificacao em foreground
        });
      } catch {}
    };
    initCapacitor().catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        customers,
        transactions,
        events,
        language,
        isPro,
        user,
        debts,
        auditLog,
        plan,
        ownerExpenses,
        credentials,
      }),
    );
  }, [
    customers,
    transactions,
    events,
    language,
    isPro,
    user,
    debts,
    auditLog,
    plan,
    ownerExpenses,
    credentials,
  ]);

  // Fechar todos os modais ao navegar entre views
  useEffect(() => {
    setIsTransactionModalOpen(false);
    setIsCustomerModalOpen(false);
    setIsEditCustomerModalOpen(false);
    setIsQuickAddOpen(false);
    setIsEventModalOpen(false);
    setInstallmentPreFill(null);
  }, [activeView]);

  useEffect(() => {
    if (!isTransactionModalOpen) {
      setDueDateInput('');
      setAmountError('');
      setDescriptionError('');
      setCurrentAmountValue(null);
      setDraftDescription('');
      return;
    }
    setAmountError('');
    setDescriptionError('');
    if (editTransactionData) {
      setCurrentAmountValue(editTransactionData.amount > 0 ? editTransactionData.amount : null);
      setDraftDescription(editTransactionData.description ?? '');
      setDueDateInput(
        editTransactionData.dueDate ? timestampToIsoDate(editTransactionData.dueDate) : '',
      );
      return;
    }
    if (installmentPreFill) {
      setCurrentAmountValue(installmentPreFill.amount > 0 ? installmentPreFill.amount : null);
      setDraftDescription(installmentPreFill.description ?? '');
      setDueDateInput('');
      return;
    }
    setCurrentAmountValue(null);
    setDraftDescription('');
    setDueDateInput('');
  }, [isTransactionModalOpen, editTransactionData, installmentPreFill]);

  const customersWithBalance: CustomerWithBalance[] = useMemo(() => {
    const rows = customers.map((c) => {
      const customerTransactions = transactions.filter(
        (tData) => tData.customerId === c.id && tData.status === 'CONFIRMED',
      );
      // DEBT e REFUND aumentam. PAYMENT e ABATIMENTO diminuem.
      const rawBalance = computeRawBalance(customerTransactions);

      const lastActivity =
        customerTransactions.length > 0
          ? Math.max(...customerTransactions.map((t) => t.timestamp))
          : c.createdAt;
      const displayBalance = rawBalance < 0 && c.overpaymentStrategy === 'PROFIT' ? 0 : rawBalance;
      return {
        ...c,
        balance: displayBalance,
        rawBalance: rawBalance,
        lastActivity,
        isOverdue: false,
        score: calculateScore(c, transactions),
      };
    });
    const overdueIds = new Set(summarizeOverdue(transactions, rows).customerIds);
    return rows.map((c) => ({ ...c, isOverdue: overdueIds.has(c.id) }));
  }, [customers, transactions]);

  const canAddCustomer = () => customers.length < plan.maxCustomers;

  const showPlanLimit = (kind: 'clientes' | 'eventos' | 'participantes', max: number) => {
    if (!Number.isFinite(max)) return;
    const planName = plan.type === 'FREE' ? 'Grátis' : plan.type === 'PRO' ? 'Pro' : 'Enterprise';
    const kindLabel = kind === 'clientes' ? 'clientes' : kind;
    const message = `Você atingiu o limite de ${max} ${kindLabel} do plano ${planName}`;
    if (!canShowCheckout()) {
      showToast(message);
      return;
    }
    setPlanLimitReason(message);
    setIsUpgradeModalOpen(true);
  };

  const limitCountFromServer = (message: string, fallback: number) => {
    const found = message.match(/\d+/);
    if (!found) return fallback;
    const value = Number(found[0]);
    return Number.isFinite(value) ? value : fallback;
  };

  const openExistingCustomer = (id: string) => {
    setDuplicateCustomer(null);
    setCustomerFormWarning('');
    setIsCustomerModalOpen(false);
    setIsEditCustomerModalOpen(false);
    setPendingTransactionAfterCreate(false);
    setPendingNewCustomerName('');
    navigateToCustomer(id);
  };

  const stats = useMemo(() => {
    const totalReceivable = customersWithBalance.reduce(
      (acc, c) => acc + (c.balance > 0 ? c.balance : 0),
      0,
    );
    // Mudança Crítica: Contar como devedor ativo qualquer pessoa com saldo positivo no extrato
    const activeDebtors = customersWithBalance.filter((c) => c.rawBalance > 0).length;
    const overdueSummary = summarizeOverdue(transactions, customersWithBalance);
    const totalOverdue = overdueSummary.amount;
    const totalFuture = Math.max(0, totalReceivable - totalOverdue);
    const totalPaid = transactions
      .filter((t) => t.type === 'PAYMENT' && t.status === 'CONFIRMED')
      .reduce((acc, t) => acc + t.amount, 0);

    const recentTransactions = transactions
      .filter((t) => t.status === 'CONFIRMED')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map((t) => ({
        ...t,
        customerName: customers.find((c) => c.id === t.customerId)?.name || 'Unknown',
      }));

    const evolutionData = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const point = cumulativeThrough(transactions, d.getTime());
      return {
        date: formatBrDate(d),
        Offered: point.Offered,
        Received: point.Received,
      };
    });

    return {
      totalReceivable,
      totalFuture,
      activeDebtors,
      totalOverdue,
      overdueCustomerCount: overdueSummary.customerIds.length,
      totalPaid,
      recentTransactions,
      evolutionData,
      defaultRate: totalReceivable > 0 ? (totalOverdue / totalReceivable) * 100 : 0,
    };
  }, [customersWithBalance, transactions, customers]);

  const handleShareWhatsApp = (_mode: string) => {
    const selected = customersWithBalance.find((c) => c.id === selectedCustomerId);
    if (!selected) return;

    const confirmedTx = transactions.filter(
      (t) => t.customerId === selected.id && t.status === 'CONFIRMED',
    );
    // Usar rawBalance já calculado no useMemo — evita divergência de lógica
    const balance = selected.rawBalance;

    // Get last 3 debt transactions
    const recentDebts = confirmedTx
      .filter((t) => t.type === 'DEBT')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);

    const creditorName = user?.name || 'seu credor';
    const totalDebt = confirmedTx
      .filter((t) => t.type === 'DEBT')
      .reduce((a, b) => a + b.amount, 0);
    const totalPaid = confirmedTx
      .filter((t) => t.type === 'PAYMENT' || t.type === 'ABATIMENTO')
      .reduce((a, b) => a + b.amount, 0);

    const text = buildChargeMessage({
      customerName: selected.name,
      creditorName,
      balance,
      totalDebt,
      totalPaid,
      recentDebts,
      pixKey: user?.pixKey,
      formatCurrency,
    });

    window.open(buildWhatsAppUrl(selected.phone, text), '_blank');
  };

  const handleGetAdvice = async () => {
    const selected = customersWithBalance.find((c) => c.id === selectedCustomerId);
    if (!selected) return;
    setIsAILoading(true);
    setAIAdvice(null);
    try {
      const advice = await getFinancialAdvice(selected, transactions, language);
      setAIAdvice(advice || null);
    } catch {
      alert('AI Error');
    } finally {
      setIsAILoading(false);
    }
  };

  const addAuditEntry = (
    action: AuditEntry['action'],
    entity: AuditEntry['entity'],
    entityId: string,
    description: string,
  ) => {
    if (!user) return;
    setAuditLog((prev) => [
      ...prev,
      {
        id: generateId(),
        timestamp: Date.now(),
        userId: user.id,
        userName: user.name,
        action,
        entity,
        entityId,
        description,
      },
    ]);
  };

  const handleExportData = () => {
    const data = { customers, transactions, events, debts, auditLog };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiado-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async (confirmation: string): Promise<string | null> => {
    try {
      const message = await requestAccountDeletion(`${API_URL}/users/me`, confirmation);
      if (message) return message;
      setCustomers([]);
      setTransactions([]);
      setEvents([]);
      setDebts([]);
      setAuditLog([]);
      setOwnerExpenses([]);
      setPlan(PLANS.FREE);
      setCredentials(null);
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      return null;
    } catch {
      return 'Erro de conexão. Tente novamente.';
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const validTypes = new Set(['DEBT', 'PAYMENT', 'REFUND', 'ABATIMENTO']);
        const validStatus = new Set(['CONFIRMED', 'PENDING', 'REJECTED', 'CANCELLED']);

        // Validate customers
        if (data.customers && Array.isArray(data.customers)) {
          const valid = data.customers.every(
            (c: any) =>
              typeof c.id === 'string' && typeof c.name === 'string' && typeof c.phone === 'string',
          );
          if (valid) setCustomers(data.customers);
        }

        // Validate transactions — sanitize attachment data URIs
        if (data.transactions && Array.isArray(data.transactions)) {
          const valid = data.transactions.every(
            (t: any) =>
              typeof t.id === 'string' &&
              isFinite(t.amount) &&
              t.amount >= 0 &&
              validTypes.has(t.type) &&
              validStatus.has(t.status),
          );
          if (valid) {
            const sanitized = data.transactions.map((t: any) => {
              if (t.attachment?.data) {
                const ok = /^data:(image\/(jpeg|png|gif|webp)|application\/pdf);base64,/.test(
                  t.attachment.data,
                );
                if (!ok) return { ...t, attachment: undefined };
              }
              return t;
            });
            setTransactions(sanitized);
          }
        }

        if (data.events && Array.isArray(data.events)) setEvents(data.events);
        if (data.debts && Array.isArray(data.debts)) setDebts(data.debts);
        if (data.auditLog && Array.isArray(data.auditLog)) setAuditLog(data.auditLog);
        showToast(t.importSuccess);
      } catch {
        showToast(t.importError);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const addTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingTransactionRef.current) return;
    if (!selectedCustomerId) return;
    const amount = currentAmountValue ?? 0;
    const desc = draftDescription.trim();
    const nextAmountError = amountFieldMessage(currentAmountValue);
    const nextDescriptionError = descriptionFieldMessage(draftDescription);
    setAmountError(nextAmountError);
    setDescriptionError(nextDescriptionError);
    if (nextAmountError || nextDescriptionError) return;
    if ((transactionType === 'REFUND' || transactionType === 'ABATIMENTO') && selectedCustomerId) {
      const customer = customersWithBalance.find((c) => c.id === selectedCustomerId);
      if (customer) {
        const base = balanceBeforeEdit(customer.rawBalance, editTransactionData);
        const prompt = pastZeroPrompt({
          type: transactionType,
          name: customer.name,
          balance: base,
          amount,
          formatCurrency,
        });
        if (prompt && !window.confirm(prompt)) return;
      }
    }
    savingTransactionRef.current = true;
    setSavingTransaction(true);
    try {
      const formData = new FormData(e.currentTarget);
      let creditConfirmed = false;
      if (transactionType === 'PAYMENT') {
        const customer = customersWithBalance.find((c) => c.id === selectedCustomerId);
        if (customer) {
          const base = balanceBeforeEdit(customer.rawBalance, editTransactionData);
          const owedCents = Math.max(0, Math.round(base * 100));
          const amountCents = Math.round(amount * 100);
          if (owedCents - amountCents < 0) {
            const extra = (amountCents - owedCents) / 100;
            const owed = owedCents / 100;
            const confirmed = window.confirm(
              `${customer.name} devia ${formatCurrency(owed)}. Os ${formatCurrency(extra)} a mais vão ficar como crédito dele (você vai dever a ele). Confirmar?`,
            );
            if (!confirmed) return;
            creditConfirmed = true;
          }
        }
      }
      const method = formData.get('paymentMethod') as PaymentMethod;
      const dueDate = dueDateInput;
      const eventId = formData.get('eventId') as string;
      const attachmentFile = formData.get('attachment') as File;
      const attachmentFile2 = formData.get('attachment_file') as File;
      const finalAttachmentFile =
        attachmentFile && attachmentFile.size > 0
          ? attachmentFile
          : attachmentFile2 && attachmentFile2.size > 0
            ? attachmentFile2
            : null;

      let attachment: { data: string; mimeType: string; name: string } | undefined = undefined;
      if (finalAttachmentFile && finalAttachmentFile.size > 0) {
        const readFile = (file: File): Promise<string> =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        try {
          const dataUrl = await readFile(finalAttachmentFile);
          attachment = {
            data: dataUrl,
            mimeType: finalAttachmentFile.type,
            name: finalAttachmentFile.name,
          };
        } catch {
          /* ignore attachment errors */
        }
      }

      if (editTransactionData) {
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === editTransactionData.id
              ? {
                  ...tx,
                  amount,
                  description: desc,
                  paymentMethod: method,
                  type: transactionType,
                  dueDate: brDateInputToTimestamp(dueDate),
                  eventId: eventId || undefined,
                  ...(attachment ? { attachment } : {}),
                  ...(creditConfirmed ? { creditConfirmed: true } : {}),
                }
              : tx,
          ),
        );
        addAuditEntry(
          'UPDATE',
          'TRANSACTION',
          editTransactionData.id,
          `${user?.name} editou: ${desc} — R$ ${amount}`,
        );
        setEditTransactionData(null);
      } else {
        if (isInstallment && transactionType === 'DEBT') {
          const groupId = generateId();
          const principal = amount;
          const rate = hasInterest ? installmentInterestRate : 0;
          const installmentValue =
            Math.round(calcInstallment(principal, rate, installmentCount) * 100) / 100;
          const baseDueDate = brDateInputToTimestamp(dueDate) ?? Date.now() + 30 * 86400000;

          const installments: Transaction[] = Array.from({ length: installmentCount }, (_, i) => ({
            id: generateId(),
            customerId: selectedCustomerId,
            amount: installmentValue,
            type: 'DEBT' as TransactionType,
            description: `${desc} — Parcela ${i + 1}/${installmentCount}`,
            timestamp: Date.now() + i,
            dueDate: baseDueDate + i * 30 * 86400000,
            status: 'CONFIRMED' as const,
            eventId: eventId || undefined,
            installmentNumber: i + 1,
            totalInstallments: installmentCount,
            installmentGroupId: groupId,
            interestRate: hasInterest ? installmentInterestRate : undefined,
            ...(i === 0 && attachment ? { attachment } : {}),
          }));

          setTransactions((prev) => [...prev, ...installments]);
          addAuditEntry(
            'CREATE',
            'TRANSACTION',
            groupId,
            `${user?.name} lançou ${installmentCount} parcelas: ${desc}`,
          );
          setIsInstallment(false);
          setInstallmentCount(2);
          setHasInterest(false);
          setCurrentAmountValue(null);
        } else {
          const newId = generateId();
          setTransactions((prev) => [
            ...prev,
            {
              id: newId,
              customerId: selectedCustomerId,
              amount,
              type: transactionType,
              description: desc,
              timestamp: Date.now(),
              paymentMethod: method,
              dueDate: brDateInputToTimestamp(dueDate),
              status: 'CONFIRMED',
              eventId: eventId || undefined,
              ...(creditConfirmed ? { creditConfirmed: true } : {}),
              ...(attachment ? { attachment } : {}),
              ...(installmentPreFill
                ? {
                    installmentGroupId: installmentPreFill.installmentGroupId,
                    installmentNumber: installmentPreFill.installmentNumber,
                  }
                : {}),
            },
          ]);
          addAuditEntry(
            'CREATE',
            'TRANSACTION',
            newId,
            `${user?.name} criou: ${desc} — R$ ${amount}`,
          );
        }
      }
      if (!editTransactionData) {
        if (transactionType === 'DEBT') hapticMedium().catch(() => {});
        else if (transactionType === 'PAYMENT') hapticSuccess().catch(() => {});
      }
      setIsTransactionModalOpen(false);
      setCurrentAmountValue(null);
      setInstallmentPreFill(null);
    } finally {
      savingTransactionRef.current = false;
      setSavingTransaction(false);
    }
  };

  const handleGoogleCallback = async (idToken: string, reactivate = false) => {
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id_token: idToken, ...(reactivate ? { reactivate: true } : {}) }),
      });
      const data = await res.json();
      if (data?.error?.code === 'ACCOUNT_CLOSED') {
        setRecoverAccount({ channel: 'google', idToken });
        return;
      }
      if (data?.error?.code === 'LEGAL_HOLD') {
        setRecoverAccount(null);
        setLoginError(data.error.message);
        return;
      }
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || data.message || 'Falha no login com Google');
      setRecoverAccount(null);
      skipFullscreenThisSession();
      setUser({
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        role: data.user.role,
        hasPassword: data.user.has_password === true,
      });
      setActiveView(AppView.DASHBOARD);
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao entrar com Google. Tente novamente.');
    }
  };

  const handleEmailLogin = async (email: string, password: string, reactivate = false) => {
    if (!email || !password) {
      setLoginError('Preencha e-mail e senha.');
      return;
    }
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, ...(reactivate ? { reactivate: true } : {}) }),
      });
      const data = await res.json();
      if (data?.error?.code === 'ACCOUNT_CLOSED') {
        setRecoverAccount({ channel: 'login' });
        return;
      }
      if (data?.error?.code === 'LEGAL_HOLD') {
        setRecoverAccount(null);
        setLoginError(data.error.message);
        return;
      }
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || data.message || 'E-mail ou senha incorretos');
      setRecoverAccount(null);
      skipFullscreenThisSession();
      setUser({
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        role: data.user.role,
        hasPassword: data.user.has_password === true,
      });
      setLoginError('');
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao fazer login. Tente novamente.');
    }
  };

  const handleRegister = async (
    name: string,
    email: string,
    password: string,
    reactivate = false,
  ) => {
    if (!name || !email || !password) {
      setLoginError('Preencha todos os campos.');
      return;
    }
    if (password.length < 8) {
      setLoginError('Senha deve ter ao menos 8 caracteres.');
      return;
    }
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: name.trim(),
          email,
          password,
          consent: true,
          ...(reactivate ? { reactivate: true } : {}),
        }),
      });
      const data = await res.json();
      if (data?.error?.code === 'ACCOUNT_CLOSED') {
        setRecoverAccount({ channel: 'register' });
        return;
      }
      if (data?.error?.code === 'LEGAL_HOLD') {
        setRecoverAccount(null);
        setLoginError(data.error.message);
        return;
      }
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || data.message || 'Erro ao criar conta');
      setRecoverAccount(null);
      skipFullscreenThisSession();
      setUser({
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        role: data.user.role,
        hasPassword: data.user.has_password === true,
      });
      setLoginError('');
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao criar conta. Tente novamente.');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      setResetToken(token);
      setLoginMode('reset');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setLoginError('Digite seu e-mail.');
      return;
    }
    setLoginError('');
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch {
      setLoginError('Erro ao enviar. Tente novamente.');
    }
  };

  const handleResetPassword = async () => {
    if (!resetNewPassword || !resetConfirm) {
      setLoginError('Preencha os dois campos.');
      return;
    }
    if (resetNewPassword !== resetConfirm) {
      setLoginError('As senhas nao coincidem.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setLoginError('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: resetToken, password: resetNewPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || data.message || 'Token invalido ou expirado.');
      skipFullscreenThisSession();
      setUser({
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        role: data.user.role,
        hasPassword: data.user.has_password === true,
      });
    } catch (err: any) {
      setLoginError((err as any).message || 'Erro ao redefinir senha.');
    }
  };

  // Inicializar Google Identity Services quando login estiver visivel
  useEffect(() => {
    if (user || isAuthLoading) return;
    const tryInit = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id) {
        setTimeout(tryInit, 200);
        return;
      }
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: any) => handleGoogleCallback(resp.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (googleBtnRef.current) {
        g.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: googleBtnRef.current.offsetWidth || 340,
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      }
    };
    tryInit();
  }, [user, isAuthLoading, loginMode]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-10 rounded-t42xl shadow-2xl text-center space-y-6 animate-in fade-in zoom-in">
          <div className="bg-indigo-100 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto text-indigo-600">
            <Wallet className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">{t.loginTitle}</h1>
            <p className="text-slate-500 font-medium mt-2">
              {loginMode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}
            </p>
          </div>

          {recoverAccount && (
            <AccountClosedConfirm
              onConfirm={() => {
                if (recoverAccount.channel === 'login') {
                  void handleEmailLogin(loginEmail, loginPassword, true);
                } else if (recoverAccount.channel === 'google' && recoverAccount.idToken) {
                  void handleGoogleCallback(recoverAccount.idToken, true);
                } else {
                  void handleRegister(loginName, loginEmail, loginPassword, true);
                }
              }}
              onCancel={() => setRecoverAccount(null)}
            />
          )}

          {loginMode === 'login' && (
            <div className="space-y-4">
              <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 h-px bg-slate-100"></div>
                <span className="text-[10px] font-black text-slate-300 uppercase">ou</span>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>
              <div className="space-y-3 text-left">
                <input
                  type="email"
                  placeholder="E-mail"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
                />
                <input
                  type="password"
                  placeholder="Senha"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
                />
                {loginError && <p className="text-red-500 text-sm font-bold">{loginError}</p>}
                <button
                  onClick={() => handleEmailLogin(loginEmail, loginPassword)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl"
                >
                  Entrar
                </button>
                <button
                  onClick={() => {
                    setLoginMode('forgot');
                    setLoginError('');
                    setForgotSent(false);
                  }}
                  className="w-full text-center text-slate-400 text-sm font-bold hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <button
                onClick={() => {
                  setLoginMode('register');
                  setLoginError('');
                }}
                className="text-indigo-600 text-sm font-bold hover:underline"
              >
                Criar conta →
              </button>
            </div>
          )}
          {loginMode === 'register' && (
            <div className="space-y-3 text-left">
              <input
                type="text"
                placeholder="Seu nome"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
              />
              <input
                type="email"
                placeholder="E-mail"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
              />
              <input
                type="password"
                placeholder="Senha (min. 6 caracteres)"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
              />
              {loginError && <p className="text-red-500 text-sm font-bold">{loginError}</p>}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 13,
                  color: '#64748b',
                }}
              >
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  Li e aceito a{' '}
                  <a href="/privacidade" target="_blank" style={{ color: '#4f46e5' }}>
                    Política de Privacidade
                  </a>{' '}
                  e os{' '}
                  <a href="/termos" target="_blank" style={{ color: '#4f46e5' }}>
                    Termos de Uso
                  </a>
                </span>
              </label>
              <button
                onClick={() => handleRegister(loginName, loginEmail, loginPassword)}
                disabled={!consentAccepted}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Criar Conta
              </button>
              <button
                onClick={() => {
                  setLoginMode('login');
                  setLoginError('');
                  setConsentAccepted(false);
                }}
                className="w-full text-center text-slate-400 text-sm font-bold hover:underline"
              >
                ← Voltar para login
              </button>
            </div>
          )}
          {loginMode === 'forgot' && (
            <div className="space-y-4 text-left">
              {forgotSent ? (
                <div className="text-center py-4">
                  <p className="text-green-600 font-bold text-base">E-mail enviado!</p>
                  <p className="text-slate-500 text-sm mt-2">
                    Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-500 text-sm">
                    Digite seu e-mail e enviaremos um link para redefinir sua senha.
                  </p>
                  <input
                    type="email"
                    placeholder="E-mail"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
                  />
                  {loginError && <p className="text-red-500 text-sm font-bold">{loginError}</p>}
                  <button
                    onClick={handleForgotPassword}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl"
                  >
                    Enviar link
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setLoginMode('login');
                  setLoginError('');
                }}
                className="w-full text-center text-slate-400 text-sm font-bold hover:underline"
              >
                ← Voltar para login
              </button>
            </div>
          )}
          {loginMode === 'reset' && (
            <div className="space-y-3 text-left">
              <p className="text-slate-500 text-sm">Digite sua nova senha.</p>
              <input
                type="password"
                placeholder="Nova senha (min. 8 caracteres)"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
              />
              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 rounded-xl border-none font-bold"
              />
              {loginError && <p className="text-red-500 text-sm font-bold">{loginError}</p>}
              <button
                onClick={handleResetPassword}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl"
              >
                Redefinir senha
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedCustomer = customersWithBalance.find((c) => c.id === selectedCustomerId);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {showsFullscreenAd(catalog?.adPolicy) && (
        <AdBanner
          onUpgrade={() => {
            if (canShowCheckout()) {
              setPlanLimitReason(null);
              setIsUpgradeModalOpen(true);
            }
          }}
          t={t}
        />
      )}
      {isOffline && (
        <div
          style={{
            background: '#ef4444',
            color: '#fff',
            textAlign: 'center',
            padding: '8px',
            fontSize: 13,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
          }}
        >
          Sem conexão com a internet. Algumas funções podem não funcionar.
        </div>
      )}
      <div className="flex-1 min-h-0">
        <Layout
          activeView={activeView}
          setActiveView={setActiveView}
          language={language}
          setLanguage={setLanguage}
          isPro={plan.hasAI}
          onUpgrade={() => {
            if (canShowCheckout()) {
              setPlanLimitReason(null);
              setIsUpgradeModalOpen(true);
            }
          }}
          user={user}
          onLogout={() => {
            resetSyncState();
            setUser(null);
          }}
          refundsCount={
            customersWithBalance.filter(
              (c) => c.rawBalance < 0 && c.overpaymentStrategy === 'RETURN',
            ).length
          }
          pendingCount={transactions.filter((tx) => tx.status === 'PENDING').length}
          ownerExpensesCount={ownerExpenses.filter((e) => !e.isPaid).length}
          inboxCount={inboxCount}
          isAdmin={user?.role === 'admin'}
        >
          {activeView === AppView.DASHBOARD && (
            <DashboardView
              stats={stats}
              formatCurrency={formatCurrency}
              navigateToCustomer={navigateToCustomer}
              setActiveView={setActiveView}
              isPro={isPro}
              adPlan={
                user?.role === 'admin'
                  ? 'admin'
                  : plan.type === 'PRO'
                    ? 'pro'
                    : plan.type === 'ENTERPRISE'
                      ? 'enterprise'
                      : 'free'
              }
              flowOpen={
                isQuickAddOpen
                || isCustomerModalOpen
                || isEditCustomerModalOpen
                || isTransactionModalOpen
                || isUpgradeModalOpen
              }
              t={t}
              userName={user?.name}
              customersWithBalance={customersWithBalance}
              onNewDebt={() => {
                setQuickAddType('DEBT');
                setQuickAddStep(2);
                setQuickAddSearch('');
                setIsQuickAddOpen(true);
              }}
              onReceive={() => {
                setQuickAddType('PAYMENT');
                setQuickAddStep(2);
                setQuickAddSearch('');
                setIsQuickAddOpen(true);
              }}
              onNewCustomer={() => setIsCustomerModalOpen(true)}
              transactions={transactions}
              onOpenCustomer={navigateToCustomer}
              canUpgrade={canShowCheckout()}
              onUpgrade={() => {
                if (canShowCheckout()) setIsUpgradeModalOpen(true);
              }}
              language={language}
              onLanguage={() => setLanguage(language === 'pt-BR' ? 'en' : 'pt-BR')}
            />
          )}
          {activeView === AppView.CUSTOMERS && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <SearchField
                  label={t.searchPlaceholder}
                  value={searchTerm}
                  onChange={setSearchTerm}
                />
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all"
                >
                  <UserPlus className="w-6 h-6" /> {t.addCustomer}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customersWithBalance
                  .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((c) => (
                    <div
                      key={c.id}
                      onClick={() => navigateToCustomer(c.id)}
                      className="bg-white p-8 rounded-t42xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-5 mb-8">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {c.name}
                          </h3>
                          <p className="text-xs text-slate-400 font-bold">{c.phone ? formatPhoneDisplay(c.phone) : ''}</p>
                          {c.counterpartClosed && (
                            <p className="text-xs font-bold text-amber-700">conta encerrada</p>
                          )}
                        </div>
                      </div>
                      <div className="pt-6 border-t border-slate-50 flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
                            {t.pendingBalance}
                          </p>
                          <p
                            className={`text-2xl font-black ${c.rawBalance > 0 ? 'text-red-600' : c.rawBalance < 0 ? 'text-green-600' : 'text-slate-400'}`}
                          >
                            {balanceDirection(c.rawBalance, formatCurrency).text}
                          </p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-indigo-600 transition-all" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {activeView === AppView.CUSTOMER_DETAIL && (
            <CustomerDetailView
              selectedCustomer={selectedCustomer}
              transactions={transactions}
              setTransactions={setTransactions}
              setActiveView={setActiveView}
              setTransactionType={setTransactionType}
              setIsTransactionModalOpen={(v: boolean) => {
                if (v) setInstallmentInterestRate(user?.defaultInterestRate || 2.5);
                setIsTransactionModalOpen(v);
              }}
              handleGetAdvice={handleGetAdvice}
              isAILoading={isAILoading}
              aiAdvice={aiAdvice}
              isPro={isPro}
              setIsUpgradeModalOpen={() => {
                if (canShowCheckout()) {
                  setPlanLimitReason(null);
                  setIsUpgradeModalOpen(true);
                }
              }}
              handleShareWhatsApp={handleShareWhatsApp}
              deleteCustomer={(id: string) => {
                setCustomers((prev) => prev.filter((c) => c.id !== id));
                setActiveView(AppView.CUSTOMERS);
              }}
              setIsEditCustomerModalOpen={() => setIsEditCustomerModalOpen(true)}
              setCustomers={setCustomers}
              formatCurrency={formatCurrency}
              language={language}
              t={t}
              events={events}
              setEditTransactionData={setEditTransactionData}
              setIsNotesModalOpen={setIsNotesModalOpen}
              handleUpdateNote={handleUpdateNote}
              editingNoteId={editingNoteId}
              setEditingNoteId={setEditingNoteId}
              editingNoteText={editingNoteText}
              setEditingNoteText={setEditingNoteText}
              onPayInstallment={(tx: Transaction, group: InstallmentGroup) => {
                setInstallmentPreFill({
                  amount: tx.amount,
                  description: `Pagamento Parcela ${tx.installmentNumber}/${tx.totalInstallments} - ${group.baseDescription}`,
                  installmentGroupId: group.groupId,
                  installmentNumber: tx.installmentNumber!,
                });
                setTransactionType('PAYMENT');
                setEditTransactionData(null);
                setInstallmentInterestRate(user?.defaultInterestRate || 2.5);
                setIsTransactionModalOpen(true);
              }}
            />
          )}
          {activeView === AppView.SPLIT_BILL && (
            <SplitBillView
              events={events}
              setEvents={setEvents}
              setIsEventModalOpen={(open: boolean) => {
                if (open && Number.isFinite(plan.maxEvents) && events.length >= plan.maxEvents) {
                  showPlanLimit('eventos', plan.maxEvents);
                  return;
                }
                setIsEventModalOpen(open);
              }}
              setSelectedEventId={setSelectedEventId}
              setActiveView={setActiveView}
              formatCurrency={formatCurrency}
              t={t}
              setTransactions={setTransactions}
              setDebts={setDebts}
            />
          )}
          {activeView === AppView.EVENT_DETAIL && (
            <EventDetailView
              selectedEventId={selectedEventId}
              events={events}
              setEvents={setEvents}
              setActiveView={setActiveView}
              customers={customers}
              setCustomers={setCustomers}
              transactions={transactions}
              setTransactions={setTransactions}
              debts={debts}
              setDebts={setDebts}
              setOwnerExpenses={setOwnerExpenses}
              formatCurrency={formatCurrency}
              t={t}
              user={user}
              addAuditEntry={addAuditEntry}
              maxParticipantsPerEvent={plan.maxParticipantsPerEvent}
              onParticipantsLimit={() =>
                showPlanLimit('participantes', plan.maxParticipantsPerEvent)
              }
            />
          )}
          {activeView === AppView.RECEIVABLES_LIST && (
            <ReceivablesListView
              receivables={customersWithBalance
                .filter((c) => c.rawBalance > 0)
                .sort((a, b) => b.rawBalance - a.rawBalance)}
              formatCurrency={formatCurrency}
              navigateToCustomer={navigateToCustomer}
              t={t}
            />
          )}
          {activeView === AppView.DEBTORS_LIST && (
            <DebtorsListView
              debts={debts}
              setDebts={setDebts}
              customers={customers}
              events={events}
              formatCurrency={formatCurrency}
              navigateToCustomer={navigateToCustomer}
              t={t}
              setTransactions={setTransactions}
            />
          )}

          {activeView === AppView.TO_PAY && (
            <ToPayView
              customers={customersWithBalance}
              formatCurrency={formatCurrency}
              navigateToCustomer={navigateToCustomer}
              t={t}
              setTransactions={setTransactions}
            />
          )}
          {activeView === AppView.NOTIFICATIONS && (
            <NotificationsView
              transactions={transactions}
              setTransactions={setTransactions}
              customers={customers}
              formatCurrency={formatCurrency}
              t={t}
              user={user}
              setAuditLog={setAuditLog}
            />
          )}
          {activeView === AppView.INBOX && (
            <InboxAprovacoes
              formatCurrency={formatCurrency}
              onChanged={() => {
                void refreshInbox();
              }}
            />
          )}
          {activeView === AppView.MY_DEBTS && <MinhasDividas formatCurrency={formatCurrency} />}
          {activeView === AppView.AUDIT_LOG && <AuditLogView auditLog={auditLog} t={t} />}
          {activeView === AppView.INSIGHTS && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-indigo-900 text-white p-10 rounded-t42xl shadow-xl">
                <h2 className="text-3xl font-black mb-4 flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-amber-400" /> {t.insights}
                </h2>
                <p className="text-indigo-200 text-lg mb-8 leading-relaxed">
                  {t.aiBusinessDescription}
                </p>
                <button
                  onClick={async () => {
                    setIsAILoading(true);
                    const adv = await getGeneralBusinessAdvice(
                      stats.totalReceivable,
                      stats.activeDebtors,
                      language,
                    );
                    setAIAdvice(adv);
                    setIsAILoading(false);
                  }}
                  disabled={isAILoading}
                  className="bg-indigo-600 hover:bg-white text-white hover:text-indigo-900 px-8 py-4 rounded-2xl font-black transition-all flex items-center gap-3"
                >
                  {isAILoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  {t.generateTips}
                </button>
                {aiAdvice && (
                  <div className="mt-10 p-8 bg-white/5 rounded-3xl backdrop-blur-sm border border-white/10 whitespace-pre-wrap leading-loose text-indigo-50">
                    {aiAdvice}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === AppView.PROFILE && (
            <ProfileView
              user={user}
              setUser={setUser}
              t={t}
              setActiveView={setActiveView}
              onExport={handleExportData}
              onImport={handleImportData}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeView === AppView.MY_EXPENSES && (
            <MyExpensesView
              ownerExpenses={ownerExpenses}
              setOwnerExpenses={setOwnerExpenses}
              formatCurrency={formatCurrency}
              t={t}
            />
          )}
          {activeView === AppView.CUSTOMER_MANAGEMENT && (
            <CustomerManagementView
              customersWithBalance={customersWithBalance}
              transactions={transactions}
              navigateToCustomer={navigateToCustomer}
              formatCurrency={formatCurrency}
            />
          )}
          {activeView === AppView.HELP && <HelpView />}
          {activeView === AppView.STATEMENT && (
            <StatementView
              transactions={transactions}
              customers={customers}
              formatCurrency={formatCurrency}
            />
          )}
          {activeView === AppView.MENU && (
            <MenuView
              isAdmin={user?.role === 'admin'}
              isPro={plan.hasAI}
              onOpen={setActiveView}
              onUpgrade={() => {
                if (canShowCheckout()) {
                  setPlanLimitReason(null);
                  setIsUpgradeModalOpen(true);
                }
              }}
              onLogout={() => {
                resetSyncState();
                setUser(null);
              }}
            />
          )}
          {activeView === AppView.ADMIN && user && adminPanelFor(user.role) && (
            <AdminPanel currentUserId={user.id} />
          )}
        </Layout>
        {showQuickFab(activeView) && (
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="fp-fab"
            title="Acesso Rápido"
            aria-label="Acesso rápido"
          >
            <Plus className="w-8 h-8" />
          </button>
        )}

        {isQuickAddOpen && (
          <FullScreenModal>
            <div
              className="fp-page-slide"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PageHeader
                title={
                  quickAddStep === 1
                    ? 'Acesso rápido'
                    : quickAddType === 'DEBT'
                      ? 'Nova dívida — selecione o cliente'
                      : 'Receber — selecione o cliente'
                }
                onBack={() => {
                  if (quickAddStep === 2) {
                    setQuickAddStep(1);
                  } else {
                    setIsQuickAddOpen(false);
                    setQuickAddSearch('');
                    setQuickAddStep(1);
                  }
                }}
              />
              {/* Content */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
                  {quickAddStep === 1 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {[
                        {
                          type: 'DEBT' as const,
                          icon: <ArrowUpRight style={{ width: 36, height: 36 }} />,
                          label: 'Lançar Dívida',
                          sub: 'Registrar fiado',
                          bg: '#FEF2F2',
                          border: '#FECACA',
                          color: '#DC2626',
                        },
                        {
                          type: 'PAYMENT' as const,
                          icon: <ArrowDownLeft style={{ width: 36, height: 36 }} />,
                          label: 'Receber Pagamento',
                          sub: 'Registrar recebimento',
                          bg: '#F0FDF4',
                          border: '#BBF7D0',
                          color: '#16A34A',
                        },
                      ].map((btn) => (
                        <button
                          key={btn.type}
                          onClick={() => {
                            setQuickAddType(btn.type);
                            setQuickAddStep(2);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                            padding: '28px 16px',
                            background: btn.bg,
                            border: `2px solid ${btn.border}`,
                            borderRadius: 24,
                            cursor: 'pointer',
                            color: btn.color,
                            transition: 'transform 150ms',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                        >
                          {btn.icon}
                          <div>
                            <p style={{ fontWeight: 900, fontSize: 15, margin: 0 }}>{btn.label}</p>
                            <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                              {btn.sub}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div style={{ position: 'relative', marginBottom: 16 }}>
                        <Search
                          style={{
                            position: 'absolute',
                            left: 14,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 18,
                            height: 18,
                            color: '#94A3B8',
                          }}
                        />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Buscar cliente pelo nome..."
                          value={quickAddSearch}
                          onChange={(e) => setQuickAddSearch(e.target.value)}
                          style={{
                            width: '100%',
                            paddingLeft: 44,
                            paddingRight: 16,
                            paddingTop: 14,
                            paddingBottom: 14,
                            background: 'white',
                            border: '1.5px solid #E2E8F0',
                            borderRadius: 14,
                            fontSize: 15,
                            fontWeight: 600,
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                          onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {customers
                          .filter(
                            (c) =>
                              !quickAddSearch.trim() ||
                              c.name.toLowerCase().includes(quickAddSearch.toLowerCase()),
                          )
                          .slice(0, 12)
                          .map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setIsQuickAddOpen(false);
                                setQuickAddSearch('');
                                setQuickAddStep(1);
                                navigateToCustomer(c.id);
                                if (c.counterpartClosed) return;
                                setTransactionType(quickAddType);
                                setEditTransactionData(null);
                                setInstallmentInterestRate(user?.defaultInterestRate || 2.5);
                                setIsTransactionModalOpen(true);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                padding: '14px 16px',
                                background: 'white',
                                border: '1px solid #EAEAE5',
                                borderRadius: 16,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 150ms',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.borderColor =
                                  '#C7D2FE';
                                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                                  '0 2px 8px rgba(99,102,241,0.1)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.borderColor =
                                  '#F1F5F9';
                                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                              }}
                            >
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 14,
                                  background: '#ECEDF7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 600,
                                  fontSize: 15,
                                  color: '#2B2F77',
                                  flexShrink: 0,
                                }}
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1 }}>
                                <p
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 15,
                                    color: '#1A1A1A',
                                    margin: 0,
                                  }}
                                >
                                  {c.name}
                                </p>
                                <p style={{ fontSize: 13, color: '#5C5C5C', margin: '2px 0 0' }}>
                                  {c.counterpartClosed
                                    ? 'conta encerrada'
                                    : c.phone ? formatPhoneDisplay(c.phone) : 'Sem telefone'}
                                </p>
                              </div>
                              <ChevronRight
                                style={{ width: 16, height: 16, color: '#CBD5E1', flexShrink: 0 }}
                              />
                            </button>
                          ))}
                        {quickAddSearch.trim() &&
                          customers.filter((c) =>
                            c.name.toLowerCase().includes(quickAddSearch.toLowerCase()),
                          ).length === 0 && (
                            <button
                              onClick={() => {
                                setPendingNewCustomerName(quickAddSearch);
                                setPendingTransactionAfterCreate(true);
                                setIsQuickAddOpen(false);
                                setQuickAddSearch('');
                                setQuickAddStep(1);
                                setIsCustomerModalOpen(true);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                padding: '14px 16px',
                                background: '#EEF2FF',
                                border: '2px dashed #C7D2FE',
                                borderRadius: 16,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 14,
                                  background: '#6366F1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <UserPlus style={{ width: 20, height: 20, color: 'white' }} />
                              </div>
                              <div>
                                <p style={{ fontWeight: 800, color: '#4F46E5', margin: 0 }}>
                                  Cadastrar &quot;{quickAddSearch}&quot;
                                </p>
                                <p style={{ fontSize: 12, color: '#6366F1', margin: '2px 0 0' }}>
                                  Novo cliente
                                </p>
                              </div>
                            </button>
                          )}
                        {!quickAddSearch.trim() && customers.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                            <Users style={{ width: 40, height: 40, margin: '0 auto 8px' }} />
                            <p style={{ fontWeight: 700 }}>Nenhum cliente cadastrado ainda</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </FullScreenModal>
        )}

        {isNotesModalOpen && selectedCustomer && (
          <FullScreenModal>
            <div
              className="fp-page-slide"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 16px',
                  height: 60,
                  flexShrink: 0,
                  background: '#2B2F77',
                }}
              >
                <button
                  onClick={() => setIsNotesModalOpen(false)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ArrowLeft style={{ width: 20, height: 20 }} />
                </button>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 17,
                      fontWeight: 900,
                      color: 'white',
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    {t.notesHistory}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                    {selectedCustomer.name}
                  </p>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
                  {/* Filter */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Filter
                        style={{
                          position: 'absolute',
                          left: 14,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 16,
                          height: 16,
                          color: '#94A3B8',
                        }}
                      />
                      <BrDateField
                        ariaLabel="Filtrar anotações por data"
                        value={noteFilterDate}
                        onChange={setNoteFilterDate}
                        style={{
                          width: '100%',
                          paddingLeft: 40,
                          paddingRight: 16,
                          paddingTop: 12,
                          paddingBottom: 12,
                          background: 'white',
                          border: '1.5px solid #E2E8F0',
                          borderRadius: 12,
                          fontWeight: 700,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {noteFilterDate && (
                      <button
                        onClick={() => setNoteFilterDate('')}
                        style={{
                          padding: '8px 16px',
                          fontSize: 11,
                          fontWeight: 900,
                          color: '#6366F1',
                          background: '#EEF2FF',
                          border: 'none',
                          borderRadius: 10,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                        }}
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  {/* Notes list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(selectedCustomer.notes || [])
                      .filter(
                        (n) =>
                          !noteFilterDate ||
                          formatBrDate(n.createdAt) === formatBrDate(noteFilterDate),
                      )
                      .slice()
                      .reverse()
                      .map((note: CustomerNote) => (
                        <div
                          key={note.id}
                          style={{
                            background: 'white',
                            borderRadius: 16,
                            border: '1px solid #E2E8F0',
                            padding: '20px 20px 16px',
                            position: 'relative',
                          }}
                        >
                          {editingNoteId === note.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                autoFocus
                                style={{
                                  width: '100%',
                                  padding: 14,
                                  background: '#F8FAFC',
                                  border: '1.5px solid #6366F1',
                                  borderRadius: 12,
                                  fontWeight: 700,
                                  fontSize: 14,
                                  outline: 'none',
                                  minHeight: 80,
                                  resize: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  style={{
                                    padding: '8px 16px',
                                    fontSize: 11,
                                    fontWeight: 900,
                                    color: '#94A3B8',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleUpdateNote(note.id)}
                                  style={{
                                    padding: '8px 16px',
                                    fontSize: 11,
                                    fontWeight: 900,
                                    color: 'white',
                                    background: '#6366F1',
                                    border: 'none',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p
                                style={{
                                  color: '#334155',
                                  fontWeight: 700,
                                  lineHeight: 1.6,
                                  whiteSpace: 'pre-wrap',
                                  paddingRight: 56,
                                  margin: 0,
                                }}
                              >
                                {note.text}
                              </p>
                              <p
                                style={{
                                  fontSize: 10,
                                  color: '#94A3B8',
                                  marginTop: 10,
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  marginBottom: 0,
                                }}
                              >
                                {formatBrDateTime(note.createdAt)}
                              </p>
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 16,
                                  right: 16,
                                  display: 'flex',
                                  gap: 4,
                                }}
                              >
                                <button
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingNoteText(note.text);
                                  }}
                                  style={{
                                    padding: 8,
                                    background: '#F1F5F9',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    color: '#6366F1',
                                    display: 'flex',
                                  }}
                                >
                                  <Edit3 style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(t.confirmDelete))
                                      setCustomers((prev) =>
                                        prev.map((c) =>
                                          c.id === selectedCustomer.id
                                            ? {
                                                ...c,
                                                notes: (c.notes || []).filter(
                                                  (n) => n.id !== note.id,
                                                ),
                                              }
                                            : c,
                                        ),
                                      );
                                  }}
                                  style={{
                                    padding: 8,
                                    background: '#FEF2F2',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    color: '#EF4444',
                                    display: 'flex',
                                  }}
                                >
                                  <Trash2 style={{ width: 14, height: 14 }} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    {(selectedCustomer.notes || []).length === 0 && (
                      <div
                        style={{
                          padding: '60px 0',
                          textAlign: 'center',
                          color: '#94A3B8',
                          fontStyle: 'italic',
                        }}
                      >
                        Nenhuma nota encontrada.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </FullScreenModal>
        )}

        {(isCustomerModalOpen || isEditCustomerModalOpen) && (
          <FullScreenModal>
            <div
              className="fp-page-slide"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PageHeader
                title={isEditCustomerModalOpen ? t.editCustomer : t.addNewCustomer}
                onBack={() => {
                  setDuplicateCustomer(null);
                  setCustomerFormWarning('');
                  setIsCustomerModalOpen(false);
                  setIsEditCustomerModalOpen(false);
                  setPendingTransactionAfterCreate(false);
                  setPendingNewCustomerName('');
                }}
              />
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
                  <form
                    noValidate
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (savingCustomerRef.current) return;
                      const fd = new FormData(e.currentTarget);
                      const name = String(fd.get('name') ?? '').trim();
                      if (!name) {
                        setCustomerNameError('Informe o nome');
                        return;
                      }
                      setCustomerNameError('');
                      savingCustomerRef.current = true;
                      setSavingCustomer(true);
                      try {
                        setCustomerFormWarning('');
                        const typedPhone = (fd.get('phone') as string).trim();
                        const typedDigits = typedPhone.replace(/\D/g, '');
                        const previousPhone =
                          (isEditCustomerModalOpen
                            ? customers.find((c) => c.id === selectedCustomerId)?.phone
                            : '') || '';
                        const phone =
                          previousPhone.replace(/\D/g, '') === typedDigits ? previousPhone : typedDigits;
                        const cData = {
                          name,
                          phone,
                          email: fd.get('email') as string,
                          pixKey: fd.get('pixKey') as string,
                        };
                        if (!cData.phone) {
                          showToast(t.phoneRequired);
                          return;
                        }
                        const ignoreId = isEditCustomerModalOpen ? selectedCustomerId : null;
                        const normalizedPhone = normalizeCustomerPhone(cData.phone);
                        const phoneOwner = normalizedPhone
                          ? customers.find(
                              (c) =>
                                c.id !== ignoreId &&
                                normalizeCustomerPhone(c.phone) === normalizedPhone,
                            )
                          : undefined;
                        if (!isEditCustomerModalOpen && !canAddCustomer() && !phoneOwner) {
                          showPlanLimit('clientes', plan.maxCustomers);
                          return;
                        }
                        if (phoneOwner) {
                          setDuplicateCustomer({
                            id: phoneOwner.id,
                            message: `Já existe ${phoneOwner.name} com esse número`,
                          });
                          return;
                        }
                        setDuplicateCustomer(null);
                        const sameName = customers.find(
                          (c) =>
                            c.id !== ignoreId &&
                            c.name.trim().toLowerCase() === cData.name.trim().toLowerCase(),
                        );
                        if (sameName) {
                          showToast(`Já existe ${sameName.name} com esse nome. O cadastro segue.`);
                        }
                        const editing = isEditCustomerModalOpen;
                        const existing = editing
                          ? customers.find((c) => c.id === selectedCustomerId)
                          : undefined;
                        const draftId = editing ? selectedCustomerId || '' : generateId();
                        const draft = {
                          ...(existing ?? {
                            notes: [],
                            createdAt: Date.now(),
                            overpaymentStrategy: 'PROFIT' as const,
                          }),
                          ...cData,
                          id: draftId,
                        };
                        if (user && draftId) {
                          const saved = await saveCustomerToServer(
                            draft,
                            editing && Boolean(existing),
                          );
                          if (saved && saved !== 'offline') {
                            if (
                              saved.message === 'Esse telefone é o seu.' ||
                              saved.message === 'Esse e-mail é o seu.'
                            ) {
                              setCustomerFormWarning(saved.message);
                              return;
                            }
                            if (saved.code === 'PLAN_LIMIT') {
                              showPlanLimit(
                                'clientes',
                                limitCountFromServer(saved.message, plan.maxCustomers),
                              );
                              return;
                            }
                            if (saved.code === 'DUPLICATE_PHONE' && saved.existingCustomerId) {
                              setDuplicateCustomer({
                                id: saved.existingCustomerId,
                                message: saved.message,
                              });
                              return;
                            }
                            showToast(saved.message);
                            return;
                          }
                        }
                        if (isEditCustomerModalOpen) {
                          setCustomers((prev) =>
                            prev.map((c) => (c.id === selectedCustomerId ? { ...c, ...cData } : c)),
                          );
                          addAuditEntry(
                            'UPDATE',
                            'CUSTOMER',
                            selectedCustomerId || '',
                            `${user?.name} editou cliente: ${cData.name}`,
                          );
                        } else {
                          const newId = draftId;
                          setCustomers((prev) => [
                            ...prev,
                            {
                              id: newId,
                              ...cData,
                              notes: [],
                              createdAt: draft.createdAt,
                              overpaymentStrategy: 'PROFIT',
                            },
                          ]);
                          addAuditEntry(
                            'CREATE',
                            'CUSTOMER',
                            newId,
                            `${user?.name} cadastrou cliente: ${cData.name}`,
                          );
                          if (pendingTransactionAfterCreate) {
                            setSelectedCustomerId(newId);
                            setActiveView(AppView.CUSTOMER_DETAIL);
                            setTransactionType(quickAddType);
                            setEditTransactionData(null);
                            setInstallmentInterestRate(user?.defaultInterestRate || 2.5);
                            setTimeout(() => setIsTransactionModalOpen(true), 100);
                            setPendingTransactionAfterCreate(false);
                            setPendingNewCustomerName('');
                          }
                        }
                        setIsCustomerModalOpen(false);
                        setIsEditCustomerModalOpen(false);
                      } finally {
                        savingCustomerRef.current = false;
                        setSavingCustomer(false);
                      }
                    }}
                    className="fp-customer-form"
                  >
                    {[
                      {
                        title: 'Dados do cliente',
                        fields: [
                          {
                            label: t.fullName,
                            name: 'name',
                            type: 'text',
                            defaultValue: isEditCustomerModalOpen
                              ? customers.find((c) => c.id === selectedCustomerId)?.name
                              : pendingTransactionAfterCreate
                                ? pendingNewCustomerName
                                : '',
                            placeholder: 'Nome completo',
                            autoFocus: true,
                            help: 'Como você chama este cliente.',
                          },
                          {
                            label: t.phoneNumber,
                            name: 'phone',
                            type: 'tel',
                            defaultValue: isEditCustomerModalOpen
                              ? formatPhoneDisplay(customers.find((c) => c.id === selectedCustomerId)?.phone)
                              : '',
                            placeholder: '(00) 00000-0000',
                            autoFocus: false,
                            help: 'Com DDD, para não perder o cadastro.',
                          },
                        ],
                      },
                      {
                        title: 'Contato e Pix',
                        fields: [
                          {
                            label: t.email,
                            name: 'email',
                            type: 'email',
                            defaultValue: isEditCustomerModalOpen
                              ? customers.find((c) => c.id === selectedCustomerId)?.email
                              : '',
                            placeholder: 'email@exemplo.com',
                            autoFocus: false,
                            help: 'Opcional.',
                          },
                          {
                            label: t.pixKeyLabel,
                            name: 'pixKey',
                            type: 'text',
                            defaultValue: isEditCustomerModalOpen
                              ? customers.find((c) => c.id === selectedCustomerId)?.pixKey
                              : '',
                            placeholder: t.pixKeyPlaceholder,
                            autoFocus: false,
                            help: 'Opcional.',
                          },
                        ],
                      },
                    ].map((section) => (
                      <div key={section.title} className="fp-form-card">
                        <h2>{section.title}</h2>
                        {section.fields.map((field) => (
                          <label key={field.name} className="fp-field">
                            {field.label}
                            <input
                              name={field.name}
                              aria-label={field.label}
                              onInput={() => {
                                if (field.name === 'name') setCustomerNameError('');
                              }}
                              type={field.type}
                              defaultValue={field.defaultValue || ''}
                              placeholder={field.placeholder}
                              autoFocus={field.autoFocus}
                            />
                            <small>{field.help}</small>
                            {field.name === 'name' && customerNameError ? (
                              <p role="alert" style={{ color: '#DC2626', fontWeight: 700, marginTop: 8 }}>
                                {customerNameError}
                              </p>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    ))}
                    {customerFormWarning && (
                      <p
                        role="alert"
                        style={{ color: '#b45309', fontWeight: 700, marginBottom: 12 }}
                      >
                        {customerFormWarning}
                      </p>
                    )}
                    {duplicateCustomer && (
                      <DuplicateCustomerNotice
                        message={duplicateCustomer.message}
                        onOpen={() => openExistingCustomer(duplicateCustomer.id)}
                      />
                    )}
                    <div className="fp-save-dock">
                    <SaveButton
                      saving={savingCustomer}
                      label={isEditCustomerModalOpen ? 'Salvar alterações' : 'Salvar'}
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: 16,
                        border: 'none',
                        cursor: savingCustomer ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: 15,
                        color: 'white',
                        background: '#2B2F77',
                        boxShadow: 'none',
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: savingCustomer ? 0.7 : 1,
                      }}
                    />
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </FullScreenModal>
        )}

        {isTransactionModalOpen && (
          <FullScreenModal>
            <div
              className="fp-page-slide"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PageHeader
                title={
                  editTransactionData
                    ? 'Editar lançamento'
                    : transactionType === 'DEBT'
                      ? t.addDebt
                      : transactionType === 'PAYMENT'
                        ? t.addPayment
                        : transactionType === 'ABATIMENTO'
                          ? 'Abatimento'
                          : transactionType === 'REFUND'
                            ? 'Devolução'
                            : t.addPayment
                }
                subtitle={selectedCustomer?.name || ''}
                onBack={() => {
                  setIsTransactionModalOpen(false);
                  setInstallmentPreFill(null);
                }}
              />
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
                  {selectedCustomer && (
                    <CurrentBalanceBanner
                      rawBalance={selectedCustomer.rawBalance}
                      formatCurrency={formatCurrency}
                    />
                  )}
                  <form noValidate onSubmit={addTransaction} className="fp-entry space-y-6">
                    {installmentPreFill && (
                      <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <p className="text-xs font-black text-indigo-700">
                          Pagamento de parcela {installmentPreFill.installmentNumber} pré-preenchido
                        </p>
                      </div>
                    )}
                    <div className="fp-form-card">
                      <h2>Valor e descrição</h2>
                      <label className="fp-label">
                        {t.amount} (R$)
                      </label>
                      <CurrencyInput
                        aria-label={t.amount}
                        value={currentAmountValue}
                        autoFocus
                        onChange={(next) => {
                          setCurrentAmountValue(next);
                          if (amountError) setAmountError('');
                        }}
                        className="w-full px-5 py-4 bg-white border border-[#EAEAE5] rounded-xl text-base font-medium focus:outline-none focus:border-[#2B2F77]"
                      />
                      {amountError ? (
                        <p role="alert" className="text-sm font-bold text-red-600 mt-2">
                          {amountError}
                        </p>
                      ) : null}
                      {transactionType === 'PAYMENT' &&
                        selectedCustomer &&
                        selectedCustomer.rawBalance > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const valor = Math.round(selectedCustomer.rawBalance * 100) / 100;
                              setCurrentAmountValue(valor);
                              setAmountError('');
                            }}
                            className="mt-3 w-full py-3 rounded-2xl font-black text-base text-white"
                            style={{ background: '#2B2F77' }}
                          >
                            Quitar
                          </button>
                        )}
                      {selectedCustomer && (
                        <WholeBalanceButton
                          type={transactionType}
                          rawBalance={balanceBeforeEdit(
                            selectedCustomer.rawBalance,
                            editTransactionData,
                          )}
                          onFill={(valor) => {
                            setCurrentAmountValue(valor);
                            setAmountError('');
                          }}
                        />
                      )}
                    <div>
                      <label className="fp-label">
                        {t.description}
                      </label>
                      <input
                        aria-label={t.description}
                        name="description"
                        value={draftDescription}
                        onChange={(e) => {
                          setDraftDescription(e.target.value);
                          if (descriptionError) setDescriptionError('');
                        }}
                        className="w-full px-5 py-4 bg-white border-2 border-[#CCD2E9] rounded-t42md font-bold focus:outline-none focus:border-[#5967D8]"
                      />
                      {descriptionError ? (
                        <p role="alert" className="text-sm font-bold text-red-600 mt-2">
                          {descriptionError}
                        </p>
                      ) : null}
                      {transactionType === 'ABATIMENTO' && (
                        <p className="text-xs text-purple-600 font-bold mt-1">
                          Ex: Recebido em mercadoria, serviço prestado, troca, etc.
                        </p>
                      )}
                    </div>
                    </div>
                    <div className="fp-form-card">
                      <h2>Vencimento e evento</h2>
                      <label className="fp-label">
                        {t.relatedEvent}
                      </label>
                      <select
                        name="eventId"
                        defaultValue={editTransactionData?.eventId || ''}
                        className="w-full px-5 py-3 bg-white border-2 border-[#CCD2E9] rounded-t42md font-bold focus:outline-none focus:border-[#5967D8]"
                      >
                        <option value="">Nenhum evento</option>
                        {/* Alteração crítica: Mostrar TODOS os eventos para permitir vínculo retroativo */}
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name} ({formatBrDate(ev.date)})
                          </option>
                        ))}
                      </select>
                    {transactionType === 'DEBT' ? (
                      <div>
                        <label className="fp-label">
                          {t.dueDate}
                        </label>
                        <BrDateField
                          ariaLabel={t.dueDate}
                          value={dueDateInput}
                          onChange={setDueDateInput}
                          className="w-full px-5 py-3 bg-white border-2 border-[#CCD2E9] rounded-t42md font-bold focus:outline-none focus:border-[#5967D8]"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="fp-label">
                          {t.paymentMethod}
                        </label>
                        <select
                          name="paymentMethod"
                          className="w-full px-5 py-3 bg-white border-2 border-[#CCD2E9] rounded-t42md font-bold focus:outline-none focus:border-[#5967D8]"
                        >
                          <option value="PIX">Pix</option>
                          <option value="CREDIT_CARD">Cartão Crédito</option>
                          <option value="DEBIT_CARD">Cartão Débito</option>
                          <option value="COMPENSATION">{t.compensation}</option>
                        </select>
                      </div>
                    )}
                    </div>
                    <div className="fp-form-card">
                      <h2>Comprovante</h2>
                      <label className="fp-label">
                        Comprovante (opcional)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="fp-file-btn">
                          <Camera className="w-4 h-4" />
                          <span>Tirar foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            name="attachment"
                            className="hidden"
                          />
                        </label>
                        <label className="fp-file-btn">
                          <Upload className="w-4 h-4" />
                          <span>Escolher arquivo</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            name="attachment_file"
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                    {transactionType === 'DEBT' && !editTransactionData && (
                      <div className="fp-form-card">
                        <h2>Parcelamento</h2>
                        <Switch
                          checked={isInstallment}
                          onChange={setIsInstallment}
                          label="Compra parcelada"
                        />
                        {isInstallment && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <label className="fp-label">
                                  Parcelas
                                </label>
                                <select
                                  value={installmentCount}
                                  onChange={(e) => setInstallmentCount(parseInt(e.target.value))}
                                  className="w-full px-4 py-3 bg-white rounded-xl border-none font-black text-lg"
                                >
                                  {Array.from({ length: 24 }, (_, i) => i + 2).map((n) => (
                                    <option key={n} value={n}>
                                      {n}x
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="fp-label">
                                  Valor/parcela
                                </label>
                                <p className="px-4 py-3 bg-white rounded-xl font-black text-lg text-indigo-600">
                                  {currentAmountValue != null && currentAmountValue > 0 ? (
                                    formatCurrency(
                                      Math.round(
                                        calcInstallment(
                                          currentAmountValue,
                                          hasInterest ? installmentInterestRate : 0,
                                          installmentCount,
                                        ) * 100,
                                      ) / 100,
                                    )
                                  ) : (
                                    <span className="text-slate-300 text-base font-bold">
                                      Informe o valor
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {currentAmountValue != null &&
                              currentAmountValue > 0 &&
                              (() => {
                                const installmentVal =
                                  Math.round(
                                    calcInstallment(
                                      currentAmountValue,
                                      hasInterest ? installmentInterestRate : 0,
                                      installmentCount,
                                    ) * 100,
                                  ) / 100;
                                const total =
                                  Math.round(installmentVal * installmentCount * 100) / 100;
                                const interest =
                                  Math.round((total - currentAmountValue) * 100) / 100;
                                return (
                                  <div className="flex items-center justify-between px-2 py-2 bg-white/60 rounded-xl text-xs font-bold text-slate-500">
                                    <span>
                                      Total:{' '}
                                      <span className="text-slate-800">
                                        {formatCurrency(total)}
                                      </span>
                                    </span>
                                    {hasInterest && interest > 0 && (
                                      <span className="text-amber-600">
                                        Juros: +{formatCurrency(interest)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            <Switch
                              checked={hasInterest}
                              onChange={setHasInterest}
                              label="Cobrar juros compostos"
                            />
                            {hasInterest && (
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <label className="fp-label">
                                    Taxa % ao mês
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={installmentInterestRate}
                                    onChange={(e) =>
                                      setInstallmentInterestRate(parseFloat(e.target.value) || 0)
                                    }
                                    className="w-full px-4 py-3 bg-white rounded-xl border-none font-black"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="fp-save-dock">
                    <SaveButton
                      saving={savingTransaction}
                      label={editTransactionData ? 'Salvar alterações' : t.confirmTransaction}
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: 14,
                        border: 'none',
                        cursor: savingTransaction ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: 15,
                        color: 'white',
                        background: '#2B2F77',
                        boxShadow: 'none',
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: savingTransaction ? 0.7 : 1,
                      }}
                    />
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </FullScreenModal>
        )}

        {isUpgradeModalOpen && canShowCheckout() && (
          <FullScreenModal>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-t42xl shadow-2xl p-10 space-y-8 animate-in zoom-in overflow-y-auto max-h-[90vh]">
                {planLimitReason && (
                  <p
                    role="status"
                    className="text-center text-base font-black text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3"
                  >
                    {planLimitReason}
                  </p>
                )}
                <div className="text-center">
                  <div className="bg-indigo-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-amber-300 shadow-xl mb-4">
                    <Crown className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">Escolha seu Plano</h3>
                  <p className="text-slate-500 font-medium mt-2">Desbloqueie recursos avançados</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      planData: PLANS.FREE,
                      features: ['20 clientes', '15 eventos', 'Sem IA', 'Com anúncios'],
                      popular: false,
                    },
                    {
                      planData: PLANS.PRO,
                      features: [
                        '500 clientes',
                        'Eventos ilimitados',
                        'IA habilitada',
                        'Sem anúncios',
                      ],
                      popular: true,
                    },
                    {
                      planData: PLANS.ENTERPRISE,
                      features: [
                        'Clientes ilimitados',
                        'Eventos ilimitados',
                        'IA habilitada',
                        'Sem anúncios',
                      ],
                      popular: false,
                    },
                  ].map((item) => {
                    const priceLabel =
                      item.planData.type === 'FREE'
                        ? 'R$ 0'
                        : item.planData.type === 'PRO'
                          ? planPricesFromStatus(catalog).pro
                          : null;
                    return (
                      <div
                        key={item.planData.type}
                        className={`p-6 rounded-3xl border-2 ${item.popular ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                      >
                        {item.popular && (
                          <div className="text-[10px] font-black uppercase text-indigo-600 mb-2 tracking-widest">
                            Mais Popular
                          </div>
                        )}
                        <h4 className="text-lg font-black mb-1">
                          {item.planData.type === 'FREE'
                            ? 'Grátis'
                            : item.planData.type === 'PRO'
                              ? 'Pro'
                              : 'Enterprise'}
                        </h4>
                        {priceLabel && <p className="text-2xl font-black mb-4">{priceLabel}</p>}
                        <ul className="space-y-2 mb-6">
                          {item.features.map((f) => (
                            <li
                              key={f}
                              className="text-sm font-bold text-slate-600 flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        {item.planData.type === 'PRO' && (
                          <button
                            onClick={() => {
                              setIsUpgradeModalOpen(false);
                              setActiveView(AppView.PROFILE);
                            }}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700"
                          >
                            Assinar PRO
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    setPlanLimitReason(null);
                    setIsUpgradeModalOpen(false);
                  }}
                  className="w-full text-slate-400 text-sm font-bold uppercase tracking-widest"
                >
                  Fechar
                </button>
              </div>
            </div>
          </FullScreenModal>
        )}

        {isEventModalOpen && (
          <FullScreenModal>
            <div
              className="fp-page-slide"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PageHeader title={t.newEvent} onBack={() => setIsEventModalOpen(false)} />
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
                  <form
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (savingEventRef.current) return;
                      const fd = new FormData(e.currentTarget);
                      const eventName = String(fd.get('name') ?? '').trim();
                      const eventDate = String(fd.get('eventDate') ?? '');
                      if (!eventName) {
                        setEventNameError('Informe o nome do evento');
                        return;
                      }
                      setEventNameError('');
                      const parsedDate = eventDate ? new Date(`${eventDate}T12:00:00-03:00`).getTime() : Date.now();
                      savingEventRef.current = true;
                      setSavingEvent(true);
                      try {
                        if (Number.isFinite(plan.maxEvents) && events.length >= plan.maxEvents) {
                          showPlanLimit('eventos', plan.maxEvents);
                          return;
                        }
                        const event: BillEvent = {
                          id: generateId(),
                          name: eventName,
                          date: Number.isFinite(parsedDate) ? parsedDate : Date.now(),
                          items: [],
                          participants: [
                            {
                              id: generateId(),
                              name: user?.name || 'Eu',
                              itemIds: [],
                              isOwner: true,
                            },
                          ],
                          isCompleted: false,
                          ownerParticipating: true,
                          splitDirty: false,
                        };
                        setEvents((prev) => [...prev, event]);
                        setSelectedEventId(event.id);
                        setIsEventModalOpen(false);
                        setActiveView(AppView.EVENT_DETAIL);
                      } finally {
                        savingEventRef.current = false;
                        setSavingEvent(false);
                      }
                    }}
                  >
                    <div className="fp-form-card">
                      <h2>Dados do evento</h2>
                      <label className="fp-field">
                        {t.eventName}
                        <input
                          name="name"
                          aria-label={t.eventName}
                          placeholder="Ex: Churrasco no final de semana"
                          onInput={() => setEventNameError('')}
                          autoFocus
                        />
                      </label>
                      <label className="fp-field">
                        {t.eventDate}
                        <input name="eventDate" type="date" aria-label={t.eventDate} />
                      </label>
                    </div>
                    {eventNameError ? (
                      <p
                        role="alert"
                        style={{
                          color: '#DC2626',
                          fontWeight: 700,
                          marginTop: -12,
                          marginBottom: 16,
                        }}
                      >
                        {eventNameError}
                      </p>
                    ) : null}
                    <div className="fp-save-dock">
                    <SaveButton
                      saving={savingEvent}
                      label="Criar evento"
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: 16,
                        border: 'none',
                        cursor: savingEvent ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: 15,
                        color: 'white',
                        background: '#2B2F77',
                        boxShadow: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: savingEvent ? 0.7 : 1,
                      }}
                    />
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </FullScreenModal>
        )}
      </div>
    </div>
  );
};

export default App;
