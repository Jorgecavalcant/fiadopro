export type AdPolicy = 'fullscreen_and_top' | 'local_sponsor' | 'none';

export interface BillingPricePayload {
  prices?: {
    free?: unknown;
    pro?: unknown;
  } | null;
  adPolicy?: unknown;
  plan?: unknown;
  maxReportMonths?: unknown;
}

export interface PlanPriceLabels {
  pro: string | null;
  enterprise: null;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function asPrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Texto do Pro a partir do JSON de GET /api/billing/status.
 * Sem `prices.pro` na resposta, o Pro fica sem número. Enterprise nunca tem preço.
 */
export function planPricesFromStatus(
  payload: BillingPricePayload | null | undefined,
): PlanPriceLabels {
  const amount = asPrice(payload?.prices?.pro);
  return {
    pro: amount === null ? null : `${brl.format(amount)}/mês`,
    enterprise: null,
  };
}

/** O banner que já existe só entra com esta política. local_sponsor e none ficam de fora. */
export function showsFullscreenAd(adPolicy: unknown): boolean {
  return adPolicy === 'fullscreen_and_top';
}
