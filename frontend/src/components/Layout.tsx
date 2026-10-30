import type { ReactNode } from 'react';
import { Home, List, Menu, Users, type LucideIcon } from 'lucide-react';
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

const NAV: { id: AppView; labelKey: 'dashboard' | 'customers' | 'statement' | 'menu'; icon: LucideIcon }[] = [
  { id: AppView.DASHBOARD, labelKey: 'dashboard', icon: Home },
  { id: AppView.CUSTOMERS, labelKey: 'customers', icon: Users },
  { id: AppView.STATEMENT, labelKey: 'statement', icon: List },
  { id: AppView.MENU, labelKey: 'menu', icon: Menu },
];

function activeNav(view: AppView): AppView {
  if (view === AppView.CUSTOMERS || view === AppView.CUSTOMER_DETAIL) return AppView.CUSTOMERS;
  if (view === AppView.STATEMENT) return AppView.STATEMENT;
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
  const item = NAV.find((entry) => entry.id === current);
  const title = item ? t[item.labelKey] : t.menu;

  return (
    <div className="fp-shell">
      <aside className="fp-side">
        <p className="fp-brand">Fiado Pro</p>
        {NAV.map((item) => {
          const Icon = item.icon;
          const on = item.id === current;
          return (
            <button key={item.id} type="button" className={on ? 'on' : ''} onClick={() => setActiveView(item.id)}>
              <Icon size={20} strokeWidth={1.5} />
              {t[item.labelKey]}
            </button>
          );
        })}
      </aside>
      <div className="fp-main">
        <header className="fp-top">
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
        {NAV.map((item) => {
          const Icon = item.icon;
          const on = item.id === current;
          return (
            <button key={item.id} type="button" className={on ? 'on' : ''} onClick={() => setActiveView(item.id)}>
              <Icon size={22} strokeWidth={1.5} />
              {t[item.labelKey]}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
