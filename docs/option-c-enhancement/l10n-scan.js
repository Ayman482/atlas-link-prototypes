// فحص التوطين في المتصفح لكل شاشات الخيار C (مع فتح كل تبويب): رموز تقنية خام ظاهرة، نص عربي داخل الواجهة الإنجليزية،
// وسياقات «تعذّر التسليم» خارج حالات الشحنة. الاستخدام: BASE=http://localhost:5057 node l10n-scan.js out.json
const { chromium } = require('playwright');
const B = process.env.BASE || 'http://localhost:5057';
const src = require('fs').readFileSync(__dirname + '/audit.js', 'utf8');
const grab = (name) => eval(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]);
const ADMIN = grab('ADMIN'), PORTAL = grab('PORTAL'), CM = grab('CM'), K = grab('K');
async function login(p, app, email) {
  await p.goto(`${B}/${app}/`); await p.waitForTimeout(900);
  await p.click(`text=${email}`); await p.waitForTimeout(500);
  const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); }
  await p.waitForTimeout(1200);
}
const scanPage = () => {
  const out = { codes: [], arInEn: [], failedCtx: [] };
  const lang = document.documentElement.lang;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0; };
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement; const t = n.nodeValue.trim(); if (!t || !el || !visible(el)) continue;
    if (el.closest('code, kbd, .mono, input, textarea, [data-raw], .toasts')) continue;
    // رموز تقنية: snake_case أو كلمات إنجليزية صغيرة داخل الواجهة العربية
    const snake = [...(t.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? []), ...(t.match(/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/g) ?? [])];
    for (const s of snake) out.codes.push({ token: s, text: t.slice(0, 80), cls: el.className?.toString?.().slice(0, 40) });
    if (lang === 'ar') { const words = t.match(/(?<![\w@./-])[a-z]{4,}(?![\w@./-])/g) ?? []; for (const w of words) if (!/^(https|http|json|true|false)$/.test(w)) out.codes.push({ token: w, text: t.slice(0, 80), cls: el.className?.toString?.().slice(0, 40) }); }
    if (lang === 'en' && /[؀-ۿ]/.test(t) && !el.closest('[lang="ar"], .bilingual')) out.arInEn.push({ text: t.slice(0, 80), cls: el.className?.toString?.().slice(0, 40) });
    if (t === 'تعذّر التسليم' || t === 'Delivery failed') { const sec = el.closest('section, .card, .mcard, figure'); const h = sec?.querySelector('h2, h3, b')?.textContent?.trim().slice(0, 40); out.failedCtx.push(h ?? '(?)'); }
  }
  return out;
};
(async () => {
  const b = await chromium.launch(); const results = [];
  const run = async (app, email, routes, langs) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
    await login(p, app, email);
    for (const lang of langs) {
      await p.evaluate((l) => localStorage.setItem('al-lang', l), lang);
      for (const r of routes) {
        await p.goto(`${B}/${app}/#${r}`); await p.waitForTimeout(1100);
        const agg = { codes: [], arInEn: [], failedCtx: [] };
        const add = (x) => { for (const k of Object.keys(agg)) agg[k].push(...x[k]); };
        add(await p.evaluate(scanPage));
        const tabs = await p.$$('[role=tab]');
        for (let i = 1; i < tabs.length; i++) { try { await tabs[i].click(); await p.waitForTimeout(350); add(await p.evaluate(scanPage)); } catch { /* */ } }
        const uniq = (arr, key) => [...new Map(arr.map((x) => [key(x), x])).values()];
        results.push({ app, route: r, lang, codes: uniq(agg.codes, (x) => x.token), arInEn: uniq(agg.arInEn, (x) => x.text), failedCtx: [...new Set(agg.failedCtx)] });
      }
    }
    await ctx.close();
  };
  await run('admin', 'admin@medlog.demo', ADMIN, ['ar', 'en']);
  await run('portal', 'corp.admin@medlog.demo', PORTAL, ['ar', 'en']);
  await run('mobile/customer', 'corp.admin@medlog.demo', CM, ['ar', 'en']);
  await run('mobile/courier', 'courier1@medlog.demo', K, ['ar', 'en']);
  require('fs').writeFileSync(process.argv[2] || 'l10n-scan.json', JSON.stringify(results, null, 1));
  const codes = new Map(); for (const r of results) for (const c of r.codes) if (!codes.has(c.token)) codes.set(c.token, `${r.app}${r.route} [${r.lang}] «${c.text}»`);
  console.log('screens', results.length, 'distinct raw tokens', codes.size);
  for (const [k, v] of codes) console.log(' ', k, '→', v);
  const ar = results.filter((r) => r.arInEn.length); console.log('EN screens with Arabic text:', ar.length);
  for (const r of ar.slice(0, 40)) console.log(' ', r.app + r.route, r.arInEn.slice(0, 3).map((x) => x.text).join(' | '));
  console.log('failed-label contexts:', [...new Set(results.flatMap((r) => r.failedCtx.map((c) => r.app + r.route + ' :: ' + c)))].join('\n  '));
  await b.close();
})();
