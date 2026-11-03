// عميل موحّد للتطبيقات: نفس الواجهة فوق خادم API الدائم (HTTP) أو المحرك داخل المتصفح (للمعاينات المستضافة)
import { Engine, DomainError, DEMO_MFA, DEMO_PASSWORD, type Db } from '@medlog/core';
import { IS_DEMO, MEDLOG_MODE } from './mode';
export { IS_DEMO, MEDLOG_MODE } from './mode';

export interface ApiError { code: string; status: number; message: { ar: string; en: string }; field?: string }
export type ChangeEvent = { command?: string; at: string; events: { type: string; aggregateType: string; aggregateId: string }[] };
export interface LoginResult { token?: string; userId?: string; mfaRequired?: boolean; challengeId?: string }

export interface Transport {
  mode: 'http' | 'local';
  login(email: string, password: string): Promise<LoginResult>;
  verifyMfa(challengeId: string, code: string): Promise<LoginResult>;
  demoLogin(email: string): Promise<LoginResult>;
  logout(): Promise<void>;
  exec<R = any>(command: string, input?: unknown, idempotencyKey?: string): Promise<R>;
  query<R = any>(name: string, params?: unknown): Promise<R>;
  subscribe(fn: (e: ChangeEvent) => void): () => void;
  reset(): Promise<void>;
  token: string | null;
}

const toErr = (e: any): ApiError => e instanceof DomainError ? { code: e.code, status: e.status, message: e.detail, field: e.field } : { code: 'INTERNAL', status: 500, message: { ar: String(e?.message ?? e), en: String(e?.message ?? e) } };

/** المحرك داخل المتصفح — يحفظ في localStorage ويزامن التبويبات عبر BroadcastChannel */
export class LocalTransport implements Transport {
  mode = 'local' as const;
  engine: Engine;
  token: string | null = null;
  private ch: BroadcastChannel | null = null;
  private listeners = new Set<(e: ChangeEvent) => void>();
  private challenges = new Map<string, string>();
  constructor(private storageKey = 'medlog-demo-db-v1', initial?: Db | null) {
    let db: Db | null = initial ?? null;
    if (!db) try { const raw = localStorage.getItem(storageKey); if (raw) db = JSON.parse(raw); } catch { /* تخزين غير متاح */ }
    this.engine = new Engine(db, { persist: (d) => this.save(d) });
    if (!db) this.save(this.engine.db);
    try { this.token = sessionStorage.getItem(storageKey + ':token'); } catch { /* */ }
    try {
      this.ch = new BroadcastChannel(storageKey);
      this.ch.onmessage = (m) => { try { const raw = localStorage.getItem(storageKey); if (raw) this.engine.db = JSON.parse(raw); } catch { /* */ } this.listeners.forEach((l) => l(m.data)); };
    } catch { /* */ }
    this.engine.subscribe((e) => { const ev: ChangeEvent = { command: e.command, at: e.at, events: e.events.map((x) => ({ type: x.eventType, aggregateType: x.aggregateType, aggregateId: x.aggregateId })) }; this.listeners.forEach((l) => l(ev)); this.ch?.postMessage(ev); });
  }
  private save(db: Db) { try { localStorage.setItem(this.storageKey, JSON.stringify(db)); } catch { /* المعاينة تعمل في الذاكرة */ } }
  private setToken(uid: string) { this.token = uid; try { sessionStorage.setItem(this.storageKey + ':token', uid); } catch { /* */ } return { token: uid, userId: uid }; }
  async login(email: string, password: string) {
    const u = this.engine.db.users.find((x) => x.email === email.trim().toLowerCase() && x.status !== 'disabled');
    if (!u || password !== DEMO_PASSWORD) throw { code: 'INVALID_CREDENTIALS', status: 401, message: { ar: 'البريد أو كلمة المرور غير صحيحة', en: 'Incorrect email or password' } } as ApiError;
    if (u.mfaEnabled) { const id = Math.random().toString(36).slice(2); this.challenges.set(id, u.id); return { mfaRequired: true, challengeId: id }; }
    return this.setToken(u.id);
  }
  async verifyMfa(challengeId: string, code: string) {
    const uid = this.challenges.get(challengeId);
    if (!uid) throw { code: 'MFA_EXPIRED', status: 401, message: { ar: 'انتهت صلاحية التحقق', en: 'Challenge expired' } } as ApiError;
    if (code !== DEMO_MFA) throw { code: 'MFA_INVALID', status: 401, message: { ar: 'رمز التحقق غير صحيح', en: 'Incorrect verification code' } } as ApiError;
    this.challenges.delete(challengeId); return this.setToken(uid);
  }
  async demoLogin(email: string) { const u = this.engine.db.users.find((x) => x.email === email); if (!u) throw { code: 'NOT_FOUND', status: 404, message: { ar: 'غير موجود', en: 'Not found' } } as ApiError; return this.setToken(u.id); }
  async logout() { this.token = null; try { sessionStorage.removeItem(this.storageKey + ':token'); } catch { /* */ } }
  async exec<R>(command: string, input: unknown = {}, key?: string): Promise<R> { try { return this.engine.exec<R>(command, this.token ?? '', input, key); } catch (e) { throw toErr(e); } }
  async query<R>(name: string, params: unknown = {}): Promise<R> { try { return this.engine.query<R>(name, this.token ?? '', params); } catch (e) { throw toErr(e); } }
  subscribe(fn: (e: ChangeEvent) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  async reset() { this.engine.reset(); this.ch?.postMessage({ command: 'system.reset', at: new Date().toISOString(), events: [] }); }
}

/** خادم API الدائم — packages/mock-api */
export class HttpTransport implements Transport {
  mode = 'http' as const;
  token: string | null = null;
  private es: EventSource | null = null;
  private listeners = new Set<(e: ChangeEvent) => void>();
  constructor(private base = 'http://localhost:4000/api/v1', private lang: () => 'ar' | 'en' = () => 'ar') {
    try { this.token = sessionStorage.getItem('medlog-token'); } catch { /* */ }
  }
  private async req(method: string, path: string, body?: unknown, idem?: string) {
    let r: Response;
    try { r = await fetch(this.base + path, { method, headers: { 'content-type': 'application/json', 'accept-language': this.lang(), ...(this.token ? { authorization: `Bearer ${this.token}` } : {}), ...(idem ? { 'idempotency-key': idem } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw { code: 'NETWORK', status: 0, message: { ar: 'تعذّر الاتصال بخادم API — شغّل npm run api', en: 'Cannot reach API server — run npm run api' } } as ApiError; }
    const j = r.status === 204 ? {} : await r.json();
    if (!r.ok) throw { code: j.error?.code ?? 'HTTP_' + r.status, status: r.status, message: { ar: j.error?.message_ar ?? j.error?.message, en: j.error?.message_en ?? j.error?.message }, field: j.error?.details?.[0]?.field } as ApiError;
    return j;
  }
  private keep(res: LoginResult) { if (res.token) { this.token = res.token; try { sessionStorage.setItem('medlog-token', res.token); } catch { /* */ } this.connect(); } return res; }
  async login(email: string, password: string) { return this.keep(await this.req('POST', '/auth/login', { email, password })); }
  async verifyMfa(challengeId: string, code: string) { return this.keep(await this.req('POST', '/auth/mfa/verify', { challengeId, code })); }
  async demoLogin(email: string) {
    if (!IS_DEMO) throw { code: 'FORBIDDEN', status: 403, message: { ar: 'الدخول السريع غير متاح في بناء الإنتاج', en: 'Quick demo login is not available in production builds' } } as ApiError;
    return this.keep(await this.req('POST', '/auth/demo-login', { email }));
  }
  async logout() { try { await this.req('POST', '/auth/logout'); } catch { /* */ } this.token = null; this.es?.close(); try { sessionStorage.removeItem('medlog-token'); } catch { /* */ } }
  async exec<R>(command: string, input: unknown = {}, key?: string): Promise<R> { return (await this.req('POST', `/commands/${command}`, input, key)).data; }
  async query<R>(name: string, params: unknown = {}): Promise<R> { return (await this.req('GET', `/queries/${name}?p=${encodeURIComponent(JSON.stringify(params))}`)).data; }
  private opened = false;
  private seen = new Set<string>();
  private connect() {
    if (!this.token || typeof EventSource === 'undefined') return;
    this.es?.close(); this.opened = false;
    this.es = new EventSource(`${this.base}/events?access_token=${encodeURIComponent(this.token)}`);
    // إعادة الاتصال: المتصفح يرسل Last-Event-ID فيُستكمل ما فات؛ ومع ذلك نطلب تحديثاً كاملاً للشاشات احتياطاً
    this.es.addEventListener('open', () => { if (this.opened) this.listeners.forEach((l) => l({ command: 'reconnect', at: new Date().toISOString(), events: [] })); this.opened = true; });
    this.es.addEventListener('change', (m: MessageEvent) => {
      const d = JSON.parse(m.data);
      // منع التكرار: حدث وصل مرتين (بث مباشر ثم استكمال) لا يُمرر مرتين
      d.events = (d.events ?? []).filter((e: any) => !e.id || (this.seen.has(e.id) ? false : (this.seen.add(e.id), true)));
      if (this.seen.size > 5000) this.seen = new Set([...this.seen].slice(-2000));
      if (d.events.length || d.command === 'replay' || d.command === 'system.reset') this.listeners.forEach((l) => l(d));
    });
  }
  subscribe(fn: (e: ChangeEvent) => void) { this.listeners.add(fn); if (!this.es) this.connect(); return () => { this.listeners.delete(fn); }; }
  async reset() { await this.req('POST', '/admin/reset'); }
}

/** يختار النقل: NEXT_PUBLIC_MEDLOG_API لخادم دائم، وإلا المحرك المحلي */
export function createTransport(apiBase?: string | null, lang?: () => 'ar' | 'en'): Transport {
  if (MEDLOG_MODE === 'production') {
    // بناء الإنتاج: خادم حقيقي إلزامي، ولا محرك محلي (هويته = معرّف المستخدم، أي قابل للانتحال)
    if (!apiBase) throw new Error('NEXT_PUBLIC_MEDLOG_API is required in production builds');
    return new HttpTransport(apiBase, lang);
  }
  return apiBase ? new HttpTransport(apiBase, lang) : new LocalTransport();
}
