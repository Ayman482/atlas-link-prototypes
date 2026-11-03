// خادم API التجريبي — نفس عقود /api/v1 في وثيقة API V1.0، فوق محرك المحاكاة المشترك
// قاعدة بيانات العرض دائمة في ملف JSON (كتابة ذرّية)، وتحديثات لحظية عبر SSE.
// تشغيل:  npm run api          (المنفذ 4000 افتراضياً)
//         npm run api:reset    (إعادة توليد بيانات العرض)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Engine, DomainError, DEMO_MFA, DEMO_PASSWORD, listCommands, listQueries, isStaff, actorFor, type Db, type OutboxEvent } from '@medlog/core';
import { ROUTES, matchRoute } from './routes';

const PORT = Number(process.env.PORT ?? 4000);
const DATA_DIR = path.resolve(process.env.MEDLOG_DATA_DIR ?? path.join(process.cwd(), 'data'));
const DB_FILE = path.join(DATA_DIR, 'demo-db.json');
// المفتاح السري لتوقيع الرموز: إن لم يُضبط يُولَّد عشوائياً لكل تشغيل (لا مفتاح افتراضي معروف يسمح بتزوير الرموز)
// إعدادات الإنتاج صارمة: لا تشغيل دون مفتاح سري وقائمة أصول صريحة، والدخول السريع وإعادة الضبط معطّلان مهما كانت المتغيرات
const PROD = process.env.NODE_ENV === 'production';
if (PROD && (!process.env.MEDLOG_SECRET || process.env.MEDLOG_SECRET.length < 32 || !process.env.CORS_ORIGIN)) {
  console.error('✖ NODE_ENV=production يتطلب MEDLOG_SECRET (32 حرفاً على الأقل) وCORS_ORIGIN صريحاً'); process.exit(1);
}
const SECRET = process.env.MEDLOG_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.MEDLOG_SECRET) console.warn('⚠ MEDLOG_SECRET غير مضبوط — استُخدم مفتاح عشوائي؛ ستنتهي الجلسات عند إعادة التشغيل');
// اختصار الدخول السريع لحسابات العرض: معطّل افتراضياً ويتطلب تفعيلاً صريحاً، ولا يشمل الحسابات المحمية بالتحقق بخطوتين
const DEMO_LOGIN = !PROD && process.env.MEDLOG_ENABLE_DEMO_LOGIN === '1';
// مدة الجلسة: خمول 12 ساعة، وحد أقصى مطلق 7 أيام (قابلة للضبط للاختبار)
const IDLE_MS = Number(process.env.MEDLOG_SESSION_IDLE_MIN ?? 720) * 60_000;
const ABS_MS = Number(process.env.MEDLOG_SESSION_MAX_MIN ?? 7 * 24 * 60) * 60_000;
const MFA_MAX_ATTEMPTS = 5;
// CORS: قائمة سماح صريحة (CORS_ORIGIN مفصولة بفواصل)؛ الافتراضي أصول التطوير المحلية فقط — لا "*"
const CORS_ALLOW = (process.env.CORS_ORIGIN ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const LOCAL_ORIGIN = PROD ? /^$/ : /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const RESET = process.argv.includes('--reset');

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- التخزين الدائم ----------
let writeTimer: NodeJS.Timeout | null = null;
function persist(db: Db) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE); // استبدال ذرّي
  }, 150);
}
function load(): Db | null {
  if (RESET || !fs.existsSync(DB_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { console.warn('⚠ تعذّر قراءة قاعدة البيانات؛ سيُعاد التوليد'); return null; }
}
/** الحفظ المتزامن للأوامر: الكتابة الذرّية جزء من المعاملة — إن فشلت يتراجع المحرك ولا يُبث أي حدث (commit-then-emit) */
function persistNow(db: Db) {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
const engine = new Engine(load(), { persist: (db) => persistNow(db) });
if (RESET || !fs.existsSync(DB_FILE)) persist(engine.db);

// ---------- الرموز (Tokens) — HMAC بلا حالة فوق سجل الجلسات ----------
const sign = (sessionId: string) => `${sessionId}.${crypto.createHmac('sha256', SECRET).update(sessionId).digest('base64url').slice(0, 32)}`;
function verifyToken(tok: string | undefined): { session: (typeof engine.db.sessions)[number] | null; expired: boolean } {
  if (!tok) return { session: null, expired: false };
  const [sid, sig] = tok.split('.');
  if (!sid || !sig) return { session: null, expired: false };
  const want = Buffer.from(sign(sid)), got = Buffer.from(`${sid}.${sig}`);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return { session: null, expired: false };
  const s = engine.db.sessions.find((x) => x.id === sid && !x.revokedAt);
  if (!s) return { session: null, expired: false };
  const now = Date.now();
  if (now - Date.parse(s.lastSeenAt) > IDLE_MS || now - Date.parse(s.createdAt) > ABS_MS) {
    s.revokedAt = new Date(now).toISOString(); persist(engine.db);
    return { session: null, expired: true };
  }
  s.lastSeenAt = new Date(now).toISOString();
  return { session: s, expired: false };
}
function newSession(userId: string, ua: string, ip: string) {
  const n = (engine.db.meta.counters['id:ses'] = (engine.db.meta.counters['id:ses'] ?? 0) + 1);
  const s = { id: `ses_${String(n).padStart(4, '0')}`, userId, device: ua.slice(0, 80) || 'unknown', ip, createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), revokedAt: null };
  engine.db.sessions.push(s);
  engine.db.audit.push({ id: `aud_login_${n}`, actorId: userId, action: 'auth.login', entityType: 'session', entityId: s.id, occurredAt: s.createdAt, requestId: 'login', summary: s.device, onBehalfOrgId: null });
  persist(engine.db);
  return sign(s.id);
}
const challenges = new Map<string, { userId: string; exp: number; attempts: number }>();

// ---------- SSE ----------
const evSeq = (id: string) => Number(String(id).replace(/\D/g, '')) || 0;
const lastSeq = () => engine.db.outbox.reduce((m, e) => Math.max(m, evSeq(e.id)), 0);
/** الأحداث المرئية للمستخدم بعد رقم تسلسلي (لاستكمال ما فات عند إعادة الاتصال) */
function visibleSince(userId: string, after: number) {
  const a = actorFor(engine.db, userId); if (!a) return [];
  const orgs = new Set(a.memberships.map((m) => m.organizationId).filter(Boolean));
  return engine.db.outbox.filter((e) => evSeq(e.id) > after && (isStaff(a) || (e.organizationId && orgs.has(e.organizationId))));
}
const clients = new Set<{ res: http.ServerResponse; userId: string }>();
engine.subscribe(({ command, events, at }) => {
  for (const c of clients) {
    const a = actorFor(engine.db, c.userId);
    if (!a) continue;
    const orgs = new Set(a.memberships.map((m) => m.organizationId).filter(Boolean));
    // لا يُرسل للعميل إلا ما يخص مؤسسته (API-SEC-01 على قنوات WebSocket/SSE)
    const visible = isStaff(a) ? events : events.filter((e: OutboxEvent) => e.organizationId && orgs.has(e.organizationId));
    if (!isStaff(a) && !visible.length && command !== 'system.reset') continue;
    // id = أعلى رقم تسلسلي لحدث outbox في الرسالة؛ المتصفح يرسله في Last-Event-ID عند إعادة الاتصال لاستكمال ما فاته
    const seq = Math.max(lastSeq(), ...events.map((e) => evSeq(e.id)));
    c.res.write(`id: ${seq}\nevent: change\ndata: ${JSON.stringify({ command: isStaff(a) ? command : undefined, at, events: visible.map((e) => ({ id: e.id, type: e.eventType, aggregateType: e.aggregateType, aggregateId: e.aggregateId })) })}\n\n`);
  }
});
setInterval(() => clients.forEach((c) => c.res.write(`: ping\n\n`)), 25_000);

// ---------- أدوات HTTP ----------
function corsFor(origin: string | undefined): Record<string, string> {
  const base = { Vary: 'Origin', 'X-Medlog-Environment': 'simulated-demo' };
  if (!origin || !(CORS_ALLOW.includes(origin) || (!CORS_ALLOW.length && LOCAL_ORIGIN.test(origin)))) return base;
  return { ...base, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, If-Match, Accept-Language, X-Request-ID', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
}
function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...corsFor(res.req?.headers.origin), ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
/** JSON من معامل الرابط: الخطأ 400 لا 500 */
function jsonParam(raw: string, name: string) {
  try { return JSON.parse(raw); } catch { throw new DomainError('MALFORMED_JSON', 400, { ar: `قيمة JSON غير صالحة في المعامل ${name}`, en: `Malformed JSON in parameter ${name}` }); }
}
function errorBody(e: unknown, lang: 'ar' | 'en', requestId: string) {
  if (e instanceof DomainError) return { status: e.status, body: { error: { code: e.code, message: e.detail[lang], message_ar: e.detail.ar, message_en: e.detail.en, details: e.field ? [{ field: e.field, reason: e.code }] : [], request_id: requestId, retryable: e.status >= 500 } } };
  console.error(e);
  return { status: 500, body: { error: { code: 'INTERNAL', message: lang === 'ar' ? 'خطأ داخلي' : 'Internal error', details: [], request_id: requestId, retryable: true } } };
}
async function readBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > 2_000_000) throw new DomainError('PAYLOAD_TOO_LARGE', 413, { ar: 'الطلب كبير جداً', en: 'Payload too large' }); chunks.push(c as Buffer); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DomainError('MALFORMED_JSON', 400, { ar: 'JSON غير صالح', en: 'Malformed JSON' }); }
}
const rate = new Map<string, { n: number; t: number }>();
function limited(key: string, max: number) { const now = Date.now(); const r = rate.get(key); if (!r || now - r.t > 60_000) { rate.set(key, { n: 1, t: now }); return false; } r.n++; return r.n > max; }
// تنظيف دوري لعدادات المعدل والتحديات المنتهية (لا نمو غير محدود للذاكرة)
setInterval(() => { const now = Date.now(); for (const [k, r] of rate) if (now - r.t > 60_000) rate.delete(k); for (const [k, c] of challenges) if (c.exp < now) challenges.delete(k); }, 60_000).unref();

// ---------- الخادم ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const lang = (String(req.headers['accept-language'] ?? 'ar').startsWith('en') ? 'en' : 'ar') as 'ar' | 'en';
  const requestId = String(req.headers['x-request-id'] ?? `req_${crypto.randomUUID().slice(0, 12)}`);
  if (req.method === 'OPTIONS') return send(res, 204, undefined);
  const p = url.pathname.replace(/\/+$/, '');
  try {
    if (p === '' || p === '/api/v1') return send(res, 200, { name: 'MedLog demo API', version: 'v1', simulated: true, productionReady: false, mode: PROD ? 'production-guarded' : 'demo', demoLogin: DEMO_LOGIN, docs: '/api/v1/openapi.json', note: 'خادم محاكاة للنماذج فقط — ليس تكاملاً إنتاجياً؛ القراءات والمواقع والدفع والرسائل محاكاة' });
    if (p === '/api/v1/health') return send(res, 200, { ok: true, seededAt: engine.db.meta.seededAt, shipments: engine.db.shipments.length });
    if (p === '/api/v1/openapi.json') return send(res, 200, openapi());
    if (p === '/api/v1/meta/commands') return send(res, 200, { commands: listCommands(), queries: listQueries() });

    // المصادقة — مزوّد العرض فقط (كلمة مرور ورمز تحقق مشتركان لحسابات العرض). في وضع الإنتاج لا يُقبل أي منهما:
    // مزوّد الهوية الحقيقي (SSO/OIDC + MFA فعلي) جزء من مرحلة التطوير الإنتاجي ولا يوجد هنا.
    if (PROD && p.startsWith('/api/v1/auth/') && p !== '/api/v1/auth/logout') throw new DomainError('AUTH_PROVIDER_NOT_CONFIGURED', 501, { ar: 'مزوّد الهوية الإنتاجي غير مهيأ؛ مصادقة العرض معطّلة في وضع الإنتاج', en: 'Production identity provider not configured; demo authentication is disabled in production mode' });
    if (p === '/api/v1/auth/login' && req.method === 'POST') {
      if (limited(`login:${req.socket.remoteAddress}`, 30)) throw new DomainError('RATE_LIMITED', 429, { ar: 'محاولات كثيرة؛ انتظر دقيقة', en: 'Too many attempts; wait a minute' });
      const { email, password } = await readBody(req);
      const u = engine.db.users.find((x) => x.email === String(email ?? '').toLowerCase().trim() && x.status !== 'disabled');
      if (!u || password !== DEMO_PASSWORD) throw new DomainError('INVALID_CREDENTIALS', 401, { ar: 'البريد أو كلمة المرور غير صحيحة', en: 'Incorrect email or password' });
      if (u.mfaEnabled) { const cid = crypto.randomUUID(); challenges.set(cid, { userId: u.id, exp: Date.now() + 5 * 60_000, attempts: 0 }); return send(res, 200, { mfaRequired: true, challengeId: cid, hint: `رمز العرض ${DEMO_MFA}` }); }
      if (u.status === 'invited') u.status = 'active';
      return send(res, 200, { token: newSession(u.id, String(req.headers['user-agent'] ?? ''), String(req.socket.remoteAddress ?? '')), userId: u.id });
    }
    if (p === '/api/v1/auth/mfa/verify' && req.method === 'POST') {
      const { challengeId, code } = await readBody(req);
      const c = challenges.get(challengeId);
      if (!c || c.exp < Date.now()) throw new DomainError('MFA_EXPIRED', 401, { ar: 'انتهت صلاحية التحقق؛ سجّل الدخول مجدداً', en: 'Challenge expired; sign in again' });
      if (code !== DEMO_MFA) {
        // حد المحاولات: بعد 5 محاولات خاطئة يُلغى التحدي ويجب تسجيل الدخول من جديد
        if (++c.attempts >= MFA_MAX_ATTEMPTS) { challenges.delete(challengeId); throw new DomainError('MFA_LOCKED', 401, { ar: 'محاولات تحقق كثيرة؛ سجّل الدخول مجدداً', en: 'Too many verification attempts; sign in again' }); }
        throw new DomainError('MFA_INVALID', 401, { ar: 'رمز التحقق غير صحيح', en: 'Incorrect verification code' });
      }
      challenges.delete(challengeId);
      return send(res, 200, { token: newSession(c.userId, String(req.headers['user-agent'] ?? ''), String(req.socket.remoteAddress ?? '')), userId: c.userId });
    }
    // دخول سريع لحسابات العرض — اختصار عرض فقط: غير موجود ما لم يُفعَّل صراحةً (MEDLOG_ENABLE_DEMO_LOGIN=1)،
    // ولا يتجاوز كلمة المرور أو التحقق بخطوتين لأي حساب محمي (المدير، العمليات، المالية…)
    if (p === '/api/v1/auth/demo-login' && req.method === 'POST') {
      if (!DEMO_LOGIN) throw new DomainError('NOT_FOUND', 404, { ar: 'المسار غير موجود', en: 'Route not found' });
      const { email } = await readBody(req);
      const u = engine.db.users.find((x) => x.email === email);
      if (!u || !u.email.endsWith('@medlog.demo')) throw new DomainError('NOT_FOUND', 404, { ar: 'حساب عرض غير معروف', en: 'Unknown demo account' });
      if (u.mfaEnabled) throw new DomainError('MFA_REQUIRED', 403, { ar: 'هذا الحساب يتطلب كلمة المرور والتحقق بخطوتين', en: 'This account requires password and two-step verification' });
      return send(res, 200, { token: newSession(u.id, 'demo-login', String(req.socket.remoteAddress ?? '')), userId: u.id, demo: true });
    }

    const auth = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    // الرمز في الرابط مقبول لقناة SSE فقط (EventSource لا يرسل ترويسات) — لا يُقبل لبقية الواجهات حتى لا يتسرّب في السجلات
    const v = verifyToken(auth || (p === '/api/v1/events' ? url.searchParams.get('access_token') : null) || undefined);
    if (v.expired) throw new DomainError('SESSION_EXPIRED', 401, { ar: 'انتهت الجلسة؛ سجّل الدخول مجدداً', en: 'Session expired; sign in again' });
    const session = v.session;
    if (!session) throw new DomainError('UNAUTHENTICATED', 401, { ar: 'سجّل الدخول أولاً', en: 'Sign in first' });
    const userId = session.userId;

    if (p === '/api/v1/auth/logout' && req.method === 'POST') { session.revokedAt = new Date().toISOString(); persist(engine.db); return send(res, 204, undefined); }
    if (p === '/api/v1/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...corsFor(req.headers.origin) });
      res.write(`retry: 3000\nevent: hello\ndata: {"ok":true,"lastEventId":${lastSeq()}}\n\n`);
      // استكمال بعد إعادة الاتصال: Last-Event-ID (من المتصفح تلقائياً) أو ?lastEventId=
      const since = Number(req.headers['last-event-id'] ?? url.searchParams.get('lastEventId') ?? NaN);
      if (Number.isFinite(since)) {
        const missed = visibleSince(userId, since);
        const oldest = engine.db.outbox.length ? Math.min(...engine.db.outbox.map((e) => evSeq(e.id))) : 0;
        res.write(`id: ${lastSeq()}\nevent: change\ndata: ${JSON.stringify({ command: 'replay', at: new Date().toISOString(), replay: true, gap: since < oldest - 1, events: missed.map((e) => ({ id: e.id, type: e.eventType, aggregateType: e.aggregateType, aggregateId: e.aggregateId })) })}\n\n`);
      }
      const c = { res, userId }; clients.add(c); req.on('close', () => clients.delete(c)); return;
    }
    if (p === '/api/v1/admin/reset' && req.method === 'POST') {
      if (PROD) throw new DomainError('NOT_FOUND', 404, { ar: 'المسار غير موجود', en: 'Route not found' });
      const a = actorFor(engine.db, userId);
      if (!a?.roles.includes('super_admin')) throw new DomainError('FORBIDDEN', 403, { ar: 'لمدير المنصة فقط', en: 'Super admin only' });
      engine.reset(); return send(res, 200, { ok: true, seededAt: engine.db.meta.seededAt });
    }
    // واجهات عامة: أوامر واستعلامات ومجموعات
    let m: RegExpExecArray | null;
    if ((m = /^\/api\/v1\/commands\/([\w.]+)$/.exec(p)) && req.method === 'POST') {
      if (limited(`cmd:${userId}`, 600)) throw new DomainError('RATE_LIMITED', 429, { ar: 'طلبات كثيرة', en: 'Too many requests' });
      const out = engine.exec(m[1], userId, await readBody(req), (req.headers['idempotency-key'] as string) || undefined);
      return send(res, 200, { data: out, request_id: requestId });
    }
    if ((m = /^\/api\/v1\/queries\/([\w.]+)$/.exec(p)) && req.method === 'GET') {
      const params = url.searchParams.get('p') ? jsonParam(url.searchParams.get('p')!, 'p') : Object.fromEntries(url.searchParams);
      return send(res, 200, { data: engine.query(m[1], userId, params) });
    }
    if ((m = /^\/api\/v1\/collections\/(\w+)$/.exec(p)) && req.method === 'GET') {
      const q = Object.fromEntries(url.searchParams);
      return send(res, 200, { data: engine.query('list', userId, { collection: m[1], q: q.q, sort: q.sort, dir: q.dir, page: Number(q.page ?? 1), pageSize: Number(q.limit ?? q.pageSize ?? 25), filter: q.filter ? jsonParam(q.filter, 'filter') : undefined }) });
    }
    // مسارات REST المسمّاة كما في كتالوج API
    const route = matchRoute(req.method ?? 'GET', p);
    if (route) {
      const body = req.method === 'GET' ? {} : await readBody(req);
      const input = route.def.input(route.params, body, Object.fromEntries(url.searchParams));
      const out = route.def.kind === 'command' ? engine.exec(route.def.target, userId, input, (req.headers['idempotency-key'] as string) || undefined) : engine.query(route.def.target, userId, input);
      return send(res, route.def.status ?? 200, { data: out, request_id: requestId });
    }
    throw new DomainError('NOT_FOUND', 404, { ar: 'المسار غير موجود', en: 'Route not found' });
  } catch (e) {
    const { status, body } = errorBody(e, lang, requestId);
    return send(res, status, body);
  }
});

function openapi() {
  const paths: Record<string, any> = {};
  for (const r of ROUTES) {
    const key = r.path.replace(/:(\w+)/g, '{$1}');
    paths['/api/v1' + key] ??= {};
    paths['/api/v1' + key][r.method.toLowerCase()] = { summary: r.summary, 'x-medlog-target': `${r.kind}:${r.target}`, responses: { 200: { description: 'OK' }, '4XX': { description: 'Domain error (API §1.2)' } } };
  }
  return { openapi: '3.1.0', info: { title: 'MedLog Demo API (simulated)', version: '1.0.0-demo', description: 'Mock implementation of API Spec V1.0 for UI prototypes. Not production.' }, paths };
}

server.listen(PORT, () => {
  console.log(`\n  MedLog demo API  →  http://localhost:${PORT}/api/v1`);
  console.log(`  قاعدة البيانات:     ${DB_FILE}`);
  console.log(`  كلمة مرور العرض:   ${DEMO_PASSWORD}   رمز MFA: ${DEMO_MFA}\n`);
});
