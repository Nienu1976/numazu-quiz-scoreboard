// node:sqlite で D1 の最小互換を作り、実際の migrations/*.sql をそのまま流す（テスト専用）
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Env } from '../lib/types';

const MIG = fileURLToPath(new URL('../migrations/', import.meta.url));

export function makeDb(): D1Database {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(MIG + f, 'utf8'));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    async run() { const r = db.prepare(sql).run(...(args as never[])); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    async first() { return (db.prepare(sql).get(...(args as never[])) as unknown) ?? null; },
    async all() { return { results: db.prepare(sql).all(...(args as never[])) as unknown[], success: true }; },
  });
  return { prepare: (sql: string) => stmt(sql) } as unknown as D1Database;
}
export const makeEnv = (extra: Partial<Env> = {}): Env => ({ DB: makeDb(), ...extra });

export const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://example.test/api/entries', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });

let n = 0;
export const person = (o: Record<string, unknown> = {}) => {
  n++;
  return { realName: `山田太郎${n}`, displayName: `カツオ${n}`, ki: '第50期', kana: 'やまだたろう', contact: `t${n}@example.com`, consent: true, ...o };
};
