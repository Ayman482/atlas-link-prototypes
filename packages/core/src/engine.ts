// محرك المحاكاة — يعمل نفسه في خادم Node (قاعدة بيانات ملف دائمة) وفي المتصفح (المعاينة المستضافة)
// كل أمر يُنفّذ كمعاملة واحدة: تغييرات المجال + سجل التدقيق + حدث outbox، أو لا شيء (ARC-007)
import type * as T from './types';
import { DomainError } from './types';
import { actorFor, has, isStaff, type Actor } from './access';
import { clone, fingerprint, iso, pad } from './util';
import { seed } from './seed';

export interface Ctx {
  db: T.Db; actor: Actor; now: number; nowIso: string; requestId: string;
  id(prefix: string): string;
  seq(key: string, width?: number): string;
  emit(eventType: string, aggregateType: string, aggregateId: string, organizationId: string | null, payload?: Record<string, unknown>): void;
  audit(action: string, entityType: string, entityId: string | null, summary: string, onBehalfOrgId?: string | null): void;
  notify(n: Partial<T.Notification> & { title: T.L; body: T.L; audience: T.Notification['audience'] }): void;
  fail(code: string, ar: string, en: string, status?: number, field?: string): never;
  require(...roles: T.RoleCode[]): void;
  exec<R = unknown>(name: string, input: unknown): R;
  /** نقطة حفظ داخل المعاملة: الدالة المعادة تستعيد البيانات وتحذف الأحداث المضافة بعدها (للتراجع الجزئي مثل courier.sync) */
  savepoint(): () => void;
}

export type Guard = 'any' | 'staff' | T.RoleCode[];
export interface Command<I = any, R = any> { name: string; guard: Guard; desc: T.L; run(ctx: Ctx, input: I): R }
export interface Query<P = any, R = any> { name: string; guard: Guard; run(db: T.Db, actor: Actor, params: P, now: number): R }

const registry = new Map<string, Command>();
const queries = new Map<string, Query>();
export const defineCommand = <I, R>(c: Command<I, R>) => (registry.set(c.name, c as Command), c);
export const defineQuery = <P, R>(q: Query<P, R>) => (queries.set(q.name, q as Query), q);
export const listCommands = () => [...registry.values()].map((c) => ({ name: c.name, guard: c.guard, desc: c.desc }));
export const listQueries = () => [...queries.values()].map((q) => ({ name: q.name, guard: q.guard }));

export interface EngineOptions { clock?: () => number; persist?: (db: T.Db, changed: string[]) => void; seedNo?: number }
export type ChangeListener = (e: { command: string; events: T.OutboxEvent[]; actorId: string | null; at: string }) => void;

export class Engine {
  db: T.Db;
  clock: () => number;
  private listeners = new Set<ChangeListener>();
  constructor(db: T.Db | null, private opts: EngineOptions = {}) {
    this.clock = opts.clock ?? (() => Date.now());
    this.db = db ?? seed(this.clock(), opts.seedNo ?? 2026);
  }
  subscribe(fn: ChangeListener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  reset(seedNo = this.opts.seedNo ?? 2026) {
    this.db = seed(this.clock(), seedNo);
    this.opts.persist?.(this.db, ['*']);
    this.listeners.forEach((l) => l({ command: 'system.reset', events: [], actorId: null, at: iso(this.clock()) }));
  }
  actor(userId: string): Actor {
    const a = actorFor(this.db, userId);
    if (!a) throw new DomainError('UNAUTHENTICATED', 401, { ar: 'الجلسة غير صالحة', en: 'Invalid session' });
    return a;
  }

  query<R = unknown>(name: string, userId: string, params: unknown = {}): R {
    const q = queries.get(name);
    if (!q) throw new DomainError('NOT_FOUND', 404, { ar: `استعلام غير معروف: ${name}`, en: `Unknown query: ${name}` });
    const actor = this.actor(userId);
    checkGuard(q.guard, actor);
    return q.run(this.db, actor, params ?? {}, this.clock()) as R;
  }

  /** ينفّذ أمراً كمعاملة ذرّية مع Idempotency-Key اختياري (API-REL-01) */
  exec<R = unknown>(name: string, userId: string, input: unknown = {}, idempotencyKey?: string): R {
    const cmd = registry.get(name);
    if (!cmd) throw new DomainError('NOT_FOUND', 404, { ar: `أمر غير معروف: ${name}`, en: `Unknown command: ${name}` });
    const actor = this.actor(userId);
    checkGuard(cmd.guard, actor);
    const fp = fingerprint([name, input]);
    if (idempotencyKey) {
      const k = `${userId}:${name}:${idempotencyKey}`;
      const prev = this.db.meta.idempotency[k];
      if (prev) {
        if (prev.fingerprint !== fp) throw new DomainError('IDEMPOTENCY_CONFLICT', 409, { ar: 'نفس مفتاح Idempotency استُخدم بطلب مختلف', en: 'Idempotency key reused with a different payload' });
        return prev.result as R;
      }
    }
    const snapshot = clone(this.db);
    const events: T.OutboxEvent[] = [];
    const now = this.clock();
    const requestId = `req_${fp.slice(0, 10)}_${now.toString(36)}`;
    const ctx = this.makeCtx(actor, now, requestId, events);
    let result: R;
    try {
      result = cmd.run(ctx, input as never) as R;
      if (idempotencyKey) this.db.meta.idempotency[`${userId}:${name}:${idempotencyKey}`] = { fingerprint: fp, result: result ?? null, at: iso(now) };
      // الالتزام: الحفظ الدائم داخل المعاملة — إن فشل يُتراجع عن كل شيء ولا يُبث أي حدث
      this.opts.persist?.(this.db, [name]);
    } catch (e) {
      this.db = snapshot; // تراجع كامل — لا أثر جزئي ولا أحداث
      throw e;
    }
    // بعد الالتزام فقط: البث للمشتركين (SSE، التبويبات الأخرى). خطأ مشترك لا يُفشل أمراً التزم فعلاً
    const payload = { command: name, events: [...events], actorId: userId, at: iso(now) };
    this.listeners.forEach((l) => { try { l(payload); } catch (err) { console.error('listener failed after commit', err); } });
    return result;
  }

  private makeCtx(actor: Actor, now: number, requestId: string, events: T.OutboxEvent[]): Ctx {
    const self = this;
    const db = () => self.db;
    const ctx: Ctx = {
      get db() { return db(); }, actor, now, nowIso: iso(now), requestId,
      id(prefix) { const c = db().meta.counters; const n = (c['id:' + prefix] = (c['id:' + prefix] ?? 0) + 1); return `${prefix}_${pad(n)}`; },
      seq(key, width = 5) { const c = db().meta.counters; return pad((c[key] = (c[key] ?? 0) + 1), width); },
      emit(eventType, aggregateType, aggregateId, organizationId, payload = {}) {
        const ev: T.OutboxEvent = { id: ctx.id('evt'), eventType, aggregateType, aggregateId, organizationId, occurredAt: iso(now), payload, publishedAt: iso(now) };
        db().outbox.push(ev); events.push(ev);
        if (db().outbox.length > 4000) db().outbox.splice(0, db().outbox.length - 4000);
      },
      audit(action, entityType, entityId, summary, onBehalfOrgId = null) {
        db().audit.push({ id: ctx.id('aud'), actorId: actor.user.id, action, entityType, entityId, occurredAt: iso(now), requestId, summary, onBehalfOrgId });
      },
      notify(n) {
        db().notifications.push({ id: ctx.id('ntf'), userId: n.userId ?? null, organizationId: n.organizationId ?? null, audience: n.audience, channel: n.channel ?? 'in_app', templateCode: n.templateCode ?? 'event', title: n.title, body: n.body, link: n.link ?? null, critical: !!n.critical, readAt: null, createdAt: iso(now), deliveryStatus: 'simulated_sent' });
      },
      fail(code, ar, en, status = 422, field) { throw new DomainError(code, status, { ar, en }, field); },
      require(...roles) { if (!has(actor, ...roles)) throw new DomainError('FORBIDDEN', 403, { ar: 'ليست لديك صلاحية لهذا الإجراء', en: 'You do not have permission for this action' }); },
      savepoint() {
        const snap = clone(db()); const n = events.length;
        return () => { for (const k of Object.keys(snap) as (keyof T.Db)[]) (db() as any)[k] = (snap as any)[k]; events.length = n; };
      },
      exec(name, input) {
        const cmd = registry.get(name);
        if (!cmd) throw new Error(name);
        checkGuard(cmd.guard, actor);
        return cmd.run(ctx, input as never) as never;
      },
    };
    return ctx;
  }
}

function checkGuard(g: Guard, a: Actor) {
  if (g === 'any') return;
  if (g === 'staff') { if (!isStaff(a)) throw new DomainError('FORBIDDEN', 403, { ar: 'متاح لموظفي المنصة فقط', en: 'Platform staff only' }); return; }
  if (!has(a, ...g)) throw new DomainError('FORBIDDEN', 403, { ar: 'ليست لديك صلاحية لهذا الإجراء', en: 'You do not have permission for this action' });
}

// أدوات مساعدة مشتركة للأوامر
export function must<X>(ctx: Ctx, v: X | undefined | null, what: string): X {
  if (v === undefined || v === null) ctx.fail('NOT_FOUND', `غير موجود: ${what}`, `Not found: ${what}`, 404);
  return v as X;
}
