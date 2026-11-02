// تدقيق وظيفي وإمكانية وصول لكل شاشة في الخيار C (Playwright + axe-core 4.14، معايير WCAG 2.0/2.1/2.2 A وAA)
// الاستخدام: npm i -D playwright axe-core@4.14.0 ثم: BASE=http://localhost:3003 node audit.js <ملف JSON للنتائج>
const { chromium } = require('playwright');
const axePath = require.resolve('axe-core/axe.min.js');
const B = process.env.BASE || 'http://localhost:3003';
const ADMIN = ['/', '/map', '/shipments', '/shipments/new', '/shipments/shp_0004', '/dispatch', '/routes', '/legs', '/couriers', '/vehicles', '/partners', '/boxes', '/boxes/box_002', '/devices', '/devices/dev_004', '/gateway', '/device-commands', '/excursions', '/profiles', '/incidents', '/incidents/inc_0002', '/capa', '/claims', '/lost', '/returns', '/warehouse', '/warehouse/cleaning', '/warehouse/partner-custody', '/warehouse/consumables', '/customers', '/customers/org_nkh', '/contracts', '/rate-plans', '/simulations', '/quotes', '/invoices', '/invoices/inv_0001', '/credit-notes', '/payments', '/accounts', '/journals', '/aging', '/costs', '/settlements', '/compliance/requirements', '/compliance/licenses', '/compliance/blocks', '/compliance/retention', '/compliance/legal-holds', '/reports/operations', '/reports/finance', '/delays', '/approvals', '/system/notifications', '/system/integrations', '/system/settings', '/system/users', '/system/audit', '/system/security', '/system/health', '/profile'];
const PORTAL = ['/', '/shipments', '/shipments/new', '/shipments/shp_0002', '/recurring', '/addresses', '/branches', '/users', '/contracts', '/invoices', '/payments', '/claims', '/reports', '/api', '/notifications', '/profile'];
const CM = ['/', '/shipments', '/new', '/s/shp_0002', '/s/shp_0002/temp', '/notifications', '/invoices', '/claims', '/addresses', '/account'];
const K = ['/', '/map', '/t/shp_0009', '/t/shp_0002', '/boxes', '/sync', '/me'];
async function login(p, app, email) {
  await p.goto(`${B}/${app}/`); await p.waitForTimeout(900);
  await p.click(`text=${email}`); await p.waitForTimeout(500);
  const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); }
  await p.waitForTimeout(1200);
}
async function audit(p, url, lang) {
  const errs = []; const onErr = (e) => errs.push(String(e.message ?? e)); const onCon = (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push(m.text()); };
  p.on('pageerror', onErr); p.on('console', onCon);
  await p.goto(url); await p.waitForTimeout(1300);
  await p.addScriptTag({ path: axePath });
  const r = await p.evaluate(async () => { const x = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }); return x.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })); });
  const meta = await p.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, text: (document.querySelector('main') ?? document.body).innerText.length, focusables: document.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])').length }));
  // لوحة المفاتيح: Tab يجب أن ينقل التركيز إلى عنصر ظاهر بإطار تركيز
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(450);
  const focus = await p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return { ok: false }; const s = getComputedStyle(a); return { ok: true, tag: a.tagName.toLowerCase(), visible: s.outlineStyle !== 'none' || s.boxShadow !== 'none' }; });
  p.off('pageerror', onErr); p.off('console', onCon);
  return { url: url.replace(B, ''), lang, loadErrors: errs, violations: r, ...meta, keyboard: focus, loaded: meta.text > 30 && !errs.length };
}
(async () => {
  const b = await chromium.launch(); const results = [];
  const run = async (app, email, routes, langs = ['ar'], vp = { width: 1440, height: 900 }) => {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
    await login(p, app, email);
    for (const lang of langs) {
      await p.evaluate((l) => localStorage.setItem('al-lang', l), lang);
      for (const r of routes) results.push({ app, ...(await audit(p, `${B}/${app}/#${r}`, lang)) });
    }
    await ctx.close();
  };
  await run('admin', 'admin@medlog.demo', ADMIN, ['ar', 'en']);
  await run('portal', 'corp.admin@medlog.demo', PORTAL, ['ar', 'en']);
  await run('mobile/customer', 'corp.admin@medlog.demo', CM, ['ar', 'en'], { width: 1200, height: 900 });
  await run('mobile/courier', 'courier1@medlog.demo', K, ['ar', 'en'], { width: 1200, height: 900 });
  // عرض الجوال الحقيقي (390px) للبوابة ولوحة الإدارة
  await run('admin', 'ops@medlog.demo', ['/', '/shipments', '/shipments/shp_0004', '/routes'], ['ar'], { width: 390, height: 844 });
  await run('portal', 'branch.op@medlog.demo', ['/', '/shipments', '/shipments/new'], ['ar'], { width: 390, height: 844 });
  require('fs').writeFileSync(process.argv[2] || 'audit.json', JSON.stringify(results, null, 1));
  const v = results.flatMap((r) => r.violations.map((x) => x.id + ':' + x.impact));
  const by = {}; v.forEach((k) => (by[k] = (by[k] ?? 0) + 1));
  console.log(JSON.stringify({ screens: results.length, loadFailures: results.filter((r) => !r.loaded).map((r) => r.app + r.url + ' ' + r.lang + ' ' + r.loadErrors.join('|').slice(0, 120)), violationsByRule: by, rtlOk: results.filter((r) => r.lang === 'ar').every((r) => r.dir === 'rtl'), ltrOk: results.filter((r) => r.lang === 'en').every((r) => r.dir === 'ltr'), keyboardFail: results.filter((r) => !r.keyboard.ok || !r.keyboard.visible).map((r) => r.app + r.url) }, null, 1));
  await b.close();
})();
