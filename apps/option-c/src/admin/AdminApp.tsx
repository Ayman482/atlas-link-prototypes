'use client';
import { IS_DEMO } from '@medlog/client';
import { greeting, comma, label } from '@/lib/l10n';
// لوحة الإدارة — الخيار C: قائمة جانبية عائمة بأقسام قابلة للطي، تحية بحسب الوقت، بحث، تبديل المظهر
import React, { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp, useQ, useRoute, go, transport } from '@/lib/store';
import { Btn, Modal, Pill, cx, useFmt } from '@/lib/ui';
import { Drawer, motion } from '@/lib/motion';
import { Login } from '@/lib/login';
import { ThemeBtn } from '@/lib/theme';
import { ADMIN_ACCOUNTS } from '@/lib/accounts';
import { ROUTES, NAV, match } from './routes';

export default function AdminRoot() { return <AppProvider app="admin"><Gate /></AppProvider>; }

const NON_STAFF = ['corp_admin', 'branch_manager', 'branch_operator', 'branch_viewer', 'corp_finance', 'individual', 'receiving_lab', 'courier'];
function Gate() {
  const { userId, me, t, x, signOut } = useApp();
  useEffect(() => { if (me && !me.roles.some((r: string) => !NON_STAFF.includes(r))) signOut(); }, [me, signOut]);
  if (!userId) return <Login title={t('app.admin')} subtitle={t('app.name')} accounts={ADMIN_ACCOUNTS} allowed={(r) => r.some((x) => !NON_STAFF.includes(x))} />;
  if (!me || !me.roles.some((r: string) => !NON_STAFF.includes(r))) return null; // لا يُعرض الهيكل لدور غير مخوّل ولو لعملية عرض واحدة
  void x;
  return <Shell />;
}

const GROUP_STYLE: Record<string, { hue: string; icon: string }> = {
  ops: { hue: 'var(--c-indigo)', icon: 'M3 12h4l3-8 4 16 3-8h4' },
  assets: { hue: 'var(--c-cyan)', icon: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10' },
  quality: { hue: 'var(--c-pink)', icon: 'M12 2v10M12 22a4 4 0 0 0 4-4c0-2-2-3-2-5V4a2 2 0 0 0-4 0v9c0 2-2 3-2 5a4 4 0 0 0 4 4z' },
  warehouse: { hue: 'var(--c-amber)', icon: 'M3 21V9l9-6 9 6v12M7 21v-8h10v8M7 17h10' },
  commercial: { hue: 'var(--c-green)', icon: 'M20 12V7H4v5M4 12v7h16v-7M4 12h16M9 7V4h6v3' },
  finance: { hue: 'var(--c-violet)', icon: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  compliance: { hue: 'var(--c-orange)', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
  reports: { hue: 'var(--c-blue)', icon: 'M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6' },
  system: { hue: 'var(--muted)', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
  partner: { hue: 'var(--c-indigo)', icon: 'M2 17h20M6 17l2-10h8l2 10M9 7V4h6v3' },
};
const Ico = ({ d, size = 22 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
function Greeting() {
  const { lang, x, me } = useApp();
  const g = greeting(lang); // «مساء الخير» بعد الظهر — من المصدر المعتمد للتوطين
  const d = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' }).format(new Date());
  return <div className="greet"><b>{g}{comma(lang)}{x(me.user.name).split(' ').slice(0, 2).join(' ')}</b><span>{d}</span></div>;
}

function Shell() {
  const { t, x, lang, setLang, me, signOut, run } = useApp();
  const { path } = useRoute();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<null | 'ntf' | 'user'>(null);
  const [cmdk, setCmdk] = useState(false);
  const roles: string[] = me.roles;
  const can = (r?: string[]) => !r || roles.includes('super_admin') || r.some((x) => roles.includes(x));
  const approvals = useQ<any>('approvals.inbox', {});
  const ntf = useQ<any>('list', { collection: 'notifications', pageSize: 40, sort: 'createdAt', dir: 'desc' });
  const mine = (ntf.data?.items ?? []).filter((n: any) => n.audience === 'staff' && (!n.userId || n.userId === me.user.id));
  const unread = mine.filter((n: any) => !n.readAt).length;
  const pend = approvals.data?.pending?.length ?? 0;
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdk(true); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  useEffect(() => { setOpen(false); setMenu(null); }, [path]);
  const m = match(path);
  const route = m && can(m.route.roles) ? m : null;
  const Screen = route?.route.screen;
  const partnerOnly = roles.length === 1 && roles[0] === 'partner';
  useEffect(() => { if (partnerOnly && path === '/') go('/partner'); }, [partnerOnly, path]);
  const groups = NAV.filter((g) => g.items.some((i) => can(i.roles)) && (partnerOnly ? g.id === 'partner' : g.id !== 'partner'));
  const isOn = (p: string) => (p === '/' ? path === '/' : path === p || path.startsWith(p + '/'));
  const activeG = groups.find((g) => g.items.some((i) => isOn(i.path)))?.id ?? groups[0]?.id;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExp = (id: string) => expanded[id] ?? id === activeG;
  const st = (id: string) => GROUP_STYLE[id] ?? GROUP_STYLE.system;
  const initials = x(me.user.name).replace(/^(د\.|م\.|أ\.|Dr\.|Eng\.)\s*/, '').split(' ').filter((w: string) => /\p{L}/u.test(w[0] ?? '')).map((w: string) => w[0]).slice(0, 2).join('');
  return (
    <div className="capp">
      {open && <div className="scrim navscrim" onClick={() => setOpen(false)} />}
      <aside className={cx('sidecard', open && 'open')} aria-label="navigation">
        <a href="#/" className="brandb" style={{ color: 'inherit', textDecoration: 'none' }}><span className="logo"><svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27s-10-6.2-10-13.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 10 3.5C26 20.8 16 27 16 27z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /><path d="M10 17h4l2-3 2 5 1.5-2H22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><b>{t('app.short')}</b><span>{t('app.admin')}</span></div></a>
        {groups.map((g) => <div key={g.id} className={cx('sgroup', isExp(g.id) && 'open')} style={{ '--hue': st(g.id).hue } as React.CSSProperties}>
          <button onClick={() => setExpanded({ ...expanded, [g.id]: !isExp(g.id) })} aria-expanded={isExp(g.id)}><span className="gtile"><Ico d={st(g.id).icon} /></span>{x(g.label)}{g.id === 'system' && pend > 0 && <span className="badge">{pend}</span>}<svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
          <div className="slinks"><div>{g.items.filter((i) => can(i.roles)).map((i) => <a key={i.path} href={'#' + i.path} tabIndex={isExp(g.id) ? 0 : -1} className={isOn(i.path) ? 'on' : ''}><span>{x(i.label)}</span>{i.path === '/approvals' && pend > 0 ? <span className="badge">{pend}</span> : <span className="sid">{i.id}</span>}</a>)}</div></div>
        </div>)}
      </aside>
      <div className="mainwrap">
        <header className="topbar">
          <Btn kind="ghost" className="hamb iconbtn" onClick={() => setOpen(!open)} aria-label="menu"><Ico size={18} d="M4 6h16M4 12h16M4 18h16" /></Btn>
          <Greeting />
          <span className="grow" />
          <button className="search" onClick={() => setCmdk(true)} aria-keyshortcuts="Control+K"><Ico size={16} d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" /><span>{lang === 'ar' ? 'بحث…' : 'Search…'}</span><span className="grow" /><kbd>Ctrl K</kbd></button>
          {IS_DEMO && <span className="sim" title="demo">{t('app.demoBadge')}</span>}
          <Btn kind="ghost" className="langbtn" lang={lang === 'ar' ? 'en' : 'ar'} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('common.switchLang')}</Btn>
          <ThemeBtn />
          <div style={{ position: 'relative' }}>
            <Btn kind="ghost" className="iconbtn" aria-label={unread > 0 ? `${t('common.notifications')} ${unread}` : t('common.notifications')} onClick={() => setMenu(menu === 'ntf' ? null : 'ntf')}><Ico size={18} d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />{unread > 0 && <span className="badge">{unread}</span>}</Btn>
            <NotificationCenter open={menu === 'ntf'} onClose={() => setMenu(null)} items={mine} />
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn ghost" onClick={() => setMenu(menu === 'user' ? null : 'user')} aria-haspopup="menu" style={{ padding: 4 }}><span className="avatar">{initials}</span><span className="who"><b>{x(me.user.name)}</b><span>{roles.map((r) => t('roles.' + r)).join(comma(lang))}</span></span></button>
            {menu === 'user' && <div className="menu" role="menu" style={{ width: 240 }}>
              <a className="mi" href="#/profile">{t('common.profile')}</a>
              <a className="mi" href="#/system/security">{t('nav.security')}</a>
              <button className="mi btn ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0 }} onClick={signOut}>{t('common.signOut')}</button>
            </div>}
          </div>
        </header>
        {!partnerOnly && <CriticalBar />}
        <main className="content" id="main" key={path}>
          {Screen ? <Screen params={route!.params} /> : m ? <Forbidden /> : <NotFound />}
        </main>
      </div>
      {cmdk && <CommandK onClose={() => setCmdk(false)} can={can} />}
    </div>
  );
}

/** شريط التنبيهات الحرجة: يظهر فوراً دون أي تأخير دخول (لا يُخفى خلف حركة) ويبقى حتى الإقرار */
function CriticalBar() {
  const { x, lang, run } = useApp(); const q = useQ<any>('controlTower.summary', {});
  const crit = (q.data?.alerts ?? []).filter((a: any) => a.kind === 'excursion' && a.status === 'open' && ['critical', 'high'].includes(a.severity));
  if (!crit.length) return null;
  const a = crit[0];
  return <div className="alertbar" role="alert">
    <span className="dot" aria-hidden="true" />
    <b>{lang === 'ar' ? `انحرافات حرارية مفتوحة تتطلب الإقرار: ${crit.length}` : `${crit.length} open temperature excursion(s) need acknowledgement`}</b>
    <span>{x(a.title)}</span><span className="grow" />
    <Btn kind="danger" onClick={() => run('excursion.acknowledge', { id: a.id }, { success: lang === 'ar' ? 'تم الإقرار — أُحيل إلى مراجعة الجودة' : 'Acknowledged — moved to quality review' })}>{lang === 'ar' ? 'إقرار الآن' : 'Acknowledge now'}</Btn>
    <a href={'#' + a.link}>{lang === 'ar' ? 'عرض الشحنة' : 'View shipment'}</a>
    {crit.length > 1 && <a href="#/excursions">{lang === 'ar' ? 'كل الانحرافات' : 'All excursions'}</a>}
  </div>;
}

/** مركز الإشعارات: درج جانبي بتبويبات (الكل/غير المقروء/الحرج) + تنبيهات تشغيلية قابلة للإقرار والتصعيد */
function NotificationCenter({ open, onClose, items }: { open: boolean; onClose(): void; items: any[] }) {
  const { x, lang, t, run } = useApp(); const f = useFmt(); const [tab, setTab] = useState<'all' | 'unread' | 'critical' | 'ops'>('all');
  const q = useQ<any>(open ? 'controlTower.summary' : null, {});
  const list = tab === 'unread' ? items.filter((n) => !n.readAt) : tab === 'critical' ? items.filter((n) => n.critical) : items;
  const alerts = (q.data?.alerts ?? []).filter((a: any) => (a.kind === 'excursion' && a.status === 'open') || a.kind === 'delay').slice(0, 20);
  const tabs: [typeof tab, string, number][] = [['all', lang === 'ar' ? 'الكل' : 'All', items.length], ['unread', lang === 'ar' ? 'غير المقروءة' : 'Unread', items.filter((n) => !n.readAt).length], ['critical', lang === 'ar' ? 'الحرجة' : 'Critical', items.filter((n) => n.critical).length], ['ops', lang === 'ar' ? 'تتطلب إجراء' : 'Need action', alerts.length]];
  return <Drawer open={open} onClose={onClose} title={t('common.notifications')}>
    <div className="tabs ntf-tabs" role="tablist">{tabs.map(([k, l, c]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<span className="count">{c}</span></button>)}</div>
    {tab !== 'ops' && <div className="row" style={{ justifyContent: 'flex-end' }}><Btn kind="ghost" disabled={!items.some((n) => !n.readAt)} onClick={() => run('notification.markAllRead', { ids: items.map((n) => n.id) }, { success: lang === 'ar' ? 'عُلّمت كلها كمقروءة' : 'All marked as read' })}>{t('common.markAllRead')}</Btn></div>}
    {tab !== 'ops' && (list.length === 0 ? <p className="muted">{t('common.empty')}</p> : list.slice(0, 40).map((n: any, i: number) => <motion.div key={n.id} className={cx('ntf', !n.readAt && 'unread', n.critical && 'crit')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i, 6) * 0.03 }}>
      <span className="ic" aria-hidden="true">{n.critical ? '!' : '•'}</span>
      <b>{x(n.title)} {n.critical && <Pill tone="crit">{lang === 'ar' ? 'حرج' : 'Critical'}</Pill>}</b>
      <span className="muted" style={{ fontSize: '.86rem' }}>{x(n.body)} · {f.dt(n.createdAt)}</span>
      <span className="acts">{n.link && <a className="btn ghost" href={'#' + n.link} onClick={() => { run('notification.markRead', { id: n.id }, { silent: true }); onClose(); }}>{lang === 'ar' ? 'فتح' : 'Open'}</a>}{!n.readAt && <Btn kind="ghost" onClick={() => run('notification.markRead', { id: n.id }, { silent: true })}>{lang === 'ar' ? 'تعليم كمقروء' : 'Mark read'}</Btn>}</span>
    </motion.div>))}
    {tab === 'ops' && (!q.data ? <p className="muted">{t('common.loading')}</p> : alerts.length === 0 ? <p className="muted">{lang === 'ar' ? 'لا تنبيهات تتطلب إجراء' : 'No alerts need action'}</p> : alerts.map((a: any) => <div key={a.id} className={cx('ntf', ['critical', 'high'].includes(a.severity) && 'crit')}>
      <span className="ic" aria-hidden="true">{a.kind === 'excursion' ? '°' : '⏱'}</span>
      <b>{x(a.title)} <Pill v={a.severity} /></b>
      <span className="muted" style={{ fontSize: '.86rem' }}>{f.dt(a.at)}</span>
      <span className="acts">
        {a.kind === 'excursion' && <Btn kind="primary" onClick={() => run('excursion.acknowledge', { id: a.id }, { success: lang === 'ar' ? 'تم الإقرار' : 'Acknowledged' })}>{lang === 'ar' ? 'إقرار' : 'Acknowledge'}</Btn>}
        {a.kind === 'delay' && <Btn onClick={() => run('delay.action', { id: a.id, action: 'escalate' }, { success: lang === 'ar' ? 'تم التصعيد' : 'Escalated' })}>{lang === 'ar' ? 'تصعيد' : 'Escalate'}</Btn>}
        <a className="btn ghost" href={'#' + a.link} onClick={onClose}>{lang === 'ar' ? 'عرض' : 'View'}</a>
      </span>
    </div>))}
  </Drawer>;
}

function Forbidden() { const { lang } = useApp(); return <div className="state err">{lang === 'ar' ? 'ليست لديك صلاحية على هذه الشاشة. القائمة الجانبية تعرض الشاشات المتاحة لدورك.' : 'You do not have access to this screen. The side menu shows the screens available to your role.'}</div>; }
function NotFound() { const { lang } = useApp(); return <div className="state empty"><p>{lang === 'ar' ? 'الصفحة غير موجودة' : 'Page not found'}</p><a className="btn" href="#/">{lang === 'ar' ? 'العودة إلى مركز مراقبة العمليات' : 'Back to control tower'}</a></div>; }

function CommandK({ onClose, can }: { onClose(): void; can(r?: string[]): boolean }) {
  const { x, lang } = useApp();
  const [q, setQ] = useState('');
  const res = useQ<any>(q.trim().length >= 2 ? 'search' : null, { q });
  const screens = useMemo(() => NAV.flatMap((g) => g.items.filter((i) => can(i.roles))).filter((i) => !q || (i.label.ar + i.label.en).toLowerCase().includes(q.toLowerCase())).slice(0, 8), [q, can]);
  const pick = (p: string) => { go(p); onClose(); };
  return (
    <Modal title={lang === 'ar' ? 'بحث وانتقال سريع' : 'Search & jump'} onClose={onClose} wide>
      <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'ar' ? 'رقم تتبع (ML-2026-…)، رمز صندوق (BX-…)، IMEI، عميل، أو اسم شاشة' : 'Tracking no. (ML-2026-…), box (BX-…), IMEI, customer or screen name'} style={{ width: '100%', fontSize: '1rem' }} />
      <div className="alerts">
        {(res.data?.shipments ?? []).map((s: any) => <li key={s.id}><span className="pill info">{lang === 'ar' ? 'شحنة' : 'Shipment'}</span><a href={'#/shipments/' + s.id} onClick={onClose} className="mono">{s.trackingNo}</a><span className="muted">{label(lang, s.status)}</span></li>)}
        {(res.data?.boxes ?? []).map((b: any) => <li key={b.id}><span className="pill mute">{lang === 'ar' ? 'صندوق' : 'Box'}</span><a href={'#/boxes/' + b.id} onClick={onClose} className="mono">{b.code}</a><span /></li>)}
        {(res.data?.devices ?? []).map((d: any) => <li key={d.id}><span className="pill mute">IMEI</span><a href={'#/devices/' + d.id} onClick={onClose} className="mono">{d.imei}</a><span /></li>)}
        {(res.data?.organizations ?? []).map((o: any) => <li key={o.id}><span className="pill mute">{lang === 'ar' ? 'عميل' : 'Customer'}</span><a href={'#/customers/' + o.id} onClick={onClose}>{x(o.legalName)}</a><span /></li>)}
        {screens.map((i) => <li key={i.path}><span className="pill good">{lang === 'ar' ? 'شاشة' : 'Screen'}</span><a href={'#' + i.path} onClick={(e) => { e.preventDefault(); pick(i.path); }}>{x(i.label)}</a><span className="mono muted">{i.id}</span></li>)}
      </div>
    </Modal>
  );
}
void transport; void ROUTES;
