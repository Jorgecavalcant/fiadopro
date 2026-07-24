import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Wallet,
  Menu,
  Crown,
  Receipt,
  LogOut,
  Bell,
  ArrowDownCircle,
  BarChart2,
  ChevronLeft,
  Settings,
  Zap,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { AppView, Language, User } from '../types';
import { translations } from '../translations';

interface LayoutProps {
  children: React.ReactNode;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  isPro: boolean;
  onUpgrade: () => void;
  user: User | null;
  onLogout: () => void;
  pendingCount?: number;
  refundsCount?: number;
  ownerExpensesCount?: number;
  inboxCount?: number;
  /** Backend nunca confia no frontend: só controla a VISIBILIDADE do botão. */
  isAdmin?: boolean;
}

const viewLabels: Partial<Record<AppView, string>> = {
  [AppView.DASHBOARD]: 'Dashboard',
  [AppView.CUSTOMERS]: 'Clientes',
  [AppView.SPLIT_BILL]: 'Eventos',
  [AppView.NOTIFICATIONS]: 'Notificações',
  [AppView.TO_PAY]: 'A Pagar',
  [AppView.MY_EXPENSES]: 'Minhas Despesas',
  [AppView.CUSTOMER_MANAGEMENT]: 'Gestão de Clientes',
  [AppView.HELP]: 'Ajuda & Suporte',
  [AppView.INSIGHTS]: 'Insights',
  [AppView.PROFILE]: 'Meu Perfil',
  [AppView.AUDIT_LOG]: 'Auditoria',
  [AppView.CUSTOMER_DETAIL]: 'Detalhes do Cliente',
  [AppView.EVENT_DETAIL]: 'Detalhes do Evento',
  [AppView.DEBTORS_LIST]: 'Lista de Devedores',
  [AppView.RECEIVABLES_LIST]: 'Recebíveis',
  [AppView.SCORE_DETAIL]: 'Score de Crédito',
  [AppView.INBOX]: 'Aprovações',
  [AppView.MY_DEBTS]: 'Minhas Dívidas',
};

const AVATAR_COLORS = [
  'from-violet-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-blue-400 to-cyan-500',
  'from-fuchsia-500 to-purple-600',
];

const Layout: React.FC<LayoutProps> = ({
  children,
  activeView,
  setActiveView,
  language,
  setLanguage,
  isPro,
  onUpgrade,
  user,
  onLogout,
  pendingCount = 0,
  refundsCount = 0,
  ownerExpensesCount = 0,
  inboxCount = 0,
  isAdmin = false,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const t = translations[language];

  useEffect(() => {
    setMobileOpen(false);
  }, [activeView]);

  const avatarColor = AVATAR_COLORS[(user?.name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  const pageTitle = viewLabels[activeView] ?? t.dashboard;

  const navMain = [
    { id: AppView.DASHBOARD, label: t.dashboard, icon: LayoutDashboard, badge: 0 },
    { id: AppView.CUSTOMERS, label: t.customers, icon: Users, badge: 0 },
    { id: AppView.SPLIT_BILL, label: t.splitBill, icon: Receipt, badge: 0 },
  ];
  const navOps = [
    { id: AppView.INBOX, label: 'Aprovações', icon: Zap, badge: inboxCount },
    { id: AppView.MY_DEBTS, label: 'Minhas Dívidas', icon: ArrowDownCircle, badge: 0 },
    { id: AppView.NOTIFICATIONS, label: t.notifications, icon: Bell, badge: pendingCount },
    { id: AppView.TO_PAY, label: t.toPay, icon: ArrowDownCircle, badge: refundsCount },
    {
      id: AppView.MY_EXPENSES,
      label: t.myExpenses || 'Minhas Despesas',
      icon: Wallet,
      badge: ownerExpensesCount,
    },
    {
      id: AppView.CUSTOMER_MANAGEMENT,
      label: t.customerManagement || 'Gestão',
      icon: BarChart2,
      badge: 0,
    },
    { id: AppView.INSIGHTS, label: t.insights, icon: TrendingUp, badge: 0 },
    { id: AppView.HELP, label: 'Ajuda & Suporte', icon: HelpCircle, badge: 0 },
    ...(isAdmin ? [{ id: AppView.ADMIN, label: 'Admin', icon: ShieldCheck, badge: 0 }] : []),
  ];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#F1F5F9' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(4px)',
          }}
          className="md:hidden"
        />
      )}

      {/* ══════════════ SIDEBAR ══════════════ */}
      <aside
        style={{
          width: collapsed ? 72 : 260,
          minWidth: collapsed ? 72 : 260,
          background: '#0F172A',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          boxShadow: '4px 0 32px rgba(0,0,0,0.2)',
          transition:
            'min-width 280ms cubic-bezier(.4,0,.2,1), width 280ms cubic-bezier(.4,0,.2,1)',
          zIndex: 50,
        }}
        className={`
          fixed inset-y-0 left-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          transition-transform duration-300 md:transition-none
        `}
      >
        {/* Brand bar */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 18px' : '0 16px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            gap: 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              flexShrink: 0,
              background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              boxShadow: '0 4px 14px rgba(99,102,241,.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wallet style={{ width: 18, height: 18, color: 'white' }} />
          </div>

          {!collapsed && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p
                style={{
                  color: 'white',
                  fontWeight: 900,
                  fontSize: 15,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}
              >
                Fiado<span style={{ color: '#818CF8' }}>Pro</span>
              </p>
              <p
                style={{
                  color: 'rgba(148,163,184,0.65)',
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {isPro ? '✦ Plano PRO' : 'Plano Gratuito'}
              </p>
            </div>
          )}

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(148,163,184,0.5)',
              transition: 'background 150ms, color 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(148,163,184,0.5)';
            }}
          >
            <ChevronLeft
              style={{
                width: 16,
                height: 16,
                transition: 'transform 280ms',
                transform: collapsed ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>
        </div>

        {/* Nav */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {!collapsed && <NavLabel>Principal</NavLabel>}
          {collapsed && <div style={{ height: 8 }} />}
          {navMain.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={activeView === item.id}
              collapsed={collapsed}
              onClick={() => setActiveView(item.id)}
            />
          ))}

          <div style={{ height: 12 }} />
          {!collapsed && <NavLabel>Operações</NavLabel>}

          {navOps.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={activeView === item.id}
              collapsed={collapsed}
              onClick={() => setActiveView(item.id)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {!isPro && !collapsed && (
            <button
              onClick={onUpgrade}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                color: 'white',
                fontWeight: 700,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(99,102,241,.35)',
                marginBottom: 4,
                transition: 'opacity 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <Zap style={{ width: 14, height: 14 }} /> Upgrade para PRO
            </button>
          )}

          {/* Profile button */}
          <button
            onClick={() => setActiveView(AppView.PROFILE)}
            style={{
              width: '100%',
              padding: collapsed ? '9px' : '8px 10px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              className={`bg-gradient-to-br ${avatarColor}`}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                color: 'white',
                fontSize: 14,
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            {!collapsed && (
              <>
                <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                  <p
                    style={{ color: 'white', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}
                    className="truncate"
                  >
                    {user?.name ?? 'Usuário'}
                  </p>
                  <p style={{ color: 'rgba(148,163,184,0.65)', fontSize: 11 }} className="truncate">
                    {user?.email ?? ''}
                  </p>
                </div>
                <Settings
                  style={{ width: 15, height: 15, color: 'rgba(148,163,184,0.45)', flexShrink: 0 }}
                />
              </>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              padding: collapsed ? '9px' : '8px 10px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: 'rgba(252,165,165,0.8)',
              transition: 'background 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
              e.currentTarget.style.color = '#FCA5A5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(252,165,165,0.8)';
            }}
          >
            <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
            {!collapsed && <span style={{ fontSize: 13, fontWeight: 700 }}>Sair</span>}
          </button>
        </div>
      </aside>

      {/* ══════════════ MAIN ══════════════ */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 14,
            background: 'white',
            flexShrink: 0,
            zIndex: 30,
            borderBottom: '1px solid rgba(226,232,240,0.8)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Menu — esconde/revela a sidebar. Abaixo de md, alterna o overlay
              móvel; em md+, alterna entre a barra lateral cheia e colapsada
              (o mesmo estado que o ChevronLeft dentro da sidebar controla). */}
          <button
            onClick={() => {
              if (window.matchMedia('(min-width: 768px)').matches) {
                setCollapsed((c) => !c);
              } else {
                setMobileOpen((o) => !o);
              }
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Mostrar/ocultar menu"
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>

          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: '#0F172A',
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              {pageTitle}
            </h1>
            {isPro && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#FEF3C7',
                  color: '#B45309',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 99,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <Crown style={{ width: 10, height: 10 }} /> PRO
              </span>
            )}
          </div>

          {/* Right actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {pendingCount > 0 && (
              <button
                onClick={() => setActiveView(AppView.NOTIFICATIONS)}
                style={{
                  position: 'relative',
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Bell style={{ width: 20, height: 20 }} />
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 17,
                    height: 17,
                    borderRadius: '50%',
                    background: '#EF4444',
                    color: 'white',
                    fontSize: 9,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pendingCount}
                </span>
              </button>
            )}

            {refundsCount > 0 && (
              <button
                onClick={() => setActiveView(AppView.TO_PAY)}
                style={{
                  position: 'relative',
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ArrowDownCircle style={{ width: 20, height: 20 }} />
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 17,
                    height: 17,
                    borderRadius: '50%',
                    background: '#F97316',
                    color: 'white',
                    fontSize: 9,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {refundsCount}
                </span>
              </button>
            )}

            {/* Language */}
            <button
              onClick={() => setLanguage(language === 'pt-BR' ? 'en' : 'pt-BR')}
              className="hidden sm:flex"
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: '#64748B',
                fontSize: 13,
                fontWeight: 700,
                alignItems: 'center',
                gap: 5,
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {language === 'pt-BR' ? '🇧🇷' : '🇺🇸'}
            </button>

            <div
              style={{ width: 1, height: 24, background: '#E2E8F0', margin: '0 2px' }}
              className="hidden sm:block"
            />

            {/* Profile */}
            <button
              onClick={() => setActiveView(AppView.PROFILE)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 12px 4px 6px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                className={`bg-gradient-to-br ${avatarColor}`}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  color: 'white',
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <span
                className="hidden sm:block"
                style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}
              >
                {user?.name?.split(' ')[0] ?? 'Usuário'}
              </span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main key={activeView} style={{ flex: 1, overflowY: 'auto' }}>
          <div
            style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}
            className="fp-view-enter"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

/* ─── Helper components ─── */
const NavLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.12em',
      color: 'rgba(148,163,184,0.45)',
      textTransform: 'uppercase',
      padding: '0 10px 6px',
      marginTop: 2,
    }}
  >
    {children}
  </p>
);

interface SidebarItemProps {
  item: {
    id: AppView;
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    badge: number;
  };
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, active, collapsed, onClick }) => {
  const Icon = item.icon;
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={collapsed ? item.label : undefined}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: collapsed ? '10px' : '10px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        background: active
          ? 'rgba(99,102,241,0.22)'
          : hover
            ? 'rgba(255,255,255,0.06)'
            : 'transparent',
        color: active ? 'white' : hover ? 'white' : 'rgba(148,163,184,0.75)',
        fontWeight: 600,
        fontSize: 13.5,
        textAlign: 'left',
        transition: 'background 150ms, color 150ms',
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '20%',
            height: '60%',
            width: 3,
            background: '#818CF8',
            borderRadius: '0 4px 4px 0',
          }}
        />
      )}

      <Icon
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          color: active ? '#A5B4FC' : 'currentColor',
        }}
      />

      {!collapsed && (
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {item.label}
        </span>
      )}

      {item.badge > 0 && !collapsed && (
        <span
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: 99,
            background: item.id === AppView.NOTIFICATIONS ? '#EF4444' : '#F97316',
            color: 'white',
            fontSize: 10,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
          }}
        >
          {item.badge}
        </span>
      )}

      {item.badge > 0 && collapsed && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#EF4444',
            color: 'white',
            fontSize: 9,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.badge}
        </span>
      )}

      {/* Tooltip (collapsed) */}
      {collapsed && hover && (
        <span
          style={{
            position: 'absolute',
            left: '100%',
            marginLeft: 12,
            padding: '6px 12px',
            background: '#1E293B',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 10,
            whiteSpace: 'nowrap',
            zIndex: 100,
            pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {item.label}
          {item.badge > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: '#EF4444',
                borderRadius: 99,
                padding: '1px 6px',
                fontSize: 10,
              }}
            >
              {item.badge}
            </span>
          )}
        </span>
      )}
    </button>
  );
};

export default Layout;
