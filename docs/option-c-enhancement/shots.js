// لقطات الشاشات التمثيلية قبل/بعد — الاستخدام: BASE=http://localhost:5057 node shots.js <مجلد الإخراج>
const { chromium } = require('playwright');
const B = process.env.BASE || 'http://localhost:3003'; const out = process.argv[2] || '.';
const login = async (p, url, email) => { await p.goto(B + url); await p.waitForTimeout(900); await p.click(`text=${email}`); await p.waitForTimeout(500); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); } await p.waitForTimeout(1200); };
const shot = async (p, url, name, wait = 2200) => { await p.goto(B + url); await p.waitForTimeout(wait); await p.screenshot({ path: `${out}/${name}.png` }); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const p = await ctx.newPage(); await shot(p, '/admin/', '01-admin-login', 1500);
  await login(p, '/admin/', 'ops@medlog.demo');
  await shot(p, '/admin/#/', '02-admin-control-tower');
  await shot(p, '/admin/#/shipments/shp_0004', '03-admin-shipment-detail');
  await shot(p, '/admin/#/shipments', '04-admin-shipments-table');
  await shot(p, '/admin/#/routes', '05-admin-routes');
  await shot(p, '/admin/#/excursions', '06-admin-excursions');
  await shot(p, '/admin/#/map', '07-admin-map');
  await p.evaluate(() => { localStorage.setItem('al-lang', 'en'); }); await shot(p, '/admin/#/', '08-admin-control-tower-en');
  await p.evaluate(() => { localStorage.setItem('al-lang', 'ar'); });
  const q = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await login(q, '/portal/', 'corp.admin@medlog.demo'); await shot(q, '/portal/#/', '09-portal-home'); await shot(q, '/portal/#/shipments/shp_0002', '10-portal-tracking'); await shot(q, '/portal/#/shipments/new', '11-portal-new-shipment');
  const m = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  await login(m, '/mobile/customer/', 'corp.admin@medlog.demo'); await shot(m, '/mobile/customer/#/', '12-customer-mobile-home'); await shot(m, '/mobile/customer/#/s/shp_0002', '13-customer-mobile-tracking');
  const k = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  await login(k, '/mobile/courier/', 'courier1@medlog.demo'); await shot(k, '/mobile/courier/#/', '14-courier-tasks'); await shot(k, '/mobile/courier/#/t/shp_0012', '15-courier-task-scan');
  await b.close();
})();
