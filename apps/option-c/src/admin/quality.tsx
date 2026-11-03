'use client';
// الجودة: الانحرافات، الملفات الحرارية، الحوادث، CAPA، المطالبات، المفقود، المرتجعات (A19–A25)
import React, { useState } from 'react';
import { useApp, useQ, useList, go } from '@/lib/store';
import { Btn, DataTable, DL, Empty, ErrorBox, Kpis, Loading, Mono, Page, Pill, Section, label, useFmt } from '@/lib/ui';
import { ActionForm, ShipLink, localDate, opts, useLookups } from './common';

export function Excursions() {
  const { t, lang, run, me, toast } = useApp(); const f = useFmt(); const ex = useList('excursions', { sort: 'startedAt', dir: 'desc' }); const sh = useList('shipments');
  const tn = (id: string) => (sh.data?.items ?? []).find((s: any) => s.id === id)?.trackingNo;
  const q = me.roles.includes('quality') || me.roles.includes('super_admin');
  return (
    <Page title={t('nav.excursions')} sub={lang === 'ar' ? 'المسار: الإقرار من العمليات ← مراجعة الجودة (قرار نقل لا قرار سريري) ← حادثة جودة وإجراءات تصحيحية ووقائية (CAPA) عند الحاجة' : 'Flow: operations acknowledge → quality review (transport decision, not clinical) → incident & CAPA if needed'}>
      <Section flush><DataTable rows={ex.data?.items ?? null} bulk={[{ label: lang === 'ar' ? 'إقرار الانحرافات المفتوحة المحددة' : 'Acknowledge selected open', kind: 'primary', run: async (rows: any[]) => { const o = rows.filter((r) => r.status === 'open'); for (const r of o) await run('excursion.acknowledge', { id: r.id }, { silent: true }); toast(lang === 'ar' ? `تم إقرار الانحرافات (${o.length})` : `${o.length} excursion(s) acknowledged`); } }]} expand={(r: any) => <dl className="tldetail"><div><dt>{lang === 'ar' ? 'البداية' : 'Started'}</dt><dd>{f.dt(r.startedAt)}</dd></div><div><dt>{lang === 'ar' ? 'النهاية' : 'Ended'}</dt><dd>{r.endedAt ? f.dt(r.endedAt) : (lang === 'ar' ? 'مستمر' : 'Ongoing')}</dd></div><div><dt>{lang === 'ar' ? 'الذروة' : 'Peak'}</dt><dd dir="ltr">{f.temp(r.peakC)}</dd></div><div><dt>{lang === 'ar' ? 'الحالة' : 'Status'}</dt><dd><Pill v={r.status} /></dd></div>{r.note && <div><dt>{lang === 'ar' ? 'ملاحظة' : 'Note'}</dt><dd>{r.note}</dd></div>}</dl>} filters={[{ key: 'st', label: t('common.status'), options: ['open', 'acknowledged', 'under_review', 'closed'].map((s) => ({ value: s, label: label(lang, s) })), get: (r: any) => r.status }, { key: 'sv', label: lang === 'ar' ? 'الشدة' : 'Severity', options: ['critical', 'major', 'minor'].map((s) => ({ value: s, label: label(lang, s) })), get: (r: any) => r.severity }]} cols={[
        { key: 'sh', label: t('ship.tracking'), render: (r: any) => <ShipLink id={r.shipmentId} no={tn(r.shipmentId)} /> }, { key: 'startedAt', label: lang === 'ar' ? 'البداية' : 'Started', render: (r: any) => f.dt(r.startedAt) }, { key: 'endedAt', label: lang === 'ar' ? 'النهاية' : 'Ended', render: (r: any) => (r.endedAt ? f.dt(r.endedAt) : <Pill tone="crit">{lang === 'ar' ? 'مستمر' : 'Ongoing'}</Pill>) },
        { key: 'peakC', label: lang === 'ar' ? 'الذروة' : 'Peak', render: (r: any) => f.temp(r.peakC) }, { key: 'severity', label: lang === 'ar' ? 'الشدة' : 'Severity', render: (r: any) => <Pill v={r.severity} /> }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> },
        { key: 'a', label: t('common.actions'), render: (r: any) => <div className="row">
          {r.status === 'open' && <Btn onClick={() => run('excursion.acknowledge', { id: r.id }, { success: lang === 'ar' ? 'تم الإقرار' : 'Acknowledged' })}>{lang === 'ar' ? 'إقرار' : 'Acknowledge'}</Btn>}
          {r.status === 'acknowledged' && q && <ActionForm kind="primary" label={lang === 'ar' ? 'مراجعة الجودة' : 'Quality review'} title={lang === 'ar' ? 'قرار مراجعة الجودة' : 'Quality review decision'} cmd="excursion.qualityReview" intro={lang === 'ar' ? 'سجّل قرار النقل فقط. القرار السريري بشأن صلاحية العينة يعود للجهة المستلمة (TEMP-006).' : 'Record the transport decision only. Clinical suitability belongs to the receiving institution (TEMP-006).'} initial={{ openIncident: r.severity !== 'minor' }} fields={[{ name: 'decision', label: lang === 'ar' ? 'القرار والأسباب' : 'Decision and reasons', type: 'textarea', required: true }, { name: 'openIncident', label: lang === 'ar' ? 'فتح حادثة جودة' : 'Open incident', type: 'checkbox', placeholder: lang === 'ar' ? 'فتح حادثة جودة للتحقيق والإجراءات التصحيحية والوقائية (CAPA)' : 'Open a quality incident for investigation and CAPA' }]} map={(v) => ({ id: r.id, decision: v.decision, openIncident: !!v.openIncident })} />}
          {r.incidentId && <a href={'#/incidents/' + r.incidentId}>{t('nav.incidents')}</a>}
        </div> },
      ]} /></Section>
    </Page>
  );
}

const SAMPLE_TYPES = ['BLOOD_TUBES', 'TISSUE_BIOPSY', 'SWAB_PCR', 'URINE_CULTURE', 'CSF_SAMPLE', 'SERUM_ALIQUOT'];
export function Profiles() {
  const { t, lang, x, me } = useApp(); const f = useFmt(); const L = useLookups(); const p = useList('serviceProfiles', { sort: 'effectiveFrom', dir: 'desc' }); const ctr = useList('contracts');
  const ar = lang === 'ar'; const canPropose = me.roles.includes('quality') || me.roles.includes('super_admin');
  const contracts = (ctr.data?.items ?? []).filter((c: any) => c.status === 'active');
  const cNo = (id: string) => (ctr.data?.items ?? []).find((c: any) => c.id === id)?.contractNo ?? id;
  const scopeText = (r: any) => {
    const parts: string[] = [];
    if (r.scope?.contractId) parts.push((ar ? 'اتفاقية خدمة ' : 'Service agreement ') + cNo(r.scope.contractId));
    if (r.scope?.sampleTypes?.length) parts.push((ar ? 'أنواع العينات: ' : 'Sample types: ') + r.scope.sampleTypes.map((s: string) => label(lang, s)).join(ar ? '، ' : ', '));
    return parts.length ? parts.join(' · ') : (ar ? 'الافتراضي للفئة' : 'Class default');
  };
  const st = (r: any) => (r.status === 'retired' ? 'superseded' : r.status);
  return <Page title={t('nav.profiles')} sub={ar ? 'الملف المطبَّق على الشحنة يُختار تلقائياً: ملف اتفاقية الخدمة ثم ملف نوع العينة ثم الافتراضي للفئة — المعتمد والساري فقط.' : 'The profile applied to a shipment is resolved automatically: service-agreement profile, then sample-type profile, then the class default — approved and in effect only.'}
    actions={canPropose ? <ActionForm kind="primary" label={ar ? 'اقتراح ملف حراري' : 'Propose thermal profile'} title={ar ? 'اقتراح ملف حراري جديد' : 'Propose a new thermal profile'} cmd="profile.propose"
      intro={<div className="notice warn">{ar ? 'لا يسري الاقتراح إلا بعد اعتماد مسؤول الامتثال وحلول تاريخ بدء السريان (فصل المهام). لا تُغيَّر المتطلبات الطبية دون مرجع معتمد.' : 'A proposal takes effect only after compliance approval and its effective date (segregation of duties). Medical requirements are never changed without an approved basis.'}</div>}
      initial={{ thermalClass: 'chilled', minC: 4, maxC: 8, toleranceMinutes: 15, effectiveFrom: localDate(7) }}
      fields={[
        { name: 'nameAr', label: ar ? 'الاسم بالعربية' : 'Arabic name', required: true },
        { name: 'nameEn', label: ar ? 'الاسم بالإنجليزية' : 'English name', required: true, dir: 'ltr' },
        { name: 'thermalClass', label: t('ship.thermalClass'), type: 'select', required: true, options: ['chilled', 'frozen', 'ambient'].map((v) => ({ value: v, label: label(lang, v) })) },
        { name: 'toleranceMinutes', label: ar ? 'مهلة السماح (دقيقة)' : 'Tolerance (minutes)', type: 'number', required: true, min: 0, max: 120 },
        { name: 'minC', label: ar ? 'الحد الأدنى (°م)' : 'Minimum (°C)', type: 'number', required: true, step: 0.5 },
        { name: 'maxC', label: ar ? 'الحد الأعلى (°م)' : 'Maximum (°C)', type: 'number', required: true, step: 0.5 },
        { name: 'contractId', label: ar ? 'اتفاقية الخدمة (اختياري)' : 'Service agreement (optional)', type: 'select', options: contracts.map((c: any) => ({ value: c.id, label: `${c.contractNo} — ${L.org(c.organizationId)}` })) },
        { name: 'effectiveFrom', label: ar ? 'تاريخ بدء السريان' : 'Effective from', type: 'date', required: true },
        { name: 'sampleTypes', label: ar ? 'أنواع العينات (اختياري)' : 'Sample types (optional)', type: 'multi', full: true, options: SAMPLE_TYPES.map((v) => ({ value: v, label: label(lang, v) })) },
        { name: 'basis', label: ar ? 'المرجع المعتمد (متطلب العميل أو قرار الجودة)' : 'Approved basis (customer requirement or quality decision)', type: 'textarea', required: true, full: true },
      ]} map={(v) => ({ ...v, minC: Number(v.minC), maxC: Number(v.maxC), toleranceMinutes: Number(v.toleranceMinutes), contractId: v.contractId || null, sampleTypes: v.sampleTypes ?? [], effectiveFrom: new Date(v.effectiveFrom + 'T00:00:00').toISOString() })}
      success={ar ? 'أُرسل الاقتراح لاعتماد الامتثال' : 'Proposal sent for compliance approval'} /> : undefined}>
    <div className="notice">{ar ? 'المبرّد الافتراضي المعتمد: +4 إلى +8 °م (SRS TEMP-001). أي ملف آخر (مثل +2 إلى +8 °م) لا يُطبَّق إلا بنطاق محدد وباعتماد موثّق.' : 'Approved default chilled range: +4 to +8 °C (SRS TEMP-001). Any other profile (e.g. +2 to +8 °C) applies only to a defined scope with documented approval.'}</div>
    <Section flush><DataTable rows={p.data?.items ?? null} filters={[{ key: 'st', label: t('common.status'), options: ['active', 'pending_approval', 'superseded', 'rejected'].map((s) => ({ value: s, label: label(lang, s) })), get: st }, { key: 'tc', label: t('ship.thermalClass'), options: ['chilled', 'frozen', 'ambient'].map((s) => ({ value: s, label: label(lang, s) })), get: (r: any) => r.thermalClass }]}
      expand={(r: any) => <dl className="tldetail">
        <div><dt>{ar ? 'نطاق التطبيق' : 'Scope'}</dt><dd>{scopeText(r)}</dd></div>
        <div><dt>{ar ? 'المرجع المعتمد' : 'Basis'}</dt><dd>{r.basis || '—'}</dd></div>
        <div><dt>{ar ? 'اقترحه' : 'Proposed by'}</dt><dd>{r.proposedBy ? L.user(r.proposedBy) : '—'}</dd></div>
        <div><dt>{ar ? 'اعتمده' : 'Approved by'}</dt><dd>{r.approvedBy ? L.user(r.approvedBy) : (r.status === 'pending_approval' ? (ar ? 'بانتظار اعتماد الامتثال' : 'Awaiting compliance approval') : '—')}</dd></div>
        <div><dt>{ar ? 'ينتهي السريان' : 'Effective to'}</dt><dd>{r.effectiveTo ? f.dt(r.effectiveTo) : '—'}</dd></div>
        <div><dt>{ar ? 'الرمز' : 'Code'}</dt><dd><code className="meta">{r.code}</code></dd></div>
      </dl>}
      cols={[{ key: 'name', label: ar ? 'الملف' : 'Profile', render: (r: any) => x(r.name) }, { key: 'thermalClass', label: t('ship.thermalClass'), render: (r: any) => label(lang, r.thermalClass) }, { key: 'range', label: ar ? 'النطاق' : 'Range', render: (r: any) => <span dir="ltr">{`${r.minC > 0 ? '+' : ''}${r.minC} … ${r.maxC > 0 ? '+' : ''}${r.maxC} °C`}</span> }, { key: 'scope', label: ar ? 'نطاق التطبيق' : 'Scope', render: (r: any) => scopeText(r) }, { key: 'toleranceSeconds', label: ar ? 'مهلة السماح (دقيقة)' : 'Tolerance (min)', num: true, render: (r: any) => Math.round(r.toleranceSeconds / 60) }, { key: 'version', label: ar ? 'الإصدار' : 'Version', num: true }, { key: 'effectiveFrom', label: ar ? 'تاريخ بدء السريان' : 'Effective from', render: (r: any) => f.dt(r.effectiveFrom) }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={st(r)} /> }]} /></Section>
  </Page>;
}

const INC_TYPES = ['temperature', 'custody_break', 'damage', 'suspected_lost', 'delay', 'device'];
const incT = (lang: 'ar' | 'en', v: string) => (({ temperature: ['حرارة', 'Temperature'], custody_break: ['انقطاع حيازة', 'Custody break'], damage: ['تلف', 'Damage'], suspected_lost: ['اشتباه فقدان', 'Suspected loss'], delay: ['تأخير', 'Delay'], device: ['جهاز', 'Device'] } as any)[v]?.[lang === 'ar' ? 0 : 1] ?? v);
export function Incidents() {
  const { t, lang, x } = useApp(); const f = useFmt(); const L = useLookups(); const inc = useList('incidents', { sort: 'openedAt', dir: 'desc' }); const sh = useList('shipments');
  return (
    <Page title={t('nav.incidents')} actions={<ActionForm kind="primary" label={lang === 'ar' ? 'حادثة جديدة' : 'New incident'} title={lang === 'ar' ? 'فتح حادثة جودة' : 'Open quality incident'} cmd="incident.open" fields={[{ name: 'titleAr', label: lang === 'ar' ? 'العنوان' : 'Title', required: true, full: true }, { name: 'incidentType', label: lang === 'ar' ? 'النوع' : 'Type', type: 'select', required: true, options: INC_TYPES.map((v) => ({ value: v, label: incT(lang, v) })) }, { name: 'severity', label: lang === 'ar' ? 'الشدة' : 'Severity', type: 'select', required: true, options: ['low', 'medium', 'high', 'critical'].map((v) => ({ value: v, label: label(lang, v) })) }, { name: 'shipmentId', label: lang === 'ar' ? 'الشحنة (اختياري)' : 'Shipment (optional)', type: 'select', options: (sh.data?.items ?? []).map((s: any) => ({ value: s.id, label: s.trackingNo })) }, { name: 'findings', label: lang === 'ar' ? 'الوصف' : 'Description', type: 'textarea' }]} map={(v) => ({ ...v, shipmentId: v.shipmentId || null })} />}>
      <Section flush><DataTable rows={inc.data?.items ?? null} onRow={(r: any) => go('/incidents/' + r.id)} search={(r: any) => r.code + x(r.title)} filters={[{ key: 'st', label: t('common.status'), options: ['open', 'investigating', 'decision', 'closed'].map((s) => ({ value: s, label: label(lang, s) })), get: (r: any) => r.status }, { key: 'ty', label: lang === 'ar' ? 'النوع' : 'Type', options: INC_TYPES.map((v) => ({ value: v, label: incT(lang, v) })), get: (r: any) => r.incidentType }]} cols={[
        { key: 'code', label: lang === 'ar' ? 'الرمز' : 'Code', mono: true }, { key: 'title', label: lang === 'ar' ? 'العنوان' : 'Title', render: (r: any) => x(r.title) }, { key: 'incidentType', label: lang === 'ar' ? 'النوع' : 'Type', render: (r: any) => incT(lang, r.incidentType) }, { key: 'severity', label: lang === 'ar' ? 'الشدة' : 'Severity', render: (r: any) => <Pill v={r.severity} /> }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> }, { key: 'openedAt', label: lang === 'ar' ? 'فُتح' : 'Opened', render: (r: any) => f.dt(r.openedAt) }, { key: 'ownerId', label: lang === 'ar' ? 'المالك' : 'Owner', render: (r: any) => L.user(r.ownerId), hideSm: true },
      ]} /></Section>
    </Page>
  );
}
export function IncidentDetail({ params }: { params: Record<string, string> }) {
  const { t, lang, x } = useApp(); const f = useFmt(); const L = useLookups(); const inc = useList('incidents'); const capas = useList('capas'); const sh = useList('shipments');
  const i = (inc.data?.items ?? []).find((y: any) => y.id === params.id);
  if (!inc.data) return <Loading />; if (!i) return <ErrorBox error={{ message: { ar: 'غير موجود', en: 'Not found' } }} />;
  const cs = (capas.data?.items ?? []).filter((c: any) => c.incidentId === i.id);
  const next = { open: 'investigating', investigating: 'decision', decision: 'closed' } as any;
  const s = (sh.data?.items ?? []).find((y: any) => y.id === i.shipmentId);
  return (
    <Page title={<><Mono>{i.code}</Mono> <Pill v={i.status} /></>} crumbs={[{ label: t('nav.incidents'), href: '#/incidents' }, { label: i.code }]} sub={x(i.title)}
      actions={<>
        {i.status !== 'closed' && <ActionForm kind="primary" label={lang === 'ar' ? `تغيير الحالة إلى: ${label(lang, next[i.status])}` : `Move to: ${label(lang, next[i.status])}`} title={lang === 'ar' ? 'تحديث التحقيق' : 'Update investigation'} cmd="incident.update" intro={next[i.status] === 'closed' ? (lang === 'ar' ? 'يتطلب الإغلاق إجراءً تصحيحياً/وقائياً (CAPA) واحداً على الأقل للحوادث غير منخفضة الشدة.' : 'Closing requires at least one CAPA for non-low severity.') : undefined} initial={{ findings: i.findings }} fields={[{ name: 'findings', label: lang === 'ar' ? 'النتائج' : 'Findings', type: 'textarea', required: true }]} map={(v) => ({ id: i.id, findings: v.findings, next: next[i.status] })} />}
        {i.status !== 'closed' && <ActionForm label={lang === 'ar' ? 'إضافة إجراء تصحيحي/وقائي (CAPA)' : 'Add CAPA'} title={lang === 'ar' ? 'إجراء تصحيحي/وقائي' : 'Corrective/preventive action'} cmd="capa.create" initial={{ dueAt: localDate(7), actionType: 'corrective' }} fields={[{ name: 'actionType', label: lang === 'ar' ? 'النوع' : 'Type', type: 'select', required: true, options: opts(lang, [{ value: 'corrective', ar: 'تصحيحي', en: 'Corrective' }, { value: 'preventive', ar: 'وقائي', en: 'Preventive' }]) }, { name: 'ownerId', label: lang === 'ar' ? 'المالك' : 'Owner', type: 'select', required: true, options: L.users.filter((u: any) => u.email.endsWith('@medlog.demo') && !u.email.startsWith('corp') && !u.email.startsWith('branch') && !u.email.startsWith('ind') && !u.email.startsWith('lab') && !u.email.startsWith('courier')).map((u: any) => ({ value: u.id, label: x(u.name) })) }, { name: 'dueAt', label: lang === 'ar' ? 'الاستحقاق' : 'Due', type: 'date', required: true }, { name: 'description', label: lang === 'ar' ? 'الوصف' : 'Description', type: 'textarea', required: true }]} map={(v) => ({ incidentId: i.id, ...v })} />}
      </>}>
      <Section><DL items={[[lang === 'ar' ? 'النوع' : 'Type', incT(lang, i.incidentType)], [lang === 'ar' ? 'الشدة' : 'Severity', <Pill key="s" v={i.severity} />], [t('ship.tracking'), s ? <ShipLink id={s.id} no={s.trackingNo} /> : '—'], [lang === 'ar' ? 'فُتح' : 'Opened', f.dt(i.openedAt)], [lang === 'ar' ? 'أُغلق' : 'Closed', f.dt(i.closedAt)], [lang === 'ar' ? 'المالك' : 'Owner', L.user(i.ownerId)]]} /><p>{i.findings || <span className="muted">{lang === 'ar' ? 'لا نتائج بعد' : 'No findings yet'}</span>}</p></Section>
      <Section title="CAPA" flush><CapaTable rows={cs} /></Section>
    </Page>
  );
}
function CapaTable({ rows }: { rows: any[] }) {
  const { t, lang } = useApp(); const f = useFmt(); const L = useLookups();
  return <DataTable rows={rows} empty={lang === 'ar' ? 'لا إجراءات بعد' : 'No actions yet'} filters={[{ key: 'st', label: t('common.status'), options: ['open', 'done', 'overdue'].map((s) => ({ value: s, label: label(lang, s) })), get: (r: any) => r.status }]} cols={[
    { key: 'actionType', label: lang === 'ar' ? 'النوع' : 'Type', render: (c: any) => (c.actionType === 'corrective' ? (lang === 'ar' ? 'تصحيحي' : 'Corrective') : (lang === 'ar' ? 'وقائي' : 'Preventive')) }, { key: 'description', label: lang === 'ar' ? 'الإجراء' : 'Action' }, { key: 'ownerId', label: lang === 'ar' ? 'المالك' : 'Owner', render: (c: any) => L.user(c.ownerId) }, { key: 'dueAt', label: lang === 'ar' ? 'الاستحقاق' : 'Due', render: (c: any) => f.dt(c.dueAt) }, { key: 'status', label: t('common.status'), render: (c: any) => <Pill v={c.status === 'overdue' ? 'overdue' : c.status} /> },
    { key: 'a', label: t('common.actions'), render: (c: any) => (c.status !== 'done' ? <ActionForm label={lang === 'ar' ? 'إكمال' : 'Complete'} title={lang === 'ar' ? 'إكمال الإجراء' : 'Complete action'} cmd="capa.complete" fields={[{ name: 'note', label: lang === 'ar' ? 'دليل الإكمال' : 'Completion evidence', type: 'textarea', required: true }]} map={(v) => ({ id: c.id, ...v })} /> : null) },
  ]} />;
}
export function Capa() { const { t } = useApp(); const c = useList('capas'); return <Page title={t('nav.capa')}><Section flush>{c.data ? <CapaTable rows={c.data.items} /> : <Loading />}</Section></Page>; }

export function Claims() {
  const { t, lang, x, me } = useApp(); const f = useFmt(); const L = useLookups(); const c = useList('claims', { sort: 'createdAt', dir: 'desc' }); const sh = useList('shipments');
  const tn = (id: string) => (sh.data?.items ?? []).find((s: any) => s.id === id)?.trackingNo;
  const isQ = me.roles.includes('quality') || me.roles.includes('super_admin');
  return (
    <Page title={t('nav.claims')} sub={lang === 'ar' ? 'سير العمل: تقديم ← تحقيق ← تقييم المسؤولية (الجودة) ← اعتماد القرار (المعتمِد المالي) ← إغلاق' : 'Flow: submit → investigate → liability assessment (quality) → resolution approval (finance approver) → close'}
      actions={<ActionForm kind="primary" label={lang === 'ar' ? 'تسجيل مطالبة نيابة عن عميل' : 'Log claim on behalf of customer'} title={t('ship.fileClaim')} cmd="claim.submit" fields={[{ name: 'shipment', label: t('ship.tracking'), type: 'select', required: true, options: (sh.data?.items ?? []).filter((s: any) => s.status !== 'draft').map((s: any) => ({ value: s.id, label: `${s.trackingNo} — ${L.org(s.organizationId)}` })) }, { name: 'claimType', label: lang === 'ar' ? 'النوع' : 'Type', type: 'select', required: true, options: opts(lang, [{ value: 'damage', ar: 'تلف', en: 'Damage' }, { value: 'loss', ar: 'فقدان', en: 'Loss' }, { value: 'delay', ar: 'تأخير', en: 'Delay' }, { value: 'temperature', ar: 'حرارة', en: 'Temperature' }]) }, { name: 'amountSar', label: lang === 'ar' ? 'المبلغ (ر.س)' : 'Amount (SAR)', type: 'number', required: true, min: 1 }, { name: 'description', label: lang === 'ar' ? 'الوصف' : 'Description', type: 'textarea', required: true }]} />}>
      <Section flush><DataTable rows={c.data?.items ?? null} search={(r: any) => r.code + ' ' + (tn(r.shipmentId) ?? '')} filters={[{ key: 'st', label: t('common.status'), options: ['submitted', 'investigating', 'assessed', 'approved', 'rejected', 'closed'].map((s) => ({ value: s, label: label(lang, s) })), get: (r: any) => r.status }]} cols={[
        { key: 'code', label: lang === 'ar' ? 'الرمز' : 'Code', mono: true }, { key: 'sh', label: t('ship.tracking'), render: (r: any) => <ShipLink id={r.shipmentId} no={tn(r.shipmentId)} /> }, { key: 'org', label: t('common.customer'), render: (r: any) => L.org(r.organizationId) }, { key: 'claimType', label: lang === 'ar' ? 'النوع' : 'Type' },
        { key: 'claimedAmount', label: lang === 'ar' ? 'المبلغ المطالب به' : 'Claimed', num: true, render: (r: any) => f.sar(r.claimedAmount) }, { key: 'approvedAmount', label: lang === 'ar' ? 'المعتمد' : 'Approved', num: true, render: (r: any) => f.sar(r.approvedAmount) }, { key: 'liability', label: lang === 'ar' ? 'المسؤولية' : 'Liability', render: (r: any) => label(lang, r.liability) ?? '—' }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> },
        { key: 'a', label: t('common.actions'), render: (r: any) => <div className="row">
          {r.status === 'submitted' && isQ && <ActionForm label={lang === 'ar' ? 'بدء التحقيق' : 'Investigate'} title={lang === 'ar' ? 'بدء التحقيق' : 'Start investigation'} cmd="claim.investigate" fields={[{ name: 'note', label: t('common.note'), type: 'textarea', required: true }]} map={(v) => ({ id: r.id, ...v })} />}
          {['submitted', 'investigating'].includes(r.status) && isQ && <ActionForm kind="primary" label={lang === 'ar' ? 'تقييم' : 'Assess'} title={lang === 'ar' ? 'تقييم المسؤولية التعاقدية' : 'Assess contractual liability'} intro={lang === 'ar' ? `المبلغ المطالب به: ${f.sar(r.claimedAmount)}` : `Claimed: ${f.sar(r.claimedAmount)}`} cmd="claim.assess" fields={[{ name: 'liability', label: lang === 'ar' ? 'الطرف المسؤول' : 'Liable party', type: 'select', required: true, options: opts(lang, [{ value: 'company', ar: 'الشركة', en: 'Company' }, { value: 'partner', ar: 'الشريك (حق الرجوع)', en: 'Partner (recourse)' }, { value: 'customer', ar: 'العميل', en: 'Customer' }, { value: 'none', ar: 'لا مسؤولية', en: 'None' }]) }, { name: 'recommendedSar', label: lang === 'ar' ? 'المبلغ الموصى به (ر.س)' : 'Recommended (SAR)', type: 'number', required: true, min: 0, max: r.claimedAmount / 100 }, { name: 'note', label: t('common.note'), type: 'textarea', required: true }]} map={(v) => ({ id: r.id, ...v })} />}
          {r.status === 'assessed' && <a href="#/approvals">{lang === 'ar' ? 'بانتظار الاعتماد' : 'Awaiting approval'}</a>}
          {['approved', 'rejected'].includes(r.status) && <ActionForm label={lang === 'ar' ? 'إغلاق' : 'Close'} title={lang === 'ar' ? 'إغلاق المطالبة' : 'Close claim'} cmd="claim.close" fields={[{ name: 'note', label: t('common.note'), required: true }]} map={(v) => ({ id: r.id, ...v })} />}
        </div> },
      ]} /></Section>
      {void x}
    </Page>
  );
}

export function Lost() {
  const { t, lang, run, me } = useApp(); const f = useFmt(); const L = useLookups(); const sh = useList('shipments'); const ap = useList('approvals');
  const rows = (sh.data?.items ?? []).filter((s: any) => s.lostState !== 'none');
  const role = me.roles.includes('quality') ? 'quality' : 'ops_controller';
  return (
    <Page title={t('nav.lost')} sub={lang === 'ar' ? 'الإعلان النهائي يتطلب اعتماد العمليات والجودة معاً؛ الاسترداد حدث جديد لا يمحو الإعلان (LDM / UAT-009)' : 'Final declaration needs both operations and quality; recovery is a new event that keeps the declaration (LDM / UAT-009)'}>
      <Section flush><DataTable rows={sh.data ? rows : null} empty={lang === 'ar' ? 'لا شحنات مشتبه بفقدانها' : 'No suspected losses'} cols={[
        { key: 'trackingNo', label: t('ship.tracking'), render: (s: any) => <ShipLink id={s.id} no={s.trackingNo} /> }, { key: 'org', label: t('common.customer'), render: (s: any) => L.org(s.organizationId) }, { key: 'lostState', label: lang === 'ar' ? 'الحالة' : 'State', render: (s: any) => <Pill tone={s.lostState === 'recovered' ? 'good' : 'crit'}>{label(lang, s.lostState)}</Pill> },
        { key: 'ap', label: lang === 'ar' ? 'الاعتمادات' : 'Approvals', render: (s: any) => { const a = (ap.data?.items ?? []).filter((y: any) => y.subjectId === s.id); return ['ops_controller', 'quality'].map((r) => { const v = a.find((y: any) => y.approvalRole === r); return <Pill key={r} tone={v?.decision === 'approve' ? 'good' : 'mute'}>{t('roles.' + r)} {v ? '✓' : '…'}</Pill>; }); } },
        { key: 'updatedAt', label: lang === 'ar' ? 'آخر تحديث' : 'Updated', render: (s: any) => f.dt(s.updatedAt) },
        { key: 'a', label: t('common.actions'), render: (s: any) => <div className="row">
          {s.lostState === 'suspected' && !(ap.data?.items ?? []).some((y: any) => y.subjectId === s.id && y.approvalRole === role) && <><Btn kind="danger" onClick={() => run('lost.approve', { shipment: s.id, decision: 'approve' })}>{lang === 'ar' ? 'اعتماد الإعلان' : 'Approve declaration'}</Btn><ActionForm label={t('common.reject')} title={t('common.reject')} cmd="lost.approve" fields={[{ name: 'note', label: t('common.reason'), required: true }]} map={(v) => ({ shipment: s.id, decision: 'reject', note: v.note })} /></>}
          {['suspected', 'declared'].includes(s.lostState) && <ActionForm kind="primary" label={lang === 'ar' ? 'تسجيل استرداد' : 'Record recovery'} title={lang === 'ar' ? 'استرداد الشحنة' : 'Shipment recovered'} cmd="lost.recover" fields={[{ name: 'note', label: lang === 'ar' ? 'أين وُجدت' : 'Where found', type: 'textarea', required: true }, { name: 'signedBy', label: lang === 'ar' ? 'استلمها' : 'Received by', required: true }]} map={(v) => ({ shipment: s.id, ...v })} />}
        </div> },
      ]} /></Section>
    </Page>
  );
}

export function Returns() {
  const { t, lang } = useApp(); const f = useFmt(); const L = useLookups(); const sh = useList('shipments'); const rt = useList('returns', { sort: 'createdAt', dir: 'desc' });
  const failed = (sh.data?.items ?? []).filter((s: any) => s.status === 'failed' || (rt.data?.items ?? []).some((r: any) => r.shipmentId === s.id && r.status === 'requested'));
  const tn = (id: string) => (sh.data?.items ?? []).find((s: any) => s.id === id)?.trackingNo;
  const decide = (s: any, r?: any) => <ActionForm kind="primary" label={lang === 'ar' ? 'اتخاذ القرار' : 'Decide'} title={lang === 'ar' ? `قرار مخوّل — ${s.trackingNo}` : `Authorized decision — ${s.trackingNo}`} cmd="returns.authorize" intro={lang === 'ar' ? 'لا يجوز إتلاف العينة دون إجراء موثق (BR-010). التكلفة تُحمّل على الطرف المسؤول.' : 'No sample destruction without documented procedure (BR-010). Cost goes to the responsible party.'} fields={[{ name: 'decision', label: lang === 'ar' ? 'القرار' : 'Decision', type: 'select', required: true, options: opts(lang, [{ value: 'retry', ar: 'إعادة المحاولة', en: 'Retry' }, { value: 'alternate_destination', ar: 'وجهة بديلة معتمدة', en: 'Alternate authorized destination' }, { value: 'qualified_hold', ar: 'حجز مؤقت مؤهل', en: 'Qualified temporary hold' }, { value: 'return_to_sender', ar: 'إرجاع للمرسل', en: 'Return to sender' }]) }, { name: 'responsibleParty', label: lang === 'ar' ? 'الطرف المسؤول عن التكلفة' : 'Cost responsibility', type: 'select', required: true, options: opts(lang, [{ value: 'customer', ar: 'العميل', en: 'Customer' }, { value: 'company', ar: 'الشركة', en: 'Company' }, { value: 'partner', ar: 'الشريك', en: 'Partner' }]) }, { name: 'alternateAddressId', label: lang === 'ar' ? 'الوجهة البديلة (عند اختيارها)' : 'Alternate destination (if chosen)', type: 'select', options: L.addresses.filter((a: any) => a.authorized && a.id !== s.receiverAddressId).map((a: any) => ({ value: a.id, label: a.label[lang] })) }]} map={(v) => ({ returnId: r?.id, shipment: s.id, ...v, alternateAddressId: v.alternateAddressId || null })} />;
  return (
    <Page title={t('nav.returns')}>
      <Section title={<>{lang === 'ar' ? 'بانتظار قرار' : 'Awaiting decision'} <span className="count">{failed.length}</span></>} flush>
        <DataTable rows={sh.data ? failed : null} empty={lang === 'ar' ? 'لا شحنات متعذّر تسليمها' : 'No failed deliveries'} cols={[{ key: 'trackingNo', label: t('ship.tracking'), render: (s: any) => <ShipLink id={s.id} no={s.trackingNo} /> }, { key: 'org', label: t('common.customer'), render: (s: any) => L.org(s.organizationId) }, { key: 'status', label: t('common.status'), render: (s: any) => <Pill v={s.status} /> }, { key: 'updatedAt', label: lang === 'ar' ? 'منذ' : 'Since', render: (s: any) => f.dt(s.updatedAt) }, { key: 'a', label: t('common.actions'), render: (s: any) => decide(s, (rt.data?.items ?? []).find((r: any) => r.shipmentId === s.id && r.status === 'requested')) }]} />
      </Section>
      <Section title={lang === 'ar' ? 'أوامر الإرجاع' : 'Return orders'} flush>
        <DataTable rows={rt.data?.items ?? null} cols={[{ key: 'sh', label: t('ship.tracking'), render: (r: any) => <ShipLink id={r.shipmentId} no={tn(r.shipmentId)} /> }, { key: 'reasonCode', label: t('common.reason') }, { key: 'decision', label: lang === 'ar' ? 'القرار' : 'Decision', render: (r: any) => label(lang, r.decision) }, { key: 'responsibleParty', label: lang === 'ar' ? 'التكلفة على' : 'Cost to', render: (r: any) => label(lang, r.responsibleParty) }, { key: 'costHalala', label: t('common.amount'), num: true, render: (r: any) => f.sar(r.costHalala) }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> },
          { key: 'a', label: t('common.actions'), render: (r: any) => (r.status === 'in_progress' && (sh.data?.items ?? []).find((s: any) => s.id === r.shipmentId)?.status === 'return_pending' ? <ActionForm label={lang === 'ar' ? 'إتمام الإرجاع' : 'Complete return'} title={lang === 'ar' ? 'تسليم للمرسل' : 'Hand back to sender'} cmd="returns.complete" fields={[{ name: 'signedBy', label: lang === 'ar' ? 'استلمها' : 'Received by', required: true }]} map={(v) => ({ returnId: r.id, ...v })} /> : null) }]} />
      </Section>
    </Page>
  );
}
void Empty; void Kpis; void useQ;
