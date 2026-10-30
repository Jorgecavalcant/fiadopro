import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { Customer, Transaction } from '../types';
import { formatBrDate } from '../utils/formatBr';
import { EmptyState } from './ui/EmptyState';
import { ListRow } from './ui/ListRow';

export function StatementView({
  transactions,
  customers,
  formatCurrency,
}: {
  transactions: Transaction[];
  customers: Customer[];
  formatCurrency: (value: number) => string;
}) {
  const names = new Map(customers.map((customer) => [customer.id, customer.name]));
  const rows = [...transactions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 40);

  if (rows.length === 0) {
    return <EmptyState text="Nenhum lançamento ainda." />;
  }

  return (
    <div className="fp-list">
      {rows.map((row) => {
        const incoming = row.type === 'PAYMENT';
        const outgoing = row.type === 'REFUND' || row.type === 'ABATIMENTO';
        const amount = outgoing ? `- ${formatCurrency(row.amount)}` : formatCurrency(row.amount);
        return (
          <ListRow
            key={row.id}
            icon={incoming ? ArrowDownLeft : ArrowUpRight}
            title={row.description || 'Lançamento'}
            subtitle={`${formatBrDate(row.timestamp)} · ${names.get(row.customerId) ?? 'Pessoa'}`}
            amount={amount}
            amountTone={incoming ? 'in' : 'plain'}
          />
        );
      })}
    </div>
  );
}
