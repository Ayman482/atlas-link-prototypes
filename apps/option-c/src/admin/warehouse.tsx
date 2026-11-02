'use client';
// المستودع: المخزون والحركات، التنظيف والتأهيل، حيازة الشركاء، المستهلكات (A26–A29)
import React from 'react';
import { useApp, useList, useQ } from '@/lib/store';
import { DataTable, Kpis, Page, Pill, Section, label, useFmt } from '@/lib/ui';
import { ActionForm, useLookups } from './common';

export function Inventory() {
  const { t, lang } = useApp(); const f = useFmt(); const L = useLookups(); const mv = useList('boxMovements', { sort: 'eventAt', dir: 'desc' }); const b = useQ<any>('dispatch.board', {});
  const boxes = b.data?.boxes ?? [];
  const back = boxes.filter((x: any) => x.status === 'returning');
  return (
    <Page title={t('nav.inventory')} sub={lang === 'ar' ? 'المستودع الرئيسي — الرياض (السلي) ونقاط الشركاء' : 'Main warehouse — Riyadh (Al-Sulay) and partner points'}>
      <Kpis items={[{ label: lang === 'ar' ? 'في المستودع' : 'In warehouse', value: boxes.filter((x: any) => x.custodianType === 'warehouse').length }, { label: lang === 'ar' ? 'عائدة' : 'Returning', value: back.length, tone: back.length ? 'warn' : undefined }, { label: lang === 'ar' ? 'لدى مندوبين' : 'With couriers', value: boxes.filter((x: any) => x.custodianType === 'courier').length }, { label: lang === 'ar' ? 'لدى شركاء' : 'With partners', value: boxes.filter((x: any) => x.custodianType === 'partner').length }]} />
      <Section title={lang === 'ar' ? 'صناديق عائدة بانتظار الاستلام' : 'Returning boxes awaiting receipt'} flush>
        <DataTable rows={b.data ? back : null} empty={lang === 'ar' ? 'لا صناديق عائدة' : 'No returning boxes'} cols={[{ key: 'code', label: lang === 'ar' ? 'الصندوق' : 'Box', mono: true }, { key: 'thermalClass', label: t('ship.thermalClass'), render: (r: any) => label(lang, r.thermalClass) }, { key: 'loc', label: t('common.city'), render: (r: any) => L.city(r.locationCity) }, { key: 'a', label: t('common.actions'), render: (r: any) => <ActionForm kind="primary" label={lang === 'ar' ? 'استلام' : 'Receive'} title={lang === 'ar' ? `استلام ${r.code}` : `Receive ${r.code}`} cmd="box.receiveReturn" fields={[{ name: 'signedBy', label: lang === 'ar' ? 'سلّمه' : 'Handed over by', required: true }]} map={(v) => ({ box: r.id, ...v })} success={lang === 'ar' ? 'استُلم وأُحيل للتنظيف' : 'Received and sent to cleaning'} /> }]} />
      </Section>
      <Section title={lang === 'ar' ? 'سجل الحركات (غير قابل للتعديل)' : 'Movement log (immutable)'} flush>
        <DataTable rows={mv.data?.items ?? null} csvName="box-movements" search={(m: any) => L.box(m.boxId) + m.kind} filters={[{ key: 'k', label: lang === 'ar' ? 'الحركة' : 'Movement', options: ['issue', 'return', 'cleaning', 'inspection', 'partner_handover', 'partner_return'].map((s) => ({ value: s, label: s })), get: (m: any) => m.kind }]} cols={[{ key: 'eventAt', label: t('common.date'), render: (m: any) => f.dt(m.eventAt) }, { key: 'box', label: lang === 'ar' ? 'الصندوق' : 'Box', mono: true, render: (m: any) => L.box(m.boxId) }, { key: 'kind', label: lang === 'ar' ? 'الحركة' : 'Movement' }, { key: 'fromLocation', label: t('common.from') }, { key: 'toLocation', label: t('common.to') }, { key: 'custodian', label: lang === 'ar' ? 'الحائز' : 'Custodian' }]} />
      </Section>
    </Page>
  );
}

const CHECK = [['cleaned', 'نُظّف', 'Cleaned'], ['disinfected', 'عُقّم', 'Disinfected'], ['sealIntact', 'الأختام سليمة', 'Seals intact'], ['trackerPaired', 'الجهاز مقترن', 'Tracker paired'], ['trackerBattery', 'البطارية فوق 60%', 'Battery above 60%'], ['probeCheck', 'فحص المجس', 'Probe check']];
export function Cleaning() {
  const { t, lang } = useApp(); const f = useFmt(); const b = useQ<any>('dispatch.board', {}); const q = useList('boxQualifications', { sort: 'effectiveAt', dir: 'desc' }); const L = useLookups();
  const queue = (b.data?.boxes ?? []).filter((x: any) => ['cleaning', 'inspection', 'maintenance'].includes(x.status));
  return (
    <Page title={t('nav.cleaning')} sub={lang === 'ar' ? 'عائد ← تنظيف ← فحص ← متاح. الفشل يحيل للصيانة؛ التأهيل الحراري المنتهي يُجدد عند الفحص.' : 'Returning → cleaning → inspection → available. Failure sends to maintenance; expired thermal qualification is renewed at inspection.'}>
      <Section title={<>{lang === 'ar' ? 'الطابور' : 'Queue'} <span className="count">{queue.length}</span></>} flush>
        <DataTable rows={b.data ? queue : null} empty={lang === 'ar' ? 'لا صناديق في الطابور' : 'Queue is empty'} cols={[{ key: 'code', label: lang === 'ar' ? 'الصندوق' : 'Box', mono: true }, { key: 'status', label: lang === 'ar' ? 'المرحلة' : 'Stage', render: (r: any) => <Pill v={r.status} /> }, { key: 'q', label: lang === 'ar' ? 'التأهيل' : 'Qualification', render: (r: any) => <Pill v={r.qualificationStatus === 'qualified' && Date.parse(r.qualificationExpiry) > Date.now() ? 'valid' : 'expired'} /> },
          { key: 'a', label: t('common.actions'), render: (r: any) => <ActionForm kind="primary" label={r.status === 'cleaning' ? (lang === 'ar' ? 'تسجيل التنظيف' : 'Record cleaning') : (lang === 'ar' ? 'تسجيل الفحص' : 'Record inspection')} title={`${r.code} — ${label(lang, r.status)}`} cmd="box.cleanInspect" intro={lang === 'ar' ? 'النجاح يتطلب كل البنود.' : 'Pass requires every item.'} initial={{ result: 'pass', checklist: [] }} fields={[{ name: 'checklist', label: lang === 'ar' ? 'قائمة الفحص' : 'Checklist', type: 'multi', options: CHECK.map(([v, a, e]) => ({ value: v, label: lang === 'ar' ? a : e })) }, { name: 'result', label: lang === 'ar' ? 'النتيجة' : 'Result', type: 'select', required: true, options: [{ value: 'pass', label: lang === 'ar' ? 'ناجح' : 'Pass' }, { value: 'fail', label: lang === 'ar' ? 'فاشل' : 'Fail' }] }, { name: 'note', label: t('common.note'), type: 'textarea' }]} map={(v) => ({ box: r.id, result: v.result, note: v.note, checklist: Object.fromEntries((v.checklist ?? []).map((k: string) => [k, true])) })} /> }]} />
      </Section>
      <Section title={lang === 'ar' ? 'سجل التأهيل' : 'Qualification log'} flush>
        <DataTable rows={q.data?.items ?? null} cols={[{ key: 'effectiveAt', label: t('common.date'), render: (r: any) => f.dt(r.effectiveAt) }, { key: 'box', label: lang === 'ar' ? 'الصندوق' : 'Box', mono: true, render: (r: any) => L.box(r.boxId) }, { key: 'qualificationType', label: lang === 'ar' ? 'النوع' : 'Type' }, { key: 'result', label: lang === 'ar' ? 'النتيجة' : 'Result', render: (r: any) => <Pill tone={r.result === 'pass' ? 'good' : 'crit'}>{r.result}</Pill> }, { key: 'by', label: lang === 'ar' ? 'بواسطة' : 'By', render: (r: any) => L.user(r.by) }]} />
      </Section>
    </Page>
  );
}

export function PartnerCustody() {
  const { t, lang } = useApp(); const f = useFmt(); const L = useLookups(); const pc = useList('partnerCustody', { sort: 'handedAt', dir: 'desc' });
  return (
    <Page title={t('nav.partnerCustody')} sub={lang === 'ar' ? 'حيازة مؤقتة موقّعة مع التزامات إرجاع (WH-002). التسليم يتم من صفحة الصندوق.' : 'Signed temporary custody with return obligations (WH-002). Hand over from the box page.'}>
      <Section flush><DataTable rows={pc.data?.items ?? null} cols={[{ key: 'box', label: lang === 'ar' ? 'الصندوق' : 'Box', render: (r: any) => <a className="mono" href={'#/boxes/' + r.boxId}>{L.box(r.boxId)}</a> }, { key: 'p', label: lang === 'ar' ? 'الشريك' : 'Partner', render: (r: any) => L.partner(r.partnerId) }, { key: 'handedAt', label: lang === 'ar' ? 'سُلّم' : 'Handed', render: (r: any) => f.dt(r.handedAt) }, { key: 'returnDueAt', label: lang === 'ar' ? 'موعد الإرجاع' : 'Return due', render: (r: any) => <>{f.dt(r.returnDueAt)} {!r.returnedAt && Date.parse(r.returnDueAt) < Date.now() && <Pill tone="crit">{lang === 'ar' ? 'متأخر' : 'Overdue'}</Pill>}</> }, { key: 'signedBy', label: lang === 'ar' ? 'وقّع' : 'Signed by' }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill tone={r.status === 'returned' ? 'good' : 'info'}>{r.status}</Pill> },
        { key: 'a', label: t('common.actions'), render: (r: any) => (r.status !== 'returned' ? <ActionForm label={lang === 'ar' ? 'تسجيل الإرجاع' : 'Record return'} title={lang === 'ar' ? 'إرجاع من الشريك' : 'Return from partner'} cmd="box.partnerReturn" fields={[{ name: 'signedBy', label: lang === 'ar' ? 'سلّمه' : 'Handed back by', required: true }]} map={(v) => ({ id: r.id, ...v })} /> : null) }]} /></Section>
    </Page>
  );
}

export function Consumables() {
  const { t, lang, x } = useApp(); const f = useFmt(); const L = useLookups(); const c = useList('consumables'); const mv = useList('consumableMovements', { sort: 'at', dir: 'desc' });
  return (
    <Page title={t('nav.consumables')}>
      <Section flush><DataTable rows={c.data?.items ?? null} cols={[{ key: 'sku', label: 'SKU', mono: true }, { key: 'name', label: lang === 'ar' ? 'الصنف' : 'Item', render: (r: any) => x(r.name) }, { key: 'onHand', label: lang === 'ar' ? 'الرصيد' : 'On hand', num: true, render: (r: any) => <>{f.num(r.onHand)} <span className="muted">{x(r.unit)}</span></> }, { key: 'reorderLevel', label: lang === 'ar' ? 'حد الطلب' : 'Reorder', num: true }, { key: 'st', label: t('common.status'), render: (r: any) => (r.onHand < r.reorderLevel ? <Pill tone="crit">{lang === 'ar' ? 'أقل من الحد' : 'Below reorder'}</Pill> : <Pill tone="good">OK</Pill>) },
        { key: 'a', label: t('common.actions'), render: (r: any) => <ActionForm label={lang === 'ar' ? 'حركة' : 'Movement'} title={x(r.name)} cmd="consumable.move" initial={{ kind: 'issue', qty: 10 }} fields={[{ name: 'kind', label: lang === 'ar' ? 'النوع' : 'Kind', type: 'select', required: true, options: [{ value: 'receipt', label: lang === 'ar' ? 'استلام' : 'Receipt' }, { value: 'issue', label: lang === 'ar' ? 'صرف' : 'Issue' }, { value: 'adjustment', label: lang === 'ar' ? 'تسوية (±)' : 'Adjustment (±)' }] }, { name: 'qty', label: t('ship.quantity'), type: 'number', required: true }, { name: 'ref', label: lang === 'ar' ? 'المرجع' : 'Reference', required: true }]} map={(v) => ({ consumableId: r.id, ...v })} /> }]} /></Section>
      <Section title={lang === 'ar' ? 'الحركات' : 'Movements'} flush><DataTable rows={mv.data?.items ?? null} cols={[{ key: 'at', label: t('common.date'), render: (m: any) => f.dt(m.at) }, { key: 'item', label: lang === 'ar' ? 'الصنف' : 'Item', render: (m: any) => x((c.data?.items ?? []).find((y: any) => y.id === m.consumableId)?.name) }, { key: 'kind', label: lang === 'ar' ? 'النوع' : 'Kind' }, { key: 'qty', label: t('ship.quantity'), num: true }, { key: 'ref', label: lang === 'ar' ? 'المرجع' : 'Ref' }, { key: 'by', label: lang === 'ar' ? 'بواسطة' : 'By', render: (m: any) => L.user(m.by) }]} /></Section>
    </Page>
  );
}
