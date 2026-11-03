// اختبارات أمن خادم المحاكاة: CORS، تزوير الرموز، الدخول السريع، حد محاولات التحقق، انتهاء الجلسة، الرمز في الرابط،
// عزل الجلسات بين الموظفين، أخطاء الإدخال (400 لا 500)، وعزل المؤسسة والفرع
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const procs: ChildProcess[] = []; const dirs: string[] = [];
async function server(env: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'medlog-sec-')); dirs.push(dir);
  const port = 4800 + Math.floor(Math.random() * 900);
  const e: Record<string, string | undefined> = { ...process.env, PORT: String(port), MEDLOG_DATA_DIR: dir, ...env };
  for (const k of ['MEDLOG_SECRET', 'CORS_ORIGIN', 'MEDLOG_ENABLE_DEMO_LOGIN', 'MEDLOG_SESSION_IDLE_MIN']) if (!env[k]) delete e[k]; // الإعدادات الافتراضية فعلاً (غير مضبوطة)
  const proc = spawn(process.execPath, ['--import', 'tsx', 'packages/mock-api/src/server.ts', '--reset'], { env: e, stdio: 'ignore' });
  procs.push(proc);
  const B = `http://localhost:${port}/api/v1`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${B}/health`)).ok) return B; } catch { /* */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('server did not start');
}
after(async () => { procs.forEach((p) => p.kill()); await new Promise((r) => setTimeout(r, 300)); dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })); });

const J = async (r: Response) => ({ status: r.status, headers: r.headers, body: r.status === 204 ? null : await r.json().catch(() => null) });
const post = (B: string, p: string, body: unknown, tok?: string, extra: Record<string, string> = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...extra }, body: JSON.stringify(body) }).then(J);
const get = (B: string, p: string, tok?: string, extra: Record<string, string> = {}) => fetch(B + p, { headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...extra } }).then(J);
async function login(B: string, email: string) {
  const a = await post(B, '/auth/login', { email, password: 'Demo@2026' });
  if (a.body.token) return a.body.token as string;
  const b = await post(B, '/auth/mfa/verify', { challengeId: a.body.challengeId, code: '123456' });
  return b.body.token as string;
}
const q = (name: string, p: unknown) => `/queries/${name}?p=${encodeURIComponent(JSON.stringify(p))}`;

let B = '';
test('CORS: لا "*"؛ الأصل المحلي فقط يُعاد، والأصل الغريب لا يحصل على ترويسة السماح', async () => {
  B = await server();
  const evil = await get(B, '/health', undefined, { origin: 'https://evil.example' });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const local = await get(B, '/health', undefined, { origin: 'http://localhost:5071' });
  assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5071');
  assert.equal(local.headers.get('x-medlog-environment'), 'simulated-demo');
  const root = await get(B, '');
  assert.equal(root.body.productionReady, false);
});

test('الدخول السريع لحسابات العرض غير موجود افتراضياً', async () => {
  const r = await post(B, '/auth/demo-login', { email: 'admin@medlog.demo' });
  assert.equal(r.status, 404);
});

test('رمز موقّع بالمفتاح الافتراضي القديم المعروف لا يُقبل', async () => {
  const tok = await login(B, 'warehouse@medlog.demo');
  const sid = tok.split('.')[0];
  const forged = `${sid}.${crypto.createHmac('sha256', 'medlog-demo-secret-not-for-production').update(sid).digest('base64url').slice(0, 32)}`;
  assert.equal((await get(B, q('me', {}), forged)).status, 401);
  assert.equal((await get(B, q('me', {}), tok)).status, 200);
});

test('التحقق بخطوتين: يُقفل التحدي بعد 5 محاولات خاطئة حتى مع الرمز الصحيح', async () => {
  const l = await post(B, '/auth/login', { email: 'ops@medlog.demo', password: 'Demo@2026' });
  const codes: string[] = [];
  for (let i = 0; i < 5; i++) codes.push((await post(B, '/auth/mfa/verify', { challengeId: l.body.challengeId, code: '000000' })).body.error.code);
  assert.deepEqual(codes, ['MFA_INVALID', 'MFA_INVALID', 'MFA_INVALID', 'MFA_INVALID', 'MFA_LOCKED']);
  const ok = await post(B, '/auth/mfa/verify', { challengeId: l.body.challengeId, code: '123456' });
  assert.equal(ok.status, 401); assert.equal(ok.body.error.code, 'MFA_EXPIRED');
});

test('الرمز في الرابط لا يُقبل إلا لقناة SSE', async () => {
  const tok = await login(B, 'warehouse@medlog.demo');
  assert.equal((await get(B, `/queries/me?access_token=${encodeURIComponent(tok)}`)).status, 401);
  const ctrl = new AbortController();
  const r = await fetch(`${B}/events?access_token=${encodeURIComponent(tok)}`, { signal: ctrl.signal });
  assert.equal(r.status, 200); ctrl.abort();
});

test('الجلسات: موظف المستودع يرى جلساته فقط، ومدير المنصة يرى الكل', async () => {
  const wh = await login(B, 'warehouse@medlog.demo');
  await login(B, 'support@medlog.demo');
  const mine = await get(B, '/collections/sessions?limit=500', wh);
  assert.ok(mine.body.data.total >= 1);
  assert.ok(mine.body.data.items.every((s: any) => s.userId === 'usr_warehouse'));
  const admin = await get(B, '/collections/sessions?limit=500', await login(B, 'admin@medlog.demo'));
  assert.ok(admin.body.data.items.some((s: any) => s.userId === 'usr_support'));
});

test('مدخلات غير صالحة تعيد 400/404 لا 500', async () => {
  const wh = await login(B, 'warehouse@medlog.demo');
  const a = await get(B, '/queries/me?p=%7Bbad', wh); assert.equal(a.status, 400); assert.equal(a.body.error.code, 'MALFORMED_JSON');
  const b = await get(B, '/collections/shipments?filter=%7Bbad', wh); assert.equal(b.status, 400);
  for (const c of ['constructor', '__proto__', 'toString', 'meta']) assert.equal((await get(B, `/collections/${c}`, wh)).status, 404, c);
});

test('عزل المؤسسة والفرع: مشغّل الفرع لا يرى الفروع الأخرى ولا يكتب في فرع المشاهدة', async () => {
  const ops = await login(B, 'ops@medlog.demo');
  const all = (await get(B, '/collections/shipments?limit=500', ops)).body.data.items;
  const bo = await login(B, 'branch.op@medlog.demo');
  const mlq = all.find((s: any) => s.branchId === 'br_nkh_mlq'); const rwd = all.find((s: any) => s.branchId === 'br_nkh_rwd' && !['delivered', 'cancelled'].includes(s.status)) ?? all.find((s: any) => s.branchId === 'br_nkh_rwd'); const raf = all.find((s: any) => s.organizationId === 'org_raf');
  assert.equal((await get(B, q('shipment.detail', { id: mlq.trackingNo }), bo)).status, 404, 'فرع آخر في نفس المؤسسة');
  assert.equal((await get(B, q('shipment.detail', { id: raf.id }), bo)).status, 404, 'مؤسسة أخرى');
  assert.equal((await get(B, q('shipment.detail', { id: rwd.id }), bo)).status, 200, 'فرع المشاهدة مقروء');
  assert.equal((await post(B, '/commands/shipment.cancel', { id: rwd.id, reason: 'x' }, bo)).status, 403, 'لا كتابة في فرع المشاهدة');
  const mine = (await get(B, '/collections/shipments?limit=500', bo)).body.data.items;
  assert.deepEqual([...new Set(mine.map((s: any) => s.branchId))].sort(), ['br_nkh_oly', 'br_nkh_rwd']);
  assert.ok(mine.every((s: any) => s.qrToken === undefined), 'رمز QR الداخلي لا يُكشف للعميل');
  const ind = await login(B, 'individual@medlog.demo');
  assert.equal((await get(B, q('controlTower.summary', {}), ind)).status, 403, 'العميل لا يصل لاستعلامات الموظفين');
  assert.equal((await get(B, '/collections/invoices', bo)).body.data.total, 0, 'مشغّل الفرع لا يرى الفواتير');
});

test('انتهاء الجلسة بعد الخمول، والدخول السريع عند تفعيله لا يتجاوز الحسابات المحمية', async () => {
  const B2 = await server({ MEDLOG_SESSION_IDLE_MIN: '0.03', MEDLOG_ENABLE_DEMO_LOGIN: '1', MEDLOG_SECRET: 'test-secret-1234567890' });
  assert.equal((await post(B2, '/auth/demo-login', { email: 'admin@medlog.demo' })).status, 403, 'حساب بتحقق بخطوتين');
  const d = await post(B2, '/auth/demo-login', { email: 'courier1@medlog.demo' }); assert.equal(d.status, 200);
  assert.equal((await get(B2, q('me', {}), d.body.token)).status, 200);
  await new Promise((r) => setTimeout(r, 2200));
  const exp = await get(B2, q('me', {}), d.body.token);
  assert.equal(exp.status, 401); assert.equal(exp.body.error.code, 'SESSION_EXPIRED');
  assert.equal((await get(B2, q('me', {}), d.body.token)).body.error.code, 'UNAUTHENTICATED', 'الجلسة المنتهية تُلغى نهائياً');
});

test('وضع الإنتاج: يرفض التشغيل دون مفتاح سري وقائمة أصول، ومصادقة العرض وإعادة الضبط معطّلة', async () => {
  // بدون MEDLOG_SECRET وCORS_ORIGIN: يخرج فوراً
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'medlog-prod-')); dirs.push(dir);
  const bad = spawn(process.execPath, ['--import', 'tsx', 'packages/mock-api/src/server.ts', '--reset'], { env: { ...process.env, NODE_ENV: 'production', PORT: '4799', MEDLOG_DATA_DIR: dir, MEDLOG_SECRET: '', CORS_ORIGIN: '' }, stdio: 'ignore' });
  const code: number = await new Promise((r) => bad.on('exit', (c) => r(c ?? -1)));
  assert.equal(code, 1, 'يجب أن يرفض التشغيل');
  const B3 = await server({ NODE_ENV: 'production', MEDLOG_SECRET: 'x'.repeat(40), CORS_ORIGIN: 'https://ops.atlaslink.example', MEDLOG_ENABLE_DEMO_LOGIN: '1' });
  const l = await post(B3, '/auth/login', { email: 'ops@medlog.demo', password: 'Demo@2026' });
  assert.equal(l.status, 501); assert.equal(l.body.error.code, 'AUTH_PROVIDER_NOT_CONFIGURED');
  assert.equal((await post(B3, '/auth/demo-login', { email: 'courier1@medlog.demo' })).status, 501, 'الدخول السريع معطّل مهما كانت المتغيرات');
  assert.equal((await post(B3, '/auth/mfa/verify', { challengeId: 'x', code: '123456' })).status, 501);
  assert.equal((await get(B3, '/health', undefined, { origin: 'http://localhost:5071' })).headers.get('access-control-allow-origin'), null, 'لا أصول محلية في الإنتاج');
  assert.equal((await get(B3, '/health', undefined, { origin: 'https://ops.atlaslink.example' })).headers.get('access-control-allow-origin'), 'https://ops.atlaslink.example');
  assert.equal((await get(B3, '')).body.mode, 'production-guarded');
});
