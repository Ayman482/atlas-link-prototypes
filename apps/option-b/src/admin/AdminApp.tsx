'use client';
// لوحة الإدارة — الخيار B: شريط مجالات ملوّن بأيقونات + لوحة المجال، شريط تنبيهات متحرك، ساعة حية، تبديل المظهر، بحث أوامر
import React, { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp, useQ, useRoute, go, transport } from '@/lib/store';
import { Btn, Modal, cx } from '@/lib/ui';
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
  if (!me) return null;
  void x;
  return <Shell />;
}

const GROUP_STYLE: Record<string, { hue: string; icon: string }> = {
  ops: { hue: '#6366f1', icon: 'M3 12h4l3-8 4 16 3-8h4' },
  assets: { hue: '#06b6d4', icon: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10' },
  quality: { hue: '#ec4899', icon: 'M12 2v10M12 22a4 4 0 0 0 4-4c0-2-2-3-2-5V4a2 2 0 0 0-4 0v9c0 2-2 3-2 5a4 4 0 0 0 4 4z' },
  warehouse: { hue: '#f59e0b', icon: 'M3 21V9l9-6 9 6v12M7 21v-8h10v8M7 17h10' },
  commercial: { hue: '#10b981', icon: 'M20 12V7H4v5M4 12v7h16v-7M4 12h16M9 7V4h6v3' },
  finance: { hue: '#8b5cf6', icon: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  compliance: { hue: '#f97316', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
  reports: { hue: '#3b82f6', icon: 'M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6' },
  system: { hue: '#64748b', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
  partner: { hue: '#14b8a6', icon: 'M2 17h20M6 17l2-10h8l2 10M9 7V4h6v3' },
};
const Ico = ({ d, size = 22 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
function Clock() {
  const { lang } = useApp(); const [n, setN] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(h); }, []);
  return <span className="livechip" aria-live="off"><i />{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Riyadh' }).format(n)} · {lang === 'ar' ? 'الرياض' : 'Riyadh'}</span>;
}
function Ticker() {
  const { x, lang } = useApp(); const q = useQ<any>('controlTower.summary', {});
  if (!q.data?.alerts?.length) return null;
  const sev = (s: string) => (s === 'critical' || s === 'high' ? 't-crit' : s === 'medium' ? 't-warn' : 't-good');
  return <div className="ticker" aria-label={lang === 'ar' ? 'شريط التنبيهات' : 'Alerts ticker'}><div>{q.data.alerts.slice(0, 14).map((a: any) => <a key={a.id} href={'#' + a.link} className={sev(a.severity)} style={{ textDecoration: 'none' }}>● <b>{x(a.title)}</b></a>)}</div></div>;
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
  const activeG = groups.find((g) => g.items.some((i) => (i.path === '/' ? path === '/' : path === i.path || path.startsWith(i.path + '/')))) ?? groups[0];
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSel(null), [path]);
  const shown = groups.find((g) => g.id === sel) ?? activeG;
  const st = (id: string) => GROUP_STYLE[id] ?? GROUP_STYLE.system;
  const initials = x(me.user.name).replace(/^(د\.|م\.|أ\.|Dr\.|Eng\.)\s*/, '').split(' ').filter((w: string) => /\p{L}/u.test(w[0] ?? '')).map((w: string) => w[0]).slice(0, 2).join('');
  return (
    <div className="app">
      <nav className={cx('rail', open && 'open')} aria-label={lang === 'ar' ? 'المجالات' : 'Domains'}>
        <a href="#/" className="logo" aria-label={t('app.short')}><svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="19" rx="4" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M3 12h26" stroke="currentColor" strokeWidth="2.4" /><path d="M16 15.5v7M12.5 19h7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg></a>
        {groups.map((g) => <button key={g.id} className={shown?.id === g.id ? 'on' : ''} style={{ '--hue': st(g.id).hue } as React.CSSProperties} onClick={() => { setSel(g.id); setOpen(true); }} aria-label={x(g.label)} aria-pressed={shown?.id === g.id}>
          <Ico d={st(g.id).icon} />{g.id === 'system' && pend > 0 && <span className="dotb" />}<span className="tip">{x(g.label)}</span></button>)}
      </nav>
      <aside className={cx('panel', open && 'open')} style={{ '--hue': st(shown?.id ?? 'ops').hue } as React.CSSProperties} aria-label="navigation">
        {shown && <><h3>{x(shown.label)}</h3>
          {shown.items.filter((i) => can(i.roles)).map((i, k) => <a key={i.path} style={{ '--i': k } as React.CSSProperties} href={'#' + i.path} className={path === i.path || (i.path !== '/' && path.startsWith(i.path + '/')) ? 'on' : ''}><span>{x(i.label)}</span>{i.path === '/approvals' && pend > 0 ? <span className="badge">{pend}</span> : <span className="sid">{i.id}</span>}</a>)}</>}
      </aside>
      <div className="mainwrap">
        <header className="topbar">
          <Btn kind="ghost" className="hamb iconbtn" onClick={() => setOpen(!open)} aria-label="menu"><Ico size={18} d="M4 6h16M4 12h16M4 18h16" /></Btn>
          <button className="search" onClick={() => setCmdk(true)} aria-label={t('common.search')}><Ico size={16} d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" /><span>{lang === 'ar' ? 'ابحث عن شحنة، صندوق، جهاز، عميل…' : 'Search shipment, box, device, customer…'}</span><span className="grow" /><kbd>Ctrl K</kbd></button>
          <span className="grow" />
          <Clock />
          <span className="sim" title="demo">{t('app.demoBadge')}</span>
          <Btn kind="ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('common.switchLang')}</Btn>
          <ThemeBtn />
          <div style={{ position: 'relative' }}>
            <Btn kind="ghost" className="iconbtn" aria-label={t('common.notifications')} onClick={() => setMenu(menu === 'ntf' ? null : 'ntf')}><Ico size={18} d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />{unread > 0 && <span className="badge">{unread}</span>}</Btn>
            {menu === 'ntf' && <div className="menu" role="menu">
              <div className="row" style={{ padding: '10px 14px', justifyContent: 'space-between' }}><b>{t('common.notifications')}</b><Btn kind="ghost" onClick={() => run('notification.markAllRead', { ids: mine.map((n: any) => n.id) }, { silent: true })}>{t('common.markAllRead')}</Btn></div>
              {mine.length === 0 && <p className="muted" style={{ padding: 14 }}>{t('common.empty')}</p>}
              {mine.slice(0, 15).map((n: any) => <a key={n.id} className={cx('mi', !n.readAt && 'unread')} href={n.link ? '#' + n.link : '#/'} onClick={() => run('notification.markRead', { id: n.id }, { silent: true })}><b>{x(n.title)}</b>{n.critical && <span className="pill crit" style={{ marginInlineStart: 6 }}>{lang === 'ar' ? 'حرج' : 'Critical'}</span>}<div className="muted" style={{ fontSize: '.84rem' }}>{x(n.body)}</div></a>)}
            </div>}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn ghost" onClick={() => setMenu(menu === 'user' ? null : 'user')} aria-haspopup="menu" style={{ padding: '4px 10px 4px 4px' }}><span className="avatar">{initials}</span><span className="who"><b>{x(me.user.name)}</b><span>{roles.map((r) => t('roles.' + r)).join('، ')}</span></span></button>
            {menu === 'user' && <div className="menu" role="menu" style={{ width: 240 }}>
              <a className="mi" href="#/profile">{t('common.profile')}</a>
              <a className="mi" href="#/system/security">{t('nav.security')}</a>
              <button className="mi btn ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0 }} onClick={signOut}>{t('common.signOut')}</button>
            </div>}
          </div>
        </header>
        {!partnerOnly && <Ticker />}
        <main className="content" id="main" key={path}>
          {Screen ? <Screen params={route!.params} /> : m ? <Forbidden /> : <NotFound />}
        </main>
      </div>
      {cmdk && <CommandK onClose={() => setCmdk(false)} can={can} />}
    </div>
  );
}

function Forbidden() { const { lang } = useApp(); return <div className="state err">{lang === 'ar' ? 'ليست لديك صلاحية على هذه الشاشة. القائمة الجانبية تعرض الشاشات المتاحة لدورك.' : 'You do not have access to this screen. The side menu shows the screens available to your role.'}</div>; }
function NotFound() { const { lang } = useApp(); return <div className="state empty"><p>{lang === 'ar' ? 'الصفحة غير موجودة' : 'Page not found'}</p><a className="btn" href="#/">{lang === 'ar' ? 'العودة لبرج التحكم' : 'Back to control tower'}</a></div>; }

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
        {(res.data?.shipments ?? []).map((s: any) => <li key={s.id}><span className="pill info">{lang === 'ar' ? 'شحنة' : 'Shipment'}</span><a href={'#/shipments/' + s.id} onClick={onClose} className="mono">{s.trackingNo}</a><span className="muted">{s.status}</span></li>)}
        {(res.data?.boxes ?? []).map((b: any) => <li key={b.id}><span className="pill mute">{lang === 'ar' ? 'صندوق' : 'Box'}</span><a href={'#/boxes/' + b.id} onClick={onClose} className="mono">{b.code}</a><span /></li>)}
        {(res.data?.devices ?? []).map((d: any) => <li key={d.id}><span className="pill mute">IMEI</span><a href={'#/devices/' + d.id} onClick={onClose} className="mono">{d.imei}</a><span /></li>)}
        {(res.data?.organizations ?? []).map((o: any) => <li key={o.id}><span className="pill mute">{lang === 'ar' ? 'عميل' : 'Customer'}</span><a href={'#/customers/' + o.id} onClick={onClose}>{x(o.legalName)}</a><span /></li>)}
        {screens.map((i) => <li key={i.path}><span className="pill good">{lang === 'ar' ? 'شاشة' : 'Screen'}</span><a href={'#' + i.path} onClick={(e) => { e.preventDefault(); pick(i.path); }}>{x(i.label)}</a><span className="mono muted">{i.id}</span></li>)}
      </div>
    </Modal>
  );
}
void transport; void ROUTES;
