// تدقيق تخطيط وتفاعل لكل شاشات الخيار C عند 390 و768 و1024 و1440px: تمرير أفقي للصفحة، عناصر خارج الشاشة،
// أهداف لمس أصغر من 24px (WCAG 2.5.8) أو 44px على الجوال، ترتيب التركيز (لا تركيز على عناصر مخفية)، وتجاوز النوافذ/الأدراج.
// الاستخدام: BASE=http://localhost:5057 APPS=admin,portal node ui-audit.js out.json
const { chromium } = require('playwright');
const B = process.env.BASE || 'http://localhost:5057';
const src = require('fs').readFileSync(__dirname + '/audit.js', 'utf8');
const grab = (name) => eval(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]);
const SETS = { admin: ['admin@medlog.demo', grab('ADMIN')], portal: ['corp.admin@medlog.demo', grab('PORTAL')], 'mobile/customer': ['corp.admin@medlog.demo', grab('CM')], 'mobile/courier': ['courier1@medlog.demo', grab('K')] };
const WIDTHS = (process.env.WIDTHS || '390,768,1024,1440').split(',').map(Number);
async function login(p, app, email) {
  await p.goto(`${B}/${app}/`); await p.waitForTimeout(900);
  await p.click(`text=${email}`); await p.waitForTimeout(500);
  const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); }
  await p.waitForTimeout(1200);
}
const measure = () => {
  const vw = innerWidth, vh = innerHeight;
  const r = { pageOverflowX: document.documentElement.scrollWidth - vw, offscreen: [], smallTargets: [], smallTouch: 0 };
  const scrollParent = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return p; } return null; };
  for (const el of document.querySelectorAll('main *, .page *, .mbodyx *, header *, .topbar *')) {
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.position === 'fixed') continue;
    if ((b.right > vw + 1 || b.left < -1) && !scrollParent(el) && !el.closest('.sidecard, [aria-hidden="true"], .scrim')) r.offscreen.push((el.className?.toString?.() || el.tagName).slice(0, 40));
  }
  for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=tab], [tabindex="0"]')) {
    const b = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (!b.width || !b.height || s.visibility === 'hidden' || el.closest('.sidecard:not(.open)')) continue;
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p, td, li, dd, span')) continue; // روابط داخل النص مستثناة في WCAG 2.5.8
    if (b.width < 24 || b.height < 24) r.smallTargets.push(`${el.tagName.toLowerCase()}.${(el.className?.toString?.() || '').split(' ')[0]} ${Math.round(b.width)}x${Math.round(b.height)} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}»`);
    if (vw <= 430 && (b.width < 44 || b.height < 44) && !el.closest('td, .tabs, .legend, figcaption')) r.smallTouch++;
  }
  r.offscreen = [...new Set(r.offscreen)].slice(0, 6); r.smallTargets = [...new Set(r.smallTargets)].slice(0, 8);
  return r;
};
async function focusWalk(p) {
  // 25 ضغطة Tab: يجب أن يكون كل عنصر مركَّز مرئياً داخل الشاشة (لا تركيز على قائمة مخفية خارج الشاشة)
  await p.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  const hidden = [];
  for (let i = 0; i < 25; i++) {
    await p.keyboard.press('Tab');
    const f = await p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; a.scrollIntoView?.({ block: 'nearest' }); const b = a.getBoundingClientRect(); const s = getComputedStyle(a); let vis = s.visibility !== 'hidden' && b.width > 0 && b.height > 0 && b.right > 0 && b.left < innerWidth; for (let e = a; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) vis = false; const t = cs.transform; if (t && t !== 'none' && e.classList?.contains('sidecard') && !e.classList.contains('open') && innerWidth <= 1050) vis = false; } return { vis, d: `${a.tagName.toLowerCase()}.${(a.className?.toString?.() || '').split(' ')[0]} «${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 18)}»` }; });
    if (f && !f.vis) hidden.push(f.d);
  }
  return [...new Set(hidden)].slice(0, 5);
}
(async () => {
  const b = await chromium.launch(); const out = [];
  const apps = (process.env.APPS || Object.keys(SETS).join(',')).split(',');
  for (const app of apps) {
    const [email, routes] = SETS[app];
    for (const w of WIDTHS) {
      if (app.startsWith('mobile') && w > 768) continue; // معاينات الجوال: إطار هاتف ثابت
      const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 } }); const p = await ctx.newPage();
      await login(p, app, email);
      for (const r of routes) {
        await p.goto(`${B}/${app}/#${r}`); await p.waitForTimeout(900);
        const m = await p.evaluate(measure);
        const hiddenFocus = (w === 390 || w === 1440) ? await focusWalk(p) : [];
        out.push({ app, route: r, w, ...m, hiddenFocus });
      }
      // النوافذ والأدراج: لوحة البحث ومركز الإشعارات يجب أن تتسع داخل الشاشة
      if (app === 'admin') {
        await p.goto(`${B}/admin/#/`); await p.waitForTimeout(900);
        await p.keyboard.press('Control+k'); await p.waitForTimeout(500);
        const modal = await p.evaluate(() => { const m = document.querySelector('[role=dialog]'); if (!m) return null; const b = m.getBoundingClientRect(); return { fits: b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1, w: Math.round(b.width), h: Math.round(b.height), vh: innerHeight }; });
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
        await p.click('button[aria-label^="الإشعارات"]').catch(() => {}); await p.waitForTimeout(600);
        const drawer = await p.evaluate(() => { const d = document.querySelector('.drawer'); if (!d) return null; const b = d.getBoundingClientRect(); const body = d.querySelector('.drawerbody'); return { fits: b.left >= -1 && b.right <= innerWidth + 1, w: Math.round(b.width), bodyScrolls: body ? getComputedStyle(body).overflowY : null, focusInside: d.contains(document.activeElement) }; });
        out.push({ app, route: '(cmdk+drawer)', w, modal, drawer });
      }
      await ctx.close();
    }
  }
  require('fs').writeFileSync(process.argv[2] || 'ui-audit.json', JSON.stringify(out, null, 1));
  const bad = out.filter((x) => x.pageOverflowX > 1 || x.offscreen?.length || x.hiddenFocus?.length || x.smallTargets?.length || (x.modal && !x.modal.fits) || (x.drawer && !x.drawer.fits));
  console.log('runs', out.length, 'with findings', bad.length);
  for (const x of bad) console.log(`${x.app}${x.route} @${x.w}`, x.pageOverflowX > 1 ? `overflowX=${x.pageOverflowX}` : '', x.offscreen?.length ? 'offscreen=' + x.offscreen.join('|') : '', x.hiddenFocus?.length ? 'hiddenFocus=' + x.hiddenFocus.join('|') : '', x.smallTargets?.length ? 'small=' + x.smallTargets.join('|') : '', x.modal ? JSON.stringify(x.modal) : '', x.drawer ? JSON.stringify(x.drawer) : '');
  await b.close();
})();
