'use client';
// حالة التطبيق: النقل (خادم API أو المحرك المحلي)، الجلسة، اللغة، الإشعارات المنبثقة، وإعادة الجلب عند كل تغيير
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createTransport, type ApiError, type Transport } from '@medlog/client';
import { dir, t as tt, type Lang } from '@medlog/i18n';
import { AnimatePresence, DUR, EASE, MotionRoot, SuccessMark, motion } from './motion';
import { DICT_OVERRIDES } from './l10n';

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
  useEffect(() => { currentLang = lang; document.documentElement.lang = lang; document.documentElement.dir = dir(lang); try { localStorage.setItem('al-lang', lang); } catch { /* */ } }, [lang]);
  useEffect(() => { if (!userId) { setMe(null); return; } transport().query('me').then(setMe).catch(() => { setUserId(null); }); }, [userId, tick]);
  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => { const id = ++n.current; setToasts((x) => [...x, { id, kind, text }]); setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), kind === 'error' ? 6000 : 3200); }, []);
  const value = useMemo<Ctx>(() => ({
    lang, setLang: setLangS, t: (k, v) => (DICT_OVERRIDES[k] && !v ? DICT_OVERRIDES[k][lang] : tt(lang, k, v)), x: (e) => (e ? e[lang] : ''),
    userId, me, signIn: (u) => setUserId(u), signOut: () => { transport().logout(); setUserId(null); },
    tick, toast, app,
    async run(cmd, input, opts) {
      try { const r = await transport().exec(cmd, input ?? {}); setTick((x) => x + 1); if (!opts?.silent) toast(opts?.success ?? (lang === 'ar' ? 'تم بنجاح' : 'Done')); return r; }
      catch (e: any) { const err = e as ApiError; if (!opts?.silent) toast(err.message?.[lang] ?? String(e), 'error'); throw err; }
    },
  }), [lang, userId, me, tick, toast, app]);
  if (!ready) return null;
  return (
    <MotionRoot><AppCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite"><AnimatePresence>{toasts.map((x) => <motion.div layout key={x.id} className={'toast ' + x.kind} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, transition: { duration: DUR.fast } }} transition={{ duration: DUR.base, ease: EASE.emphasized }}>{x.kind === 'success' && <SuccessMark size={20} />}{x.text}</motion.div>)}</AnimatePresence></div>
    </AppCtx.Provider></MotionRoot>
  );
}

/** استعلام يُعاد عند كل تغيير في البيانات */
export function useQ<R = any>(name: string | null, params: unknown = {}, deps: unknown[] = []) {
  const { tick, userId } = useApp();
  const [state, set] = useState<{ data: R | null; error: ApiError | null; loading: boolean }>({ data: null, error: null, loading: true });
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!name || !userId) return;
    let alive = true;
    transport().query<R>(name, params).then((data) => alive && set({ data, error: null, loading: false })).catch((error) => alive && set({ data: null, error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, key, tick, userId, ...deps]);
  return state;
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
