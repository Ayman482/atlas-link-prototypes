// فحص عناصر التنقل العام (Phase 17): ينقر كل رابط في الشريط الجانبي للإدارة والبوابة (بعد فتح المجموعة)،
// وكل تبويب سفلي في تطبيقي الجوال، ويتحقق أن العنوان تغيّر إلى المسار المتوقع وأن الشاشة عرضت محتوى دون خطأ.
// الاستخدام: BASE=http://127.0.0.1:5057 node nav-check.js out.json
const { chromium } = require('playwright');
const fs = require('fs');
const B = process.env.BASE || 'http://127.0.0.1:5057';
const SETS = [['admin', 'admin@medlog.demo'], ['portal', 'corp.admin@medlog.demo'], ['mobile/customer', 'corp.admin@medlog.demo'], ['mobile/courier', 'courier1@medlog.demo']];
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [app, email] of SETS) {
    const mobile = app.startsWith('mobile');
    const p = await (await b.newContext({ viewport: mobile ? { width: 412, height: 892 } : { width: 1440, height: 900 } })).newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${B}/${app}/`); await p.waitForTimeout(900); await p.click(`text=${email}`); await p.waitForTimeout(500);
    const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); } await p.waitForTimeout(1300);
    const sel = mobile ? '.mtabs a' : 'aside a[href^="#"], .slinks a[href^="#"], nav a[href^="#"]';
    const hrefs = [...new Set(await p.locator(sel).evaluateAll((es) => es.map((e) => e.getAttribute('href'))))];
    for (const h of hrefs) {
      await p.goto(`${B}/${app}/`); await p.waitForTimeout(500);
      const link = p.locator(`${sel.split(',').map((s) => s.trim().replace(/\[href\^="#"\]/, '')).map((s) => `${s}[href="${h}"]`).join(', ')}`).first();
      // افتح مجموعة الشريط الجانبي إن كانت مطوية
      if (!mobile) { const opened = await link.evaluate((e) => { const b = e.closest('.sgroup')?.querySelector(':scope > button[aria-expanded="false"]'); if (b) { b.click(); return true; } return false; }).catch(() => false); if (opened) await p.waitForTimeout(450); }
      errs.length = 0; let ok = false, note = '';
      try { await link.click({ timeout: 3000 }); await p.waitForTimeout(700); const u = new URL(p.url()); ok = u.hash === h || (h === '#/' && (u.hash === '' || u.hash === '#/')); const t = (await p.locator('main, .phone, body').first().innerText()).trim(); if (/حدث خطأ|غير متاحة/.test(t.slice(0, 200))) { ok = false; note = t.slice(0, 80); } }
      catch (e) { note = 'click: ' + e.message.split('\n')[0].slice(0, 80); }
      if (errs.length) { ok = false; note += ' js: ' + errs.join('|').slice(0, 100); }
      out.push({ app, href: h, ok, note });
    }
    console.log(app, 'links', hrefs.length, 'ok', out.filter((x) => x.app === app && x.ok).length);
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  for (const x of out.filter((x) => !x.ok)) console.log('FAIL', x.app, x.href, x.note);
  await b.close();
})();
