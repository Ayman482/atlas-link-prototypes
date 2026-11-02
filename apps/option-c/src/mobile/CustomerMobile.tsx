'use client';
// معاينة تطبيق العميل للجوال — الخيار A (CM01–CM12). نفس المحرك والبيانات؛ تطبيق Flutter الفعلي في mobile/customer_app
import React, { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp, useList, useQ, useRoute, go } from '@/lib/store';
import { Btn, Empty, ErrorBox, Loading, Mono, Pill, Sim, TempChart, label, useFmt } from '@/lib/ui';
import { CUSTOMER_APP_ACCOUNTS } from '@/lib/accounts';
import { ActionForm, localNow, opts, useLookups } from '@/admin/common';
import { ICONS, MTabs, MTop, MobileLogin, PhoneStage, celebrate } from './kit';

export const CM_SCREENS = [
  { id: 'CM01', ar: 'الدخول والتحقق الثنائي', en: 'Sign-in & MFA' }, { id: 'CM02', ar: 'الرئيسية', en: 'Home' }, { id: 'CM03', ar: 'قائمة الشحنات', en: 'Shipments list' },
  { id: 'CM04', ar: 'طلب شحنة مع عرض السعر', en: 'New shipment with quote' }, { id: 'CM05', ar: 'تتبع الشحنة والخط الزمني', en: 'Tracking & timeline' }, { id: 'CM06', ar: 'تقرير الحرارة', en: 'Temperature report' },
  { id: 'CM07', ar: 'إعادة جدولة / إلغاء / إرجاع', en: 'Reschedule / cancel / return' }, { id: 'CM08', ar: 'الإشعارات', en: 'Notifications' }, { id: 'CM09', ar: 'الفواتير والدفع', en: 'Invoices & payment' },
  { id: 'CM10', ar: 'المطالبات', en: 'Claims' }, { id: 'CM11', ar: 'العناوين المحفوظة', en: 'Saved addresses' }, { id: 'CM12', ar: 'الحساب والإعدادات', en: 'Account & settings' },
];
const ALLOWED = ['corp_admin', 'branch_manager', 'branch_operator', 'branch_viewer', 'corp_finance', 'individual'];

export default function CustomerMobileRoot() { return <AppProvider app="customer"><Stage /></AppProvider>; }
function Stage() { const { lang } = useApp(); return <PhoneStage title={lang === 'ar' ? 'تطبيق العميل' : 'Customer app'} screens={CM_SCREENS} flutterPath="mobile/customer_app"><Gate /></PhoneStage>; }
function Gate() {
  const { userId, me, lang, signOut } = useApp();
  useEffect(() => { if (me && !me.roles.some((r: string) => ALLOWED.includes(r))) signOut(); }, [me, signOut]);
  if (!userId) return <MobileLogin title={lang === 'ar' ? 'أطلس لينك — العميل' : 'Atlas Link — Customer'} accounts={CUSTOMER_APP_ACCOUNTS} allowed={(r) => r.some((x) => ALLOWED.includes(x))} />;
  if (!me) return <Loading />;
  return <App />;
}

function App() {
  const { me } = useApp(); const { parts, path } = useRoute();
  const n = useList('notifications'); const unread = (n.data?.items ?? []).filter((x: any) => !x.readAt).length;
  const fin = me.roles.some((r: string) => ['corp_admin', 'corp_finance', 'individual'].includes(r));
  let s: React.ReactNode;
  if (path === '/new') s = <NewShipment />;
  else if (parts[0] === 's' && parts[2] === 'temp') s = <Temp id={parts[1]} />;
  else if (parts[0] === 's' && parts[1]) s = <Track id={parts[1]} />;
  else if (path === '/shipments') s = <List />;
  else if (path === '/notifications') s = <Notifs />;
  else if (path === '/invoices') s = fin ? <Invoices /> : <Denied />;
  else if (path === '/claims') s = <Claims />;
  else if (path === '/addresses') s = <Addresses />;
  else if (path === '/account') s = <Account />;
  else s = <Home />;
  return <>{s}<MTabs items={[{ path: '/', ar: 'الرئيسية', en: 'Home', icon: ICONS.home }, { path: '/shipments', ar: 'شحناتي', en: 'Shipments', icon: ICONS.box }, { path: '/new', ar: 'طلب', en: 'Request', icon: ICONS.plus }, { path: '/notifications', ar: 'الإشعارات', en: 'Alerts', icon: ICONS.bell, badge: unread }, { path: '/account', ar: 'حسابي', en: 'Account', icon: ICONS.user }]} /></>;
}
function Denied() { const { lang } = useApp(); return <><MTop title="—" back="/" /><div className="mbodyx"><div className="state err">{lang === 'ar' ? 'غير متاح لدورك' : 'Not available to your role'}</div></div></>; }
const canCreate = (r: string[]) => r.some((x) => ['corp_admin', 'branch_manager', 'branch_operator', 'individual'].includes(x));

function ShipCard({ s }: { s: any }) {
  const { lang } = useApp(); const f = useFmt(); const L = useLookups();
  const H = ['delivered'].includes(s.status) ? 'var(--c-green)' : ['failed', 'exception'].includes(s.status) ? 'var(--c-pink)' : ['in_transit', 'collected', 'at_handover'].includes(s.status) ? 'var(--c-cyan)' : 'var(--c-violet)';
  return <a className="mcard hue" style={{ '--h': H } as React.CSSProperties} href={'#/s/' + s.id}><div className="row" style={{ justifyContent: 'space-between' }}><Mono>{s.trackingNo}</Mono><Pill v={s.status} /></div><span>{L.city(s.originCity)} {lang === 'ar' ? '←' : '→'} {L.city(s.destCity)} · {label(lang, s.thermalClass)}</span><span className="muted">{lang === 'ar' ? 'التسليم قبل' : 'Deliver by'} {f.dt(s.deliverBy)}</span></a>;
}

// CM02
function Home() {
  const { lang, x, me } = useApp(); const d = useQ<any>('customer.dashboard', {});
  return <><MTop title={lang === 'ar' ? `أهلاً ${x(me.user.name).split(' ')[0]}` : `Hi ${x(me.user.name).split(' ')[0]}`} right={<Sim />} />
    <div className="mbodyx">
      {d.error && <ErrorBox error={d.error} />}{!d.data && !d.error && <Loading />}
      {d.data && <>
        <div className="mkpis"><div><b>{d.data.totals.active}</b><span>{lang === 'ar' ? 'نشطة' : 'Active'}</span></div><div><b>{d.data.totals.delivered}</b><span>{lang === 'ar' ? 'مسلّمة' : 'Delivered'}</span></div><div><b>{d.data.totals.onTimePct ?? '—'}</b><span>{lang === 'ar' ? 'في الوقت %' : 'On time %'}</span></div></div>
        {canCreate(me.roles) && <a className="btn primary bigbtn" href="#/new">{lang === 'ar' ? 'طلب استلام جديد' : 'Request a pickup'}</a>}
        <b>{lang === 'ar' ? 'آخر الشحنات' : 'Recent shipments'}</b>
        {d.data.recent.length ? d.data.recent.slice(0, 5).map((s: any) => <ShipCard key={s.id} s={s} />) : <Empty />}
        {d.data.openInvoices.length > 0 && <a className="mcard" href="#/invoices"><b>{lang === 'ar' ? 'فواتير مستحقة' : 'Open invoices'}: {d.data.openInvoices.length}</b></a>}
        <div className="row" style={{ gap: 8 }}><a className="btn" href="#/claims">{lang === 'ar' ? 'المطالبات' : 'Claims'}</a><a className="btn" href="#/addresses">{lang === 'ar' ? 'العناوين' : 'Addresses'}</a>{me.roles.some((r: string) => ['corp_admin', 'corp_finance', 'individual'].includes(r)) && <a className="btn" href="#/invoices">{lang === 'ar' ? 'الفواتير' : 'Invoices'}</a>}</div>
      </>}
    </div></>;
}

// CM03
function List() {
  const { lang } = useApp(); const s = useList('shipments', { sort: 'createdAt', dir: 'desc' }); const [f, setF] = useState('active'); const [q, setQ] = useState('');
  const groups: Record<string, string[]> = { active: ['confirmed', 'pickup_scheduled', 'collected', 'in_transit', 'at_handover', 'exception', 'failed', 'return_pending'], done: ['delivered', 'returned'], other: ['draft', 'cancelled', 'lost'] };
  const rows = (s.data?.items ?? []).filter((r: any) => groups[f].includes(r.status) && (!q || r.trackingNo.toLowerCase().includes(q.toLowerCase())));
  return <><MTop title={lang === 'ar' ? 'شحناتي' : 'My shipments'} />
    <div className="mbodyx">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'ar' ? 'رقم التتبع' : 'Tracking no.'} dir="ltr" />
      <div className="seg" role="tablist">{[['active', 'نشطة', 'Active'], ['done', 'مكتملة', 'Completed'], ['other', 'أخرى', 'Other']].map(([k, a, e]) => <button key={k} role="tab" aria-selected={f === k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{lang === 'ar' ? a : e}</button>)}</div>
      {!s.data ? <Loading /> : rows.length ? rows.map((r: any) => <ShipCard key={r.id} s={r} />) : <Empty />}
    </div></>;
}

// CM04
function NewShipment() {
  const { lang, x, me, run, t } = useApp(); const L = useLookups(); const f = useFmt();
  const orgId = me.organizations?.[0]?.id;
  const brs = L.branches.filter((b: any) => b.organizationId === orgId);
  const addrs = L.addresses.filter((a: any) => a.organizationId === orgId);
  const [step, setStep] = useState(0); const [quote, setQuote] = useState<any>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [v, setV] = useState<any>({ branchId: '', senderAddressId: '', receiverAddressId: '', thermalClass: 'chilled', serviceLevel: 'standard', start: localNow(1), end: localNow(3), qty: 2, weightKg: 1, code: 'BLOOD_TUBES' });
  useEffect(() => { if (!v.branchId && brs.length === 1) setV((o: any) => ({ ...o, branchId: brs[0].id })); }, [brs.length]); // eslint-disable-line
  if (!canCreate(me.roles)) return <Denied />;
  const set = (k: string, val: any) => { setV({ ...v, [k]: val }); setQuote(null); };
  const base = () => ({ organizationId: orgId, senderAddressId: v.senderAddressId, receiverAddressId: v.receiverAddressId, thermalClass: v.thermalClass, serviceLevel: v.serviceLevel, weightKg: Number(v.weightKg) });
  const next = async () => {
    setErr(null);
    if (step === 0) { if (!v.senderAddressId || !v.receiverAddressId) return setErr(lang === 'ar' ? 'اختر عنوان الاستلام والتسليم' : 'Choose pickup and delivery addresses'); if (v.senderAddressId === v.receiverAddressId) return setErr(lang === 'ar' ? 'العنوانان متطابقان' : 'Addresses are identical'); if (brs.length && !v.branchId && !me.roles.includes('individual') && !me.roles.includes('corp_admin')) return setErr(lang === 'ar' ? 'اختر الفرع' : 'Choose a branch'); }
    if (step === 1) { if (!(Number(v.qty) >= 1)) return setErr(lang === 'ar' ? 'الكمية 1 على الأقل' : 'Quantity ≥ 1'); if (!(Number(v.weightKg) > 0)) return setErr(lang === 'ar' ? 'الوزن مطلوب' : 'Weight required'); }
    if (step === 2) { if (!v.start || !v.end || v.end <= v.start) return setErr(lang === 'ar' ? 'نافذة الاستلام غير صحيحة' : 'Invalid pickup window'); setBusy(true); try { setQuote(await run('shipment.quote', base(), { silent: true })); } catch (e: any) { setErr(e.message?.[lang]); setBusy(false); return; } setBusy(false); }
    setStep(step + 1);
  };
  const submit = async () => { setBusy(true); try { const s: any = await run('shipment.create', { ...base(), branchId: v.branchId || null, receiverOrgId: (() => { const ra = L.addr(v.receiverAddressId); return ra?.organizationId && ra.organizationId !== orgId ? ra.organizationId : null; })(), pickupWindowStart: v.start, pickupWindowEnd: v.end, items: [{ descriptionCode: v.code, quantity: Number(v.qty), weightKg: Number(v.weightKg) }], submit: true }, { success: lang === 'ar' ? 'تم إنشاء الطلب' : 'Request created' }); celebrate(); go('/s/' + s.id); } catch (e: any) { setErr(e.message?.[lang]); } finally { setBusy(false); } };
  const steps = [t('ship.stepRoute'), t('ship.stepSample'), t('ship.stepSchedule'), t('ship.stepReview')];
  const Sel = ({ k, l, o }: { k: string; l: string; o: { value: string; label: string }[] }) => <label className="field"><span>{l}</span><select value={v[k]} onChange={(e) => set(k, e.target.value)}><option value="">—</option>{o.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}</select></label>;
  return <><MTop title={t('ship.create')} back={step ? undefined : '/'} right={<span className="muted">{step + 1}/4</span>} />
    <div className="mbodyx">
      <div className="steps">{steps.map((s, i) => <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</span>)}</div>
      {err && <div className="state err" role="alert">{err}</div>}
      {step === 0 && <>
        {brs.length > 0 && Sel({ k: "branchId", l: (lang === 'ar' ? 'الفرع' : 'Branch'), o: (brs.map((b: any) => ({ value: b.id, label: x(b.name) }))) })}
        {Sel({ k: "senderAddressId", l: (lang === 'ar' ? 'من (الاستلام)' : 'From (pickup)'), o: (addrs.map((a: any) => ({ value: a.id, label: `${x(a.label)} — ${L.city(a.cityCode)}` }))) })}
        {Sel({ k: "receiverAddressId", l: (lang === 'ar' ? 'إلى (المختبر المستلم)' : 'To (receiving lab)'), o: (L.addresses.map((a: any) => ({ value: a.id, label: `${x(a.label)} — ${L.city(a.cityCode)}` }))) })}
      </>}
      {step === 1 && <>
        {Sel({ k: "code", l: (lang === 'ar' ? 'نوع العينة' : 'Sample type'), o: (['BLOOD_TUBES', 'SWAB_PCR', 'URINE_CULTURE', 'TISSUE_BIOPSY', 'SERUM_ALIQUOT', 'CSF_SAMPLE'].map((c) => ({ value: c, label: label(lang, c) }))) })}
        {Sel({ k: "thermalClass", l: (lang === 'ar' ? 'الفئة الحرارية' : 'Thermal class'), o: (['chilled', 'frozen', 'ambient'].map((c) => ({ value: c, label: label(lang, c) }))) })}
        {Sel({ k: "serviceLevel", l: (lang === 'ar' ? 'مستوى الخدمة' : 'Service level'), o: (['standard', 'express', 'stat'].map((c) => ({ value: c, label: label(lang, c) }))) })}
        <div className="row"><label className="field" style={{ flex: 1 }}><span>{lang === 'ar' ? 'العدد' : 'Qty'}</span><input type="number" min={1} value={v.qty} onChange={(e) => set('qty', e.target.value)} /></label><label className="field" style={{ flex: 1 }}><span>{lang === 'ar' ? 'الوزن كغ' : 'Weight kg'}</span><input type="number" min={0.1} step={0.1} value={v.weightKg} onChange={(e) => set('weightKg', e.target.value)} /></label></div>
      </>}
      {step === 2 && <>
        <label className="field"><span>{lang === 'ar' ? 'بداية نافذة الاستلام' : 'Pickup window start'}</span><input type="datetime-local" value={v.start} onChange={(e) => set('start', e.target.value)} /></label>
        <label className="field"><span>{lang === 'ar' ? 'نهاية النافذة' : 'Window end'}</span><input type="datetime-local" value={v.end} onChange={(e) => set('end', e.target.value)} /></label>
      </>}
      {step === 3 && quote && <div className="mcard">
        <b>{lang === 'ar' ? 'عرض السعر' : 'Quote'} <Mono>{quote.quoteNo}</Mono></b>
        {([['base', 'السعر الأساسي', 'Base'], ['weight', 'رسوم الوزن', 'Weight'], ['levelSurcharge', 'رسوم مستوى الخدمة', 'Service level'], ['dedicatedBox', 'صندوق مخصص', 'Dedicated box']] as const).filter(([k]) => quote.snapshot[k]).map(([k, a, e]) => <div key={k} className="row" style={{ justifyContent: 'space-between' }}><span>{lang === 'ar' ? a : e}{k === 'base' && quote.snapshot.coveredByContract && <> ({lang === 'ar' ? 'مشمول' : 'covered'})</>}</span><span>{k === 'base' && quote.snapshot.coveredByContract ? <s>{f.sar(quote.snapshot[k])}</s> : f.sar(quote.snapshot[k])}</span></div>)}
        <div className="row" style={{ justifyContent: 'space-between' }}><span>{lang === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</span><span>{f.sar(quote.snapshot.vat)}</span></div>
        <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}><span>{lang === 'ar' ? 'الإجمالي' : 'Total'}</span><span>{f.sar(quote.total)}</span></div>
        {quote.snapshot.coveredByContract && <Pill tone="good">{lang === 'ar' ? 'مشمولة بالعقد' : 'Covered by contract'}</Pill>}
      </div>}
      <div className="row" style={{ marginTop: 'auto' }}>
        {step > 0 && <Btn onClick={() => { setErr(null); setStep(step - 1); }}>{t('common.back')}</Btn>}
        {step < 3 ? <Btn kind="primary" className="bigbtn" style={{ flex: 1 }} disabled={busy} onClick={next}>{lang === 'ar' ? 'التالي' : 'Next'}</Btn> : <Btn kind="primary" className="bigbtn" style={{ flex: 1 }} disabled={busy} onClick={submit}>{lang === 'ar' ? 'تأكيد الطلب' : 'Confirm request'}</Btn>}
      </div>
    </div></>;
}

// CM05 + CM07
function Track({ id }: { id: string }) {
  const { lang, x, t, me } = useApp(); const f = useFmt(); const L = useLookups(); const d = useQ<any>('shipment.detail', { id });
  if (d.error) return <><MTop title="—" back="/shipments" /><div className="mbodyx"><ErrorBox error={d.error} /></div></>;
  if (!d.data) return <Loading />;
  const s = d.data.shipment; const tr = d.data.tracking;
  const owner = me.organizations?.some((o: any) => o.id === s.organizationId) && canCreate(me.roles);
  const reasons = [{ value: 'RECIPIENT_UNAVAILABLE', ar: 'المستلم غير متاح', en: 'Recipient unavailable' }, { value: 'ADDRESS_ISSUE', ar: 'مشكلة في العنوان', en: 'Address issue' }, { value: 'CUSTOMER_REQUEST', ar: 'طلب العميل', en: 'Customer request' }];
  const steps = ['confirmed', 'pickup_scheduled', 'collected', 'in_transit', 'delivered']; const idx = steps.indexOf(s.status === 'at_handover' ? 'in_transit' : s.status);
  return <><MTop title={<Mono>{s.trackingNo}</Mono>} back="/shipments" right={<Pill v={s.status} />} />
    <div className="mbodyx">
      <div className="progress">{steps.map((k, i) => <span key={k} className={i <= idx ? 'on' : ''} title={label(lang, k)} />)}</div>
      <div className="mcard"><span>{x(d.data.sender?.label)} {lang === 'ar' ? '←' : '→'} {x(d.data.receiver?.label)}</span><span className="muted">{L.city(s.originCity)} {lang === 'ar' ? '←' : '→'} {L.city(s.destCity)} · {label(lang, s.thermalClass)} · {label(lang, s.serviceLevel)} · {label(lang, s.mode)}</span>
        <span>{lang === 'ar' ? 'الوصول المتوقع' : 'ETA'}: <b>{s.eta?.at ? f.dt(s.eta.at) : '—'}</b> {s.eta && <Pill tone={s.eta.confidence === 'high' ? 'good' : s.eta.confidence === 'unavailable' ? 'mute' : 'warn'}>{label(lang, s.eta.confidence)}</Pill>}</span>
        {tr?.lastConfirmedPosition && <span className="muted">{lang === 'ar' ? 'آخر موقع مؤكد' : 'Last confirmed position'}: {f.dt(tr.lastConfirmedPosition.at)} ({label(lang, tr.lastConfirmedPosition.source)}){!tr.lastConfirmedPosition.isLive && <> · {lang === 'ar' ? 'ليس مباشراً' : 'not live'}</>}</span>}
        {tr?.lastReading && <span>{lang === 'ar' ? 'آخر حرارة' : 'Last temp'}: <b dir="ltr">{tr.lastReading.tempC ?? '—'}°C</b> · {f.dt(tr.lastReading.deviceTime)} · {label(lang, tr.freshness)} <Sim /></span>}
      </div>
      <a className="btn bigbtn" href={`#/s/${s.id}/temp`}>{lang === 'ar' ? 'تقرير الحرارة' : 'Temperature report'}</a>
      {d.data.pod && <div className="mcard"><b>{t('ship.pod')}</b><span>{d.data.pod.recipientName} · {f.dt(d.data.pod.deliveredAt)}</span>{d.data.pod.signature?.startsWith('data:image') && <img src={d.data.pod.signature} alt="signature" style={{ maxWidth: 160, background: '#fff', borderRadius: 6 }} />}</div>}
      {owner && <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {['draft', 'confirmed', 'pickup_scheduled'].includes(s.status) && <ActionForm label={t('ship.reschedule')} title={t('ship.reschedule')} cmd="shipment.reschedule" initial={{ pickupWindowStart: localNow(2), pickupWindowEnd: localNow(4) }} fields={[{ name: 'pickupWindowStart', label: lang === 'ar' ? 'البداية' : 'Start', type: 'datetime', required: true }, { name: 'pickupWindowEnd', label: lang === 'ar' ? 'النهاية' : 'End', type: 'datetime', required: true }]} map={(v) => ({ id: s.id, ...v })} />}
        {['draft', 'confirmed', 'pickup_scheduled'].includes(s.status) && <ActionForm kind="danger" danger label={t('ship.cancelShipment')} title={t('ship.cancelShipment')} cmd="shipment.cancel" intro={lang === 'ar' ? 'لا يمكن الإلغاء قبل أقل من ساعة من الاستلام.' : 'Cannot cancel within one hour of pickup.'} fields={[{ name: 'reason', label: t('common.reason'), type: 'textarea', required: true }]} map={(v) => ({ id: s.id, reason: v.reason, version: s.version })} />}
        {['failed', 'in_transit', 'at_handover', 'exception'].includes(s.status) && <ActionForm label={t('ship.requestReturn')} title={t('ship.requestReturn')} cmd="returns.request" fields={[{ name: 'reasonCode', label: t('common.reason'), type: 'select', required: true, options: opts(lang, reasons) }]} map={(v) => ({ shipment: s.id, reasonCode: v.reasonCode })} />}
        {s.status !== 'draft' && <ActionForm label={t('ship.fileClaim')} title={t('ship.fileClaim')} cmd="claim.submit" fields={[{ name: 'claimType', label: lang === 'ar' ? 'النوع' : 'Type', type: 'select', required: true, options: opts(lang, [{ value: 'damage', ar: 'تلف', en: 'Damage' }, { value: 'loss', ar: 'فقدان', en: 'Loss' }, { value: 'delay', ar: 'تأخير', en: 'Delay' }, { value: 'temperature', ar: 'حرارة', en: 'Temperature' }]) }, { name: 'amountSar', label: lang === 'ar' ? 'المبلغ (ر.س)' : 'Amount (SAR)', type: 'number', required: true, min: 1 }, { name: 'description', label: lang === 'ar' ? 'الوصف' : 'Description', type: 'textarea', required: true }]} map={(v) => ({ shipment: s.id, ...v })} success={lang === 'ar' ? 'قُدمت المطالبة' : 'Claim submitted'} />}
      </div>}
      <b>{lang === 'ar' ? 'الخط الزمني' : 'Timeline'}</b>
      <ol className="mtimeline">{[...d.data.timeline].reverse().map((e: any, i: number) => <li key={i}><b>{x(e.title)}</b><span className="muted">{f.dt(e.at)} · {label(lang, e.source)}</span></li>)}</ol>
    </div></>;
}

// CM06
function Temp({ id }: { id: string }) {
  const { lang, x } = useApp(); const f = useFmt(); const r = useQ<any>('shipment.temperatureReport', { id });
  return <><MTop title={lang === 'ar' ? 'تقرير الحرارة' : 'Temperature report'} back={'/s/' + id} />
    <div className="mbodyx">{r.error && <ErrorBox error={r.error} />}{!r.data && !r.error && <Loading />}{r.data && <>
      <div className="notice warn">{x(r.data.disclaimer)}</div>
      <div className="mcard"><b>{x(r.data.profile.name)} <span dir="ltr">({r.data.profile.minC}…{r.data.profile.maxC}°C)</span></b><span>{lang === 'ar' ? 'قراءات' : 'Readings'}: {r.data.summary.count} · {lang === 'ar' ? 'ضمن النطاق' : 'In range'}: {r.data.summary.inRangePct ?? '—'}% · {lang === 'ar' ? 'فجوات' : 'Gaps'}: {r.data.summary.gapMinutes} {lang === 'ar' ? 'د' : 'min'}</span></div>
      <TempChart report={r.data} height={200} />
      {r.data.gaps.map((g: any, i: number) => <div key={i} className="mcard"><b>{lang === 'ar' ? 'فجوة' : 'Gap'} {g.minutes} {lang === 'ar' ? 'دقيقة' : 'min'}</b><span className="muted">{f.dt(g.from)} {lang === 'ar' ? '←' : '→'} {f.dt(g.to)}</span><span>{x(g.reason)}</span></div>)}
      {r.data.excursions.map((e: any, i: number) => <div key={'e' + i} className="mcard"><b>{lang === 'ar' ? 'انحراف' : 'Excursion'} <Pill v={e.severity} /></b><span dir="ltr">{e.peakC}°C · {f.dt(e.startedAt)}</span><Pill v={e.status} /></div>)}
    </>}</div></>;
}

// CM08
function Notifs() {
  const { lang, x, run } = useApp(); const f = useFmt(); const n = useList('notifications', { sort: 'createdAt', dir: 'desc' });
  const rows = n.data?.items ?? [];
  return <><MTop title={lang === 'ar' ? 'الإشعارات' : 'Notifications'} right={rows.length > 0 && <Btn kind="ghost" onClick={() => run('notification.markAllRead', { ids: rows.map((r: any) => r.id) }, { silent: true })}>{lang === 'ar' ? 'قراءة الكل' : 'Read all'}</Btn>} />
    <div className="mbodyx">{!n.data ? <Loading /> : rows.length ? rows.map((r: any) => <button key={r.id} className="mcard" style={{ textAlign: 'start', cursor: 'pointer', fontWeight: r.readAt ? 400 : 600 }} onClick={() => { run('notification.markRead', { id: r.id }, { silent: true }); const m = r.link?.match(/^\/(?:shipments|inbound)\/(.+)$/); if (m) go('/s/' + m[1]); else if (r.link?.startsWith('/invoices')) go('/invoices'); }}><span>{x(r.title)} {r.critical && <Pill tone="crit">!</Pill>}</span><span className="muted" style={{ fontWeight: 400 }}>{x(r.body)} · {f.dt(r.createdAt)}</span></button>) : <Empty />}</div></>;
}

// CM09
function Invoices() {
  const { lang, run } = useApp(); const f = useFmt(); const i = useList('invoices', { sort: 'issueDate', dir: 'desc' }); const [pay, setPay] = useState<any>(null); const [fail, setFail] = useState(false);
  return <><MTop title={lang === 'ar' ? 'الفواتير' : 'Invoices'} back="/" right={<Sim />} />
    <div className="mbodyx">{!i.data ? <Loading /> : i.data.items.length ? i.data.items.map((v: any) => { const due = v.total - v.paid; return <div key={v.id} className="mcard"><div className="row" style={{ justifyContent: 'space-between' }}><Mono>{v.invoiceNo}</Mono><Pill v={v.status} /></div><span>{lang === 'ar' ? 'الإجمالي' : 'Total'} {f.sar(v.total)} · {lang === 'ar' ? 'المتبقي' : 'Due'} <b>{f.sar(due)}</b></span><span className="muted">{lang === 'ar' ? 'الاستحقاق' : 'Due date'} {f.dt(v.dueDate)}</span>{due > 0 && ['issued', 'partially_paid', 'overdue'].includes(v.status) && (pay?.id === v.id ? <div className="page" style={{ gap: 6 }}><label className="check"><input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> {lang === 'ar' ? 'محاكاة رفض البطاقة' : 'Simulate declined card'}</label><Btn kind="primary" onClick={async () => { try { await run('customer.payInvoice', { invoiceId: v.id, method: 'card_simulated', simulateFailure: fail }, { success: lang === 'ar' ? 'تم الدفع (محاكاة)' : 'Paid (simulated)' }); setPay(null); } catch { /* toast */ } }}>{lang === 'ar' ? `ادفع ${f.sar(due)} — مدى (محاكاة)` : `Pay ${f.sar(due)} — mada (simulated)`}</Btn></div> : <Btn kind="primary" onClick={() => { setPay(v); setFail(false); }}>{lang === 'ar' ? 'ادفع الآن' : 'Pay now'}</Btn>)}</div>; }) : <Empty />}</div></>;
}

// CM10
function Claims() {
  const { lang } = useApp(); const f = useFmt(); const c = useList('claims', { sort: 'createdAt', dir: 'desc' });
  return <><MTop title={lang === 'ar' ? 'المطالبات' : 'Claims'} back="/" /><div className="mbodyx"><p className="muted">{lang === 'ar' ? 'لتقديم مطالبة افتح الشحنة واختر "تقديم مطالبة".' : 'To file a claim, open the shipment and choose “File claim”.'}</p>{!c.data ? <Loading /> : c.data.items.length ? c.data.items.map((r: any) => <a key={r.id} className="mcard" href={'#/s/' + r.shipmentId}><div className="row" style={{ justifyContent: 'space-between' }}><Mono>{r.code}</Mono><Pill v={r.status} /></div><span>{label(lang, r.claimType)} · {f.sar(r.claimedAmount)}{r.approvedAmount != null && ['approved', 'closed'].includes(r.status) && <> {lang === 'ar' ? '←' : '→'} {f.sar(r.approvedAmount)}</>}</span><span className="muted">{f.dt(r.createdAt)}</span></a>) : <Empty />}</div></>;
}

// CM11
function Addresses() {
  const { lang, x, me } = useApp(); const L = useLookups(); const orgId = me.organizations?.[0]?.id; const mine = L.addresses.filter((a: any) => a.organizationId === orgId);
  return <><MTop title={lang === 'ar' ? 'العناوين' : 'Addresses'} back="/" right={canCreate(me.roles) && <ActionForm kind="primary" label="+" title={lang === 'ar' ? 'عنوان جديد' : 'New address'} cmd="address.create" fields={[{ name: 'labelAr', label: lang === 'ar' ? 'الوصف' : 'Label', required: true }, { name: 'cityCode', label: lang === 'ar' ? 'المدينة' : 'City', type: 'select', required: true, options: L.cities.filter((c: any) => c.active).map((c: any) => ({ value: c.code, label: x(c.name) })) }, { name: 'districtAr', label: lang === 'ar' ? 'الحي' : 'District', required: true }, { name: 'contactName', label: lang === 'ar' ? 'جهة الاتصال' : 'Contact', required: true }, { name: 'contactPhone', label: lang === 'ar' ? 'الجوال' : 'Mobile', required: true, dir: 'ltr', pattern: /^\+9665\d{8}$/, patternMsg: '+9665XXXXXXXX' }]} map={(v) => ({ organizationId: orgId, branchId: null, ...v })} />} />
    <div className="mbodyx">{mine.length ? mine.map((a: any) => <div key={a.id} className="mcard"><b>{x(a.label)}</b><span>{L.city(a.cityCode)}{a.district ? ' · ' + x(a.district) : ''}</span><span className="muted">{a.contactName} · <span dir="ltr">{a.contactPhone}</span></span></div>) : <Empty />}</div></>;
}

// CM12
function Account() {
  const { lang, setLang, x, t, me, run, signOut } = useApp(); const p = useList('notificationPrefs');
  return <><MTop title={lang === 'ar' ? 'حسابي' : 'Account'} />
    <div className="mbodyx">
      <div className="mcard"><b>{x(me.user.name)}</b><span className="mono">{me.user.email}</span><span className="muted">{me.roles.map((r: string) => t('roles.' + r)).join('، ')} · {me.organizations?.map((o: any) => x(o.legalName)).join('، ')}</span></div>
      <div className="mcard"><b>{lang === 'ar' ? 'اللغة' : 'Language'}</b><div className="seg"><button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button></div></div>
      <div className="mcard"><b>{lang === 'ar' ? 'الإشعارات' : 'Notifications'}</b>{['push', 'sms', 'email'].map((ch) => { const pr = (p.data?.items ?? []).find((y: any) => y.channel === ch); return <label key={ch} className="check"><input type="checkbox" checked={pr?.enabled ?? true} onChange={(e) => run('notification.setPref', { channel: ch, enabled: e.target.checked }, { silent: true })} /> {ch === 'push' ? (lang === 'ar' ? 'إشعارات التطبيق' : 'Push') : ch.toUpperCase()}</label>; })}</div>
      <div className="mcard"><b>{lang === 'ar' ? 'التحقق الثنائي' : 'Two-factor'}</b><label className="check"><input type="checkbox" checked={!!me.user.mfaEnabled} onChange={(e) => run('me.setMfa', { enabled: e.target.checked })} /> MFA</label></div>
      <Btn kind="danger" className="bigbtn" onClick={signOut}>{t('common.signOut')}</Btn>
    </div></>;
}
void useMemo;
