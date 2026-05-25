import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'fiado-pro-db',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fiado_pro',
  user: process.env.DB_USER || 'fiado_user',
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error:', err.message);
});

export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`[DB] Slow query (${duration}ms): ${text}`);
  }
  return res;
};

export const getClient = () => pool.connect();

export default pool;
