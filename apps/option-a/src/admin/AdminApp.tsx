'use client';
// لوحة الإدارة — الخيار A: شريط جانبي مقسّم بالمجالات، بحث أوامر (Ctrl/⌘+K)، إشعارات، وصندوق اعتمادات
import React, { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp, useQ, useRoute, go, transport } from '@/lib/store';
import { Btn, Modal, cx } from '@/lib/ui';
import { Login } from '@/lib/login';
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

function Shell() {
  const { t, x, lang, setLang, me, signOut, run } = useApp();
  const { path } = useRoute();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<null | 'ntf' | 'user'>(null);
  const [cmdk, setCmdk] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
  return (
    <div className="app">
      <aside className={cx('side', open && 'open')} aria-label="navigation">
        <div className="brand"><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M3 12h26" stroke="currentColor" strokeWidth="2" /><path d="M16 15.5v7M12.5 19h7" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" /></svg><div><b>{t('app.short')}</b><span>{t('app.admin')}</span></div></div>
        {NAV.filter((g) => g.items.some((i) => can(i.roles)) && (partnerOnly ? g.id === 'partner' : g.id !== 'partner')).map((g) => (
          <div key={g.id} className="navgroup">
            <button onClick={() => setCollapsed({ ...collapsed, [g.id]: !collapsed[g.id] })} aria-expanded={!collapsed[g.id]}>{x(g.label)}<span aria-hidden="true">{collapsed[g.id] ? '+' : '−'}</span></button>
            {!collapsed[g.id] && g.items.filter((i) => can(i.roles)).map((i) => <a key={i.path} href={'#' + i.path} className={path === i.path || (i.path !== '/' && path.startsWith(i.path + '/')) ? 'on' : ''}>{x(i.label)}{i.path === '/approvals' && pend > 0 && <span className="badge">{pend}</span>}</a>)}
          </div>
        ))}
      </aside>
      <div className="mainwrap">
        <header className="topbar">
          <Btn kind="ghost" className="hamb" onClick={() => setOpen(!open)} aria-label="menu">☰</Btn>
          <button className="search" onClick={() => setCmdk(true)} aria-label={t('common.search')}><span>{lang === 'ar' ? 'ابحث عن شحنة، صندوق، جهاز، عميل…' : 'Search shipment, box, device, customer…'}</span><span className="grow" /><kbd>Ctrl K</kbd></button>
          <span className="sim" title="demo">{t('app.demoBadge')}</span>
          <Btn kind="ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('common.switchLang')}</Btn>
          <div style={{ position: 'relative' }}>
            <Btn kind="ghost" className="iconbtn" aria-label={t('common.notifications')} onClick={() => setMenu(menu === 'ntf' ? null : 'ntf')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>{unread > 0 && <span className="badge">{unread}</span>}</Btn>
            {menu === 'ntf' && <div className="menu" role="menu">
              <div className="row" style={{ padding: '10px 14px', justifyContent: 'space-between' }}><b>{t('common.notifications')}</b><Btn kind="ghost" onClick={() => run('notification.markAllRead', { ids: mine.map((n: any) => n.id) }, { silent: true })}>{t('common.markAllRead')}</Btn></div>
              {mine.length === 0 && <p className="muted" style={{ padding: 14 }}>{t('common.empty')}</p>}
              {mine.slice(0, 15).map((n: any) => <a key={n.id} className={cx('mi', !n.readAt && 'unread')} href={n.link ? '#' + n.link : '#/'} onClick={() => run('notification.markRead', { id: n.id }, { silent: true })}><b>{x(n.title)}</b>{n.critical && <span className="pill crit" style={{ marginInlineStart: 6 }}>{lang === 'ar' ? 'حرج' : 'Critical'}</span>}<div className="muted" style={{ fontSize: '.84rem' }}>{x(n.body)}</div></a>)}
            </div>}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn ghost" onClick={() => setMenu(menu === 'user' ? null : 'user')} aria-haspopup="menu"><span className="who"><b>{x(me.user.name)}</b><span>{roles.map((r) => t('roles.' + r)).join('، ')}</span></span>▾</button>
            {menu === 'user' && <div className="menu" role="menu" style={{ width: 240 }}>
              <a className="mi" href="#/profile">{t('common.profile')}</a>
              <a className="mi" href="#/system/security">{t('nav.security')}</a>
              <button className="mi btn ghost" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0 }} onClick={signOut}>{t('common.signOut')}</button>
            </div>}
          </div>
        </header>
        <main className="content" id="main">
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
