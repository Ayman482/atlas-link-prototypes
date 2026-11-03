'use client';
// شاشة الدخول + التحقق بخطوتين (A01 / C01) مع قائمة حسابات العرض حسب التطبيق
import React, { useState } from 'react';
import { DEMO_MFA, DEMO_PASSWORD } from '@medlog/core';
import { useApp, transport } from './store';
import { IS_DEMO } from '@medlog/client';
import { Btn, FormFields, validate } from './ui';

export interface DemoAcct { email: string; name: { ar: string; en: string }; role: string }
export function Login({ title, subtitle, accounts, allowed }: { title: string; subtitle: string; accounts: DemoAcct[]; allowed(roles: string[]): boolean }) {
  const { lang, setLang, t, signIn } = useApp();
  const [v, setV] = useState<Record<string, any>>({ email: '', password: '' });
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fields = [{ name: 'email', label: t('auth.email'), type: 'email' as const, required: true, dir: 'ltr' as const, full: true }, { name: 'password', label: t('auth.password'), type: 'text' as const, required: true, dir: 'ltr' as const, full: true }];
  const finish = async (uid: string) => {
    const me: any = await transport().query('me');
    if (!allowed(me.roles)) { await transport().logout(); setChallenge(null); setErr(lang === 'ar' ? 'هذا الحساب لا يملك صلاحية على هذا التطبيق. اختر حساباً من القائمة المناسبة.' : 'This account has no access to this app. Pick an account from the matching list.'); return; }
    signIn(uid);
  };
  const submit = async (e?: React.FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault(); setErr(null);
    const vals = override ?? v; const errs = validate(fields, vals, lang); setFe(errs); if (Object.keys(errs).length) return;
    setBusy(true);
    try { const r = await transport().login(vals.email, vals.password); if (r.mfaRequired) setChallenge(r.challengeId!); else await finish(r.token!); }
    catch (x: any) { setErr(x.message?.[lang] ?? String(x)); } finally { setBusy(false); }
  };
  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault(); setErr(null);
    if (!/^\d{6}$/.test(code)) { setErr(lang === 'ar' ? 'أدخل 6 أرقام' : 'Enter 6 digits'); return; }
    setBusy(true);
    try { const r = await transport().verifyMfa(challenge!, code); await finish(r.token!); } catch (x: any) { setErr(x.message?.[lang] ?? String(x)); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <div className="l">
        <div className="row" style={{ justifyContent: 'space-between' }}>{IS_DEMO ? <span className="sim">{t('app.demoBadge')}</span> : <span />}<Btn kind="ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('common.switchLang')}</Btn></div>
        <div><h1>{title}</h1><p className="muted">{subtitle}</p></div>
        <div className="glass">
        {!challenge ? (
          <form onSubmit={submit} noValidate className="page">
            {err && <div className="state err" role="alert">{err}</div>}
            <FormFields fields={fields} values={v} set={(n, x) => setV({ ...v, [n]: x })} errors={fe} />
            <Btn kind="primary" onClick={() => submit()} disabled={busy}>{t('auth.signIn')}</Btn>
            {IS_DEMO && <p className="muted">{t('auth.demoNote')}</p>}
          </form>
        ) : (
          <form onSubmit={verify} noValidate className="page">
            <h2>{t('auth.mfaTitle')}</h2><p className="muted">{t('auth.mfaHint')}{IS_DEMO && <> — {lang === 'ar' ? 'رمز العرض' : 'Demo code'} <span className="mono">{DEMO_MFA}</span></>}</p>
            {err && <div className="state err" role="alert">{err}</div>}
            <input id="mfa" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label={t('auth.mfaHint')} style={{ fontSize: '1.4rem', letterSpacing: '.4em', textAlign: 'center' }} />
            <div className="row"><Btn kind="primary" onClick={() => verify()} disabled={busy}>{t('auth.verify')}</Btn><Btn kind="ghost" onClick={() => { setChallenge(null); setCode(''); }}>{t('common.back')}</Btn></div>
          </form>
        )}
        </div>
      </div>
      <div className="r">
        <Hero />
        {IS_DEMO && accounts.length > 0 && <>
        <h2>{t('auth.demoAccounts')}</h2>
        <p>{lang === 'ar' ? 'اختر حساباً لتعبئة البيانات، ثم أكمل الدخول والتحقق بخطوتين.' : 'Pick an account to fill the form, then complete sign-in and verification.'}</p>
        <div className="accts">{accounts.map((a, i) => <button key={a.email} className="acct" style={{ '--i': i, '--ah': AH[i % AH.length] } as React.CSSProperties} onClick={() => { setV({ email: a.email, password: DEMO_PASSWORD }); submit(undefined, { email: a.email, password: DEMO_PASSWORD }); }}><span className="avatar">{a.name[lang].replace(/^(د\.|م\.|أ\.|Dr\.|Eng\.)\s*/, '').split(' ').filter((w) => /\p{L}/u.test(w[0] ?? '')).map((w) => w[0]).slice(0, 2).join('')}</span><b>{a.name[lang]}</b><span>{t('roles.' + a.role)}</span><code>{a.email}</code></button>)}</div>
        </>}
      </div>
    </div>
  );
}

const AH = ['linear-gradient(135deg,#087F70,#0B9A87)', 'linear-gradient(135deg,#E6A65D,#F2C994)', 'linear-gradient(135deg,#173B4D,#3D6B80)', 'linear-gradient(135deg,#C98A3E,#E6A65D)', 'linear-gradient(135deg,#1F5F99,#5E8FC0)', 'linear-gradient(135deg,#1C7A43,#4FA874)'];
/** لوحة هادئة: نبض قلب يُرسم ببطء، صندوق تبريد يتنفّس، دوائر ناعمة تطفو */
function Hero() {
  const { lang } = useApp();
  return <div className="hero">
    <svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[[480, 40, 90], [90, 210, 70], [300, -20, 60]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity=".08"><animate attributeName="r" values={`${r};${r + 14};${r}`} dur={`${7 + i * 2}s`} repeatCount="indefinite" /></circle>)}
      <polyline points="0,120 150,120 180,120 200,80 225,165 250,95 270,120 600,120" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity=".9" strokeDasharray="900" strokeDashoffset="900"><animate attributeName="stroke-dashoffset" values="900;0;0" keyTimes="0;.6;1" dur="5s" repeatCount="indefinite" /></polyline>
      <g transform="translate(430 70)"><rect width="110" height="78" rx="14" fill="#fff" opacity=".95"><animate attributeName="opacity" values=".95;.8;.95" dur="4s" repeatCount="indefinite" /></rect><rect y="18" width="110" height="3" fill="#087F70" opacity=".25" /><rect x="40" y="34" width="30" height="26" rx="6" fill="#087F70" opacity=".12" /><path d="M55 38v14" stroke="#087F70" strokeWidth="3" strokeLinecap="round" /><circle cx="55" cy="54" r="5" fill="#E6A65D" /><text x="55" y="-8" textAnchor="middle" fontSize="13" fill="#fff" fontFamily="IBM Plex Mono">4.6°C</text></g>
    </svg>
    <div><b>{lang === 'ar' ? 'عناية بكل عينة كما لو كانت الوحيدة' : 'Care for every sample as if it were the only one'}</b><p style={{ opacity: .9 }}>{lang === 'ar' ? 'سلسلة تبريد موثّقة · حيازة لا تنقطع · شفافية للمختبر والعميل' : 'Documented cold chain · unbroken custody · transparency for lab and customer'}</p></div>
  </div>;
}
