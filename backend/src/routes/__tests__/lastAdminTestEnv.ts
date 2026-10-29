import { randomUUID } from 'node:crypto';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '55432';
process.env.DB_NAME = 'postgres';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = randomUUID();
process.env.JWT_SECRET = randomUUID();
process.env.NODE_ENV = 'test';

const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const name = process.env.DB_NAME;

if (host !== '127.0.0.1' || port !== '55432' || name === 'fiado_pro') {
  throw new Error('Teste recusou o banco: só o Postgres local da porta 55432, nunca o banco de produção.');
}
