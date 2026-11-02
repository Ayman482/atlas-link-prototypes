// رحلات شاملة في المتصفح (الخيار C): فاتورة البوابة، رحلة المندوب، الانقطاع، الإنشاء من جوال العميل، الاتجاه، المختبر — BASE=http://localhost:5057 node e2e-flows.js <مجلد اللقطات>
const { chromium } = require('playwright');
const B = 'http://localhost:5057';
const out = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const errs = []; const hook = (p) => { p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message)); p.on('console', m => m.type() === 'error' && !m.text().includes('fonts.g') && errs.push(p.url() + ' :: ' + m.text())); };
  const login = async (p, url, email) => { await p.goto(B + url); await p.waitForTimeout(700); await p.click(`text=${email}`); await p.waitForTimeout(400); const mfa = await p.$('input[maxlength="6"]'); if (mfa) { await mfa.fill('123456'); await p.click('button:has-text("تحقق")'); } await p.waitForTimeout(800); };
  const log = [];
  // 1) Portal — all routes for corp admin + lab
  const p = await ctx.newPage(); hook(p);
  await p.evaluate(() => 0);
  await login(p, '/portal/', 'corp.admin@medlog.demo');
  const proutes = ['/', '/shipments', '/shipments/new', '/recurring', '/addresses', '/branches', '/users', '/contracts', '/invoices', '/payments', '/claims', '/reports', '/api', '/notifications', '/profile'];
  const bad = [];
  for (const r of proutes) { await p.goto(B + '/portal/#' + r); await p.waitForTimeout(350); const t = await p.textContent('main'); if (/غير متاحة|حدث خطأ/.test(t) || t.trim().length < 30) bad.push(r + ' => ' + t.slice(0, 120)); }
  await p.goto(B + '/portal/#/'); await p.waitForTimeout(500); await p.screenshot({ path: out + '/p1.png' });
  // open first shipment & invoice
  await p.goto(B + '/portal/#/shipments'); await p.waitForTimeout(400); await p.click('tbody tr >> nth=0'); await p.waitForTimeout(600); await p.screenshot({ path: out + '/p2.png' });
  await p.goto(B + '/portal/#/invoices'); await p.waitForTimeout(400); const ir = await p.$('tbody tr'); if (ir) { await ir.click(); await p.waitForTimeout(500); }
  log.push('invoice page: ' + (await p.textContent('main')).slice(0, 80));
  // 2) Courier mobile — run a full pickup → delivery
  const c = await ctx.newPage(); hook(c);
  await c.setViewportSize({ width: 1200, height: 900 });
  await login(c, '/mobile/courier/', 'courier1@medlog.demo');
  await c.screenshot({ path: out + '/k1.png' });
  const cards = await c.$$('a.mcard');
  log.push('courier tasks: ' + cards.length);
  let pick = null; for (const a of cards) { const t = await a.textContent(); if (/جُدول الاستلام|الاستلام مجدول/.test(t)) { pick = a; break; } }
  if (!pick) for (const a of cards) { const t = await a.textContent(); if (/استلام/.test(t)) { pick = a; break; } }
  if (pick) {
    await pick.click(); await c.waitForTimeout(500);
    const track = (await c.textContent('.mtop')).match(/ML-\d{4}-\d+/)?.[0]; log.push('task ' + track);
    await c.click(`.phone button:has-text("${track}")`); await c.waitForTimeout(1700);
    const boxBtn = await c.$('.phone .mcard button:has(.mono):not(:has-text("ML-"))'); if (boxBtn) { await boxBtn.click(); await c.waitForTimeout(1700); }
    log.push('after pack: ' + ((await c.textContent('.phone')).includes('تأكيد الاستلام') ? 'signature step' : (await c.textContent('.phone')).slice(0, 300)));
    await c.fill('.phone .mcard input:not([type])', 'أ. خالد'); 
    const cv = await c.$('.phone canvas'); const bb = await cv.boundingBox(); await c.mouse.move(bb.x + 20, bb.y + 30); await c.mouse.down(); await c.mouse.move(bb.x + 120, bb.y + 70, { steps: 8 }); await c.mouse.move(bb.x + 200, bb.y + 40, { steps: 8 }); await c.mouse.up();
    await c.click('.phone button.primary:has-text("تأكيد الاستلام")'); await c.waitForTimeout(800);
    log.push('status after pickup: ' + await c.textContent('.mtop'));
    await c.screenshot({ path: out + '/k2.png' });
    const st = await c.$('.phone button:has-text("بدء النقل")'); if (st) { await st.click(); await c.waitForTimeout(700); }
    log.push('after transit: ' + await c.textContent('.mtop'));
    const dv = await c.$('.phone button.primary:has-text("تسليم")');
    if (dv) { await dv.click(); await c.waitForTimeout(400); await c.fill('.phone .mcard input:not([type]) >> nth=0', 'د. ليلى'); const cv2 = await c.$('.phone canvas'); const b2 = await cv2.boundingBox(); await c.mouse.move(b2.x + 20, b2.y + 30); await c.mouse.down(); await c.mouse.move(b2.x + 150, b2.y + 60, { steps: 8 }); await c.mouse.up(); await c.click('.phone button:has-text("تأكيد التسليم")'); await c.waitForTimeout(800); log.push('after deliver: ' + await c.textContent('.mtop')); }
    else log.push('no deliver button: ' + (await c.textContent('.phone')).slice(0, 400));
    await c.screenshot({ path: out + '/k3.png' });
  }
  // offline queue test
  await c.goto(B + '/mobile/courier/#/sync'); await c.waitForTimeout(500); await c.click('.phone button:has-text("قطع الاتصال")'); await c.waitForTimeout(300);
  log.push('offbar: ' + !!(await c.$('.offbar')));
  await c.click('.phone button:has-text("استعادة الاتصال")');
  for (const r of ['/', '/map', '/boxes', '/sync', '/me']) { await c.goto(B + '/mobile/courier/#' + r); await c.waitForTimeout(350); }
  await c.goto(B + '/mobile/courier/#/map'); await c.waitForTimeout(400); await c.screenshot({ path: out + '/k4.png' });
  // 3) Customer mobile — create a shipment through the wizard
  const m = await ctx.newPage(); hook(m);
  await login(m, '/mobile/customer/', 'branch.op@medlog.demo');
  await m.screenshot({ path: out + '/m1.png' });
  await m.goto(B + '/mobile/customer/#/new'); await m.waitForTimeout(500);
  const sels = await m.$$('.phone select');
  for (const s of sels) { const o = await s.$$('option'); if (o.length > 1) await s.selectOption({ index: o.length > 2 ? 1 : 1 }); }
  const sels2 = await m.$$('.phone select'); if (sels2.length >= 3) { const o = await sels2[sels2.length - 1].$$('option'); await sels2[sels2.length - 1].selectOption({ index: o.length - 1 }); }
  for (let i = 0; i < 3; i++) { await m.click('.phone button:has-text("التالي")'); await m.waitForTimeout(500); }
  log.push('quote step: ' + (await m.textContent('.phone .mbodyx')).slice(0, 200));
  await m.screenshot({ path: out + '/m2.png' });
  await m.click('.phone button:has-text("تأكيد الطلب")'); await m.waitForTimeout(900);
  log.push('created: ' + await m.textContent('.mtop'));
  await m.screenshot({ path: out + '/m3.png' });
  for (const r of ['/', '/shipments', '/notifications', '/invoices', '/claims', '/addresses', '/account']) { await m.goto(B + '/mobile/customer/#' + r); await m.waitForTimeout(350); const t = await m.textContent('.phone'); if (/حدث خطأ|غير متاح لدورك/.test(t)) bad.push('cm ' + r); }
  // English LTR check
  await m.goto(B + '/mobile/customer/#/account'); await m.waitForTimeout(300); await m.click('.phone button:has-text("English")'); await m.waitForTimeout(400); log.push('dir=' + await m.evaluate(() => document.documentElement.dir)); await m.goto(B + '/mobile/customer/#/'); await m.waitForTimeout(400); await m.screenshot({ path: out + '/m4.png' });
  // 4) Lab — inbound
  const l = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); hook(l);
  await login(l, '/portal/', 'lab@medlog.demo'); log.push('lab: ' + (await l.textContent('main')).slice(0, 120));
  console.log(JSON.stringify({ errs: errs.slice(0, 20), bad, log }, null, 1));
  await b.close();
})();
