// اتساق الأحداث: البث بعد الالتزام فقط، لا أحداث لعمليات متراجعة، لا تكرار عند إعادة الطلب، ترتيب ثابت،
// واستكمال ما فات عبر Last-Event-ID عند إعادة اتصال SSE — مع عزل المؤسسة في الاستكمال.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Engine } from '../packages/core/src/index';

const NOW = Date.parse('2026-11-02T10:00:00Z');
const evSeq = (id: string) => Number(id.replace(/\D/g, ''));
function myInTransit(e: Engine) {
  return e.db.shipments.find((s) => { const cs = e.db.custody.filter((c) => c.shipmentId === s.id).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)); const last = cs[cs.length - 1]; return s.status === 'in_transit' && last?.toType === 'courier' && last.toId === 'cou_01'; })!;
}

test('البث يحدث بعد الحفظ الدائم فقط، والأمر الفاشل لا يبث شيئاً', () => {
  const order: string[] = [];
  const e = new Engine(null, { clock: () => NOW, persist: () => order.push('persist') });
  e.subscribe((p) => order.push('emit:' + p.command));
  const ex = e.db.excursions.find((x) => x.status === 'open')!;
  e.exec('excursion.acknowledge', 'usr_ops', { id: ex.id });
  assert.deepEqual(order, ['persist', 'emit:excursion.acknowledge']);
  order.length = 0;
  assert.throws(() => e.exec('excursion.acknowledge', 'usr_ops', { id: 'exc_nope' }));
  assert.deepEqual(order, [], 'لا حفظ ولا بث لأمر فاشل');
});

test('فشل الحفظ الدائم يتراجع عن المعاملة كاملة ولا يبث أي حدث', () => {
  let fail = true; const emitted: string[] = [];
  const e = new Engine(null, { clock: () => NOW, persist: () => { if (fail) throw new Error('disk full'); } });
  e.subscribe((p) => emitted.push(p.command));
  const ex = e.db.excursions.find((x) => x.status === 'open')!;
  assert.throws(() => e.exec('excursion.acknowledge', 'usr_ops', { id: ex.id }), /disk full/);
  assert.equal(e.db.excursions.find((x) => x.id === ex.id)!.status, 'open', 'لا تغيير محفوظ');
  assert.deepEqual(emitted, []);
  fail = false;
  e.exec('excursion.acknowledge', 'usr_ops', { id: ex.id });
  assert.deepEqual(emitted, ['excursion.acknowledge']);
});

test('مشترك يرمي خطأ لا يُفشل أمراً التزم فعلاً', () => {
  const e = new Engine(null, { clock: () => NOW });
  e.subscribe(() => { throw new Error('bad listener'); });
  const ex = e.db.excursions.find((x) => x.status === 'open')!;
  const orig = console.error; console.error = () => {};
  try { const r: any = e.exec('excursion.acknowledge', 'usr_ops', { id: ex.id }); assert.equal(r.status, 'acknowledged'); } finally { console.error = orig; }
  assert.equal(e.db.excursions.find((x) => x.id === ex.id)!.status, 'acknowledged');
});

test('courier.sync: أحداث الإجراء المتراجع لا تُبث، وأحداث المقبول تُبث', () => {
  const e = new Engine(null, { clock: () => NOW }); const sh = myInTransit(e);
  let payload: any = null; e.subscribe((p) => { payload = p; });
  e.exec('courier.sync', 'usr_courier1', { actions: [
    { clientActionId: 'ev-del', type: 'deliver', shipment: sh.id, occurredAt: new Date(NOW - 600e3).toISOString(), payload: { recipientName: 'أ', signature: 's' } },
    { clientActionId: 'ev-fail', type: 'failAttempt', shipment: sh.id, occurredAt: new Date(NOW - 300e3).toISOString(), payload: { reasonCode: 'REFUSED' } },
  ] });
  const types = payload.events.map((x: any) => x.eventType);
  assert.ok(types.includes('shipment.delivered'), 'حدث التسليم المقبول');
  assert.ok(!types.includes('shipment.delivery_attempt_failed') && !types.includes('shipment.failed'), `حدث متراجع بُث: ${types.join(',')}`);
  for (const ev of payload.events) assert.ok(e.db.outbox.some((o) => o.id === ev.id), `كل حدث مبثوث موجود في outbox المحفوظ: ${ev.id}`);
});

test('إعادة الطلب بنفس مفتاح Idempotency لا تبث حدثاً ثانياً، والأحداث مرتبة تصاعدياً', () => {
  const e = new Engine(null, { clock: () => NOW }); const all: string[] = [];
  e.subscribe((p) => all.push(...p.events.map((x) => x.id)));
  const exs = e.db.excursions.filter((x) => x.status === 'open');
  e.exec('excursion.acknowledge', 'usr_ops', { id: exs[0].id }, 'k-1');
  const n = all.length;
  e.exec('excursion.acknowledge', 'usr_ops', { id: exs[0].id }, 'k-1');
  assert.equal(all.length, n, 'لا حدث مكرر');
  const sh = myInTransit(e);
  e.exec('courier.deliver', 'usr_courier1', { shipment: sh.id, recipientName: 'أ', signature: 's' });
  const seqs = all.map(evSeq);
  assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'ترتيب تصاعدي');
  assert.equal(new Set(all).size, all.length, 'لا معرّفات مكررة');
});

// ---------- SSE فعلي عبر الخادم ----------
const procs: ChildProcess[] = []; const dirs: string[] = [];
after(async () => { procs.forEach((p) => p.kill()); await new Promise((r) => setTimeout(r, 300)); dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })); });
async function server() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'medlog-ev-')); dirs.push(dir);
  const port = 5100 + Math.floor(Math.random() * 800);
  const env: Record<string, string | undefined> = { ...process.env, PORT: String(port), MEDLOG_DATA_DIR: dir, MEDLOG_SECRET: 's'.repeat(40) }; delete env.NODE_ENV;
  const p = spawn(process.execPath, ['--import', 'tsx', 'packages/mock-api/src/server.ts', '--reset'], { env, stdio: 'ignore' }); procs.push(p);
  const B = `http://localhost:${port}/api/v1`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${B}/health`)).ok) return B; } catch { /* */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('no server');
}
async function login(B: string, email: string) {
  const a = await (await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Demo@2026' }) })).json();
  if (a.token) return a.token;
  return (await (await fetch(`${B}/auth/mfa/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: a.challengeId, code: '123456' }) })).json()).token;
}
/** يفتح SSE ويجمع الرسائل (id, event, data) حتى الإغلاق */
function sse(B: string, tok: string, lastEventId?: number) {
  const ctrl = new AbortController(); const msgs: { id?: number; event: string; data: any }[] = [];
  const done = (async () => {
    try {
      const r = await fetch(`${B}/events?access_token=${encodeURIComponent(tok)}`, { signal: ctrl.signal, headers: lastEventId !== undefined ? { 'last-event-id': String(lastEventId) } : {} });
      const rd = r.body!.getReader(); let buf = '';
      for (;;) { const { value, done: d } = await rd.read(); if (d) break; buf += new TextDecoder().decode(value); let i; while ((i = buf.indexOf('\n\n')) >= 0) { const block = buf.slice(0, i); buf = buf.slice(i + 2); const m: any = { event: 'message' }; for (const line of block.split('\n')) { if (line.startsWith('id: ')) m.id = Number(line.slice(4)); else if (line.startsWith('event: ')) m.event = line.slice(7); else if (line.startsWith('data: ')) m.data = JSON.parse(line.slice(6)); } if (m.data) msgs.push(m); } }
    } catch { /* aborted */ }
  })();
  return { msgs, close: async () => { ctrl.abort(); await done; } };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cmd = async (B: string, tok: string, name: string, body: unknown) => fetch(`${B}/commands/${name}`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('SSE: حدث بعد الالتزام بمعرّف تسلسلي، لا شيء لأمر فاشل، واستكمال ما فات بعد إعادة الاتصال مع عزل المؤسسة', async () => {
  const B = await server();
  const ops = await login(B, 'ops@medlog.demo'); const cust = await login(B, 'individual@medlog.demo');
  const s1 = sse(B, ops); await wait(400);
  const ships = (await (await fetch(`${B}/collections/shipments?limit=500`, { headers: { authorization: `Bearer ${ops}` } })).json()).data.items.filter((x: any) => ['draft', 'confirmed'].includes(x.status));
  assert.ok(ships.length >= 3, 'شحنات قابلة للإلغاء');
  assert.equal((await cmd(B, ops, 'shipment.cancel', { id: 'shp_nope', reason: 'x' })).status, 404);
  await wait(300);
  assert.equal(s1.msgs.filter((m) => m.event === 'change').length, 0, 'أمر فاشل لا يبث');
  assert.equal((await cmd(B, ops, 'shipment.cancel', { id: ships[0].id, reason: 'اختبار البث' })).status, 200);
  await wait(300);
  const live = s1.msgs.filter((m) => m.event === 'change');
  assert.equal(live.length, 1); assert.ok(live[0].id! > 0, JSON.stringify(live[0]).slice(0, 300));
  assert.ok(live[0].data.events.some((x: any) => x.type === 'shipment.cancelled'));
  const lastId = live[0].id!;
  await s1.close();
  // انقطاع: أمران أثناء غياب العميل
  assert.equal((await cmd(B, ops, 'shipment.cancel', { id: ships[1].id, reason: 'أثناء الانقطاع 1' })).status, 200);
  assert.equal((await cmd(B, ops, 'shipment.cancel', { id: ships[2].id, reason: 'أثناء الانقطاع 2' })).status, 200);
  // إعادة الاتصال بـ Last-Event-ID
  const s2 = sse(B, ops, lastId); await wait(500);
  const replay = s2.msgs.find((m) => m.data.replay);
  assert.ok(replay, 'رسالة استكمال');
  const ids = replay!.data.events.map((x: any) => evSeq(x.id));
  assert.ok(ids.length >= 2 && ids.every((x: number) => x > lastId), `فقط ما بعد آخر معرّف: ${ids}`);
  assert.deepEqual(replay!.data.events.filter((x: any) => x.type === 'shipment.cancelled').map((x: any) => x.aggregateId), [ships[1].id, ships[2].id], 'الحدثان الفائتان بالترتيب');
  assert.deepEqual(ids, [...ids].sort((a: number, b: number) => a - b), 'مرتبة');
  assert.equal(replay!.data.gap, false);
  await s2.close();
  // عميل يستكمل من الصفر: لا يرى أحداث مؤسسات أخرى
  const s3 = sse(B, cust, 0); await wait(500);
  const r3 = s3.msgs.find((m) => m.data.replay)!;
  const custOrg = (await (await fetch(`${B}/queries/me`, { headers: { authorization: `Bearer ${cust}` } })).json()).data.organizations.map((o: any) => o.id);
  const outbox = (await (await fetch(`${B}/collections/outbox?limit=500`, { headers: { authorization: `Bearer ${ops}` } })).json()).data?.items ?? [];
  for (const ev of r3.data.events) { const full = outbox.find((o: any) => o.id === ev.id); if (full) assert.ok(custOrg.includes(full.organizationId), `حدث مؤسسة أخرى في استكمال العميل: ${ev.id}`); }
  await s3.close();
});
