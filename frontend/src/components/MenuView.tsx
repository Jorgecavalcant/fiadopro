import {
  Bell,
  HelpCircle,
  LayoutList,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  ArrowDownLeft,
  Inbox,
  Users,
} from 'lucide-react';
import { AppView } from '../types';
import { canShowCheckout } from '../utils/androidStore';
import { Button } from './ui/Button';
import { ListRow } from './ui/ListRow';

export function MenuView({
  isAdmin,
  isPro,
  onOpen,
  onLogout,
  onUpgrade,
}: {
  isAdmin: boolean;
  isPro: boolean;
  onOpen: (view: AppView) => void;
  onLogout: () => void;
  onUpgrade: () => void;
}) {
  const items: { view: AppView; title: string; subtitle: string; icon: typeof UserRound }[] = [
    { view: AppView.PROFILE, title: 'Dados da conta', subtitle: 'Nome e e-mail', icon: UserRound },
    { view: AppView.INBOX, title: 'Aprovações', subtitle: 'O que espera a sua confirmação', icon: Inbox },
    { view: AppView.MY_DEBTS, title: 'Minhas dívidas', subtitle: 'O que você deve', icon: ArrowDownLeft },
    { view: AppView.NOTIFICATIONS, title: 'Lembretes', subtitle: 'O que precisa de decisão', icon: Bell },
    { view: AppView.TO_PAY, title: 'A pagar', subtitle: 'Saldo a devolver', icon: ArrowDownLeft },
    { view: AppView.MY_EXPENSES, title: 'Minhas despesas', subtitle: 'O que você gastou', icon: Wallet },
    { view: AppView.CUSTOMER_MANAGEMENT, title: 'Gestão', subtitle: 'Rankings', icon: LayoutList },
    { view: AppView.INSIGHTS, title: 'Insights', subtitle: 'Leitura dos números', icon: Sparkles },
    { view: AppView.SPLIT_BILL, title: 'Dividir conta', subtitle: 'Ratear um valor', icon: Users },
    { view: AppView.HELP, title: 'Ajuda', subtitle: 'Como usar o Fiado Pro', icon: HelpCircle },
  ];
  if (isAdmin) {
    items.push({ view: AppView.ADMIN, title: 'Admin', subtitle: 'Contas', icon: ShieldCheck });
  }

  return (
    <div>
      <div className="fp-list fp-menu">
        {items.map((item) => (
          <ListRow
            key={item.view}
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            onClick={() => onOpen(item.view)}
          />
        ))}
      </div>
      {!isPro && canShowCheckout() ? (
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" block onClick={onUpgrade}>
            Upgrade para PRO
          </Button>
        </div>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <Button variant="danger" block onClick={onLogout}>
          Sair
        </Button>
      </div>
    </div>
  );
}
