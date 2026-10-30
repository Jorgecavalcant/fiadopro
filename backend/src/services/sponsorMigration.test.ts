import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, expect, it } from 'vitest';

const file = join(dirname(fileURLToPath(import.meta.url)), '../../migrations/016_sponsors.sql');
const sql = readFileSync(file, 'utf8');

describe('migration 016', () => {
  let db: PGlite;

  afterAll(async () => {
    await db?.close();
  });

  it('sobe numa base que já tem usuários e pode rodar de novo', async () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sponsors');
    db = new PGlite();
    await db.exec(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        email text NOT NULL,
        role text NOT NULL DEFAULT 'user'
      );
      CREATE TABLE legado_ok (id int PRIMARY KEY);
      INSERT INTO legado_ok (id) VALUES (1);
    `);
    await db.exec(sql);
    await db.exec(sql);
    const legado = await db.query(`SELECT id FROM legado_ok`);
    expect(legado.rows).toEqual([{ id: 1 }]);
    await db.exec(`
      INSERT INTO sponsors (nome, categoria, cidade)
      VALUES ('TESTE Mercado', 'Mercado', 'Teste')
    `);
    const sponsors = await db.query(`SELECT nome FROM sponsors`);
    expect(sponsors.rows).toEqual([{ nome: 'TESTE Mercado' }]);
  });
});