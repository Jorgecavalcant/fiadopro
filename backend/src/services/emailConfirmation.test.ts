import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendEmailConfirmation } from './email.js';

describe('envio da confirmacao de e-mail', () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    sendMock.mockReset();
  });

  it('sem chave nao chama o Resend e nao devolve a chave', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(
      sendEmailConfirmation(`pessoa-${randomUUID()}@example.test`, randomUUID()),
    ).rejects.toThrow('CONFIRMATION_NOT_SENT');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('falha do provedor vira erro generico, sem o texto interno', async () => {
    process.env.RESEND_API_KEY = randomUUID();
    sendMock.mockResolvedValue({ data: null, error: { message: 'provider down' } });
    await expect(
      sendEmailConfirmation(`pessoa-${randomUUID()}@example.test`, randomUUID()),
    ).rejects.toThrow('CONFIRMATION_NOT_SENT');
  });

  it('com chave, o link aponta para a confirmacao no site', async () => {
    process.env.RESEND_API_KEY = randomUUID();
    process.env.APP_URL = 'https://www.fiadopro.com.br';
    sendMock.mockResolvedValue({ data: { id: randomUUID() }, error: null });
    const token = randomUUID().replace(/-/g, '');
    await sendEmailConfirmation(`pessoa-${randomUUID()}@example.test`, token);
    const payload = sendMock.mock.calls[0]?.[0] as { html?: string } | undefined;
    expect(payload?.html).toContain(
      `https://www.fiadopro.com.br/api/auth/confirm-email?token=${token}`,
    );
  });
});

describe('arquivos da migration 015', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');

  it('sobe so com coluna e tabela, sem apagar usuario', () => {
    const sql = readFileSync(join(root, '015_email_confirmation.sql'), 'utf8').toLowerCase();
    expect(sql).toContain('add column if not exists email_confirmed_at');
    expect(sql).toContain('add column if not exists email_confirmation_required');
    expect(sql).toContain('create table if not exists email_confirmation_tokens');
    expect(sql).not.toMatch(/delete\s+from/);
    expect(sql).not.toMatch(/drop\s+table/);
  });

  it('o down remove tabela e colunas e nao apaga usuarios', () => {
    const sql = readFileSync(join(root, 'down/015_email_confirmation.sql'), 'utf8').toLowerCase();
    expect(sql).toContain('drop table if exists email_confirmation_tokens');
    expect(sql).toContain('drop column if exists email_confirmed_at');
    expect(sql).toContain('drop column if exists email_confirmation_required');
    expect(sql).not.toMatch(/delete\s+from\s+users/);
    expect(sql).not.toMatch(/drop\s+table\s+if\s+exists\s+users/);
  });
});
