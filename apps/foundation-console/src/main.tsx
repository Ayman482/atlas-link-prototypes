// وحدة الأساس المشترك — معاينة المرحلة 1: المحرك وقاعدة بيانات العرض والقواعد والقاموس، بلا تصميم خيار بعينه
// تستخدم React من CDN (المتغير العام React) والمحرك المشترك مضمّناً.
import { SCENARIOS, listCommands, listQueries, isStaff, actorFor, deviceOfBox, type Collection, type Db } from '@medlog/core';
import { LocalTransport, type ApiError } from '@medlog/client';
import { dict, t, L, dir, fmtSAR, fmtDateTime, fmtNumber, fmtRelative, type Lang } from '@medlog/i18n';

declare const React: any; declare const ReactDOM: any;
const { useState, useEffect, useMemo, useCallback } = React;

const tr = new LocalTransport('atlas-link-foundation-v1');
const eng = tr.engine;
const api = { exec: (as: string, c: string, i?: unknown) => eng.exec(c, as, i), query: (as: string, q: string, p?: unknown) => eng.query(q, as, p), db: () => eng.db, now: () => eng.clock() };

const ACCOUNTS: { group: { ar: string; en: string }; items: string[] }[] = [
  { group: dict.app.admin, items: ['usr_admin', 'usr_ops', 'usr_warehouse', 'usr_quality', 'usr_finance', 'usr_approver', 'usr_compliance', 'usr_iot', 'usr_support', 'usr_exec', 'usr_partner'] },
  { group: dict.app.portal, items: ['usr_corp_admin', 'usr_branch_op', 'usr_corp_finance', 'usr_individual', 'usr_lab'] },
  { group: dict.app.courierApp, items: ['usr_courier1', 'usr_courier2'] },
];
const UI = {
  title: { ar: 'الأساس المشترك', en: 'Shared foundation' },
  sub: { ar: 'المرحلة 1 — محرك المحاكاة، قاعدة بيانات العرض، قواعد العمل، والقاموس الثنائي. الخيارات A وB وC تُبنى فوق هذا الأساس نفسه.', en: 'Phase 1 — simulation engine, demo database, business rules and bilingual dictionary. Options A, B and C are built on this same foundation.' },
  actingAs: { ar: 'تعمل بصفة', en: 'Acting as' },
  tabs: { overview: { ar: 'نظرة عامة', en: 'Overview' }, scenarios: { ar: 'السيناريوهات', en: 'Scenarios' }, data: { ar: 'مستكشف البيانات', en: 'Data explorer' }, console: { ar: 'وحدة الأوامر', en: 'Command console' }, checks: { ar: 'الثوابت', en: 'Invariants' }, events: { ar: 'الأحداث', en: 'Events' } },
  runStep: { ar: 'تشغيل الخطوة', en: 'Run step' }, runAll: { ar: 'تشغيل الكل', en: 'Run all' }, again: { ar: 'إعادة', en: 'Restart' },
  expectedErr: { ar: 'رُفض كما هو متوقع', en: 'Refused as expected' }, unexpected: { ar: 'خطأ غير متوقع', en: 'Unexpected error' }, okRes: { ar: 'نجح', en: 'Succeeded' },
  visible: { ar: 'مرئي لهذا الحساب', en: 'Visible to this account' }, of: { ar: 'من أصل', en: 'of' },
  run: { ar: 'تنفيذ', en: 'Run' }, input: { ar: 'المدخلات (JSON)', en: 'Input (JSON)' }, idem: { ar: 'مفتاح Idempotency (اختياري)', en: 'Idempotency key (optional)' }, result: { ar: 'النتيجة', en: 'Result' },
  resetQ: { ar: 'ستُعاد كل البيانات إلى حالتها الأولى في هذا المتصفح.', en: 'All data in this browser returns to its initial state.' }, resetDone: { ar: 'أُعيد توليد بيانات العرض', en: 'Demo data regenerated' },
  storage: { ar: 'في هذه المعاينة يعمل المحرك داخل المتصفح ويحفظ في التخزين المحلي، وتتزامن التبويبات المفتوحة. في الكود المصدري يعمل نفس المحرك خلف خادم API بقاعدة بيانات ملف دائمة.', en: 'In this preview the engine runs in the browser, saves to local storage and syncs open tabs. In the source code the same engine runs behind an API server with a persistent file database.' },
  noEvents: { ar: 'لم تُنفّذ أوامر بعد في هذه الجلسة. شغّل سيناريو أو أمراً لترى الأحداث.', en: 'No commands yet in this session. Run a scenario or a command to see events.' },
  kpi: { ar: 'مؤشرات برج التحكم', en: 'Control tower indicators' }, collections: { ar: 'المجموعات وأحجامها', en: 'Collections and sizes' },
  cmds: { ar: 'أمر', en: 'commands' }, qs: { ar: 'استعلام', en: 'queries' },
};
const tx = (lang: Lang, e: { ar: string; en: string }) => e[lang];

function userName(db: Db, id: string, lang: Lang) { const u = db.users.find((x) => x.id === id); return u ? L(lang, u.name) : id; }
function roleOf(db: Db, id: string, lang: Lang) { const a = actorFor(db, id); return a ? a.roles.map((r) => t(lang, `roles.${r}`)).join('، ') : ''; }

function useTick() { const [n, set] = useState(0); useEffect(() => tr.subscribe(() => set((x: number) => x + 1)), []); return n; }

function Json({ v }: { v: unknown }) { return <pre className="json" dir="ltr">{JSON.stringify(v, (_k, x) => (typeof x === 'string' && x.length > 120 ? x.slice(0, 117) + '…' : x), 2)}</pre>; }

// ---------------- نظرة عامة ----------------
function Overview({ lang, as }: { lang: Lang; as: string }) {
  useTick();
  const db = eng.db; const staff = isStaff(actorFor(db, as)!);
  let kp: any = null; let err: ApiError | null = null;
  try { kp = staff ? api.query(as, 'controlTower.summary', {}).kpis : api.query(as, 'customer.dashboard', {}).totals; } catch (e: any) { err = e; }
  const cols = Object.entries(db).filter(([k]) => k !== 'meta').map(([k, v]) => [k, (v as unknown[]).length] as const).sort((a, b) => b[1] - a[1]);
  const labels: Record<string, { ar: string; en: string }> = { active: { ar: 'شحنات نشطة', en: 'Active shipments' }, awaitingPickup: { ar: 'بانتظار الاستلام', en: 'Awaiting pickup' }, overdueDeliveries: { ar: 'تسليم متأخر', en: 'Overdue deliveries' }, exceptions: { ar: 'استثناءات وفشل', en: 'Exceptions & failures' }, openExcursions: { ar: 'انحرافات مفتوحة', en: 'Open excursions' }, boxesReady: { ar: 'صناديق جاهزة', en: 'Boxes ready' }, boxesNotReady: { ar: 'صناديق غير جاهزة', en: 'Boxes not ready' }, couriersAvailable: { ar: 'مندوبون متاحون', en: 'Couriers available' }, shipments: { ar: 'شحنات (30 يوماً)', en: 'Shipments (30 days)' }, delivered: { ar: 'مسلّمة', en: 'Delivered' }, onTimePct: { ar: 'في الوقت %', en: 'On time %' }, excursions: { ar: 'انحرافات', en: 'Excursions' }, tempCompliancePct: { ar: 'التزام حراري %', en: 'Temp compliance %' } };
  const crit = new Set(['overdueDeliveries', 'exceptions', 'openExcursions', 'boxesNotReady', 'excursions']);
  return (
    <div className="stack">
      <p className="lede">{tx(lang, UI.sub)}</p>
      <section>
        <h3>{staff ? tx(lang, UI.kpi) : tx(lang, { ar: 'لوحة العميل (بلا تكلفة داخلية)', en: 'Customer dashboard (no internal cost)' })}</h3>
        {err ? <div className="err">{err.message[lang]}</div> : (
          <div className="kpis">{Object.entries(kp).filter(([k]) => labels[k]).map(([k, v]) => <div key={k} className={'kpi' + (crit.has(k) && Number(v) > 0 ? ' warn' : '')}><span>{tx(lang, labels[k])}</span><b>{v == null ? '—' : fmtNumber(lang, v as number, 0)}</b></div>)}</div>
        )}
      </section>
      <section className="grid2">
        <div>
          <h3>{tx(lang, UI.collections)}</h3>
          <div className="cols">{cols.map(([k, n]) => <div key={k}><code>{k}</code><span className="num">{fmtNumber(lang, n)}</span></div>)}</div>
        </div>
        <div className="stack">
          <h3>{tx(lang, { ar: 'ما يحتويه الأساس', en: 'What the foundation contains' })}</h3>
          <ul className="facts">
            <li><b>{listCommands().length}</b> {tx(lang, UI.cmds)} · <b>{listQueries().length}</b> {tx(lang, UI.qs)}</li>
            <li>{tx(lang, { ar: '19 حساب عرض لكل الأدوار، مع عضوية مختلفة لنفس المستخدم في فرعين', en: '19 demo accounts across all roles, including one user with different roles in two branches' })}</li>
            <li>{tx(lang, { ar: '12 سيناريو عرض و32 اختبار قبول ناجحاً (UAT-001..015 وDB-AT)', en: '12 demo scenarios and 32 passing acceptance tests (UAT-001..015, DB-AT)' })}</li>
            <li>{tx(lang, { ar: 'كل القراءات الحرارية ومواقع GPS بيانات عرض مُعلَّمة، وكل التكاملات الخارجية محاكاة', en: 'All temperature and GPS readings are labelled demo data; all external integrations are simulated' })}</li>
          </ul>
          <p className="muted">{tx(lang, UI.storage)}</p>
          <p className="muted">{tx(lang, { ar: 'بُذرت البيانات في', en: 'Seeded at' })} {fmtDateTime(lang, db.meta.seededAt)} · {fmtSAR(lang, db.invoices.reduce((a, i) => a + i.total, 0))} {tx(lang, { ar: 'إجمالي الفواتير', en: 'invoiced total' })}</p>
        </div>
      </section>
    </div>
  );
}

// ---------------- السيناريوهات ----------------
type StepRes = { ok: boolean; expected?: boolean; value?: unknown; error?: ApiError; events: string[] };
function Scenarios({ lang, setAs }: { lang: Lang; setAs: (u: string) => void }) {
  const [sel, setSel] = useState(SCENARIOS[0].id);
  const [state, setState] = useState<Record<string, { ctx: Record<string, any>; results: StepRes[] }>>({});
  const sc = SCENARIOS.find((s) => s.id === sel)!;
  const st = state[sel] ?? { ctx: {}, results: [] };
  const runOne = useCallback(() => {
    const i = st.results.length; if (i >= sc.steps.length) return;
    const step = sc.steps[i]; setAs(step.as);
    const before = eng.db.outbox.length;
    let r: StepRes;
    try { const v = step.run(api, st.ctx); r = { ok: !step.expectError, expected: false, value: v, events: [] }; if (step.expectError) r.error = { code: 'NO_ERROR', status: 0, message: { ar: 'كان متوقعاً أن يُرفض', en: 'Expected a refusal' } }; }
    catch (e: any) { const err: ApiError = e.detail ? { code: e.code, status: e.status, message: e.detail } : e; r = { ok: err.code === step.expectError, expected: err.code === step.expectError, error: err, events: [] }; }
    r.events = eng.db.outbox.slice(before).map((x) => x.eventType);
    setState({ ...state, [sel]: { ctx: st.ctx, results: [...st.results, r] } });
  }, [st, sc, state, sel]);
  const runAll = () => { let s = st; const out = [...s.results]; for (let i = s.results.length; i < sc.steps.length; i++) { const step = sc.steps[i]; const before = eng.db.outbox.length; try { const v = step.run(api, s.ctx); out.push({ ok: !step.expectError, value: v, events: eng.db.outbox.slice(before).map((x) => x.eventType) }); } catch (e: any) { const err: ApiError = e.detail ? { code: e.code, status: e.status, message: e.detail } : e; out.push({ ok: err.code === step.expectError, expected: err.code === step.expectError, error: err, events: [] }); } } setAs(sc.steps[sc.steps.length - 1].as); setState({ ...state, [sel]: { ctx: s.ctx, results: out } }); };
  return (
    <div className="split">
      <nav className="sclist" aria-label={tx(lang, UI.tabs.scenarios)}>
        {SCENARIOS.map((s) => { const r = state[s.id]?.results ?? []; const done = r.length === s.steps.length; const bad = r.some((x) => !x.ok); return (
          <button key={s.id} className={'scitem' + (s.id === sel ? ' on' : '')} onClick={() => setSel(s.id)}>
            <span className="scid">{s.id}</span><span className="sct">{L(lang, s.title)}</span>
            <span className={'dot ' + (bad ? 'bad' : done ? 'good' : r.length ? 'mid' : '')} aria-hidden="true" />
          </button>); })}
      </nav>
      <div className="stack" style={{ minWidth: 0 }}>
        <header className="schead">
          <div><h3>{sc.id} · {L(lang, sc.title)}</h3><p className="muted">{L(lang, sc.proves)} · <span className="tag">{sc.uat.join(' · ')}</span></p></div>
          <div className="row">
            <button className="btn primary" onClick={runOne} disabled={st.results.length >= sc.steps.length}>{tx(lang, UI.runStep)}</button>
            <button className="btn" onClick={runAll} disabled={st.results.length >= sc.steps.length}>{tx(lang, UI.runAll)}</button>
            <button className="btn ghost" onClick={() => setState({ ...state, [sel]: { ctx: {}, results: [] } })}>{tx(lang, UI.again)}</button>
          </div>
        </header>
        <ol className="steps">
          {sc.steps.map((step, i) => { const r = st.results[i]; return (
            <li key={i} className={'step ' + (r ? (r.ok ? (r.expected ? 'exp' : 'ok') : 'bad') : i === st.results.length ? 'next' : '')}>
              <div className="stephead"><span className="stepn">{i + 1}</span><b>{L(lang, step.title)}</b><span className="who">{userName(eng.db, step.as, lang)} · {roleOf(eng.db, step.as, lang)}</span></div>
              {r && <div className="stepbody">
                <div className="row"><span className={'pill ' + (r.ok ? (r.expected ? 'warn' : 'good') : 'crit')}>{r.ok ? (r.expected ? tx(lang, UI.expectedErr) : tx(lang, UI.okRes)) : tx(lang, UI.unexpected)}</span>{r.events.map((e, k) => <code key={k} className="ev">{e}</code>)}</div>
                {r.error && <p className="errline"><code>{r.error.code}</code> {r.error.message[lang]}</p>}
                {r.value !== undefined && <Json v={r.value} />}
              </div>}
            </li>); })}
        </ol>
      </div>
    </div>
  );
}

// ---------------- مستكشف البيانات ----------------
const COLLECTIONS: Collection[] = ['shipments', 'boxes', 'devices', 'readings', 'custody', 'excursions', 'incidents', 'claims', 'invoices', 'payments', 'journals', 'settlements', 'contracts', 'licenses', 'blocks', 'organizations', 'branches', 'users', 'memberships', 'couriers', 'partners', 'legs', 'notifications', 'approvalRequests', 'audit', 'costAllocations', 'gatewayMessages'];
function cell(lang: Lang, k: string, v: any): string {
  if (v == null) return '—';
  if (typeof v === 'object' && 'ar' in v && 'en' in v) return v[lang];
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  if (/At$|Date$|^periodFrom|^periodTo|validTo|validFrom|deviceTime|pickupWindowStart/.test(k) && typeof v === 'string') return fmtDateTime(lang, v);
  if (/^(total|subtotal|vat|paid|amount|calculated|approved|priceTotal|claimedAmount|monthlyFee)$/.test(k) && typeof v === 'number') return fmtSAR(lang, v);
  if (k === 'status' || k === 'state') { const d = (dict as any).shipmentStatus[v] ?? (dict as any).boxStatus[v] ?? (dict as any).deviceState[v] ?? (dict as any).invoiceStatus[v]; return d ? d[lang] : String(v); }
  if (k === 'thermalClass') return (dict.thermal as any)[v]?.[lang] ?? v;
  if (k === 'role') return t(lang, `roles.${v}`);
  return String(v);
}
function Explorer({ lang, as }: { lang: Lang; as: string }) {
  useTick();
  const [col, setCol] = useState<Collection>('shipments'); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [sort, setSort] = useState('createdAt'); const [dirn, setDirn] = useState<'asc' | 'desc'>('desc');
  useEffect(() => setPage(1), [col, q, as]);
  const res = (() => { try { return api.query(as, 'list', { collection: col, q, sort, dir: dirn, page, pageSize: 12 }); } catch (e: any) { return { items: [], total: 0, error: e }; } })();
  const all = (eng.db[col] as unknown[]).length;
  const keys = res.items[0] ? Object.keys(res.items[0]).filter((k) => !['lines', 'snapshot', 'template', 'payload', 'rules', 'evidence', 'shipmentIds'].includes(k)).slice(0, 8) : [];
  const pages = Math.max(1, Math.ceil(res.total / 12));
  return (
    <div className="stack">
      <div className="toolbar">
        <label className="fld"><span>{tx(lang, { ar: 'المجموعة', en: 'Collection' })}</span><select id="col" value={col} onChange={(e: any) => setCol(e.target.value)}>{COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="fld grow"><span>{t(lang, 'common.search')}</span><input id="q" value={q} onChange={(e: any) => setQ(e.target.value)} placeholder={tx(lang, { ar: 'رقم تتبع، رمز صندوق، اسم…', en: 'Tracking no., box code, name…' })} /></label>
        <div className="scope"><span>{tx(lang, UI.visible)}</span><b className="num">{fmtNumber(lang, res.total)}</b><span>{tx(lang, UI.of)} {fmtNumber(lang, all)}</span></div>
      </div>
      {res.error ? <div className="err">{res.error.message[lang]}</div> : res.total === 0 ? <div className="empty">{q ? t(lang, 'common.noResults') : tx(lang, { ar: 'لا يرى هذا الحساب أي سجل في هذه المجموعة — هذا هو العزل حسب الدور.', en: 'This account sees no records in this collection — that is role isolation at work.' })}</div> : (
        <div className="tablewrap"><table>
          <thead><tr>{keys.map((k) => <th key={k}><button className="th" onClick={() => { if (sort === k) setDirn(dirn === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDirn('asc'); } }}>{k}{sort === k ? (dirn === 'asc' ? ' ▲' : ' ▼') : ''}</button></th>)}</tr></thead>
          <tbody>{res.items.map((r: any, i: number) => <tr key={r.id ?? i}>{keys.map((k) => <td key={k} className={/id$|No$|imei|code/i.test(k) ? 'mono' : ''}>{cell(lang, k, r[k])}</td>)}</tr>)}</tbody>
        </table></div>
      )}
      <div className="pager"><button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t(lang, 'common.back')}</button><span>{t(lang, 'common.page')} {page} {t(lang, 'common.of')} {pages}</span><button className="btn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t(lang, 'common.next')}</button></div>
    </div>
  );
}

// ---------------- وحدة الأوامر ----------------
const TEMPLATES: Record<string, unknown> = {
  'shipment.quote': { organizationId: 'org_nkh', thermalClass: 'frozen', serviceLevel: 'stat', senderAddressId: 'adr_0001', receiverAddressId: 'adr_0014', weightKg: 3.5, dedicatedBox: true },
  'shipment.cancel': { id: 'ML-2026-000009', reason: 'تغيّر موعد سحب العينات' },
  'box.readinessCheck': { box: 'BX-CS-010', thermal: 'chilled' },
  'telemetry.injectDemo': { device: 'dev_002', tempC: 9.4 },
  'telemetry.simulateTick': {},
  'journal.createDraft': { description: 'قيد تجريبي', lines: [{ accountCode: '5400', debitSar: 250, creditSar: 0 }, { accountCode: '1100', debitSar: 0, creditSar: 200 }] },
  'simulation.run': { name: 'جوي +5%', adjustments: [{ thermalClass: 'all', pct: 5 }] },
  'compliance.runExpiryCheck': {}, 'delay.runRules': {}, 'cost.runAllocation': {},
  'retention.runArchive': { category: 'financial_records' },
  'gateway.simulateUnknown': { imei: '869999000000077', transport: 'tcp' },
  'lost.suspect': { shipment: 'ML-2026-000002', basis: ['gps_silence'], note: 'لا إشارة منذ ساعة' },
};
function Console({ lang, as }: { lang: Lang; as: string }) {
  const cmds = useMemo(() => listCommands().sort((a, b) => a.name.localeCompare(b.name)), []);
  const [kind, setKind] = useState<'command' | 'query'>('command');
  const [name, setName] = useState('shipment.quote');
  const [text, setText] = useState(JSON.stringify(TEMPLATES['shipment.quote'], null, 2));
  const [key, setKey] = useState(''); const [out, setOut] = useState<{ ok: boolean; v: unknown } | null>(null);
  const pick = (n: string) => { setName(n); setText(JSON.stringify(TEMPLATES[n] ?? (kind === 'query' ? (n === 'list' ? { collection: 'shipments', pageSize: 5 } : n.includes('detail') || n.includes('Report') ? { id: 'ML-2026-000001' } : {}) : {}), null, 2)); setOut(null); };
  const run = () => { let input: unknown; try { input = JSON.parse(text || '{}'); } catch { setOut({ ok: false, v: { code: 'MALFORMED_JSON', message: tx(lang, { ar: 'صيغة JSON غير صالحة', en: 'Malformed JSON' }) } }); return; }
    try { setOut({ ok: true, v: kind === 'command' ? eng.exec(name, as, input, key || undefined) : eng.query(name, as, input) }); } catch (e: any) { setOut({ ok: false, v: { code: e.code, status: e.status, message: e.detail?.[lang] ?? String(e), field: e.field } }); } };
  const desc = cmds.find((c) => c.name === name)?.desc;
  return (
    <div className="grid2">
      <div className="stack">
        <div className="seg" role="tablist">{(['command', 'query'] as const).map((k) => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); pick(k === 'command' ? 'shipment.quote' : 'controlTower.summary'); }}>{k === 'command' ? tx(lang, { ar: 'أوامر', en: 'Commands' }) : tx(lang, { ar: 'استعلامات', en: 'Queries' })}</button>)}</div>
        <label className="fld"><span>{kind === 'command' ? tx(lang, { ar: 'الأمر', en: 'Command' }) : tx(lang, { ar: 'الاستعلام', en: 'Query' })}</span>
          <select id="cmd" value={name} onChange={(e: any) => pick(e.target.value)}>{(kind === 'command' ? cmds.map((c) => c.name) : listQueries().map((q) => q.name).filter((n) => n !== 'meta.commands')).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        {desc && kind === 'command' && <p className="muted">{L(lang, desc)}</p>}
        <label className="fld"><span>{tx(lang, UI.input)}</span><textarea id="json" dir="ltr" rows={10} value={text} onChange={(e: any) => setText(e.target.value)} spellCheck={false} /></label>
        {kind === 'command' && <label className="fld"><span>{tx(lang, UI.idem)}</span><input id="idem" dir="ltr" value={key} onChange={(e: any) => setKey(e.target.value)} placeholder="e.g. 7f2c-…" /></label>}
        <div><button className="btn primary" onClick={run}>{tx(lang, UI.run)}</button></div>
      </div>
      <div className="stack" style={{ minWidth: 0 }}>
        <h3>{tx(lang, UI.result)}</h3>
        {!out ? <div className="empty">{tx(lang, { ar: 'اختر أمراً وشغّله. الصلاحيات تُطبق حسب الحساب المختار في الأعلى.', en: 'Pick a command and run it. Permissions follow the account selected at the top.' })}</div> : <div className={'outbox ' + (out.ok ? 'ok' : 'bad')}><Json v={out.v} /></div>}
      </div>
    </div>
  );
}

// ---------------- الثوابت ----------------
function Checks({ lang }: { lang: Lang }) {
  useTick();
  const db = eng.db;
  const tb: any = eng.query('ledger.trialBalance', 'usr_finance', {});
  const pairBox = new Map<string, number>(), pairDev = new Map<string, number>();
  db.pairings.filter((p) => !p.unpairedAt).forEach((p) => { pairBox.set(p.boxId, (pairBox.get(p.boxId) ?? 0) + 1); pairDev.set(p.deviceId, (pairDev.get(p.deviceId) ?? 0) + 1); });
  const packOpen = new Map<string, number>(); db.packings.filter((p) => !p.unpackedAt).forEach((p) => packOpen.set(p.shipmentId, (packOpen.get(p.shipmentId) ?? 0) + 1));
  const custFns = ['usr_corp_admin', 'usr_branch_op', 'usr_individual', 'usr_corp_finance'];
  const leaks = custFns.reduce((a, u) => { const act = actorFor(db, u)!; const orgs = new Set(act.memberships.map((m) => m.organizationId)); const items = (eng.query('list', u, { collection: 'shipments', pageSize: 500 }) as any).items; return a + items.filter((s: any) => !orgs.has(s.organizationId)).length; }, 0);
  const deliveredNoPod = db.shipments.filter((s) => s.status === 'delivered' && !db.pods.some((p) => p.shipmentId === s.id)).length;
  const deliveredNoCustody = db.shipments.filter((s) => s.status === 'delivered' && !db.custody.some((c) => c.shipmentId === s.id && c.eventType === 'delivery')).length;
  const settledTwice = (() => { const seen = new Set<string>(); let d = 0; db.settlements.forEach((s) => s.lines.forEach((l) => { if (seen.has(l.legId)) d++; seen.add(l.legId); })); return d; })();
  const paidUnapproved = db.settlements.filter((s) => s.status === 'paid' && !s.approvedBy).length;
  const lostOneApproval = db.shipments.filter((s) => s.lostState === 'declared' && new Set(db.approvals.filter((a) => a.subjectId === s.id && a.decision === 'approve').map((a) => a.approvalRole)).size < 2).length;
  const fabricated = db.readings.filter((r) => !r.demo).length;
  const rows: [string, { ar: string; en: string }, boolean, string][] = [
    ['FIN-005 / DB-AT-005', { ar: 'كل القيود المرحّلة متوازنة', en: 'Every posted journal balances' }, tb.balanced, `${fmtSAR(lang, tb.totalDebit)} = ${fmtSAR(lang, tb.totalCredit)}`],
    ['FIN-004', { ar: 'حساب الذمم المدينة يطابق دفتر العملاء الفرعي', en: 'AR control account matches the customer subledger' }, tb.arReconciled, fmtSAR(lang, tb.arControl)],
    ['BR-002 / E1', { ar: 'اقتران نشط واحد لكل صندوق ولكل جهاز', en: 'One active pairing per box and per device' }, [...pairBox.values(), ...pairDev.values()].every((n) => n === 1), `${pairBox.size} / ${pairDev.size}`],
    ['E3', { ar: 'لا شحنة معبأة في صندوقين معاً', en: 'No shipment packed in two boxes at once' }, [...packOpen.values()].every((n) => n === 1), String(packOpen.size)],
    ['UAT-001 / UAT-002', { ar: 'لا تسرّب شحنات بين العملاء في القوائم', en: 'No shipment leakage between customers in lists' }, leaks === 0, String(leaks)],
    ['BR-005', { ar: 'كل شحنة مسلّمة لها حدث حيازة تسليم', en: 'Every delivered shipment has a delivery custody event' }, deliveredNoCustody === 0, String(deliveredNoCustody)],
    ['SHP-005', { ar: 'كل شحنة مسلّمة لها إثبات تسليم', en: 'Every delivered shipment has a proof of delivery' }, deliveredNoPod === 0, String(deliveredNoPod)],
    ['PST / NFR-007', { ar: 'لا خدمة مسوّاة مرتين ولا دفع قبل الاعتماد', en: 'No service settled twice; no payment before approval' }, settledTwice === 0 && paidUnapproved === 0, `${settledTwice} / ${paidUnapproved}`],
    ['LDM / E7', { ar: 'كل إعلان فقدان باعتمادين (عمليات + جودة)', en: 'Every loss declaration has both approvals' }, lostOneApproval === 0, String(lostOneApproval)],
    ['TEMP-002', { ar: 'كل القراءات مُعلَّمة كبيانات عرض', en: 'All readings are labelled as demo data' }, fabricated === 0, `${fmtNumber(lang, db.readings.length)}`],
  ];
  void deviceOfBox;
  return (
    <div className="stack">
      <p className="muted">{tx(lang, { ar: 'تُحسب هذه الفحوص لحظياً على الحالة الحالية. شغّل سيناريوهات أو أوامر ثم عُد إليها.', en: 'These checks run live against the current state. Run scenarios or commands, then come back.' })}</p>
      <div className="tablewrap"><table>
        <thead><tr><th>{tx(lang, { ar: 'المرجع', en: 'Ref' })}</th><th>{tx(lang, { ar: 'الثابت', en: 'Invariant' })}</th><th>{t(lang, 'common.status')}</th><th>{tx(lang, { ar: 'القيمة', en: 'Value' })}</th></tr></thead>
        <tbody>{rows.map(([ref, label, ok, val]) => <tr key={ref}><td className="mono">{ref}</td><td>{label[lang]}</td><td><span className={'pill ' + (ok ? 'good' : 'crit')}>{ok ? tx(lang, { ar: 'متحقق', en: 'Holds' }) : tx(lang, { ar: 'مخالف', en: 'Violated' })}</span></td><td className="num">{val}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

// ---------------- الأحداث ----------------
function Events({ lang, log }: { lang: Lang; log: { at: string; command?: string; types: string[] }[] }) {
  if (!log.length) return <div className="empty">{tx(lang, UI.noEvents)}</div>;
  return <ol className="evlog">{log.map((e, i) => <li key={i}><time>{fmtRelative(lang, e.at)}</time><code>{e.command}</code><span>{e.types.map((x, k) => <code key={k} className="ev">{x}</code>)}</span></li>)}</ol>;
}

// ---------------- التطبيق ----------------
function App() {
  const [lang, setLang] = useState<Lang>(() => { try { return (localStorage.getItem('al-lang') as Lang) || 'ar'; } catch { return 'ar'; } });
  const [as, setAs] = useState('usr_ops');
  const [tab, setTab] = useState(() => (['overview', 'scenarios', 'data', 'console', 'checks', 'events'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview'));
  const [confirm, setConfirm] = useState(false); const [toast, setToast] = useState<string | null>(null);
  const [log, setLog] = useState<{ at: string; command?: string; types: string[] }[]>([]);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = dir(lang); try { localStorage.setItem('al-lang', lang); } catch { /* */ } }, [lang]);
  useEffect(() => tr.subscribe((e) => setLog((l: any[]) => [{ at: e.at, command: e.command, types: e.events.map((x) => x.type) }, ...l].slice(0, 80))), []);
  useEffect(() => { const h = () => setTab(location.hash.slice(1) || 'overview'); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const go = (k: string) => { setTab(k); try { history.replaceState(null, '', '#' + k); } catch { /* */ } };
  const db = eng.db;
  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect x="3" y="7" width="26" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M3 12h26" stroke="currentColor" strokeWidth="2" /><path d="M16 16v7M13 19.5h6" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" /></svg>
          <div><b>{t(lang, 'app.name')}</b><span>{tx(lang, UI.title)}</span></div></div>
        <span className="badge">{t(lang, 'app.demoBadge')} · {t(lang, 'app.simulated')}</span>
        <div className="grow" />
        <label className="fld inline"><span>{tx(lang, UI.actingAs)}</span>
          <select id="acct" value={as} onChange={(e: any) => setAs(e.target.value)}>{ACCOUNTS.map((g) => <optgroup key={g.group.en} label={g.group[lang]}>{g.items.map((u) => <option key={u} value={u}>{userName(db, u, lang)} — {roleOf(db, u, lang)}</option>)}</optgroup>)}</select></label>
        <button className="btn ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label={t(lang, 'common.language')}>{t(lang, 'common.switchLang')}</button>
        {confirm ? <span className="confirm"><span>{tx(lang, UI.resetQ)}</span><button className="btn danger" onClick={async () => { await tr.reset(); setConfirm(false); setLog([]); setToast(tx(lang, UI.resetDone)); setTimeout(() => setToast(null), 2500); }}>{t(lang, 'common.confirm')}</button><button className="btn ghost" onClick={() => setConfirm(false)}>{t(lang, 'common.cancel')}</button></span>
          : <button className="btn ghost" onClick={() => setConfirm(true)}>{t(lang, 'common.resetDemo')}</button>}
      </header>
      <nav className="tabs" role="tablist">{(Object.keys(UI.tabs) as (keyof typeof UI.tabs)[]).map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{tx(lang, UI.tabs[k])}{k === 'events' && log.length ? <span className="count">{log.length}</span> : null}</button>)}</nav>
      <main className="main">
        {tab === 'overview' && <Overview lang={lang} as={as} />}
        {tab === 'scenarios' && <Scenarios lang={lang} setAs={setAs} />}
        {tab === 'data' && <Explorer lang={lang} as={as} />}
        {tab === 'console' && <Console lang={lang} as={as} />}
        {tab === 'checks' && <Checks lang={lang} />}
        {tab === 'events' && <Events lang={lang} log={log} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
