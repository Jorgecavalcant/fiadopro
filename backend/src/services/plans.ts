import { query } from '../config/database.js';

export type Plan = 'FREE' | 'PRO' | 'ADMIN';

interface PlanRow {
  role: string | null;
  plan: string | null;
  status: string | null;
  current_period_end: string | Date | null;
}

/**
 * Resolve o plano efetivo do usuario:
 * - 'ADMIN' se users.role = 'admin' (frente CORE);
 * - 'PRO' se houver assinatura ativa e dentro da validade;
 * - 'FREE' em qualquer outro caso (inclusive falha de leitura — nunca quebra o app).
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  try {
    const result = await query(
      `SELECT u.role, s.plan, s.status, s.current_period_end
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id
        WHERE u.id = $1`,
      [userId],
    );
    const row: PlanRow | undefined = result.rows[0];
    if (!row) return 'FREE';

    if (row.role === 'admin') return 'ADMIN';

    const isProPlan = row.plan === 'PRO' && row.status === 'active';
    const notExpired = !row.current_period_end || new Date(row.current_period_end) > new Date();
    if (isProPlan && notExpired) return 'PRO';

    return 'FREE';
  } catch (err) {
    console.error('[Billing] Erro ao consultar plano do usuario:', err);
    return 'FREE';
  }
}

/** Janela maxima (em meses) de relatorios permitida para cada plano. */
export function maxReportMonths(plan: Plan): number {
  switch (plan) {
    case 'ADMIN':
      return 60;
    case 'PRO':
      return 12;
    case 'FREE':
    default:
      return 6;
  }
}
