'use client';
// مكوّنات الخيار B — مركز قيادة ملوّن: مؤشرات تعدّ تصاعدياً، مخططات ترسم نفسها، خريطة بمسارات متحركة، أزرار بتموّج
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { dict, fmtDateTime, fmtNumber, fmtSAR, fmtTemp, ltr } from '@medlog/i18n';
import { useApp } from './store';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---------- الحالات ----------
const TONE: Record<string, 'good' | 'warn' | 'crit' | 'info' | 'mute'> = {
  delivered: 'good', confirmed: 'info', pickup_scheduled: 'info', collected: 'info', in_transit: 'info', at_handover: 'info', draft: 'mute', cancelled: 'mute', returned: 'mute', failed: 'crit', exception: 'crit', return_pending: 'warn',
  available: 'good', assigned: 'info', in_use: 'info', returning: 'warn', cleaning: 'warn', inspection: 'warn', maintenance: 'crit', partner_custody: 'info', retired: 'mute',
  ready: 'good', low_battery: 'warn', offline: 'warn', faulty: 'crit', suspended: 'crit',
  open: 'crit', acknowledged: 'warn', under_review: 'warn', closed: 'good', investigating: 'warn', decision: 'warn',
  submitted: 'info', assessed: 'warn', approved: 'good', rejected: 'mute', issued: 'info', partially_paid: 'warn', paid: 'good', overdue: 'crit', void: 'mute', reconciled: 'info', disputed: 'crit',
  valid: 'good', expiring: 'warn', expired: 'crit', pending_verification: 'warn', pending: 'warn', pending_approval: 'warn', active: 'good', published: 'good', superseded: 'mute', planned: 'info', dispatched: 'info', in_progress: 'info', completed: 'good', departed: 'info', arrived: 'good',
  critical: 'crit', high: 'crit', medium: 'warn', low: 'info', major: 'crit', minor: 'warn', live: 'good', delayed: 'warn', stale: 'crit', none: 'mute', inferred: 'info',
  parsed: 'good', quarantined: 'warn', dead_letter: 'crit', duplicate: 'mute', acked: 'good', sent: 'info', on_route: 'info', off_shift: 'mute', done: 'good',
  simulated: 'warn', not_configured: 'mute', planned_phase_2: 'mute', blocked: 'crit',
};
const DICTS = ['shipmentStatus', 'boxStatus', 'deviceState', 'excursionStatus', 'incidentStatus', 'claimStatus', 'invoiceStatus', 'settlementStatus', 'licenseStatus', 'severity', 'freshness', 'thermal', 'level', 'mode', 'custodian', 'approvalKind', 'roles', 'requestType'] as const;
const EXTRA: Record<string, { ar: string; en: string }> = {
  pending: { ar: 'معلّق', en: 'Pending' }, pending_approval: { ar: 'بانتظار الاعتماد', en: 'Pending approval' }, active: { ar: 'نشط', en: 'Active' }, published: { ar: 'منشور', en: 'Published' }, superseded: { ar: 'مستبدل', en: 'Superseded' }, planned: { ar: 'مخطط', en: 'Planned' }, dispatched: { ar: 'مُرسل', en: 'Dispatched' }, in_progress: { ar: 'جارٍ', en: 'In progress' }, completed: { ar: 'مكتمل', en: 'Completed' }, departed: { ar: 'غادر', en: 'Departed' }, arrived: { ar: 'وصل', en: 'Arrived' },
  parsed: { ar: 'محلَّلة', en: 'Parsed' }, quarantined: { ar: 'معزولة', en: 'Quarantined' }, dead_letter: { ar: 'Dead-letter', en: 'Dead-letter' }, duplicate: { ar: 'مكررة', en: 'Duplicate' }, acked: { ar: 'مُستلم ACK', en: 'Acked' }, sent: { ar: 'مرسل', en: 'Sent' }, expired: { ar: 'منتهٍ', en: 'Expired' },
  on_route: { ar: 'في مسار', en: 'On route' }, off_shift: { ar: 'خارج المناوبة', en: 'Off shift' }, done: { ar: 'منجز', en: 'Done' }, simulated: { ar: 'محاكاة', en: 'Simulated' }, not_configured: { ar: 'غير مهيأ', en: 'Not configured' }, planned_phase_2: { ar: 'مرحلة لاحقة', en: 'Later phase' }, blocked: { ar: 'محظور', en: 'Blocked' },
  approved: { ar: 'معتمد', en: 'Approved' }, rejected: { ar: 'مرفوض', en: 'Rejected' }, draft: { ar: 'مسودة', en: 'Draft' }, overdue: { ar: 'متأخر', en: 'Overdue' }, inactive: { ar: 'غير نشط', en: 'Inactive' }, revoked: { ar: 'ملغى', en: 'Revoked' }, invited: { ar: 'مدعو', en: 'Invited' }, disabled: { ar: 'معطل', en: 'Disabled' }, skipped: { ar: 'تم تخطيه', en: 'Skipped' }, requested: { ar: 'مطلوب', en: 'Requested' }, under_review: { ar: 'قيد المراجعة', en: 'Under review' },
  offline_expected_or_unknown: { ar: 'غير متصل (متوقع أثناء الطيران)', en: 'Offline (expected in flight)' }, online: { ar: 'متصل', en: 'Online' }, offline_or_delayed: { ar: 'غير متصل أو متأخر', en: 'Offline or delayed' }, no_device: { ar: 'لا جهاز', en: 'No device' }, unavailable: { ar: 'غير متاح', en: 'Unavailable' },
  BLOOD_TUBES: { ar: 'أنابيب دم', en: 'Blood tubes' }, TISSUE_BIOPSY: { ar: 'خزعة نسيجية', en: 'Tissue biopsy' }, SWAB_PCR: { ar: 'مسحة PCR', en: 'PCR swab' }, URINE_CULTURE: { ar: 'مزرعة بول', en: 'Urine culture' }, CSF_SAMPLE: { ar: 'سائل نخاعي', en: 'CSF sample' }, SERUM_ALIQUOT: { ar: 'عينة مصل', en: 'Serum aliquot' },
  pickup: { ar: 'استلام', en: 'Pickup' }, delivery: { ar: 'تسليم', en: 'Delivery' }, handover: { ar: 'نقل حيازة', en: 'Handover' }, return: { ar: 'إرجاع', en: 'Return' }, road: { ar: 'بري', en: 'Road' }, air: { ar: 'جوي', en: 'Air' },
  applicable: { ar: 'منطبق', en: 'Applicable' }, not_applicable: { ar: 'غير منطبق', en: 'Not applicable' }, pending_legal_review: { ar: 'بانتظار المراجعة القانونية', en: 'Pending legal review' }, success: { ar: 'نجح', en: 'Success' }, failed: { ar: 'فشل', en: 'Failed' }, received: { ar: 'مستلمة', en: 'Received' }, simulated_cleared: { ar: 'مقبولة (محاكاة)', en: 'Cleared (simulated)' }, not_submitted: { ar: 'لم تُرسل', en: 'Not submitted' }, paused: { ar: 'موقوف', en: 'Paused' },
};
export function label(lang: 'ar' | 'en', v: string | null | undefined) {
  if (!v) return '—';
  for (const d of DICTS) { const e = (dict as any)[d][v]; if (e) return e[lang]; }
  return EXTRA[v]?.[lang] ?? v;
}
export function Pill({ v, tone, children }: { v?: string | null; tone?: string; children?: React.ReactNode }) {
  const { lang } = useApp();
  return <span className={cx('pill', tone ?? TONE[v ?? ''] ?? 'mute')}>{children ?? label(lang, v)}</span>;
}
export const Mono = ({ children }: { children: React.ReactNode }) => <span className="mono">{children}</span>;
export function Sim({ title }: { title?: string }) { const { lang } = useApp(); return <span className="sim" title={title}>{lang === 'ar' ? 'محاكاة' : 'Simulated'}</span>; }
export function Demo() { const { lang } = useApp(); return <span className="sim">{lang === 'ar' ? 'بيانات عرض' : 'Demo data'}</span>; }

// ---------- تنسيق ----------
export function useFmt() {
  const { lang } = useApp();
  return { dt: (s?: string | null) => fmtDateTime(lang, s), sar: (h?: number | null) => fmtSAR(lang, h), num: (n?: number | null, d = 0) => fmtNumber(lang, n, d), temp: (c?: number | null) => fmtTemp(lang, c), id: (s: string) => ltr(s) };
}

// ---------- هيكل الصفحات ----------
export function Page({ title, sub, actions, children, crumbs }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; crumbs?: { label: string; href?: string }[] }) {
  return (
    <div className="page">
      {crumbs && <nav className="crumbs" aria-label="breadcrumb">{crumbs.map((c, i) => <span key={i}>{c.href ? <a href={c.href}>{c.label}</a> : c.label}</span>)}</nav>}
      <header className="pagehead"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{actions && <div className="row">{actions}</div>}</header>
      {children}
    </div>
  );
}
export const Section = ({ title, actions, children, flush }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean }) => (
  <section className={cx('card', flush && 'flush')}>{(title || actions) && <header className="cardhead"><h2>{title}</h2>{actions && <div className="row">{actions}</div>}</header>}{children}</section>
);
const HUES = ['var(--c-indigo)', 'var(--c-cyan)', 'var(--c-violet)', 'var(--c-amber)', 'var(--c-pink)', 'var(--c-green)', 'var(--c-blue)', 'var(--c-orange)'];
const KICONS = ['M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M13 2L4 14h7l-1 8 9-12h-7z', 'M3 12h4l3-8 4 16 3-8h4', 'M12 2v10M12 22a4 4 0 0 0 4-4c0-2-2-3-2-5V4a2 2 0 0 0-4 0v9c0 2-2 3-2 5a4 4 0 0 0 4 4z', 'M20 6L9 17l-5-5', 'M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6', 'M17 20h5v-2a3 3 0 0 0-5.4-1.8M9 20H2v-2a4 4 0 0 1 7-2.6M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'];
/** يعدّ الرقم الأول داخل النص تصاعدياً عند ظهوره أو تغيّره */
export function CountUp({ value }: { value: React.ReactNode }) {
  const txt = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : null;
  const m = txt?.match(/-?[\d,]+(\.\d+)?/);
  const target = m ? Number(m[0].replace(/,/g, '')) : NaN;
  const [v, setV] = useState(Number.isFinite(target) ? 0 : target);
  const prev = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); prev.current = target; return; }
    const from = prev.current, t0 = performance.now(), d = 900; let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / d); const e = 1 - Math.pow(1 - k, 3); setV(from + (target - from) * e); if (k < 1) raf = requestAnimationFrame(step); else prev.current = target; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target]);
  if (!txt || !m || !Number.isFinite(target)) return <>{value}</>;
  const dec = m[1] ? m[1].length - 1 : 0;
  const shown = new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
  return <>{txt.slice(0, m.index)}{m[0].includes(',') || Math.abs(target) >= 1000 ? shown : shown.replace(/,/g, '')}{txt.slice((m.index ?? 0) + m[0].length)}</>;
}
function Spark({ seed }: { seed: number }) {
  const pts = Array.from({ length: 12 }, (_, i) => 20 + 12 * Math.sin(i * 0.9 + seed) + 6 * Math.cos(i * 1.7 + seed * 2));
  const d = pts.map((y, i) => `${i ? 'L' : 'M'}${(i / 11) * 200},${y.toFixed(1)}`).join('');
  return <svg className="spark" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true"><path d={d + 'L200,40L0,40Z'} fill="var(--h)" opacity=".18" /><path d={d} fill="none" stroke="var(--h)" strokeWidth="1.6" /></svg>;
}
export const Kpis = ({ items }: { items: { label: string; value: React.ReactNode; tone?: 'warn' | 'crit' | 'good'; href?: string }[] }) => (
  <div className="kpis">{items.map((k, i) => {
    const style = { '--i': i, ...(k.tone ? {} : { '--h': HUES[i % HUES.length] }) } as React.CSSProperties;
    const body = <><span className="ki" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={KICONS[i % KICONS.length]} /></svg></span><span>{k.label}</span><b><CountUp value={k.value} /></b><Spark seed={i * 1.3 + k.label.length} /></>;
    return k.href ? <a key={i} href={k.href} className={cx('kpi', k.tone)} style={style}>{body}</a> : <div key={i} className={cx('kpi', k.tone)} style={style}>{body}</div>;
  })}</div>
);
export const DL = ({ items }: { items: [React.ReactNode, React.ReactNode][] }) => <dl className="dl">{items.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>)}</dl>;
export function Loading() { const { t } = useApp(); return <div className="state" role="status"><span className="spinner" aria-hidden="true" /><span>{t('common.loading')}</span><div className="skel" aria-hidden="true" style={{ maxWidth: 420 }}><i /><i /><i /></div></div>; }
export function Empty({ text, action }: { text?: string; action?: React.ReactNode }) { const { t } = useApp(); return <div className="state empty"><svg className="empty-ill" viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset=".5" stopColor="#a855f7" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs><rect x="18" y="30" width="60" height="44" rx="8" fill="none" stroke="url(#eg)" strokeWidth="3" /><path d="M18 42h60M40 30l8-12 8 12" fill="none" stroke="url(#eg)" strokeWidth="3" strokeLinejoin="round" /><circle cx="48" cy="58" r="5" fill="url(#eg)"><animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" /></circle></svg><p>{text ?? t('common.empty')}</p>{action}</div>; }
export function ErrorBox({ error }: { error: any }) { const { lang, t } = useApp(); return <div className="state err" role="alert"><b>{t('common.error')}</b><p>{error?.message?.[lang] ?? String(error)}</p></div>; }
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: React.ReactNode; count?: number }[]; value: string; onChange(id: string): void }) {
  return <div className="tabs" role="tablist">{tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>{t.label}{t.count != null && <span className="count">{t.count}</span>}</button>)}</div>;
}
export function ripple(e: React.MouseEvent<HTMLElement>) {
  const b = e.currentTarget; const r = b.getBoundingClientRect(); const s = Math.max(r.width, r.height);
  const el = document.createElement('span'); el.className = 'rip'; el.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.appendChild(el); setTimeout(() => el.remove(), 600);
}
export const Btn = ({ kind = 'default', onClick, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'default' | 'primary' | 'danger' | 'ghost' }) => <button type="button" {...p} onClick={(e) => { ripple(e); onClick?.(e); }} className={cx('btn', kind, p.className)} />;

// ---------- الحوار ----------
export function Modal({ title, onClose, children, footer, wide }: { title: React.ReactNode; onClose(): void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', wide && 'wide')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <header><h2>{title}</h2><button className="x" onClick={onClose} aria-label="close">×</button></header>
        <div className="mbody">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- النماذج ----------
export type FieldDef = { name: string; label: string; type?: 'text' | 'number' | 'select' | 'date' | 'datetime' | 'textarea' | 'checkbox' | 'multi' | 'email' | 'tel'; options?: { value: string; label: string }[]; required?: boolean; placeholder?: string; hint?: string; dir?: 'ltr' | 'rtl'; min?: number; max?: number; step?: number; pattern?: RegExp; patternMsg?: string; full?: boolean };
export function FormFields({ fields, values, set, errors }: { fields: FieldDef[]; values: Record<string, any>; set(n: string, v: any): void; errors: Record<string, string> }) {
  return (
    <div className="formgrid">
      {fields.map((f) => {
        const id = 'f_' + f.name; const err = errors[f.name];
        const common = { id, 'aria-invalid': !!err, 'aria-describedby': err ? id + '_e' : undefined, dir: f.dir };
        let input: React.ReactNode;
        if (f.type === 'select') input = <select {...common} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}><option value="">—</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
        else if (f.type === 'textarea') input = <textarea {...common} rows={3} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />;
        else if (f.type === 'checkbox') input = <label className="check"><input id={id} type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} /> {f.placeholder}</label>;
        else if (f.type === 'multi') input = <div className="checks">{f.options?.map((o) => { const arr: string[] = values[f.name] ?? []; return <label key={o.value} className="check"><input type="checkbox" checked={arr.includes(o.value)} onChange={(e) => set(f.name, e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} /> {o.label}</label>; })}</div>;
        else input = <input {...common} type={f.type === 'datetime' ? 'datetime-local' : f.type ?? 'text'} min={f.min} max={f.max} step={f.step} value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.name, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />;
        return <div key={f.name} className={cx('field', f.full || f.type === 'textarea' || f.type === 'multi' ? 'full' : '', err && 'bad')}>
          <label htmlFor={id}>{f.label}{f.required && <span className="req" aria-hidden="true"> *</span>}</label>{input}
          {err ? <span className="ferr" id={id + '_e'}>{err}</span> : f.hint ? <span className="hint">{f.hint}</span> : null}
        </div>;
      })}
    </div>
  );
}
export function validate(fields: FieldDef[], v: Record<string, any>, lang: 'ar' | 'en') {
  const e: Record<string, string> = {};
  for (const f of fields) {
    const val = v[f.name];
    if (f.required && (val === undefined || val === '' || val === null || (Array.isArray(val) && !val.length))) { e[f.name] = lang === 'ar' ? 'حقل مطلوب' : 'Required'; continue; }
    if (f.type === 'number' && val !== '' && val != null) { if (f.min != null && val < f.min) e[f.name] = (lang === 'ar' ? 'الحد الأدنى ' : 'Minimum ') + f.min; if (f.max != null && val > f.max) e[f.name] = (lang === 'ar' ? 'الحد الأقصى ' : 'Maximum ') + f.max; }
    if (f.type === 'email' && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) e[f.name] = lang === 'ar' ? 'بريد إلكتروني غير صالح' : 'Invalid email';
    if (f.pattern && val && !f.pattern.test(String(val))) e[f.name] = f.patternMsg ?? (lang === 'ar' ? 'صيغة غير صحيحة' : 'Invalid format');
  }
  return e;
}
const toIsoLocal = (s: string) => (s ? new Date(s).toISOString() : s);
/** نموذج في حوار: يتحقق محلياً ثم ينفّذ الأمر ويعرض أخطاء الخادم على الحقل المعني */
export function FormModal({ title, fields, initial = {}, submitLabel, onSubmit, onClose, intro, danger }: { title: string; fields: FieldDef[]; initial?: Record<string, any>; submitLabel?: string; onSubmit(v: Record<string, any>): Promise<unknown>; onClose(): void; intro?: React.ReactNode; danger?: boolean }) {
  const { lang, t } = useApp();
  const [v, setV] = useState<Record<string, any>>(initial);
  const [e, setE] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const submit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    const errs = validate(fields, v, lang); setE(errs); setFormErr(null);
    if (Object.keys(errs).length) return;
    const out = { ...v }; for (const f of fields) if (f.type === 'datetime' || f.type === 'date') out[f.name] = toIsoLocal(out[f.name]);
    setBusy(true);
    try { await onSubmit(out); onClose(); } catch (err: any) { if (err?.field && fields.some((f) => f.name === err.field)) setE({ [err.field]: err.message?.[lang] }); else setFormErr(err?.message?.[lang] ?? String(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose} footer={<><Btn onClick={onClose}>{t('common.cancel')}</Btn><Btn kind={danger ? 'danger' : 'primary'} onClick={() => submit()} disabled={busy}>{busy ? t('common.saving') : submitLabel ?? t('common.save')}</Btn></>}>
      <form onSubmit={submit} noValidate>
        {intro && <div className="intro">{intro}</div>}
        {formErr && <div className="state err" role="alert">{formErr}</div>}
        <FormFields fields={fields} values={v} set={(n, x) => setV((o) => ({ ...o, [n]: x }))} errors={e} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
/** زر بتأكيد داخل الصفحة (المعاينة لا تدعم confirm()) */
export function ConfirmBtn({ children, message, onConfirm, kind = 'default', disabled }: { children: React.ReactNode; message: string; onConfirm(): Promise<unknown> | void; kind?: 'default' | 'primary' | 'danger'; disabled?: boolean }) {
  const { t } = useApp(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  return <>
    <Btn kind={kind} onClick={() => setOpen(true)} disabled={disabled}>{children}</Btn>
    {open && <Modal title={t('common.areYouSure')} onClose={() => setOpen(false)} footer={<><Btn onClick={() => setOpen(false)}>{t('common.cancel')}</Btn><Btn kind={kind === 'danger' ? 'danger' : 'primary'} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } catch { /* الخطأ يظهر كإشعار */ } finally { setBusy(false); } }}>{t('common.confirm')}</Btn></>}><p>{message}</p></Modal>}
  </>;
}

// ---------- الجدول ----------
export type Col<R> = { key: string; label: string; render?(r: R): React.ReactNode; sort?(r: R): string | number; num?: boolean; mono?: boolean; hideSm?: boolean };
export type Filter<R> = { key: string; label: string; options: { value: string; label: string }[]; get(r: R): string | string[] | null | undefined };
export function DataTable<R extends { id?: string }>({ rows, cols, filters = [], search, onRow, pageSize = 12, empty, toolbar, initialSort, csvName }: { rows: R[] | null; cols: Col<R>[]; filters?: Filter<R>[]; search?: (r: R) => string; onRow?(r: R): void; pageSize?: number; empty?: string; toolbar?: React.ReactNode; initialSort?: { key: string; dir: 'asc' | 'desc' }; csvName?: string }) {
  const { t, lang } = useApp();
  const [q, setQ] = useState(''); const [f, setF] = useState<Record<string, string>>({}); const [page, setPage] = useState(1); const [ps, setPs] = useState(pageSize);
  const [sort, setSort] = useState(initialSort ?? null);
  const [csv, setCsv] = useState<string | null>(null);
  useEffect(() => setPage(1), [q, JSON.stringify(f), ps]);
  const filtered = useMemo(() => {
    let r = rows ?? [];
    for (const fl of filters) { const v = f[fl.key]; if (v) r = r.filter((x) => { const g = fl.get(x); return Array.isArray(g) ? g.includes(v) : g === v; }); }
    if (q.trim() && search) { const s = q.trim().toLowerCase(); r = r.filter((x) => search(x).toLowerCase().includes(s)); }
    if (sort) { const c = cols.find((x) => x.key === sort.key); const get = c?.sort ?? ((x: any) => x[sort.key]); r = [...r].sort((a, b) => { const A = get(a) ?? '', B = get(b) ?? ''; return (A > B ? 1 : A < B ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1); }); }
    return r;
  }, [rows, q, f, sort, filters, search, cols]);
  if (!rows) return <Loading />;
  const pages = Math.max(1, Math.ceil(filtered.length / ps)); const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * ps, cur * ps);
  const exportCsv = () => { const head = cols.map((c) => c.label); const lines = filtered.map((r) => cols.map((c) => { const el = c.render ? c.render(r) : (r as any)[c.key]; const txt = typeof el === 'string' || typeof el === 'number' ? String(el) : c.sort ? String(c.sort(r)) : String((r as any)[c.key] ?? ''); return '"' + txt.replace(/"/g, '""').replace(/[⁦⁩]/g, '') + '"'; }).join(',')); setCsv([head.join(','), ...lines].join('\n')); };
  return (
    <div className="dt">
      {(search || filters.length || toolbar || csvName) && <div className="dttools">
        {search && <input className="dtsearch" type="search" aria-label={t('common.search')} placeholder={t('common.search') + '…'} value={q} onChange={(e) => setQ(e.target.value)} />}
        {filters.map((fl) => <select key={fl.key} aria-label={fl.label} value={f[fl.key] ?? ''} onChange={(e) => setF({ ...f, [fl.key]: e.target.value })}><option value="">{fl.label}: {t('common.all')}</option>{fl.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
        {(q || Object.values(f).some(Boolean)) && <Btn kind="ghost" onClick={() => { setQ(''); setF({}); }}>{t('common.clear')}</Btn>}
        <span className="grow" />
        {csvName && <Btn kind="ghost" onClick={exportCsv}>{t('common.export')} CSV</Btn>}
        {toolbar}
      </div>}
      {filtered.length === 0 ? <Empty text={rows.length ? t('common.noResults') : empty} /> : <>
        <div className="tablewrap"><table>
          <thead><tr>{cols.map((c) => <th key={c.key} className={cx(c.num && 'num', c.hideSm && 'hidesm')} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button className="th" onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' })}>{c.label}<span aria-hidden="true">{sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span></button></th>)}</tr></thead>
          <tbody>{shown.map((r, i) => <tr key={(r as any).id ?? i} className={onRow ? 'click' : ''} onClick={onRow ? () => onRow(r) : undefined} tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => e.key === 'Enter' && onRow(r) : undefined}>{cols.map((c) => <td key={c.key} className={cx(c.num && 'num', c.mono && 'mono', c.hideSm && 'hidesm')}>{c.render ? c.render(r) : String((r as any)[c.key] ?? '—')}</td>)}</tr>)}</tbody>
        </table></div>
        <div className="pager">
          <span className="muted">{t('common.showing')} {(cur - 1) * ps + 1}–{Math.min(cur * ps, filtered.length)} {t('common.of')} {filtered.length}</span>
          <span className="grow" />
          <label className="muted">{t('common.rowsPerPage')} <select value={ps} onChange={(e) => setPs(Number(e.target.value))}>{[12, 25, 50].map((n) => <option key={n}>{n}</option>)}</select></label>
          <Btn kind="ghost" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="previous">{lang === 'ar' ? '›' : '‹'}</Btn>
          <span>{cur} / {pages}</span>
          <Btn kind="ghost" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="next">{lang === 'ar' ? '‹' : '›'}</Btn>
        </div>
      </>}
      {csv && <Modal title={`${csvName}.csv`} onClose={() => setCsv(null)} wide footer={<Btn kind="primary" onClick={() => { navigator.clipboard?.writeText(csv).catch(() => {}); setCsv(null); }}>{lang === 'ar' ? 'نسخ' : 'Copy'}</Btn>}><textarea readOnly dir="ltr" className="csv" value={csv} onFocus={(e) => e.currentTarget.select()} /></Modal>}
    </div>
  );
}

// ---------- الخط الزمني ----------
export function Timeline({ items }: { items: { at: string; receivedAt?: string; kind: string; source: string; title: { ar: string; en: string }; detail?: string }[] }) {
  const { lang } = useApp(); const f = useFmt();
  return <ol className="timeline">{items.map((e, i) => <li key={i} className={'k-' + e.kind}>
    <span className="tdot" aria-hidden="true" />
    <div><b>{e.title[lang]}</b>{e.detail && <span className="muted"> · {e.detail}</span>}</div>
    <div className="tmeta"><time>{f.dt(e.at)}</time><span className="src">{e.source}</span>{e.receivedAt && Date.parse(e.receivedAt) - Date.parse(e.at) > 5 * 60_000 && <span className="pill warn">{lang === 'ar' ? 'وصل متأخراً' : 'Late arrival'}</span>}</div>
  </li>)}</ol>;
}

// ---------- منحنى الحرارة ----------
export function TempChart({ report, height = 220 }: { report: any; height?: number }) {
  const { lang } = useApp(); const f = useFmt();
  const pts = (report?.readings ?? []).filter((r: any) => r.c != null);
  if (!pts.length) return <Empty text={lang === 'ar' ? 'لا قراءات لهذه الشحنة بعد' : 'No readings for this shipment yet'} />;
  const W = 760, H = height, pl = 44, pr = 16, pt = 14, pb = 28;
  const t0 = Date.parse(pts[0].t), t1 = Math.max(Date.parse(pts[pts.length - 1].t), ...report.gaps.map((g: any) => Date.parse(g.to)));
  const lo = Math.min(report.profile.minC - 2, ...pts.map((p: any) => p.c)), hi = Math.max(report.profile.maxC + 2, ...pts.map((p: any) => p.c));
  const X = (t: number) => pl + ((t - t0) / Math.max(1, t1 - t0)) * (W - pl - pr);
  const Y = (c: number) => pt + (1 - (c - lo) / (hi - lo)) * (H - pt - pb);
  const segs: string[] = []; let cur = '';
  pts.forEach((p: any, i: number) => { const gap = i > 0 && Date.parse(p.t) - Date.parse(pts[i - 1].t) > 15 * 60_000; if (gap && cur) { segs.push(cur); cur = ''; } cur += `${cur ? 'L' : 'M'}${X(Date.parse(p.t)).toFixed(1)},${Y(p.c).toFixed(1)}`; });
  if (cur) segs.push(cur);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const xt = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={lang === 'ar' ? 'منحنى الحرارة' : 'Temperature chart'}>
        <rect x={pl} y={Y(report.profile.maxC)} width={W - pl - pr} height={Y(report.profile.minC) - Y(report.profile.maxC)} fill="var(--good-soft)" />
        {ticks.map((v, i) => <g key={i}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x={pl - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v.toFixed(0)}°</text></g>)}
        {xt.map((v, i) => <text key={i} x={X(v)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(v))}</text>)}
        {report.gaps.map((g: any, i: number) => <rect key={i} x={X(Date.parse(g.from))} y={pt} width={Math.max(2, X(Date.parse(g.to)) - X(Date.parse(g.from)))} height={H - pt - pb} fill="url(#hatch)" />)}
        {report.excursions.map((e: any, i: number) => <rect key={i} x={X(Date.parse(e.startedAt))} y={pt} width={Math.max(3, X(Date.parse(e.endedAt ?? new Date(t1).toISOString())) - X(Date.parse(e.startedAt)))} height={H - pt - pb} fill="var(--crit)" opacity="0.12" />)}
        <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="1" opacity="0.35" /></pattern></defs>
        <defs><linearGradient id="tline" x1="0" x2="1"><stop offset="0" stopColor="#6366f1" /><stop offset=".5" stopColor="#a855f7" /><stop offset="1" stopColor="#22d3ee" /></linearGradient><linearGradient id="tarea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a855f7" stopOpacity=".35" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs>
        {segs.map((d, i) => { const xs = d.match(/[ML]([\d.]+),/g)!.map((m) => m.slice(1, -1)); return <path key={'a' + i} className="area" d={`${d}L${xs[xs.length - 1]},${H - pb}L${xs[0]},${H - pb}Z`} fill="url(#tarea)" />; })}
        {segs.map((d, i) => <path key={i} className="line" d={d} fill="none" stroke="url(#tline)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />)}
        {pts.filter((p: any) => p.c > report.profile.maxC || p.c < report.profile.minC).map((p: any, i: number) => <circle key={i} cx={X(Date.parse(p.t))} cy={Y(p.c)} r="2.6" fill="var(--crit)" />)}
        <g className="mk live"><circle className="halo" cx={X(Date.parse(pts[pts.length - 1].t))} cy={Y(pts[pts.length - 1].c)} r="5" /><circle className="core" cx={X(Date.parse(pts[pts.length - 1].t))} cy={Y(pts[pts.length - 1].c)} r="5" /></g>
      </svg>
      <figcaption className="legend">
        <span><i className="sw band" />{lang === 'ar' ? `النطاق ${report.profile.minC}..${report.profile.maxC} °م (غير معتمد)` : `Range ${report.profile.minC}..${report.profile.maxC} °C (not approved)`}</span>
        <span><i className="sw gap" />{lang === 'ar' ? 'فجوة بيانات — لا تعني الالتزام' : 'Data gap — not compliance'}</span>
        <span><i className="sw exc" />{lang === 'ar' ? 'انحراف' : 'Excursion'}</span>
        <span className="muted">{lang === 'ar' ? 'آخر قراءة' : 'Last reading'}: {f.temp(pts[pts.length - 1].c)} · {f.dt(pts[pts.length - 1].t)}</span>
      </figcaption>
    </figure>
  );
}

// ---------- خريطة المملكة (متجهية داخلية، بلا مزود خرائط) ----------
const KSA = 'M200,40 L262,30 L330,62 L392,58 L440,96 L470,150 L520,170 L560,210 L600,236 L640,300 L612,330 L560,350 L510,420 L470,470 L410,500 L350,530 L300,560 L262,590 L226,560 L200,500 L170,440 L140,380 L118,330 L92,290 L60,250 L50,200 L90,150 L130,110 L170,70 Z';
export const project = (lat: number, lng: number) => ({ x: 40 + ((lng - 34.5) / (56 - 34.5)) * 600, y: 30 + ((32.2 - lat) / (32.2 - 16)) * 560 });
export function KsaMap({ points, cities, onPick, height = 380 }: { points: { id: string; lat: number; lng: number; kind: string; label: string; alert?: boolean }[]; cities: { code: string; name: { ar: string; en: string }; lat: number; lng: number }[]; onPick?(id: string): void; height?: number }) {
  const { lang } = useApp();
  const hub = cities.find((c) => c.code === 'RUH') ?? cities[0];
  const H0 = hub ? project(hub.lat, hub.lng) : { x: 340, y: 300 };
  return (
    <figure className="map" style={{ maxHeight: height }}>
      <svg viewBox="0 0 680 620" role="img" aria-label={lang === 'ar' ? 'خريطة الشحنات' : 'Shipment map'}>
        <defs><linearGradient id="flowg" x1="0" x2="1"><stop offset="0" stopColor="#a855f7" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
        {Array.from({ length: 9 }, (_, i) => <line key={'h' + i} className="gridl" x1="0" x2="680" y1={i * 75 + 10} y2={i * 75 + 10} />)}
        {Array.from({ length: 10 }, (_, i) => <line key={'v' + i} className="gridl" y1="0" y2="620" x1={i * 75 + 5} x2={i * 75 + 5} />)}
        <path className="land" d={KSA} />
        {cities.filter((c) => c !== hub).map((c) => { const p = project(c.lat, c.lng); const mx = (p.x + H0.x) / 2, my = Math.min(p.y, H0.y) - 40; return <path key={'f' + c.code} className="flow" d={`M${H0.x},${H0.y} Q${mx},${my} ${p.x},${p.y}`} />; })}
        {cities.map((c) => { const p = project(c.lat, c.lng); return <g key={c.code} className="city"><circle cx={p.x} cy={p.y} r={c === hub ? 5 : 3} /><text x={p.x + 8} y={p.y - 7}>{c.name[lang]}</text></g>; })}
        {points.map((pt, i) => { const p = project(pt.lat, pt.lng); return <g key={pt.id} className={'mk ' + pt.kind} onClick={() => onPick?.(pt.id)} tabIndex={0} role="button" aria-label={pt.label} onKeyDown={(e) => e.key === 'Enter' && onPick?.(pt.id)}>
          {pt.alert && <circle className="alertring" cx={p.x} cy={p.y} r="10" />}
          <circle className="halo" cx={p.x} cy={p.y} r="6" style={{ animationDelay: `${(i % 7) * 0.3}s` }} />
          <circle className="core" cx={p.x} cy={p.y} r="6" /><title>{pt.label}</title></g>; })}
      </svg>
      <figcaption className="legend">{['live', 'delayed', 'stale', 'inferred', 'planned'].map((k) => <span key={k} className={'mk ' + k}><i className={'sw mk ' + k} />{label(lang, k)}</span>)}</figcaption>
    </figure>
  );
}

// ---------- مخطط أعمدة بسيط ----------
export function Bars({ data, height = 180, valueLabel }: { data: { label: string; a: number; b?: number }[]; height?: number; valueLabel?: [string, string?] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b ?? 0]));
  const W = 760, H = height, pb = 26, pt = 10, bw = (W - 20) / data.length;
  return <figure className="chart"><svg viewBox={`0 0 ${W} ${H}`} role="img">
    <defs><linearGradient id="bga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a855f7" /><stop offset="1" stopColor="#6366f1" /></linearGradient><linearGradient id="bgb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#0ea5e9" /></linearGradient></defs>
    {[0, 0.5, 1].map((r) => <line key={r} x1={10} x2={W - 10} y1={pt + (H - pt - pb) * (1 - r)} y2={pt + (H - pt - pb) * (1 - r)} stroke="var(--line)" />)}
    {data.map((d, i) => { const h1 = ((H - pt - pb) * d.a) / max, h2 = ((H - pt - pb) * (d.b ?? 0)) / max; const x = 10 + i * bw; return <g key={i}>
      <rect className="bar" style={{ animationDelay: `${i * 40}ms` }} x={x + bw * 0.15} y={H - pb - h1} width={bw * (d.b != null ? 0.33 : 0.7)} height={h1} fill="url(#bga)" rx="5"><title>{`${d.label}: ${d.a}`}</title></rect>
      {d.b != null && <rect className="bar" style={{ animationDelay: `${i * 40 + 80}ms` }} x={x + bw * 0.52} y={H - pb - h2} width={bw * 0.33} height={h2} fill="url(#bgb)" rx="5"><title>{`${d.label}: ${d.b}`}</title></rect>}
      {(data.length <= 16 || i % 2 === 0) && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>}
    </g>; })}
    <text x={12} y={pt + 10} fontSize="11" fill="var(--muted)">{max}</text>
  </svg>{valueLabel && <figcaption className="legend"><span><i className="sw" style={{ background: 'linear-gradient(#a855f7,#6366f1)' }} />{valueLabel[0]}</span>{valueLabel[1] && <span><i className="sw" style={{ background: 'linear-gradient(#22d3ee,#0ea5e9)' }} />{valueLabel[1]}</span>}</figcaption>}</figure>;
}
