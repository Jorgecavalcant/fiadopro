import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import router from './transactions.js';

function fakeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function getRouteHandler(method: 'get' | 'post' | 'patch' | 'delete', path: string): any {
  const layer = (router as any).stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`Rota nao encontrada: ${method.toUpperCase()} ${path}`);
  const routeLayer = layer.route.stack[layer.route.stack.length - 1];
  return routeLayer.handle;
}

const OWNER_ID = 'owner-1';
const LINKED_ID = 'linked-1';
const STRANGER_ID = 'stranger-1';
const CUSTOMER_ID = '11111111-1111-1111-1111-111111111111';

describe('transactions — POST / (criação por dono e por contraparte vinculada)', () => {
  const postHandler = getRouteHandler('post', '/');

  beforeEach(() => {
    queryMock.mockReset();
  });

  it('dono cria DEBT contra cliente vinculado → nasce PENDING, created_by = dono', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: CUSTOMER_ID, owner_user_id: OWNER_ID, linked_user_id: LINKED_ID }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'tx-1', status: 'PENDING', created_by_user_id: OWNER_ID }],
      })
      .mockResolvedValueOnce({ rows: [] }); // logEvent

    const req: any = {
      user: { sub: OWNER_ID },
      body: { customer_id: CUSTOMER_ID, type: 'DEBT', amount: 50, description: 'fiado' },
    };
    const res = fakeRes();
    const next = vi.fn();

    await postHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const insertCall = queryMock.mock.calls[1];
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([CUSTOMER_ID, OWNER_ID, OWNER_ID, 'DEBT', 'PENDING']),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('contraparte vinculada cria PAYMENT contra si mesma → owner_user_id fica com o DONO, created_by = contraparte', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: CUSTOMER_ID, owner_user_id: OWNER_ID, linked_user_id: LINKED_ID }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'tx-2', status: 'PENDING', created_by_user_id: LINKED_ID }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req: any = {
      user: { sub: LINKED_ID },
      body: { customer_id: CUSTOMER_ID, type: 'PAYMENT', amount: 30, description: 'pagamento pix' },
    };
    const res = fakeRes();
    const next = vi.fn();

    await postHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const insertParams = queryMock.mock.calls[1][1];
    // ordem: id, customer_id, owner_user_id, created_by_user_id, type, status, ...
    expect(insertParams[1]).toBe(CUSTOMER_ID);
    expect(insertParams[2]).toBe(OWNER_ID); // owner_user_id = dono real, NAO quem chamou
    expect(insertParams[3]).toBe(LINKED_ID); // created_by_user_id = quem criou de fato
    expect(insertParams[5]).toBe('PENDING');
  });

  it('contraparte vinculada NAO pode criar DEBT — 400', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: CUSTOMER_ID, owner_user_id: OWNER_ID, linked_user_id: LINKED_ID }],
    });
    const req: any = {
      user: { sub: LINKED_ID },
      body: { customer_id: CUSTOMER_ID, type: 'DEBT', amount: 10, description: 'x' },
    };
    const res = fakeRes();
    const next = vi.fn();

    await postHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe('INVALID_TYPE_FOR_COUNTERPART');
  });

  it('usuário que nao e dono nem vinculado → 404 (nao vaza existencia do cliente)', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: CUSTOMER_ID, owner_user_id: OWNER_ID, linked_user_id: LINKED_ID }],
    });
    const req: any = {
      user: { sub: STRANGER_ID },
      body: { customer_id: CUSTOMER_ID, type: 'PAYMENT', amount: 10, description: 'x' },
    };
    const res = fakeRes();
    const next = vi.fn();

    await postHandler(req, res, next);

    expect(next.mock.calls[0][0].code).toBe('CUSTOMER_NOT_FOUND');
  });

  it('applies_to_transaction_id invalido (nao pertence ao mesmo cliente) → 400', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: CUSTOMER_ID, owner_user_id: OWNER_ID, linked_user_id: LINKED_ID }],
      })
      .mockResolvedValueOnce({ rows: [] }); // referencia nao encontrada
    const req: any = {
      user: { sub: LINKED_ID },
      body: {
        customer_id: CUSTOMER_ID,
        type: 'PAYMENT',
        amount: 10,
        description: 'x',
        applies_to_transaction_id: '22222222-2222-2222-2222-222222222222',
      },
    };
    const res = fakeRes();
    const next = vi.fn();

    await postHandler(req, res, next);

    expect(next.mock.calls[0][0].code).toBe('INVALID_REFERENCE');
  });
});

describe('transactions — approve/reject (bidirecional)', () => {
  beforeEach(() => queryMock.mockReset());

  it('dono aprova lancamento criado por ele mesmo contra o vinculado (fluxo original)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'tx-1' }] }).mockResolvedValueOnce({ rows: [] });
    const approveHandler = getRouteHandler('post', '/:id/approve');
    const req: any = { params: { id: 'tx-1' }, user: { sub: LINKED_ID }, body: {} };
    const res = fakeRes();
    const next = vi.fn();

    await approveHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain('created_by_user_id = t.owner_user_id AND c.linked_user_id = $2');
    expect(params[1]).toBe(LINKED_ID);
    expect(params[2]).toBe('CONFIRMED');
  });

  it('dono aprova PAGAMENTO criado pela contraparte (fluxo reverso)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'tx-2' }] }).mockResolvedValueOnce({ rows: [] });
    const approveHandler = getRouteHandler('post', '/:id/approve');
    const req: any = { params: { id: 'tx-2' }, user: { sub: OWNER_ID }, body: {} };
    const res = fakeRes();
    const next = vi.fn();

    await approveHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const [, params] = queryMock.mock.calls[0];
    expect(params[1]).toBe(OWNER_ID);
  });

  it('rejeitar: nenhum PENDING encontrado para o usuario → 404', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const rejectHandler = getRouteHandler('post', '/:id/reject');
    const req: any = { params: { id: 'tx-3' }, user: { sub: STRANGER_ID }, body: {} };
    const res = fakeRes();
    const next = vi.fn();

    await rejectHandler(req, res, next);

    expect(next.mock.calls[0][0].code).toBe('NOT_FOUND');
  });
});

describe('transactions — resend (só quem criou de fato)', () => {
  beforeEach(() => queryMock.mockReset());

  it('resend usa created_by_user_id, nao owner_user_id — contraparte reenvia seu proprio pagamento recusado', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'tx-4' }] }).mockResolvedValueOnce({ rows: [] });
    const resendHandler = getRouteHandler('post', '/:id/resend');
    const req: any = { params: { id: 'tx-4' }, user: { sub: LINKED_ID } };
    const res = fakeRes();
    const next = vi.fn();

    await resendHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain('created_by_user_id = $2');
    expect(params[1]).toBe(LINKED_ID);
  });
});
