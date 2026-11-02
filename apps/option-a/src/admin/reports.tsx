'use client';
// التقارير التشغيلية والمالية وتنبيهات التأخير (A49–A51)
import React, { useState } from 'react';
import { useApp, useQ, useList } from '@/lib/store';
import { Bars, Btn, DataTable, ErrorBox, Kpis, Loading, Page, Pill, Section, label, useFmt } from '@/lib/ui';
import { ShipLink, useLookups } from './common';

export function ReportsOps() {
  const { t, lang, x } = useApp(); const f = useFmt(); const L = useLookups();
  const [days, setDays] = useState(14); const [city, setCity] = useState('');
  const r = useQ<any>('reports.operations', { days, city: city || undefined });
  if (r.error) return <ErrorBox error={r.error} />; if (!r.data) return <Loading />;
  const tt = r.data.totals;
  return (
    <Page title={t('nav.reportsOps')} actions={<><select aria-label="days" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 14, 30].map((d) => <option key={d} value={d}>{d} {lang === 'ar' ? 'يوماً' : 'days'}</option>)}</select><select aria-label={t('common.city')} value={city} onChange={(e) => setCity(e.target.value)}><option value="">{t('common.city')}: {t('common.all')}</option>{L.cities.map((c: any) => <option key={c.code} value={c.code}>{x(c.name)}</option>)}</select></>}>
      <Kpis items={[{ label: lang === 'ar' ? 'شحنات منشأة' : 'Created', value: f.num(tt.created) }, { label: lang === 'ar' ? 'مسلّمة' : 'Delivered', value: f.num(tt.delivered) }, { label: lang === 'ar' ? 'في الوقت %' : 'On time %', value: tt.onTimePct ?? '—', tone: tt.onTimePct != null && tt.onTimePct < 90 ? 'warn' : 'good' }, { label: lang === 'ar' ? 'التزام حراري %' : 'Temp compliance %', value: tt.tempCompliancePct ?? '—', tone: tt.tempCompliancePct != null && tt.tempCompliancePct < 98 ? 'warn' : 'good' }, { label: lang === 'ar' ? 'حوادث' : 'Incidents', value: tt.incidents, tone: tt.incidents ? 'warn' : undefined }, { label: lang === 'ar' ? 'استغلال الصناديق %' : 'Box utilization %', value: tt.boxUtilizationPct }]} />
      <Section title={lang === 'ar' ? 'الحجم اليومي' : 'Daily volume'}><Bars data={r.data.byDay.map((d: any) => ({ label: d.date.slice(5), a: d.created, b: d.delivered }))} valueLabel={[lang === 'ar' ? 'منشأة' : 'Created', lang === 'ar' ? 'مسلّمة' : 'Delivered']} /></Section>
      <div className="grid">
        <Section title={lang === 'ar' ? 'أداء المسارات' : 'Route performance'} flush><DataTable rows={r.data.byRoute.map((y: any) => ({ id: y.route, ...y }))} pageSize={8} cols={[{ key: 'route', label: lang === 'ar' ? 'المسار' : 'Route', render: (y: any) => y.route.split('→').map((c: string) => L.city(c)).join(' → ') }, { key: 'shipments', label: lang === 'ar' ? 'شحنات' : 'Shipments', num: true }, { key: 'delivered', label: lang === 'ar' ? 'مسلّمة' : 'Delivered', num: true }, { key: 'onTimePct', label: lang === 'ar' ? 'في الوقت %' : 'On time %', num: true, render: (y: any) => y.onTimePct ?? '—' }]} /></Section>
        <Section title={lang === 'ar' ? 'حسب الحالة والفئة' : 'By status and class'}>
          <Bars data={r.data.byStatus.map((y: any) => ({ label: label(lang, y.status).slice(0, 10), a: y.count }))} height={150} />
          <div className="row">{r.data.byThermal.map((y: any) => <Pill key={y.thermalClass} tone="info">{label(lang, y.thermalClass)}: {y.count}</Pill>)}</div>
        </Section>
      </div>
    </Page>
  );
}

export function ReportsFin() {
  const { t, lang, x } = useApp(); const f = useFmt(); const L = useLookups(); const [days, setDays] = useState(90);
  const r = useQ<any>('reports.finance', { days });
  if (r.error) return <ErrorBox error={r.error} />; if (!r.data) return <Loading />;
  return (
    <Page title={t('nav.reportsFin')} sub={lang === 'ar' ? 'داخلي فقط — لا يظهر في أي شاشة عميل (BI-003)' : 'Internal only — never shown on any customer screen (BI-003)'} actions={<select aria-label="days" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[30, 90, 180].map((d) => <option key={d} value={d}>{d} {lang === 'ar' ? 'يوماً' : 'days'}</option>)}</select>}>
      <Kpis items={[{ label: lang === 'ar' ? 'الإيراد' : 'Revenue', value: f.sar(r.data.revenue) }, { label: lang === 'ar' ? 'التكلفة' : 'Cost', value: f.sar(r.data.cost) }, { label: lang === 'ar' ? 'هامش المساهمة' : 'Contribution', value: f.sar(r.data.contribution), tone: r.data.contribution >= 0 ? 'good' : 'crit' }, { label: lang === 'ar' ? 'الهامش %' : 'Margin %', value: r.data.marginPct ?? '—' }]} />
      <Section title={lang === 'ar' ? 'الربحية حسب العميل' : 'Profitability by customer'} flush><DataTable rows={r.data.byCustomer.map((y: any) => ({ id: y.organizationId, ...y }))} csvName="profitability" cols={[{ key: 'name', label: t('common.customer'), render: (y: any) => x(y.name) }, { key: 'revenue', label: lang === 'ar' ? 'الإيراد' : 'Revenue', num: true, render: (y: any) => f.sar(y.revenue) }, { key: 'cost', label: lang === 'ar' ? 'التكلفة الموزعة' : 'Allocated cost', num: true, render: (y: any) => f.sar(y.cost) }, { key: 'margin', label: lang === 'ar' ? 'الهامش' : 'Margin', num: true, render: (y: any) => <span style={{ color: y.margin >= 0 ? 'var(--good)' : 'var(--crit)' }}>{f.sar(y.margin)}</span> }]} /></Section>
      <Section title={lang === 'ar' ? 'حسب مدينة المنشأ' : 'By origin city'} flush><DataTable rows={r.data.byCity.map((y: any) => ({ id: y.city, ...y }))} cols={[{ key: 'city', label: t('common.city'), render: (y: any) => L.city(y.city) }, { key: 'revenue', label: lang === 'ar' ? 'الإيراد' : 'Revenue', num: true, render: (y: any) => f.sar(y.revenue) }, { key: 'cost', label: lang === 'ar' ? 'التكلفة' : 'Cost', num: true, render: (y: any) => f.sar(y.cost) }, { key: 'margin', label: lang === 'ar' ? 'الهامش' : 'Margin', num: true, render: (y: any) => f.sar(y.margin) }]} /></Section>
    </Page>
  );
}

export function Delays() {
  const { t, lang, x, run } = useApp(); const f = useFmt(); const d = useList('delayAlerts', { sort: 'raisedAt', dir: 'desc' }); const sh = useList('shipments');
  const tn = (id: string) => (sh.data?.items ?? []).find((s: any) => s.id === id)?.trackingNo;
  const rows = d.data?.items ?? null;
  const open = (rows ?? []).filter((r: any) => !r.resolvedAt);
  return (
    <Page title={t('nav.delays')} sub={lang === 'ar' ? 'قواعد المرحلة 1 مفسّرة؛ التنبؤ بالتعلم الآلي مؤجل حتى تتوفر بيانات تشغيلية (PDA)' : 'Explained Phase-1 rules; ML prediction deferred until operating evidence exists (PDA)'} actions={<Btn kind="primary" onClick={() => run('delay.runRules', {}, { success: lang === 'ar' ? 'تم تشغيل القواعد' : 'Rules ran' })}>{lang === 'ar' ? 'تشغيل القواعد الآن' : 'Run rules now'}</Btn>}>
      {rows && <Kpis items={[{ label: lang === 'ar' ? 'مفتوحة' : 'Open', value: open.length, tone: open.length ? 'warn' : 'good' }, { label: lang === 'ar' ? 'مخاطر عالية' : 'High risk', value: open.filter((r: any) => r.risk === 'high').length, tone: open.some((r: any) => r.risk === 'high') ? 'crit' : undefined }, { label: lang === 'ar' ? 'مصعّدة' : 'Escalated', value: open.filter((r: any) => r.escalated).length }, { label: lang === 'ar' ? 'أُغلقت' : 'Resolved', value: rows.length - open.length }]} />}
      <Section flush><DataTable rows={rows} filters={[{ key: 'o', label: t('common.status'), options: [{ value: 'o', label: lang === 'ar' ? 'مفتوحة' : 'Open' }, { value: 'c', label: lang === 'ar' ? 'مغلقة' : 'Resolved' }], get: (r: any) => (r.resolvedAt ? 'c' : 'o') }]} cols={[{ key: 'sh', label: t('ship.tracking'), render: (r: any) => <ShipLink id={r.shipmentId} no={tn(r.shipmentId)} /> }, { key: 'risk', label: lang === 'ar' ? 'المخاطرة' : 'Risk', render: (r: any) => <Pill v={r.risk} /> }, { key: 'reason', label: lang === 'ar' ? 'التفسير' : 'Explanation', render: (r: any) => x(r.reason) }, { key: 'ruleVersion', label: lang === 'ar' ? 'القاعدة' : 'Rule', mono: true }, { key: 'raisedAt', label: t('common.date'), render: (r: any) => f.dt(r.raisedAt) }, { key: 'st', label: t('common.status'), render: (r: any) => (r.resolvedAt ? <Pill v="closed" /> : r.escalated ? <Pill tone="crit">{lang === 'ar' ? 'مصعّد' : 'Escalated'}</Pill> : <Pill v="open" />) },
        { key: 'a', label: t('common.actions'), render: (r: any) => (!r.resolvedAt ? <div className="row">{!r.escalated && <Btn onClick={() => run('delay.action', { id: r.id, action: 'escalate' })}>{lang === 'ar' ? 'تصعيد' : 'Escalate'}</Btn>}<Btn kind="ghost" onClick={() => run('delay.action', { id: r.id, action: 'resolve' })}>{lang === 'ar' ? 'إغلاق' : 'Resolve'}</Btn></div> : null) }]} /></Section>
    </Page>
  );
}
