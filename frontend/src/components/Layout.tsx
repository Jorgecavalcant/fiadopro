import type { ReactNode } from 'react';
import { Home, Menu, ReceiptText, SquareSplitHorizontal, Users, type LucideIcon } from 'lucide-react';
import { AppView, Language, User } from '../types';
import { translations } from '../translations';

interface LayoutProps {
  children: ReactNode;
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
  isAdmin?: boolean;
}

type NavItem = { id: AppView; labelKey: 'dashboard' | 'customers' | 'splitBill' | 'statement' | 'menu'; icon: LucideIcon };

export const SIDE_NAV: NavItem[] = [
  { id: AppView.DASHBOARD, labelKey: 'dashboard', icon: Home },
  { id: AppView.CUSTOMERS, labelKey: 'customers', icon: Users },
  { id: AppView.SPLIT_BILL, labelKey: 'splitBill', icon: SquareSplitHorizontal },
  { id: AppView.STATEMENT, labelKey: 'statement', icon: ReceiptText },
  { id: AppView.MENU, labelKey: 'menu', icon: Menu },
];

export const TAB_NAV: NavItem[] = SIDE_NAV.filter((item) => item.id !== AppView.SPLIT_BILL);

function activeNav(view: AppView): AppView {
  if (view === AppView.CUSTOMERS || view === AppView.CUSTOMER_DETAIL) return AppView.CUSTOMERS;
  if (view === AppView.STATEMENT) return AppView.STATEMENT;
  if (view === AppView.SPLIT_BILL) return AppView.SPLIT_BILL;
  if (view === AppView.DASHBOARD) return AppView.DASHBOARD;
  return AppView.MENU;
}

const Layout = ({
  children,
  activeView,
  setActiveView,
  language,
  setLanguage,
  isPro,
  user,
}: LayoutProps) => {
  const t = translations[language];
  const current = activeNav(activeView);
  const item = SIDE_NAV.find((entry) => entry.id === current);
  const title = item ? t[item.labelKey] : t.menu;

  return (
    <div className="fp-shell">
      <aside className="fp-side">
        <p className="fp-brand">Fiado Pro</p>
        {SIDE_NAV.map((entry) => {
          const Icon = entry.icon;
          const on = entry.id === current;
          return (
            <button key={entry.id} type="button" className={on ? 'on' : ''} onClick={() => setActiveView(entry.id)}>
              <Icon size={20} strokeWidth={1.5} />
              {t[entry.labelKey]}
            </button>
          );
        })}
      </aside>
      <div className="fp-main">
        <header className="fp-top" hidden={activeView === AppView.DASHBOARD}>
          <h1>{title}</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {isPro ? <span style={{ color: 'var(--fp-navy)', fontWeight: 600, fontSize: 13 }}>Pro</span> : null}
            <button
              type="button"
              className="fp-lang"
              onClick={() => setLanguage(language === 'pt-BR' ? 'en' : 'pt-BR')}
            >
              {language === 'pt-BR' ? 'PT' : 'EN'}
            </button>
            <button type="button" className="fp-avatar" onClick={() => setActiveView(AppView.PROFILE)} aria-label="Minha conta">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'T'}
            </button>
          </div>
        </header>
        <main className="fp-scroll">
          <div style={{ maxWidth: 880, margin: '0 auto', padding: '8px 16px 24px' }}>{children}</div>
        </main>
      </div>
      <nav className="fp-tabbar" aria-label="Navegação">
        {TAB_NAV.map((entry) => {
          const Icon = entry.icon;
          const on = entry.id === current;
          return (
            <button key={entry.id} type="button" className={on ? 'on' : ''} onClick={() => setActiveView(entry.id)}>
              <Icon size={22} strokeWidth={1.5} />
              {t[entry.labelKey]}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
