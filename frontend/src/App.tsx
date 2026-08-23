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
  Calendar,
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
  ArrowDownCircle,
  RefreshCcw,
  ArrowLeftCircle,
  MapPin,
  Mail,
  Filter,
  MessageCircle,
  CalendarDays,
  Bell,
  Download,
  Upload,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  ClipboardList,
  Star,
  Camera,
  Percent,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
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
import UpgradePlano from './components/UpgradePlano';
import FullScreenModal from './components/FullScreenModal';
import {
  getFinancialAdvice,
  getGeneralBusinessAdvice,
  extractItemsFromInvoice,
} from './services/aiService';
import { translations, Translation } from './translations';
import HelpView from './components/HelpView';
import ReceivablesListView from './components/ReceivablesListView';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { App as CapacitorApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';
import { hapticMedium, hapticSuccess } from './utils/haptics';
import { showToast } from './utils/toast';
import InboxAprovacoes from './components/InboxAprovacoes';
import MinhasDividas from './components/MinhasDividas';
import {
  bootstrapSync,
  schedulePush,
  resetSyncState,
  fetchInbox,
  resendTransaction,
  updateProfile,
} from './services/syncService';
import {
  calculateScore,
  computeRawBalance,
  buildChargeMessage,
  normalizeWhatsAppPhone,
} from './utils/credit';
import {
  computeItemPrice,
  getItemQuantity,
  getItemUnitPrice,
  planEventSplitRecords,
  formatDateBR,
} from './utils/billSplit';

const STORAGE_KEY = 'fiado_pro_data_v14';
const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';
// JWT gerenciado via httpOnly cookie
const GOOGLE_CLIENT_ID = '372313466474-69v2logj3hkl6afj7l68q045rbbmbid7.apps.googleusercontent.com';

const generateId = (): string => crypto.randomUUID();

// HTML escaping — prevents XSS when interpolating user data into innerHTML/document.write
const esc = (s: unknown): string => {
  const str = String(s ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Password hashing — PBKDF2 with per-user random salt (100 000 iterations, SHA-256)
// Plan definitions
const PLANS: Record<PlanType, SubscriptionPlan> = {
  FREE: {
    type: 'FREE',
    maxCustomers: 20,
    maxEvents: 15,
    maxParticipantsPerEvent: 20,
    hasAI: false,
    hasAds: true,
    monthlyPrice: 0,
  },
  PRO: {
    type: 'PRO',
    maxCustomers: 500,
    maxEvents: Infinity,
    maxParticipantsPerEvent: 500,
    hasAI: true,
    hasAds: false,
    monthlyPrice: 30,
  },
  ENTERPRISE: {
    type: 'ENTERPRISE',
    maxCustomers: Infinity,
    maxEvents: Infinity,
    maxParticipantsPerEvent: 500,
    hasAI: true,
    hasAds: false,
    monthlyPrice: 97,
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
    <button
      onClick={onUpgrade}
      className="text-indigo-600 font-black hover:underline whitespace-nowrap"
    >
      {t.subscribePro}
    </button>
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
                  {exp.eventName} · {new Date(exp.date).toLocaleDateString('pt-BR')}
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
                  {exp.eventName} · {new Date(exp.date).toLocaleDateString('pt-BR')}
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

const DashboardView = ({ stats, formatCurrency, setActiveView, isPro, t }: any) => {
  const pieData = [
    { name: t.overdueAmount || 'Em Atraso', value: stats.totalOverdue || 0, color: '#EF4444' },
    { name: t.futureAmount || 'A Vencer', value: stats.totalFuture || 0, color: '#4F46E5' },
  ];

  const kpis = [
    {
      label: t.totalReceivableLabel || 'A Receber',
      value: formatCurrency(stats.totalReceivable || 0),
      sub: `${stats.activeDebtors || 0} ${t.activeDebtors || 'devedores ativos'}`,
      icon: <ArrowUpRight size={20} />,
      iconBg: '#EEF2FF',
      iconColor: '#4F46E5',
      accent: 'primary',
      onClick: () => setActiveView(AppView.RECEIVABLES_LIST),
    },
    {
      label: t.overdueAmount || 'Em Atraso',
      value: formatCurrency(stats.totalOverdue || 0),
      sub: `${(stats.defaultRate || 0).toFixed(1)}% ${t.defaultRate || 'inadimplência'}`,
      icon: <AlertTriangle size={20} />,
      iconBg: '#FEE2E2',
      iconColor: '#EF4444',
      accent: 'danger',
      onClick: () => setActiveView(AppView.RECEIVABLES_LIST),
    },
    {
      label: t.totalPaidLabel || 'Total Recebido',
      value: formatCurrency(stats.totalPaid || 0),
      sub: t.confirmedPayments || 'Pagamentos confirmados',
      icon: <CheckCircle2 size={20} />,
      iconBg: '#DCFCE7',
      iconColor: '#10B981',
      accent: 'success',
      onClick: undefined,
    },
    {
      label: 'Insights IA',
      value: isPro ? 'PRO' : 'FREE',
      sub: t.aiDescription || 'Análise inteligente do negócio',
      icon: <Sparkles size={20} />,
      iconBg: '#F3E8FF',
      iconColor: '#7C3AED',
      accent: 'warning',
      onClick: () => setActiveView(AppView.INSIGHTS),
    },
  ];

  return (
    <div className="fp-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI Cards */}
      <div className="fp-stagger grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className={`fp-stat-card ${kpi.accent}${kpi.onClick ? ' fp-card-interactive' : ''}`}
            onClick={kpi.onClick}
            style={{ cursor: kpi.onClick ? 'pointer' : 'default' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: kpi.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: kpi.iconColor,
                  flexShrink: 0,
                }}
              >
                {kpi.icon}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--fp-muted)',
                }}
              >
                {kpi.label}
              </span>
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: 'var(--fp-text)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                marginBottom: 6,
              }}
            >
              {kpi.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fp-muted)', fontWeight: 500 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Area Chart */}
        <div className="fp-card lg:col-span-3" style={{ padding: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--fp-text)', margin: 0 }}>
                {t.evolution || 'Evolução'}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--fp-muted)', marginTop: 2 }}>
                Últimos 14 dias
              </p>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{ width: 10, height: 10, borderRadius: '50%', background: '#4F46E5' }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fp-muted)' }}>
                  Fiado
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fp-muted)' }}>
                  Recebido
                </span>
              </div>
            </div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.evolutionData || []}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="gOffered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fp-border)" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--fp-muted)', fontSize: 10, fontWeight: 600 }}
                  dy={8}
                  interval={2}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--fp-muted)', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: 'none',
                    boxShadow: 'var(--shadow-lg)',
                    background: 'var(--fp-surface)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                  formatter={(val: number) => formatCurrency(val)}
                />
                <Area
                  type="monotone"
                  dataKey="Offered"
                  stroke="#4F46E5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gOffered)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="Received"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gReceived)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie + Totals */}
        <div className="fp-card lg:col-span-2" style={{ padding: 28 }}>
          <h3
            style={{ fontSize: 15, fontWeight: 800, color: 'var(--fp-text)', margin: '0 0 4px 0' }}
          >
            {t.overview || 'Distribuição'}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--fp-muted)', marginBottom: 16 }}>
            Saldo por situação
          </p>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={44}
                  outerRadius={62}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: 'none',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                  formatter={(val: number) => formatCurrency(val)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 12,
              paddingTop: 16,
              borderTop: '1px solid var(--fp-border)',
            }}
          >
            {pieData.map((item) => (
              <div
                key={item.name}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fp-muted)' }}>
                    {item.name}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--fp-text)' }}>
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 8,
                borderTop: '1px solid var(--fp-border)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--fp-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Total
              </span>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--fp-text)' }}>
                {formatCurrency(stats.totalReceivable || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {stats.recentTransactions?.length > 0 && (
        <div className="fp-card" style={{ padding: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--fp-text)', margin: 0 }}>
              {t.recentTransactions || 'Últimos Lançamentos'}
            </h3>
            <button
              className="fp-btn fp-btn-ghost"
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={() => setActiveView(AppView.AUDIT_LOG)}
            >
              Ver todos
            </button>
          </div>
          <table className="fp-table">
            <tbody>
              {stats.recentTransactions.map((tx: any) => {
                const isDebt = tx.type === 'DEBT';
                return (
                  <tr key={tx.id}>
                    <td style={{ paddingLeft: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            flexShrink: 0,
                            background: isDebt ? '#FEE2E2' : '#DCFCE7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isDebt ? '#EF4444' : '#10B981',
                          }}
                        >
                          {isDebt ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fp-text)' }}>
                            {tx.customerName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fp-muted)', marginTop: 1 }}>
                            {tx.description ||
                              (isDebt
                                ? t.debtLaunched || 'Débito lançado'
                                : t.paymentRegistered || 'Pagamento')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: isDebt ? '#EF4444' : '#10B981',
                        }}
                      >
                        {isDebt ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fp-muted)', marginTop: 1 }}>
                        {new Date(tx.timestamp).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
      overdue: customersWithBalance.filter((c) => c.isOverdue).length,
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
    { id: 'todos', label: 'Todos os Clientes', badge: customersWithBalance.length },
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
    { id: 'menor_score', label: 'Menor Score' },
    { id: 'maior_score', label: 'Maior Score' },
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
          { label: 'Total Clientes', value: stats.total, color: '#6366F1', bg: '#EEF2FF' },
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
              <p style={{ fontWeight: 800, color: '#64748B' }}>Nenhum cliente encontrado</p>
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
                        background: 'linear-gradient(135deg,#EEF2FF,#E0E7FF)',
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
                          {c.phone || 'Sem telefone'}
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
                    <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 100 }}>
                      {scoreBar(c.score ?? 700)}
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 900,
                          marginTop: 6,
                          color:
                            c.rawBalance > 0 ? '#DC2626' : c.rawBalance < 0 ? '#059669' : '#94A3B8',
                        }}
                      >
                        {c.rawBalance !== 0 && (c.rawBalance > 0 ? '+' : '')}
                        {formatCurrency(c.rawBalance)}
                      </p>
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
            <p style={{ fontWeight: 800, color: '#64748B' }}>Nenhum cliente neste ranking ainda</p>
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
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
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
                      {c.phone || '—'}
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
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-200 p-8 rounded-t42lg w-full md:w-auto flex-1">
        <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-lg">
          <Receipt className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-indigo-900">{t.splitBill}</h2>
          <p className="text-indigo-700 font-medium leading-relaxed">{t.aiBusinessDescription}</p>
        </div>
      </div>
      <button
        onClick={() => setIsEventModalOpen(true)}
        className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-5 rounded-3xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
      >
        <Plus className="w-6 h-6" /> {t.newEvent}
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.length === 0 ? (
        <div className="col-span-full py-20 text-center bg-white rounded-t42xl border border-slate-200">
          <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <Receipt className="w-12 h-12 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-800">{t.noEvents}</h3>
          <p className="text-slate-500 font-bold mt-2">{t.createFirstEvent}</p>
        </div>
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
                className="bg-white p-8 rounded-t42xl border border-slate-200 hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer shadow-sm h-full flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      <Calendar className="w-7 h-7" />
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${event.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}
                    >
                      {event.isCompleted ? t.eventPaid : t.eventPending}
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {event.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">
                    {new Date(event.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="pt-6 border-t border-slate-50 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
                      {t.totalBill}
                    </p>
                    <p className="text-2xl font-black text-slate-900">{formatCurrency(total)}</p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all" />
                </div>
              </div>
              <button
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
                className="absolute top-6 right-6 p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-md z-[20]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
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
}: any) => {
  const [isScanning, setIsScanning] = useState(false);
  const [participantDropdown, setParticipantDropdown] = useState<string | null>(null);
  const [participantSearch, setParticipantSearch] = useState<Record<string, string>>({});
  const [lastAddedParticipantId, setLastAddedParticipantId] = useState<string | null>(null);
  const participantRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
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
    const content = `<html><head><title>${esc(event.name)}</title><style>body { font-family: sans-serif; padding: 40px; color: #334155; } table { width: 100%; border-collapse: collapse; margin-bottom: 30px; } th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; } th { font-size: 12px; text-transform: uppercase; color: #94a3b8; } .status { font-weight: bold; color: ${statusColor}; }</style></head><body><h1>${esc(event.name)} <span class="status">[${event.isCompleted ? 'QUITADO' : 'PENDENTE'}]</span></h1><p>Data: ${esc(new Date(event.date).toLocaleDateString())} | Total: ${formatCurrency(totalBill)}</p><h3>Itens Consumidos</h3><table><thead><tr><th>Item</th><th style="text-align:right">Qtd</th><th style="text-align:right">Valor Unit.</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemsList}</tbody></table><h3>Divisão por Pessoa</h3><table><thead><tr><th>Nome</th><th>Itens</th><th style="text-align:right">Parte</th></tr></thead><tbody>${participantsList}</tbody></table><script>window.onload = () => window.print();</script></body></html>`;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleConfirmSplit = () => {
    if (!confirm(t.confirmSplitQuestion || t.confirmSplit + '?')) return;

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
        return upd ? { ...tx, amount: upd.amount, description: upd.description } : tx;
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
      const noteText = `Divisão atualizada em ${formatDateBR()}`;
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <button
          onClick={() => setActiveView(AppView.SPLIT_BILL)}
          className="flex items-center gap-2 text-indigo-600 font-black hover:text-indigo-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> {t.backToEvents}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() =>
              setEvents((prev: BillEvent[]) =>
                prev.map((e) => (e.id === event.id ? { ...e, isCompleted: !e.isCompleted } : e)),
              )
            }
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all shadow-sm ${event.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}
          >
            {event.isCompleted ? 'Quitado ✓' : 'Pendente...'}
          </button>
          <button
            onClick={handlePrintEvent}
            className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-indigo-600 font-bold hover:bg-indigo-50 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (confirm(t.confirmDelete)) {
                setEvents((prev: any) => prev.filter((ev: any) => ev.id !== event.id));
                setActiveView(AppView.SPLIT_BILL);
              }
            }}
            className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-t42xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-12">
          <div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">{event.name}</h2>
            <p className="text-slate-400 font-bold text-sm">
              {new Date(event.date).toLocaleDateString()}
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
              {t.totalBill}
            </p>
            <p className="text-4xl font-black text-indigo-600">{formatCurrency(totalBill)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Receipt className="w-6 h-6 text-indigo-600" /> {t.itemsList}
              </h3>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all flex items-center gap-2">
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
                  className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all"
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
                  <div key={item.id} className="flex flex-col gap-2 bg-slate-50 rounded-2xl p-3">
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
                        <label className="text-[9px] text-slate-400 font-black uppercase mb-1">
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
                        <label className="text-[9px] text-slate-400 font-black uppercase mb-1 block">
                          {t.unitPrice}
                        </label>
                        <span className="absolute left-3 top-1/2 translate-y-1 text-slate-400 font-bold text-xs">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={unitPrice === 0 ? '' : unitPrice}
                          onChange={(e) => {
                            const newUnitPrice = parseFloat(e.target.value) || 0;
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
                          placeholder="0,00"
                          className="w-full pl-9 pr-4 py-2 bg-white border-2 border-[#E4E8F5] rounded-t42sm font-black text-sm text-right outline-none focus:border-[#5967D8]"
                        />
                      </div>
                      <div className="flex flex-col items-end">
                        <label className="text-[9px] text-slate-400 font-black uppercase mb-1">
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
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Users className="w-6 h-6 text-emerald-600" /> {t.participants}
              </h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={event.ownerParticipating}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
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
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    {t.ownerParticipating}
                  </span>
                </label>
                <button
                  onClick={() => {
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
                  className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-all"
                >
                  {t.addParticipant}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {event.participants.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-slate-50 p-6 rounded-t42lg border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-200"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 relative">
                      <input
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
                        className="w-full px-5 py-3 bg-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
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
                                      {c.phone}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 font-black uppercase">
                        {t.sharePerPerson}
                      </p>
                      <p className="text-sm font-black text-indigo-600">
                        {formatCurrency(shares[p.id] || 0)}
                      </p>
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
                </div>
              ))}
            </div>

            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-t42lg p-8 shadow-sm">
              <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mb-4">
                CÁLCULO FINAL
              </p>
              <button
                onClick={handleConfirmSplit}
                disabled={totalBill <= 0 || event.isCompleted}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                {event.isCompleted
                  ? '✓ Divisão já confirmada'
                  : t.confirmSplitBtn || 'Confirmar Divisão'}
              </button>
              {event.splitDirty && (
                <button
                  onClick={handleConfirmSplit}
                  className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white py-5 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95"
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
}: {
  group: InstallmentGroup;
  formatCurrency: (v: number) => string;
  t: any;
  onPayInstallment: (tx: Transaction) => void;
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
    const isOverdue = tx.dueDate ? Date.now() > tx.dueDate : false;
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
                        {tx.dueDate ? new Date(tx.dueDate).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-black ${status === 'overdue' ? 'text-red-700' : 'text-slate-900'}`}
                      >
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {status === 'paid' ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                            ✅ {t.installmentStatus_paid || 'Pago'}
                          </span>
                        ) : status === 'overdue' ? (
                          <span className="text-[10px] font-black text-red-700 bg-red-50 px-2 py-1 rounded-full">
                            ⚠️ {t.installmentStatus_overdue || 'Em Atraso'}
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
  const [noteText, setNoteText] = useState('');

  // Hooks precisam rodar sempre, na mesma ordem — o early return fica
  // depois deles (react-hooks/rules-of-hooks); por isso o acesso a
  // selectedCustomer aqui dentro é feito com optional chaining.
  const filteredTransactions = useMemo(() => {
    let list = transactions.filter((tx: Transaction) => tx.customerId === selectedCustomer?.id);
    if (startDate) {
      const start = new Date(startDate).setHours(0, 0, 0, 0);
      list = list.filter((tx) => tx.timestamp >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      list = list.filter((tx) => tx.timestamp <= end);
    }
    return list.sort((a: Transaction, b: Transaction) => b.timestamp - a.timestamp);
  }, [transactions, selectedCustomer?.id, startDate, endDate]);

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
      if (type === 'REFUND') return { label: 'Devolução', color: '#2563EB', sign: '-' };
      return { label: type, color: '#334155', sign: '' };
    };
    const items = filteredTransactions
      .map((tx: Transaction) => {
        const { label, color, sign } = typeLabel(tx.type);
        return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${new Date(tx.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
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
        ? `<p style="font-size:12px;color:#64748b;margin:4px 0 0">Período: ${startDate || 'Início'} até ${endDate || 'Hoje'}</p>`
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
<div class="logo">FiadoPro <span>Extrato do Cliente</span></div>
<div class="header">
  <div><div class="customer-name">${esc(selectedCustomer.name)}</div><div class="customer-phone">${esc(selectedCustomer.phone || '')}</div>${filterInfo}</div>
  <div class="balance-box"><div class="balance-label">Saldo atual</div><div class="balance-value">${formatCurrency(Math.abs(selectedCustomer.rawBalance))}</div><div style="font-size:11px;color:${saldoColor};font-weight:700;margin-top:2px">${selectedCustomer.rawBalance > 0 ? 'A receber' : selectedCustomer.rawBalance < 0 ? 'A pagar' : 'Quitado'}</div></div>
</div>
<table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th style="text-align:right">Valor</th></tr></thead>
<tbody>${items}</tbody></table>
<p style="margin-top:24px;font-size:11px;color:#94a3b8;text-align:center">Gerado em ${new Date().toLocaleString('pt-BR')} via FiadoPro</p>
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

  const handleExecuteRefund = () => {
    if (selectedCustomer.rawBalance >= 0) return;
    const refundAmount = Math.abs(selectedCustomer.rawBalance);
    if (window.confirm(`${t.recordRefund}: ${formatCurrency(refundAmount)}?`)) {
      setTransactions((prev: Transaction[]) => [
        ...prev,
        {
          id: generateId(),
          customerId: selectedCustomer.id,
          amount: refundAmount,
          type: 'DEBT',
          description: t.recordRefund,
          timestamp: Date.now(),
          status: 'CONFIRMED',
        },
      ]);
    }
  };

  const handleSettleAsProfit = () => {
    if (selectedCustomer.rawBalance >= 0) return;
    const settleAmount = Math.abs(selectedCustomer.rawBalance);
    if (window.confirm(`${t.incorporateProfit}: ${formatCurrency(settleAmount)}?`)) {
      setTransactions((prev: Transaction[]) => [
        ...prev,
        {
          id: generateId(),
          customerId: selectedCustomer.id,
          amount: settleAmount,
          type: 'DEBT',
          description: t.incorporateProfit,
          timestamp: Date.now(),
          status: 'CONFIRMED',
        },
      ]);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm(t.confirmDelete)) {
      setTransactions((prev: Transaction[]) => prev.filter((tx) => tx.id !== id));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <button
          onClick={() => setActiveView(AppView.CUSTOMERS)}
          className="flex items-center gap-2 text-indigo-600 font-black hover:text-indigo-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> {t.viewAllCustomers}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditCustomerModalOpen()}
            className="p-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl transition-all shadow-sm group"
          >
            <Edit3 className="w-5 h-5 transition-transform group-hover:scale-110" />
          </button>
          <button
            onClick={() => {
              if (window.confirm(t.confirmDelete)) deleteCustomer(selectedCustomer.id);
            }}
            className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-all shadow-sm group"
          >
            <Trash2 className="w-5 h-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      <div className="bg-white p-5 md:p-12 rounded-t42lg md:rounded-t42xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 md:mb-12 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-indigo-600 rounded-t42lg flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-indigo-200">
              {selectedCustomer.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 mb-1">{selectedCustomer.name}</h2>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <p className="text-slate-400 font-bold flex items-center gap-1.5">
                  <Phone className="w-4 h-4" /> {selectedCustomer.phone}
                </p>
                {selectedCustomer.email && (
                  <p className="text-slate-400 font-bold flex items-center gap-1.5">
                    <Mail className="w-4 h-4" /> {selectedCustomer.email}
                  </p>
                )}
                {selectedCustomer.pixKey && (
                  <p className="text-indigo-600 font-bold flex items-center gap-1.5 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                    <ZapIcon className="w-3 h-3" /> Pix: {selectedCustomer.pixKey}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="md:text-right p-6 bg-slate-50 rounded-3xl border border-slate-100 w-full md:w-auto md:min-w-[240px]">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
              {t.currentBalance}
            </p>
            <p
              className={`text-4xl font-black ${selectedCustomer.rawBalance > 0 ? (selectedCustomer.isOverdue ? 'text-red-600' : 'text-orange-500') : selectedCustomer.rawBalance < 0 ? 'text-green-600' : 'text-slate-400'}`}
            >
              {selectedCustomer.rawBalance < 0 ? '-' : ''}
              {formatCurrency(Math.abs(selectedCustomer.rawBalance))}
            </p>
            {(() => {
              const score = calculateScore(selectedCustomer, transactions);
              const cat = scoreCategory(score, t);
              return (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${cat.bg} mt-4`}>
                  <div className="text-center">
                    <p className={`text-2xl font-black ${cat.color}`}>{score}</p>
                    <p className={`text-[10px] font-black uppercase ${cat.color}`}>{cat.label}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${cat.bar} rounded-full transition-all`}
                        style={{ width: `${score / 10}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Score / 1000</p>
                  </div>
                  <button
                    onClick={() => {
                      setCustomers((prev: Customer[]) =>
                        prev.map((c) =>
                          c.id === selectedCustomer.id ? { ...c, trusted: !c.trusted } : c,
                        ),
                      );
                    }}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black transition-all ${selectedCustomer.trusted ? 'bg-amber-400 text-white' : 'bg-white/50 text-slate-400 hover:bg-amber-100'}`}
                  >
                    <Star className="w-4 h-4" /> {selectedCustomer.trusted ? 'Confiável' : 'Marcar'}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-12 relative z-10">
          <button
            onClick={() => {
              setTransactionType('DEBT');
              setEditTransactionData(null);
              setIsTransactionModalOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2.5 text-white py-4 rounded-t42lg font-bold text-base shadow-t42sm hover:brightness-110 transition-all active:scale-95"
            style={{ background: '#1C2446' }}
          >
            <ArrowUpRight className="w-5 h-5" /> {t.newPurchase}
          </button>
          <button
            onClick={() => {
              setTransactionType('PAYMENT');
              setEditTransactionData(null);
              setIsTransactionModalOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2.5 text-white py-4 rounded-t42lg font-bold text-base shadow-t42sm hover:brightness-110 transition-all active:scale-95"
            style={{ background: '#2E9D6F' }}
          >
            <ArrowDownLeft className="w-5 h-5" /> {t.logPayment}
          </button>
          <button
            onClick={() => {
              setTransactionType('ABATIMENTO');
              setEditTransactionData(null);
              setIsTransactionModalOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2.5 text-white py-4 rounded-t42lg font-bold text-base shadow-t42sm hover:brightness-110 transition-all active:scale-95"
            style={{ background: '#7252E2' }}
          >
            <RefreshCcw className="w-5 h-5" /> Abatimento
          </button>
          <button
            onClick={() => {
              setTransactionType('REFUND');
              setEditTransactionData(null);
              setIsTransactionModalOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2.5 text-white py-4 rounded-t42lg font-bold text-base shadow-t42sm hover:brightness-110 transition-all active:scale-95"
            style={{ background: '#3D559C' }}
          >
            <ArrowDownCircle className="w-5 h-5" /> Devolução
          </button>
        </div>

        {selectedCustomer.rawBalance < 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-t42lg p-8 mb-12 animate-in slide-in-from-top-4 duration-300 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <ArrowDownCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-indigo-900">{t.moneyToReturn}</h4>
                  <p className="text-sm text-indigo-700 font-medium">
                    Este cliente possui saldo credor. Como deseja proceder?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={handleSettleAsProfit}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-sm transition-all shadow-md bg-indigo-600 text-white shadow-indigo-100"
                >
                  <RefreshCcw className="w-4 h-4" /> {t.incorporateProfit}
                </button>
                <button
                  onClick={handleExecuteRefund}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-sm transition-all shadow-md bg-indigo-600 text-white shadow-indigo-100"
                >
                  <ArrowLeftCircle className="w-4 h-4" /> {t.returnToCustomer}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
          <div className="lg:col-span-2 space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <History className="w-6 h-6 text-indigo-600" /> {t.transactionLedger}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-bold text-slate-600 p-0 focus:ring-0 w-24"
                    placeholder={t.startDate}
                    title={t.startDate}
                  />
                  <span className="text-slate-300">|</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-bold text-slate-600 p-0 focus:ring-0 w-24"
                    placeholder={t.endDate}
                    title={t.endDate}
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-xs font-black text-indigo-600 uppercase hover:underline"
                  >
                    Limpar Filtro
                  </button>
                )}
                <button
                  onClick={handlePrintStatement}
                  className="p-2 text-slate-400 hover:text-indigo-600 transition-colors border border-slate-100 rounded-lg shadow-sm bg-white"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
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
                filteredTransactions.map((tx: Transaction) => (
                  <div
                    key={tx.id}
                    className="group flex items-center justify-between p-6 bg-slate-50 rounded-t42lg border border-transparent hover:border-indigo-100 hover:bg-white transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-5">
                      <div
                        className={`p-3 rounded-2xl ${tx.type === 'DEBT' ? 'bg-orange-100 text-orange-600' : tx.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-600' : tx.type === 'ABATIMENTO' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}
                      >
                        {tx.type === 'DEBT' ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : tx.type === 'ABATIMENTO' ? (
                          <RefreshCcw className="w-5 h-5" />
                        ) : (
                          <ArrowDownLeft className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-slate-900 line-clamp-1">{tx.description}</p>
                          {tx.status !== 'CONFIRMED' && (
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
                            >
                              {tx.status === 'PENDING' ? 'Pendente' : 'Rejeitado'}
                            </span>
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
                        <p className="text-xs text-slate-400 font-bold">
                          {new Date(tx.timestamp).toLocaleString()}
                        </p>
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
                        className={`text-lg font-black whitespace-nowrap ${tx.type === 'DEBT' ? 'text-slate-900' : tx.type === 'PAYMENT' ? 'text-emerald-600' : tx.type === 'ABATIMENTO' ? 'text-purple-600' : 'text-indigo-600'}`}
                      >
                        {tx.type === 'DEBT' ? '+' : tx.type === 'ABATIMENTO' ? '⊖' : '-'}
                        {formatCurrency(tx.amount)}
                      </p>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
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
                ))
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-indigo-900 rounded-t42lg p-8 text-white shadow-xl relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xl font-black mb-4 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-amber-400" /> {t.aiAnalysis}
                </h3>
                {!isPro && (
                  <div className="mb-6 p-5 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <p className="text-[10px] font-black text-amber-300 uppercase mb-3 tracking-widest flex items-center gap-2">
                      <Crown className="w-3 h-3" /> {t.proFeatureTitle}
                    </p>
                    <button
                      onClick={setIsUpgradeModalOpen}
                      className="w-full flex items-center justify-center gap-2 bg-white text-indigo-900 font-black py-3 rounded-xl hover:bg-indigo-50 transition-all active:scale-95 shadow-lg"
                    >
                      {t.upgradeToPro}
                    </button>
                  </div>
                )}
                {isPro && (
                  <button
                    onClick={handleGetAdvice}
                    disabled={isAILoading}
                    className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 border border-white/10 active:scale-95 disabled:opacity-50"
                  >
                    {isAILoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    {t.aiAnalysis}
                  </button>
                )}
                {aiAdvice && (
                  <div className="mt-6 p-6 bg-white/5 rounded-2xl border border-white/10 text-sm leading-relaxed text-indigo-50 whitespace-pre-wrap animate-in fade-in slide-in-from-top-4">
                    {aiAdvice}
                  </div>
                )}
              </div>
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors duration-500"></div>
            </div>

            <div className="bg-white p-8 rounded-t42lg border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setIsNotesModalOpen(true)}
                  className="flex items-center gap-3 hover:text-indigo-600 transition-colors"
                >
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-black text-slate-800">{t.customerNotes}</h3>
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
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
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
                  <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-bold italic px-4">{t.noNotes}</p>
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
                            <p className="text-sm font-bold text-slate-700 leading-relaxed pr-24">
                              {note.text}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-3 font-black uppercase tracking-wider">
                              {new Date(note.createdAt).toLocaleString()}
                            </p>
                            <div className="absolute top-4 right-4 flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteText(note.text);
                                }}
                                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
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
                                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
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
                    className="w-full text-center text-xs font-black text-indigo-600 uppercase tracking-widest pt-2 hover:underline"
                  >
                    {t.viewAllNotes}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-emerald-50 p-8 rounded-t42lg border border-emerald-100 shadow-sm group">
              <h3 className="text-lg font-black text-emerald-900 mb-4 flex items-center gap-3">
                <Phone className="w-5 h-5" /> {t.notifyCustomer}
              </h3>
              <p className="text-sm text-emerald-700 font-medium mb-6 leading-relaxed">
                Envie um lembrete gentil com o resumo atualizado da conta diretamente para o
                WhatsApp.
              </p>
              <button
                onClick={() => handleShareWhatsApp('GENTLE')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 shadow-emerald-100/50"
              >
                <Share2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
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
                onPayInstallment={(tx: Transaction) =>
                  onPayInstallment && onPayInstallment(tx, group)
                }
              />
            ))}
          </div>
        )}
      </div>
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
  const [cancelStep, setCancelStep] = useState<0 | 1 | 2 | 3>(0);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmText, setCancelConfirmText] = useState('');
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
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full bg-indigo-600 text-white py-5 rounded-t42lg font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-60"
            >
              {savingProfile ? 'Salvando…' : t.saveChanges}
            </button>
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

      {/* Zona de Perigo */}
      <div className="bg-red-50 border border-red-200 p-8 rounded-t42lg space-y-4">
        <h3 className="text-lg font-black text-red-700 flex items-center gap-2">
          ⚠️ Zona de Perigo
        </h3>
        <p className="text-sm text-red-600 font-medium">
          Esta ação é irreversível. Todos os dados serão permanentemente apagados.
        </p>
        <button
          onClick={() => setCancelStep(1)}
          className="px-6 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-all text-sm"
        >
          Cancelar Conta
        </button>
      </div>

      {cancelStep > 0 && (
        <FullScreenModal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-t42xl shadow-2xl p-10 space-y-6 animate-in zoom-in">
              {cancelStep === 1 && (
                <>
                  <div className="text-center">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h3 className="text-xl font-black text-slate-900">Cancelar sua conta?</h3>
                    <p className="text-slate-500 mt-2 font-medium leading-relaxed">
                      Todos os clientes, transações e histórico serão{' '}
                      <strong>PERMANENTEMENTE EXCLUÍDOS</strong>. Esta ação não pode ser desfeita.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCancelStep(0)}
                      className="flex-1 py-4 border-2 border-slate-200 rounded-2xl font-black text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setCancelStep(2)}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700"
                    >
                      Continuar →
                    </button>
                  </div>
                </>
              )}

              {cancelStep === 2 && (
                <>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">
                      Por que está cancelando?
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      Sua resposta nos ajuda a melhorar.
                    </p>
                    <div className="space-y-3">
                      {[
                        'Não uso mais',
                        'Muito caro',
                        'Falta de funcionalidades',
                        'Migrei para outro sistema',
                        'Outro motivo',
                      ].map((reason) => (
                        <label
                          key={reason}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="cancelReason"
                            value={reason}
                            checked={cancelReason === reason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="w-4 h-4 text-red-600"
                          />
                          <span className="font-bold text-slate-700">{reason}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCancelStep(1)}
                      className="flex-1 py-4 border-2 border-slate-200 rounded-2xl font-black text-slate-600"
                    >
                      ← Voltar
                    </button>
                    <button
                      onClick={() => cancelReason && setCancelStep(3)}
                      disabled={!cancelReason}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 disabled:opacity-40"
                    >
                      Confirmar →
                    </button>
                  </div>
                </>
              )}

              {cancelStep === 3 && (
                <>
                  <div className="text-center">
                    <div className="text-5xl mb-4">⛔</div>
                    <h3 className="text-xl font-black text-red-700">Última confirmação</h3>
                    <p className="text-slate-500 mt-2 font-medium leading-relaxed">
                      Esta é sua <strong>ÚLTIMA CHANCE</strong>. Após confirmar, tudo será apagado
                      para sempre.
                    </p>
                    <p className="text-sm font-black text-slate-600 mt-4">
                      Digite <strong className="text-red-600">CANCELAR</strong> para confirmar:
                    </p>
                    <input
                      type="text"
                      value={cancelConfirmText}
                      onChange={(e) => setCancelConfirmText(e.target.value.toUpperCase())}
                      placeholder="CANCELAR"
                      className="mt-3 w-full px-5 py-3 bg-slate-50 rounded-2xl font-black text-center text-lg border-2 border-slate-200 outline-none focus:border-red-400"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        if (cancelConfirmText === 'CANCELAR') onDeleteAccount();
                      }}
                      disabled={cancelConfirmText !== 'CANCELAR'}
                      className="w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 disabled:opacity-40 transition-all"
                    >
                      Excluir Tudo Permanentemente
                    </button>
                    <button
                      onClick={() => {
                        setCancelStep(0);
                        setCancelConfirmText('');
                        setCancelReason('');
                      }}
                      className="w-full py-4 border-2 border-slate-200 rounded-2xl font-black text-slate-600 hover:bg-slate-50"
                    >
                      Desistir — Manter minha conta
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </FullScreenModal>
      )}
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
                <p className="text-xs text-slate-400 font-bold">{c.phone}</p>
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
                        description: 'Devolução em dinheiro ao cliente',
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
                onClick={() => {
                  if (
                    window.confirm(
                      `Absorver crédito de ${formatCurrency(Math.abs(c.rawBalance))} de ${c.name} como lucro?`,
                    )
                  ) {
                    setTransactions((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        customerId: c.id,
                        amount: Math.abs(c.rawBalance),
                        type: 'DEBT' as TransactionType,
                        description: 'Crédito absorvido como lucro',
                        timestamp: Date.now(),
                        status: 'CONFIRMED' as const,
                      },
                    ]);
                  }
                }}
                className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-xl font-black text-xs hover:bg-purple-700 transition-all active:scale-95"
              >
                Abater
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
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(tx.timestamp).toLocaleString()}
                </p>
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
              {new Date(entry.timestamp).toLocaleString()}
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
  const [activationCode, setActivationCode] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [hasInterest, setHasInterest] = useState(false);
  const [installmentInterestRate, setInstallmentInterestRate] = useState(2.5);
  const [currentAmountValue, setCurrentAmountValue] = useState<number>(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
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
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
    if (!user) return;
    schedulePush(true, customers, transactions, (patches) => {
      setTransactions((prev) =>
        prev.map((tx) => {
          const patch = patches.find((p) => p.id === tx.id);
          return patch ? { ...tx, status: patch.status } : tx;
        }),
      );
    });
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
        if (data.plan) setPlan(data.plan);
        if (data.ownerExpenses) setOwnerExpenses(data.ownerExpenses);
        if (data.credentials) setCredentials(data.credentials);
        // Check plan expiry
        if (data.plan?.expiresAt && data.plan.expiresAt < Date.now()) {
          setPlan(PLANS.FREE);
          setIsPro(false);
        }
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

  const customersWithBalance: CustomerWithBalance[] = useMemo(() => {
    return customers.map((c) => {
      const customerTransactions = transactions.filter(
        (tData) => tData.customerId === c.id && tData.status === 'CONFIRMED',
      );
      // DEBT aumenta saldo; PAYMENT/ABATIMENTO/REFUND reduzem (REFUND pode gerar saldo negativo → TO_PAY)
      const rawBalance = computeRawBalance(customerTransactions);

      const lastActivity =
        customerTransactions.length > 0
          ? Math.max(...customerTransactions.map((t) => t.timestamp))
          : c.createdAt;
      // isOverdue: só marca como vencido se o débito tem dueDate explícita e passou do prazo
      const isOverdue =
        rawBalance > 0 &&
        customerTransactions.some((t) => t.type === 'DEBT' && t.dueDate && Date.now() > t.dueDate);
      const displayBalance = rawBalance < 0 && c.overpaymentStrategy === 'PROFIT' ? 0 : rawBalance;
      return {
        ...c,
        balance: displayBalance,
        rawBalance: rawBalance,
        lastActivity,
        isOverdue,
        score: calculateScore(c, transactions),
      };
    });
  }, [customers, transactions]);

  const canAddCustomer = () => customers.length < plan.maxCustomers;

  const stats = useMemo(() => {
    const totalReceivable = customersWithBalance.reduce(
      (acc, c) => acc + (c.balance > 0 ? c.balance : 0),
      0,
    );
    // Mudança Crítica: Contar como devedor ativo qualquer pessoa com saldo positivo no extrato
    const activeDebtors = customersWithBalance.filter((c) => c.rawBalance > 0).length;
    const totalOverdue = customersWithBalance
      .filter((c) => c.isOverdue)
      .reduce((acc, c) => acc + c.rawBalance, 0);
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
      const tillNow = transactions.filter(
        (t) => t.timestamp <= d.getTime() && t.status === 'CONFIRMED',
      );
      return {
        date: d.toLocaleDateString(language, { day: '2-digit', month: '2-digit' }),
        Offered: tillNow.filter((t) => t.type === 'DEBT').reduce((a, b) => a + b.amount, 0),
        Received: tillNow.filter((t) => t.type === 'PAYMENT').reduce((a, b) => a + b.amount, 0),
      };
    });

    return {
      totalReceivable,
      totalFuture,
      activeDebtors,
      totalOverdue,
      totalPaid,
      recentTransactions,
      evolutionData,
      defaultRate: totalReceivable > 0 ? (totalOverdue / totalReceivable) * 100 : 0,
    };
  }, [customersWithBalance, transactions, customers, language]);

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

    const waPhone = normalizeWhatsAppPhone(selected.phone);
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
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

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Digite sua senha para confirmar.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setDeleteError(data.error || 'Erro ao excluir conta.');
        return;
      }
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
      setShowDeleteAccountModal(false);
    } catch {
      setDeleteError('Erro de conexao. Tente novamente.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteAccountModal = () => {
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteAccountModal(true);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const validTypes = new Set(['DEBT', 'PAYMENT', 'REFUND', 'ABATIMENTO']);
        const validStatus = new Set(['CONFIRMED', 'PENDING', 'REJECTED']);

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
    if (!selectedCustomerId) return;
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    if (!isFinite(amount) || amount <= 0) {
      showToast('Informe um valor válido maior que zero.');
      return;
    }
    const desc = formData.get('description') as string;
    const method = formData.get('paymentMethod') as PaymentMethod;
    const dueDate = formData.get('dueDate') as string;
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
                dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
                eventId: eventId || undefined,
                ...(attachment ? { attachment } : {}),
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
        const baseDueDate = dueDate ? new Date(dueDate).getTime() : Date.now() + 30 * 86400000;

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
        setCurrentAmountValue(0);
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
            dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
            status: 'CONFIRMED',
            eventId: eventId || undefined,
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
    setCurrentAmountValue(0);
    setInstallmentPreFill(null);
  };

  const handleGoogleCallback = async (idToken: string) => {
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id_token: idToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || data.message || 'Falha no login com Google');
      setUser({
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        role: data.user.role,
      });
      setActiveView(AppView.DASHBOARD);
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao entrar com Google. Tente novamente.');
    }
  };

  const handleEmailLogin = async (email: string, password: string) => {
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
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || data.message || 'E-mail ou senha incorretos');
      setUser({
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        role: data.user.role,
      });
      setLoginError('');
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao fazer login. Tente novamente.');
    }
  };

  const handleRegister = async (name: string, email: string, password: string) => {
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
        body: JSON.stringify({ full_name: name.trim(), email, password, consent: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || data.message || 'Erro ao criar conta');
      setUser({
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        role: data.user.role,
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
      setUser({
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        role: data.user.role,
      });
    } catch (err: any) {
      setLoginError((err as any).message || 'Erro ao redefinir senha.');
    }
  };

  const handleActivatePlan = (code: string) => {
    if (code === 'FIADO30') {
      setPlan({ ...PLANS.PRO, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      setIsPro(true);
      setIsUpgradeModalOpen(false);
      alert('Plano Pro ativado por 30 dias!');
    } else if (code === 'FIADO97') {
      setPlan({ ...PLANS.ENTERPRISE });
      setIsPro(true);
      setIsUpgradeModalOpen(false);
      alert('Plano Enterprise ativado!');
    } else {
      alert('Código de ativação inválido. Verifique o código recebido e tente novamente.');
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
      {plan.hasAds && <AdBanner onUpgrade={() => setIsUpgradeModalOpen(true)} t={t} />}
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
          onUpgrade={() => setIsUpgradeModalOpen(true)}
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
              t={t}
            />
          )}
          {activeView === AppView.CUSTOMERS && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-medium outline-none"
                  />
                </div>
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
                          <p className="text-xs text-slate-400 font-bold">{c.phone}</p>
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
                            {c.rawBalance < 0 ? '-' : ''}
                            {formatCurrency(Math.abs(c.rawBalance))}
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
              setIsUpgradeModalOpen={() => setIsUpgradeModalOpen(true)}
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
              setIsEventModalOpen={setIsEventModalOpen}
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
              onDeleteAccount={openDeleteAccountModal}
            />
          )}

          {showDeleteAccountModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 16,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 32,
                  maxWidth: 400,
                  width: '100%',
                }}
              >
                <h3 style={{ color: '#dc2626', marginBottom: 8 }}>⚠️ Excluir minha conta</h3>
                <p style={{ color: '#374151', marginBottom: 16, fontSize: 14 }}>
                  Esta acao e <strong>irreversivel</strong>. Todos os seus dados (clientes, fiados,
                  historico) serao permanentemente removidos.
                </p>
                <input
                  type="password"
                  placeholder="Digite sua senha para confirmar"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDeleteAccount()}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    marginBottom: 8,
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
                {deleteError && (
                  <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{deleteError}</p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setShowDeleteAccountModal(false);
                      setDeletePassword('');
                      setDeleteError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: 'none',
                      borderRadius: 8,
                      background: '#dc2626',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {deleteLoading ? 'Excluindo...' : 'Excluir conta'}
                  </button>
                </div>
              </div>
            </div>
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
          {activeView === AppView.ADMIN && user?.role === 'admin' && <AdminPanel />}
        </Layout>
        {/* FAB - Floating Action Button */}
        <button
          onClick={() => setIsQuickAddOpen(true)}
          style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 55 }}
          className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-[20px] shadow-2xl flex items-center justify-center hover:from-indigo-600 hover:to-violet-700 transition-all active:scale-95 hover:scale-105 hover:-translate-y-1"
          title="Acesso Rápido"
        >
          <Plus className="w-8 h-8" />
        </button>

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
                  background:
                    quickAddStep === 1
                      ? 'linear-gradient(135deg,#6366F1,#8B5CF6)'
                      : quickAddType === 'DEBT'
                        ? 'linear-gradient(135deg,#F97316,#EF4444)'
                        : 'linear-gradient(135deg,#10B981,#059669)',
                }}
              >
                <button
                  onClick={() => {
                    if (quickAddStep === 2) {
                      setQuickAddStep(1);
                    } else {
                      setIsQuickAddOpen(false);
                      setQuickAddSearch('');
                      setQuickAddStep(1);
                    }
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)',
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
                <p style={{ fontSize: 17, fontWeight: 900, color: 'white', margin: 0 }}>
                  {quickAddStep === 1
                    ? '⚡ Acesso Rápido'
                    : quickAddType === 'DEBT'
                      ? '💸 Lançar Dívida — Selecione o cliente'
                      : '✅ Registrar Pagamento — Selecione o cliente'}
                </p>
              </div>
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
                                border: '1px solid #F1F5F9',
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
                                  background: quickAddType === 'DEBT' ? '#FEE2E2' : '#DCFCE7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 900,
                                  fontSize: 18,
                                  color: quickAddType === 'DEBT' ? '#DC2626' : '#16A34A',
                                  flexShrink: 0,
                                }}
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1 }}>
                                <p
                                  style={{
                                    fontWeight: 800,
                                    fontSize: 15,
                                    color: '#0F172A',
                                    margin: 0,
                                  }}
                                >
                                  {c.name}
                                </p>
                                <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
                                  {c.phone || 'Sem telefone'}
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
                  background: 'linear-gradient(135deg,#0F172A,#1E293B)',
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
                      <input
                        type="date"
                        value={noteFilterDate}
                        onChange={(e) => setNoteFilterDate(e.target.value)}
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
                          new Date(n.createdAt).toLocaleDateString() ===
                            new Date(noteFilterDate + 'T00:00:00').toLocaleDateString(),
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
                                {new Date(note.createdAt).toLocaleString()}
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
                  background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                }}
              >
                <button
                  onClick={() => {
                    setIsCustomerModalOpen(false);
                    setIsEditCustomerModalOpen(false);
                    setPendingTransactionAfterCreate(false);
                    setPendingNewCustomerName('');
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)',
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
                <p style={{ fontSize: 17, fontWeight: 900, color: 'white', margin: 0 }}>
                  {isEditCustomerModalOpen ? t.editCustomer : t.addNewCustomer}
                </p>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const cData = {
                        name: fd.get('name') as string,
                        phone: (fd.get('phone') as string).trim(),
                        email: fd.get('email') as string,
                        pixKey: fd.get('pixKey') as string,
                      };
                      if (!cData.phone) {
                        showToast(t.phoneRequired);
                        return;
                      }
                      if (!isEditCustomerModalOpen) {
                        if (!canAddCustomer()) {
                          showToast(t.maxCustomersReached);
                          setIsUpgradeModalOpen(true);
                          return;
                        }
                        const duplicate = customers.find(
                          (c) => c.phone.replace(/\D/g, '') === cData.phone.replace(/\D/g, ''),
                        );
                        if (duplicate) {
                          showToast(t.phoneDuplicate);
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
                        const newId = generateId();
                        setCustomers((prev) => [
                          ...prev,
                          {
                            id: newId,
                            ...cData,
                            notes: [],
                            createdAt: Date.now(),
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
                    }}
                    className="space-y-6"
                  >
                    {[
                      {
                        label: t.fullName,
                        name: 'name',
                        type: 'text',
                        required: true,
                        defaultValue: isEditCustomerModalOpen
                          ? customers.find((c) => c.id === selectedCustomerId)?.name
                          : pendingTransactionAfterCreate
                            ? pendingNewCustomerName
                            : '',
                        placeholder: 'Nome completo',
                        autoFocus: true,
                      },
                      {
                        label: t.phoneNumber,
                        name: 'phone',
                        type: 'tel',
                        required: false,
                        defaultValue: isEditCustomerModalOpen
                          ? customers.find((c) => c.id === selectedCustomerId)?.phone
                          : '',
                        placeholder: '(00) 00000-0000',
                      },
                      {
                        label: t.email,
                        name: 'email',
                        type: 'email',
                        required: false,
                        defaultValue: isEditCustomerModalOpen
                          ? customers.find((c) => c.id === selectedCustomerId)?.email
                          : '',
                        placeholder: 'email@exemplo.com',
                      },
                      {
                        label: t.pixKeyLabel,
                        name: 'pixKey',
                        type: 'text',
                        required: false,
                        defaultValue: isEditCustomerModalOpen
                          ? customers.find((c) => c.id === selectedCustomerId)?.pixKey
                          : '',
                        placeholder: t.pixKeyPlaceholder,
                      },
                    ].map((field) => (
                      <div key={field.name} style={{ marginBottom: 16 }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#94A3B8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: 8,
                          }}
                        >
                          {field.label}
                        </label>
                        <input
                          required={field.required}
                          name={field.name}
                          type={field.type}
                          defaultValue={field.defaultValue || ''}
                          placeholder={field.placeholder}
                          autoFocus={field.autoFocus}
                          style={{
                            width: '100%',
                            padding: '14px 16px',
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
                    ))}
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: 16,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 900,
                        fontSize: 16,
                        color: 'white',
                        background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                        boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
                        marginTop: 8,
                      }}
                    >
                      {isEditCustomerModalOpen ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                    </button>
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
                  background:
                    transactionType === 'DEBT'
                      ? 'linear-gradient(135deg,#1C2446,#26315B)'
                      : transactionType === 'PAYMENT'
                        ? 'linear-gradient(135deg,#2E9D6F,#25835D)'
                        : transactionType === 'ABATIMENTO'
                          ? 'linear-gradient(135deg,#7252E2,#5F3FD1)'
                          : transactionType === 'REFUND'
                            ? 'linear-gradient(135deg,#3D559C,#2F4480)'
                            : 'linear-gradient(135deg,#5967D8,#4654C4)',
                }}
              >
                <button
                  onClick={() => {
                    setIsTransactionModalOpen(false);
                    setInstallmentPreFill(null);
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)',
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
                    {editTransactionData
                      ? 'Editar Lançamento'
                      : transactionType === 'DEBT'
                        ? t.addDebt
                        : transactionType === 'PAYMENT'
                          ? t.addPayment
                          : transactionType === 'ABATIMENTO'
                            ? 'Registrar Abatimento'
                            : transactionType === 'REFUND'
                              ? 'Registrar Devolução'
                              : t.addPayment}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                    {selectedCustomer?.name || ''}
                  </p>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
                  {(transactionType === 'ABATIMENTO' || transactionType === 'REFUND') &&
                    selectedCustomer && (
                      <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Saldo do cliente
                        </span>
                        <span
                          className={`text-lg font-black ${selectedCustomer.balance > 0 ? 'text-orange-600' : selectedCustomer.balance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}
                        >
                          Saldo: {formatCurrency(selectedCustomer.balance)}
                        </span>
                      </div>
                    )}
                  <form onSubmit={addTransaction} className="space-y-6">
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
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                        {t.amount} (R$)
                      </label>
                      <input
                        required
                        name="amount"
                        type="number"
                        step="0.01"
                        defaultValue={
                          installmentPreFill?.amount || editTransactionData?.amount || ''
                        }
                        onChange={(e) => setCurrentAmountValue(parseFloat(e.target.value) || 0)}
                        className="w-full px-5 py-4 bg-white border-2 border-[#CCD2E9] rounded-t42md text-4xl font-black focus:outline-none focus:border-[#5967D8]"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                        {t.description}
                      </label>
                      <input
                        required
                        name="description"
                        defaultValue={
                          installmentPreFill?.description || editTransactionData?.description || ''
                        }
                        className="w-full px-5 py-4 bg-white border-2 border-[#CCD2E9] rounded-t42md font-bold focus:outline-none focus:border-[#5967D8]"
                      />
                      {transactionType === 'ABATIMENTO' && (
                        <p className="text-xs text-purple-600 font-bold mt-1">
                          Ex: Recebido em mercadoria, serviço prestado, troca, etc.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
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
                            {ev.name} ({new Date(ev.date).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    {transactionType === 'DEBT' ? (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                          {t.dueDate}
                        </label>
                        <input
                          name="dueDate"
                          type="date"
                          className="w-full px-5 py-3 bg-white border-2 border-[#CCD2E9] rounded-t42md font-bold focus:outline-none focus:border-[#5967D8]"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
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
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                        Comprovante (opcional)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-indigo-50 border-2 border-dashed border-slate-200 hover:border-indigo-300 transition-all min-h-[80px]">
                          <Camera className="w-6 h-6 text-slate-400" />
                          <span className="text-xs font-bold text-slate-500 text-center">
                            Tirar Foto
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            name="attachment"
                            className="hidden"
                          />
                        </label>
                        <label className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-indigo-50 border-2 border-dashed border-slate-200 hover:border-indigo-300 transition-all min-h-[80px]">
                          <Upload className="w-6 h-6 text-slate-400" />
                          <span className="text-xs font-bold text-slate-500 text-center">
                            Escolher Arquivo
                          </span>
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
                      <div className="space-y-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInstallment}
                            onChange={(e) => setIsInstallment(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <span className="font-black text-slate-700 text-sm">
                            Compra parcelada
                          </span>
                        </label>
                        {isInstallment && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
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
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                                  Valor/parcela
                                </label>
                                <p className="px-4 py-3 bg-white rounded-xl font-black text-lg text-indigo-600">
                                  {currentAmountValue > 0 ? (
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
                            {currentAmountValue > 0 &&
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
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasInterest}
                                onChange={(e) => setHasInterest(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600"
                              />
                              <span className="font-bold text-slate-600 text-sm">
                                Cobrar juros compostos
                              </span>
                            </label>
                            {hasInterest && (
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
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
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: 14,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: 16,
                        color: 'white',
                        background:
                          transactionType === 'DEBT'
                            ? 'linear-gradient(135deg,#1C2446,#26315B)'
                            : transactionType === 'ABATIMENTO'
                              ? 'linear-gradient(135deg,#7252E2,#5F3FD1)'
                              : transactionType === 'REFUND'
                                ? 'linear-gradient(135deg,#3D559C,#2F4480)'
                                : 'linear-gradient(135deg,#2E9D6F,#25835D)',
                        boxShadow: '0 8px 24px rgba(16,22,47,0.18)',
                        marginTop: 8,
                      }}
                    >
                      {editTransactionData ? 'Salvar Alterações' : t.confirmTransaction}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </FullScreenModal>
        )}

        {isUpgradeModalOpen && (
          <FullScreenModal>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-t42xl shadow-2xl p-10 space-y-8 animate-in zoom-in overflow-y-auto max-h-[90vh]">
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
                      code: '',
                      features: ['20 clientes', '15 eventos', 'Sem IA', 'Com anúncios'],
                      popular: false,
                    },
                    {
                      planData: PLANS.PRO,
                      code: 'FIADO30',
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
                      code: 'FIADO97',
                      features: [
                        'Clientes ilimitados',
                        'Eventos ilimitados',
                        'IA habilitada',
                        'Sem anúncios',
                      ],
                      popular: false,
                    },
                  ].map((item) => (
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
                      <p className="text-2xl font-black mb-4">
                        {item.planData.monthlyPrice === 0
                          ? 'R$ 0'
                          : `R$ ${item.planData.monthlyPrice}/mês`}
                      </p>
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
                      {item.planData.type !== 'FREE' && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase text-slate-400">
                            Código: <span className="text-indigo-600">{item.code}</span>
                          </p>
                          <button
                            onClick={() => handleActivatePlan(item.code)}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700"
                          >
                            Ativar
                          </button>
                        </div>
                      )}
                      {item.planData.type === 'FREE' && plan.type !== 'FREE' && (
                        <button
                          onClick={() => {
                            setPlan(PLANS.FREE);
                            setIsPro(false);
                            setIsUpgradeModalOpen(false);
                          }}
                          className="w-full py-3 border-2 border-slate-200 rounded-xl font-black text-sm text-slate-500"
                        >
                          Usar Grátis
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-center text-sm font-bold text-slate-400">
                    Tem um código de ativação?
                  </p>
                  <div className="flex gap-3">
                    <input
                      placeholder="Digite o código..."
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border-none font-bold"
                    />
                    <button
                      onClick={() => handleActivatePlan(activationCode)}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700"
                    >
                      Ativar
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setIsUpgradeModalOpen(false)}
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
                  background: 'linear-gradient(135deg,#0EA5E9,#6366F1)',
                }}
              >
                <button
                  onClick={() => setIsEventModalOpen(false)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)',
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
                <p style={{ fontSize: 17, fontWeight: 900, color: 'white', margin: 0 }}>
                  {t.newEvent}
                </p>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const event: BillEvent = {
                        id: generateId(),
                        name: fd.get('name') as string,
                        date: Date.now(),
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
                    }}
                  >
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 8,
                      }}
                    >
                      {t.eventName}
                    </label>
                    <input
                      required
                      name="name"
                      placeholder="Ex: Churrasco no Final de Semana"
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        background: 'white',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: 14,
                        fontSize: 15,
                        fontWeight: 600,
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginBottom: 24,
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                      onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                    />
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: 16,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 900,
                        fontSize: 16,
                        color: 'white',
                        background: 'linear-gradient(135deg,#0EA5E9,#6366F1)',
                        boxShadow: '0 4px 20px rgba(14,165,233,0.3)',
                      }}
                    >
                      Criar Evento e Adicionar Participantes
                    </button>
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
