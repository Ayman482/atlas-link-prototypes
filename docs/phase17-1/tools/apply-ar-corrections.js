// Phase 17.1 — تطبيق تصحيحات المراجعة العربية بدقة الزوج (العربي القديم + مقابله الإنجليزي) لا بالبحث النصي العام:
// يُستبدل النص العربي فقط حيث يظهر مقترناً بنفس النص الإنجليزي في نفس التعبير (lang === 'ar' ? … : …، E()، L()، {ar, en}، s.t()).
// هكذا لا يتأثر «إلغاء» (Cancel) عند تصحيح «إلغاء» (Revoke) إلى «إبطال».
// الاستخدام: node apply-ar-corrections.js corrections.json strings.json  (يطبع تقريراً ويكتب الملفات)
const fs = require('fs'); const path = require('path');
const [, , corrFile, stringsFile, reportFile] = process.argv;
const corr = JSON.parse(fs.readFileSync(corrFile, 'utf8'));
const strings = new Map(JSON.parse(fs.readFileSync(stringsFile, 'utf8')).map((x) => [x.ar, x]));
const ROOTS = ['apps/option-c/src', 'packages/i18n/src', 'packages/core/src', 'mobile/atlas_shared/lib', 'mobile/customer_app/lib', 'mobile/courier_app/lib'];
const files = []; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|dart)$/.test(f) && !f.endsWith('.g.dart')) files.push(p); } };
ROOTS.forEach(walk);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const report = [];
for (const c of corr) {
  const s = strings.get(c.old); const en = s?.en;
  let n = 0;
  for (const f of files) {
    let t = src[f];
    if (en !== undefined) {
      // العربي ثم الإنجليزي في نفس التعبير (حتى 60 حرفاً بينهما: «' : '»، «', '»، «', en: '»)
      const re = new RegExp(`(['"\`])${esc(c.old)}\\1(\\s*(?::|,|,\\s*en:)\\s*)(['"\`])${esc(en)}\\3`, 'g');
      t = t.replace(re, (_m, q1, mid, q2) => { n++; return `${q1}${c.new}${q1}${mid}${q2}${en}${q2}`; });
      // صيغة lang === 'en' ? 'EN' : 'AR'
      const re2 = new RegExp(`(['"\`])${esc(en)}\\1(\\s*:\\s*)(['"\`])${esc(c.old)}\\3`, 'g');
      t = t.replace(re2, (_m, q1, mid, q2) => { n++; return `${q1}${en}${q1}${mid}${q2}${c.new}${q2}`; });
    }
    if (t !== src[f]) src[f] = t;
  }
  report.push({ old: c.old, new: c.new, category: c.category, en: en ?? null, replaced: n });
}
for (const f of files) if (src[f] !== fs.readFileSync(f, 'utf8')) fs.writeFileSync(f, src[f]);
fs.writeFileSync(reportFile, JSON.stringify(report, null, 1));
console.log('corrections', report.length, 'applied', report.filter((r) => r.replaced).length, 'occurrences', report.reduce((a, r) => a + r.replaced, 0));
for (const r of report.filter((x) => !x.replaced)) console.log('NOT APPLIED:', r.old.slice(0, 60), '| en:', (r.en ?? '').slice(0, 40));
