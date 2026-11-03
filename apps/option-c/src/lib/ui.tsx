'use client';
// مكتبة مكوّنات الخيار C (Emerald Health): حركة Motion، جداول بتوسيع وإجراءات جماعية، خط زمني قابل للتوسيع، منحنى حرارة تفاعلي، خريطة بعلامات قابلة للنقر
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { dict, fmtDateTime, fmtRelative, fmtNumber, fmtSAR, fmtTemp, ltr } from '@medlog/i18n';
import { useApp } from './store';
import { label as tlabel, timelineTitle, timelineDetail } from './l10n';
import { AnimatePresence, Collapse, DUR, EASE, Tip, fadeUp, motion, staggerParent } from './motion';

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
/** تسمية رمز تقني من المصدر المعتمد (packages/i18n/src/terms.ts)؛ domain يحل الرموز المتعددة المعنى (مثل outcome لـ failed) */
export function label(lang: 'ar' | 'en', v: string | null | undefined, domain?: string) { return tlabel(lang, v, domain); }
export function Pill({ v, d, tone, children, tip }: { v?: string | null; d?: string; tone?: string; children?: React.ReactNode; tip?: React.ReactNode }) {
  const { lang } = useApp();
  const t = tone ?? TONE[v ?? ''] ?? 'mute';
  const el = <span className={cx('pill', t, (v === 'live' || v === 'open' || v === 'critical') && 'pulse')}>{children === undefined ? label(lang, v, d) : typeof children === 'string' && /^[A-Za-z_]+$/.test(children) ? label(lang, children, d) : children}</span>;
  return tip ? <Tip text={tip}>{el}</Tip> : el;
}
export const Mono = ({ children }: { children: React.ReactNode }) => <span className="mono">{children}</span>;
export function Sim({ title }: { title?: string }) { const { lang } = useApp(); return <span className="sim" title={title}>{lang === 'ar' ? 'محاكاة' : 'Simulated'}</span>; }
export function Demo() { const { lang } = useApp(); return <span className="sim">{lang === 'ar' ? 'بيانات عرض' : 'Demo data'}</span>; }

// ---------- تنسيق ----------
export function useFmt() {
  const { lang } = useApp();
  return { rel: (s?: string | null) => fmtRelative(lang, s), dt: (s?: string | null) => fmtDateTime(lang, s), sar: (h?: number | null) => fmtSAR(lang, h), num: (n?: number | null, d = 0) => fmtNumber(lang, n, d), temp: (c?: number | null) => fmtTemp(lang, c), id: (s: string) => ltr(s) };
}

// ---------- هيكل الصفحات ----------
export function Page({ title, sub, actions, children, crumbs }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; crumbs?: { label: string; href?: string }[] }) {
  return (
    <motion.div className="page" variants={staggerParent} initial="hidden" animate="show">
      {crumbs && <nav className="crumbs" aria-label="breadcrumb">{crumbs.map((c, i) => <span key={i}>{c.href ? <a href={c.href}>{c.label}</a> : c.label}</span>)}</nav>}
      <motion.header variants={fadeUp} className="pagehead"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{actions && <div className="row">{actions}</div>}</motion.header>
      {children}
    </motion.div>
  );
}
export const Section = ({ title, actions, children, flush }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean }) => (
  <motion.section variants={fadeUp} className={cx('card', flush && 'flush')}>{(title || actions) && <header className="cardhead"><h2>{title}</h2>{actions && <div className="row">{actions}</div>}</header>}{children}</motion.section>
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
/** مؤشرات: الرقم حقيقي ويعدّ تصاعدياً (900ms، يُعطَّل مع تقليل الحركة). الحالات الحرجة تظهر فوراً بلا تأخير دخول. */
export const Kpis = ({ items }: { items: { label: string; value: React.ReactNode; tone?: 'warn' | 'crit' | 'good'; href?: string; hint?: React.ReactNode }[] }) => (
  <motion.div className="kpis" variants={staggerParent}>{items.map((k, i) => {
    const style = (k.tone ? {} : { '--h': HUES[i % HUES.length] }) as React.CSSProperties;
    const body = <><span className="ki" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={KICONS[i % KICONS.length]} /></svg></span><span>{k.label}</span><b><CountUp value={k.value} /></b>{k.tone === 'crit' && <span className="sr-only">!</span>}</>;
    const variants = k.tone === 'crit' ? undefined : fadeUp;
    return k.href ? <motion.a key={i} variants={variants} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} href={k.href} className={cx('kpi', k.tone)} style={style} title={typeof k.hint === 'string' ? k.hint : undefined}>{body}</motion.a> : <motion.div key={i} variants={variants} className={cx('kpi', k.tone)} style={style}>{body}</motion.div>;
  })}</motion.div>
);
export const DL = ({ items }: { items: [React.ReactNode, React.ReactNode][] }) => <dl className="dl">{items.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>)}</dl>;
export function Loading() { const { t } = useApp(); return <div className="state" role="status"><span className="spinner" aria-hidden="true" /><span>{t('common.loading')}</span><div className="skel" aria-hidden="true" style={{ maxWidth: 420 }}><i /><i /><i /></div></div>; }
export function Empty({ text, action }: { text?: string; action?: React.ReactNode }) { const { t } = useApp(); return <div className="state empty"><svg className="empty-ill" viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#087F70" /><stop offset=".5" stopColor="#0B9A87" /><stop offset="1" stopColor="#D9EEE8" /></linearGradient></defs><rect x="18" y="30" width="60" height="44" rx="8" fill="none" stroke="url(#eg)" strokeWidth="3" /><path d="M18 42h60M40 30l8-12 8 12" fill="none" stroke="url(#eg)" strokeWidth="3" strokeLinejoin="round" /><circle cx="48" cy="58" r="5" fill="url(#eg)"><animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" /></circle></svg><p>{text ?? t('common.empty')}</p>{action}</div>; }
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
// ---------- الحوار ----------
/** حوار بدخول وخروج متحركين (220ms)، حبس للتركيز، Esc للإغلاق، وإعادة التركيز لعنصر الفتح */
export function Modal({ title, onClose, children, footer, wide }: { title: React.ReactNode; onClose(): void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const [shown, setShown] = useState(true); const ref = useRef<HTMLDivElement>(null);
  const close = () => setShown(false);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.x)')?.focus(), 40);
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && ref.current) { const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]; if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    };
    window.addEventListener('keydown', k); return () => { window.removeEventListener('keydown', k); back?.focus?.(); };
  }, []);
  return (
    <AnimatePresence onExitComplete={onClose}>{shown && (
      <motion.div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.fast }}>
        <motion.div ref={ref} className={cx('modal', wide && 'wide')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
          initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: DUR.base, ease: EASE.emphasized }}>
          <header><h2>{title}</h2><button className="x" onClick={close} aria-label="close">×</button></header>
          <div className="mbody">{children}</div>
          {footer && <footer>{footer}</footer>}
        </motion.div>
      </motion.div>)}
    </AnimatePresence>
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
/** القيم الرمزية (مثل card_simulated) تُعرض بتسميتها المترجمة إن وُجدت؛ غير ذلك تُعرض كما هي */
const codeLabel = (lang: 'ar' | 'en', v: unknown) => (typeof v === 'string' && /^[A-Za-z_]+$/.test(v) ? label(lang, v) : String(v ?? '—'));
export type Col<R> = { key: string; label: string; render?(r: R): React.ReactNode; sort?(r: R): string | number; num?: boolean; mono?: boolean; hideSm?: boolean };
export type Filter<R> = { key: string; label: string; options: { value: string; label: string }[]; get(r: R): string | string[] | null | undefined };
export type BulkAction<R> = { label: string; kind?: 'default' | 'primary' | 'danger'; run(rows: R[]): Promise<unknown> | void };
/** جدول: بحث، تصفية، فرز، ترقيم، تصدير CSV، صفوف قابلة للتوسيع (expand)، وتحديد متعدد بإجراءات جماعية (bulk) */
export function DataTable<R extends { id?: string }>({ rows, cols, filters = [], search, onRow, pageSize = 12, empty, toolbar, initialSort, csvName, expand, bulk }: { rows: R[] | null; cols: Col<R>[]; filters?: Filter<R>[]; search?: (r: R) => string; onRow?(r: R): void; pageSize?: number; empty?: string; toolbar?: React.ReactNode; initialSort?: { key: string; dir: 'asc' | 'desc' }; csvName?: string; expand?(r: R): React.ReactNode; bulk?: BulkAction<R>[] }) {
  const { t, lang } = useApp();
  const [q, setQ] = useState(''); const [f, setF] = useState<Record<string, string>>({}); const [page, setPage] = useState(1); const [ps, setPs] = useState(pageSize);
  const [sort, setSort] = useState(initialSort ?? null);
  const [csv, setCsv] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false);
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
  const key = (r: R, i: number) => (r as any).id ?? String(i);
  const allOnPage = shown.length > 0 && shown.every((r, i) => sel.has(key(r, i)));
  const toggleAll = () => { const n = new Set(sel); shown.forEach((r, i) => (allOnPage ? n.delete(key(r, i)) : n.add(key(r, i)))); setSel(n); };
  const selectedRows = filtered.filter((r, i) => sel.has(key(r, i)));
  const exportCsv = (list: R[] = filtered) => { const head = cols.map((c) => c.label); const lines = list.map((r) => cols.map((c) => { const el = c.render ? c.render(r) : (r as any)[c.key]; const txt = typeof el === 'string' || typeof el === 'number' ? String(el) : c.sort ? String(c.sort(r)) : String((r as any)[c.key] ?? ''); return '"' + txt.replace(/"/g, '""').replace(/[⁦⁩]/g, '') + '"'; }).join(',')); setCsv([head.join(','), ...lines].join('\n')); };
  const extra = (expand ? 1 : 0) + (bulk ? 1 : 0);
  return (
    <div className="dt">
      {(search || filters.length || toolbar || csvName) && <div className="dttools">
        {search && <input className="dtsearch" type="search" aria-label={t('common.search')} placeholder={t('common.search') + '…'} value={q} onChange={(e) => setQ(e.target.value)} />}
        {filters.map((fl) => <select key={fl.key} aria-label={fl.label} value={f[fl.key] ?? ''} onChange={(e) => setF({ ...f, [fl.key]: e.target.value })}><option value="">{fl.label}: {t('common.all')}</option>{fl.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
        {(q || Object.values(f).some(Boolean)) && <Btn kind="ghost" onClick={() => { setQ(''); setF({}); }}>{t('common.clear')}</Btn>}
        <span className="grow" />
        {csvName && <Btn kind="ghost" onClick={() => exportCsv()}>{t('common.export')} CSV</Btn>}
        {toolbar}
      </div>}
      <AnimatePresence>{bulk && sel.size > 0 && <motion.div className="bulkbar" role="region" aria-label={lang === 'ar' ? 'إجراءات جماعية' : 'Bulk actions'} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: DUR.fast }}>
        <b>{lang === 'ar' ? `محدد: ${sel.size}` : `${sel.size} selected`}</b>
        {bulk.map((b) => <Btn key={b.label} kind={b.kind ?? 'default'} disabled={busy} onClick={async () => { setBusy(true); try { await b.run(selectedRows); setSel(new Set()); } finally { setBusy(false); } }}>{b.label}</Btn>)}
        {csvName && <Btn kind="ghost" onClick={() => exportCsv(selectedRows)}>{lang === 'ar' ? 'تصدير المحدد' : 'Export selected'}</Btn>}
        <Btn kind="ghost" onClick={() => setSel(new Set())}>{lang === 'ar' ? 'إلغاء التحديد' : 'Clear selection'}</Btn>
      </motion.div>}</AnimatePresence>
      {filtered.length === 0 ? <Empty text={rows.length ? t('common.noResults') : empty} /> : <>
        <div className="tablewrap"><table>
          <thead><tr>
            {bulk && <th className="selcol"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label={lang === 'ar' ? 'تحديد كل صفوف الصفحة' : 'Select all rows on page'} /></th>}
            {expand && <th className="expcol"><span className="sr-only">{lang === 'ar' ? 'توسيع' : 'Expand'}</span></th>}
            {cols.map((c) => <th key={c.key} className={cx(c.num && 'num', c.hideSm && 'hidesm')} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>{!c.label ? <span className="sr-only">{lang === 'ar' ? 'إجراءات' : 'Actions'}</span> : <button className="th" onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' })}>{c.label}<span aria-hidden="true">{sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span></button>}</th>)}
          </tr></thead>
          <tbody>{shown.map((r, i) => { const k = key(r, i); const isOpen = !!open[k]; return <React.Fragment key={k}>
            <tr className={cx(onRow && 'click', sel.has(k) && 'selected', isOpen && 'open')} onClick={onRow ? () => onRow(r) : expand ? () => setOpen({ ...open, [k]: !isOpen }) : undefined} tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => e.key === 'Enter' && onRow(r) : undefined}>
              {bulk && <td className="selcol" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(k)} onChange={() => { const n = new Set(sel); n.has(k) ? n.delete(k) : n.add(k); setSel(n); }} aria-label={lang === 'ar' ? 'تحديد الصف' : 'Select row'} /></td>}
              {expand && <td className="expcol" onClick={(e) => e.stopPropagation()}><button className="expbtn" aria-expanded={isOpen} aria-label={isOpen ? (lang === 'ar' ? 'طي التفاصيل' : 'Collapse details') : (lang === 'ar' ? 'عرض التفاصيل' : 'Show details')} onClick={() => setOpen({ ...open, [k]: !isOpen })}><motion.svg width="14" height="14" viewBox="0 0 24 24" animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: DUR.fast }} aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" /></motion.svg></button></td>}
              {cols.map((c) => <td key={c.key} className={cx(c.num && 'num', c.mono && 'mono', c.hideSm && 'hidesm')}>{c.render ? c.render(r) : codeLabel(lang, (r as any)[c.key])}</td>)}
            </tr>
            {expand && isOpen && <tr className="exprow"><td colSpan={cols.length + extra}><Collapse open>{<div className="expbody">{expand(r)}</div>}</Collapse></td></tr>}
          </React.Fragment>; })}</tbody>
        </table></div>
        <div className="pager">
          <span className="muted">{t('common.showing')} {(cur - 1) * ps + 1}–{Math.min(cur * ps, filtered.length)} {t('common.of')} {filtered.length}</span>
          <span className="grow" />
          <label className="muted">{t('common.rowsPerPage')} <select value={ps} onChange={(e) => setPs(Number(e.target.value))}>{[12, 25, 50].map((n) => <option key={n}>{n}</option>)}</select></label>
          <Btn kind="ghost" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label={lang === 'ar' ? 'الصفحة السابقة' : 'Previous page'}>{lang === 'ar' ? '›' : '‹'}</Btn>
          <span>{cur} / {pages}</span>
          <Btn kind="ghost" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label={lang === 'ar' ? 'الصفحة التالية' : 'Next page'}>{lang === 'ar' ? '‹' : '›'}</Btn>
        </div>
      </>}
      {csv && <Modal title={`${csvName}.csv`} onClose={() => setCsv(null)} wide footer={<Btn kind="primary" onClick={() => { navigator.clipboard?.writeText(csv).catch(() => {}); setCsv(null); }}>{lang === 'ar' ? 'نسخ' : 'Copy'}</Btn>}><textarea readOnly dir="ltr" className="csv" value={csv} onFocus={(e) => e.currentTarget.select()} /></Modal>}
    </div>
  );
}

// ---------- الخط الزمني ----------
/** خط زمني بمصدر كل حدث: كل حدث قابل للتوسيع لعرض وقت الجهاز ووقت الاستلام والتأخير والتفاصيل */
export function Timeline({ items }: { items: { at: string; receivedAt?: string; kind: string; source: string; title: { ar: string; en: string }; detail?: string; codes?: any }[] }) {
  const { lang } = useApp(); const f = useFmt(); const [open, setOpen] = useState<Record<number, boolean>>({}); const all = items.length > 0 && items.every((_, i) => open[i]);
  return <div className="tlwrap">
    {items.length > 1 && <div className="row" style={{ justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setOpen(all ? {} : Object.fromEntries(items.map((_, i) => [i, true])))}>{all ? (lang === 'ar' ? 'طي الكل' : 'Collapse all') : (lang === 'ar' ? 'توسيع الكل' : 'Expand all')}</Btn></div>}
    <motion.ol className="timeline" variants={staggerParent} initial="hidden" animate="show">{items.map((e, i) => { const lag = e.receivedAt ? Math.round((Date.parse(e.receivedAt) - Date.parse(e.at)) / 60000) : 0; return <motion.li key={i} variants={fadeUp} className={'k-' + e.kind}>
      <span className="tdot" aria-hidden="true" />
      <button className="tlhead" aria-expanded={!!open[i]} onClick={() => setOpen({ ...open, [i]: !open[i] })}>
        <span><b>{timelineTitle(lang, e)}</b>{lag > 5 && <span className="pill warn" style={{ marginInlineStart: 8 }}>{lang === 'ar' ? 'وصل متأخراً' : 'Late arrival'}</span>}</span>
        <span className="tmeta"><time>{f.dt(e.at)}</time><span className="src">{label(lang, e.source)}</span></span>
      </button>
      <Collapse open={!!open[i]}><dl className="tldetail">
        <div><dt>{lang === 'ar' ? 'وقت الحدث (الجهاز/الميدان)' : 'Event time (device/field)'}</dt><dd>{f.dt(e.at)}</dd></div>
        <div><dt>{lang === 'ar' ? 'وقت الاستلام في النظام' : 'Received by system'}</dt><dd>{e.receivedAt ? f.dt(e.receivedAt) : '—'}{lag > 0 && <span className="muted"> · {lang === 'ar' ? `بعد ${lag} د` : `${lag} min later`}</span>}</dd></div>
        <div><dt>{lang === 'ar' ? 'المصدر' : 'Source'}</dt><dd>{label(lang, e.source)}</dd></div>
        {e.detail && <div><dt>{lang === 'ar' ? 'التفاصيل' : 'Details'}</dt><dd>{timelineDetail(lang, e)}</dd></div>}
      </dl></Collapse>
    </motion.li>; })}</motion.ol>
  </div>;
}

// ---------- منحنى الحرارة التفاعلي ----------
/** نطاق زمني قابل للاختيار، مؤشر بالفأرة أو الأسهم مع تلميح، خطوط الحد الأدنى والأعلى، الفجوات مظللة صراحةً (ليست التزاماً) */
export function TempChart({ report, height = 240 }: { report: any; height?: number }) {
  const { lang } = useApp(); const f = useFmt();
  const all = (report?.readings ?? []).filter((r: any) => r.c != null);
  const [range, setRange] = useState<'all' | '24h' | '6h' | '1h'>('all'); const [idx, setIdx] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  if (!all.length) return <Empty text={lang === 'ar' ? 'لا قراءات لهذه الشحنة بعد' : 'No readings for this shipment yet'} />;
  const lastT = Date.parse(all[all.length - 1].t); const span = { all: Infinity, '24h': 24, '6h': 6, '1h': 1 }[range] * 3600_000;
  const pts = all.filter((p: any) => lastT - Date.parse(p.t) <= span);
  const gaps = report.gaps.filter((g: any) => lastT - Date.parse(g.to) <= span || range === 'all');
  const W = 760, H = height, pl = 46, pr = 18, pt = 16, pb = 30;
  const t0 = Date.parse(pts[0].t), t1 = Math.max(Date.parse(pts[pts.length - 1].t), ...gaps.map((g: any) => Date.parse(g.to)));
  const lo = Math.min(report.profile.minC - 2, ...pts.map((p: any) => p.c)), hi = Math.max(report.profile.maxC + 2, ...pts.map((p: any) => p.c));
  const X = (t: number) => pl + ((t - t0) / Math.max(1, t1 - t0)) * (W - pl - pr);
  const Y = (c: number) => pt + (1 - (c - lo) / (hi - lo)) * (H - pt - pb);
  const segs: string[] = []; let cur = '';
  pts.forEach((p: any, i: number) => { const gap = i > 0 && Date.parse(p.t) - Date.parse(pts[i - 1].t) > 15 * 60_000; if (gap && cur) { segs.push(cur); cur = ''; } cur += `${cur ? 'L' : 'M'}${X(Date.parse(p.t)).toFixed(1)},${Y(p.c).toFixed(1)}`; });
  if (cur) segs.push(cur);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const xt = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
  const hm = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
  const sel = idx != null ? pts[Math.min(idx, pts.length - 1)] : null;
  const out = (c: number) => c > report.profile.maxC || c < report.profile.minC;
  const onMove = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; let best = 0, bd = Infinity; pts.forEach((p: any, i: number) => { const d = Math.abs(X(Date.parse(p.t)) - x); if (d < bd) { bd = d; best = i; } }); setIdx(best); };
  const onKey = (e: React.KeyboardEvent) => { const rtl = document.documentElement.dir === 'rtl'; const fwd = rtl ? 'ArrowLeft' : 'ArrowRight', bwd = rtl ? 'ArrowRight' : 'ArrowLeft'; if (e.key === fwd) { e.preventDefault(); setIdx(Math.min(pts.length - 1, (idx ?? -1) + 1)); } if (e.key === bwd) { e.preventDefault(); setIdx(Math.max(0, (idx ?? pts.length) - 1)); } if (e.key === 'Home') setIdx(0); if (e.key === 'End') setIdx(pts.length - 1); if (e.key === 'Escape') setIdx(null); };
  return (
    <figure className="chart tchart">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="group" aria-label={lang === 'ar' ? 'النطاق الزمني' : 'Time range'}>{(['1h', '6h', '24h', 'all'] as const).map((r) => <button key={r} className={range === r ? 'on' : ''} aria-pressed={range === r} onClick={() => { setRange(r); setIdx(null); }}>{r === 'all' ? (lang === 'ar' ? 'الكل' : 'All') : lang === 'ar' ? r.replace('h', ' س') : r}</button>)}</div>
        <span className="muted" aria-live="polite">{sel ? <><b dir="ltr" style={{ color: out(sel.c) ? 'var(--crit)' : 'var(--fg)' }}>{f.temp(sel.c)}</b> · {f.dt(sel.t)}{sel.backfilled && <> · {lang === 'ar' ? 'قراءة مخزنة' : 'backfilled'}</>}{out(sel.c) && <> · <b style={{ color: 'var(--crit)' }}>{lang === 'ar' ? 'خارج النطاق' : 'Out of range'}</b></>}</> : (lang === 'ar' ? 'مرّر المؤشر أو استخدم الأسهم لقراءة كل نقطة' : 'Hover or use arrow keys to read each point')}</span>
      </div>
      <div className="chartscroll"><svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} aria-label={lang === 'ar' ? `منحنى الحرارة: ${pts.length} قراءة، النطاق المسموح ${f.num(report.profile.minC, 1)} إلى ${f.num(report.profile.maxC, 1)} درجة` : `Temperature chart: ${pts.length} readings, allowed range ${f.num(report.profile.minC, 1)} to ${f.num(report.profile.maxC, 1)} °C`} onPointerMove={onMove} onPointerLeave={() => setIdx(null)} onKeyDown={onKey}>
        <defs><linearGradient id="tline" x1="0" x2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset="1" stopColor="var(--navy)" /></linearGradient><linearGradient id="tarea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--primary)" stopOpacity=".22" /><stop offset="1" stopColor="var(--primary)" stopOpacity="0" /></linearGradient><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="1" opacity="0.4" /></pattern></defs>
        {!report.profile.observedOnly && <rect x={pl} y={Y(report.profile.maxC)} width={W - pl - pr} height={Y(report.profile.minC) - Y(report.profile.maxC)} fill="var(--success-soft)" />}
        {ticks.map((v, i) => <g key={i}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x={pl - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v.toFixed(0)}°</text></g>)}
        {(report.profile.observedOnly ? [] : [report.profile.maxC, report.profile.minC]).map((v: number, i: number) => <g key={'th' + i}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="var(--success)" strokeDasharray="6 4" strokeWidth="1.4" /><text x={W - pr - 4} y={Y(v) - 4} textAnchor="end" fontSize="11" fill="var(--success)">{i === 0 ? (lang === 'ar' ? 'الحد الأعلى' : 'Max') : (lang === 'ar' ? 'الحد الأدنى' : 'Min')} {f.num(v, 1)}°</text></g>)}
        {xt.map((v, i) => <text key={i} x={X(v)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{hm.format(new Date(v))}</text>)}
        {gaps.map((g: any, i: number) => <rect key={i} x={X(Math.max(t0, Date.parse(g.from)))} y={pt} width={Math.max(2, X(Date.parse(g.to)) - X(Math.max(t0, Date.parse(g.from))))} height={H - pt - pb} fill="url(#hatch)"><title>{(lang === 'ar' ? 'فجوة بيانات ' : 'Data gap ') + g.minutes + (lang === 'ar' ? ' دقيقة — ' : ' min — ') + (g.reason?.[lang] ?? '')}</title></rect>)}
        {report.excursions.map((e: any, i: number) => <rect key={'e' + i} x={X(Math.max(t0, Date.parse(e.startedAt)))} y={pt} width={Math.max(3, X(Date.parse(e.endedAt ?? new Date(t1).toISOString())) - X(Math.max(t0, Date.parse(e.startedAt))))} height={H - pt - pb} fill="var(--critical)" opacity="0.14" />)}
        {segs.map((d, i) => { const xs = d.match(/[ML]([\d.]+),/g)!.map((m) => m.slice(1, -1)); return <path key={'a' + i} className="area" d={`${d}L${xs[xs.length - 1]},${H - pb}L${xs[0]},${H - pb}Z`} fill="url(#tarea)" />; })}
        {segs.map((d, i) => <path key={range + i} className="line" d={d} fill="none" stroke="url(#tline)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />)}
        {pts.filter((p: any) => out(p.c)).map((p: any, i: number) => <circle key={i} cx={X(Date.parse(p.t))} cy={Y(p.c)} r="3.2" fill="var(--critical)" />)}
        {sel && <g pointerEvents="none"><line x1={X(Date.parse(sel.t))} x2={X(Date.parse(sel.t))} y1={pt} y2={H - pb} stroke="var(--fg)" strokeOpacity=".35" /><circle cx={X(Date.parse(sel.t))} cy={Y(sel.c)} r="5.5" fill={out(sel.c) ? 'var(--critical)' : 'var(--primary)'} stroke="var(--surface)" strokeWidth="2" /></g>}
      </svg></div>
      <figcaption className="legend">
        {report.profile.observedOnly ? <span className="muted">{lang === 'ar' ? 'لا يوجد ملف حراري مرتبط بالجهاز الآن — لا تُعرض حدود مسموحة' : 'No thermal profile linked to this device now — no allowed limits shown'}</span> : <span><i className="sw band" />{lang === 'ar' ? `النطاق ${f.num(report.profile.minC, 1)} إلى ${f.num(report.profile.maxC, 1)} °م (غير معتمد بعد)` : `Range ${f.num(report.profile.minC, 1)} to ${f.num(report.profile.maxC, 1)} °C (not yet approved)`}</span>}
        <span><i className="sw gap" />{lang === 'ar' ? 'فجوة بيانات — لا تعني الالتزام' : 'Data gap — does not imply compliance'}</span>
        <span><i className="sw exc" />{lang === 'ar' ? 'انحراف' : 'Excursion'}</span>
        <span className="muted">{lang === 'ar' ? 'آخر قراءة' : 'Last reading'}: {f.temp(all[all.length - 1].c)} · {f.dt(all[all.length - 1].t)}</span>
      </figcaption>
    </figure>
  );
}

// ---------- خريطة المملكة (متجهية داخلية، بلا مزود خرائط) ----------
const KSA = 'M200,40 L262,30 L330,62 L392,58 L440,96 L470,150 L520,170 L560,210 L600,236 L640,300 L612,330 L560,350 L510,420 L470,470 L410,500 L350,530 L300,560 L262,590 L226,560 L200,500 L170,440 L140,380 L118,330 L92,290 L60,250 L50,200 L90,150 L130,110 L170,70 Z';
export const project = (lat: number, lng: number) => ({ x: 40 + ((lng - 34.5) / (56 - 34.5)) * 600, y: 30 + ((32.2 - lat) / (32.2 - 16)) * 560 });
type MapPt = { id: string; lat: number; lng: number; kind: string; label: string; alert?: boolean; meta?: { trackingNo?: string; status?: string; at?: string; origin?: string; dest?: string; source?: string; thermalClass?: string } };
const FRESH: Record<string, { ar: string; en: string }> = { live: { ar: 'مباشر: آخر قراءة خلال 15 دقيقة', en: 'Live: last reading within 15 min' }, delayed: { ar: 'متأخر: آخر قراءة قبل 15–60 دقيقة', en: 'Delayed: last reading 15–60 min ago' }, stale: { ar: 'بيانات قديمة أو جهاز غير متصل: لا قراءة منذ أكثر من ساعة', en: 'Stale/offline: no reading for over an hour' }, inferred: { ar: 'مستنتج من أحداث الناقل (رحلة جوية بلا GPS)', en: 'Inferred from carrier events (air leg, no GPS)' }, planned: { ar: 'مخطط: موقع الاستلام، لا يوجد موقع مؤكد بعد', en: 'Planned: pickup address, no confirmed fix yet' }, pickup: { ar: 'عنوان استلام مسند (ليس موقعاً لحظياً)', en: 'Assigned pickup address (not a live position)' }, delivery: { ar: 'عنوان تسليم مسند (ليس موقعاً لحظياً)', en: 'Assigned delivery address (not a live position)' } };
/** خريطة: العلامة تُظهر آخر موقع مؤكد ووقته ومصدره — لا تحريك لموقع محاكى. الضغط يفتح بطاقة التفاصيل ومسار المدينتين */
export function KsaMap({ points, cities, onPick, height = 380 }: { points: MapPt[]; cities: { code: string; name: { ar: string; en: string }; lat: number; lng: number }[]; onPick?(id: string): void; height?: number }) {
  const { lang } = useApp(); const f = useFmt();
  const [selId, setSel] = useState<string | null>(null); const sel = points.find((p) => p.id === selId) ?? null;
  const city = (c?: string) => cities.find((x) => x.code === c);
  const o = city(sel?.meta?.origin), d = city(sel?.meta?.dest);
  const po = o && project(o.lat, o.lng), pd = d && project(d.lat, d.lng);
  return (
    <figure className="map" style={{ maxHeight: height + 120 }}>
      <div className="mapwrap">
        <svg viewBox="0 0 680 620" role="group" aria-label={lang === 'ar' ? 'خريطة الشحنات — اختر علامة لعرض تفاصيلها' : 'Shipment map — select a marker for details'} style={{ maxHeight: height }}>
          {Array.from({ length: 9 }, (_, i) => <line key={'h' + i} className="gridl" x1="0" x2="680" y1={i * 75 + 10} y2={i * 75 + 10} />)}
          <path className="land" d={KSA} />
          {cities.map((c) => { const p = project(c.lat, c.lng); return <g key={c.code} className="city"><circle cx={p.x} cy={p.y} r="3" /><text x={p.x + 8} y={p.y - 7}>{c.name[lang]}</text></g>; })}
          {po && pd && <motion.path key={selId} d={`M${po.x},${po.y} Q${(po.x + pd.x) / 2},${Math.min(po.y, pd.y) - 50} ${pd.x},${pd.y}`} className="routeline" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: DUR.slow, ease: EASE.decelerate }} />}
          {points.map((pt) => { const p = project(pt.lat, pt.lng); const on = pt.id === selId; return <g key={pt.id} className={cx('mk', pt.kind, on && 'on')} onClick={() => setSel(on ? null : pt.id)} tabIndex={0} role="button" aria-pressed={on} aria-label={pt.label} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(on ? null : pt.id); } }}>
            {pt.alert && <circle className="alertring" cx={p.x} cy={p.y} r="12" />}
            {pt.kind === 'live' && <circle className="halo" cx={p.x} cy={p.y} r="6" />}
            <circle className="hit" cx={p.x} cy={p.y} r={14} /><circle className="core" cx={p.x} cy={p.y} r={on ? 9 : 6} /><title>{pt.label}</title></g>; })}
        </svg>
        <AnimatePresence>{sel && <motion.div className="mapcard" role="region" aria-live="polite" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: DUR.base }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b className="mono">{sel.meta?.trackingNo ?? sel.label}</b><button className="x" onClick={() => setSel(null)} aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}>×</button></div>
          {sel.meta?.status && <span><Pill v={sel.meta.status} /> {sel.alert && <Pill tone="crit">{lang === 'ar' ? 'تنبيه مفتوح' : 'Open alert'}</Pill>}</span>}
          <dl className="tldetail">
            <div><dt>{lang === 'ar' ? 'نوع الموقع' : 'Location type'}</dt><dd><i className={'sw mk ' + sel.kind} />{FRESH[sel.kind]?.[lang] ?? sel.kind}</dd></div>
            <div><dt>{sel.kind === 'planned' || sel.kind === 'pickup' ? (lang === 'ar' ? 'بداية فترة الاستلام' : 'Pickup window start') : sel.kind === 'delivery' ? (lang === 'ar' ? 'التسليم قبل' : 'Deliver by') : (lang === 'ar' ? 'وقت آخر موقع مؤكد' : 'Last confirmed fix')}</dt><dd>{f.dt(sel.meta?.at)}</dd></div>
            {sel.meta?.source && <div><dt>{lang === 'ar' ? 'مصدر الموقع' : 'Position source'}</dt><dd>{label(lang, sel.meta.source)}</dd></div>}
            {o && d && <div><dt>{lang === 'ar' ? 'المسار' : 'Route'}</dt><dd>{o.name[lang]} {lang === 'ar' ? '←' : '→'} {d.name[lang]}</dd></div>}
          </dl>
          <span className="sim">{lang === 'ar' ? 'المواقع بيانات عرض محاكاة' : 'Positions are simulated demo data'}</span>
          {onPick && <Btn kind="primary" onClick={() => onPick(sel.id)}>{lang === 'ar' ? 'فتح الشحنة' : 'Open shipment'}</Btn>}
        </motion.div>}</AnimatePresence>
      </div>
      <figcaption className="legend">{['live', 'delayed', 'stale', 'inferred', 'planned'].map((k) => <Tip key={k} text={FRESH[k][lang]}><span className={'mk ' + k}><i className={'sw mk ' + k} />{label(lang, k)}</span></Tip>)}<span className="muted">{lang === 'ar' ? 'الخط بين المدينتين يوضح المسار المخطط وليس مساراً فعلياً لحظياً' : 'The line between cities shows the planned route, not a live track'}</span></figcaption>
    </figure>
  );
}
// ---------- مخطط أعمدة بسيط ----------
export function Bars({ data, height = 180, valueLabel }: { data: { label: string; a: number; b?: number }[]; height?: number; valueLabel?: [string, string?] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b ?? 0]));
  const W = 760, H = height, pb = 26, pt = 10, bw = (W - 20) / data.length;
  return <figure className="chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={data.map((d) => `${d.label}: ${d.a}${d.b != null ? ` / ${d.b}` : ''}`).join('، ')}>
    <defs><linearGradient id="bga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B9A87" /><stop offset="1" stopColor="#087F70" /></linearGradient><linearGradient id="bgb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2C994" /><stop offset="1" stopColor="#E6A65D" /></linearGradient></defs>
    {[0, 0.5, 1].map((r) => <line key={r} x1={10} x2={W - 10} y1={pt + (H - pt - pb) * (1 - r)} y2={pt + (H - pt - pb) * (1 - r)} stroke="var(--line)" />)}
    {data.map((d, i) => { const h1 = ((H - pt - pb) * d.a) / max, h2 = ((H - pt - pb) * (d.b ?? 0)) / max; const x = 10 + i * bw; return <g key={i}>
      <rect className="bar" style={{ animationDelay: `${i * 40}ms` }} x={x + bw * 0.15} y={H - pb - h1} width={bw * (d.b != null ? 0.33 : 0.7)} height={h1} fill="url(#bga)" rx="5"><title>{`${d.label}: ${d.a}`}</title></rect>
      {d.b != null && <rect className="bar" style={{ animationDelay: `${i * 40 + 80}ms` }} x={x + bw * 0.52} y={H - pb - h2} width={bw * 0.33} height={h2} fill="url(#bgb)" rx="5"><title>{`${d.label}: ${d.b}`}</title></rect>}
      {(data.length <= 16 || i % 2 === 0) && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>}
    </g>; })}
    <text x={12} y={pt + 10} fontSize="11" fill="var(--muted)">{max}</text>
  </svg>{valueLabel && <figcaption className="legend"><span><i className="sw" style={{ background: 'linear-gradient(#0B9A87,#087F70)' }} />{valueLabel[0]}</span>{valueLabel[1] && <span><i className="sw" style={{ background: 'linear-gradient(#F2C994,#E6A65D)' }} />{valueLabel[1]}</span>}</figcaption>}</figure>;
}
