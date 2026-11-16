import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('../../config/database.js', () => ({
  query: queryMock,
  getClient: vi.fn(),
}));

import {
  activeCustomerWithSameEmail,
  duplicateEmailError,
} from '../customers.js';

describe('duplicate customer email', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('builds a friendly DUPLICATE_EMAIL error', () => {
    const err = duplicateEmailError({ id: 'c1', name: 'Maria' });
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('DUPLICATE_EMAIL');
    expect(err.message).toContain('Maria');
  });

  it('finds an active customer with the same email', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'c1', name: 'Maria', email: 'Buyer@Example.com' }],
      rowCount: 1,
    });
    const found = await activeCustomerWithSameEmail('owner-1', 'buyer@example.com');
    expect(found).toEqual({ id: 'c1', name: 'Maria' });
  });

  it('returns null when email is empty or unused', async () => {
    await expect(activeCustomerWithSameEmail('owner-1', '')).resolves.toBeNull();
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(activeCustomerWithSameEmail('owner-1', 'missing@example.com')).resolves.toBeNull();
  });
});
