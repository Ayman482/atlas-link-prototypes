// فحص التنقل المباشر وRBAC في المتصفح (Phase 17). الاستخدام: BASE=http://127.0.0.1:5057 node rbac-nav.js > out.json
const { chromium } = require('playwright'); const B = process.env.BASE || 'http://127.0.0.1:5057';
const login = async (p, app, email) => { await p.goto(`${B}/${app}/`); await p.waitForTimeout(900); await p.click(`text=${email}`); await p.waitForTimeout(500); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); } await p.waitForTimeout(1300); };
(async () => { const b = await chromium.launch(); const R = {};
  const txt = async (p) => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  let p = await (await b.newContext()).newPage(); await login(p, 'portal', 'branch.op@medlog.demo');
  await p.goto(`${B}/admin/#/shipments`); await p.waitForTimeout(1500); let t = await txt(p);
  R.customerToAdmin = { showsAdminShell: !!(await p.$('.sidecard')), loginShown: !!(await p.$('.login')), snippet: t.slice(0, 160) };
  await p.goto(`${B}/mobile/courier/`); await p.waitForTimeout(1500); t = await txt(p);
  R.customerToCourier = { tasks: /مهام اليوم|المهام/.test(t) && !(await p.$('.mlogin, form')), snippet: t.slice(0, 160) };
  await p.goto(`${B}/portal/#/shipments/shp_0005`); await p.waitForTimeout(1500); R.customerOtherBranchShipment = (await txt(p)).slice(0, 200);
  p = await (await b.newContext()).newPage(); await login(p, 'admin', 'warehouse@medlog.demo');
  for (const r of ['/system/users', '/invoices', '/journals', '/system/security']) { await p.goto(`${B}/admin/#${r}`); await p.waitForTimeout(1200); R['warehouse' + r] = (await txt(p)).match(/(غير متاح[^.]{0,60}|ليست لديك[^.]{0,60})/)?.[0] ?? 'NO DENIAL: ' + (await txt(p)).slice(0, 200); }
  p = await (await b.newContext()).newPage(); await p.goto(`${B}/admin/#/shipments`); await p.waitForTimeout(1500); R.anonymousDeepLink = { loginShown: !!(await p.$('.login')), shipmentsTable: !!(await p.$('table')) };
  console.log(JSON.stringify(R, null, 1)); await b.close(); })();
