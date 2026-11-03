'use client';
import { IS_DEMO } from '@medlog/client';
import { greeting, comma } from '@/lib/l10n';
// بوابة العملاء — الخيار C (قائمة جانبية عائمة بأيقونات ناعمة وتحية شخصية) (C01–C20): المؤسسات والفروع والأفراد ومختبر الاستلام، بلا أي تكلفة داخلية (BI-003)
import React, { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp, useList, useQ, useRoute, go } from '@/lib/store';
import { Btn, ConfirmBtn, DataTable, DL, Empty, ErrorBox, Kpis, Loading, Mono, Page, Pill, Section, Sim, Tabs, Bars, cx, label, useFmt } from '@/lib/ui';
import { Login } from '@/lib/login';
import { ThemeBtn } from '@/lib/theme';
import { PORTAL_ACCOUNTS } from '@/lib/accounts';
import { ShipmentCreate, ShipmentDetail } from '@/admin/ops';
import { ActionForm, ShipLink, localNow, opts, useLookups } from '@/admin/common';

export default function PortalRoot() { return <AppProvider app="portal"><Gate /></AppProvider>; }
const CUST = ['corp_admin', 'branch_manager', 'branch_operator', 'branch_viewer', 'corp_finance', 'individual', 'receiving_lab'];
function Gate() {
  const { userId, me, t, signOut } = useApp();
  useEffect(() => { if (me && !me.roles.some((r: string) => CUST.includes(r))) signOut(); }, [me, signOut]);
  if (!userId) return <Login title={t('app.portal')} subtitle={t('app.name')} accounts={PORTAL_ACCOUNTS} allowed={(r) => r.some((x) => CUST.includes(x))} />;
  if (!me || !me.roles.some((r: string) => CUST.includes(r))) return null;
  return <Shell />;
}

type Item = { path: string; ar: string; en: string; id: string; when?(r: string[]): boolean };
const has = (r: string[], ...x: string[]) => r.some((y) => x.includes(y));
const NAV: Item[] = [
  { id: 'C02', path: '/', ar: 'الرئيسية', en: 'Home', when: (r) => !(r.length === 1 && r[0] === 'receiving_lab') },
  { id: 'C03', path: '/shipments', ar: 'الشحنات', en: 'Shipments', when: (r) => !(r.length === 1 && r[0] === 'receiving_lab') },
  { id: 'C04', path: '/shipments/new', ar: 'شحنة جديدة', en: 'New shipment', when: (r) => has(r, 'corp_admin', 'branch_manager', 'branch_operator', 'individual') },
  { id: 'C08', path: '/recurring', ar: 'الاستلامات المتكررة', en: 'Recurring pickups', when: (r) => has(r, 'corp_admin', 'branch_manager', 'branch_operator') },
  { id: 'C20', path: '/inbound', ar: 'الشحنات الواردة', en: 'Inbound shipments', when: (r) => has(r, 'receiving_lab') },
  { id: 'C09', path: '/addresses', ar: 'العناوين', en: 'Addresses', when: (r) => !(r.length === 1 && r[0] === 'receiving_lab') },
  { id: 'C10', path: '/branches', ar: 'الفروع', en: 'Branches', when: (r) => has(r, 'corp_admin') },
  { id: 'C11', path: '/users', ar: 'المستخدمون', en: 'Users', when: (r) => has(r, 'corp_admin') },
  { id: 'C12', path: '/contracts', ar: 'العقد والاستهلاك', en: 'Contract & usage', when: (r) => has(r, 'corp_admin', 'corp_finance', 'branch_manager') },
  { id: 'C13', path: '/invoices', ar: 'الفواتير والكشوفات', en: 'Invoices & statements', when: (r) => has(r, 'corp_admin', 'corp_finance', 'individual') },
  { id: 'C14', path: '/payments', ar: 'المدفوعات', en: 'Payments', when: (r) => has(r, 'corp_admin', 'corp_finance', 'individual') },
  { id: 'C15', path: '/claims', ar: 'المطالبات', en: 'Claims', when: (r) => !(r.length === 1 && r[0] === 'receiving_lab') },
  { id: 'C17', path: '/reports', ar: 'التقارير والتصدير', en: 'Reports & export', when: (r) => has(r, 'corp_admin', 'corp_finance', 'branch_manager', 'branch_operator', 'branch_viewer') },
  { id: 'C18', path: '/api', ar: 'تكامل API', en: 'API & webhooks', when: (r) => has(r, 'corp_admin') },
  { id: 'C16', path: '/notifications', ar: 'الإشعارات', en: 'Notifications' },
  { id: 'C19', path: '/profile', ar: 'الملف والأمن', en: 'Profile & security' },
];

function Shell() {
  const { t, x, lang, setLang, me, signOut } = useApp();
  const { path, parts } = useRoute();
  const [open, setOpen] = useState(false);
  const roles: string[] = me.roles;
  const items = NAV.filter((i) => !i.when || i.when(roles));
  const labOnly = roles.length === 1 && roles[0] === 'receiving_lab';
  useEffect(() => { if (labOnly && path === '/') go('/inbound'); }, [labOnly, path]);
  useEffect(() => setOpen(false), [path]);
  const ntf = useList('notifications', { sort: 'createdAt', dir: 'desc' });
  const unread = (ntf.data?.items ?? []).filter((n: any) => !n.readAt).length;
  const orgId = me.organizations?.[0]?.id;
  const branchGrants: string[] | null = me.memberships.some((m: any) => ['corp_admin', 'individual', 'corp_finance'].includes(m.role) && !m.branchId) ? null : me.memberships.filter((m: any) => ['branch_operator', 'branch_manager'].includes(m.role)).map((m: any) => m.branchId);
  let screen: React.ReactNode;
  const p0 = '/' + (parts[0] ?? '');
  if (path === '/shipments/new') screen = <ShipmentCreate portal={{ orgId, branchIds: branchGrants }} />;
  else if (parts[0] === 'shipments' && parts[1]) screen = <ShipmentDetail portal params={{ id: parts[1] }} />;
  else if (parts[0] === 'inbound' && parts[1]) screen = <ShipmentDetail portal params={{ id: parts[1] }} />;
  else if (parts[0] === 'invoices' && parts[1]) screen = <InvoiceView id={parts[1]} />;
  else { const it = items.find((i) => i.path === p0); screen = it ? <Screen id={it.id} /> : <div className="state err">{lang === 'ar' ? 'هذه الصفحة غير متاحة لحسابك' : 'This page is not available to your account'}</div>; }
  const PI: Record<string, string> = { C02: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', C03: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', C04: 'M12 5v14M5 12h14', C08: 'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3', C20: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z', C09: 'M12 22s-8-7.5-8-13a8 8 0 0 1 16 0c0 5.5-8 13-8 13zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', C10: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1', C11: 'M17 20h5v-2a3 3 0 0 0-5.4-1.8M9 20H2v-2a4 4 0 0 1 7-2.6M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', C12: 'M6 2h9l5 5v15H6zM14 2v6h6M9 15l2 2 4-4', C13: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6', C14: 'M2 7h20v12H2zM2 11h20M6 15h4', C15: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 8v5M12 16h.01', C17: 'M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6', C18: 'M16 18l6-6-6-6M8 6l-6 6 6 6', C16: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0', C19: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' };
  const PH = ['var(--c-indigo)', 'var(--c-cyan)', 'var(--c-orange)', 'var(--c-violet)', 'var(--c-green)', 'var(--c-amber)', 'var(--c-blue)', 'var(--c-pink)'];
  const initials = x(me.user.name).replace(/^(د\.|م\.|أ\.|Dr\.|Eng\.)\s*/, '').split(' ').filter((w: string) => /\p{L}/u.test(w[0] ?? '')).map((w: string) => w[0]).slice(0, 2).join('');
  return (
    <div className="papp">
      <aside className={cx('pside', open && 'open')} aria-label="navigation">
        <div className="brandb"><span className="logo"><svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27s-10-6.2-10-13.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 10 3.5C26 20.8 16 27 16 27z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /><path d="M10 17h4l2-3 2 5 1.5-2H22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><b>{t('app.short')}</b><span>{t('app.portal')}</span></div></div>
        {items.map((i, k) => <a key={i.path} href={'#' + i.path} className={(i.path === '/' ? path === '/' : path === i.path || path.startsWith(i.path + '/')) ? 'on' : ''} style={{ '--hue': PH[k % PH.length] } as React.CSSProperties}><span className="gtile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PI[i.id] ?? PI.C02} /></svg></span>{lang === 'ar' ? i.ar : i.en}{i.path === '/notifications' && unread > 0 && <span className="badge">{unread}</span>}</a>)}
      </aside>
      <div className="pmain">
        <header className="topbar">
          <Btn kind="ghost" className="hamb iconbtn" onClick={() => setOpen(!open)} aria-label="menu">☰</Btn>
          <div className="greet"><b>{greeting(lang)}{comma(lang)}{x(me.user.name).split(' ').slice(0, 2).join(' ')}</b><span>{me.organizations?.map((o: any) => x(o.legalName)).join('، ')}</span></div>
          <span className="grow" />
          {IS_DEMO && <span className="sim">{t('app.demoBadge')}</span>}
          <Btn kind="ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('common.switchLang')}</Btn>
          <ThemeBtn />
          <a href="#/profile" className="row" style={{ gap: 8, color: 'inherit', textDecoration: 'none' }}><span className="avatar">{initials}</span><span className="who"><b>{x(me.user.name)}</b><span>{roles.map((r) => t('roles.' + r)).join('، ')}</span></span></a>
          <Btn kind="ghost" onClick={signOut}>{t('common.signOut')}</Btn>
        </header>
        <main key={path}>{screen}</main>
      </div>
    </div>
  );
}

function Screen({ id }: { id: string }) {
  switch (id) {
    case 'C02': return <Home />; case 'C03': return <Shipments />; case 'C08': return <Recurring />; case 'C20': return <Inbound />; case 'C09': return <Addresses />; case 'C10': return <Branches />; case 'C11': return <Users />;
    case 'C12': return <Contract />; case 'C13': return <Invoices />; case 'C14': return <Payments />; case 'C15': return <Claims />; case 'C17': return <Reports />; case 'C18': return <Api />; case 'C16': return <Notifications />; case 'C19': return <ProfileP />;
  }
  return null;
}

// C02 لوحة العميل
function Home() {
  const { lang, x, me } = useApp(); const f = useFmt(); const [branch, setBranch] = useState('');
  const d = useQ<any>('customer.dashboard', { branchId: branch || undefined });
  if (d.error) return <ErrorBox error={d.error} />; if (!d.data) return <Loading />;
  const tt = d.data.totals;
  return (
    <Page title={lang === 'ar' ? `مرحباً، ${x(me.user.name)}` : `Welcome, ${x(me.user.name)}`} sub={lang === 'ar' ? 'آخر 30 يوماً' : 'Last 30 days'} actions={<>{d.data.byBranch.length > 1 && <select aria-label="branch" value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">{lang === 'ar' ? 'كل الفروع' : 'All branches'}</option>{d.data.byBranch.map((b: any) => <option key={b.branchId} value={b.branchId}>{x(b.name)}</option>)}</select>}{me.roles.some((r: string) => ['corp_admin', 'branch_operator', 'branch_manager', 'individual'].includes(r)) && <a className="btn primary" href="#/shipments/new">{lang === 'ar' ? 'شحنة جديدة' : 'New shipment'}</a>}</>}>
      <Kpis items={[{ label: lang === 'ar' ? 'شحنات' : 'Shipments', value: tt.shipments, href: '#/shipments' }, { label: lang === 'ar' ? 'نشطة الآن' : 'Active now', value: tt.active }, { label: lang === 'ar' ? 'مسلّمة' : 'Delivered', value: tt.delivered }, { label: lang === 'ar' ? 'في الوقت %' : 'On time %', value: tt.onTimePct ?? '—', tone: tt.onTimePct != null && tt.onTimePct < 90 ? 'warn' : 'good' }, { label: lang === 'ar' ? 'التزام حراري %' : 'Temp compliance %', value: tt.tempCompliancePct ?? '—' }, { label: lang === 'ar' ? 'انحرافات' : 'Excursions', value: tt.excursions, tone: tt.excursions ? 'warn' : undefined }]} />
      <div className="grid wide-narrow">
        <Section title={lang === 'ar' ? 'آخر الشحنات' : 'Recent shipments'} flush><DataTable rows={d.data.recent} pageSize={8} onRow={(s: any) => go('/shipments/' + s.id)} cols={[{ key: 'trackingNo', label: lang === 'ar' ? 'رقم التتبع' : 'Tracking', mono: true }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (s: any) => <Pill v={s.status} /> }, { key: 'thermalClass', label: lang === 'ar' ? 'الفئة' : 'Class', render: (s: any) => label(lang, s.thermalClass) }, { key: 'deliverBy', label: lang === 'ar' ? 'التسليم قبل' : 'Deliver by', render: (s: any) => f.dt(s.deliverBy) }]} /></Section>
        <div className="page">
          {d.data.contracts.map((c: any) => <Section key={c.contractNo} title={<>{lang === 'ar' ? 'العقد' : 'Contract'} <Mono>{c.contractNo}</Mono></>}><meter min={0} max={c.includedShipments} value={c.usedShipments} style={{ width: '100%' }} /><p>{c.usedShipments} / {c.includedShipments} {lang === 'ar' ? 'شحنة مشمولة هذا الشهر' : 'included shipments this month'}</p></Section>)}
          {d.data.openInvoices.length > 0 && <Section title={lang === 'ar' ? 'فواتير مستحقة' : 'Open invoices'}>{d.data.openInvoices.map((i: any) => <a key={i.id} className="row" href={'#/invoices/' + i.id} style={{ justifyContent: 'space-between' }}><Mono>{i.invoiceNo}</Mono><span>{f.sar(i.total - i.paid)}</span><Pill v={i.status} /></a>)}</Section>}
          {d.data.byBranch.length > 0 && <Section title={lang === 'ar' ? 'أداء الفروع' : 'Branch performance'}><Bars height={140} data={d.data.byBranch.map((b: any) => ({ label: x(b.name).slice(0, 14), a: b.shipments }))} /></Section>}
        </div>
      </div>
    </Page>
  );
}

function Shipments() {
  const { lang, x, me } = useApp(); const f = useFmt(); const L = useLookups(); const s = useList('shipments', { sort: 'createdAt', dir: 'desc' });
  return <Page title={lang === 'ar' ? 'الشحنات' : 'Shipments'} sub={lang === 'ar' ? 'تظهر شحنات الفروع المصرح لك بها فقط' : 'Only shipments of branches you are granted appear'} actions={me.roles.some((r: string) => ['corp_admin', 'branch_operator', 'branch_manager', 'individual'].includes(r)) && <a className="btn primary" href="#/shipments/new">{lang === 'ar' ? 'شحنة جديدة' : 'New shipment'}</a>}>
    <Section flush><DataTable rows={s.data?.items ?? null} csvName="my-shipments" onRow={(r: any) => go('/shipments/' + r.id)} search={(r: any) => r.trackingNo} filters={[{ key: 'st', label: lang === 'ar' ? 'الحالة' : 'Status', options: ['confirmed', 'pickup_scheduled', 'collected', 'in_transit', 'delivered', 'failed', 'cancelled', 'draft'].map((v) => ({ value: v, label: label(lang, v) })), get: (r: any) => r.status }, { key: 'br', label: lang === 'ar' ? 'الفرع' : 'Branch', options: L.branches.map((b: any) => ({ value: b.id, label: x(b.name) })), get: (r: any) => r.branchId }]} cols={[{ key: 'trackingNo', label: lang === 'ar' ? 'رقم التتبع' : 'Tracking', mono: true }, { key: 'branchId', label: lang === 'ar' ? 'الفرع' : 'Branch', render: (r: any) => L.branch(r.branchId) }, { key: 'route', label: lang === 'ar' ? 'المسار' : 'Route', render: (r: any) => `${L.city(r.originCity)} ${lang === 'ar' ? '←' : '→'} ${L.city(r.destCity)}` }, { key: 'thermalClass', label: lang === 'ar' ? 'الفئة' : 'Class', render: (r: any) => label(lang, r.thermalClass) }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (r: any) => <Pill v={r.status} /> }, { key: 'pickupWindowStart', label: lang === 'ar' ? 'الاستلام' : 'Pickup', render: (r: any) => f.dt(r.pickupWindowStart) }, { key: 'priceTotal', label: lang === 'ar' ? 'السعر' : 'Price', num: true, render: (r: any) => f.sar(r.priceTotal) }]} /></Section>
  </Page>;
}

function Recurring() {
  const { lang, x, me, run } = useApp(); const L = useLookups(); const r = useList('recurrings');
  const orgId = me.organizations?.[0]?.id;
  return <Page title={lang === 'ar' ? 'الاستلامات المتكررة' : 'Recurring pickups'} actions={<ActionForm kind="primary" label={lang === 'ar' ? 'جدولة جديدة' : 'New schedule'} title={lang === 'ar' ? 'استلام متكرر' : 'Recurring pickup'} cmd="recurring.create" initial={{ rrule: 'weekdays', time: '09:00', thermalClass: 'chilled', serviceLevel: 'standard' }} fields={[{ name: 'branchId', label: lang === 'ar' ? 'الفرع' : 'Branch', type: 'select', required: true, options: L.branches.filter((b: any) => b.organizationId === orgId).map((b: any) => ({ value: b.id, label: x(b.name) })) }, { name: 'senderAddressId', label: lang === 'ar' ? 'من' : 'From', type: 'select', required: true, options: L.addresses.filter((a: any) => a.organizationId === orgId).map((a: any) => ({ value: a.id, label: x(a.label) })) }, { name: 'receiverAddressId', label: lang === 'ar' ? 'إلى' : 'To', type: 'select', required: true, options: L.addresses.map((a: any) => ({ value: a.id, label: x(a.label) })) }, { name: 'thermalClass', label: lang === 'ar' ? 'الفئة' : 'Class', type: 'select', required: true, options: ['chilled', 'frozen', 'ambient'].map((v) => ({ value: v, label: label(lang, v) })) }, { name: 'serviceLevel', label: lang === 'ar' ? 'المستوى' : 'Level', type: 'select', required: true, options: ['standard', 'express', 'stat'].map((v) => ({ value: v, label: label(lang, v) })) }, { name: 'rrule', label: lang === 'ar' ? 'التكرار' : 'Repeat', type: 'select', required: true, options: opts(lang, [{ value: 'daily', ar: 'يومي', en: 'Daily' }, { value: 'weekdays', ar: 'أيام العمل', en: 'Weekdays' }, { value: 'weekly', ar: 'أسبوعي', en: 'Weekly' }]) }, { name: 'time', label: lang === 'ar' ? 'الوقت' : 'Time', required: true, dir: 'ltr', pattern: /^\d{2}:\d{2}$/, placeholder: 'HH:MM' }]} map={(v) => ({ organizationId: orgId, ...v })} />}>
    <Section flush><DataTable rows={r.data?.items ?? null} empty={lang === 'ar' ? 'لا جداول بعد' : 'No schedules yet'} cols={[{ key: 'branchId', label: lang === 'ar' ? 'الفرع' : 'Branch', render: (y: any) => L.branch(y.branchId) }, { key: 'rrule', label: lang === 'ar' ? 'التكرار' : 'Repeat' }, { key: 'time', label: lang === 'ar' ? 'الوقت' : 'Time', mono: true }, { key: 'tc', label: lang === 'ar' ? 'الفئة' : 'Class', render: (y: any) => label(lang, y.template.thermalClass) }, { key: 'active', label: lang === 'ar' ? 'الحالة' : 'Status', render: (y: any) => <Pill tone={y.active ? 'good' : 'mute'}>{y.active ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'موقوف' : 'Paused')}</Pill> }, { key: 'a', label: lang === 'ar' ? 'الإجراءات' : 'Actions', render: (y: any) => <div className="row"><Btn kind="ghost" onClick={() => run('recurring.toggle', { id: y.id, active: !y.active })}>{y.active ? (lang === 'ar' ? 'إيقاف' : 'Pause') : (lang === 'ar' ? 'تفعيل' : 'Resume')}</Btn>{y.active && <Btn onClick={async () => { const s: any = await run('recurring.runNow', { id: y.id }, { success: lang === 'ar' ? 'أُنشئ طلب الاستلام' : 'Pickup request created' }); go('/shipments/' + s.id); }}>{lang === 'ar' ? 'توليد الطلب التالي الآن' : 'Generate next now'}</Btn>}</div> }]} /></Section>
  </Page>;
}

function Inbound() {
  const { lang } = useApp(); const f = useFmt(); const L = useLookups(); const s = useList('shipments', { sort: 'deliverBy', dir: 'desc' }); const d = useList('dispositions');
  const rows = (s.data?.items ?? []);
  return <Page title={lang === 'ar' ? 'الشحنات الواردة' : 'Inbound shipments'} sub={lang === 'ar' ? 'تسجيل القرار السريري حق حصري لمؤسستكم (QMS-002)' : 'Recording the clinical decision is your institution’s exclusive right (QMS-002)'}>
    <Section flush><DataTable rows={s.data ? rows : null} onRow={(r: any) => go('/inbound/' + r.id)} filters={[{ key: 'st', label: lang === 'ar' ? 'الحالة' : 'Status', options: ['in_transit', 'at_handover', 'delivered'].map((v) => ({ value: v, label: label(lang, v) })), get: (r: any) => r.status }]} cols={[{ key: 'trackingNo', label: lang === 'ar' ? 'رقم التتبع' : 'Tracking', mono: true }, { key: 'from', label: lang === 'ar' ? 'من' : 'From', render: (r: any) => L.org(r.organizationId) }, { key: 'thermalClass', label: lang === 'ar' ? 'الفئة' : 'Class', render: (r: any) => label(lang, r.thermalClass) }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (r: any) => <Pill v={r.status} /> }, { key: 'deliverBy', label: lang === 'ar' ? 'متوقع' : 'Expected', render: (r: any) => f.dt(r.deliverBy) }, { key: 'disp', label: lang === 'ar' ? 'القرار' : 'Decision', render: (r: any) => { const y = (d.data?.items ?? []).find((z: any) => z.shipmentId === r.id); return y ? <Pill tone={y.decision === 'rejected' ? 'crit' : 'good'}>{label(lang, y.decision)}</Pill> : r.status === 'delivered' ? <Pill tone="warn">{lang === 'ar' ? 'بانتظار قراركم' : 'Awaiting your decision'}</Pill> : '—'; } }]} /></Section>
  </Page>;
}

function Addresses() {
  const { lang, x, me } = useApp(); const L = useLookups(); const a = useList('addresses');
  const orgId = me.organizations?.[0]?.id; const mine = (a.data?.items ?? []).filter((y: any) => y.organizationId === orgId);
  return <Page title={lang === 'ar' ? 'العناوين المعتمدة' : 'Authorized addresses'} actions={<ActionForm kind="primary" label={lang === 'ar' ? 'عنوان جديد' : 'New address'} title={lang === 'ar' ? 'عنوان معتمد' : 'Authorized address'} cmd="address.create" fields={[{ name: 'labelAr', label: lang === 'ar' ? 'الوصف' : 'Label', required: true }, { name: 'branchId', label: lang === 'ar' ? 'الفرع' : 'Branch', type: 'select', options: L.branches.filter((b: any) => b.organizationId === orgId).map((b: any) => ({ value: b.id, label: x(b.name) })) }, { name: 'cityCode', label: lang === 'ar' ? 'المدينة' : 'City', type: 'select', required: true, options: L.cities.filter((c: any) => c.active).map((c: any) => ({ value: c.code, label: x(c.name) })) }, { name: 'districtAr', label: lang === 'ar' ? 'الحي' : 'District', required: true }, { name: 'contactName', label: lang === 'ar' ? 'جهة الاتصال' : 'Contact', required: true }, { name: 'contactPhone', label: lang === 'ar' ? 'الجوال' : 'Mobile', required: true, dir: 'ltr', placeholder: '+9665XXXXXXXX', pattern: /^\+9665\d{8}$/, patternMsg: '+9665XXXXXXXX' }]} map={(v) => ({ organizationId: orgId, ...v, branchId: v.branchId || null })} />}>
    <Section flush><DataTable rows={a.data ? mine : null} cols={[{ key: 'label', label: lang === 'ar' ? 'العنوان' : 'Address', render: (y: any) => x(y.label) }, { key: 'branchId', label: lang === 'ar' ? 'الفرع' : 'Branch', render: (y: any) => L.branch(y.branchId) }, { key: 'cityCode', label: lang === 'ar' ? 'المدينة' : 'City', render: (y: any) => L.city(y.cityCode) }, { key: 'contactName', label: lang === 'ar' ? 'جهة الاتصال' : 'Contact' }, { key: 'contactPhone', label: lang === 'ar' ? 'الجوال' : 'Mobile', mono: true }]} /></Section>
  </Page>;
}

function Branches() {
  const { lang, x, me, run } = useApp(); const L = useLookups(); const b = useList('branches'); const orgId = me.organizations?.[0]?.id;
  return <Page title={lang === 'ar' ? 'الفروع' : 'Branches'} actions={<ActionForm kind="primary" label={lang === 'ar' ? 'فرع جديد' : 'New branch'} title={lang === 'ar' ? 'إضافة فرع' : 'Add branch'} cmd="branch.create" fields={[{ name: 'nameAr', label: lang === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)', required: true }, { name: 'nameEn', label: lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)', dir: 'ltr' }, { name: 'code', label: lang === 'ar' ? 'الرمز' : 'Code', required: true, dir: 'ltr', pattern: /^[A-Z0-9]{2,6}$/, patternMsg: 'A–Z/0–9, 2–6' }, { name: 'cityCode', label: lang === 'ar' ? 'المدينة' : 'City', type: 'select', required: true, options: L.cities.filter((c: any) => c.active).map((c: any) => ({ value: c.code, label: x(c.name) })) }, { name: 'contactName', label: lang === 'ar' ? 'جهة الاتصال' : 'Contact', required: true }, { name: 'contactPhone', label: lang === 'ar' ? 'الجوال' : 'Mobile', required: true, dir: 'ltr', pattern: /^\+9665\d{8}$/, patternMsg: '+9665XXXXXXXX' }]} map={(v) => ({ organizationId: orgId, ...v })} />}>
    <Section flush><DataTable rows={b.data?.items ?? null} cols={[{ key: 'code', label: lang === 'ar' ? 'الرمز' : 'Code', mono: true }, { key: 'name', label: lang === 'ar' ? 'الفرع' : 'Branch', render: (y: any) => x(y.name) }, { key: 'cityCode', label: lang === 'ar' ? 'المدينة' : 'City', render: (y: any) => L.city(y.cityCode) }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (y: any) => <Pill v={y.status} /> }, { key: 'a', label: lang === 'ar' ? 'الإجراءات' : 'Actions', render: (y: any) => <Btn kind="ghost" onClick={() => run('branch.setStatus', { id: y.id, status: y.status === 'active' ? 'inactive' : 'active' })}>{y.status === 'active' ? (lang === 'ar' ? 'إيقاف' : 'Deactivate') : (lang === 'ar' ? 'تفعيل' : 'Activate')}</Btn> }]} /></Section>
  </Page>;
}

function Users() {
  const { lang, x, t, me, run } = useApp(); const L = useLookups(); const m = useList('memberships'); const u = useList('users'); const orgId = me.organizations?.[0]?.id;
  const rows = (m.data?.items ?? []).filter((y: any) => y.organizationId === orgId);
  return <Page title={lang === 'ar' ? 'المستخدمون والعضويات' : 'Users & memberships'} sub={lang === 'ar' ? 'يمكن منح مستخدم أدواراً مختلفة في فروع مختلفة؛ الإلغاء فوري (MBR)' : 'A user can hold different roles in different branches; revocation is immediate (MBR)'} actions={<ActionForm kind="primary" label={lang === 'ar' ? 'دعوة مستخدم' : 'Invite user'} title={lang === 'ar' ? 'دعوة ضمن نطاق مؤسستك' : 'Invite within your organization'} cmd="user.invite" fields={[{ name: 'email', label: t('auth.email'), type: 'email', required: true, dir: 'ltr' }, { name: 'nameAr', label: lang === 'ar' ? 'الاسم' : 'Name', required: true }, { name: 'role', label: lang === 'ar' ? 'الدور' : 'Role', type: 'select', required: true, options: ['branch_manager', 'branch_operator', 'branch_viewer', 'corp_finance'].map((r) => ({ value: r, label: t('roles.' + r) })) }, { name: 'branchId', label: lang === 'ar' ? 'الفرع' : 'Branch', type: 'select', options: L.branches.filter((b: any) => b.organizationId === orgId).map((b: any) => ({ value: b.id, label: x(b.name) })) }]} map={(v) => ({ ...v, organizationId: orgId, branchId: v.branchId || null })} success={lang === 'ar' ? 'أُرسلت الدعوة (محاكاة)' : 'Invitation sent (simulated)'} />}>
    <Section flush><DataTable rows={m.data ? rows : null} cols={[{ key: 'u', label: lang === 'ar' ? 'المستخدم' : 'User', render: (y: any) => x((u.data?.items ?? []).find((z: any) => z.id === y.userId)?.name) }, { key: 'e', label: t('auth.email'), mono: true, render: (y: any) => (u.data?.items ?? []).find((z: any) => z.id === y.userId)?.email }, { key: 'role', label: lang === 'ar' ? 'الدور' : 'Role', render: (y: any) => t('roles.' + y.role) }, { key: 'branchId', label: lang === 'ar' ? 'النطاق' : 'Scope', render: (y: any) => (y.branchId ? L.branch(y.branchId) : lang === 'ar' ? 'كل الفروع' : 'All branches') }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (y: any) => <Pill v={y.status} /> }, { key: 'a', label: lang === 'ar' ? 'الإجراءات' : 'Actions', render: (y: any) => (y.status === 'active' && y.userId !== me.user.id ? <ConfirmBtn kind="danger" message={lang === 'ar' ? 'ستُلغى العضوية وجلسات المستخدم فوراً.' : 'The membership and the user’s sessions are revoked immediately.'} onConfirm={() => run('membership.revoke', { membershipId: y.id })}>{lang === 'ar' ? 'إلغاء' : 'Revoke'}</ConfirmBtn> : null) }]} /></Section>
  </Page>;
}

function Contract() {
  const { lang } = useApp(); const f = useFmt(); const c = useList('contracts');
  return <Page title={lang === 'ar' ? 'العقد والاستهلاك' : 'Contract & usage'}>{(c.data?.items ?? []).map((y: any) => <Section key={y.id} title={<><Mono>{y.contractNo}</Mono> <Pill v={y.status} /></>}><DL items={[[lang === 'ar' ? 'الدورة' : 'Cycle', label(lang, y.billingCycle)], [lang === 'ar' ? 'السريان' : 'Valid', `${f.dt(y.validFrom).split(' ')[0]} – ${f.dt(y.validTo).split(' ')[0]}`], [lang === 'ar' ? 'الرسم الشهري' : 'Monthly fee', f.sar(y.monthlyFee)], [lang === 'ar' ? 'الاستهلاك' : 'Usage', `${y.usedShipments} / ${y.includedShipments}`]]} />{y.includedShipments > 0 && <meter min={0} max={y.includedShipments} value={y.usedShipments} style={{ width: '100%' }} />}</Section>)}{c.data && !c.data.items.length && <Empty />}</Page>;
}

function Invoices() {
  const { lang } = useApp(); const f = useFmt(); const i = useList('invoices', { sort: 'issueDate', dir: 'desc' }); const cn = useList('creditNotes');
  const rows = i.data?.items ?? null;
  return <Page title={lang === 'ar' ? 'الفواتير والكشوفات' : 'Invoices & statements'} sub={<>ZATCA <Sim /></>}>
    {rows && <Kpis items={[{ label: lang === 'ar' ? 'المستحق' : 'Outstanding', value: f.sar(rows.filter((r: any) => ['issued', 'partially_paid', 'overdue'].includes(r.status)).reduce((a: number, r: any) => a + r.total - r.paid, 0)) }, { label: lang === 'ar' ? 'متأخرة' : 'Overdue', value: rows.filter((r: any) => r.status === 'overdue').length, tone: rows.some((r: any) => r.status === 'overdue') ? 'crit' : undefined }, { label: lang === 'ar' ? 'إشعارات دائنة' : 'Credit notes', value: f.sar((cn.data?.items ?? []).reduce((a: number, c: any) => a + c.amount, 0)) }]} />}
    <Section flush><DataTable rows={rows} csvName="statement" onRow={(r: any) => go('/invoices/' + r.id)} filters={[{ key: 'st', label: lang === 'ar' ? 'الحالة' : 'Status', options: ['issued', 'partially_paid', 'paid', 'overdue'].map((v) => ({ value: v, label: label(lang, v) })), get: (r: any) => r.status }]} cols={[{ key: 'invoiceNo', label: lang === 'ar' ? 'الفاتورة' : 'Invoice', mono: true }, { key: 'issueDate', label: lang === 'ar' ? 'الإصدار' : 'Issued', render: (r: any) => f.dt(r.issueDate) }, { key: 'dueDate', label: lang === 'ar' ? 'الاستحقاق' : 'Due', render: (r: any) => f.dt(r.dueDate) }, { key: 'total', label: lang === 'ar' ? 'الإجمالي' : 'Total', num: true, render: (r: any) => f.sar(r.total) }, { key: 'bal', label: lang === 'ar' ? 'المتبقي' : 'Balance', num: true, render: (r: any) => f.sar(r.total - r.paid) }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (r: any) => <Pill v={r.status} /> }]} /></Section>
  </Page>;
}
function InvoiceView({ id }: { id: string }) {
  const { lang, x, me, run } = useApp(); const f = useFmt(); const i = useList('invoices'); const l = useList('invoiceLines'); const cn = useList('creditNotes');
  const inv = (i.data?.items ?? []).find((y: any) => y.id === id);
  if (!i.data) return <Loading />; if (!inv) return <ErrorBox error={{ message: { ar: 'غير موجودة', en: 'Not found' } }} />;
  const credited = (cn.data?.items ?? []).filter((c: any) => c.invoiceId === id).reduce((a: number, c: any) => a + c.amount, 0);
  const due = inv.total - inv.paid - credited; const canPay = me.roles.some((r: string) => ['corp_admin', 'corp_finance', 'individual'].includes(r)) && due > 0 && ['issued', 'partially_paid', 'overdue'].includes(inv.status);
  return <Page title={<><Mono>{inv.invoiceNo}</Mono> <Pill v={inv.status} /></>} crumbs={[{ label: lang === 'ar' ? 'الفواتير' : 'Invoices', href: '#/invoices' }, { label: inv.invoiceNo }]} actions={canPay && <><ActionForm kind="primary" label={lang === 'ar' ? `دفع ${f.sar(due)}` : `Pay ${f.sar(due)}`} title={lang === 'ar' ? 'دفع إلكتروني (محاكاة)' : 'Online payment (simulated)'} intro={<><Sim /> {lang === 'ar' ? 'مزود الدفع غير محدد بعد؛ لا تُخصم أي مبالغ.' : 'No payment provider is selected yet; nothing is charged.'}</>} cmd="customer.payInvoice" initial={{ method: 'card_simulated' }} fields={[{ name: 'method', label: lang === 'ar' ? 'الطريقة' : 'Method', type: 'select', required: true, options: opts(lang, [{ value: 'card_simulated', ar: 'بطاقة مدى/فيزا (محاكاة)', en: 'mada/Visa card (simulated)' }, { value: 'sadad_simulated', ar: 'سداد (محاكاة)', en: 'SADAD (simulated)' }]) }, { name: 'simulateFailure', label: lang === 'ar' ? 'اختبار' : 'Test', type: 'checkbox', placeholder: lang === 'ar' ? 'محاكاة رفض العملية' : 'Simulate a declined payment' }]} map={(v) => ({ invoiceId: id, ...v })} success={lang === 'ar' ? 'تم الدفع — الإيصال في المدفوعات' : 'Paid — receipt in Payments'} /></>}>
    <Kpis items={[{ label: lang === 'ar' ? 'الإجمالي' : 'Total', value: f.sar(inv.total) }, { label: lang === 'ar' ? 'المدفوع' : 'Paid', value: f.sar(inv.paid), tone: 'good' }, { label: lang === 'ar' ? 'إشعارات دائنة' : 'Credited', value: f.sar(credited) }, { label: lang === 'ar' ? 'المتبقي' : 'Balance', value: f.sar(due), tone: due > 0 ? 'warn' : 'good' }]} />
    <Section flush><DataTable rows={(l.data?.items ?? []).filter((y: any) => y.invoiceId === id)} cols={[{ key: 'description', label: lang === 'ar' ? 'الوصف' : 'Description', render: (y: any) => x(y.description) }, { key: 'sh', label: lang === 'ar' ? 'الشحنة' : 'Shipment', render: (y: any) => (y.shipmentId ? <ShipLink id={y.shipmentId} /> : '—') }, { key: 'unitPrice', label: lang === 'ar' ? 'قبل الضريبة' : 'Net', num: true, render: (y: any) => f.sar(y.unitPrice * y.qty) }, { key: 'vat', label: lang === 'ar' ? 'الضريبة' : 'VAT', num: true, render: (y: any) => f.sar(y.vat) }, { key: 'lineTotal', label: lang === 'ar' ? 'الإجمالي' : 'Total', num: true, render: (y: any) => f.sar(y.lineTotal) }]} /></Section>
  </Page>;
}

function Payments() {
  const { lang } = useApp(); const f = useFmt(); const p = useList('payments', { sort: 'receivedAt', dir: 'desc' });
  return <Page title={lang === 'ar' ? 'المدفوعات والإيصالات' : 'Payments & receipts'}><Section flush><DataTable rows={p.data?.items ?? null} cols={[{ key: 'ref', label: lang === 'ar' ? 'الإيصال' : 'Receipt', mono: true }, { key: 'receivedAt', label: lang === 'ar' ? 'التاريخ' : 'Date', render: (r: any) => f.dt(r.receivedAt) }, { key: 'amount', label: lang === 'ar' ? 'المبلغ' : 'Amount', num: true, render: (r: any) => f.sar(r.amount) }, { key: 'method', label: lang === 'ar' ? 'الطريقة' : 'Method', render: (r: any) => <>{label(lang, r.method)}{r.method.includes('simulated') && <> <Sim /></>}</> }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (r: any) => <Pill v={r.status} d="outcome" /> }]} /></Section></Page>;
}

function Claims() {
  const { lang } = useApp(); const f = useFmt(); const c = useList('claims', { sort: 'createdAt', dir: 'desc' }); const s = useList('shipments');
  return <Page title={lang === 'ar' ? 'المطالبات' : 'Claims'} sub={lang === 'ar' ? 'تقدَّم المطالبة من صفحة الشحنة' : 'File a claim from the shipment page'}><Section flush><DataTable rows={c.data?.items ?? null} empty={lang === 'ar' ? 'لا مطالبات' : 'No claims'} cols={[{ key: 'code', label: lang === 'ar' ? 'الرقم' : 'No.', mono: true }, { key: 'sh', label: lang === 'ar' ? 'الشحنة' : 'Shipment', render: (r: any) => <ShipLink id={r.shipmentId} no={(s.data?.items ?? []).find((y: any) => y.id === r.shipmentId)?.trackingNo} /> }, { key: 'claimType', label: lang === 'ar' ? 'النوع' : 'Type' }, { key: 'claimedAmount', label: lang === 'ar' ? 'المطالب' : 'Claimed', num: true, render: (r: any) => f.sar(r.claimedAmount) }, { key: 'approvedAmount', label: lang === 'ar' ? 'المعتمد' : 'Approved', num: true, render: (r: any) => (['approved', 'rejected', 'closed'].includes(r.status) ? f.sar(r.approvedAmount) : '—') }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (r: any) => <Pill v={r.status} /> }, { key: 'createdAt', label: lang === 'ar' ? 'التاريخ' : 'Date', render: (r: any) => f.dt(r.createdAt) }]} /></Section></Page>;
}

function Reports() {
  const { lang, x } = useApp(); const f = useFmt(); const d = useQ<any>('customer.dashboard', { days: 30 }); const s = useList('shipments');
  if (!d.data) return <Loading />;
  return <Page title={lang === 'ar' ? 'التقارير والتصدير' : 'Reports & export'} sub={lang === 'ar' ? 'التصدير مدقق ويُظهر بيانات فروعك فقط' : 'Exports are audited and include only your branches'}>
    <Section title={lang === 'ar' ? 'أداء الفروع' : 'Branch performance'} flush><DataTable rows={d.data.byBranch.map((b: any) => ({ id: b.branchId, ...b }))} cols={[{ key: 'name', label: lang === 'ar' ? 'الفرع' : 'Branch', render: (b: any) => x(b.name) }, { key: 'shipments', label: lang === 'ar' ? 'شحنات' : 'Shipments', num: true }, { key: 'onTimePct', label: lang === 'ar' ? 'في الوقت %' : 'On time %', num: true, render: (b: any) => b.onTimePct ?? '—' }]} /></Section>
    <Section title={lang === 'ar' ? 'سجل الشحنات للتصدير' : 'Shipment register for export'} flush><DataTable rows={s.data?.items ?? null} csvName="shipments-export" cols={[{ key: 'trackingNo', label: lang === 'ar' ? 'رقم التتبع' : 'Tracking', mono: true }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (r: any) => label(lang, r.status) }, { key: 'thermalClass', label: lang === 'ar' ? 'الفئة' : 'Class', render: (r: any) => label(lang, r.thermalClass) }, { key: 'createdAt', label: lang === 'ar' ? 'تاريخ الإنشاء' : 'Created', render: (r: any) => f.dt(r.createdAt) }, { key: 'deliverBy', label: lang === 'ar' ? 'التسليم قبل' : 'Deliver by', render: (r: any) => f.dt(r.deliverBy) }, { key: 'priceTotal', label: lang === 'ar' ? 'السعر' : 'Price', num: true, render: (r: any) => f.sar(r.priceTotal) }]} /></Section>
  </Page>;
}

function Api() {
  const { lang, me, run } = useApp(); const f = useFmt(); const w = useList('webhooks'); const k = useList('apiClients'); const orgId = me.organizations?.[0]?.id;
  const [secret, setSecret] = useState<string | null>(null);
  return <Page title={lang === 'ar' ? 'تكامل الأنظمة (API والإشعارات الآلية Webhooks)' : 'API & webhooks'} sub={<>{lang === 'ar' ? 'للربط مع نظام المختبر LIS — توصيل الأحداث محاكاة' : 'For LIS integration — event delivery is simulated'} <Sim /></>}>
    <Section title="Webhooks" actions={<ActionForm label={lang === 'ar' ? 'إضافة' : 'Add'} title="Webhook" cmd="webhook.create" fields={[{ name: 'url', label: 'URL', required: true, dir: 'ltr', pattern: /^https:\/\//, patternMsg: 'HTTPS', placeholder: 'https://' }, { name: 'events', label: lang === 'ar' ? 'الأحداث' : 'Events', type: 'multi', required: true, options: ['shipment.created', 'shipment.delivered', 'cold_chain.excursion_detected', 'invoice.issued'].map((v) => ({ value: v, label: v })) }]} map={(v) => ({ organizationId: orgId, ...v })} />} flush><DataTable rows={w.data?.items ?? null} empty={lang === 'ar' ? 'لا اشتراكات' : 'No subscriptions'} cols={[{ key: 'url', label: 'URL', mono: true }, { key: 'events', label: lang === 'ar' ? 'الأحداث' : 'Events', mono: true, render: (r: any) => r.events.join(', ') }, { key: 'lastDeliveryAt', label: lang === 'ar' ? 'آخر توصيل' : 'Last delivery', render: (r: any) => f.dt(r.lastDeliveryAt) }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (r: any) => <Pill v={r.status} /> }, { key: 'a', label: '', render: (r: any) => <div className="row"><Btn kind="ghost" onClick={() => run('webhook.action', { id: r.id, action: 'test' })}>{lang === 'ar' ? 'اختبار' : 'Test'}</Btn><Btn kind="ghost" onClick={() => run('webhook.action', { id: r.id, action: r.status === 'active' ? 'pause' : 'resume' })}>{r.status === 'active' ? (lang === 'ar' ? 'إيقاف' : 'Pause') : (lang === 'ar' ? 'استئناف' : 'Resume')}</Btn></div> }]} /></Section>
    <Section title={lang === 'ar' ? 'مفاتيح API' : 'API keys'} actions={<Btn onClick={async () => { const c: any = await run('apiClient.create', { organizationId: orgId, name: 'LIS integration', scopes: ['shipments:read', 'shipments:write'] }); setSecret(c.secretOnce); }}>{lang === 'ar' ? 'مفتاح جديد' : 'New key'}</Btn>} flush>
      {secret && <div className="notice warn" style={{ margin: '0 16px' }}>{lang === 'ar' ? 'انسخ المفتاح الآن؛ لن يظهر مرة أخرى:' : 'Copy the key now; it will not be shown again:'} <Mono>{secret}</Mono></div>}
      <DataTable rows={k.data?.items ?? null} cols={[{ key: 'name', label: lang === 'ar' ? 'الاسم' : 'Name' }, { key: 'keyPrefix', label: lang === 'ar' ? 'البادئة' : 'Prefix', mono: true }, { key: 'scopes', label: lang === 'ar' ? 'النطاقات' : 'Scopes', mono: true, render: (r: any) => r.scopes.join(', ') }, { key: 'status', label: lang === 'ar' ? 'الحالة' : 'Status', render: (r: any) => <Pill v={r.status} /> }, { key: 'a', label: '', render: (r: any) => (r.status === 'active' ? <ConfirmBtn kind="danger" message={lang === 'ar' ? 'سيتوقف التكامل الذي يستخدم المفتاح.' : 'Integrations using the key stop working.'} onConfirm={() => run('apiClient.revoke', { id: r.id })}>{lang === 'ar' ? 'إلغاء' : 'Revoke'}</ConfirmBtn> : null) }]} />
    </Section>
  </Page>;
}

function Notifications() {
  const { lang, x, run } = useApp(); const f = useFmt(); const n = useList('notifications', { sort: 'createdAt', dir: 'desc' });
  const rows = n.data?.items ?? null;
  return <Page title={lang === 'ar' ? 'الإشعارات' : 'Notifications'} actions={rows && <Btn onClick={() => run('notification.markAllRead', { ids: rows.map((r: any) => r.id) }, { silent: true })}>{lang === 'ar' ? 'تعليم الكل كمقروء' : 'Mark all read'}</Btn>}>
    <Section flush><DataTable rows={rows} onRow={(r: any) => { run('notification.markRead', { id: r.id }, { silent: true }); if (r.link) go(r.link); }} cols={[{ key: 'createdAt', label: lang === 'ar' ? 'الوقت' : 'Time', render: (r: any) => f.dt(r.createdAt) }, { key: 'title', label: lang === 'ar' ? 'الإشعار' : 'Notice', render: (r: any) => <span style={{ fontWeight: r.readAt ? 400 : 600 }}>{x(r.title)}</span> }, { key: 'body', label: lang === 'ar' ? 'التفاصيل' : 'Details', render: (r: any) => x(r.body) }, { key: 'critical', label: '', render: (r: any) => (r.critical ? <Pill tone="crit">{lang === 'ar' ? 'حرج' : 'Critical'}</Pill> : '') }]} /></Section>
  </Page>;
}

function ProfileP() {
  const { lang, setLang, x, me, run } = useApp(); const p = useList('notificationPrefs'); const s = useList('sessions'); const f = useFmt();
  const mine = (p.data?.items ?? []);
  return <Page title={lang === 'ar' ? 'الملف الشخصي والأمن' : 'Profile & security'}>
    <div className="grid">
      <Section title={x(me.user.name)}><DL items={[[lang === 'ar' ? 'البريد' : 'Email', <Mono key="e">{me.user.email}</Mono>], ['MFA', <><Pill key="m" tone={me.user.mfaEnabled ? 'good' : 'warn'}>{me.user.mfaEnabled ? '✓' : '—'}</Pill> <Btn kind="ghost" onClick={() => run('me.setMfa', { enabled: !me.user.mfaEnabled })}>{me.user.mfaEnabled ? (lang === 'ar' ? 'إيقاف' : 'Turn off') : (lang === 'ar' ? 'تفعيل' : 'Turn on')}</Btn></>]]} /></Section>
      <Section title={lang === 'ar' ? 'اللغة' : 'Language'}><div className="row"><Btn kind={lang === 'ar' ? 'primary' : 'default'} onClick={() => setLang('ar')}>العربية</Btn><Btn kind={lang === 'en' ? 'primary' : 'default'} onClick={() => setLang('en')}>English</Btn></div></Section>
      <Section title={lang === 'ar' ? 'قنوات الإشعار' : 'Notification channels'}>{['in_app', 'email', 'sms', 'push'].map((ch) => { const pr = mine.find((y: any) => y.channel === ch); return <label key={ch} className="check"><input type="checkbox" checked={pr?.enabled ?? true} disabled={ch === 'in_app'} onChange={(e) => run('notification.setPref', { channel: ch, enabled: e.target.checked })} /> {label(lang, ch)}</label>; })}</Section>
    </div>
    <Section title={lang === 'ar' ? 'الجلسات' : 'Sessions'} flush><DataTable rows={s.data?.items ?? null} cols={[{ key: 'device', label: lang === 'ar' ? 'الجهاز' : 'Device' }, { key: 'lastSeenAt', label: lang === 'ar' ? 'آخر نشاط' : 'Last seen', render: (r: any) => f.dt(r.lastSeenAt) }, { key: 'st', label: '', render: (r: any) => (r.revokedAt ? <Pill v="revoked" /> : <Btn kind="ghost" onClick={() => run('session.revoke', { sessionId: r.id })}>{lang === 'ar' ? 'إلغاء' : 'Revoke'}</Btn>) }]} /></Section>
  </Page>;
}
void useMemo; void localNow; void Tabs;
