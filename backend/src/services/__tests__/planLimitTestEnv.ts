import { randomUUID } from 'node:crypto';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '55434';
process.env.DB_NAME = 'postgres';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = randomUUID();
process.env.JWT_SECRET = randomUUID();
process.env.NODE_ENV = 'test';

if (
  process.env.DB_HOST !== '127.0.0.1' ||
  process.env.DB_PORT !== '55434' ||
  process.env.DB_NAME === 'fiado_pro'
) {
  throw new Error('Teste recusou o banco: só o Postgres local da porta 55434.');
}
