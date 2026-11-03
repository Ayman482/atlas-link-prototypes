// اختبار تكامل لخادم API التجريبي: الدخول + MFA، النطاق، الاستمرارية بعد إعادة التشغيل، وSSE
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'medlog-api-'));
const PORT = 4300 + Math.floor(Math.random() * 500);
const B = `http://localhost:${PORT}/api/v1`;
let proc: ChildProcess | null = null;

async function start(reset: boolean) {
  proc = spawn(process.execPath, ['--import', 'tsx', 'packages/mock-api/src/server.ts', ...(reset ? ['--reset'] : [])], { env: { ...process.env, PORT: String(PORT), MEDLOG_DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`${B}/health`); if (r.ok) return; } catch { /* انتظار */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('server did not start');
}
async function stop() { if (proc) { proc.kill(); await new Promise((r) => setTimeout(r, 400)); proc = null; } }
after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });

async function login(email: string) {
  const r1 = await (await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Demo@2026' }) })).json();
  if (r1.token) return r1.token as string;
  const r2 = await (await fetch(`${B}/auth/mfa/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: r1.challengeId, code: '123456' }) })).json();
  return r2.token as string;
}
const api = (tok: string) => ({
  get: async (p: string) => { const r = await fetch(`${B}${p}`, { headers: { authorization: `Bearer ${tok}`, 'accept-language': 'ar' } }); return { status: r.status, body: await r.json() }; },
  post: async (p: string, body: unknown, idem?: string) => { const r = await fetch(`${B}${p}`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json', ...(idem ? { 'idempotency-key': idem } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; },
});

test('API: دخول بكلمة مرور خاطئة ثم MFA', async () => {
  await start(true);
  const bad = await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'ops@medlog.demo', password: 'x' }) });
  assert.equal(bad.status, 401);
  const body = await bad.json();
  assert.equal(body.error.code, 'INVALID_CREDENTIALS'); assert.ok(body.error.request_id);
  const unauth = await fetch(`${B}/shipments`); assert.equal(unauth.status, 401);
});

test('API: إنشاء شحنة من العميل تظهر للعمليات عبر SSE وتبقى بعد إعادة تشغيل الخادم', async () => {
  const ops = api(await login('ops@medlog.demo'));
  const cust = api(await login('branch.op@medlog.demo'));
  const me = await cust.get('/me');
  assert.equal(me.status, 200);
  const addrs = (await cust.get('/organizations/org_nkh/addresses?limit=100')).body.data.items;
  const from = addrs.find((a: any) => a.branchId === 'br_nkh_oly');
  const to = addrs.find((a: any) => a.branchId === 'br_nrl_main') ?? (await ops.get('/organizations/org_nrl/addresses')).body.data.items[0];
  // SSE للعمليات
  const ctrl = new AbortController();
  const events: string[] = [];
  const opsTok = await login('ops@medlog.demo');
  const sse = fetch(`${B}/events?access_token=${opsTok}`, { signal: ctrl.signal }).then(async (r) => { const rd = r.body!.getReader(); const dec = new TextDecoder(); for (;;) { const { value, done } = await rd.read(); if (done) break; events.push(dec.decode(value)); } }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  const now = Date.now();
  const payload = { organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: from.id, receiverAddressId: to.id, thermalClass: 'chilled', serviceLevel: 'standard', pickupWindowStart: new Date(now + 3600e3).toISOString(), pickupWindowEnd: new Date(now + 3 * 3600e3).toISOString(), items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 2, weightKg: 1 }] };
  const created = await cust.post('/shipments', payload, 'api-test-1');
  assert.equal(created.status, 201);
  const again = await cust.post('/shipments', payload, 'api-test-1');
  assert.equal(again.body.data.id, created.body.data.id, 'Idempotency-Key');
  await new Promise((r) => setTimeout(r, 300));
  ctrl.abort(); await sse;
  assert.ok(events.join('').includes('shipment.created'), 'حدث SSE');
  const board = await ops.get('/queries/dispatch.board');
  assert.ok(board.body.data.unassigned.some((s: any) => s.id === created.body.data.id));
  // خطأ موحّد بالعربية
  const err = await cust.post('/shipments', { ...payload, pickupWindowEnd: payload.pickupWindowStart });
  assert.equal(err.status, 422); assert.match(err.body.error.message, /فترة الاستلام/); // المصطلح المعتمد في المسرد (كان «نافذة»)
  // الاستمرارية
  await new Promise((r) => setTimeout(r, 400));
  await stop(); await start(false);
  const ops2 = api(await login('ops@medlog.demo'));
  const d = await ops2.get(`/shipments/${created.body.data.id}`);
  assert.equal(d.status, 200); assert.equal(d.body.data.shipment.trackingNo, created.body.data.trackingNo);
  // عميل آخر لا يرى الشحنة
  const ind = api(await login('individual@medlog.demo'));
  assert.equal((await ind.get(`/shipments/${created.body.data.id}`)).status, 404);
});

test('API: OpenAPI ومسارات الكتالوج', async () => {
  const spec = await (await fetch(`${B}/openapi.json`)).json();
  assert.ok(Object.keys(spec.paths).length > 60);
  assert.ok(spec.paths['/api/v1/shipments/{id}/temperature-report']);
});
