// فحوص وظيفية للمكوّنات التفاعلية — الاستخدام: BASE=http://localhost:5057 node functional-checks.js
const { chromium } = require('playwright');
const B = process.env.BASE; const R = {};
const login = async (p, url, email) => { await p.goto(B + url); await p.waitForTimeout(900); await p.click(`text=${email}`); await p.waitForTimeout(500); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); } await p.waitForTimeout(1200); };
const T = async (name, fn) => { try { R[name] = await fn(); } catch (e) { R[name] = 'FAIL ' + e.message.split('\n')[0]; } };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await login(p, '/admin/', 'ops@medlog.demo');
  await T('routes', async () => {
    await p.goto(B + '/admin/#/routes'); await p.waitForTimeout(1500);
    // اختر مساراً فيه توقفات قابلة للنقل
    const rows = p.locator('tbody tr'); const n = await rows.count();
    for (let i = 0; i < n; i++) { await rows.nth(i).click(); await p.waitForTimeout(500); if (await p.locator('.grip').count() >= 2) break; }
    const grips = p.locator('.grip'); const g = await grips.count(); if (g < 2) return 'no movable stops';
    const before = await p.locator('.dnd li b').allTextContents();
    await grips.nth(1).focus(); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(400);
    const after = await p.locator('.dnd li b').allTextContents();
    const msg = (await p.locator('.dnd').locator('..').textContent()).match(/(قبل|مقفل|لا يمكن)[^.]{0,60}/)?.[0];
    await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
    const undone = await p.locator('.dnd li b').allTextContents();
    return { stops: g, changedOrBlocked: before.join() !== after.join() || !!msg, validationMsg: msg ?? null, undoRestored: undone.join() === before.join() };
  });
  await T('tempChart', async () => {
    await p.goto(B + '/admin/#/shipments/shp_0004'); await p.waitForTimeout(2000); await p.click('[role=tab]:has-text("درجة الحرارة")'); await p.waitForTimeout(1200);
    const svg = p.locator('.tchart svg'); await svg.focus(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
    const live = await p.locator('.tchart [aria-live]').first().textContent();
    const ranges = await p.locator('.tchart button').allTextContents();
    return { live: live.slice(0, 60), ranges: ranges.slice(0, 5) };
  });
  await T('timelineExpand', async () => { await p.click('[role=tab]:has-text("سجل الأحداث")'); await p.waitForTimeout(800); const h = p.locator('.tlhead').first(); await h.click(); await p.waitForTimeout(300); return await h.getAttribute('aria-expanded'); });
  await T('mapCard', async () => { await p.goto(B + '/admin/#/map'); await p.waitForTimeout(1800); await p.locator('.mk').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500); return (await p.locator('.mapcard').textContent()).slice(0, 80); });
  await T('bulkAck', async () => {
    await p.goto(B + '/admin/#/excursions'); await p.waitForTimeout(1500);
    const before = await p.locator('.alertbar').count();
    await p.locator('thead input[type=checkbox]').first().check(); await p.waitForTimeout(300);
    const bar = await p.locator('.bulkbar').textContent();
    await p.locator('.bulkbar button').first().click(); await p.waitForTimeout(1200);
    return { bar: bar.slice(0, 70), criticalBarBefore: before, criticalBarAfter: await p.locator('.alertbar').count() };
  });
  await T('wizardValidation', async () => {
    await p.goto(B + '/admin/#/shipments/new'); await p.waitForTimeout(1500);
    await p.locator('button:has-text("التالي")').click(); await p.waitForTimeout(300);
    const errs = await p.locator('.err, [aria-invalid="true"]').count();
    return { stepsAreLi: await p.locator('ol.steps > li').count(), errorsShown: errs, current: await p.locator('ol.steps [aria-current="step"]').textContent() };
  });
  const rm = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
  await login(rm, '/admin/', 'ops@medlog.demo');
  await T('reducedMotion', async () => { await rm.goto(B + '/admin/#/shipments'); await rm.waitForTimeout(60); return await rm.evaluate(() => [...document.querySelectorAll('.card')].slice(0, 4).map((e) => getComputedStyle(e).transform)); });
  const k = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  await login(k, '/mobile/courier/', 'courier1@medlog.demo');
  await T('qr', async () => {
    await k.goto(B + '/mobile/courier/#/t/shp_0012'); await k.waitForTimeout(1800);
    const bad = k.locator('button:has-text("ML-2026-999999")'); if (!(await bad.count())) return 'no scan on first task';
    await bad.click(); await k.waitForTimeout(1500);
    const failure = await k.locator('.scanstate.bad').textContent();
    await k.locator('.scanstate.bad button').click(); await k.waitForTimeout(300);
    const good = k.locator('button:has-text("ملصق الشحنة")').first(); await good.click(); await k.waitForTimeout(1600);
    return { failure: failure.slice(0, 80), afterRetryOk: (await k.locator('.scanstate.ok').count()) > 0 || (await k.textContent('.phone')).includes('الصندوق') };
  });
  console.log(JSON.stringify(R, null, 1)); await b.close();
})();
