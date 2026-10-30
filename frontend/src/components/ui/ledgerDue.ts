import { formatBrDate } from '../../utils/formatBr';

/** O atraso já aparece no chip. A data de vencimento entra uma vez só, e só quando não está vencida. */
export function ledgerDueText(overdue: boolean, dueDate?: number): string | null {
  if (overdue) return null;
  if (!dueDate) return 'Sem vencimento';
  return `Vencimento ${formatBrDate(dueDate)}`;
}
