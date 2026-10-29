import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { PLAN_LIMITS, Plan, getUserPlan, maxReportMonths } from './plans.js';

export type LimitKind = 'customers' | 'events' | 'participants';

/** Teto do plano. null significa sem teto. */
export function maxFor(plan: Plan, kind: LimitKind): number | null {
  const limits = PLAN_LIMITS[plan];
  if (kind === 'customers') return limits.maxCustomers;
  if (kind === 'events') return limits.maxEvents;
  return limits.maxParticipantsPerEvent;
}

/** Cabe mais um registro desse tipo nesse plano. */
export function withinLimit(plan: Plan, kind: LimitKind, count: number): boolean {
  const max = maxFor(plan, kind);
  return max === null || count <= max;
}

/** A janela pedida cabe no relatório daquele plano. */
export function reportMonthsAllowed(plan: Plan, months: number): boolean {
  return months <= maxReportMonths(plan);
}

/**
 * Recusa criar clientes acima do teto. Não consulta o provedor de pagamento.
 * adding é quantos clientes novos entram agora.
 */
export async function assertCanAddCustomers(userId: string, adding: number): Promise<void> {
  if (adding <= 0) return;
  const plan = await getUserPlan(userId);
  const max = maxFor(plan, 'customers');
  if (max === null) return;

  const current = await query(
    `SELECT COUNT(*)::int AS total
       FROM customers
      WHERE owner_user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const total = Number(current.rows[0]?.total ?? 0);
  if (total + adding > max) {
    throw new ApiError(403, `Seu plano permite até ${max} clientes.`, 'PLAN_LIMIT');
  }
}
