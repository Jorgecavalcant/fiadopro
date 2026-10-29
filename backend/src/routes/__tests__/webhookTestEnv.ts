import { randomUUID } from 'node:crypto';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '55435';
process.env.DB_NAME = 'postgres';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = randomUUID();
process.env.JWT_SECRET = randomUUID();
process.env.ASAAS_WEBHOOK_TOKEN = randomUUID();
process.env.NODE_ENV = 'test';
delete process.env.ASAAS_API_KEY;

if (process.env.DB_PORT !== '55435' || process.env.DB_NAME === 'fiado_pro') {
  throw new Error('Teste recusou o banco: só a porta 55435, nunca produção.');
}
