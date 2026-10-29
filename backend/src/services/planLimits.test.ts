import { describe, expect, it } from 'vitest';
import { maxFor, reportMonthsAllowed, withinLimit } from './planLimits.js';

describe('planLimits', () => {
  it('Free para em 20 clientes, 15 eventos e 20 participantes', () => {
    expect(maxFor('FREE', 'customers')).toBe(20);
    expect(maxFor('FREE', 'events')).toBe(15);
    expect(maxFor('FREE', 'participants')).toBe(20);
    expect(withinLimit('FREE', 'customers', 20)).toBe(true);
    expect(withinLimit('FREE', 'customers', 21)).toBe(false);
    expect(withinLimit('FREE', 'events', 16)).toBe(false);
    expect(withinLimit('FREE', 'participants', 21)).toBe(false);
  });

  it('Pro para em 500 clientes e 500 participantes, sem teto de eventos', () => {
    expect(withinLimit('PRO', 'customers', 500)).toBe(true);
    expect(withinLimit('PRO', 'customers', 501)).toBe(false);
    expect(withinLimit('PRO', 'events', 10000)).toBe(true);
    expect(withinLimit('PRO', 'participants', 501)).toBe(false);
  });

  it('Enterprise e admin não têm teto', () => {
    expect(maxFor('ENTERPRISE', 'customers')).toBeNull();
    expect(maxFor('ADMIN', 'events')).toBeNull();
    expect(withinLimit('ENTERPRISE', 'participants', 100000)).toBe(true);
  });

  it('relatório: 6, 12 e 60 meses', () => {
    expect(reportMonthsAllowed('FREE', 6)).toBe(true);
    expect(reportMonthsAllowed('FREE', 7)).toBe(false);
    expect(reportMonthsAllowed('PRO', 12)).toBe(true);
    expect(reportMonthsAllowed('PRO', 13)).toBe(false);
    expect(reportMonthsAllowed('ENTERPRISE', 60)).toBe(true);
    expect(reportMonthsAllowed('ADMIN', 60)).toBe(true);
    expect(reportMonthsAllowed('ENTERPRISE', 61)).toBe(false);
  });
});
