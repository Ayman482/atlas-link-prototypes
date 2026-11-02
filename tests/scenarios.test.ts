import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, SCENARIOS } from '../packages/core/src/index';
for (const sc of SCENARIOS) test(`${sc.id} ${sc.title.ar}`, () => {
  const e = new Engine(null); const ctx: Record<string, any> = {};
  const api = { exec: (as: string, c: string, i?: unknown) => e.exec(c, as, i), query: (as: string, q: string, p?: unknown) => e.query(q, as, p), db: () => e.db, now: () => e.clock() };
  for (const st of sc.steps) {
    let err: string | null = null;
    try { st.run(api as any, ctx); } catch (x: any) { err = x.code ?? String(x); }
    assert.equal(err, st.expectError ?? null, `${sc.id}: ${st.title.ar}`);
  }
});
