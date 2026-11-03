// أدلة المتصفح لسيناريوهات Phase 17 (الإصدار التجريبي على الويب):
//  E2E-11-WEB: انقطاع فعلي للشبكة في المتصفح (context.setOffline) أثناء عمل المندوب، حفظ الإجراء في الطابور، ثم المزامنة التلقائية عند العودة دون تكرار.
//  E2E-12-WEB: مشغّل فرع يبدّل بين فرعيه المخوّلين في البوابة، ومحاولة فتح شحنة فرع غير مخوّل برابط مباشر.
//  E2E-06-WEB: شاشة تتبع شحنة في رحلة جوية — لا موقع حي، آخر موقع مؤكد بوقته.
// الاستخدام: BASE=http://127.0.0.1:5057 node browser-scenarios.js <مجلد اللقطات> <ملف JSON>
const { chromium } = require('playwright');
const fs = require('fs');
const B = process.env.BASE || 'http://127.0.0.1:5057';
const out = process.argv[2]; const res = { executedAt: new Date().toISOString(), base: B, steps: [] };
const rec = (id, step, expected, actual, pass, shot) => { res.steps.push({ id, step, expected, actual, status: pass ? 'PASS' : 'FAIL', evidence: shot ?? null }); console.log(id, pass ? 'PASS' : 'FAIL', JSON.stringify(actual).slice(0, 160)); };
const login = async (p, url, email) => { await p.goto(B + url); await p.waitForTimeout(900); await p.click(`text=${email}`); await p.waitForTimeout(500); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); } await p.waitForTimeout(1200); };
(async () => {
  const b = await chromium.launch();
  // ---------- E2E-11-WEB ----------
  {
    const ctx = await b.newContext({ viewport: { width: 412, height: 892 } }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await login(p, '/mobile/courier/', 'courier1@medlog.demo');
    // مهمة في الطريق: «وصلت» تُنفّذ متصلاً (تتطلب الخادم)، ثم تُقطع الشبكة قبل التسليم
    const cards = p.locator('a.mcard'); const n = await cards.count(); let opened = null;
    for (let i = 0; i < n; i++) { const t = await cards.nth(i).innerText(); if (/في الطريق/.test(t) && /تسليم/.test(t)) { opened = (t.match(/ML-\d{4}-\d+/) || [])[0]; await cards.nth(i).click(); break; } }
    await p.waitForTimeout(900); const taskUrl = p.url();
    const arrive = p.locator('.phone button:has-text("وصلت")'); if (await arrive.count() && await arrive.first().isEnabled()) { await arrive.first().click(); await p.waitForTimeout(900); }
    await ctx.setOffline(true); await p.waitForTimeout(900);
    const banner = await p.locator('.offbar').count();
    await p.screenshot({ path: `${out}/e2e11-1-offline.png` });
    rec('E2E-11-WEB.1', 'قطع الشبكة فعلياً في المتصفح (context.setOffline)', 'شريط «دون اتصال» ظاهر تلقائياً دون تدخل المستخدم', { banner, task: opened }, banner > 0 && !!opened, 'shots/e2e11-1-offline.png');
    const deliverOnce = async () => {
      const dv = p.locator('.phone button.primary:has-text("تسليم")'); if (!(await dv.count()) || !(await dv.first().isEnabled())) return 'no-enabled-deliver';
      await dv.first().click(); await p.waitForTimeout(400);
      await p.fill('.phone .mcard input:not([type]) >> nth=0', 'د. ليلى الحمدان');
      const cv = await p.$('.phone canvas'); const bb = await cv.boundingBox(); await p.mouse.move(bb.x + 20, bb.y + 30); await p.mouse.down(); await p.mouse.move(bb.x + 150, bb.y + 60, { steps: 8 }); await p.mouse.up();
      const ok = p.locator('.phone button:has-text("تأكيد التسليم")'); await ok.click(); await ok.click({ timeout: 800 }).catch(() => {}); // ضغطة مزدوجة متعمدة
      await p.waitForTimeout(700); return 'submitted';
    };
    const first = await deliverOnce();
    await p.goto(taskUrl); await p.waitForTimeout(800);
    const second = await deliverOnce();
    await p.goto(B + '/mobile/courier/#/sync'); await p.waitForTimeout(800);
    const syncText = await p.locator('.phone').first().innerText();
    const pending = +((syncText.match(/الطابور \((\d+)\)/) || [])[1] ?? 0);
    await p.screenshot({ path: `${out}/e2e11-2-queued.png` });
    rec('E2E-11-WEB.2', `تسليم ${opened} دون اتصال بضغطة مزدوجة، ثم محاولة تسليم ثانية`, 'إجراء تسليم واحد فقط في الطابور، دون أخطاء JavaScript', { first, second, occurrencesInQueue: pending, errs: [...errs] }, first === 'submitted' && pending === 1 && errs.length === 0, 'shots/e2e11-2-queued.png');
    await ctx.setOffline(false); await p.waitForTimeout(2500);
    const after = await p.locator('.phone').first().innerText();
    await p.screenshot({ path: `${out}/e2e11-3-synced.png` });
    const stillQueued = +((after.match(/الطابور \((\d+)\)/) || [])[1] ?? 0);
    await p.goto(B + '/mobile/courier/'); await p.waitForTimeout(900); const home = await p.locator('.phone').first().innerText();
    rec('E2E-11-WEB.3', 'إعادة الاتصال', 'مزامنة تلقائية دون ضغط «مزامنة»؛ الإجراء خرج من الطابور؛ الشحنة لم تعد ضمن مهام التسليم المفتوحة', { offbarAfter: await p.locator('.offbar').count(), stillQueued, stillOpenTask: new RegExp(opened + '[\\s\\S]{0,80}في الطريق').test(home), errs }, (await p.locator('.offbar').count()) === 0 && stillQueued === 0 && errs.length === 0, 'shots/e2e11-3-synced.png');
    await ctx.close();
  }
  // ---------- E2E-12-WEB ----------
  {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await ctx.newPage();
    await login(p, '/portal/', 'branch.op@medlog.demo');
    const sel = p.locator('select').first();
    const opts = await sel.locator('option').allInnerTexts().catch(() => []);
    rec('E2E-12-WEB.1', 'قائمة الفروع لمشغّل الفرع', 'فرعان مخوّلان فقط (العليا، الروضة) + «كل فروعي» إن وجدت', { options: opts }, opts.length >= 2 && !opts.some((o) => /الملقا/.test(o)));
    await p.goto(B + '/portal/#/shipments'); await p.waitForTimeout(900);
    const fsel = p.locator('select[aria-label="الفرع"]');
    const pick = async (re) => { const o = (await fsel.locator('option').all()); for (const x of o) { const t = await x.innerText(); if (re.test(t)) { await fsel.selectOption({ label: t }); return t; } } return null; };
    const branchCol = async () => (await p.locator('tbody tr').allInnerTexts()).map((t) => t.split('\t')[1]);
    const r1 = await pick(/الروضة/); await p.waitForTimeout(900);
    const rowsR = await branchCol();
    await p.screenshot({ path: `${out}/e2e12-1-rawdah.png` });
    const r2 = await pick(/العليا/); await p.waitForTimeout(900);
    const rowsO = await branchCol();
    await p.screenshot({ path: `${out}/e2e12-2-olaya.png` });
    rec('E2E-12-WEB.2', `التبديل: ${r1} ثم ${r2}`, 'القائمة تتغير بحسب الفرع ولا تظهر شحنات الملقا', { rawdahRows: rowsR, olayaRows: rowsO, mlqLeak: [...rowsR, ...rowsO].some((t) => /الملقا/.test(t)) }, !!r1 && !!r2 && rowsR.length > 0 && rowsR.every((t) => /الروضة/.test(t)) && rowsO.length > 0 && rowsO.every((t) => /العليا/.test(t)) && ![...rowsR, ...rowsO].some((t) => /الملقا/.test(t)), 'shots/e2e12-2-olaya.png');
    // شحنة الملقا في بيانات العرض — اكتشافها بحساب مدير المؤسسة في سياق منفصل
    const c2 = await b.newContext({ viewport: { width: 1360, height: 900 } }); const q = await c2.newPage();
    await login(q, '/portal/', 'corp.admin@medlog.demo'); await q.goto(B + '/portal/#/shipments'); await q.waitForTimeout(900);
    const mlqRow = q.locator('tbody tr', { hasText: 'الملقا' }).first(); let mlqId = null;
    if (await mlqRow.count()) { await mlqRow.click(); await q.waitForTimeout(700); mlqId = (q.url().match(/shipments\/([^/?#]+)/) || [])[1]; }
    await c2.close();
    if (mlqId) {
      await p.goto(B + '/portal/#/shipments/' + mlqId); await p.waitForTimeout(1200);
      const txt = (await p.locator('main').innerText()).slice(0, 300);
      await p.screenshot({ path: `${out}/e2e12-3-direct-url.png` });
      rec('E2E-12-WEB.3', `فتح شحنة الملقا ${mlqId} برابط مباشر`, 'رسالة «غير موجود/لا صلاحية» دون أي بيانات للشحنة', { excerpt: txt.replace(/\s+/g, ' ').slice(0, 160) }, /غير موجود|غير متاح|لا صلاحية|لم يُعثر/.test(txt) && !/الملقا/.test(txt), 'shots/e2e12-3-direct-url.png');
    } else rec('E2E-12-WEB.3', 'فتح شحنة الملقا برابط مباشر', 'رسالة غير موجود', 'لم يُعثر على شحنة للملقا في قائمة مدير المؤسسة', false);
    await ctx.close();
  }
  // ---------- E2E-06-WEB ----------
  {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await ctx.newPage();
    await login(p, '/admin/', 'ops@medlog.demo'); await p.goto(B + '/admin/#/map'); await p.waitForTimeout(1500);
    const txt = await p.locator('main').innerText();
    const air = /رحلة جوية|في الجو/.test(txt);
    await p.locator('.mk').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    const card = await p.locator('.mapcard').innerText().catch(() => '');
    await p.screenshot({ path: `${out}/e2e06-air-map.png` });
    rec('E2E-06-WEB.1', 'الخريطة التشغيلية: شحنة في رحلة جوية', 'نوع الموقع «مستنتج من أحداث الناقل» أو آخر موقع مؤكد بوقته؛ لا «مباشر»', { airListed: air, card: card.replace(/\s+/g, ' ').slice(0, 200) }, /مستنتج من أحداث الناقل|آخر موقع مؤكد/.test(card) && !/^.*رحلة جوية.*مباشر/.test(card), 'shots/e2e06-air-map.png');
    await ctx.close();
  }
  fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
  await b.close();
})();
