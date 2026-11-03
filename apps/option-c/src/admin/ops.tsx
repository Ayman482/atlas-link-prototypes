'use client';
import { comma } from '@/lib/l10n';
import { ELIGIBILITY_TEXT } from '@medlog/core';
import { timelineTitle, timelineDetail, sysText } from '@/lib/l10n';
// العمليات: برج التحكم، الخريطة، الشحنات، الإنشاء، التفاصيل، التوزيع، المسارات، الأرجل، المندوبون، المركبات، الشركاء (A02–A12)
import React, { useEffect, useMemo, useState } from 'react';
import { useApp, useQ, useList, go, transport } from '@/lib/store';
import { Btn, ConfirmBtn, cx, DataTable, DL, Empty, ErrorBox, FormFields, Kpis, KsaMap, Loading, Mono, Page, Pill, Section, Sim, Tabs, TempChart, Timeline, label, useFmt, validate, type FieldDef } from '@/lib/ui';
import { ActionForm, ShipLink, localNow, opts, useLookups } from './common';
import { motion } from '@/lib/motion';

const STATUSES = ['draft', 'confirmed', 'pickup_scheduled', 'collected', 'in_transit', 'at_handover', 'delivered', 'failed', 'return_pending', 'returned', 'cancelled', 'exception'];
const THERMAL = ['chilled', 'frozen', 'ambient'];

// ================= A02 برج التحكم =================
export function ControlTower() {
  const { t, x, lang, run, me } = useApp(); const f = useFmt();
  const [flt, setFlt] = useState<Record<string, string>>({});
  const [live, setLive] = useState(false);
  const q = useQ<any>('controlTower.summary', flt);
  const canSim = me.roles.some((r: string) => ['ops_controller', 'iot_engineer', 'super_admin'].includes(r));
  useEffect(() => { if (!live) return; const tick = () => run('telemetry.simulateTick', {}, { silent: true }).catch(() => setLive(false)); tick(); const h = setInterval(tick, 20000); return () => clearInterval(h); }, [live, run]);
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const k = q.data.kpis;
  return (
    <Page title={t('nav.controlTower')} sub={<>{lang === 'ar' ? 'آخر تحديث' : 'Updated'} {f.dt(q.data.generatedAt)} · <Sim /> {lang === 'ar' ? 'القراءات والمواقع بيانات عرض' : 'Readings and positions are demo data'}</>}
      actions={<>
        <select aria-label={t('common.city')} value={flt.city ?? ''} onChange={(e) => setFlt({ ...flt, city: e.target.value })}><option value="">{t('common.city')}: {t('common.all')}</option>{q.data.cities.map((c: any) => <option key={c.code} value={c.code}>{x(c.name)}</option>)}</select>
        <select aria-label={t('ship.thermalClass')} value={flt.thermalClass ?? ''} onChange={(e) => setFlt({ ...flt, thermalClass: e.target.value })}><option value="">{t('ship.thermalClass')}: {t('common.all')}</option>{THERMAL.map((c) => <option key={c} value={c}>{label(lang, c)}</option>)}</select>
        <select aria-label="severity" value={flt.severity ?? ''} onChange={(e) => setFlt({ ...flt, severity: e.target.value })}><option value="">{lang === 'ar' ? 'الشدة' : 'Severity'}: {t('common.all')}</option>{['critical', 'high', 'medium', 'low'].map((c) => <option key={c} value={c}>{label(lang, c)}</option>)}</select>
      </>}>
      {(() => { const pts = q.data.map; const withAlert = pts.filter((m: any) => m.hasAlert).length; const health = pts.length ? Math.round((1 - withAlert / pts.length) * 100) : 100; const by = (k: string) => pts.filter((m: any) => m.dataKind === k).length; return (
        <section className="card" style={{ background: 'linear-gradient(120deg, var(--accent-soft), var(--surface) 70%)', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 22 }}>
          <div className="gaugewrap"><div className="gauge" style={{ '--v': health } as React.CSSProperties} /><b>{health}%</b></div>
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 style={{ fontSize: '1.2rem' }}>{lang === 'ar' ? 'صحة العمليات الآن' : 'Operations health now'}</h2>
            <p className="muted">{lang === 'ar' ? `${pts.length} شحنة على الخريطة، ${withAlert} منها عليها تنبيه مفتوح.` : `${pts.length} shipments on the map, ${withAlert} with an open alert.`}</p>
            <div className="row">{['live', 'delayed', 'stale', 'inferred', 'planned'].map((k) => <span key={k} className="chip"><i className={'sw mk ' + k} />{label(lang, k)} <b>{by(k)}</b></span>)}</div>
          </div>
          {canSim && <Btn kind={live ? 'primary' : 'default'} onClick={() => setLive(!live)} aria-pressed={live} style={{ padding: '12px 20px' }}>{live ? '■ ' : '▶ '}{live ? (lang === 'ar' ? 'إيقاف البث التجريبي' : 'Stop demo stream') : (lang === 'ar' ? 'تشغيل بث القراءات التجريبي' : 'Start demo telemetry stream')}</Btn>}
        </section>); })()}
      <Kpis items={[
        { label: lang === 'ar' ? 'شحنات نشطة' : 'Active shipments', value: f.num(k.active), href: '#/shipments?status=in_transit' },
        { label: lang === 'ar' ? 'بانتظار الاستلام' : 'Awaiting pickup', value: f.num(k.awaitingPickup), href: '#/dispatch' },
        { label: lang === 'ar' ? 'استلام متأخر' : 'Overdue pickups', value: f.num(k.overduePickups), tone: k.overduePickups ? 'warn' : undefined },
        { label: lang === 'ar' ? 'تسليم متأخر' : 'Overdue deliveries', value: f.num(k.overdueDeliveries), tone: k.overdueDeliveries ? 'crit' : undefined },
        { label: lang === 'ar' ? 'استثناءات وفشل' : 'Exceptions', value: f.num(k.exceptions), tone: k.exceptions ? 'crit' : undefined, href: '#/returns' },
        { label: lang === 'ar' ? 'انحرافات مفتوحة' : 'Open excursions', value: f.num(k.openExcursions), tone: k.openExcursions ? 'crit' : 'good', href: '#/excursions' },
        { label: lang === 'ar' ? 'صناديق جاهزة / غير جاهزة' : 'Boxes ready / not', value: <>{f.num(k.boxesReady)} <span className="muted">/ {f.num(k.boxesNotReady)}</span></>, tone: k.boxesNotReady ? 'warn' : undefined, href: '#/boxes' },
        { label: lang === 'ar' ? 'مندوبون متاحون / في مسار' : 'Couriers free / on route', value: <>{f.num(k.couriersAvailable)} <span className="muted">/ {f.num(k.couriersOnRoute)}</span></>, href: '#/couriers' },
      ]} />
      <div className="grid wide-narrow">
        <Section title={t('nav.map')} actions={<a href="#/map" className="btn ghost">{t('common.view')}</a>}>
          <KsaMap height={420} cities={q.data.cities} points={q.data.map.map((m: any) => ({ id: m.id, lat: m.lat, lng: m.lng, kind: m.dataKind, alert: m.hasAlert, label: `${m.trackingNo} · ${label(lang, m.status)} · ${label(lang, m.dataKind)}`, meta: { trackingNo: m.trackingNo, status: m.status, at: m.at, origin: m.origin, dest: m.dest, source: m.source, thermalClass: m.thermalClass } }))} onPick={(id) => go('/shipments/' + id)} />
        </Section>
        <Section title={<>{lang === 'ar' ? 'التنبيهات' : 'Alerts'} <span className="count">{q.data.alerts.length}</span></>} actions={<Btn kind="ghost" onClick={() => run('delay.runRules', {}, { success: lang === 'ar' ? 'تم تشغيل قواعد التأخير' : 'Delay rules ran' })}>{lang === 'ar' ? 'تشغيل قواعد التأخير' : 'Run delay rules'}</Btn>}>
          {q.data.alerts.length === 0 ? <Empty text={lang === 'ar' ? 'لا تنبيهات مفتوحة' : 'No open alerts'} /> : <ul className="alerts" style={{ maxHeight: 440, overflow: 'auto' }}>
            {q.data.alerts.slice(0, 40).map((a: any) => <li key={a.id}>
              <Pill v={a.severity} />
              <a href={'#' + a.link}>{sysText(lang, x(a.title))}<div className="muted" style={{ fontSize: '.78rem' }}>{f.dt(a.at)}</div></a>
              {a.kind === 'excursion' && a.status === 'open' ? <Btn onClick={() => run('excursion.acknowledge', { id: a.id }, { success: lang === 'ar' ? 'تم الإقرار' : 'Acknowledged' })}>{lang === 'ar' ? 'إقرار' : 'Acknowledge'}</Btn>
                : a.kind === 'delay' ? <Btn kind="ghost" onClick={() => run('delay.action', { id: a.id, action: 'escalate' }, { success: lang === 'ar' ? 'تم التصعيد' : 'Escalated' })}>{lang === 'ar' ? 'تصعيد' : 'Escalate'}</Btn> : <span />}
            </li>)}
          </ul>}
        </Section>
      </div>
      <Section title={t('nav.couriers')} flush>
        <DataTable rows={q.data.couriers} pageSize={6} cols={[
          { key: 'name', label: lang === 'ar' ? 'المندوب' : 'Courier', render: (c: any) => x(c.name), sort: (c: any) => x(c.name) },
          { key: 'cityCode', label: t('common.city') },
          { key: 'status', label: t('common.status'), render: (c: any) => <Pill v={c.status} /> },
          { key: 'el', label: lang === 'ar' ? 'الأهلية' : 'Eligibility', render: (c: any) => c.eligibility.length ? <Pill tone="crit">{c.eligibility.length} {lang === 'ar' ? 'مانع' : 'blockers'}</Pill> : <Pill tone="good">{lang === 'ar' ? 'مؤهل' : 'Eligible'}</Pill> },
          { key: 'pos', label: lang === 'ar' ? 'آخر موقع' : 'Last position', render: (c: any) => c.lastPosition ? f.dt(c.lastPosition.at) : '—', hideSm: true },
        ]} />
      </Section>
    </Page>
  );
}

// ================= A03 خريطة الشحنات =================
export function MapScreen() {
  const { t, lang } = useApp(); const f = useFmt(); const q = useQ<any>('controlTower.summary', {});
  const [kind, setKind] = useState('');
  if (!q.data) return q.error ? <ErrorBox error={q.error} /> : <Loading />;
  const pts = q.data.map.filter((m: any) => !kind || m.dataKind === kind);
  return (
    <Page title={t('nav.map')} sub={lang === 'ar' ? 'آخر موقع مؤكد لكل شحنة مع تمييز حداثة البيانات (OPS-004). لا يُعرض موقع حي أثناء الرحلات الجوية.' : 'Last confirmed position per shipment, marked by data freshness (OPS-004). No live position is shown during flights.'}
      actions={<select aria-label="freshness" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">{t('common.all')}</option>{['live', 'delayed', 'stale', 'inferred', 'planned'].map((k) => <option key={k} value={k}>{label(lang, k)}</option>)}</select>}>
      <div className="grid wide-narrow">
        <Section><KsaMap height={620} cities={q.data.cities} points={pts.map((m: any) => ({ id: m.id, lat: m.lat, lng: m.lng, kind: m.dataKind, alert: m.hasAlert, label: `${m.trackingNo} · ${label(lang, m.dataKind)}`, meta: { trackingNo: m.trackingNo, status: m.status, at: m.at, origin: m.origin, dest: m.dest, source: m.source, thermalClass: m.thermalClass } }))} onPick={(id) => go('/shipments/' + id)} /></Section>
        <Section title={`${pts.length} ${lang === 'ar' ? 'شحنة' : 'shipments'}`} flush>
          <DataTable rows={pts} pageSize={14} onRow={(r: any) => go('/shipments/' + r.id)} search={(r: any) => r.trackingNo} cols={[
            { key: 'trackingNo', label: t('ship.tracking'), mono: true },
            { key: 'dataKind', label: lang === 'ar' ? 'البيانات' : 'Data', render: (r: any) => <Pill v={r.dataKind} /> },
            { key: 'at', label: t('common.time'), render: (r: any) => f.dt(r.at) },
          ]} />
        </Section>
      </div>
    </Page>
  );
}

// ================= A04 قائمة الشحنات =================
export function ShipmentsList() {
  const { t, lang, x } = useApp(); const f = useFmt(); const L = useLookups();
  const list = useList('shipments', { sort: 'createdAt', dir: 'desc' });
  const initialStatus = typeof location !== 'undefined' ? new URLSearchParams(location.hash.split('?')[1] ?? '').get('status') : null;
  const rows = useMemo(() => (list.data?.items ?? []).filter((s: any) => !initialStatus || s.status === initialStatus), [list.data, initialStatus]);
  return (
    <Page title={t('nav.shipments')} sub={initialStatus ? <>{t('common.filter')}: <Pill v={initialStatus} /> <a href="#/shipments">{t('common.clear')}</a></> : undefined} actions={<a className="btn primary" href="#/shipments/new">{t('nav.newShipment')}</a>}>
      <Section flush>
        <DataTable rows={list.data ? rows : null} csvName="shipments" onRow={(s: any) => go('/shipments/' + s.id)}
          bulk={[{ label: lang === 'ar' ? 'نسخ أرقام التتبع' : 'Copy tracking numbers', run: async (sel: any[]) => { try { await navigator.clipboard.writeText(sel.map((r) => r.trackingNo).join('\n')); } catch { /* المتصفح قد يمنع الحافظة */ } } }]}
          expand={(s: any) => <dl className="tldetail">
            <div><dt>{lang === 'ar' ? 'المسار' : 'Route'}</dt><dd>{L.city(s.originCity)} {lang === 'ar' ? '←' : '→'} {L.city(s.destCity)} · {label(lang, s.mode)}</dd></div>
            <div><dt>{lang === 'ar' ? 'فترة الاستلام' : 'Pickup window'}</dt><dd>{f.dt(s.pickupWindowStart)} – {f.dt(s.pickupWindowEnd)}</dd></div>
            <div><dt>{lang === 'ar' ? 'التسليم قبل' : 'Deliver by'}</dt><dd>{f.dt(s.deliverBy)}</dd></div>
            <div><dt>{lang === 'ar' ? 'الوصول المتوقع' : 'ETA'}</dt><dd>{s.eta?.at ? <>{f.dt(s.eta.at)} <Pill v={s.eta.confidence} /></> : '—'}</dd></div>
            <div><dt>{lang === 'ar' ? 'آخر موقع مؤكد' : 'Last confirmed fix'}</dt><dd>{s.lastPosition ? <>{f.dt(s.lastPosition.at)} · {label(lang, s.lastPosition.source)}</> : (lang === 'ar' ? 'لا يوجد بعد' : 'None yet')}</dd></div>
            <div><dt>{lang === 'ar' ? 'السعر' : 'Price'}</dt><dd>{f.sar(s.priceTotal)}</dd></div>
            <div><a className="btn" href={'#/shipments/' + s.id}>{lang === 'ar' ? 'فتح الشحنة' : 'Open shipment'}</a></div>
          </dl>}
          search={(s: any) => `${s.trackingNo} ${L.org(s.organizationId)} ${s.originCity} ${s.destCity}`}
          filters={[
            { key: 'status', label: t('common.status'), options: STATUSES.map((s) => ({ value: s, label: label(lang, s) })), get: (s: any) => s.status },
            { key: 'thermal', label: t('ship.thermalClass'), options: THERMAL.map((s) => ({ value: s, label: label(lang, s) })), get: (s: any) => s.thermalClass },
            { key: 'city', label: t('common.city'), options: L.cities.map((c: any) => ({ value: c.code, label: x(c.name) })), get: (s: any) => [s.originCity, s.destCity] },
            { key: 'org', label: t('common.customer'), options: L.orgs.map((o: any) => ({ value: o.id, label: x(o.legalName) })), get: (s: any) => s.organizationId },
            { key: 'level', label: t('ship.serviceLevel'), options: ['standard', 'express', 'stat'].map((s) => ({ value: s, label: label(lang, s) })), get: (s: any) => s.serviceLevel },
          ]}
          cols={[
            { key: 'trackingNo', label: t('ship.tracking'), mono: true },
            { key: 'org', label: t('common.customer'), render: (s: any) => L.org(s.organizationId), sort: (s: any) => L.org(s.organizationId) },
            { key: 'route', label: lang === 'ar' ? 'المسار' : 'Route', render: (s: any) => `${L.city(s.originCity)} ← ${L.city(s.destCity)}`.replace('←', lang === 'ar' ? '←' : '→') },
            { key: 'thermalClass', label: t('ship.thermalClass'), render: (s: any) => label(lang, s.thermalClass) },
            { key: 'serviceLevel', label: t('ship.serviceLevel'), render: (s: any) => label(lang, s.serviceLevel), hideSm: true },
            { key: 'status', label: t('common.status'), render: (s: any) => <>{<Pill v={s.status} />} {s.lostState !== 'none' && <Pill tone="crit">{lang === 'ar' ? 'فقدان' : 'Loss'}: {s.lostState}</Pill>}</> },
            { key: 'pickupWindowStart', label: t('ship.pickupWindow'), render: (s: any) => f.dt(s.pickupWindowStart), hideSm: true },
            { key: 'deliverBy', label: t('ship.deliverBy'), render: (s: any) => f.dt(s.deliverBy), hideSm: true },
          ]} />
      </Section>
    </Page>
  );
}

// ================= A05 إنشاء شحنة (معالج) =================
export function ShipmentCreate({ portal }: { params?: any; portal?: { orgId: string; branchIds: string[] | null } }) {
  const { t, lang, x, run } = useApp(); const L = useLookups(); const f = useFmt();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Record<string, any>>({ organizationId: portal?.orgId ?? '', thermalClass: 'chilled', serviceLevel: 'standard', requestType: 'on_demand', pickupWindowStart: localNow(1), pickupWindowEnd: localNow(3), items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 2, weightKg: 1 }], dedicatedBox: false });
  const [e, setE] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<any>(null); const [qErr, setQErr] = useState<string | null>(null);
  const set = (n: string, val: any) => setV((o) => ({ ...o, [n]: val }));
  const org = L.orgs.find((o: any) => o.id === v.organizationId);
  const brs = L.branches.filter((b: any) => b.organizationId === v.organizationId && (!portal?.branchIds || portal.branchIds.includes(b.id)));
  const senders = L.addresses.filter((a: any) => a.organizationId === v.organizationId && (!v.branchId || a.branchId === v.branchId || !a.branchId));
  const receivers = L.addresses.filter((a: any) => a.id !== v.senderAddressId);
  const steps = [t('ship.stepRoute'), t('ship.stepSample'), t('ship.stepSchedule'), t('ship.stepReview')];
  const F: FieldDef[][] = [
    [
      ...(portal ? [] : [{ name: 'organizationId', label: t('common.customer'), type: 'select' as const, required: true, options: L.orgs.filter((o: any) => o.legalName).map((o: any) => ({ value: o.id, label: x(o.legalName) })) }]),
      { name: 'branchId', label: t('common.branch'), type: 'select', required: brs.length > 0, options: brs.map((b: any) => ({ value: b.id, label: x(b.name) })) },
      { name: 'senderAddressId', label: t('ship.sender'), type: 'select', required: true, options: senders.map((a: any) => ({ value: a.id, label: `${x(a.label)} — ${L.city(a.cityCode)}` })), full: true },
      { name: 'receiverAddressId', label: t('ship.receiver'), type: 'select', required: true, options: receivers.map((a: any) => ({ value: a.id, label: `${x(a.label)} — ${L.city(a.cityCode)}` })), full: true },
    ],
    [
      { name: 'thermalClass', label: t('ship.thermalClass'), type: 'select', required: true, options: THERMAL.map((s) => ({ value: s, label: label(lang, s) })) },
      { name: 'serviceLevel', label: t('ship.serviceLevel'), type: 'select', required: true, options: ['standard', 'express', 'stat'].map((s) => ({ value: s, label: label(lang, s) })) },
      { name: 'dedicatedBox', label: t('ship.dedicatedBox'), type: 'checkbox', placeholder: lang === 'ar' ? 'صندوق مخصص لهذه الشحنة فقط (+150 ر.س)' : 'Box reserved for this shipment only (+SAR 150)' },
    ],
    [
      { name: 'requestType', label: lang === 'ar' ? 'نوع الطلب' : 'Request type', type: 'select', required: true, options: ['on_demand', 'scheduled'].map((s) => ({ value: s, label: label(lang, s) })) },
      { name: 'pickupWindowStart', label: lang === 'ar' ? 'بداية فترة الاستلام' : 'Pickup window start', type: 'datetime', required: true },
      { name: 'pickupWindowEnd', label: lang === 'ar' ? 'نهاية فترة الاستلام' : 'Pickup window end', type: 'datetime', required: true },
    ],
  ];
  const weight = (v.items ?? []).reduce((a: number, i: any) => a + (Number(i.weightKg) || 0), 0);
  const check = () => {
    if (step >= 3) return true;
    const errs = validate(F[step], v, lang);
    if (step === 1) { if (!v.items.length) errs.items = t('common.required'); if (weight <= 0 || weight > 25) errs.items = lang === 'ar' ? 'الوزن الإجمالي بين 0.1 و25 كجم' : 'Total weight between 0.1 and 25 kg'; }
    if (step === 2 && v.pickupWindowEnd && v.pickupWindowStart && Date.parse(v.pickupWindowEnd) <= Date.parse(v.pickupWindowStart)) errs.pickupWindowEnd = lang === 'ar' ? 'النهاية يجب أن تكون بعد البداية' : 'End must be after start';
    if (step === 2 && Date.parse(v.pickupWindowStart) < Date.now() - 15 * 60_000) errs.pickupWindowStart = lang === 'ar' ? 'لا يمكن الجدولة في الماضي' : 'Cannot schedule in the past';
    setE(errs); return !Object.keys(errs).length;
  };
  // تحقق مباشر: بعد أول محاولة يُعاد التحقق عند كل تعديل فتختفي الأخطاء فور تصحيحها
  useEffect(() => { if (Object.keys(e).length) check(); }, [v]); // eslint-disable-line
  useEffect(() => {
    if (step !== 3) return; setQuote(null); setQErr(null);
    transport().exec('shipment.quote', { organizationId: v.organizationId, thermalClass: v.thermalClass, serviceLevel: v.serviceLevel, senderAddressId: v.senderAddressId, receiverAddressId: v.receiverAddressId, weightKg: weight, dedicatedBox: v.dedicatedBox }).then(setQuote).catch((err: any) => setQErr(err.message?.[lang] ?? String(err)));
  }, [step]); // eslint-disable-line
  const submit = async (submitNow: boolean) => {
    const s: any = await run('shipment.create', { ...v, branchId: v.branchId || null, pickupWindowStart: new Date(v.pickupWindowStart).toISOString(), pickupWindowEnd: new Date(v.pickupWindowEnd).toISOString(), submit: submitNow, receiverOrgId: L.addr(v.receiverAddressId)?.organizationId ?? null }, { success: lang === 'ar' ? 'تم إنشاء الشحنة' : 'Shipment created' });
    go((portal ? '/shipments/' : '/shipments/') + s.id);
  };
  const ITEMS = [['BLOOD_TUBES', 'أنابيب دم', 'Blood tubes'], ['TISSUE_BIOPSY', 'خزعة نسيجية', 'Tissue biopsy'], ['SWAB_PCR', 'مسحة PCR', 'PCR swab'], ['URINE_CULTURE', 'مزرعة بول', 'Urine culture'], ['CSF_SAMPLE', 'عينة سائل نخاعي', 'CSF sample'], ['SERUM_ALIQUOT', 'عينة مصل', 'Serum aliquot']];
  return (
    <Page title={t('ship.create')} crumbs={[{ label: t('nav.shipments'), href: '#/shipments' }, { label: t('nav.newShipment') }]} sub={portal ? undefined : (lang === 'ar' ? 'إنشاء نيابة عن العميل — يُسجَّل في سجل التدقيق' : 'Created on behalf of the customer — recorded in the audit log')}>
      <ol className="steps" aria-label={lang === 'ar' ? `الخطوة ${step + 1} من ${steps.length}` : `Step ${step + 1} of ${steps.length}`}>{steps.map((s, i) => <motion.li layout key={i} aria-current={i === step ? 'step' : undefined} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</motion.li>)}</ol>
      <Section>
        {step < 3 && <FormFields fields={F[step]} values={v} set={(n, val) => { set(n, val); if (n === 'organizationId') setV((o) => ({ ...o, organizationId: val, branchId: '', senderAddressId: '' })); }} errors={e} />}
        {step === 1 && <div className="page">
          <h2>{t('ship.items')}</h2>
          {e.items && <span className="ferr">{e.items}</span>}
          {v.items.map((it: any, i: number) => <div key={i} className="row">
            <select aria-label={t('ship.items')} value={it.descriptionCode} onChange={(ev) => set('items', v.items.map((y: any, j: number) => (j === i ? { ...y, descriptionCode: ev.target.value } : y)))}>{ITEMS.map(([c, a, b]) => <option key={c} value={c}>{lang === 'ar' ? a : b}</option>)}</select>
            <label className="row">{t('ship.quantity')} <input type="number" min={1} max={50} style={{ width: 80 }} value={it.quantity} onChange={(ev) => set('items', v.items.map((y: any, j: number) => (j === i ? { ...y, quantity: Number(ev.target.value) } : y)))} /></label>
            <label className="row">{t('ship.weight')} <input type="number" min={0.1} step={0.1} style={{ width: 90 }} value={it.weightKg} onChange={(ev) => set('items', v.items.map((y: any, j: number) => (j === i ? { ...y, weightKg: Number(ev.target.value) } : y)))} /></label>
            <Btn kind="ghost" onClick={() => set('items', v.items.filter((_: any, j: number) => j !== i))} disabled={v.items.length === 1}>{t('common.delete')}</Btn>
          </div>)}
          <div><Btn onClick={() => set('items', [...v.items, { descriptionCode: 'SWAB_PCR', quantity: 1, weightKg: 0.5 }])}>{t('common.add')}</Btn> <span className="muted">{t('common.total')}: {f.num(weight, 1)} {lang === 'ar' ? 'كجم' : 'kg'}</span></div>
        </div>}
        {step === 3 && <div className="grid">
          <DL items={[[t('common.customer'), x(org?.legalName)], [t('common.branch'), L.branch(v.branchId)], [t('ship.sender'), x(L.addr(v.senderAddressId)?.label)], [t('ship.receiver'), x(L.addr(v.receiverAddressId)?.label)], [t('ship.thermalClass'), label(lang, v.thermalClass)], [t('ship.serviceLevel'), label(lang, v.serviceLevel)], [t('ship.pickupWindow'), `${f.dt(new Date(v.pickupWindowStart).toISOString())} – ${f.dt(new Date(v.pickupWindowEnd).toISOString())}`], [t('ship.weight'), f.num(weight, 1)]]} />
          <div className="card" style={{ background: 'var(--sunk)' }}>
            <h2>{t('ship.price')}</h2>
            {qErr ? <div className="state err">{qErr}</div> : !quote ? <Loading /> : <div className="price">
              <span>{lang === 'ar' ? 'الأساس' : 'Base'}{quote.snapshot.coveredByContract && <> · <Pill tone="good">{t('ship.coveredByContract')}</Pill></>}</span><span className="num">{quote.snapshot.coveredByContract ? <s>{f.sar(quote.snapshot.base)}</s> : f.sar(quote.snapshot.base)}</span>
              <span>{lang === 'ar' ? 'الوزن الزائد' : 'Extra weight'}</span><span className="num">{f.sar(quote.snapshot.weight)}</span>
              <span>{lang === 'ar' ? 'رسم مستوى الخدمة' : 'Service level'}</span><span className="num">{f.sar(quote.snapshot.levelSurcharge)}</span>
              <span>{t('ship.dedicatedBox')}</span><span className="num">{f.sar(quote.snapshot.dedicatedBox)}</span>
              <span>{t('ship.vat')}</span><span className="num">{f.sar(quote.snapshot.vat)}</span>
              <b>{t('common.total')}</b><b className="num">{f.sar(quote.total)}</b>
              <span className="muted" style={{ gridColumn: '1/-1' }}>{lang === 'ar' ? `جدول الأسعار — الإصدار ${quote.snapshot.ratePlanVersion} · صالح 24 ساعة` : `Tariff v${quote.snapshot.ratePlanVersion} · valid 24 hours`}</span>
            </div>}
          </div>
        </div>}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Btn onClick={() => (step ? setStep(step - 1) : go(portal ? '/shipments' : '/shipments'))}>{t('common.back')}</Btn>
          {step < 3 ? <Btn kind="primary" onClick={() => check() && setStep(step + 1)}>{t('common.next')}</Btn>
            : <div className="row"><Btn onClick={() => submit(false)} disabled={!quote}>{lang === 'ar' ? 'حفظ كمسودة' : 'Save as draft'}</Btn><Btn kind="primary" onClick={() => submit(true)} disabled={!quote}>{lang === 'ar' ? 'تأكيد الطلب' : 'Confirm request'}</Btn></div>}
        </div>
      </Section>
    </Page>
  );
}

// ================= A06 تفاصيل الشحنة =================
export function ShipmentDetail({ params, portal }: { params: Record<string, string>; portal?: boolean }) {
  const { t, lang, x, me, run } = useApp(); const f = useFmt(); const L = useLookups();
  const d = useQ<any>('shipment.detail', { id: params.id });
  const rep = useQ<any>('shipment.temperatureReport', { id: params.id });
  const [tab, setTab] = useState('overview');
  if (d.error) return <ErrorBox error={d.error} />;
  if (!d.data) return <Loading />;
  const s = d.data.shipment; const tr = d.data.tracking; const roles: string[] = me.roles;
  const ops = roles.some((r) => ['ops_controller', 'super_admin'].includes(r)); const qual = roles.includes('quality');
  const statusLabel = tr.inAir ? 'in_air_transit' : s.status;
  const reasons = [{ value: 'RECIPIENT_UNAVAILABLE', ar: 'المستلم غير متاح', en: 'Recipient unavailable' }, { value: 'ADDRESS_ISSUE', ar: 'مشكلة في العنوان', en: 'Address issue' }, { value: 'REFUSED', ar: 'رفض الاستلام', en: 'Refused' }, { value: 'CUSTOMER_REQUEST', ar: 'طلب العميل', en: 'Customer request' }];
  const lab = me.roles.includes('receiving_lab') && s.receiverOrgId && me.memberships.some((m: any) => m.role === 'receiving_lab' && m.organizationId === s.receiverOrgId);
  const owner = me.organizations?.some((o: any) => o.id === s.organizationId);
  const portalActions = <>
    {owner && ['draft', 'confirmed', 'pickup_scheduled'].includes(s.status) && <ActionForm label={t('ship.reschedule')} title={t('ship.reschedule')} cmd="shipment.reschedule" initial={{ pickupWindowStart: localNow(2), pickupWindowEnd: localNow(4) }} fields={[{ name: 'pickupWindowStart', label: lang === 'ar' ? 'البداية' : 'Start', type: 'datetime', required: true }, { name: 'pickupWindowEnd', label: lang === 'ar' ? 'النهاية' : 'End', type: 'datetime', required: true }]} map={(v) => ({ id: s.id, ...v })} />}
    {owner && s.status === 'draft' && <Btn kind="primary" onClick={() => run('shipment.submit', { id: s.id })}>{t('common.submit')}</Btn>}
    {owner && ['draft', 'confirmed', 'pickup_scheduled'].includes(s.status) && <ActionForm label={t('ship.cancelShipment')} kind="danger" danger title={t('ship.cancelShipment')} cmd="shipment.cancel" intro={lang === 'ar' ? 'لا يمكن الإلغاء قبل أقل من ساعة من الاستلام المجدول.' : 'Cannot cancel within one hour of a scheduled pickup.'} fields={[{ name: 'reason', label: t('common.reason'), type: 'textarea', required: true }]} map={(v) => ({ id: s.id, reason: v.reason, version: s.version })} />}
    {owner && ['failed', 'in_transit', 'at_handover', 'exception'].includes(s.status) && <ActionForm label={t('ship.requestReturn')} title={t('ship.requestReturn')} cmd="returns.request" fields={[{ name: 'reasonCode', label: t('common.reason'), type: 'select', required: true, options: opts(lang, reasons) }, { name: 'alternateAddressId', label: lang === 'ar' ? 'وجهة بديلة معتمدة (اختياري)' : 'Alternate authorized destination (optional)', type: 'select', options: L.addresses.filter((a: any) => a.organizationId === s.organizationId).map((a: any) => ({ value: a.id, label: x(a.label) })) }]} map={(v) => ({ shipment: s.id, reasonCode: v.reasonCode, alternateAddressId: v.alternateAddressId || null })} />}
    {owner && s.status !== 'draft' && <ActionForm label={t('ship.fileClaim')} title={t('ship.fileClaim')} cmd="claim.submit" fields={[{ name: 'claimType', label: lang === 'ar' ? 'النوع' : 'Type', type: 'select', required: true, options: opts(lang, [{ value: 'damage', ar: 'تلف', en: 'Damage' }, { value: 'loss', ar: 'فقدان', en: 'Loss' }, { value: 'delay', ar: 'تأخير', en: 'Delay' }, { value: 'temperature', ar: 'حرارة', en: 'Temperature' }]) }, { name: 'amountSar', label: lang === 'ar' ? 'المبلغ (ر.س)' : 'Amount (SAR)', type: 'number', required: true, min: 1 }, { name: 'description', label: lang === 'ar' ? 'الوصف (10 أحرف على الأقل)' : 'Description (min 10 chars)', type: 'textarea', required: true }]} map={(v) => ({ shipment: s.id, ...v })} success={lang === 'ar' ? 'قُدمت المطالبة' : 'Claim submitted'} />}
    {lab && s.status === 'delivered' && !d.data.disposition && <ActionForm kind="primary" label={lang === 'ar' ? 'تسجيل القرار السريري' : 'Record clinical decision'} title={t('ship.disposition')} cmd="disposition.record" intro={lang === 'ar' ? 'هذا قرار مؤسستكم المستقل؛ لا يستنتجه المشغّل من منحنى الحرارة.' : 'This is your institution’s independent decision; the operator never infers it from the temperature chart.'} fields={[{ name: 'decision', label: lang === 'ar' ? 'القرار' : 'Decision', type: 'select', required: true, options: opts(lang, [{ value: 'accepted', ar: 'مقبولة', en: 'Accepted' }, { value: 'accepted_with_note', ar: 'مقبولة بملاحظة', en: 'Accepted with note' }, { value: 'rejected', ar: 'مرفوضة', en: 'Rejected' }]) }, { name: 'authorizedContact', label: lang === 'ar' ? 'المخوّل بالقرار' : 'Authorized contact', required: true }, { name: 'note', label: t('common.note'), type: 'textarea' }]} map={(v) => ({ shipment: s.id, ...v })} />}
  </>;
  const actions = portal ? portalActions : <>
    {['confirmed', 'pickup_scheduled'].includes(s.status) && ops && <a className="btn primary" href={'#/dispatch?shipment=' + s.id}>{lang === 'ar' ? 'إسناد / إعادة إسناد' : 'Assign / reassign'}</a>}
    {s.status === 'draft' && <Btn kind="primary" onClick={() => run('shipment.submit', { id: s.id })}>{t('common.submit')}</Btn>}
    {['draft', 'confirmed', 'pickup_scheduled'].includes(s.status) && <ActionForm label={t('ship.reschedule')} title={t('ship.reschedule')} cmd="shipment.reschedule" initial={{ pickupWindowStart: localNow(2), pickupWindowEnd: localNow(4) }} fields={[{ name: 'pickupWindowStart', label: lang === 'ar' ? 'البداية' : 'Start', type: 'datetime', required: true }, { name: 'pickupWindowEnd', label: lang === 'ar' ? 'النهاية' : 'End', type: 'datetime', required: true }]} map={(v) => ({ id: s.id, ...v })} />}
    {['draft', 'confirmed', 'pickup_scheduled'].includes(s.status) && <ActionForm label={t('ship.cancelShipment')} kind="danger" danger title={t('ship.cancelShipment')} cmd="shipment.cancel" fields={[{ name: 'reason', label: t('common.reason'), type: 'textarea', required: true }]} map={(v) => ({ id: s.id, reason: v.reason, version: s.version })} />}
    {['in_transit', 'at_handover'].includes(s.status) && ops && <ActionForm label={lang === 'ar' ? 'تسجيل تعذّر التسليم' : 'Record failed delivery'} title={lang === 'ar' ? 'محاولة تسليم فاشلة' : 'Failed attempt'} cmd="courier.failAttempt" fields={[{ name: 'reasonCode', label: t('common.reason'), type: 'select', required: true, options: opts(lang, reasons) }, { name: 'notes', label: t('common.note'), type: 'textarea' }]} map={(v) => ({ shipment: s.id, ...v })} />}
    {['in_transit', 'at_handover', 'exception'].includes(s.status) && ops && d.data.custodian?.type === 'courier' && <ActionForm label={lang === 'ar' ? 'تسليم نيابة عن المندوب' : 'Deliver on courier’s behalf'} title={t('ship.pod')} cmd="courier.deliver" fields={[{ name: 'recipientName', label: t('courier.recipientName'), required: true }, { name: 'signature', label: lang === 'ar' ? 'مرجع التوقيع' : 'Signature reference', required: true }, { name: 'notes', label: t('common.note'), type: 'textarea' }]} map={(v) => ({ shipment: s.id, ...v })} />}
    {s.status === 'failed' && ops && <a className="btn primary" href="#/returns">{lang === 'ar' ? 'اتخاذ القرار' : 'Decide'}</a>}
    {['in_transit', 'at_handover', 'collected'].includes(s.status) && (ops || qual) && s.lostState === 'none' && <ActionForm label={lang === 'ar' ? 'اشتباه فقدان' : 'Suspect loss'} kind="danger" title={lang === 'ar' ? 'فتح اشتباه فقدان' : 'Open suspected loss'} cmd="lost.suspect" intro={lang === 'ar' ? 'صمت GPS وحده لا يكفي (LDM).' : 'GPS silence alone is not sufficient (LDM).'} fields={[{ name: 'basis', label: lang === 'ar' ? 'الأساس' : 'Basis', type: 'multi', required: true, options: opts(lang, [{ value: 'custody_gap', ar: 'فجوة حيازة', en: 'Custody gap' }, { value: 'gps_silence', ar: 'صمت GPS', en: 'GPS silence' }, { value: 'partner_report', ar: 'بلاغ شريك', en: 'Partner report' }, { value: 'customer_report', ar: 'بلاغ عميل', en: 'Customer report' }]) }, { name: 'note', label: t('common.note'), type: 'textarea', required: true }]} map={(v) => ({ shipment: s.id, ...v })} />}
    {['suspected', 'declared'].includes(s.lostState) && <a className="btn" href="#/lost">{lang === 'ar' ? 'سير الفقدان' : 'Loss workflow'}</a>}
    {s.status === 'delivered' && !d.data.disposition && (qual || roles.includes('customer_service')) && <ActionForm label={lang === 'ar' ? 'إدخال قرار المختبر نيابة' : 'Enter lab decision on behalf'} title={t('ship.disposition')} cmd="disposition.record" intro={lang === 'ar' ? 'يُسمح فقط بإرفاق دليل مكتوب من المؤسسة المستلمة (QMS-002).' : 'Allowed only with written evidence from the receiving institution (QMS-002).'} fields={[{ name: 'decision', label: lang === 'ar' ? 'القرار' : 'Decision', type: 'select', required: true, options: opts(lang, [{ value: 'accepted', ar: 'مقبولة', en: 'Accepted' }, { value: 'accepted_with_note', ar: 'مقبولة بملاحظة', en: 'Accepted with note' }, { value: 'rejected', ar: 'مرفوضة', en: 'Rejected' }]) }, { name: 'authorizedContact', label: lang === 'ar' ? 'المخوّل' : 'Authorized contact', required: true }, { name: 'evidenceRef', label: lang === 'ar' ? 'مرجع الدليل' : 'Evidence reference', required: true }, { name: 'note', label: t('common.note'), type: 'textarea' }]} map={(v) => ({ shipment: s.id, ...v })} />}
  </>;
  return (
    <Page title={<><Mono>{s.trackingNo}</Mono> <Pill v={statusLabel} /> {s.lostState !== 'none' && <Pill tone="crit">{lang === 'ar' ? 'فقدان' : 'Loss'}: {s.lostState}</Pill>}</>}
      crumbs={[{ label: t('nav.shipments'), href: '#/shipments' }, { label: s.trackingNo }]}
      sub={<>{x(d.data.organization)}{d.data.branch && <> · {x(d.data.branch)}</>} · {label(lang, s.thermalClass)} · {label(lang, s.serviceLevel)} · {label(lang, s.mode)}{s.createdOnBehalf && <> · {lang === 'ar' ? 'أُنشئت نيابة عن العميل' : 'created on behalf'}</>}</>}
      actions={actions}>
      {d.data.legalHold && <div className="notice warn">{lang === 'ar' ? 'هذه الشحنة تحت حجز قانوني: ' : 'Under legal hold: '}{d.data.legalHold.reason}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: lang === 'ar' ? 'نظرة عامة' : 'Overview' }, { id: 'timeline', label: t('ship.timeline'), count: d.data.timeline.length }, { id: 'temp', label: t('ship.temperature'), count: d.data.excursions.length || undefined },
        { id: 'custody', label: t('ship.custody') }, { id: 'legs', label: t('ship.legs'), count: d.data.legs.length }, { id: 'pod', label: t('ship.pod') }, { id: 'billing', label: t('ship.billing') }, ...(portal ? [] : [{ id: 'quality', label: t('ship.incidents'), count: (d.data.incidents.length + d.data.claims.length) || undefined }]),
      ]} />
      {tab === 'overview' && <div className="grid wide-narrow">
        <Section title={t('common.details')}>
          <DL items={[
            [t('ship.sender'), <>{x(d.data.sender?.label)}<div className="muted">{L.city(s.originCity)}</div></>], [t('ship.receiver'), <>{x(d.data.receiver?.label)}<div className="muted">{L.city(s.destCity)}{d.data.receiverOrg && ` · ${x(d.data.receiverOrg)}`}</div></>],
            [t('ship.pickupWindow'), `${f.dt(s.pickupWindowStart)} – ${f.dt(s.pickupWindowEnd)}`], [t('ship.deliverBy'), f.dt(s.deliverBy)],
            [lang === 'ar' ? 'نوع الطلب' : 'Request type', label(lang, s.requestType)], [t('ship.dedicatedBox'), s.dedicatedBox ? t('common.yes') : t('common.no')],
            [t('ship.items'), d.data.items.map((i: any) => `${label(lang, i.descriptionCode)} ×${i.quantity}`).join(comma(lang))], [lang === 'ar' ? 'الملف الحراري' : 'Thermal profile', <>{x(d.data.profile?.name)} <span className="muted">v{d.data.profile?.version}</span></>],
            [lang === 'ar' ? 'الحيازة الحالية' : 'Current custodian', d.data.custodian ? <>{label(lang, d.data.custodian.type, 'custodian')} · {d.data.custodianName ? x(d.data.custodianName) : d.data.custodian.type === 'courier' ? L.courier(d.data.custodian.id) : d.data.custodian.type.includes('partner') || d.data.custodian.type === 'air_carrier' ? L.partner(d.data.custodian.id) : d.data.custodian.id}</> : '—'],
            [lang === 'ar' ? 'الإصدار' : 'Version', s.version],
          ]} />
        </Section>
        <div className="page">
          <Section title={lang === 'ar' ? 'التتبع' : 'Tracking'}>
            {tr.inAir && <div className="notice">{t('ship.noLiveInFlight')}</div>}
            <DL items={[
              // آخر موقع مؤكد: الوقت والعمر والمصدر وحالة الحداثة — لا يُعرض موقعاً حياً أثناء الطيران أو انقطاع الجهاز
              [t('ship.lastConfirmed'), tr.lastConfirmedPosition ? <>{f.dt(tr.lastConfirmedPosition.at)} <span className="muted">({f.rel(tr.lastConfirmedPosition.at)} · {lang === 'ar' ? 'المصدر' : 'source'}: {label(lang, tr.lastConfirmedPosition.source)})</span> <Pill v={tr.lastConfirmedPosition.isLive ? 'live' : tr.inAir ? 'inferred' : tr.freshness === 'live' ? 'delayed' : tr.freshness} /> <Sim /></> : <span className="muted">{lang === 'ar' ? 'لا يوجد موقع مؤكد بعد' : 'No confirmed position yet'}</span>],
              // آخر قراءة: وقت الجهاز ووقت الاستلام منفصلان (القراءات المخزنة تصل متأخرة)
              [t('ship.lastKnownReading'), tr.lastReading ? <>{f.temp(tr.lastReading.tempC)} · {lang === 'ar' ? 'وقت الجهاز' : 'device time'} {f.dt(tr.lastReading.deviceTime)} · {lang === 'ar' ? 'استُلمت' : 'received'} {f.dt(tr.lastReading.receivedAt)}{tr.lastReading.backfilled && <> <Pill tone="info">{lang === 'ar' ? 'قراءة مخزنة' : 'backfilled'}</Pill></>} <Sim /></> : '—'],
              [lang === 'ar' ? 'عرض الحرارة' : 'Temperature view', tr.temperatureVisibility === 'current' ? (lang === 'ar' ? 'حالية' : 'Current') : (lang === 'ar' ? 'آخر قيمة معروفة فقط' : 'Last known value only')],
              [lang === 'ar' ? 'اتصال الجهاز' : 'Device connectivity', label(lang, tr.deviceConnectivity)], [t('ship.eta'), s.eta ? (s.eta.at ? <>{f.dt(s.eta.at)} <Pill tone="info">{lang === 'ar' ? 'ثقة' : 'confidence'}: {label(lang, s.eta.confidence)}</Pill></> : <Pill tone="mute">{t('ship.etaUnavailable')}</Pill>) : '—'],
            ]} />
            {s.eta?.basis && <p className="muted" style={{ fontSize: '.82rem' }}>{sysText(lang, typeof s.eta.basis === 'string' ? s.eta.basis : x(s.eta.basis))}</p>}
          </Section>
          <Section title={lang === 'ar' ? 'الصندوق' : 'Box'}>
            {!d.data.box ? <Empty text={lang === 'ar' ? 'لم تُعبأ بعد' : 'Not packed yet'} /> : <DL items={[
              [lang === 'ar' ? 'الرمز' : 'Code', portal ? <Mono>{d.data.box.code}</Mono> : <a href={'#/boxes/' + d.data.box.id} className="mono">{d.data.box.code}</a>], [lang === 'ar' ? 'الحجم' : 'Size', d.data.box.size],
              ...(d.data.box.device ? [[lang === 'ar' ? 'جهاز التتبع' : 'Tracker', <a key="d" href={'#/devices/' + d.data.box.device.id} className="mono">{d.data.box.device.imei}</a>] as [string, React.ReactNode]] : []),
              ...(d.data.box.coPacked ? [[lang === 'ar' ? 'شحنات أخرى في الصندوق' : 'Co-packed', d.data.box.coPacked.length ? d.data.box.coPacked.map((c: any) => <div key={c.shipmentId}><ShipLink id={c.shipmentId} no={c.trackingNo} /> · {x(c.organization)}</div>) : t('common.none')] as [string, React.ReactNode]] : []),
            ]} />}
          </Section>
          {!!d.data.delayAlerts?.length && <Section title={t('nav.delays')}>{d.data.delayAlerts.map((a: any) => <div key={a.id} className="row"><Pill v={a.risk} />{x(a.reason)} {a.resolvedAt && <Pill v="closed" />}</div>)}</Section>}
        </div>
      </div>}
      {tab === 'timeline' && <Section title={lang === 'ar' ? 'الخط الزمني الموحّد بالمصادر (MMT)' : 'Unified sourced timeline (MMT)'}><Timeline items={d.data.timeline} /></Section>}
      {tab === 'temp' && <Section title={t('ship.temperature')} actions={<Sim />}>
        {rep.data ? <>
          <TempChart report={rep.data} />
          <Kpis items={[{ label: lang === 'ar' ? 'القراءات' : 'Readings', value: f.num(rep.data.summary.count) }, { label: t('ship.inRange') + ' %', value: rep.data.summary.inRangePct ?? '—', tone: rep.data.summary.inRangePct != null && rep.data.summary.inRangePct < 100 ? 'warn' : 'good' }, { label: lang === 'ar' ? 'دقائق الفجوات' : 'Gap minutes', value: f.num(rep.data.summary.gapMinutes), tone: rep.data.summary.gapMinutes ? 'warn' : undefined }, { label: lang === 'ar' ? 'قراءات مخزنة' : 'Backfilled', value: f.num(rep.data.summary.backfilled) }, { label: lang === 'ar' ? 'أدنى/أعلى' : 'Min/Max', value: `${f.temp(rep.data.summary.minC)} / ${f.temp(rep.data.summary.maxC)}` }]} />
          {rep.data.gaps.length > 0 && <DataTable rows={rep.data.gaps.map((g: any, i: number) => ({ id: String(i), ...g }))} pageSize={5} cols={[{ key: 'from', label: t('common.from'), render: (g: any) => f.dt(g.from) }, { key: 'to', label: t('common.to'), render: (g: any) => f.dt(g.to) }, { key: 'minutes', label: lang === 'ar' ? 'الدقائق' : 'Minutes', num: true }, { key: 'reason', label: t('common.reason'), render: (g: any) => x(g.reason) }]} />}
          {d.data.excursions.map((e: any) => <div key={e.id} className="notice crit">{lang === 'ar' ? 'انحراف' : 'Excursion'} · {lang === 'ar' ? 'ذروة' : 'peak'} {f.temp(e.peakC)} · {f.dt(e.startedAt)} {lang === 'ar' ? '←' : '→'} {e.endedAt ? f.dt(e.endedAt) : (lang === 'ar' ? 'مستمر' : 'ongoing')} · <Pill v={e.status} /> {!portal && <a href="#/excursions">{t('common.open')}</a>}</div>)}
          <p className="muted">{x(rep.data.disclaimer)}</p>
        </> : rep.error ? <ErrorBox error={rep.error} /> : <Loading />}
      </Section>}
      {tab === 'custody' && <Section flush><DataTable rows={d.data.timeline.filter((e: any) => e.kind === 'custody').map((e: any, i: number) => ({ id: String(i), ...e }))} empty={lang === 'ar' ? 'لا أحداث حيازة بعد' : 'No custody events yet'} cols={[{ key: 'at', label: lang === 'ar' ? 'وقت الحدث' : 'Occurred', render: (e: any) => f.dt(e.at) }, { key: 'receivedAt', label: lang === 'ar' ? 'وقت الاستلام' : 'Received', render: (e: any) => f.dt(e.receivedAt) }, { key: 'title', label: lang === 'ar' ? 'النقل' : 'Transfer', render: (e: any) => timelineTitle(lang, e) }, { key: 'detail', label: lang === 'ar' ? 'الدليل' : 'Evidence', render: (e: any) => timelineDetail(lang, e) }, { key: 'source', label: lang === 'ar' ? 'المصدر' : 'Source', render: (e: any) => label(lang, e.source) }]} /></Section>}
      {tab === 'legs' && <Section flush><DataTable rows={d.data.legs} cols={[{ key: 'mode', label: lang === 'ar' ? 'الوسيلة' : 'Mode', render: (l: any) => label(lang, l.mode) }, { key: 'r', label: lang === 'ar' ? 'من/إلى' : 'From/to', render: (l: any) => `${L.city(l.originCity)} ${lang === 'ar' ? '←' : '→'} ${L.city(l.destCity)}` }, { key: 'who', label: lang === 'ar' ? 'المنفذ' : 'Operator', render: (l: any) => x(l.partner) || x(l.courier) || '—' }, { key: 'flightNo', label: lang === 'ar' ? 'الرحلة' : 'Flight', render: (l: any) => l.flightNo ?? '—' }, { key: 'scheduledDeparture', label: lang === 'ar' ? 'المغادرة المخططة' : 'Sched. departure', render: (l: any) => f.dt(l.scheduledDeparture) }, { key: 'actualArrival', label: lang === 'ar' ? 'الوصول الفعلي' : 'Actual arrival', render: (l: any) => f.dt(l.actualArrival) }, { key: 'status', label: t('common.status'), render: (l: any) => <Pill v={l.status} /> }]} /></Section>}
      {tab === 'pod' && <div className="grid">
        <Section title={t('ship.pod')}>{d.data.pod ? <DL items={[[t('courier.recipientName'), d.data.pod.recipientName], [lang === 'ar' ? 'وقت التسليم' : 'Delivered at', f.dt(d.data.pod.deliveredAt)], [lang === 'ar' ? 'التوقيع' : 'Signature', <Mono key="s">{d.data.pod.signature}</Mono>], [lang === 'ar' ? 'الصورة' : 'Photo', d.data.pod.photoRef ?? '—'], [t('common.note'), d.data.pod.notes || '—']]} /> : <Empty text={lang === 'ar' ? 'لم تُسلّم بعد' : 'Not delivered yet'} />}
          {d.data.attempts.map((a: any) => <div key={a.id} className="notice warn">{lang === 'ar' ? 'محاولة فاشلة' : 'Failed attempt'} · {f.dt(a.attemptedAt)} · {label(lang, a.reasonCode)}{a.notes ? ` · ${a.notes}` : ''}</div>)}</Section>
        <Section title={t('ship.disposition')}>{d.data.disposition ? <DL items={[[lang === 'ar' ? 'القرار' : 'Decision', <Pill key="d" tone={d.data.disposition.decision === 'rejected' ? 'crit' : 'good'}>{d.data.disposition.decision}</Pill>], [lang === 'ar' ? 'المخوّل' : 'Authorized', d.data.disposition.authorizedContact], [t('common.date'), f.dt(d.data.disposition.decidedAt)], [lang === 'ar' ? 'نيابة؟' : 'On behalf?', d.data.disposition.onBehalf ? t('common.yes') : t('common.no')]]} /> : <Empty text={t('ship.clinicalDisclaimer')} />}</Section>
      </div>}
      {tab === 'billing' && <div className="grid">
        <Section title={t('ship.price')}>{d.data.quote ? <div className="price"><span>{lang === 'ar' ? 'الأساس' : 'Base'}</span><span className="num">{f.sar(d.data.quote.base)}</span><span>{lang === 'ar' ? 'الإضافات' : 'Add-ons'}</span><span className="num">{f.sar(d.data.quote.weight + d.data.quote.levelSurcharge + d.data.quote.dedicatedBox)}</span><span>{t('ship.vat')}</span><span className="num">{f.sar(d.data.quote.vat)}</span><b>{t('common.total')}</b><b className="num">{f.sar(d.data.quote.total)}</b>{d.data.quote.coveredByContract && <span style={{ gridColumn: '1/-1' }}><Pill tone="good">{t('ship.coveredByContract')}</Pill></span>}</div> : '—'}</Section>
        {d.data.costs && <Section title={lang === 'ar' ? 'التكلفة الموزعة (داخلي)' : 'Allocated cost (internal)'}><p className="num" style={{ fontSize: '1.4rem' }}>{f.sar(d.data.costs.reduce((a: number, c: any) => a + c.amount, 0))}</p><p className="muted">{lang === 'ar' ? 'هامش المساهمة' : 'Contribution'}: {d.data.quote ? f.sar(d.data.quote.subtotal - d.data.costs.reduce((a: number, c: any) => a + c.amount, 0)) : '—'}</p></Section>}
      </div>}
      {tab === 'quality' && <div className="grid">
        <Section title={t('nav.incidents')}>{d.data.incidents.length ? d.data.incidents.map((i: any) => <div key={i.id} className="row"><a href={'#/incidents/' + i.id} className="mono">{i.code}</a> {x(i.title)} <Pill v={i.status} /></div>) : <Empty />}</Section>
        <Section title={t('nav.claims')}>{d.data.claims.length ? d.data.claims.map((c: any) => <div key={c.id} className="row"><Mono>{c.code}</Mono> {f.sar(c.claimedAmount)} <Pill v={c.status} /></div>) : <Empty />}</Section>
        {d.data.lostApprovals?.length > 0 && <Section title={lang === 'ar' ? 'اعتمادات الفقدان' : 'Loss approvals'}>{d.data.lostApprovals.map((a: any) => <div key={a.id}>{t('roles.' + a.approvalRole)} · {label(lang, a.decision)} · {f.dt(a.decidedAt)}</div>)}</Section>}
      </div>}
    </Page>
  );
}

// ================= A07 لوحة التوزيع =================
export function Dispatch() {
  const { t, lang, x, run, me } = useApp(); const f = useFmt(); const L = useLookups();
  const [city, setCity] = useState('');
  const b = useQ<any>('dispatch.board', { city: city || undefined });
  const pre = typeof location !== 'undefined' ? new URLSearchParams(location.hash.split('?')[1] ?? '').get('shipment') : null;
  const [sel, setSel] = useState<string | null>(pre);
  const [courier, setCourier] = useState(''); const [box, setBox] = useState(''); const [apr, setApr] = useState('');
  if (b.error) return <ErrorBox error={b.error} />;
  if (!b.data) return <Loading />;
  const all = [...b.data.unassigned, ...b.data.scheduled];
  const s = all.find((x: any) => x.id === sel);
  const boxes = s ? b.data.boxes.filter((bx: any) => bx.thermalClass === s.thermalClass && bx.status !== 'retired' && bx.status !== 'in_use' || (s && bx.id === s.plannedBoxId)) : [];
  const chosenBox = boxes.find((bx: any) => bx.id === box);
  const approved = b.data.exceptionApprovals.filter((a: any) => s && chosenBox && a.subjectId === `${chosenBox.id}:${s.id}`);
  const canAssign = me.roles.some((r: string) => ['ops_controller', 'super_admin'].includes(r));
  const pickRow = (r: any) => { setSel(r.id); setCourier(r.courierId ?? ''); setBox(r.plannedBoxId ?? ''); setApr(''); };
  const tbl = (rows: any[]) => <DataTable rows={rows} pageSize={8} onRow={pickRow} search={(r: any) => r.trackingNo + ' ' + x(r.organization)} cols={[
    { key: 'trackingNo', label: t('ship.tracking'), render: (r: any) => <span className="mono" style={{ fontWeight: r.id === sel ? 700 : 400 }}>{r.id === sel ? '▸ ' : ''}{r.trackingNo}</span> },
    { key: 'org', label: t('common.customer'), render: (r: any) => x(r.organization) },
    { key: 'thermalClass', label: t('ship.thermalClass'), render: (r: any) => label(lang, r.thermalClass) },
    { key: 'serviceLevel', label: t('ship.serviceLevel'), render: (r: any) => <Pill tone={r.serviceLevel === 'stat' ? 'crit' : r.serviceLevel === 'express' ? 'warn' : 'mute'}>{label(lang, r.serviceLevel)}</Pill> },
    { key: 'pickupWindowStart', label: t('ship.pickupWindow'), render: (r: any) => f.dt(r.pickupWindowStart) },
    { key: 'c', label: lang === 'ar' ? 'المندوب' : 'Courier', render: (r: any) => (r.courierId ? L.courier(r.courierId) : '—'), hideSm: true },
  ]} />;
  return (
    <Page title={t('nav.dispatch')} sub={lang === 'ar' ? 'الإسناد يفحص أهلية المندوب والمركبة والشريك وجاهزية الصندوق وجهازه (BR-009 / DHC).' : 'Assignment checks courier, vehicle and partner eligibility plus box and tracker readiness (BR-009 / DHC).'}
      actions={<select aria-label={t('common.city')} value={city} onChange={(e) => setCity(e.target.value)}><option value="">{t('common.city')}: {t('common.all')}</option>{L.cities.filter((c: any) => c.active).map((c: any) => <option key={c.code} value={c.code}>{x(c.name)}</option>)}</select>}>
      <div className="grid wide-narrow">
        <div className="page">
          <Section title={<>{lang === 'ar' ? 'بانتظار الإسناد' : 'Awaiting assignment'} <span className="count">{b.data.unassigned.length}</span></>} flush>{tbl(b.data.unassigned)}</Section>
          <Section title={<>{lang === 'ar' ? 'مجدولة' : 'Scheduled'} <span className="count">{b.data.scheduled.length}</span></>} flush>{tbl(b.data.scheduled)}</Section>
        </div>
        <Section title={s ? <><Mono>{s.trackingNo}</Mono> · {label(lang, s.thermalClass)}</> : (lang === 'ar' ? 'اختر شحنة' : 'Select a shipment')}>
          {!s ? <Empty text={lang === 'ar' ? 'اختر شحنة من القائمة لإسناد مندوب وصندوق.' : 'Pick a shipment from the list to assign a courier and box.'} /> : <div className="page">
            <DL items={[[t('ship.sender'), x(s.sender)], [t('ship.receiver'), x(s.receiver)], [t('ship.pickupWindow'), f.dt(s.pickupWindowStart)], [t('ship.dedicatedBox'), s.dedicatedBox ? t('common.yes') : t('common.no')]]} />
            <div className="field"><label htmlFor="dc">{lang === 'ar' ? 'المندوب' : 'Courier'}</label>
              <select id="dc" value={courier} onChange={(e) => setCourier(e.target.value)}><option value="">—</option>{b.data.couriers.map((c: any) => <option key={c.id} value={c.id} disabled={c.blockers.length > 0}>{x(c.name)} · {L.city(c.cityCode)} · {c.blockers.length ? '⛔ ' + c.blockers.map((b: string) => ELIGIBILITY_TEXT[b]?.[lang] ?? label(lang, b)).join(lang === 'ar' ? '، ' : ', ') : `${lang === 'ar' ? 'حمولة' : 'load'} ${c.load}`}</option>)}</select>
              <span className="hint">{lang === 'ar' ? 'غير المؤهلين معطّلون مع سبب الحظر' : 'Ineligible couriers are disabled with the blocking reason'}</span></div>
            <div className="field"><label htmlFor="db">{lang === 'ar' ? 'الصندوق' : 'Box'}</label>
              <select id="db" value={box} onChange={(e) => { setBox(e.target.value); setApr(''); }}><option value="">{lang === 'ar' ? 'بدون (يُمسح عند الاستلام)' : 'None (scan at pickup)'}</option>{boxes.map((bx: any) => <option key={bx.id} value={bx.id}>{bx.code} · {bx.size} · {bx.readiness.ready ? '✓' : '⚠ ' + bx.readiness.reasons.map((r: any) => r[lang]).join(comma(lang))}</option>)}</select></div>
            {chosenBox && !chosenBox.readiness.ready && <div className={'notice ' + (chosenBox.readiness.reasons.some((r: any) => !r.overridable) ? 'crit' : 'warn')}>
              <div className="page" style={{ gap: 6 }}>
                <b>{lang === 'ar' ? 'الصندوق غير جاهز' : 'Box not ready'}</b>
                {chosenBox.readiness.reasons.map((r: any) => <span key={r.code}>{r[lang]} {r.overridable ? <Pill tone="warn">{lang === 'ar' ? 'قابل لاستثناء' : 'Exception allowed'}</Pill> : <Pill tone="crit">{lang === 'ar' ? 'إلزامي' : 'Mandatory'}</Pill>}</span>)}
                {approved.find((a: any) => a.status === 'approved') ? <label className="check"><input type="checkbox" checked={!!apr} onChange={(e) => setApr(e.target.checked ? approved.find((a: any) => a.status === 'approved').id : '')} /> {lang === 'ar' ? 'استخدام الاستثناء المعتمد' : 'Use the approved exception'}</label>
                  : approved.find((a: any) => a.status === 'pending') ? <Pill tone="warn">{lang === 'ar' ? 'الاستثناء بانتظار الجودة' : 'Exception awaiting quality'}</Pill>
                  : chosenBox.readiness.reasons.every((r: any) => r.overridable) && canAssign && <ActionForm label={lang === 'ar' ? 'طلب استثناء مضبوط' : 'Request controlled exception'} title={lang === 'ar' ? 'طلب استثناء جاهزية' : 'Readiness exception'} cmd="dispatch.requestException" fields={[{ name: 'reason', label: lang === 'ar' ? 'المبرر' : 'Justification', type: 'textarea', required: true }]} map={(v) => ({ shipmentId: s.id, boxId: chosenBox.id, reason: v.reason })} success={lang === 'ar' ? 'أُرسل الطلب إلى الجودة' : 'Sent to quality'} />}
              </div></div>}
            {canAssign ? <Btn kind="primary" disabled={!courier} onClick={async () => { await run('dispatch.assign', { shipmentId: s.id, courierId: courier, boxId: box || null, exceptionApprovalId: apr || null }, { success: lang === 'ar' ? 'تم الإسناد وإبلاغ المندوب والعميل' : 'Assigned; courier and customer notified' }); setSel(null); }}>{lang === 'ar' ? 'إسناد' : 'Assign'}</Btn> : <p className="muted">{lang === 'ar' ? 'عرض فقط لدورك' : 'Read-only for your role'}</p>}
          </div>}
        </Section>
      </div>
    </Page>
  );
}

// ================= A08 المسارات =================
export function RoutesScreen() {
  const { t, lang, run, toast } = useApp(); const f = useFmt(); const L = useLookups();
  const routes = useList('routes', { sort: 'serviceDate', dir: 'desc' }); const stops = useList('routeStops');
  const ships = useList('shipments');
  const [open, setOpen] = useState<string | null>(null);
  const [hist, setHist] = useState<string[][]>([]); // سجل التراجع: كل عنصر ترتيب سابق
  const [order, setOrder] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<string | null>(null); const [over, setOver] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const r = (routes.data?.items ?? []).find((x: any) => x.id === open);
  const base = (stops.data?.items ?? []).filter((s: any) => s.routeId === open).sort((a: any, b: any) => a.seq - b.seq);
  const st = order ? order.map((id) => base.find((s: any) => s.id === id)).filter(Boolean) : base;
  const tn = (id: string) => (ships.data?.items ?? []).find((s: any) => s.id === id)?.trackingNo ?? id;
  const editable = r && ['planned', 'dispatched', 'in_progress'].includes(r.status);
  /** قواعد التحقق (مطابقة للخادم): التوقفات المنجزة ثابتة في موضعها، واستلام كل شحنة قبل تسليمها */
  const check = (ids: string[]) => {
    const seq = ids.map((id) => base.find((s: any) => s.id === id));
    if (seq.some((s: any, i: number) => s.status === 'done' && base[i].id !== s.id)) return lang === 'ar' ? 'التوقفات المنجزة ثابتة في موضعها ولا يمكن تحريك غيرها فوقها' : 'Completed stops are locked in place';
    for (let i = 0; i < seq.length; i++) for (const sid of seq[i].shipmentIds) if (seq[i].stopType === 'delivery') { const pi = seq.findIndex((x: any) => x.stopType === 'pickup' && x.shipmentIds.includes(sid)); if (pi > i) return lang === 'ar' ? `لا يمكن تسليم ${tn(sid)} قبل استلامها` : `${tn(sid)} cannot be delivered before it is picked up`; }
    return null;
  };
  const apply = (ids: string[]) => { const e = check(ids); if (e) { setErr(e); return false; } setErr(null); setHist([...hist, st.map((s: any) => s.id)]); setOrder(ids); return true; };
  const moveTo = (id: string, target: number) => { const ids = st.map((s: any) => s.id).filter((x: string) => x !== id); ids.splice(target, 0, id); apply(ids); };
  const undo = () => { if (!hist.length) return; const prev = hist[hist.length - 1]; setHist(hist.slice(0, -1)); setOrder(prev.join() === base.map((s: any) => s.id).join() ? null : prev); setErr(null); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && hist.length) { e.preventDefault(); undo(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  const save = async () => { if (!order || !r) return; await run('route.reorder', { routeId: r.id, order }, { success: lang === 'ar' ? 'حُفظ ترتيب التوقفات' : 'Stop order saved' }); setOrder(null); setHist([]); };
  const dirty = !!order && order.join() !== base.map((s: any) => s.id).join();
  return (
    <Page title={t('nav.routes')} sub={lang === 'ar' ? 'مسارات متعددة التوقفات لكل مندوب ويوم (RTE-002) — اسحب التوقفات لإعادة ترتيبها' : 'Multi-stop routes per courier and day (RTE-002) — drag stops to reorder'}>
      <div className="grid">
        <Section flush><DataTable rows={routes.data?.items ?? null} onRow={(x: any) => { setOpen(x.id); setOrder(null); setHist([]); setErr(null); }} search={(x: any) => x.code} filters={[{ key: 'st', label: t('common.status'), options: ['planned', 'dispatched', 'in_progress', 'completed'].map((s) => ({ value: s, label: label(lang, s) })), get: (x: any) => x.status }]} cols={[
          { key: 'code', label: lang === 'ar' ? 'المسار' : 'Route', mono: true }, { key: 'serviceDate', label: t('common.date'), render: (x: any) => f.dt(x.serviceDate) }, { key: 'courier', label: lang === 'ar' ? 'المندوب' : 'Courier', render: (x: any) => L.courier(x.courierId) }, { key: 'stops', label: lang === 'ar' ? 'التوقفات' : 'Stops', num: true, render: (x: any) => (stops.data?.items ?? []).filter((s: any) => s.routeId === x.id).length }, { key: 'plannedDistanceKm', label: lang === 'ar' ? 'كم' : 'km', num: true }, { key: 'status', label: t('common.status'), render: (x: any) => <Pill v={x.status} /> },
        ]} /></Section>
        <Section title={r ? <Mono>{r.code}</Mono> : (lang === 'ar' ? 'اختر مساراً' : 'Select a route')} actions={r && <>
          <Btn kind="ghost" disabled={!hist.length} onClick={undo} title="Ctrl+Z">{lang === 'ar' ? 'تراجع' : 'Undo'}</Btn>
          {dirty && <Btn kind="primary" onClick={save}>{lang === 'ar' ? 'حفظ الترتيب' : 'Save order'}</Btn>}
          {r.status === 'planned' && <Btn disabled={dirty} onClick={() => run('route.dispatch', { routeId: r.id })}>{lang === 'ar' ? 'إرسال المسار' : 'Dispatch'}</Btn>}
        </>}>
          {!r ? <Empty text={lang === 'ar' ? 'اختر مساراً من القائمة لعرض توقفاته' : 'Select a route to see its stops'} /> : <>
            {err && <div className="state err" role="alert">{err}</div>}
            {dirty && <div className="notice warn" role="status">{lang === 'ar' ? 'ترتيب غير محفوظ — احفظه أو تراجع' : 'Unsaved order — save or undo'}</div>}
            <p className="muted" style={{ fontSize: '.82rem' }}>{editable ? (lang === 'ar' ? 'اسحب المقبض أو ركّز عليه واستخدم السهمين للأعلى والأسفل. Ctrl+Z للتراجع.' : 'Drag the handle, or focus it and use the up/down arrows. Ctrl+Z to undo.') : (lang === 'ar' ? 'المسار مكتمل؛ لا يمكن تعديل الترتيب.' : 'Route is completed; order is locked.')}</p>
            <ol className="timeline dnd" aria-label={lang === 'ar' ? 'توقفات المسار' : 'Route stops'}>{st.map((s: any, i: number) => { const locked = !editable || s.status === 'done'; return <motion.li layout transition={{ duration: 0.22 }} key={s.id} className={cx(s.status === 'done' && 'k-pod', locked && 'locked', drag === s.id && 'dragging', over === s.id && 'over')}
              draggable={!locked} onDragStart={(e) => { setDrag(s.id); (e as any).dataTransfer?.setData('text/plain', s.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(s.id); } }} onDrop={(e) => { e.preventDefault(); if (drag && drag !== s.id) moveTo(drag, i); setDrag(null); setOver(null); }}>
              <span className="tdot" /><div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  {!locked && <button className="grip btn ghost" aria-label={(lang === 'ar' ? 'نقل التوقف ' : 'Move stop ') + (i + 1)} onKeyDown={(e) => { if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); moveTo(s.id, i - 1); } if (e.key === 'ArrowDown' && i < st.length - 1) { e.preventDefault(); moveTo(s.id, i + 1); } }}>⋮⋮</button>}
                  <div><b>{i + 1}. {(dictStop as any)[s.stopType]?.[lang]}</b> · {s.shipmentIds.map((x: string) => <ShipLink key={x} id={x} no={tn(x)} />)}<div className="muted">{L.addr(s.addressId) ? (L.addr(s.addressId).label[lang]) : ''} · {f.dt(s.plannedAt)}</div></div>
                </div>
                <Pill v={s.status} />
              </div>
            </motion.li>; })}</ol>
          </>}
        </Section>
      </div>
    </Page>
  );
}
const dictStop = { pickup: { ar: 'استلام', en: 'Pickup' }, delivery: { ar: 'تسليم', en: 'Delivery' }, handover: { ar: 'تسليم لشريك', en: 'Handover' }, warehouse: { ar: 'مستودع', en: 'Warehouse' } };

/** تعارضات مزامنة المندوبين (RTE-003 / NFR-009): قرار العمليات بقبول أو رفض إجراء سُجّل دون اتصال */
function OfflineConflicts() {
  const { lang, run } = useApp(); const f = useFmt(); const L = useLookups(); const c = useList('offlineConflicts', { sort: 'receivedAt', dir: 'desc' }); const sh = useList('shipments');
  const tn = (id: string) => (sh.data?.items ?? []).find((s: any) => s.id === id)?.trackingNo ?? id;
  return <Section title={lang === 'ar' ? 'تعارضات المزامنة دون اتصال' : 'Offline sync conflicts'} flush>
    <DataTable rows={c.data?.items ?? null} empty={lang === 'ar' ? 'لا تعارضات' : 'No conflicts'} filters={[{ key: 'r', label: lang === 'ar' ? 'القرار' : 'Resolution', options: ['pending', 'accepted', 'rejected'].map((v) => ({ value: v, label: label(lang, v) })), get: (r: any) => r.resolution }]}
      expand={(r: any) => <dl className="tldetail"><div><dt>{lang === 'ar' ? 'السبب' : 'Reason'}</dt><dd>{lang === 'en' && r.reasonEn ? r.reasonEn : r.reason}</dd></div><div><dt>{lang === 'ar' ? 'وقت الجهاز' : 'Device time'}</dt><dd>{f.dt(r.occurredAt)}</dd></div><div><dt>{lang === 'ar' ? 'وقت الاستلام' : 'Received'}</dt><dd>{f.dt(r.receivedAt)}</dd></div><div><dt>{lang === 'ar' ? 'معرّف الإجراء' : 'Client action ID'}</dt><dd className="mono">{r.clientActionId}</dd></div></dl>}
      cols={[{ key: 'courierId', label: lang === 'ar' ? 'المندوب' : 'Courier', render: (r: any) => L.courier(r.courierId) }, { key: 'sh', label: lang === 'ar' ? 'الشحنة' : 'Shipment', render: (r: any) => <ShipLink id={r.shipmentId} no={tn(r.shipmentId)} /> }, { key: 'action', label: lang === 'ar' ? 'الإجراء' : 'Action' }, { key: 'occurredAt', label: lang === 'ar' ? 'وقت الجهاز' : 'Device time', render: (r: any) => f.dt(r.occurredAt) }, { key: 'resolution', label: lang === 'ar' ? 'القرار' : 'Resolution', render: (r: any) => <Pill v={r.resolution} /> },
        { key: 'a', label: lang === 'ar' ? 'الإجراءات' : 'Actions', render: (r: any) => r.resolution === 'pending' ? <div className="row"><ActionForm kind="primary" label={lang === 'ar' ? 'قبول' : 'Accept'} title={lang === 'ar' ? 'قبول الإجراء المسجّل دون اتصال' : 'Accept offline action'} cmd="offline.resolve" fields={[{ name: 'note', label: lang === 'ar' ? 'المبرر' : 'Justification', type: 'textarea', required: true }]} map={(v) => ({ id: r.id, resolution: 'accepted', note: v.note })} /><ActionForm label={lang === 'ar' ? 'رفض' : 'Reject'} title={lang === 'ar' ? 'رفض الإجراء' : 'Reject action'} cmd="offline.resolve" fields={[{ name: 'note', label: lang === 'ar' ? 'المبرر' : 'Justification', type: 'textarea', required: true }]} map={(v) => ({ id: r.id, resolution: 'rejected', note: v.note })} /></div> : null }]} />
  </Section>;
}

// ================= A09 أرجل النقل =================
export function Legs() {
  const { t, lang, run } = useApp(); const f = useFmt(); const L = useLookups();
  const legs = useList('legs', { sort: 'scheduledDeparture', dir: 'desc' });
  const air = L.partners.filter((p: any) => p.partnerType === 'air');
  return (
    <Page title={t('nav.legs')} sub={<>{lang === 'ar' ? 'مراحل نقل برية وجوية؛ أحداث الناقل مولّدة تجريبياً' : 'Road and air legs; carrier events are simulated'} <Sim /></>}>
      <Section flush><DataTable rows={legs.data?.items ?? null} csvName="legs" search={(l: any) => `${l.flightNo ?? ''} ${l.originCity} ${l.destCity}`} filters={[{ key: 'mode', label: lang === 'ar' ? 'الوسيلة' : 'Mode', options: ['road', 'air'].map((m) => ({ value: m, label: label(lang, m) })), get: (l: any) => l.mode }, { key: 'st', label: t('common.status'), options: ['planned', 'departed', 'arrived'].map((s) => ({ value: s, label: label(lang, s) })), get: (l: any) => l.status }]} cols={[
        { key: 'mode', label: lang === 'ar' ? 'الوسيلة' : 'Mode', render: (l: any) => label(lang, l.mode) }, { key: 'r', label: lang === 'ar' ? 'المسار' : 'Route', render: (l: any) => `${L.city(l.originCity)} ${lang === 'ar' ? '←' : '→'} ${L.city(l.destCity)}` },
        { key: 'p', label: lang === 'ar' ? 'المنفذ' : 'Operator', render: (l: any) => l.partnerId ? L.partner(l.partnerId) : l.courierId ? L.courier(l.courierId) : '—' }, { key: 'flightNo', label: lang === 'ar' ? 'الرحلة' : 'Flight', render: (l: any) => l.flightNo ?? '—' },
        { key: 'scheduledDeparture', label: lang === 'ar' ? 'المغادرة' : 'Departure', render: (l: any) => f.dt(l.actualDeparture ?? l.scheduledDeparture) }, { key: 'status', label: t('common.status'), render: (l: any) => <Pill v={l.status} /> },
        { key: 'act', label: t('common.actions'), render: (l: any) => <div className="row">
          {l.mode === 'air' && l.status === 'planned' && <ActionForm label={lang === 'ar' ? 'إسناد ناقل' : 'Assign carrier'} title={lang === 'ar' ? 'إسناد ناقل جوي' : 'Assign air carrier'} cmd="leg.assignPartner" fields={[{ name: 'partnerId', label: lang === 'ar' ? 'الناقل' : 'Carrier', type: 'select', required: true, options: air.map((p: any) => ({ value: p.id, label: p.name[lang] })) }, { name: 'flightNo', label: lang === 'ar' ? 'رقم الرحلة' : 'Flight no.', dir: 'ltr' }]} map={(v) => ({ legId: l.id, ...v })} />}
          {l.partnerId && l.status === 'planned' && <Btn onClick={() => run('carrier.event', { legId: l.id, eventType: 'departed' })}>{lang === 'ar' ? 'حدث: غادر' : 'Event: departed'}</Btn>}
          {l.partnerId && l.status === 'departed' && <Btn onClick={() => run('carrier.event', { legId: l.id, eventType: 'arrived' })}>{lang === 'ar' ? 'حدث: وصل' : 'Event: arrived'}</Btn>}
        </div> },
      ]} /></Section>
    </Page>
  );
}

// ================= A10 المندوبون =================
export function Couriers() {
  const { t, lang, x, run } = useApp(); const f = useFmt(); const L = useLookups();
  const b = useQ<any>('dispatch.board', {});
  return (
    <Page title={t('nav.couriers')} actions={<ActionForm kind="primary" label={t('common.add')} title={lang === 'ar' ? 'إضافة مندوب' : 'Add courier'} cmd="courier.create" fields={[{ name: 'nameAr', label: lang === 'ar' ? 'الاسم بالعربية' : 'Name (Arabic)', required: true }, { name: 'nameEn', label: lang === 'ar' ? 'الاسم بالإنجليزية' : 'Name (English)', dir: 'ltr' }, { name: 'cityCode', label: t('common.city'), type: 'select', required: true, options: L.cities.map((c: any) => ({ value: c.code, label: x(c.name) })) }, { name: 'phone', label: t('auth.phone'), required: true, dir: 'ltr', placeholder: '+9665XXXXXXXX', pattern: /^\+9665\d{8}$/, patternMsg: lang === 'ar' ? 'الصيغة ‎+9665XXXXXXXX' : 'Format +9665XXXXXXXX' }, { name: 'partnerId', label: lang === 'ar' ? 'الشريك (اختياري)' : 'Partner (optional)', type: 'select', options: L.partners.filter((p: any) => p.partnerType === 'road').map((p: any) => ({ value: p.id, label: x(p.name) })) }]} map={(v) => ({ ...v, partnerId: v.partnerId || null })} />}>
      <Section flush><DataTable rows={b.data?.couriers ?? null} search={(c: any) => x(c.name)} filters={[{ key: 'city', label: t('common.city'), options: L.cities.map((c: any) => ({ value: c.code, label: x(c.name) })), get: (c: any) => c.cityCode }, { key: 'st', label: t('common.status'), options: ['available', 'on_route', 'off_shift', 'suspended'].map((s) => ({ value: s, label: label(lang, s) })), get: (c: any) => c.status }]} cols={[
        { key: 'name', label: lang === 'ar' ? 'الاسم' : 'Name', render: (c: any) => x(c.name), sort: (c: any) => x(c.name) }, { key: 'employmentType', label: lang === 'ar' ? 'النوع' : 'Type', render: (c: any) => (c.partner ? x(c.partner) : lang === 'ar' ? 'موظف' : 'Employee') }, { key: 'cityCode', label: t('common.city'), render: (c: any) => L.city(c.cityCode) },
        { key: 'status', label: t('common.status'), render: (c: any) => <Pill v={c.status} /> }, { key: 'q', label: lang === 'ar' ? 'التأهيل حتى' : 'Qualified until', render: (c: any) => f.dt(c.qualificationExpiry) }, { key: 'b', label: lang === 'ar' ? 'الأهلية' : 'Eligibility', render: (c: any) => (c.blockers.length ? c.blockers.map((b: string) => <Pill key={b} tone="crit">{ELIGIBILITY_TEXT[b]?.[lang] ?? label(lang, b)}</Pill>) : <Pill tone="good">{lang === 'ar' ? 'مؤهل' : 'Eligible'}</Pill>) },
        { key: 'load', label: lang === 'ar' ? 'توقفات معلقة' : 'Pending stops', num: true },
        { key: 'a', label: t('common.actions'), render: (c: any) => <select aria-label={t('common.status')} value={c.status} onChange={(e) => run('courier.setStatus', { courierId: c.id, status: e.target.value })}>{['available', 'on_route', 'off_shift', 'suspended'].map((s) => <option key={s} value={s}>{label(lang, s)}</option>)}</select> },
      ]} /></Section>
      <OfflineConflicts />
    </Page>
  );
}

// ================= A11 المركبات =================
export function Vehicles() {
  const { t, lang, x } = useApp(); const f = useFmt(); const L = useLookups(); const v = useList('vehicles'); const blocks = useList('blocks');
  return <Page title={t('nav.vehicles')}><Section flush><DataTable rows={v.data?.items ?? null} search={(r: any) => r.registration} cols={[
    { key: 'registration', label: lang === 'ar' ? 'اللوحة' : 'Plate' }, { key: 'type', label: lang === 'ar' ? 'النوع' : 'Type', render: (r: any) => x(r.type) }, { key: 'cityCode', label: t('common.city'), render: (r: any) => L.city(r.cityCode) }, { key: 'p', label: lang === 'ar' ? 'المالك' : 'Owner', render: (r: any) => (r.partnerId ? L.partner(r.partnerId) : lang === 'ar' ? 'الشركة' : 'Company') },
    { key: 'qualificationStatus', label: lang === 'ar' ? 'التأهيل' : 'Qualification', render: (r: any) => <Pill v={r.qualificationStatus === 'failed' ? 'fail' : r.qualificationStatus === 'qualified' ? 'valid' : 'expired'} /> }, { key: 'qualificationExpiry', label: lang === 'ar' ? 'حتى' : 'Until', render: (r: any) => f.dt(r.qualificationExpiry) },
    { key: 'blk', label: lang === 'ar' ? 'حظر' : 'Block', render: (r: any) => ((blocks.data?.items ?? []).some((b: any) => b.scopeId === r.id && !b.resolvedAt) ? <Pill tone="crit">{lang === 'ar' ? 'محظورة' : 'Blocked'}</Pill> : '—') },
  ]} /></Section></Page>;
}

// ================= A12 الشركاء =================
export function Partners() {
  const { t, lang, x } = useApp(); const L = useLookups(); const b = useQ<any>('dispatch.board', {}); const sc = useList('scorecards', { sort: 'periodEnd', dir: 'desc' }); const lic = useList('licenses');
  const [open, setOpen] = useState<string | null>(null);
  const p = (b.data?.partners ?? []).find((y: any) => y.id === open);
  const cards = (sc.data?.items ?? []).filter((s: any) => s.partnerId === open).slice(0, 6).reverse();
  return (
    <Page title={t('nav.partners')} sub={lang === 'ar' ? 'بطاقات الأداء توصي ولا تُسند تلقائياً (PPS)' : 'Scorecards recommend; they never auto-assign (PPS)'}>
      <div className="grid wide-narrow">
        <Section flush><DataTable rows={b.data?.partners ?? null} onRow={(r: any) => setOpen(r.id)} cols={[
          { key: 'name', label: lang === 'ar' ? 'الشريك' : 'Partner', render: (r: any) => x(r.name) }, { key: 'partnerType', label: lang === 'ar' ? 'النوع' : 'Type', render: (r: any) => label(lang, r.partnerType === 'warehouse' ? 'warehouse' : r.partnerType) }, { key: 'cities', label: lang === 'ar' ? 'المدن' : 'Cities', render: (r: any) => r.cities.map((c: string) => L.city(c)).join(comma(lang)) },
          { key: 'score', label: lang === 'ar' ? 'الدرجة' : 'Score', num: true }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> }, { key: 'b', label: lang === 'ar' ? 'الأهلية' : 'Eligibility', render: (r: any) => (r.blockers.length ? <Pill tone="crit">{r.blockers.map((b: string) => ELIGIBILITY_TEXT[b]?.[lang] ?? label(lang, b)).join(lang === 'ar' ? '، ' : ', ')}</Pill> : <Pill tone="good">{lang === 'ar' ? 'مؤهَّل' : 'Eligible'}</Pill>) }, { key: 'settlementCycle', label: lang === 'ar' ? 'دورة التسوية' : 'Settlement', render: (r: any) => label(lang, r.settlementCycle) },
        ]} /></Section>
        <Section title={p ? x(p.name) : (lang === 'ar' ? 'اختر شريكاً' : 'Select a partner')}>
          {!p ? <Empty /> : <>
            <h2>{lang === 'ar' ? 'بطاقة الأداء — آخر 6 أسابيع' : 'Scorecard — last 6 weeks'}</h2>
            <DataTable rows={cards} pageSize={6} cols={[{ key: 'periodEnd', label: lang === 'ar' ? 'الأسبوع' : 'Week', render: (s: any) => new Date(s.periodEnd).toISOString().slice(5, 10) }, { key: 'score', label: lang === 'ar' ? 'الدرجة' : 'Score', num: true }, { key: 'onTimePct', label: lang === 'ar' ? 'في الوقت %' : 'On-time %', num: true }, { key: 'tempCompliancePct', label: lang === 'ar' ? 'التزام حراري %' : 'Temp %', num: true }, { key: 'incidents', label: lang === 'ar' ? 'حوادث' : 'Incidents', num: true }]} />
            <h2>{t('nav.licenses')}</h2>
            {(lic.data?.items ?? []).filter((l: any) => l.holderId === p.id).map((l: any) => <div key={l.id} className="row"><Mono>{l.licenseNo}</Mono><Pill v={l.status} /></div>)}
          </>}
        </Section>
      </div>
    </Page>
  );
}
