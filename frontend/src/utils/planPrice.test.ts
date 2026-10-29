import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { canShowCheckout, isAndroidApp } from './androidStore';
import { planPricesFromStatus, showsFullscreenAd } from './planPrice';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
  },
}));

describe('planPricesFromStatus', () => {
  it('devolve o texto do Pro e null para Enterprise', () => {
    const samplePro = 30;
    const result = planPricesFromStatus({
      prices: { free: 0, pro: samplePro },
      adPolicy: 'fullscreen_and_top',
      plan: 'FREE',
      maxReportMonths: 6,
    });
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(samplePro);

    expect(result.pro).toBe(`${formatted}/mês`);
    expect(result.enterprise).toBeNull();
  });

  it('não inventa preço quando a API não manda o Pro', () => {
    expect(planPricesFromStatus({ prices: { free: 0 } }).pro).toBeNull();
    expect(planPricesFromStatus({ prices: {} }).enterprise).toBeNull();
    expect(planPricesFromStatus(null).pro).toBeNull();
    expect(planPricesFromStatus({ prices: { pro: '30' } }).pro).toBeNull();
  });
});

describe('showsFullscreenAd', () => {
  it('só libera o banner na política de tela cheia', () => {
    expect(showsFullscreenAd('fullscreen_and_top')).toBe(true);
    expect(showsFullscreenAd('local_sponsor')).toBe(false);
    expect(showsFullscreenAd('none')).toBe(false);
    expect(showsFullscreenAd(undefined)).toBe(false);
  });
});

describe('checkout no Android', () => {
  it('pode mostrar checkout é falso quando a plataforma é android', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    expect(isAndroidApp()).toBe(true);
    expect(canShowCheckout()).toBe(false);
  });

  it('pode mostrar checkout no site', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
    expect(isAndroidApp()).toBe(false);
    expect(canShowCheckout()).toBe(true);
  });
});

describe('pacote sem preço fixo', () => {
  it('não grava preço nem código promocional no código de produção', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = [
      resolve(here, '../App.tsx'),
      resolve(here, '../components/UpgradePlano.tsx'),
      resolve(here, './planPrice.ts'),
    ];
    const needles = [
      /monthlyPrice:\s*30\b/,
      /monthlyPrice:\s*97\b/,
      /FIADO97/,
      /'R\$ 30'/,
      /'R\$ 97'/,
      /"R\$ 30"/,
      /"R\$ 97"/,
    ];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const needle of needles) {
        expect(text, `${file} contém ${needle}`).not.toMatch(needle);
      }
    }
  });
});
