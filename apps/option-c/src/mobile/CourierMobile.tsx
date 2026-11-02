'use client';
// معاينة تطبيق المندوب — الخيار A (K01–K14). نفس المحرك والبيانات؛ تطبيق Flutter الفعلي في mobile/courier_app
import React, { useEffect, useState } from 'react';
import { AppProvider, useApp, useList, useQ, useRoute, go } from '@/lib/store';
import { Btn, Empty, ErrorBox, KsaMap, Loading, Mono, Pill, Sim, label, useFmt } from '@/lib/ui';
import { COURIER_ACCOUNTS } from '@/lib/accounts';
import { useLookups } from '@/admin/common';
import { ICONS, MTabs, MTop, MobileLogin, PhoneStage, ScanSim, SigPad, celebrate } from './kit';

export const K_SCREENS = [
  { id: 'K01', ar: 'الدخول والتحقق', en: 'Sign-in & MFA' }, { id: 'K02', ar: 'مهام اليوم', en: 'Today’s tasks' }, { id: 'K03', ar: 'خريطة المسار', en: 'Route map' },
  { id: 'K04', ar: 'تفاصيل المهمة', en: 'Task detail' }, { id: 'K05', ar: 'مسح رمز الشحنة', en: 'Scan shipment QR' }, { id: 'K06', ar: 'مسح الصندوق والتعبئة', en: 'Scan box & pack' },
  { id: 'K07', ar: 'الاستلام مع التوقيع', en: 'Pickup with signature' }, { id: 'K08', ar: 'بدء النقل والوصول', en: 'Start transit & arrive' }, { id: 'K09', ar: 'نقل الحيازة (شريك/جوي/مستودع/مندوب)', en: 'Custody handover (partner/air/warehouse/courier)' },
  { id: 'K10', ar: 'التسليم مع إثبات', en: 'Delivery with POD' }, { id: 'K11', ar: 'محاولة فاشلة', en: 'Failed attempt' }, { id: 'K12', ar: 'العمل دون اتصال والمزامنة', en: 'Offline queue & sync' },
  { id: 'K13', ar: 'الصناديق بعهدتي', en: 'Boxes in my custody' }, { id: 'K14', ar: 'المناوبة والسجل والحساب', en: 'Shift, history & account' },
];

export default function CourierMobileRoot() { return <AppProvider app="courier"><Stage /></AppProvider>; }
function Stage() { const { lang } = useApp(); return <PhoneStage title={lang === 'ar' ? 'تطبيق المندوب' : 'Courier app'} screens={K_SCREENS} flutterPath="mobile/courier_app"><Gate /></PhoneStage>; }
function Gate() {
  const { userId, me, lang, signOut } = useApp();
  useEffect(() => { if (me && !me.roles.includes('courier')) signOut(); }, [me, signOut]);
  if (!userId) return <MobileLogin title={lang === 'ar' ? 'أطلس لينك — المندوب' : 'Atlas Link — Courier'} accounts={COURIER_ACCOUNTS} allowed={(r) => r.includes('courier')} />;
  if (!me) return <Loading />;
  return <App />;
}

// ---------- طابور العمل دون اتصال (RTE-003) ----------
type QAction = { clientActionId: string; type: 'scanPack' | 'pickup' | 'handover' | 'deliver' | 'failAttempt'; shipment: string; occurredAt: string; payload: Record<string, unknown>; label: string };
const qKey = (u: string) => 'al-courier-queue:' + u;
const loadQ = (u: string): QAction[] => { try { return JSON.parse(localStorage.getItem(qKey(u)) || '[]'); } catch { return []; } };
const saveQ = (u: string, q: QAction[]) => { try { localStorage.setItem(qKey(u), JSON.stringify(q)); } catch { /* */ } };
let offlineFlag = false;
function useOffline() {
  const { userId } = useApp(); const [off, setOff] = useState(offlineFlag); const [q, setQ] = useState<QAction[]>(() => loadQ(userId!));
  useEffect(() => { const h = () => { setOff(offlineFlag); setQ(loadQ(userId!)); }; window.addEventListener('al-offline', h); return () => window.removeEventListener('al-offline', h); }, [userId]);
  return { off, q, toggle: () => { offlineFlag = !offlineFlag; window.dispatchEvent(new Event('al-offline')); }, push: (a: Omit<QAction, 'clientActionId' | 'occurredAt'>) => { const n = [...loadQ(userId!), { ...a, clientActionId: 'ca-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), occurredAt: new Date().toISOString() }]; saveQ(userId!, n); window.dispatchEvent(new Event('al-offline')); }, clear: () => { saveQ(userId!, []); window.dispatchEvent(new Event('al-offline')); } };
}
/** ينفذ الإجراء مباشرة أو يضيفه للطابور عند انقطاع الاتصال */
function useAct() {
  const { run, lang, toast } = useApp(); const o = useOffline();
  return async (type: QAction['type'], cmd: string, shipment: string, payload: Record<string, unknown>, lbl: string, success?: string) => {
    if (o.off) { o.push({ type, shipment, payload, label: lbl }); toast(lang === 'ar' ? 'حُفظ في طابور دون اتصال' : 'Saved to offline queue', 'info'); return 'queued'; }
    return run(cmd, { shipment, ...payload }, { success });
  };
}

function App() {
  const { parts, path } = useRoute(); const o = useOffline(); const { lang } = useApp();
  let s: React.ReactNode;
  if (parts[0] === 't' && parts[1]) s = <Task id={parts[1]} />;
  else if (path === '/map') s = <RouteMap />;
  else if (path === '/sync') s = <Sync />;
  else if (path === '/boxes') s = <Boxes />;
  else if (path === '/me') s = <Me />;
  else s = <Tasks />;
  return <>
    {o.off && <div className="offbar" role="status">{lang === 'ar' ? 'وضع دون اتصال (محاكاة) — ' : 'Offline mode (simulated) — '}{o.q.length} {lang === 'ar' ? 'في الطابور' : 'queued'}</div>}
    {s}
    <MTabs items={[{ path: '/', ar: 'المهام', en: 'Tasks', icon: ICONS.list }, { path: '/map', ar: 'المسار', en: 'Route', icon: ICONS.map }, { path: '/boxes', ar: 'الصناديق', en: 'Boxes', icon: ICONS.box }, { path: '/sync', ar: 'المزامنة', en: 'Sync', icon: ICONS.sync, badge: o.q.length }, { path: '/me', ar: 'حسابي', en: 'Me', icon: ICONS.user }]} />
  </>;
}
const KIND: Record<string, [string, string]> = { pickup: ['استلام', 'Pickup'], delivery: ['تسليم', 'Delivery'], handover: ['تسليم لشريك', 'Handover'], return: ['إرجاع', 'Return'], done: ['منجزة', 'Done'] };

// K02
function Tasks() {
  const { lang, x } = useApp(); const f = useFmt(); const d = useQ<any>('courier.tasks', {}); const [showDone, setShowDone] = useState(false);
  if (d.error) return <div className="mbodyx"><ErrorBox error={d.error} /></div>;
  if (!d.data) return <Loading />;
  const open = d.data.tasks.filter((t: any) => t.kind !== 'done'); const done = d.data.tasks.filter((t: any) => t.kind === 'done');
  return <><MTop title={lang === 'ar' ? 'مهام اليوم' : 'Today’s tasks'} right={<Pill v={d.data.courier.status} />} />
    <div className="mbodyx">
      <div className="mkpis"><div><b>{open.filter((t: any) => t.kind === 'pickup').length}</b><span>{KIND.pickup[lang === 'ar' ? 0 : 1]}</span></div><div><b>{open.filter((t: any) => t.kind !== 'pickup').length}</b><span>{KIND.delivery[lang === 'ar' ? 0 : 1]}</span></div><div><b>{d.data.boxesInCustody.length}</b><span>{lang === 'ar' ? 'صناديق' : 'Boxes'}</span></div></div>
      {d.data.conflicts.some((c: any) => c.resolution === 'pending') && <a className="notice warn" href="#/sync">{lang === 'ar' ? 'لديك تعارضات مزامنة بانتظار العمليات' : 'You have sync conflicts awaiting operations'}</a>}
      {open.length ? open.map((t: any) => <TaskCard key={t.shipmentId} t={t} />) : <Empty text={lang === 'ar' ? 'لا مهام مفتوحة' : 'No open tasks'} />}
      {done.length > 0 && <Btn kind="ghost" onClick={() => setShowDone(!showDone)}>{lang === 'ar' ? `المنجزة (${done.length})` : `Completed (${done.length})`}</Btn>}
      {showDone && done.map((t: any) => <TaskCard key={t.shipmentId} t={t} />)}
      <p className="muted" style={{ fontSize: '.8rem' }}>{x(d.data.vehicle?.plate ? { ar: 'المركبة ' + d.data.vehicle.plate, en: 'Vehicle ' + d.data.vehicle.plate } : null)} {f.dt(new Date().toISOString())}</p>
    </div></>;
}
function TaskCard({ t }: { t: any }) {
  const { lang, x } = useApp(); const f = useFmt();
  const a = t.kind === 'pickup' ? t.sender : t.receiver;
  const H: Record<string, string> = { pickup: 'var(--c-violet)', delivery: 'var(--c-cyan)', handover: 'var(--c-amber)', return: 'var(--c-pink)', done: 'var(--c-green)' };
  return <a className="mcard hue" style={{ '--h': H[t.kind] } as React.CSSProperties} href={'#/t/' + t.shipmentId}>
    <div className="row" style={{ justifyContent: 'space-between' }}><span><span className="mono muted">#{t.seq === 99 ? '—' : t.seq}</span> <b>{KIND[t.kind]?.[lang === 'ar' ? 0 : 1]}</b> <Pill tone={t.serviceLevel === 'stat' ? 'crit' : t.serviceLevel === 'express' ? 'warn' : 'mute'}>{label(lang, t.serviceLevel)}</Pill></span><Pill v={t.status} /></div>
    <span>{x(a?.label)}</span>
    <span className="muted"><Mono>{t.trackingNo}</Mono> · {label(lang, t.thermalClass)} · {t.kind === 'pickup' ? `${f.dt(t.pickupWindowStart)}` : `${lang === 'ar' ? 'قبل' : 'by'} ${f.dt(t.deliverBy)}`}</span>
    {t.lastReading && <span className="muted" dir="ltr">{t.lastReading.tempC ?? '—'}°C</span>}
  </a>;
}

// K03
function RouteMap() {
  const { lang, x } = useApp(); const d = useQ<any>('courier.tasks', {}); const L = useLookups();
  if (!d.data) return <Loading />;
  const open = d.data.tasks.filter((t: any) => t.kind !== 'done');
  const pts = open.map((t: any) => { const a = t.kind === 'pickup' ? t.sender : t.receiver; return a ? { id: t.shipmentId, lat: a.lat, lng: a.lng, kind: t.kind === 'pickup' ? 'pickup' : 'delivery', label: `${t.seq}. ${x(a.label)}`, meta: { trackingNo: t.trackingNo, status: t.status, at: t.kind === 'pickup' ? t.pickupWindowStart : t.deliverBy, origin: t.sender?.cityCode, dest: t.receiver?.cityCode } } : null; }).filter(Boolean);
  return <><MTop title={lang === 'ar' ? 'خريطة المسار' : 'Route map'} right={<Sim />} />
    <div className="mbodyx">
      <KsaMap points={pts as any} cities={L.cities} onPick={(id) => go('/t/' + id)} height={300} />
      <p className="muted">{lang === 'ar' ? 'الملاحة الفعلية تُفتح في تطبيق الخرائط على الجهاز؛ هنا ترتيب التوقفات المسند من الإرسال.' : 'Turn-by-turn navigation opens in the device maps app; this shows the stop order assigned by dispatch.'}</p>
      <ol className="mtimeline">{open.map((t: any) => { const a = t.kind === 'pickup' ? t.sender : t.receiver; return <li key={t.shipmentId}><a href={'#/t/' + t.shipmentId}><b>{t.seq === 99 ? '—' : t.seq}. {x(a?.label)}</b></a><span className="muted">{KIND[t.kind][lang === 'ar' ? 0 : 1]} · {L.city(a?.cityCode)}</span></li>; })}</ol>
    </div></>;
}

// K04–K11
function Task({ id }: { id: string }) {
  const { lang, x, t: tt, run } = useApp(); const f = useFmt(); const d = useQ<any>('courier.tasks', {}); const act = useAct(); const o = useOffline();
  const [stage, setStage] = useState<string | null>(null); const [scannedShip, setScannedShip] = useState(false);
  const [sig, setSig] = useState<string | null>(null); const [name, setName] = useState(''); const [photo, setPhoto] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [hv, setHv] = useState<{ toType: string; toId: string }>({ toType: 'air_carrier', toId: '' }); const [reason, setReason] = useState('RECIPIENT_UNAVAILABLE'); const [note, setNote] = useState('');
  const rets = useList('returns');
  if (!d.data) return <Loading />;
  const t = d.data.tasks.find((y: any) => y.shipmentId === id);
  if (!t) return <><MTop title="—" back="/" /><div className="mbodyx"><div className="state err">{lang === 'ar' ? 'المهمة غير موجودة أو لم تعد مسندة إليك' : 'Task not found or no longer assigned to you'}</div></div></>;
  const reset = () => { setStage(null); setSig(null); setName(''); setPhoto(false); setErr(null); setScannedShip(false); setNote(''); };
  const safe = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reset(); } catch (e: any) { setErr(e?.message?.[lang] ?? String(e)); } };
  const a = t.kind === 'pickup' ? t.sender : t.receiver;
  const queuedFor = o.q.filter((q) => q.shipment === t.shipmentId);
  const ret = (rets.data?.items ?? []).find((r: any) => r.shipmentId === t.shipmentId && r.status === 'in_progress');
  const reasons = [['RECIPIENT_UNAVAILABLE', 'المستلم غير متاح', 'Recipient unavailable'], ['ADDRESS_ISSUE', 'مشكلة في العنوان', 'Address issue'], ['REFUSED', 'رفض الاستلام', 'Refused'], ['ACCESS_DENIED', 'تعذّر الدخول للموقع', 'Site access denied']];
  const targets = hv.toType === 'warehouse' ? d.data.warehouses.map((w: any) => ({ id: w.id, name: w.name })) : hv.toType === 'courier' ? d.data.colleagues : d.data.partners.filter((p: any) => (hv.toType === 'air_carrier' ? p.partnerType === 'air_carrier' : p.partnerType !== 'air_carrier'));
  return <><MTop title={<Mono>{t.trackingNo}</Mono>} back="/" right={<Pill v={t.status} />} />
    <div className="mbodyx">
      <div className="mcard">
        <b>{KIND[t.kind][lang === 'ar' ? 0 : 1]} — {x(a?.label)}</b>
        <span>{a?.contactName} · <span dir="ltr">{a?.contactPhone}</span></span>
        <span className="muted">{x(t.organization)} · {label(lang, t.thermalClass)} · {label(lang, t.mode)}</span>
        <span className="muted">{t.items.map((i: any) => `${label(lang, i.descriptionCode)} ×${i.quantity}`).join('، ')}</span>
        <span>{lang === 'ar' ? 'الصندوق' : 'Box'}: <Mono>{t.box ?? t.plannedBox ?? '—'}</Mono>{!t.box && t.plannedBox && <span className="muted"> ({lang === 'ar' ? 'مخطط' : 'planned'})</span>}</span>
        {t.lastReading && <span dir="ltr">{t.lastReading.tempC ?? '—'}°C · {f.dt(t.lastReading.deviceTime)} <Sim /></span>}
      </div>
      {queuedFor.length > 0 && <div className="notice warn">{lang === 'ar' ? 'إجراءات بانتظار المزامنة:' : 'Actions awaiting sync:'} {queuedFor.map((q) => q.label).join('، ')}</div>}
      {err && <div className="state err" role="alert">{err}</div>}

      {/* K05–K07 الاستلام */}
      {t.kind === 'pickup' && !t.box && !scannedShip && <ScanSim label={tt('courier.scanShipment')} suggestions={[{ value: t.trackingNo, hint: lang === 'ar' ? 'ملصق الشحنة' : 'Shipment label' }, { value: 'ML-2026-999999', hint: lang === 'ar' ? 'رمز خاطئ للاختبار' : 'Wrong code (test)' }]} onScan={async (v) => { if (v === t.trackingNo || v === t.qrToken) { await new Promise((r) => setTimeout(r, 650)); setScannedShip(true); setErr(null); return null; } return lang === 'ar' ? 'هذا الرمز لا يخص هذه المهمة. تأكد من ملصق الشحنة.' : 'This code does not belong to this task. Check the shipment label.'; }} />}
      {t.kind === 'pickup' && !t.box && scannedShip && <ScanSim label={tt('courier.scanBox')} suggestions={[...(t.plannedBox ? [{ value: t.plannedBox, hint: lang === 'ar' ? 'الصندوق المسند' : 'Assigned box' }] : []), ...d.data.boxesInCustody.filter((b: any) => b.code !== t.plannedBox).slice(0, 1).map((b: any) => ({ value: b.code, hint: lang === 'ar' ? 'صندوق آخر' : 'Another box' }))]} onScan={async (v) => { await act('scanPack', 'courier.scanPack', t.shipmentId, { boxCode: v }, `${lang === 'ar' ? 'تعبئة' : 'Pack'} ${v}`, lang === 'ar' ? `رُبطت الشحنة بالصندوق ${v}` : `Linked to box ${v}`); return null; }} />}
      {t.kind === 'pickup' && (t.box || queuedFor.some((q) => q.type === 'scanPack')) && <div className="mcard">
        <b>{tt('courier.confirmPickup')}</b>
        <label className="field"><span>{lang === 'ar' ? 'اسم المُسلِّم' : 'Handed over by'}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <span>{tt('courier.signHere')}</span><SigPad onChange={setSig} />
        <Btn kind="primary" className="bigbtn" onClick={() => { if (!name.trim() || !sig) return setErr(lang === 'ar' ? 'الاسم والتوقيع مطلوبان' : 'Name and signature are required'); safe(() => act('pickup', 'courier.pickup', t.shipmentId, { signedBy: name.trim(), method: 'signature' }, lang === 'ar' ? 'استلام' : 'Pickup', lang === 'ar' ? 'تم الاستلام — الحيازة لديك' : 'Collected — custody is yours')); }}>{tt('courier.confirmPickup')}</Btn>
      </div>}

      {/* K08 */}
      {t.mine && t.status === 'collected' && !stage && <Btn kind="primary" className="bigbtn" disabled={o.off} onClick={() => safe(() => run('courier.startTransit', { shipment: t.shipmentId }))}>{tt('courier.startTransit')}</Btn>}
      {t.mine && t.kind === 'delivery' && t.status === 'in_transit' && !stage && <Btn className="bigbtn" disabled={o.off} onClick={() => safe(() => run('courier.arrive', { shipment: t.shipmentId }))}>{tt('courier.arrive')}</Btn>}
      {o.off && t.mine && ['collected', 'in_transit'].includes(t.status) && <p className="muted">{lang === 'ar' ? 'تغيير الحالة يتطلب اتصالاً؛ الحيازة والتسليم يُحفظان دون اتصال.' : 'Status changes need a connection; custody and delivery are saved offline.'}</p>}

      {/* K09 */}
      {t.mine && ['collected', 'in_transit', 'at_handover'].includes(t.status) && (t.kind === 'handover' || stage === 'handover') && <div className="mcard">
        <b>{tt('courier.handover')}</b>
        <div className="seg">{[['air_carrier', 'ناقل جوي', 'Air'], ['partner', 'شريك بري', 'Partner'], ['warehouse', 'مستودع', 'Warehouse'], ['courier', 'مندوب', 'Courier']].map(([k, ar, en]) => <button key={k} className={hv.toType === k ? 'on' : ''} onClick={() => setHv({ toType: k, toId: '' })}>{lang === 'ar' ? ar : en}</button>)}</div>
        <select value={hv.toId} onChange={(e) => setHv({ ...hv, toId: e.target.value })} aria-label="to"><option value="">—</option>{targets.map((p: any) => <option key={p.id} value={p.id}>{x(p.name)}</option>)}</select>
        <label className="field"><span>{lang === 'ar' ? 'اسم المستلم من الطرف الآخر' : 'Receiving person'}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <ScanSim label={lang === 'ar' ? 'امسح رمز الطرف المستلم لتأكيد الحيازة' : 'Scan the receiving party QR to confirm custody'} suggestions={hv.toId ? [{ value: 'HO-' + hv.toId.slice(-6).toUpperCase(), hint: lang === 'ar' ? 'رمز الطرف المستلم' : 'Receiver code' }] : []} onScan={async () => { if (!hv.toId || !name.trim()) return lang === 'ar' ? 'اختر الطرف المستلم واكتب اسم المستلم أولاً' : 'Choose the receiving party and enter the receiver name first'; await act('handover', 'custody.handover', t.shipmentId, { toType: hv.toType, toId: hv.toId, signedBy: name.trim(), method: 'qr' }, lang === 'ar' ? 'نقل حيازة' : 'Handover', lang === 'ar' ? 'نُقلت الحيازة' : 'Custody transferred'); await new Promise((r) => setTimeout(r, 700)); reset(); return null; }} />
        {stage && <Btn kind="ghost" onClick={reset}>{tt('common.cancel')}</Btn>}
      </div>}

      {/* K10 */}
      {t.mine && t.kind === 'delivery' && ['in_transit', 'at_handover', 'exception'].includes(t.status) && stage === 'deliver' && <div className="mcard">
        <b>{tt('courier.deliver')}</b>
        <label className="field"><span>{tt('courier.recipientName')}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <span>{tt('courier.signHere')}</span><SigPad onChange={setSig} />
        <label className="check"><input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} /> {tt('courier.photo')} <Sim /></label>
        <label className="field"><span>{tt('common.note')}</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <Btn kind="primary" className="bigbtn" onClick={() => { if (!name.trim() || !sig) return setErr(lang === 'ar' ? 'اسم المستلم والتوقيع مطلوبان' : 'Recipient name and signature are required'); safe(() => act('deliver', 'courier.deliver', t.shipmentId, { recipientName: name.trim(), signature: sig, photoRef: photo ? 'photo-sim-' + Date.now() : null, notes: note }, lang === 'ar' ? 'تسليم' : 'Deliver', lang === 'ar' ? 'تم التسليم مع الإثبات' : 'Delivered with proof').then((r) => { if (r !== 'queued') celebrate(); })); }}>{lang === 'ar' ? 'تأكيد التسليم' : 'Confirm delivery'}</Btn>
        <Btn kind="ghost" onClick={reset}>{tt('common.cancel')}</Btn>
      </div>}
      {/* K11 */}
      {t.mine && t.kind === 'delivery' && ['in_transit', 'at_handover'].includes(t.status) && stage === 'fail' && <div className="mcard">
        <b>{tt('courier.failAttempt')}</b>
        <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="reason">{reasons.map(([v, ar, en]) => <option key={v} value={v}>{lang === 'ar' ? ar : en}</option>)}</select>
        <label className="field"><span>{tt('common.note')}</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <p className="muted">{lang === 'ar' ? 'لا تُتلف أي عينة. القرار (إعادة محاولة / وجهة بديلة / حجز / إرجاع) للعمليات.' : 'Never destroy samples. Operations decides: retry / alternate / hold / return.'}</p>
        <Btn kind="danger" className="bigbtn" onClick={() => safe(() => act('failAttempt', 'courier.failAttempt', t.shipmentId, { reasonCode: reason, notes: note }, lang === 'ar' ? 'محاولة فاشلة' : 'Failed attempt', lang === 'ar' ? 'سُجلت المحاولة وأُبلغت العمليات' : 'Attempt recorded; operations notified'))}>{lang === 'ar' ? 'تسجيل' : 'Record'}</Btn>
        <Btn kind="ghost" onClick={reset}>{tt('common.cancel')}</Btn>
      </div>}
      {t.mine && t.kind === 'delivery' && ['in_transit', 'at_handover', 'exception'].includes(t.status) && !stage && <div className="row" style={{ gap: 8 }}>
        <Btn kind="primary" className="bigbtn" style={{ flex: 2 }} onClick={() => setStage('deliver')}>{tt('courier.deliver')}</Btn>
        <Btn style={{ flex: 1 }} onClick={() => setStage('fail')}>{tt('courier.failAttempt')}</Btn>
      </div>}
      {t.mine && t.kind === 'delivery' && !stage && <Btn kind="ghost" onClick={() => setStage('handover')}>{lang === 'ar' ? 'تسليم لطرف آخر بدلاً من ذلك' : 'Hand over to another party instead'}</Btn>}
      {t.kind === 'return' && ret && <div className="mcard"><b>{lang === 'ar' ? 'إتمام الإرجاع للمرسل' : 'Complete return to sender'}</b><label className="field"><span>{lang === 'ar' ? 'المستلم لدى المرسل' : 'Received by'}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label><Btn kind="primary" className="bigbtn" disabled={o.off} onClick={() => { if (!name.trim()) return setErr(lang === 'ar' ? 'الاسم مطلوب' : 'Name required'); safe(() => run('returns.complete', { returnId: ret.id, signedBy: name.trim() })); }}>{lang === 'ar' ? 'تأكيد الإرجاع' : 'Confirm return'}</Btn></div>}
      {t.kind === 'done' && <div className="state empty">{lang === 'ar' ? 'لا إجراءات مطلوبة على هذه المهمة' : 'No actions required on this task'}</div>}
    </div></>;
}

// K12
function Sync() {
  const { lang, x, run, toast } = useApp(); const f = useFmt(); const o = useOffline(); const d = useQ<any>('courier.tasks', {}); const [res, setRes] = useState<any[] | null>(null);
  const sync = async () => {
    if (o.off) { toast(lang === 'ar' ? 'أعد الاتصال أولاً' : 'Reconnect first', 'error'); return; }
    const r: any = await run('courier.sync', { actions: o.q.map(({ label: _l, ...a }) => a) }, { success: lang === 'ar' ? 'اكتملت المزامنة' : 'Sync complete' });
    setRes(r.results.map((y: any) => ({ ...y, label: o.q.find((q) => q.clientActionId === y.clientActionId)?.label }))); o.clear();
  };
  return <><MTop title={lang === 'ar' ? 'دون اتصال والمزامنة' : 'Offline & sync'} />
    <div className="mbodyx">
      <div className="mcard"><b>{lang === 'ar' ? 'حالة الشبكة' : 'Network'}: {o.off ? (lang === 'ar' ? 'دون اتصال' : 'Offline') : (lang === 'ar' ? 'متصل' : 'Online')} <Sim /></b><span className="muted">{lang === 'ar' ? 'محاكاة انقطاع الشبكة لاختبار العمل الميداني. تُخزّن الإجراءات محلياً بمعرف فريد وتُزامن دون تكرار.' : 'Simulates network loss for field testing. Actions are stored locally with unique IDs and synced idempotently.'}</span><Btn onClick={o.toggle}>{o.off ? (lang === 'ar' ? 'استعادة الاتصال' : 'Go online') : (lang === 'ar' ? 'قطع الاتصال' : 'Go offline')}</Btn></div>
      <b>{lang === 'ar' ? 'الطابور' : 'Queue'} ({o.q.length})</b>
      {o.q.length ? o.q.map((q) => <div key={q.clientActionId} className="mcard"><b>{q.label}</b><span className="muted"><Mono>{q.clientActionId}</Mono> · {f.dt(q.occurredAt)}</span></div>) : <Empty text={lang === 'ar' ? 'لا إجراءات معلّقة' : 'Nothing pending'} />}
      <Btn kind="primary" className="bigbtn" disabled={!o.q.length || o.off} onClick={sync}>{lang === 'ar' ? 'مزامنة الآن' : 'Sync now'}</Btn>
      {res && res.map((r) => <div key={r.clientActionId} className="mcard"><div className="row" style={{ justifyContent: 'space-between' }}><b>{r.label}</b><Pill tone={r.status === 'accepted' ? 'good' : r.status === 'duplicate' ? 'mute' : 'crit'}>{r.status}</Pill></div><span>{x(r.message)}</span></div>)}
      {(d.data?.conflicts ?? []).length > 0 && <><b>{lang === 'ar' ? 'سجل التعارضات' : 'Conflict log'}</b>{d.data.conflicts.map((c: any) => <div key={c.id} className="mcard"><div className="row" style={{ justifyContent: 'space-between' }}><span>{c.action}</span><Pill v={c.resolution} /></div><span className="muted">{c.reason}</span><span className="muted">{f.dt(c.occurredAt)}</span></div>)}</>}
    </div></>;
}

// K13
function Boxes() {
  const { lang } = useApp(); const d = useQ<any>('courier.tasks', {}); const f = useFmt();
  if (!d.data) return <Loading />;
  return <><MTop title={lang === 'ar' ? 'الصناديق بعهدتي' : 'Boxes in my custody'} />
    <div className="mbodyx">{d.data.boxesInCustody.length ? d.data.boxesInCustody.map((b: any) => <div key={b.id} className="mcard"><div className="row" style={{ justifyContent: 'space-between' }}><Mono>{b.code}</Mono><Pill v={b.status} /></div><span>{label(lang, b.thermalClass)} · {b.size}</span>{b.device ? <span className="muted">GPT45-M <Mono>{b.device.imei}</Mono> · {lang === 'ar' ? 'بطارية' : 'battery'} {b.device.batteryPct ?? '—'}% · {f.dt(b.device.lastSeenAt)} <Sim /></span> : <Pill tone="warn">{lang === 'ar' ? 'لا جهاز مقترن' : 'No paired device'}</Pill>}</div>) : <Empty />}</div></>;
}

// K14
function Me() {
  const { lang, setLang, x, t, me, run, signOut } = useApp(); const d = useQ<any>('courier.tasks', {}); const h = useList('custody', { sort: 'occurredAt', dir: 'desc' }); const f = useFmt();
  const c = d.data?.courier;
  return <><MTop title={lang === 'ar' ? 'حسابي' : 'Me'} />
    <div className="mbodyx">
      <div className="mcard"><b>{x(me.user.name)}</b><span className="mono">{me.user.email}</span>{c && <span>{label(lang, c.employmentType)} · {lang === 'ar' ? 'التأهيل حتى' : 'Qualified until'} {f.dt(c.qualificationExpiry)}</span>}{d.data?.vehicle && <span className="muted">{d.data.vehicle.plate} · {d.data.vehicle.vehicleType ?? ''}</span>}</div>
      {c && <div className="mcard"><b>{lang === 'ar' ? 'المناوبة' : 'Shift'}: <Pill v={c.status} /></b>{c.status === 'off_shift' ? <Btn kind="primary" onClick={() => run('courier.setStatus', { courierId: c.id, status: 'available' })}>{t('courier.startShift')}</Btn> : <Btn onClick={() => run('courier.setStatus', { courierId: c.id, status: 'off_shift' })}>{t('courier.endShift')}</Btn>}</div>}
      <div className="mcard"><b>{lang === 'ar' ? 'اللغة' : 'Language'}</b><div className="seg"><button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button></div></div>
      <b>{lang === 'ar' ? 'سجل الحيازة' : 'Custody history'}</b>
      {(h.data?.items ?? []).filter((e: any) => (c && (e.toId === c.id || e.fromId === c.id))).slice(0, 15).map((e: any) => <div key={e.id} className="mcard"><span><b>{label(lang, e.eventType)}</b> · {label(lang, e.source)}</span><span className="muted">{f.dt(e.occurredAt)} · {e.evidence?.signedBy}</span></div>)}
      <Btn kind="danger" className="bigbtn" onClick={signOut}>{t('common.signOut')}</Btn>
    </div></>;
}
