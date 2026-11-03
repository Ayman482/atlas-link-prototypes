'use client';
// النظام: الإشعارات والقوالب، التكاملات، الإعدادات، الاعتمادات، المستخدمون، التدقيق، الأمن، الصحة، الملف الشخصي، بوابة الشريك (A52–A60)
import { comma } from '@/lib/l10n';
import React, { useState } from 'react';
import { useApp, useList, useQ, transport } from '@/lib/store';
import { Btn, ConfirmBtn, DataTable, DL, ErrorBox, Kpis, Loading, Mono, Page, Pill, Section, Sim, Tabs, label, useFmt } from '@/lib/ui';
import { ActionForm, ShipLink, localNow, opts, useLookups } from './common';

export function Notifications() {
  const { t, lang, x, run } = useApp(); const f = useFmt(); const tp = useList('templates'); const n = useList('notifications', { sort: 'createdAt', dir: 'desc' });
  const [tab, setTab] = useState('templates');
  return (
    <Page title={t('nav.notifications')} sub={<>{lang === 'ar' ? 'القنوات SMS والبريد والإشعارات الفورية محاكاة — لا يُرسل شيء فعلياً (INT-001)' : 'SMS, email and push are simulated — nothing is actually sent (INT-001)'} <Sim /></>}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'templates', label: lang === 'ar' ? 'القوالب' : 'Templates' }, { id: 'log', label: lang === 'ar' ? 'سجل الإرسال' : 'Delivery log' }]} />
      {tab === 'templates' && <Section flush><DataTable rows={tp.data?.items ?? null} cols={[{ key: 'code', label: lang === 'ar' ? 'الحدث' : 'Event', mono: true }, { key: 'channel', label: lang === 'ar' ? 'القناة' : 'Channel' }, { key: 'subject', label: lang === 'ar' ? 'العنوان' : 'Subject', render: (r: any) => x(r.subject) }, { key: 'active', label: t('common.status'), render: (r: any) => <Pill tone={r.active ? 'good' : 'mute'}>{r.active ? (lang === 'ar' ? 'مفعّل' : 'Active') : (lang === 'ar' ? 'موقوف' : 'Off')}</Pill> },
        { key: 'a', label: t('common.actions'), render: (r: any) => <div className="row"><ActionForm label={t('common.edit')} title={r.code} cmd="template.update" initial={{ subjectAr: r.subject.ar, subjectEn: r.subject.en, bodyAr: r.body.ar, bodyEn: r.body.en, active: r.active }} fields={[{ name: 'subjectAr', label: lang === 'ar' ? 'العنوان (عربي)' : 'Subject (Arabic)', required: true, full: true }, { name: 'subjectEn', label: lang === 'ar' ? 'العنوان (إنجليزي)' : 'Subject (English)', required: true, dir: 'ltr', full: true }, { name: 'bodyAr', label: lang === 'ar' ? 'النص (عربي)' : 'Body (Arabic)', type: 'textarea', required: true }, { name: 'bodyEn', label: lang === 'ar' ? 'النص (إنجليزي)' : 'Body (English)', type: 'textarea', required: true, dir: 'ltr' }, { name: 'active', label: t('common.status'), type: 'checkbox', placeholder: lang === 'ar' ? 'مفعّل' : 'Active' }]} map={(v) => ({ id: r.id, ...v })} /><Btn kind="ghost" onClick={() => run('template.testSend', { id: r.id }, { success: lang === 'ar' ? 'أُرسل اختبار (محاكاة) إلى إشعاراتك' : 'Test sent (simulated) to your notifications' })}>{lang === 'ar' ? 'إرسال تجريبي' : 'Test send'}</Btn></div> }]} /></Section>}
      {tab === 'log' && <Section flush><DataTable rows={n.data?.items ?? null} search={(r: any) => x(r.title)} filters={[{ key: 'au', label: lang === 'ar' ? 'الجمهور' : 'Audience', options: ['staff', 'customer', 'courier'].map((v) => ({ value: v, label: v })), get: (r: any) => r.audience }]} cols={[{ key: 'createdAt', label: t('common.date'), render: (r: any) => f.dt(r.createdAt) }, { key: 'audience', label: lang === 'ar' ? 'الجمهور' : 'Audience' }, { key: 'channel', label: lang === 'ar' ? 'القناة' : 'Channel' }, { key: 'title', label: lang === 'ar' ? 'العنوان' : 'Title', render: (r: any) => x(r.title) }, { key: 'deliveryStatus', label: t('common.status'), render: (r: any) => <Pill tone="warn">{label(lang, r.deliveryStatus)}</Pill> }, { key: 'readAt', label: lang === 'ar' ? 'قُرئ' : 'Read', render: (r: any) => (r.readAt ? '✓' : '') }]} /></Section>}
    </Page>
  );
}

export function Integrations() {
  const { t, lang, x, run } = useApp(); const f = useFmt(); const i = useList('integrations'); const w = useList('webhooks'); const a = useList('apiClients'); const L = useLookups();
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <Page title={t('nav.integrations')} sub={lang === 'ar' ? 'كل مزود خارجي هنا محاكاة أو غير مهيأ — حدود التكامل موثقة' : 'Every external provider here is simulated or not configured — integration boundaries are documented'}>
      <div className="grid g3">{(i.data?.items ?? []).map((y: any) => <Section key={y.id} title={x(y.name)} actions={<Pill v={y.status} />}><p className="muted">{x(y.note)}</p></Section>)}</div>
      <Section title="Webhooks" actions={<ActionForm label={t('common.add')} title="Webhook" cmd="webhook.create" fields={[{ name: 'organizationId', label: t('common.customer'), type: 'select', options: L.orgs.map((o: any) => ({ value: o.id, label: x(o.legalName) })) }, { name: 'url', label: 'URL', required: true, dir: 'ltr', placeholder: 'https://', pattern: /^https:\/\//, patternMsg: 'HTTPS' }, { name: 'events', label: lang === 'ar' ? 'الأحداث' : 'Events', type: 'multi', required: true, options: ['shipment.created', 'shipment.delivered', 'cold_chain.excursion_detected', 'invoice.issued'].map((v) => ({ value: v, label: v })) }]} map={(v) => ({ ...v, organizationId: v.organizationId || null })} />} flush>
        <DataTable rows={w.data?.items ?? null} cols={[{ key: 'org', label: t('common.customer'), render: (r: any) => L.org(r.organizationId) }, { key: 'url', label: 'URL', mono: true }, { key: 'events', label: lang === 'ar' ? 'الأحداث' : 'Events', mono: true, render: (r: any) => r.events.join(', ') }, { key: 'secretMasked', label: lang === 'ar' ? 'السر' : 'Secret', mono: true }, { key: 'lastDeliveryAt', label: lang === 'ar' ? 'آخر توصيل' : 'Last delivery', render: (r: any) => f.dt(r.lastDeliveryAt) }, { key: 'status', label: t('common.status'), render: (r: any) => <><Pill v={r.status} /> <Sim /></> }, { key: 'a', label: t('common.actions'), render: (r: any) => <div className="row"><Btn kind="ghost" onClick={() => run('webhook.action', { id: r.id, action: 'test' })}>{lang === 'ar' ? 'اختبار' : 'Test'}</Btn><Btn kind="ghost" onClick={() => run('webhook.action', { id: r.id, action: r.status === 'active' ? 'pause' : 'resume' })}>{r.status === 'active' ? (lang === 'ar' ? 'إيقاف' : 'Pause') : (lang === 'ar' ? 'استئناف' : 'Resume')}</Btn><Btn kind="ghost" onClick={() => run('webhook.action', { id: r.id, action: 'rotate' })}>{lang === 'ar' ? 'تدوير السر' : 'Rotate secret'}</Btn></div> }]} />
      </Section>
      <Section title={lang === 'ar' ? 'عملاء API' : 'API clients'} actions={<ActionForm label={t('common.add')} title={lang === 'ar' ? 'مفتاح API جديد' : 'New API key'} cmd="apiClient.create" fields={[{ name: 'organizationId', label: t('common.customer'), type: 'select', options: L.orgs.map((o: any) => ({ value: o.id, label: x(o.legalName) })) }, { name: 'name', label: lang === 'ar' ? 'الاسم' : 'Name', required: true }, { name: 'scopes', label: lang === 'ar' ? 'النطاقات' : 'Scopes', type: 'multi', required: true, options: ['shipments:read', 'shipments:write', 'invoices:read', 'carrier-events:write'].map((v) => ({ value: v, label: v })) }]} map={(v) => ({ ...v, organizationId: v.organizationId || null })} />} flush>
        <DataTable rows={a.data?.items ?? null} cols={[{ key: 'name', label: lang === 'ar' ? 'الاسم' : 'Name' }, { key: 'org', label: lang === 'ar' ? 'الجهة' : 'Owner', render: (r: any) => (r.partnerId ? L.partner(r.partnerId) : L.org(r.organizationId)) }, { key: 'keyPrefix', label: lang === 'ar' ? 'بادئة المفتاح' : 'Key prefix', mono: true }, { key: 'scopes', label: lang === 'ar' ? 'النطاقات' : 'Scopes', mono: true, render: (r: any) => r.scopes.join(', ') }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> }, { key: 'a', label: t('common.actions'), render: (r: any) => (r.status === 'active' ? <ConfirmBtn kind="danger" message={lang === 'ar' ? 'سيتوقف كل تكامل يستخدم هذا المفتاح.' : 'Every integration using this key stops working.'} onConfirm={() => run('apiClient.revoke', { id: r.id })}>{lang === 'ar' ? 'إلغاء' : 'Revoke'}</ConfirmBtn> : null) }]} />
      </Section>
      {secret && <div className="notice">{secret}</div>}
      {void setSecret}
    </Page>
  );
}

export function Settings() {
  const { t, lang, x, run } = useApp(); const f = useFmt(); const L = useLookups(); const c = useList('configVersions', { sort: 'createdAt', dir: 'desc' });
  const keys = [...new Set((c.data?.items ?? []).map((y: any) => y.key))] as string[];
  const active = (k: string) => (c.data?.items ?? []).find((y: any) => y.key === k && y.status === 'active');
  return (
    <Page title={t('nav.settings')} sub={lang === 'ar' ? 'كل تغيير حساس يُنشئ إصداراً يتطلب اعتماداً قبل السريان (ADM-002)' : 'Every sensitive change creates a version that needs approval before it takes effect (ADM-002)'}>
      <Section title={lang === 'ar' ? 'المدن (تفعيل تدريجي)' : 'Cities (gradual activation)'}>
        <div className="row">{L.cities.map((cy: any) => <label key={cy.code} className="check"><input type="checkbox" checked={cy.active} onChange={(e) => run('city.setActive', { code: cy.code, active: e.target.checked })} /> {x(cy.name)}</label>)}</div>
      </Section>
      <Section title={lang === 'ar' ? 'الإعدادات بإصدارات' : 'Versioned settings'} flush>
        <DataTable rows={keys.map((k) => ({ id: k, key: k, cur: active(k) }))} cols={[{ key: 'key', label: lang === 'ar' ? 'المفتاح' : 'Key', mono: true }, { key: 'v', label: lang === 'ar' ? 'القيمة السارية' : 'Active value', mono: true, render: (r: any) => JSON.stringify(r.cur?.value) }, { key: 'ver', label: 'v', num: true, render: (r: any) => r.cur?.version }, { key: 'p', label: lang === 'ar' ? 'معلّق' : 'Pending', render: (r: any) => ((c.data?.items ?? []).some((y: any) => y.key === r.key && y.status === 'pending_approval') ? <Pill tone="warn">{label(lang, 'pending_approval')}</Pill> : '') },
          { key: 'a', label: t('common.actions'), render: (r: any) => <ActionForm label={lang === 'ar' ? 'اقتراح تغيير' : 'Propose change'} title={r.key} cmd="config.propose" initial={{ value: JSON.stringify(r.cur?.value), effectiveAt: localNow(24) }} fields={[{ name: 'value', label: lang === 'ar' ? 'القيمة (JSON)' : 'Value (JSON)', required: true, dir: 'ltr' }, { name: 'effectiveAt', label: lang === 'ar' ? 'يسري من' : 'Effective', type: 'datetime', required: true }]} map={(v) => { let val: unknown = v.value; try { val = JSON.parse(v.value); } catch { /* نص */ } return { key: r.key, value: val, effectiveAt: v.effectiveAt }; }} /> }]} />
      </Section>
      <Section title={lang === 'ar' ? 'سجل الإصدارات' : 'Version history'} flush><DataTable rows={c.data?.items ?? null} cols={[{ key: 'key', label: lang === 'ar' ? 'المفتاح' : 'Key', mono: true }, { key: 'version', label: 'v', num: true }, { key: 'value', label: lang === 'ar' ? 'القيمة' : 'Value', mono: true, render: (r: any) => JSON.stringify(r.value) }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> }, { key: 'effectiveAt', label: lang === 'ar' ? 'يسري' : 'Effective', render: (r: any) => f.dt(r.effectiveAt) }, { key: 'approvedBy', label: lang === 'ar' ? 'اعتمده' : 'Approved by', render: (r: any) => L.user(r.approvedBy) }]} /></Section>
    </Page>
  );
}

export function Approvals() {
  const { t, lang, x, run } = useApp(); const f = useFmt(); const L = useLookups(); const a = useQ<any>('approvals.inbox', {});
  const [tab, setTab] = useState('pending');
  if (a.error) return <ErrorBox error={a.error} />; if (!a.data) return <Loading />;
  const rows = tab === 'pending' ? a.data.pending : tab === 'mine' ? a.data.mine : a.data.history;
  return (
    <Page title={t('nav.approvals')} sub={lang === 'ar' ? 'فصل المهام: لا يعتمد أحد طلباً قدّمه بنفسه' : 'Segregation of duties: nobody approves their own request'}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'pending', label: lang === 'ar' ? 'بانتظاري' : 'Awaiting me', count: a.data.pending.length }, { id: 'mine', label: lang === 'ar' ? 'طلباتي' : 'My requests', count: a.data.mine.length }, { id: 'history', label: lang === 'ar' ? 'السجل' : 'History' }]} />
      <Section flush><DataTable rows={rows} empty={lang === 'ar' ? 'لا طلبات' : 'No requests'} cols={[{ key: 'kind', label: lang === 'ar' ? 'النوع' : 'Type', render: (r: any) => <Pill tone="info">{label(lang, r.kind)}</Pill> }, { key: 'title', label: lang === 'ar' ? 'الطلب' : 'Request', render: (r: any) => x(r.title) }, { key: 'note', label: lang === 'ar' ? 'المبرر' : 'Justification', render: (r: any) => r.note || '—' }, { key: 'requestedBy', label: lang === 'ar' ? 'مقدّم الطلب' : 'Requested by', render: (r: any) => L.user(r.requestedBy) }, { key: 'requiredRole', label: lang === 'ar' ? 'الدور المطلوب' : 'Required role', render: (r: any) => t('roles.' + r.requiredRole) }, { key: 'createdAt', label: t('common.date'), render: (r: any) => f.dt(r.createdAt) }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> },
        { key: 'a', label: t('common.actions'), render: (r: any) => (tab === 'pending' ? <div className="row"><ConfirmBtn kind="primary" message={x(r.title)} onConfirm={() => run('approval.decide', { id: r.id, decision: 'approve' }, { success: lang === 'ar' ? 'تم الاعتماد' : 'Approved' })}>{t('common.approve')}</ConfirmBtn><ActionForm kind="danger" label={t('common.reject')} title={t('common.reject')} cmd="approval.decide" fields={[{ name: 'note', label: t('common.reason'), type: 'textarea', required: true }]} map={(v) => ({ id: r.id, decision: 'reject', note: v.note })} /></div> : r.decidedBy ? L.user(r.decidedBy) : null) }]} /></Section>
    </Page>
  );
}

export function Users() {
  const { t, lang, x, run } = useApp(); const f = useFmt(); const L = useLookups(); const u = useList('users'); const m = useList('memberships');
  return (
    <Page title={t('nav.users')} actions={<ActionForm kind="primary" label={lang === 'ar' ? 'دعوة موظف' : 'Invite staff'} title={lang === 'ar' ? 'دعوة موظف' : 'Invite staff member'} cmd="user.invite" intro={lang === 'ar' ? 'أدوار الموظفين تفرض التحقق بخطوتين.' : 'Staff roles enforce MFA.'} fields={[{ name: 'email', label: t('auth.email'), type: 'email', required: true, dir: 'ltr' }, { name: 'nameAr', label: lang === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)', required: true }, { name: 'nameEn', label: lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)', dir: 'ltr' }, { name: 'role', label: lang === 'ar' ? 'الدور' : 'Role', type: 'select', required: true, options: ['ops_controller', 'warehouse', 'quality', 'finance', 'finance_approver', 'compliance', 'iot_engineer', 'customer_service', 'executive', 'super_admin'].map((r) => ({ value: r, label: t('roles.' + r) })) }]} />}>
      <Section flush><DataTable rows={u.data?.items ?? null} csvName="users" search={(r: any) => x(r.name) + r.email} cols={[{ key: 'name', label: lang === 'ar' ? 'الاسم' : 'Name', render: (r: any) => x(r.name) }, { key: 'email', label: t('auth.email'), mono: true }, { key: 'roles', label: lang === 'ar' ? 'الأدوار والنطاق' : 'Roles & scope', render: (r: any) => (m.data?.items ?? []).filter((y: any) => y.userId === r.id && y.status === 'active').map((y: any) => <Pill key={y.id} tone="info">{t('roles.' + y.role)}{y.branchId ? ` · ${L.branch(y.branchId)}` : y.organizationId ? ` · ${L.org(y.organizationId)}` : ''}</Pill>) }, { key: 'mfaEnabled', label: 'MFA', render: (r: any) => (r.mfaEnabled ? <Pill tone="good">✓</Pill> : <Pill tone="mute">—</Pill>) }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} /> }, { key: 'createdAt', label: t('common.date'), render: (r: any) => f.dt(r.createdAt), hideSm: true },
        { key: 'a', label: t('common.actions'), render: (r: any) => <ConfirmBtn kind={r.status === 'disabled' ? 'default' : 'danger'} message={r.status === 'disabled' ? (lang === 'ar' ? 'إعادة تفعيل الحساب؟' : 'Re-enable this account?') : (lang === 'ar' ? 'سيُعطَّل الحساب وتُلغى جلساته فوراً.' : 'The account is disabled and its sessions revoked immediately.')} onConfirm={() => run('user.setStatus', { userId: r.id, status: r.status === 'disabled' ? 'active' : 'disabled' })}>{r.status === 'disabled' ? (lang === 'ar' ? 'تفعيل' : 'Enable') : (lang === 'ar' ? 'تعطيل' : 'Disable')}</ConfirmBtn> }]} /></Section>
    </Page>
  );
}

export function Audit() {
  const { t, lang } = useApp(); const f = useFmt(); const L = useLookups(); const a = useList('audit', { sort: 'occurredAt', dir: 'desc' });
  const actions = [...new Set((a.data?.items ?? []).map((y: any) => y.action.split('.')[0]))] as string[];
  return <Page title={t('nav.audit')} sub={lang === 'ar' ? 'سجل إلحاقي لا يُعدّل (NFR-008)' : 'Append-only, never edited (NFR-008)'}><Section flush><DataTable rows={a.data?.items ?? null} csvName="audit" pageSize={25} search={(r: any) => r.action + ' ' + r.summary + ' ' + L.user(r.actorId)} filters={[{ key: 'ac', label: lang === 'ar' ? 'المجال' : 'Domain', options: actions.map((v) => ({ value: v, label: v })), get: (r: any) => r.action.split('.')[0] }, { key: 'u', label: lang === 'ar' ? 'المستخدم' : 'User', options: L.users.map((u: any) => ({ value: u.id, label: u.name[lang] })), get: (r: any) => r.actorId }]} cols={[{ key: 'occurredAt', label: t('common.time'), render: (r: any) => f.dt(r.occurredAt) }, { key: 'actor', label: lang === 'ar' ? 'المستخدم' : 'Actor', render: (r: any) => L.user(r.actorId) }, { key: 'action', label: lang === 'ar' ? 'الإجراء' : 'Action', mono: true }, { key: 'summary', label: lang === 'ar' ? 'الملخص' : 'Summary' }, { key: 'onBehalfOrgId', label: lang === 'ar' ? 'نيابة عن' : 'On behalf of', render: (r: any) => (r.onBehalfOrgId ? L.org(r.onBehalfOrgId) : ''), hideSm: true }, { key: 'requestId', label: lang === 'ar' ? 'معرّف الطلب' : 'Request ID', mono: true, hideSm: true }]} /></Section></Page>;
}

export function Security() {
  const { t, lang, run, me } = useApp(); const f = useFmt(); const L = useLookups(); const s = useList('sessions', { sort: 'lastSeenAt', dir: 'desc' });
  const admin = me.roles.includes('super_admin');
  return (
    <Page title={t('nav.security')} sub={lang === 'ar' ? 'التحقق بخطوتين إلزامي للأدوار الحساسة (SEC-001)' : 'MFA is mandatory for sensitive roles (SEC-001)'}>
      <Section title={lang === 'ar' ? 'التحقق بخطوتين لحسابي' : 'My two-factor verification'}><div className="row"><Pill tone={me.user.mfaEnabled ? 'good' : 'warn'}>{me.user.mfaEnabled ? (lang === 'ar' ? 'مفعّل' : 'Enabled') : (lang === 'ar' ? 'غير مفعّل' : 'Disabled')}</Pill><Btn onClick={() => run('me.setMfa', { enabled: !me.user.mfaEnabled })}>{me.user.mfaEnabled ? (lang === 'ar' ? 'إيقاف' : 'Turn off') : (lang === 'ar' ? 'تفعيل' : 'Turn on')}</Btn></div></Section>
      <Section title={admin ? (lang === 'ar' ? 'كل الجلسات' : 'All sessions') : (lang === 'ar' ? 'جلساتي' : 'My sessions')} flush><DataTable rows={(s.data?.items ?? []).filter((y: any) => admin || y.userId === me.user.id)} cols={[{ key: 'u', label: lang === 'ar' ? 'المستخدم' : 'User', render: (r: any) => L.user(r.userId) }, { key: 'device', label: lang === 'ar' ? 'الجهاز' : 'Device' }, { key: 'ip', label: 'IP', mono: true }, { key: 'createdAt', label: lang === 'ar' ? 'بدأت' : 'Started', render: (r: any) => f.dt(r.createdAt) }, { key: 'lastSeenAt', label: lang === 'ar' ? 'آخر نشاط' : 'Last seen', render: (r: any) => f.dt(r.lastSeenAt) }, { key: 'st', label: t('common.status'), render: (r: any) => (r.revokedAt ? <Pill v="revoked" /> : <Pill v="active" />) }, { key: 'a', label: t('common.actions'), render: (r: any) => (!r.revokedAt ? <Btn kind="ghost" onClick={() => run('session.revoke', { sessionId: r.id })}>{lang === 'ar' ? 'إلغاء' : 'Revoke'}</Btn> : null) }]} /></Section>
    </Page>
  );
}

export function Health() {
  const { t, lang, run } = useApp(); const f = useFmt(); const h = useQ<any>('system.health', {});
  if (h.error) return <ErrorBox error={h.error} />; if (!h.data) return <Loading />;
  const d = h.data;
  return (
    <Page title={t('nav.health')} sub={<>{lang === 'ar' ? 'المؤشرات الذهبية ونتائج النسخ — قيم محاكاة لا قياسات حقيقية' : 'Golden signals and backup results — simulated values, not real measurements'} <Sim /></>} actions={<><ConfirmBtn message={lang === 'ar' ? 'تشغيل لقطة نسخ احتياطي (محاكاة)؟' : 'Run a backup snapshot (simulated)?'} onConfirm={() => run('backup.run', { kind: 'snapshot' })}>{lang === 'ar' ? 'نسخة احتياطية' : 'Backup snapshot'}</ConfirmBtn><ConfirmBtn kind="primary" message={lang === 'ar' ? 'تشغيل تمرين استعادة إلى بيئة معزولة (محاكاة)؟' : 'Run a restore drill to an isolated environment (simulated)?'} onConfirm={() => run('backup.run', { kind: 'restore_drill' })}>{lang === 'ar' ? 'تمرين استعادة' : 'Restore drill'}</ConfirmBtn></>}>
      <Kpis items={[{ label: lang === 'ar' ? 'زمن استجابة API ‏P95 (ملّي ثانية)' : 'API P95 (ms)', value: d.api.p95ms, tone: d.api.p95ms > 500 ? 'crit' : 'good' }, { label: lang === 'ar' ? 'نسبة الأخطاء %' : 'Error rate %', value: d.api.errorRatePct }, { label: lang === 'ar' ? 'تأخر صندوق الأحداث الصادرة (ث)' : 'Outbox lag (s)', value: d.queue.outboxLagSec }, { label: lang === 'ar' ? 'رسائل متعذرة المعالجة' : 'Dead-letter', value: d.queue.deadLetter, tone: d.queue.deadLetter ? 'warn' : undefined }, { label: lang === 'ar' ? 'انحرافات مفتوحة' : 'Open excursions', value: d.coldChain.openExcursions, tone: d.coldChain.openExcursions ? 'crit' : undefined }, { label: lang === 'ar' ? 'إقرارات متأخرة' : 'Overdue acks', value: d.coldChain.overdueAcks, tone: d.coldChain.overdueAcks ? 'crit' : undefined }, { label: lang === 'ar' ? 'جلسات نشطة' : 'Active sessions', value: d.security.activeSessions }, { label: lang === 'ar' ? 'عمر آخر نسخة (س)' : 'Last backup age (h)', value: d.backup.lastSnapshotAgeH ?? '—' }]} />
      <div className="grid">
        <Section title={lang === 'ar' ? 'أهداف الاستعادة' : 'Recovery targets'}><DL items={[[lang === 'ar' ? 'العمليات RPO/RTO' : 'Operations RPO/RTO', <bdi key="o">{`RPO ${d.backup.targets.opsRpoMin} ${(lang === 'ar' ? 'د' : 'min')} · RTO ${d.backup.targets.opsRtoMin} ${(lang === 'ar' ? 'د' : 'min')}`}</bdi>], [lang === 'ar' ? 'المالية RPO/RTO' : 'Finance RPO/RTO', <bdi key="f">{`RPO ${d.backup.targets.financeRpoMin} ${(lang === 'ar' ? 'د' : 'min')} · RTO ${d.backup.targets.financeRtoMin} ${(lang === 'ar' ? 'د' : 'min')}`}</bdi>], [lang === 'ar' ? 'آخر تمرين' : 'Last drill', d.backup.lastDrill ? <span key="l">{f.dt(d.backup.lastDrill.at)} · <bdi>{`RPO ${d.backup.lastDrill.rpoMin} ${(lang === 'ar' ? 'د' : 'min')} · RTO ${d.backup.lastDrill.rtoMin} ${(lang === 'ar' ? 'د' : 'min')}`}</bdi></span> : '—']]} /></Section>
        <Section title={lang === 'ar' ? 'قاعدة البيانات والطابور' : 'Database and queue'}><DL items={[['CPU %', d.database.cpuPct], [lang === 'ar' ? 'الاتصالات' : 'Connections', d.database.connections], [lang === 'ar' ? 'استعلامات بطيئة' : 'Slow queries', d.database.slowQueries], [lang === 'ar' ? 'بانتظار/نشطة/فاشلة' : 'Waiting/active/failed', `${d.queue.waiting} / ${d.queue.active} / ${d.queue.failed}`]]} /></Section>
      </div>
      <Section title={lang === 'ar' ? 'سجل النسخ والتمارين' : 'Backup and drill log'} flush><DataTable rows={d.backups} cols={[{ key: 'at', label: t('common.date'), render: (r: any) => f.dt(r.at) }, { key: 'kind', label: lang === 'ar' ? 'النوع' : 'Kind' }, { key: 'status', label: t('common.status'), render: (r: any) => <Pill v={r.status} d="outcome" /> }, { key: 'durationMin', label: lang === 'ar' ? 'المدة (د)' : 'Duration (min)', num: true }, { key: 'rpo', label: 'RPO/RTO', render: (r: any) => (r.rpoMin ? <bdi>{`${r.rpoMin} / ${r.rtoMin}`}</bdi> : '—') }]} /></Section>
    </Page>
  );
}

export function Profile() {
  const { t, lang, setLang, x, me, run } = useApp(); const p = useList('notificationPrefs');
  const mine = (p.data?.items ?? []).filter((y: any) => y.userId === me.user.id);
  return (
    <Page title={t('common.profile')}>
      <div className="grid">
        <Section title={x(me.user.name)}><DL items={[[t('auth.email'), <Mono key="e">{me.user.email}</Mono>], [lang === 'ar' ? 'الأدوار' : 'Roles', me.roles.map((r: string) => t('roles.' + r)).join(comma(lang))], ['MFA', me.user.mfaEnabled ? '✓' : '—'], [lang === 'ar' ? 'المنطقة الزمنية' : 'Time zone', 'Asia/Riyadh']]} /></Section>
        <Section title={t('common.language')}><div className="row"><Btn kind={lang === 'ar' ? 'primary' : 'default'} onClick={() => { setLang('ar'); run('me.setLang', { lang: 'ar' }, { silent: true }); }}>العربية</Btn><Btn kind={lang === 'en' ? 'primary' : 'default'} onClick={() => { setLang('en'); run('me.setLang', { lang: 'en' }, { silent: true }); }}>English</Btn></div></Section>
        <Section title={t('common.notifications')}>{['in_app', 'email', 'sms', 'push'].map((ch) => { const pr = mine.find((y: any) => y.channel === ch); return <label key={ch} className="check"><input type="checkbox" checked={pr?.enabled ?? true} disabled={ch === 'in_app'} onChange={(e) => run('notification.setPref', { channel: ch, enabled: e.target.checked })} /> {label(lang, ch)}{ch === 'in_app' && <span className="muted"> — {lang === 'ar' ? 'لا يمكن إيقافها (التنبيهات الحرجة)' : 'cannot be turned off (critical alerts)'}</span>}</label>; })}</Section>
      </div>
    </Page>
  );
}

/** بوابة الشريك المبسطة (افتراض G04) */
export function PartnerPortal() {
  const { lang, x, t, run } = useApp(); const f = useFmt(); const p = useQ<any>('partner.portal', {});
  if (p.error) return <ErrorBox error={p.error} />; if (!p.data) return <Loading />;
  return (
    <Page title={x(p.data.partner.name)} sub={lang === 'ar' ? 'بوابة الشريك — رحلاتي وأحداث الناقل والتسويات (افتراض G04)' : 'Partner portal — my legs, carrier events and settlements (assumption G04)'}>
      <Kpis items={[{ label: lang === 'ar' ? 'مراحل النقل' : 'Legs', value: p.data.legs.length }, { label: lang === 'ar' ? 'الدرجة' : 'Score', value: p.data.partner.score }, { label: lang === 'ar' ? 'تسويات مفتوحة' : 'Open settlements', value: p.data.settlements.filter((s: any) => s.status !== 'paid').length }, { label: lang === 'ar' ? 'الحظر' : 'Blocks', value: p.data.blocks.filter((b: any) => !b.resolvedAt).length, tone: p.data.blocks.some((b: any) => !b.resolvedAt) ? 'crit' : 'good' }]} />
      <Section title={lang === 'ar' ? 'مراحل النقل' : 'Legs'} flush><DataTable rows={p.data.legs} cols={[{ key: 'r', label: lang === 'ar' ? 'المسار' : 'Route', render: (l: any) => `${l.originCity} ${lang === 'ar' ? '←' : '→'} ${l.destCity}` }, { key: 'sh', label: t('nav.shipments'), render: (l: any) => l.shipments.join(', ') }, { key: 'scheduledDeparture', label: lang === 'ar' ? 'المغادرة' : 'Departure', render: (l: any) => f.dt(l.scheduledDeparture) }, { key: 'status', label: t('common.status'), render: (l: any) => <Pill v={l.status} /> }, { key: 'a', label: lang === 'ar' ? 'إرسال حدث (محاكاة API)' : 'Send event (simulated API)', render: (l: any) => <div className="row">{(['accepted', 'departed', 'arrived', 'released'] as const).map((ev) => <Btn key={ev} kind="ghost" disabled={l.events.some((e: any) => e.eventType === ev)} onClick={() => run('carrier.event', { legId: l.id, eventType: ev })}>{ev}</Btn>)}</div> }]} /></Section>
      <Section title={t('nav.settlements')} flush><DataTable rows={p.data.settlements} cols={[{ key: 'settlementNo', label: lang === 'ar' ? 'التسوية' : 'Settlement', mono: true }, { key: 'period', label: lang === 'ar' ? 'الفترة' : 'Period', render: (s: any) => `${s.periodStart.slice(0, 10)} ${lang === 'ar' ? '←' : '→'} ${s.periodEnd.slice(0, 10)}` }, { key: 'calculated', label: lang === 'ar' ? 'المستحق' : 'Payable', num: true, render: (s: any) => f.sar(s.calculated) }, { key: 'status', label: t('common.status'), render: (s: any) => <Pill v={s.status} /> }]} /></Section>
    </Page>
  );
}
void ShipLink; void opts; void transport;
