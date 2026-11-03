// Phase 17.1 — تدقيق بصري لكل نافذة حوار ودرج: يفتح كل زر يُظهر نافذة في كل شاشة، ثم:
//  1) تداخل: يأخذ عينات شبكية داخل مستطيل النافذة ويتحقق بـ elementFromPoint أن العنصر الظاهر جزء من النافذة (لا رأس جدول ولا صف فوقها)
//  2) الاحتواء: النافذة ورأسها وتذييلها داخل الشاشة؛ المحتوى الطويل يتمرر داخلياً
//  3) الحقول: لا تداخل بين التسميات والحقول والأزرار (تقاطع المستطيلات)، وعرض الحقل ≥ 160px (≥ 120 على 390)
//  4) قفل الخلفية: الصفحة لا تتمرر بعجلة الفأرة، والنقر خارج النافذة لا يصل لعناصر الصفحة
//  5) لوحة المفاتيح: التركيز داخل النافذة، Tab يبقى داخلها، Escape يغلقها ويعيد التركيز
//  ويلتقط لقطة شاشة لكل نافذة مفتوحة.
// الاستخدام: BASE=… APP=admin LANGS=ar,en WIDTHS=1440,390 OUT=dir node modal-audit.js out.json
const { chromium } = require('playwright');
const safe = async (fn) => { for (let k = 0; k < 2; k++) { try { return await fn(); } catch (e) { if (k) throw e; } } };
const fs = require('fs');
const B = process.env.BASE || 'http://127.0.0.1:5057';
const APP = process.env.APP || 'admin';
const LANGS = (process.env.LANGS || 'ar').split(',');
const WIDTHS = (process.env.WIDTHS || '1440').split(',').map(Number);
const OUT = process.env.OUT || 'shots';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const MAXPER = +(process.env.MAXPER || 12);
const src = fs.readFileSync(__dirname + '/../../option-c-enhancement/audit.js', 'utf8');
const grab = (name) => eval(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]);
const SETS = { admin: ['admin@medlog.demo', grab('ADMIN')], portal: ['corp.admin@medlog.demo', grab('PORTAL')], 'mobile/customer': ['corp.admin@medlog.demo', grab('CM')], 'mobile/courier': ['courier1@medlog.demo', grab('K')] };
const SKIP = /تسجيل الخروج|Sign out|إعادة ضبط|Reset demo|English|العربية|تبديل المظهر|Toggle theme/;
fs.mkdirSync(OUT, { recursive: true });

const inspect = () => {
  const dlg = document.querySelector('[role=dialog][aria-modal=true], .drawer[role=dialog], [role=dialog]');
  if (!dlg) return null;
  const vw = innerWidth, vh = innerHeight; const r = dlg.getBoundingClientRect();
  const res = { w: Math.round(r.width), h: Math.round(r.height), inViewport: r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1, overlapPoints: [], fieldOverlaps: [], narrowFields: [], headerVisible: true, footerVisible: true, bodyScrollable: null, footerCoversFields: [] };
  // 1) تداخل: شبكة 9×7 نقطة
  for (let i = 1; i < 10; i++) for (let j = 1; j < 8; j++) {
    const x = Math.min(vw - 2, Math.max(1, r.left + (r.width * i) / 10)); const y = Math.min(vh - 2, Math.max(1, r.top + (r.height * j) / 8));
    const el = document.elementFromPoint(x, y);
    if (el && !dlg.contains(el)) res.overlapPoints.push(`${Math.round(x)},${Math.round(y)} ← ${el.tagName.toLowerCase()}.${(el.className?.toString?.() || '').split(' ')[0]} «${(el.textContent || '').trim().slice(0, 24)}»`);
  }
  const own = (sel) => [...dlg.querySelectorAll(sel)].find((e) => !e.closest('.sheet')) || null; /* رأس/تذييل النافذة نفسها لا رأس/تذييل صفحة A4 داخل عارض الفاتورة */ const hdr = own('header, .inv-bar'); const ftr = own('footer'); const body = dlg.querySelector('.mbody, .dbody, .drawer-body') || dlg;
  const vis = (e) => { if (!e) return true; const b = e.getBoundingClientRect(); return b.top >= -1 && b.bottom <= vh + 1 && b.left >= -1 && b.right <= vw + 1; };
  res.headerVisible = vis(hdr); res.footerVisible = vis(ftr);
  res.bodyScrollable = body.scrollHeight > body.clientHeight + 2 ? getComputedStyle(body).overflowY : 'fits';
  // 3) تداخل الحقول والتسميات والأزرار
  const items = [...dlg.querySelectorAll('label > span, .field > span, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea, button, .err')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
  const rect = (e) => e.getBoundingClientRect();
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const A = items[a], Bx = items[b]; if (A.contains(Bx) || Bx.contains(A)) continue;
    const p = rect(A), q = rect(Bx); const ix = Math.min(p.right, q.right) - Math.max(p.left, q.left); const iy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
    if (ix > 3 && iy > 3) res.fieldOverlaps.push(`${A.tagName.toLowerCase()}«${(A.textContent || A.getAttribute('name') || '').trim().slice(0, 16)}» × ${Bx.tagName.toLowerCase()}«${(Bx.textContent || Bx.getAttribute('name') || '').trim().slice(0, 16)}»`);
  }
  const minW = vw <= 430 ? 120 : 160;
  for (const f of dlg.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea')) { const b = f.getBoundingClientRect(); if (b.width > 0 && b.width < minW) res.narrowFields.push(`${f.tagName.toLowerCase()}[${f.getAttribute('name') || f.id || f.type}] ${Math.round(b.width)}px`); }
  // الحقول التي يغطيها التذييل
  if (ftr) { const fb = ftr.getBoundingClientRect(); for (const f of body.querySelectorAll('input, select, textarea')) { const b = f.getBoundingClientRect(); if (b.height && b.bottom > fb.top + 2 && b.top < fb.bottom && body.scrollHeight <= body.clientHeight + 2) res.footerCoversFields.push(f.getAttribute('name') || f.tagName); } }
  return res;
};

(async () => {
  const [email, all] = SETS[APP]; const routes = ONLY ?? all;
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] }); const results = [];
  for (const lang of LANGS) for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: w <= 430 ? 844 : w <= 800 ? 1024 : 900 } }); const p = await ctx.newPage(); p.setDefaultNavigationTimeout(90000);
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${B}/${APP}/`); await p.evaluate((l) => localStorage.setItem('al-lang', l), lang); await p.reload(); await p.waitForTimeout(900);
    await p.click(`text=${email}`); await p.waitForTimeout(500); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click(lang === 'ar' ? 'button:has-text("تحقق")' : 'button:has-text("Verify")'); } await p.waitForTimeout(1300);
    for (const r of routes) {
      const url = `${B}/${APP}/#${r}`;
      try { await safe(() => p.goto(url, { timeout: 90000 })); await safe(() => p.reload({ timeout: 90000 })); } catch { process.stdout.write(`${APP}${r} [${lang} ${w}] NAV-TIMEOUT\n`); continue; } await p.waitForTimeout(1300);
      // المرشحات: أزرار ظاهرة داخل المحتوى (لا الشريط الجانبي والعلوي)
      const cand = await p.evaluate((skip) => [...document.querySelectorAll('main button, .phone button, .mbodyx button')].map((e, i) => ({ i, t: (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40), d: e.disabled, v: e.getBoundingClientRect().height > 0 && !e.closest('nav, aside, header.topbar, .mtabs, thead') })).filter((x) => x.v && !x.d && x.t && !new RegExp(skip).test(x.t)), SKIP.source);
      const seen = new Set(); let n = 0;
      for (const c of cand) {
        if (n >= MAXPER || seen.has(c.t)) continue;
        try { await safe(() => p.goto(url, { timeout: 90000 })); await safe(() => p.reload({ timeout: 90000 })); } catch { continue; } await p.waitForTimeout(1100); errs.length = 0;
        const btn = p.locator('main button, .phone button, .mbodyx button').nth(c.i);
        const scrollY0 = await p.evaluate(() => scrollY);
        try { await btn.scrollIntoViewIfNeeded({ timeout: 1500 }); await btn.click({ timeout: 2000 }); } catch { continue; }
        await p.waitForTimeout(500);
        const opened = await p.$('[role=dialog]');
        if (!opened) continue;
        seen.add(c.t); n++;
        const ins = await p.evaluate(inspect);
        // 4) قفل الخلفية
        const yBefore = await p.evaluate(() => scrollY); await p.mouse.move(5, (await p.viewportSize()).height - 5); await p.mouse.wheel(0, 600); await p.waitForTimeout(250);
        const scrollLocked = (await p.evaluate(() => scrollY)) === yBefore || (await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
        const inert = await p.evaluate(() => { const m = document.querySelector('main, .phone'); return !!m && (m.closest('[inert]') !== null || m.hasAttribute('inert') || m.getAttribute('aria-hidden') === 'true'); });
        const name = `${APP.replace('/', '-')}${r.replace(/[/:]/g, '_')}__${c.t.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 30)}__${lang}_${w}`;
        await p.screenshot({ path: `${OUT}/${name}.png` });
        // 5) لوحة المفاتيح
        const focusIn = await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
        let trapped = true; for (let k = 0; k < 25; k++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) { trapped = false; break; } }
        await p.keyboard.press('Escape'); await p.waitForTimeout(450);
        const closedByEsc = !(await p.$('[role=dialog]'));
        const issues = [];
        if (ins.overlapPoints.length) issues.push(`overlap:${ins.overlapPoints.length}`);
        if (!ins.inViewport) issues.push('outside-viewport');
        if (!ins.headerVisible) issues.push('header-hidden'); if (!ins.footerVisible) issues.push('footer-hidden');
        if (ins.fieldOverlaps.length) issues.push(`field-overlap:${ins.fieldOverlaps.length}`);
        if (ins.narrowFields.length) issues.push(`narrow:${ins.narrowFields.length}`);
        if (ins.bodyScrollable !== 'fits' && !['auto', 'scroll'].includes(ins.bodyScrollable)) issues.push('body-not-scrollable');
        if (!scrollLocked) issues.push('background-scrolls');
        if (!focusIn) issues.push('focus-outside'); if (!trapped) issues.push('focus-escapes'); if (!closedByEsc) issues.push('esc-no-close');
        if (errs.length) issues.push('js-error');
        results.push({ app: APP, route: r, button: c.t, lang, w, shot: `${name}.png`, issues, inertBackground: inert, ...ins, errs: [...errs] });
        process.stdout.write(`${APP}${r} [${lang} ${w}] «${c.t}» ${issues.join(' ') || 'OK'}\n`);
      }
    }
    await ctx.close();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(results, null, 1));
  const bad = results.filter((x) => x.issues.length);
  console.log(`dialogs ${results.length}, with issues ${bad.length}`);
  await b.close();
})();
