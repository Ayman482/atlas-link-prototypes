// اختبارات انحدار لحالة البيانات وعزل الحسابات في الخيار C (useQ و me) — تُشغَّل في jsdom مع React الحقيقي والمحرك المحلي
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
const g = globalThis as any;
for (const k of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'SVGElement', 'Element', 'Node', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia']) {
  if (k === 'matchMedia') { g.window.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }); }
  if (k === 'requestAnimationFrame') { g.requestAnimationFrame = (f: any) => setTimeout(() => f(Date.now()), 0); continue; }
  if (k === 'cancelAnimationFrame') { g.cancelAnimationFrame = (id: any) => clearTimeout(id); continue; }
  try { g[k] = (dom.window as any)[k]; } catch { Object.defineProperty(g, k, { value: (dom.window as any)[k], configurable: true }); }
}
g.IS_REACT_ACT_ENVIRONMENT = true;

let React: typeof import('react'); let act: any; let createRoot: any;
let store: typeof import('../apps/option-c/src/lib/store');
before(async () => {
  React = await import('react');
  ({ act } = await import('react-dom/test-utils') as any);
  ({ createRoot } = await import('react-dom/client') as any);
  store = await import('../apps/option-c/src/lib/store');
});

/** يعرض مكوّناً داخل AppProvider ويعيد مقبضاً للتحكم بالجلسة وسجل كل عملية عرض */
async function mount(probe: (ctx: any) => any) {
  const renders: any[] = [];
  let ctxRef: any = null;
  const { AppProvider, useApp } = store;
  let bump: any = null;
  function Probe() { const ctx = useApp(); const [, setN] = React.useState(0); bump = () => setN((n) => n + 1); ctxRef = ctx; renders.push(probe(ctx)); return null; }
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(React.createElement(AppProvider, { app: 'admin', children: React.createElement(Probe) })); });
  const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
  const rerender = async () => { await act(async () => { bump(); }); await flush(); };
  return { renders, ctx: () => ctxRef, flush, rerender, unmount: () => act(() => root.unmount()) };
}
async function signInAs(h: any, email: string) {
  const tr = store.transport();
  const r = await tr.demoLogin(email);
  await act(async () => { h.ctx().signIn(r.userId); });
  await h.flush();
  return r.userId as string;
}

test('useQ: تبديل الحساب لا يعرض بيانات الحساب السابق ولو لعملية عرض واحدة', async () => {
  let qName: string | null = 'list';
  const h = await mount((ctx) => { const q = store.useQ<any>(qName, { collection: 'shipments', pageSize: 500 }); return { user: ctx.userId, me: ctx.me?.user?.id ?? null, orgs: q.data ? [...new Set(q.data.items.map((s: any) => s.organizationId + '/' + s.branchId))] : null, loading: q.loading }; });
  await signInAs(h, 'corp.admin@medlog.demo');
  const adminView = h.renders.at(-1);
  assert.ok(adminView.orgs.includes('org_nkh/br_nkh_mlq'), 'مدير المؤسسة يرى فرع الملقا');
  // خروج ثم دخول بحساب مشغّل فرع دون إعادة تركيب الشجرة
  await act(async () => { h.ctx().signOut(); }); await h.flush();
  const afterOut = h.renders.at(-1);
  assert.equal(afterOut.orgs, null, 'لا بيانات بعد الخروج'); assert.equal(afterOut.me, null);
  const start = h.renders.length;
  await signInAs(h, 'branch.op@medlog.demo');
  const asBranch = h.renders.slice(start).filter((r) => r.user === 'usr_branch_op');
  assert.ok(asBranch.length > 0);
  for (const r of asBranch) {
    if (r.orgs) for (const o of r.orgs) assert.ok(['org_nkh/br_nkh_oly', 'org_nkh/br_nkh_rwd'].includes(o), `تسرب بيانات فرع آخر: ${o}`);
    assert.ok(r.me === null || r.me === 'usr_branch_op', `ملف مستخدم سابق ظاهر: ${r.me}`);
  }
  assert.deepEqual(h.renders.at(-1).orgs.sort(), ['org_nkh/br_nkh_oly', 'org_nkh/br_nkh_rwd']);
  qName = null; void qName; await h.unmount();
});

test('useQ: تبديل الحساب مباشرة (دون خروج) يمسح البيانات وملف المستخدم فوراً', async () => {
  const h = await mount((ctx) => { const q = store.useQ<any>('me'); return { user: ctx.userId, me: ctx.me?.user?.id ?? null, qme: q.data?.user?.id ?? null }; });
  await signInAs(h, 'corp.admin@medlog.demo');
  assert.equal(h.renders.at(-1).qme, 'usr_corp_admin');
  const start = h.renders.length;
  await signInAs(h, 'individual@medlog.demo');
  for (const r of h.renders.slice(start).filter((x) => x.user === 'usr_individual')) {
    assert.notEqual(r.me, 'usr_corp_admin'); assert.notEqual(r.qme, 'usr_corp_admin');
  }
  assert.equal(h.renders.at(-1).qme, 'usr_individual');
  await h.unmount();
});

test('useQ: تعطيل الاستعلام (name=null) يمسح النتائج السابقة — مثل مسح نص البحث', async () => {
  let q = 'ML-2026';
  const h = await mount(() => { const r = store.useQ<any>(q.trim().length >= 2 ? 'search' : null, { q }); return { n: r.data?.shipments?.length ?? null, loading: r.loading }; });
  await signInAs(h, 'ops@medlog.demo');
  assert.ok(h.renders.at(-1).n > 0, 'نتائج للبحث');
  q = 'M'; await h.rerender();
  assert.equal(h.renders.at(-1).n, null, 'لا تبقى نتائج قديمة بعد تعطيل البحث');
  assert.equal(h.renders.at(-1).loading, false);
  await h.unmount();
});

test('useQ: تغيير المعاملات (شحنة A ← شحنة B) لا يعرض بيانات A تحت B', async () => {
  let id = 'shp_0001';
  const h = await mount(() => { const r = store.useQ<any>('shipment.detail', { id }); return { asked: id, got: r.data?.shipment?.id ?? null, loading: r.loading }; });
  await signInAs(h, 'ops@medlog.demo');
  assert.equal(h.renders.at(-1).got, 'shp_0001');
  id = 'shp_0002'; await h.rerender();
  for (const r of h.renders.filter((x) => x.asked === 'shp_0002')) assert.ok(r.got === null || r.got === 'shp_0002', 'بيانات الشحنة السابقة ظهرت تحت الشحنة الجديدة');
  assert.equal(h.renders.at(-1).got, 'shp_0002');
  await h.unmount();
});

test('useQ: حالات التحميل والخطأ والفراغ', async () => {
  let name = 'no.such.query'; let params: any = {};
  const h = await mount(() => { const r = store.useQ<any>(name, params); return { data: r.data, err: r.error?.code ?? null, loading: r.loading }; });
  await signInAs(h, 'ops@medlog.demo');
  assert.equal(h.renders.at(-1).err, 'NOT_FOUND'); assert.equal(h.renders.at(-1).data, null); assert.equal(h.renders.at(-1).loading, false);
  // من خطأ إلى استعلام فارغ النتائج: يُمسح الخطأ وتظهر قائمة فارغة
  name = 'list'; params = { collection: 'shipments', filter: { status: 'no_such_status' } };
  await h.rerender();
  const last = h.renders.at(-1);
  assert.equal(last.err, null); assert.equal(last.data.total, 0); assert.equal(last.loading, false);
  // أول عرض بعد تغيير المعاملات يكون "تحميل" بلا خطأ قديم
  const firstNew = h.renders.find((r) => r.data === null && r.err === null);
  assert.ok(firstNew && firstNew.loading, 'حالة تحميل صريحة قبل وصول النتيجة');
  await h.unmount();
});

test('useQ: الاستجابة المتأخرة من نطاق قديم تُتجاهل', async () => {
  const tr: any = store.transport();
  const orig = tr.query.bind(tr);
  let release: (() => void) | null = null;
  tr.query = (n: string, p: any) => (p?.id === 'shp_0003' ? new Promise((res) => { release = () => res(orig(n, p)); }) : orig(n, p));
  let id = 'shp_0003';
  const h = await mount(() => { const r = store.useQ<any>('shipment.detail', { id }); return { asked: id, got: r.data?.shipment?.id ?? null }; });
  await signInAs(h, 'ops@medlog.demo');
  id = 'shp_0004'; await h.rerender();
  await act(async () => { release?.(); }); await h.flush();
  assert.equal(h.renders.at(-1).got, 'shp_0004', 'الاستجابة المتأخرة لـ shp_0003 لم تستبدل shp_0004');
  tr.query = orig; await h.unmount();
});

test('me: خطأ شبكة مؤقت لا يُخرج المستخدم، و401 يُخرجه', async () => {
  const h = await mount((ctx) => ({ user: ctx.userId }));
  await signInAs(h, 'ops@medlog.demo');
  const tr: any = store.transport(); const orig = tr.query.bind(tr);
  tr.query = (n: string, p: any) => (n === 'me' ? Promise.reject({ code: 'NETWORK', status: 0, message: { ar: '', en: '' } }) : orig(n, p));
  const poke = async () => { await act(async () => { tr.listeners.forEach((l: any) => l({ command: 'test.poke', at: new Date().toISOString(), events: [] })); }); await h.flush(); };
  await poke();
  assert.equal(h.renders.at(-1).user, 'usr_ops', 'انقطاع الشبكة لا يُنهي الجلسة');
  tr.query = (n: string, p: any) => (n === 'me' ? Promise.reject({ code: 'UNAUTHENTICATED', status: 401, message: { ar: '', en: '' } }) : orig(n, p));
  await poke();
  assert.equal(h.renders.at(-1).user, null, 'رفض الجلسة يُنهي الدخول');
  tr.query = orig; await h.unmount();
});

test('تبديل العربية/الإنجليزية: الاتجاه واللغة والمصطلحات المصححة والحفظ', async () => {
  const h = await mount((ctx) => ({ lang: ctx.lang, legs: ctx.t('nav.legs'), dir: document.documentElement.dir, docLang: document.documentElement.lang }));
  await signInAs(h, 'ops@medlog.demo');
  assert.equal(h.renders.at(-1).dir, 'rtl'); assert.equal(h.renders.at(-1).legs, 'مراحل النقل');
  await act(async () => { h.ctx().setLang('en'); }); await h.flush();
  const en = h.renders.at(-1);
  assert.equal(en.lang, 'en'); assert.equal(en.legs, 'Transport legs');
  assert.equal(document.documentElement.dir, 'ltr'); assert.equal(document.documentElement.lang, 'en');
  assert.equal(localStorage.getItem('al-lang'), 'en');
  await act(async () => { h.ctx().setLang('ar'); }); await h.flush();
  assert.equal(document.documentElement.dir, 'rtl');
  await h.unmount();
});
