// زاحف النقرات (Phase 17): يفتح كل شاشة في التطبيق المحدد، ويعدّ كل زر/رابط/عنصر تبويب/قائمة ظاهر وممكَّن،
// ثم ينقر كل عنصر على حدة بعد إعادة تحميل الشاشة، ويسجّل: خطأ JavaScript، خطأ console، وهل أحدث النقر أثراً مرئياً
// (تغيّر العنوان، أو نص الصفحة، أو فتح نافذة/درج/قائمة، أو تغيّر aria-expanded/aria-selected/aria-pressed، أو رسالة toast).
// الاستخدام: BASE=http://127.0.0.1:5057 APP=admin node click-crawl.js out.json
const { chromium } = require('playwright');
const fs = require('fs');
const B = process.env.BASE || 'http://127.0.0.1:5057';
const APP = process.env.APP || 'admin';
const MAX = +(process.env.MAX || 60);
const src = fs.readFileSync(__dirname + '/../../option-c-enhancement/audit.js', 'utf8');
const grab = (name) => eval(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]);
const SETS = { admin: ['admin@medlog.demo', grab('ADMIN')], portal: ['corp.admin@medlog.demo', grab('PORTAL')], 'mobile/customer': ['corp.admin@medlog.demo', grab('CM')], 'mobile/courier': ['courier1@medlog.demo', grab('K')] };
// عناصر تُستثنى لأن أثرها خارج الشاشة (تسجيل الخروج يُختبر مستقلاً، وإعادة ضبط بيانات العرض تمحو الحالة)
const SKIP = /تسجيل الخروج|Sign out|إعادة ضبط بيانات العرض|Reset demo/;
const SEL = 'button, a[href], [role=tab], [role=menuitem], [role=switch], summary, input[type=checkbox], input[type=radio], select';

(async () => {
  const [email, allRoutes] = SETS[APP];
  // SLICE=k/n يقسم الشاشات على عمليات متوازية
  const [k, n] = (process.env.SLICE || '0/1').split('/').map(Number); const routes = allRoutes.filter((_, i) => i % n === k);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const p = await ctx.newPage();
  let errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|favicon|ERR_FILE_NOT_FOUND|404/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  await p.goto(`${B}/${APP}/`); await p.waitForTimeout(900);
  await p.click(`text=${email}`); await p.waitForTimeout(500);
  const mfa = await p.$('input[maxlength="6"]'); if (mfa) { await mfa.fill('123456'); await p.click('button:has-text("تحقق")'); }
  await p.waitForTimeout(1200);
  const snap = () => p.evaluate(() => ({
    url: location.href, html: [document.documentElement.lang, document.documentElement.dir, document.documentElement.dataset.theme, document.documentElement.className].join('|'), text: (document.querySelector('main') || document.body).innerText.length + ':' + (document.querySelector('main') || document.body).innerText.slice(0, 400),
    dialogs: document.querySelectorAll('[role=dialog], dialog[open], .drawer, .modal, [role=menu], [role=listbox], .toast, .toasts > *').length,
    aria: [...document.querySelectorAll('[aria-expanded],[aria-selected],[aria-pressed],[aria-checked],input:checked')].map((e) => (e.getAttribute('aria-expanded') ?? '') + (e.getAttribute('aria-selected') ?? '') + (e.getAttribute('aria-pressed') ?? '') + (e.getAttribute('aria-checked') ?? '') + (e.checked ? 'c' : '')).join(''),
    focus: document.activeElement?.outerHTML.slice(0, 80) ?? '',
  }));
  const results = [];
  for (const r of routes) {
    const url = `${B}/${APP}/#${r}`;
    await p.goto(url); await p.waitForTimeout(900);
    const n = Math.min(await p.locator(SEL).count(), 400);
    const items = [];
    for (let i = 0; i < n; i++) {
      const el = p.locator(SEL).nth(i);
      const info = await el.evaluate((e) => {
        const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        const visible = b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden],[aria-hidden=true],nav.side:not(.open) .slinks[inert]');
        return { tag: e.tagName.toLowerCase(), label: (e.getAttribute('aria-label') || e.innerText || e.value || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 40), disabled: e.disabled || e.getAttribute('aria-disabled') === 'true', visible, inSidebar: !!e.closest('nav, .side, .sidebar, header, .mtabs, .topbar'), href: e.getAttribute('href') };
      }).catch(() => null);
      if (!info || !info.visible || info.inSidebar) continue; // عناصر التنقل العام تُختبر مرة واحدة عبر قائمة المسارات
      items.push({ i, ...info });
    }
    const page = { route: r, interactive: items.length, disabled: items.filter((x) => x.disabled).length, clicked: 0, noEffect: [], errors: [], skipped: [] };
    for (const it of items.slice(0, MAX)) {
      if (it.disabled) continue;
      if (SKIP.test(it.label)) { page.skipped.push(it.label); continue; }
      if (it.href && /^(https?:|mailto:|tel:)/.test(it.href)) { page.skipped.push('external:' + it.href.slice(0, 40)); continue; }
      await p.goto(url); await p.waitForTimeout(650);
      errs = [];
      const before = await snap();
      const el = p.locator(SEL).nth(it.i);
      try {
        if (it.tag === 'select') { const opts = await el.locator('option').count(); if (opts > 1) await el.selectOption({ index: opts - 1 }); }
        else { try { await el.click({ timeout: 2500 }); } catch { await p.waitForTimeout(800); await p.locator(SEL).nth(it.i).click({ timeout: 2500 }); } }
      } catch (e) { page.errors.push(`${it.tag} «${it.label}»: click failed ${e.message.split('\n')[0].slice(0, 80)}`); continue; }
      await p.waitForTimeout(450);
      const after = await snap();
      page.clicked++;
      if (errs.length) page.errors.push(`${it.tag} «${it.label}»: ${errs.join(' | ').slice(0, 200)}`);
      const changed = before.html !== after.html || before.url !== after.url || before.text !== after.text || before.dialogs !== after.dialogs || before.aria !== after.aria;
      if (!changed) page.noEffect.push(`${it.tag} «${it.label}»`);
      // مفاتيح اللغة والمظهر تُعاد لحالتها حتى لا تتغير فهارس العناصر في بقية الشاشة
      if (before.html !== after.html) { await p.goto(url); await p.waitForTimeout(500); const t = p.locator(SEL).nth(it.i); await t.click({ timeout: 2500 }).catch(() => {}); await p.waitForTimeout(300); const back = await snap(); if (back.html !== before.html) page.errors.push(`${it.tag} «${it.label}»: toggle did not restore (${before.html} → ${back.html})`); }
    }
    results.push(page);
    process.stdout.write(`${APP}${r}: ${page.clicked} clicked, ${page.noEffect.length} no-visible-effect, ${page.errors.length} errors\n`);
  }
  fs.writeFileSync(process.argv[2], JSON.stringify({ app: APP, base: B, executedAt: new Date().toISOString(), results }, null, 1));
  await b.close();
})();
