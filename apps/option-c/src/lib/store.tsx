'use client';
// حالة التطبيق: النقل (خادم API أو المحرك المحلي)، الجلسة، اللغة، الإشعارات المنبثقة، وإعادة الجلب عند كل تغيير
import { Layer } from './overlay';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createTransport, type ApiError, type Transport } from '@medlog/client';
import { dir, type Lang } from '@medlog/i18n';
import { AnimatePresence, DUR, EASE, MotionRoot, SuccessMark, motion } from './motion';
import { term } from './l10n';

let shared: Transport | null = null;
export function transport(): Transport {
  if (!shared) shared = createTransport(process.env.NEXT_PUBLIC_MEDLOG_API || null, () => currentLang);
  return shared;
}
let currentLang: Lang = 'ar';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; text: string }
interface Ctx {
  lang: Lang; setLang(l: Lang): void; t(k: string, v?: Record<string, string | number>): string; x(e: { ar: string; en: string } | null | undefined): string;
  userId: string | null; me: any; signIn(userId: string): void; signOut(): void;
  tick: number; toast(text: string, kind?: Toast['kind']): void;
  run<R = any>(cmd: string, input?: unknown, opts?: { success?: string; silent?: boolean }): Promise<R>;
  app: 'admin' | 'portal' | 'customer' | 'courier';
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

export function AppProvider({ app, children }: { app: Ctx['app']; children: React.ReactNode }) {
  const [lang, setLangS] = useState<Lang>('ar');
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ready, setReady] = useState(false);
  const n = useRef(0);
  useEffect(() => {
    try { const l = localStorage.getItem('al-lang') as Lang; if (l === 'en' || l === 'ar') setLangS(l); } catch { /* */ }
    const tr = transport();
    if (tr.token) setUserId(tr.token);
    setReady(true);
    return tr.subscribe(() => setTick((x) => x + 1));
  }, []);
  // أخطاء الأوامر التي عُرضت للمستخدم كرسالة لا تُعاد كرفض غير معالج في وحدة التحكم (المعالجات المباشرة onChange={() => run(...)})
  useEffect(() => { const h = (e: PromiseRejectionEvent) => { if ((e.reason as any)?.__shown) e.preventDefault(); }; window.addEventListener('unhandledrejection', h); return () => window.removeEventListener('unhandledrejection', h); }, []);
  useEffect(() => { currentLang = lang; document.documentElement.lang = lang; document.documentElement.dir = dir(lang); try { localStorage.setItem('al-lang', lang); } catch { /* */ } }, [lang]);
  // عند تغيّر الحساب: يُمسح ملف المستخدم السابق فوراً حتى لا تُعرض أدواره أو بياناته للحساب الجديد
  const meOwner = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) { meOwner.current = null; setMe(null); return; }
    if (meOwner.current !== userId) { meOwner.current = userId; setMe(null); }
    let alive = true;
    transport().query('me').then((m) => { if (alive) setMe(m); }).catch((e: ApiError) => {
      // يُنهى الدخول فقط عند رفض الجلسة؛ انقطاع الشبكة المؤقت لا يُخرج المستخدم
      if (alive && (e?.status === 401 || e?.code === 'UNAUTHENTICATED')) { transport().logout(); setUserId(null); }
    });
    return () => { alive = false; };
  }, [userId, tick]);
  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => { const id = ++n.current; setToasts((x) => [...x, { id, kind, text }]); setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), kind === 'error' ? 6000 : 3200); }, []);
  const value = useMemo<Ctx>(() => ({
    lang, setLang: setLangS, t: (k, v) => term(lang, k, v), x: (e) => (e ? e[lang] : ''),
    // لا يُعرض ملف مستخدم لا يطابق الحساب النشط (يمنع ظهور أدوار الحساب السابق لعملية عرض واحدة)
    userId, me: me && me.user?.id === userId ? me : null, signIn: (u) => setUserId(u), signOut: () => { transport().logout(); setUserId(null); },
    tick, toast, app,
    async run(cmd, input, opts) {
      try { const r = await transport().exec(cmd, input ?? {}); setTick((x) => x + 1); if (!opts?.silent) toast(opts?.success ?? (lang === 'ar' ? 'تم بنجاح' : 'Done')); return r; }
      catch (e: any) { const err = e as ApiError; if (!opts?.silent) { toast(err.message?.[lang] ?? String(e), 'error'); try { Object.defineProperty(err, '__shown', { value: true }); } catch { /* */ } } throw err; }
    },
  }), [lang, userId, me, tick, toast, app]);
  if (!ready) return null;
  return (
    <MotionRoot><AppCtx.Provider value={value}>
      {children}
      <Layer><div className="toasts" role="status" aria-live="polite"><AnimatePresence>{toasts.map((x) => <motion.div layout key={x.id} className={'toast ' + x.kind} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, transition: { duration: DUR.fast } }} transition={{ duration: DUR.base, ease: EASE.emphasized }}>{x.kind === 'success' && <SuccessMark size={20} />}{x.text}</motion.div>)}</AnimatePresence></div></Layer>
    </AppCtx.Provider></MotionRoot>
  );
}

/** حالة استعلام مربوطة بنطاقه (الحساب + اسم الاستعلام + المعاملات).
 *  لا تُعاد بيانات نطاق سابق أبداً: عند تغيّر الحساب أو المعاملات أو تعطّل الاستعلام تُعاد حالة فارغة فوراً
 *  (دون انتظار التأثير)، وتُتجاهل الاستجابات المتأخرة من نطاق قديم. التحديث داخل نفس النطاق يُبقي البيانات (refreshing). */
export interface QState<R> { data: R | null; error: ApiError | null; loading: boolean; refreshing: boolean }
export const queryScope = (userId: string | null, name: string | null, key: string) => (name && userId ? `${userId}|${name}|${key}` : null);
export function viewOf<R>(st: { scope: string | null } & QState<R>, scope: string | null): QState<R> {
  if (!scope) return { data: null, error: null, loading: false, refreshing: false };
  if (st.scope !== scope) return { data: null, error: null, loading: true, refreshing: false };
  return { data: st.data, error: st.error, loading: st.loading, refreshing: st.refreshing };
}
export function useQ<R = any>(name: string | null, params: unknown = {}, deps: unknown[] = []) {
  const { tick, userId } = useApp();
  const key = JSON.stringify(params);
  const scope = queryScope(userId, name, key);
  const [state, set] = useState<{ scope: string | null } & QState<R>>({ scope: null, data: null, error: null, loading: true, refreshing: false });
  useEffect(() => {
    if (!scope) { set({ scope: null, data: null, error: null, loading: false, refreshing: false }); return; }
    let alive = true;
    set((s) => (s.scope === scope ? { ...s, refreshing: true } : { scope, data: null, error: null, loading: true, refreshing: false }));
    transport().query<R>(name!, params)
      .then((data) => alive && set({ scope, data, error: null, loading: false, refreshing: false }))
      .catch((error) => alive && set({ scope, data: null, error, loading: false, refreshing: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, tick, ...deps]);
  return viewOf(state, scope);
}
export const useList = (collection: string, params: Record<string, unknown> = {}) => useQ<{ items: any[]; total: number }>('list', { collection, pageSize: 500, ...params });

// ---------- توجيه بالـ hash (يعمل على الاستضافة الثابتة) ----------
export function useRoute() {
  const [hash, setHash] = useState(() => (typeof location !== 'undefined' ? location.hash : ''));
  useEffect(() => { const h = () => { setHash(location.hash); window.scrollTo(0, 0); }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs ?? ''));
  return { path, query, parts: path.split('/').filter(Boolean) };
}
export const go = (path: string) => { location.hash = path; };
export const href = (path: string) => '#' + path;
