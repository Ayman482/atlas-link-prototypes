// Phase 17.1 — تدقيق الجداول والمرشحات وبطاقات المؤشرات بصرياً (لا يكتفي بتجاوز الصفحة):
//  - جدول أعرض من حاويته دون تمرير أفقي متاح (overflow-x ليس auto/scroll) → أعمدة خارج الحاوية
//  - خلايا/أزرار/قيم مقصوصة: scrollWidth > clientWidth مع overflow مخفي، أو نص يتجاوز حدود عنصره الأب المرئي
//  - قيم المؤشرات (KPI): الرقم يتجاوز البطاقة أو يُقص أو يلتف داخل الرقم نفسه
//  - أزرار الإجراءات خارج حدود الخلية/الجدول المرئي
//  - المرشحات في RTL: سهم القائمة المنسدلة في جهة النهاية الصحيحة (يسار في RTL، يمين في LTR)
//  - رأس الجدول الثابت لا يعلو أي طبقة (يتحقق منه modal-audit)
//  ويحفظ لقطة لكل شاشة×عرض×لغة فيها مشكلة (وعينة من الشاشات السليمة).
// الاستخدام: BASE=… APP=admin LANGS=ar,en WIDTHS=390,768,1024,1280,1440 OUT=dir node layout-audit.js out.json
const { chromium } = require('playwright');
const fs = require('fs');
const B = process.env.BASE || 'http://127.0.0.1:5057';
const APP = process.env.APP || 'admin';
const LANGS = (process.env.LANGS || 'ar,en').split(',');
const WIDTHS = (process.env.WIDTHS || '390,768,1024,1280,1440').split(',').map(Number);
const OUT = process.env.OUT || 'shots'; const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SHOT_ALL = process.env.SHOT_ALL === '1';
const STRESS = process.env.STRESS === '1'; // يحقن مبالغ كبيرة ونصوصاً طويلة قبل القياس
const stress = () => {
  const w = document.createTreeWalker(document.querySelector('main, .phone') || document.body, NodeFilter.SHOW_TEXT); const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
  for (const t of nodes) { const v = t.textContent; if (/\d[\d,]*\.\d{2}/.test(v) && /(ر\.س|SAR)/.test(v + (t.parentElement?.parentElement?.textContent || ''))) t.textContent = v.replace(/\d[\d,]*\.\d{2}/, '12,345,678.90'); }
  // كما يفعل KpiValue عند العرض: معامل حجم الخط --k يُحسب من طول القيمة (المبلغ + رمز العملة)
  for (const kv of document.querySelectorAll('.kpi b.kv')) { const a = kv.querySelector('.amt'); if (!a) continue; const len = Math.max(4, a.textContent.trim().length + (kv.querySelector('.cur') ? 2 : 0)); kv.style.setProperty('--k', (150 / len).toFixed(2)); }
  for (const tr of document.querySelectorAll('tbody tr')) { const td = [...tr.children].find((c) => c.textContent.trim() && !/\d/.test(c.textContent) && !c.querySelector('button, input, select')); if (td) { const leaf = [...td.querySelectorAll('*')].reverse().find((e) => e.children.length === 0 && e.textContent.trim()) || td; leaf.textContent = document.documentElement.lang === 'ar' ? 'مجموعة مستشفيات الرعاية الصحية المتقدمة التخصصية — فرع الرياض الشمالي' : 'Advanced Specialized Healthcare Hospitals Group — Riyadh North Branch'; } }
};
const src = fs.readFileSync(__dirname + '/../../option-c-enhancement/audit.js', 'utf8');
const grab = (name) => eval(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]);
const SETS = { admin: ['admin@medlog.demo', grab('ADMIN')], portal: ['corp.admin@medlog.demo', grab('PORTAL')], 'mobile/customer': ['corp.admin@medlog.demo', grab('CM')], 'mobile/courier': ['courier1@medlog.demo', grab('K')] };
fs.mkdirSync(OUT, { recursive: true });

const inspect = () => {
  const out = { tablesNoScroll: [], clipped: [], kpiOverflow: [], actionsOutside: [], selectArrow: [], pageOverflowX: document.documentElement.scrollWidth - innerWidth };
  const rtl = document.documentElement.dir === 'rtl';
  const label = (e) => `${e.tagName.toLowerCase()}.${(e.className?.toString?.() || '').split(' ')[0]} «${(e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 28)}»`;
  const visibleBox = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  for (const t of document.querySelectorAll('table')) {
    if (!visibleBox(t)) continue;
    const wrap = t.parentElement; const ws = getComputedStyle(wrap);
    if (t.scrollWidth > wrap.clientWidth + 2 && !['auto', 'scroll'].includes(ws.overflowX)) out.tablesNoScroll.push(`${label(wrap)} table ${t.scrollWidth}>${wrap.clientWidth}`);
    // أزرار الإجراءات خارج المساحة المرئية للحاوية وبلا تمرير
    const wb = wrap.getBoundingClientRect();
    if (!['auto', 'scroll'].includes(ws.overflowX)) for (const btn of t.querySelectorAll('td button, td a.btn')) { const b = btn.getBoundingClientRect(); if (b.width && (b.left < wb.left - 1 || b.right > wb.right + 1)) out.actionsOutside.push(label(btn)); }
  }
  // قص النصوص: عناصر نصية نهائية overflow مخفي و scrollWidth > clientWidth (عدا عناصر بتلميح أو text-overflow مقصود مع title)
  for (const e of document.querySelectorAll('td, th, .btn, button, .kpi b, .pill, .chip, label, .field > span, .dl dd, dd')) {
    if (!visibleBox(e)) continue; const cs = getComputedStyle(e);
    if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2 && !e.title) out.clipped.push(label(e) + ` ${e.scrollWidth}>${e.clientWidth}`);
  }
  // بطاقات المؤشرات: القيمة داخل البطاقة، ولا التفاف داخل الرقم
  for (const k of document.querySelectorAll('.kpi')) {
    const v = k.querySelector('b'); if (!v || !visibleBox(v)) continue;
    const kb = k.getBoundingClientRect(); const vb = v.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(v); const rects = [...range.getClientRects()];
    const textRight = Math.max(...rects.map((r) => r.right)), textLeft = Math.min(...rects.map((r) => r.left));
    if (textRight > kb.right - 4 || textLeft < kb.left + 4 || v.scrollWidth > v.clientWidth + 2) out.kpiOverflow.push(`${(v.innerText || '').trim()} (${Math.round(textRight - textLeft)}px في ${Math.round(kb.width)}px)`);
    // التفاف داخل الرقم: أجزاء الرقم في أكثر من سطر
    const num = v.querySelector('.amt') ?? v; const nr = num.getClientRects ? [...(() => { const r = document.createRange(); r.selectNodeContents(num); return r.getClientRects(); })()] : [];
    /* سطران فعلياً فقط إذا بدأ مستطيل تحت نهاية آخر (الأحجام المختلفة على السطر نفسه لها قمم مختلفة) */ const wrapped = nr.some((a) => nr.some((c) => c.top >= a.bottom - 1)); if (num !== v && wrapped) out.kpiOverflow.push(`رقم ملتف: ${num.innerText}`);
    void vb;
  }
  // سهم القائمة المنسدلة
  for (const s of document.querySelectorAll('main select, .phone select')) {
    if (!visibleBox(s)) continue; const cs = getComputedStyle(s);
    if (cs.appearance === 'none' || cs.webkitAppearance === 'none') {
      const pos = cs.backgroundPositionX; const padStart = parseFloat(rtl ? cs.paddingLeft : cs.paddingRight);
      const arrowOnLeft = /^(0|[0-9.]+px|[0-9.]+%)?\s*$/.test(pos) && (parseFloat(pos) < 50 || pos.startsWith('left'));
      if (cs.backgroundImage !== 'none' && rtl !== arrowOnLeft) out.selectArrow.push(`${label(s)} pos=${pos}`);
      if (cs.backgroundImage !== 'none' && padStart < 24) out.selectArrow.push(`${label(s)} حشوة السهم ${padStart}px`);
    }
  }
  out.cellBleed = [];
  for (const c of document.querySelectorAll('td, th')) { if (!visibleBox(c)) continue; const cb = c.getBoundingClientRect(); for (const ch of c.querySelectorAll('*')) { const b = ch.getBoundingClientRect(); if (b.width && (b.right > cb.right + 2 || b.left < cb.left - 2)) { out.cellBleed.push(label(ch)); break; } } }
  out.cellBleed = [...new Set(out.cellBleed)].slice(0, 8);
  out.clipped = [...new Set(out.clipped)].slice(0, 12); out.actionsOutside = [...new Set(out.actionsOutside)].slice(0, 8);
  return out;
};

(async () => {
  const [email, all] = SETS[APP]; const routes = ONLY ?? all;
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] }); const results = [];
  for (const lang of LANGS) for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: w <= 430 ? 844 : w <= 800 ? 1024 : 900 } }); const p = await ctx.newPage(); p.setDefaultNavigationTimeout(90000);
    await p.goto(`${B}/${APP}/`); await p.evaluate((l) => localStorage.setItem('al-lang', l), lang); await p.reload(); await p.waitForTimeout(900);
    await p.click(`text=${email}`); await p.waitForTimeout(500); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click(lang === 'ar' ? 'button:has-text("تحقق")' : 'button:has-text("Verify")'); } await p.waitForTimeout(1300);
    for (const r of routes) {
      await p.goto(`${B}/${APP}/#${r}`); await p.reload(); await p.waitForTimeout(1200);
      if (STRESS) { await p.evaluate(stress); await p.waitForTimeout(200); }
      const ins = await p.evaluate(inspect);
      const issues = [];
      if (ins.pageOverflowX > 1) issues.push('page-overflow'); if (ins.tablesNoScroll.length) issues.push('table-no-scroll');
      if (ins.clipped.length) issues.push(`clipped:${ins.clipped.length}`); if (ins.kpiOverflow.length) issues.push(`kpi:${ins.kpiOverflow.length}`);
      if (ins.actionsOutside.length) issues.push('actions-outside'); if (ins.cellBleed.length) issues.push(`cell-bleed:${ins.cellBleed.length}`); if (ins.selectArrow.length) issues.push(`select:${ins.selectArrow.length}`);
      const shot = `${APP.replace('/', '-')}${r.replace(/[/:]/g, '_')}__${lang}_${w}${STRESS ? '_stress' : ''}.png`;
      if (issues.length || SHOT_ALL) await p.screenshot({ path: `${OUT}/${shot}`, fullPage: true });
      results.push({ app: APP, route: r, lang, w, issues, shot: issues.length || SHOT_ALL ? shot : null, ...ins });
      if (issues.length) process.stdout.write(`${APP}${r} [${lang} ${w}] ${issues.join(' ')}\n`);
    }
    await ctx.close();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(results, null, 1));
  console.log(`runs ${results.length}, with issues ${results.filter((x) => x.issues.length).length}`);
  await b.close();
})();
