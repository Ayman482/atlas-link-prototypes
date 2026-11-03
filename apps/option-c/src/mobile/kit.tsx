'use client';
// عناصر مشتركة لمعاينات الجوال — الخيار B بتدرجات وحركة في المتصفح (للمراجعة التصميمية فقط — تطبيقات Flutter الحقيقية في مجلد mobile/)
import React, { useEffect, useRef, useState } from 'react';
import { DEMO_MFA, DEMO_PASSWORD } from '@medlog/core';
import { IS_DEMO } from '@medlog/client';
import { useApp, transport, useRoute } from '@/lib/store';
import { Btn, cx } from '@/lib/ui';
import type { DemoAcct } from '@/lib/login';
import { ThemeBtn } from '@/lib/theme';
import { SuccessMark, motion } from '@/lib/motion';

/** احتفال قصير بعد إتمام تسليم أو طلب (يُتجاهل مع تقليل الحركة) */
export function celebrate() {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('div'); c.className = 'confetti'; const cols = ['#087F70', '#0B9A87', '#D9EEE8', '#E6A65D', '#C98A3E', '#F2C994'];
  for (let i = 0; i < 70; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = cols[i % cols.length]; p.style.animationDelay = Math.random() * .5 + 's'; p.style.animationDuration = 1.2 + Math.random() * 1.2 + 's'; c.appendChild(p); }
  document.body.appendChild(c); setTimeout(() => c.remove(), 3000);
}

export function PhoneStage({ title, screens, children, flutterPath }: { title: string; screens: { id: string; ar: string; en: string }[]; children: React.ReactNode; flutterPath: string }) {
  const { lang, setLang } = useApp(); const { path } = useRoute();
  return (
    <div className="phone-stage">
      <div className="phone" role="application" aria-label={title}>{children}</div>
      <aside className="phone-side">
        <span className="sim">{lang === 'ar' ? 'معاينة متصفح للمراجعة' : 'Browser preview for review'}</span>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="muted">{lang === 'ar' ? 'معاينة متصفح للمراجعة التصميمية، تعمل على نفس المحرك وبيانات العرض (ليست بيانات حقيقية). تطبيق Flutter الفعلي (Android/iOS) موجود في ' : 'Browser preview for design review, running on the same engine and demo data (not real data). The real Flutter app (Android/iOS) is in '}<code dir="ltr">{flutterPath}</code>{lang === 'ar' ? ' ويعمل مع خادم المحاكاة.' : ' and runs against the mock API server.'}</p>
        <div className="row"><Btn onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'English' : 'العربية'}</Btn><ThemeBtn /></div>
        <div className="card" style={{ padding: 14 }}>
          <b>{lang === 'ar' ? 'الشاشات' : 'Screens'}</b>
          <ol className="scrlist">{screens.map((s) => <li key={s.id}><span className="mono muted">{s.id}</span> {lang === 'ar' ? s.ar : s.en}</li>)}</ol>
        </div>
        <p className="muted mono" style={{ fontSize: '.8rem' }}>#{path}</p>
      </aside>
    </div>
  );
}

export function MobileLogin({ accounts, allowed, title }: { accounts: DemoAcct[]; allowed(r: string[]): boolean; title: string }) {
  const { lang, setLang, t, signIn } = useApp();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [ch, setCh] = useState<string | null>(null); const [code, setCode] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const finish = async (uid: string) => { const me: any = await transport().query('me'); if (!allowed(me.roles)) { await transport().logout(); setCh(null); setErr(lang === 'ar' ? 'هذا الحساب لا يملك صلاحية على هذا التطبيق' : 'This account has no access to this app'); return; } signIn(uid); };
  const login = async (e?: string, p?: string) => {
    setErr(null); const em = e ?? email, pp = p ?? pw;
    if (!/^\S+@\S+\.\S+$/.test(em)) { setErr(lang === 'ar' ? 'بريد غير صالح' : 'Invalid email'); return; }
    if (!pp) { setErr(lang === 'ar' ? 'كلمة المرور مطلوبة' : 'Password required'); return; }
    setBusy(true);
    try { const r = await transport().login(em, pp); if (r.mfaRequired) setCh(r.challengeId!); else await finish(r.token!); } catch (x: any) { setErr(x.message?.[lang] ?? String(x)); } finally { setBusy(false); }
  };
  const verify = async () => { setErr(null); if (!/^\d{6}$/.test(code)) { setErr(lang === 'ar' ? 'أدخل 6 أرقام' : 'Enter 6 digits'); return; } setBusy(true); try { const r = await transport().verifyMfa(ch!, code); await finish(r.token!); } catch (x: any) { setErr(x.message?.[lang] ?? String(x)); } finally { setBusy(false); } };
  return (
    <div className="mbodyx" style={{ justifyContent: 'center' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>{IS_DEMO ? <span className="sim">{t('app.demoBadge')}</span> : <span />}<Btn kind="ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('common.switchLang')}</Btn></div>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {err && <div className="state err" role="alert">{err}</div>}
      {!ch ? <>
        <label className="field"><span>{t('auth.email')}</span><input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>{t('auth.password')}</span><input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <Btn kind="primary" className="bigbtn" disabled={busy} onClick={() => login()}>{t('auth.signIn')}</Btn>
        <b style={{ marginTop: 8 }}>{t('auth.demoAccounts')}</b>
        {IS_DEMO && accounts.map((a) => <button key={a.email} className="mcard" style={{ textAlign: 'start', cursor: 'pointer' }} onClick={() => { setEmail(a.email); setPw(DEMO_PASSWORD); login(a.email, DEMO_PASSWORD); }}><b>{a.name[lang]}</b><span className="muted">{t('roles.' + a.role)} · <span className="mono">{a.email}</span></span></button>)}
      </> : <>
        <p>{t('auth.mfaHint')}{IS_DEMO && <> — {lang === 'ar' ? 'رمز العرض' : 'Demo code'} <span className="mono">{DEMO_MFA}</span></>}</p>
        <input inputMode="numeric" dir="ltr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="MFA" style={{ fontSize: '1.4rem', letterSpacing: '.4em', textAlign: 'center' }} />
        <Btn kind="primary" className="bigbtn" disabled={busy} onClick={verify}>{t('auth.verify')}</Btn>
        <Btn kind="ghost" onClick={() => { setCh(null); setCode(''); }}>{t('common.back')}</Btn>
      </>}
    </div>
  );
}

export function MTop({ title, back, right }: { title: React.ReactNode; back?: string; right?: React.ReactNode }) {
  const { lang } = useApp();
  return <header className="mtop">{back && <a className="btn ghost" href={'#' + back} aria-label={lang === 'ar' ? 'رجوع' : 'Back'}>{lang === 'ar' ? '→' : '←'}</a>}<b style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</b>{right}</header>;
}

export function MTabs({ items }: { items: { path: string; ar: string; en: string; icon: string; badge?: number }[] }) {
  const { lang } = useApp(); const { path } = useRoute();
  return <nav className="mtabs" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>{items.map((i) => <a key={i.path} href={'#' + i.path} className={(i.path === '/' ? path === '/' : path.startsWith(i.path)) ? 'on' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={i.icon} /></svg><span>{lang === 'ar' ? i.ar : i.en}{!!i.badge && <span className="badge" style={{ marginInlineStart: 4 }}>{i.badge}</span>}</span></a>)}</nav>;
}
export const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', plus: 'M12 5v14M5 12h14', bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', map: 'M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14', scan: 'M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4M7 12h10', sync: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  invoice: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6',
};

/** لوحة توقيع حقيقية (لمس/فأرة) — تُخزّن كصورة PNG مصغّرة كدليل */
export function SigPad({ onChange }: { onChange(v: string | null): void }) {
  const ref = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const [has, setHas] = useState(false); const { lang } = useApp();
  useEffect(() => { const c = ref.current!; c.width = c.clientWidth; c.height = c.clientHeight; const g = c.getContext('2d')!; g.lineWidth = 2.2; g.lineCap = 'round'; g.strokeStyle = getComputedStyle(c).color || '#123'; }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e: React.PointerEvent) => { drawing.current = true; const g = ref.current!.getContext('2d')!; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); ref.current!.setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const g = ref.current!.getContext('2d')!; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); if (!has) setHas(true); };
  const up = () => { if (!drawing.current) return; drawing.current = false; if (has) { const c = ref.current!; const s = document.createElement('canvas'); s.width = 200; s.height = Math.round((200 * c.height) / c.width); s.getContext('2d')!.drawImage(c, 0, 0, s.width, s.height); onChange(s.toDataURL('image/png')); } };
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHas(false); onChange(null); };
  return <div className="page" style={{ gap: 4 }}><canvas ref={ref} className="sigpad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label={lang === 'ar' ? 'لوحة التوقيع' : 'Signature pad'} /><div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">{has ? (lang === 'ar' ? 'تم التوقيع' : 'Signed') : (lang === 'ar' ? 'وقّع داخل الإطار' : 'Sign inside the box')}</span><Btn kind="ghost" onClick={clear}>{lang === 'ar' ? 'مسح' : 'Clear'}</Btn></div></div>;
}

/** ماسح QR محاكى: الكاميرا غير متاحة في المعاينة، فيختار المستخدم رمزاً متوقعاً أو يدخله يدوياً */
/** مسح QR محاكى بحالات واضحة: جاهز ← جارٍ المسح ← نجاح (علامة تُرسم) أو فشل (سبب + إعادة المحاولة). الكاميرا غير متاحة في المعاينة */
export function ScanSim({ label, suggestions, onScan }: { label: string; suggestions: { value: string; hint: string }[]; onScan(v: string): Promise<string | null | void> | string | null | void }) {
  const { lang } = useApp(); const [v, setV] = useState(''); const [st, setSt] = useState<{ k: 'idle' | 'busy' | 'ok' | 'bad'; msg?: string; code?: string }>({ k: 'idle' });
  const go = async (code: string) => {
    setSt({ k: 'busy', code });
    await new Promise((r) => setTimeout(r, 450));
    try { const e = await onScan(code); setSt(e ? { k: 'bad', msg: e, code } : { k: 'ok', code }); } catch (x: any) { setSt({ k: 'bad', msg: x?.message?.[lang] ?? String(x), code }); }
  };
  return <div className="mcard">
    <b>{label}</b>
    <div className={cx('scanbox', st.k === 'busy' && 'on')} aria-hidden="true"><span /></div>
    <div aria-live="assertive">
      {st.k === 'busy' && <div className="scanstate busy"><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />{lang === 'ar' ? 'جارٍ قراءة الرمز…' : 'Reading code…'}</div>}
      {st.k === 'ok' && <motion.div className="scanstate ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.22 }}><SuccessMark />{lang === 'ar' ? 'تم التحقق من الرمز' : 'Code verified'} <span className="mono">{st.code}</span></motion.div>}
      {st.k === 'bad' && <motion.div className="scanstate bad" role="alert" initial={{ x: 0 }} animate={{ x: [0, -6, 6, -3, 0] }} transition={{ duration: 0.3 }}><b>!</b><span style={{ flex: 1 }}>{st.msg}</span><Btn onClick={() => setSt({ k: 'idle' })}>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Btn></motion.div>}
    </div>
    <span className="sim">{lang === 'ar' ? 'الكاميرا محاكاة — اختر رمزاً أو أدخله يدوياً' : 'Camera simulated — pick a code or type it'}</span>
    {suggestions.map((s) => <Btn key={s.value} disabled={st.k === 'busy'} onClick={() => go(s.value)}><span className="mono">{s.value}</span> <span className="muted">{s.hint}</span></Btn>)}
    <div className="row"><input dir="ltr" value={v} onChange={(e) => setV(e.target.value)} aria-label={lang === 'ar' ? 'إدخال الرمز يدوياً' : 'Enter code manually'} placeholder={lang === 'ar' ? 'إدخال يدوي' : 'Manual entry'} style={{ flex: 1, minWidth: 0 }} /><Btn kind="primary" disabled={!v.trim() || st.k === 'busy'} onClick={() => { go(v.trim()); setV(''); }}>{lang === 'ar' ? 'تأكيد' : 'Confirm'}</Btn></div>
  </div>;
}
