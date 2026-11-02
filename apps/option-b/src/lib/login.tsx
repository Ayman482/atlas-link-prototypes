'use client';
// شاشة الدخول + التحقق الثنائي (A01 / C01) مع قائمة حسابات العرض حسب التطبيق
import React, { useState } from 'react';
import { DEMO_MFA, DEMO_PASSWORD } from '@medlog/core';
import { useApp, transport } from './store';
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
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="sim">{t('app.demoBadge')}</span><Btn kind="ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t('common.switchLang')}</Btn></div>
        <div><h1>{title}</h1><p className="muted">{subtitle}</p></div>
        <div className="glass">
        {!challenge ? (
          <form onSubmit={submit} noValidate className="page">
            {err && <div className="state err" role="alert">{err}</div>}
            <FormFields fields={fields} values={v} set={(n, x) => setV({ ...v, [n]: x })} errors={fe} />
            <Btn kind="primary" onClick={() => submit()} disabled={busy}>{t('auth.signIn')}</Btn>
            <p className="muted">{t('auth.demoNote')}</p>
          </form>
        ) : (
          <form onSubmit={verify} noValidate className="page">
            <h2>{t('auth.mfaTitle')}</h2><p className="muted">{t('auth.mfaHint')} — {lang === 'ar' ? 'رمز العرض' : 'Demo code'} <span className="mono">{DEMO_MFA}</span></p>
            {err && <div className="state err" role="alert">{err}</div>}
            <input id="mfa" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label={t('auth.mfaHint')} style={{ fontSize: '1.4rem', letterSpacing: '.4em', textAlign: 'center' }} />
            <div className="row"><Btn kind="primary" onClick={() => verify()} disabled={busy}>{t('auth.verify')}</Btn><Btn kind="ghost" onClick={() => { setChallenge(null); setCode(''); }}>{t('common.back')}</Btn></div>
          </form>
        )}
        </div>
      </div>
      <div className="r">
        <Hero />
        <h2>{t('auth.demoAccounts')}</h2>
        <p>{lang === 'ar' ? 'اختر حساباً لتعبئة البيانات، ثم أكمل الدخول والتحقق الثنائي.' : 'Pick an account to fill the form, then complete sign-in and verification.'}</p>
        <div className="accts">{accounts.map((a, i) => <button key={a.email} className="acct" style={{ '--i': i, '--ah': AH[i % AH.length] } as React.CSSProperties} onClick={() => { setV({ email: a.email, password: DEMO_PASSWORD }); submit(undefined, { email: a.email, password: DEMO_PASSWORD }); }}><span className="avatar">{a.name[lang].replace(/^(د\.|م\.|أ\.|Dr\.|Eng\.)\s*/, '').split(' ').filter((w) => /\p{L}/u.test(w[0] ?? '')).map((w) => w[0]).slice(0, 2).join('')}</span><b>{a.name[lang]}</b><span>{t('roles.' + a.role)}</span><code>{a.email}</code></button>)}</div>
      </div>
    </div>
  );
}

const AH = ['linear-gradient(135deg,#6366f1,#a855f7)', 'linear-gradient(135deg,#06b6d4,#3b82f6)', 'linear-gradient(135deg,#ec4899,#f97316)', 'linear-gradient(135deg,#10b981,#06b6d4)', 'linear-gradient(135deg,#f59e0b,#ef4444)', 'linear-gradient(135deg,#8b5cf6,#ec4899)'];
/** لوحة متحركة: مسار سلسلة التبريد بين المدن مع شاحنة وطائرة ومنحنى حرارة نابض */
function Hero() {
  const { lang } = useApp();
  return <div className="hero">
    <svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="hl" x1="0" x2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#f0abfc" /></linearGradient></defs>
      {Array.from({ length: 24 }, (_, i) => <circle key={i} cx={(i * 97) % 600} cy={(i * 53) % 240} r={(i % 3) + 1} fill="#fff" opacity=".25"><animate attributeName="opacity" values=".1;.6;.1" dur={`${2 + (i % 5)}s`} repeatCount="indefinite" /></circle>)}
      <path id="route" d="M40,170 C150,60 260,200 340,110 S520,60 570,120" fill="none" stroke="url(#hl)" strokeWidth="3" strokeDasharray="8 8"><animate attributeName="stroke-dashoffset" from="0" to="-32" dur="1s" repeatCount="indefinite" /></path>
      {[[40, 170, 'RUH'], [340, 110, 'JED'], [570, 120, 'DMM']].map(([x, y, n]) => <g key={n as string}><circle cx={x as number} cy={y as number} r="7" fill="#fff" /><circle cx={x as number} cy={y as number} r="7" fill="none" stroke="#fff"><animate attributeName="r" values="7;20" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values=".8;0" dur="2s" repeatCount="indefinite" /></circle></g>)}
      <g><rect x="-14" y="-9" width="28" height="18" rx="4" fill="#fff" /><rect x="-10" y="-5" width="10" height="10" rx="2" fill="#6d28d9" /><animateMotion dur="7s" repeatCount="indefinite" rotate="auto"><mpath href="#route" /></animateMotion></g>
      <path d="M380,40 l26,8 l18,-14 l6,4 l-12,18 l14,10 l-4,4 l-18,-6 l-20,12 l-4,-4 l12,-14 z" fill="#fff" opacity=".9"><animateTransform attributeName="transform" type="translate" values="-60,20; 120,-10; -60,20" dur="12s" repeatCount="indefinite" /></path>
      <polyline points="40,215 90,212 140,214 190,208 240,213 290,210 340,214 390,209 440,212 490,206 540,211" fill="none" stroke="#a7f3d0" strokeWidth="2" opacity=".85" strokeDasharray="600" strokeDashoffset="600"><animate attributeName="stroke-dashoffset" from="600" to="0" dur="3s" fill="freeze" /></polyline>
    </svg>
    <div><b>{lang === 'ar' ? 'سلسلة تبريد مرئية من الاستلام حتى المختبر' : 'Visible cold chain from pickup to lab'}</b><p style={{ opacity: .85 }}>{lang === 'ar' ? 'حيازة موثقة · حرارة لحظية · نقل بري وجوي' : 'Documented custody · live temperature · road & air'}</p></div>
  </div>;
}
