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
      <div className="r">
        <h2>{t('auth.demoAccounts')}</h2>
        <p>{lang === 'ar' ? 'اختر حساباً لتعبئة البيانات، ثم أكمل الدخول والتحقق الثنائي.' : 'Pick an account to fill the form, then complete sign-in and verification.'}</p>
        <div className="accts">{accounts.map((a) => <button key={a.email} className="acct" onClick={() => { setV({ email: a.email, password: DEMO_PASSWORD }); submit(undefined, { email: a.email, password: DEMO_PASSWORD }); }}><b>{a.name[lang]}</b><span>{t('roles.' + a.role)}</span><code>{a.email}</code></button>)}</div>
      </div>
    </div>
  );
}
