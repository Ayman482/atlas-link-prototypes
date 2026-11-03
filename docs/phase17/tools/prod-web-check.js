// فحص بناء الويب الإنتاجي (NEXT_PUBLIC_MEDLOG_MODE=production): لا حسابات عرض ولا كلمة مرور ولا شارة ولا قاعدة محلية. الاستخدام: PROD_BASE=http://127.0.0.1:5090 node prod-web-check.js > out.json
const { chromium } = require('playwright'); const PB = process.env.PROD_BASE || 'http://127.0.0.1:5090';
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const out = {};
  for (const app of ['admin', 'portal', 'mobile/courier', 'mobile/customer']) {
    await p.goto(`${PB}/${app}/`); await p.waitForTimeout(2500);
    const t = await p.textContent('body');
    out[app] = { demoAccounts: /medlog\.demo/.test(t), demoPwd: t.includes('Demo@2026'), demoBadge: t.includes('بيانات عرض'), localDb: await p.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('medlog-demo'))), hasLoginForm: !!(await p.$('input')) };
  }
  await p.goto(PB + '/'); await p.waitForTimeout(1000); out.landing = { demoPwd: (await p.textContent('body')).includes('Demo@2026') };
  console.log(JSON.stringify(out, null, 1), 'errors:', errs.slice(0, 3)); await b.close(); })();
