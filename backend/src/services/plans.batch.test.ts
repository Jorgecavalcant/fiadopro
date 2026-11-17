vi.mock('../config/database.js', () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../config/database.js';
import { readUserPlansBatch } from './plans.js';

const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockQuery.mockReset();
});

describe('readUserPlansBatch', () => {
  it('returns empty map for empty ids', async () => {
    await expect(readUserPlansBatch([])).resolves.toEqual(new Map());
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('maps ADMIN and fills missing ids with FREE', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u1', role: 'admin', plan: null, status: null, current_period_end: null }],
      rowCount: 1,
    } as never);
    const plans = await readUserPlansBatch(['u1', 'u2']);
    expect(plans.get('u1')).toBe('ADMIN');
    expect(plans.get('u2')).toBe('FREE');
  });
});
