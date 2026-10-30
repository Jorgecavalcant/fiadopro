import { query } from '../config/database.js';

/** Plano vendável. ADMIN é papel da plataforma, não assinatura. */
export type SellablePlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type Plan = SellablePlan | 'ADMIN';

/** Dias do teste grátis. Só o admin concede, uma vez por pessoa (coluna trial_used_at). */
export const TRIAL_DAYS = 14;

/**
 * Preço do Pro em reais. Fonte única da cobrança.
 * A variável ASAAS_PRO_PRICE não altera este número.
 */
export const PRO_MONTHLY_PRICE = 30;

/** Referência interna do Enterprise. Não vai para a API nem para o checkout. */
export const ENTERPRISE_REFERENCE_PRICE = 97;

export const PLAN_LIMITS = {
  FREE: { maxCustomers: 20, maxEvents: 15, maxParticipantsPerEvent: 20, maxReportMonths: 6 },
  PRO: { maxCustomers: 500, maxEvents: null, maxParticipantsPerEvent: 500, maxReportMonths: 12 },
  ENTERPRISE: {
    maxCustomers: null,
    maxEvents: null,
    maxParticipantsPerEvent: null,
    maxReportMonths: 60,
  },
  ADMIN: {
    maxCustomers: null,
    maxEvents: null,
    maxParticipantsPerEvent: null,
    maxReportMonths: 60,
  },
} as const;

export type AdPolicy = 'fullscreen_and_top' | 'local_sponsor' | 'none';

const GRANT_SOURCES = ['cortesia', 'trial', 'cupom', 'promocao'] as const;
const RANK: Record<SellablePlan, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };

export interface PlanRow {
  role: string | null;
  plan: string | null;
  status: string | null;
  current_period_end: string | Date | null;
  grant_plan?: string | null;
  grant_source?: string | null;
  grant_expires_at?: string | Date | null;
  promotion_plan?: string | null;
}

/** Preço que o site pode mostrar. Enterprise fica de fora. */
export function publicPlanPrices(): { free: 0; pro: number } {
  return { free: 0, pro: PRO_MONTHLY_PRICE };
}

/** Regra de anúncio. A peça em si é a fase seguinte. */
export function adPolicyFor(plan: Plan): AdPolicy {
  if (plan === 'FREE') return 'fullscreen_and_top';
  if (plan === 'PRO') return 'local_sponsor';
  return 'none';
}

function isFuture(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time > Date.now();
}

function asSellable(value: string | null | undefined): SellablePlan | null {
  if (value === 'PRO' || value === 'ENTERPRISE') return value;
  return null;
}

function duePlan(row: PlanRow): SellablePlan {
  const plan = asSellable(row.plan);
  if (!plan || row.status !== 'active') return 'FREE';
  if (row.current_period_end && !isFuture(row.current_period_end)) return 'FREE';
  return plan;
}

function activeGrant(row: PlanRow): SellablePlan | null {
  const plan = asSellable(row.grant_plan);
  if (!plan) return null;
  if (!GRANT_SOURCES.includes(row.grant_source as (typeof GRANT_SOURCES)[number])) return null;
  if (row.grant_source === 'trial') {
    return isFuture(row.grant_expires_at) ? plan : null;
  }
  if (row.grant_expires_at && !isFuture(row.grant_expires_at)) return null;
  return plan;
}

function higher(current: SellablePlan, next: SellablePlan | null): SellablePlan {
  if (!next || RANK[next] <= RANK[current]) return current;
  return next;
}

/**
 * Plano efetivo:
 * papel admin; senão a maior entre assinatura paga vigente, concessão vigente e promoção vigente.
 * Concessão ou promoção vencida não entra. O plano pago, se ainda valer, continua.
 */
export function resolveEffectivePlan(row: PlanRow): Plan {
  if (row.role === 'admin') return 'ADMIN';
  const promo = asSellable(row.promotion_plan);
  return higher(higher(duePlan(row), activeGrant(row)), promo);
}

/**
 * Lê o plano no banco. Falha de leitura devolve FREE e confirmed false.
 * O app antigo continua recebendo FREE. Patrocínio usa confirmed para não
 * abrir tela cheia quando o plano não foi lido. Não consulta o provedor.
 */
export async function readUserPlan(userId: string): Promise<{ plan: Plan; confirmed: boolean }> {
  try {
    const result = await query(
      `SELECT u.role,
              s.plan,
              s.status,
              s.current_period_end,
              s.grant_plan,
              s.grant_source,
              s.grant_expires_at,
              promo.plan AS promotion_plan
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT p.plan
             FROM plan_promotions p
             LEFT JOIN plan_promotion_users pu
               ON pu.promotion_id = p.id
              AND pu.user_id = u.id
            WHERE p.starts_at <= NOW()
              AND p.expires_at > NOW()
              AND (p.audience = 'all' OR pu.user_id IS NOT NULL)
            ORDER BY CASE p.plan
                       WHEN 'ENTERPRISE' THEN 2
                       WHEN 'PRO' THEN 1
                       ELSE 0
                     END DESC
            LIMIT 1
         ) promo ON TRUE
        WHERE u.id = $1`,
      [userId],
    );
    const row = result.rows[0] as PlanRow | undefined;
    if (!row) return { plan: 'FREE', confirmed: true };
    return { plan: resolveEffectivePlan(row), confirmed: true };
  } catch (err) {
    console.error('[Billing] Erro ao consultar plano do usuario:', err);
    return { plan: 'FREE', confirmed: false };
  }
}

/** Lê o plano no banco. Falha de leitura devolve FREE e não derruba o app. */
export async function getUserPlan(userId: string): Promise<Plan> {
  return (await readUserPlan(userId)).plan;
}

/** Janela máxima (em meses) de relatórios permitida para cada plano. */
export function maxReportMonths(plan: Plan): number {
  return PLAN_LIMITS[plan].maxReportMonths;
}
