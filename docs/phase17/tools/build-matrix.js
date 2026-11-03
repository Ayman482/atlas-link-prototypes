// يولّد جدول مصفوفة القبول لكل شاشة من أدلة التشغيل الفعلية (axe، ui-audit، click-crawl، l10n-scan، nav-check).
// الاستخدام: node build-matrix.js > ../evidence/matrix-rows.md
const fs = require('fs'); const E = __dirname + '/../evidence/';
const J = (f) => JSON.parse(fs.readFileSync(E + f, 'utf8'));
const axe = J('axe-wcag22.json'); const ui = J('ui-audit.json'); const l10n = J('l10n-scan.json');
const crawl = {}; for (const f of fs.readdirSync(E).filter((f) => /^click-crawl-.*\.json$/.test(f))) { const j = J(f); for (const r of j.results) crawl[j.app + r.route] = r; }
const src = fs.readFileSync(__dirname + '/../../option-c-enhancement/audit.js', 'utf8');
const grab = (name) => eval(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]);
const routesTs = fs.readFileSync(__dirname + '/../../../apps/option-c/src/admin/routes.ts', 'utf8');
const ids = {}; for (const m of routesTs.matchAll(/\{ id: '([A-Z0-9]+)', path: '([^']+)'/g)) ids[m[2]] = m[1];
const idFor = (app, r) => app === 'admin' ? (ids[r] ?? ids[r.replace(/\/[^/]+$/, '/:id')] ?? '') : '';
// الشاشات التي فُحصت أخطاء الزاحف فيها يدوياً وثبت أن العناصر تعمل (crawl-triage.log)
const TRIAGED = new Set(['admin/map', 'admin/system/security', 'admin/shipments/new', 'admin/legs', 'admin/lost', 'admin/contracts', 'admin/delays']);
const IGNORE_ERR = /toggle did not restore/; // مفاتيح اللغة/المظهر: سلوك متحقق منه مستقلاً (القسم 5 في سجل العيوب)
const rows = [];
for (const [app, list] of [['admin', grab('ADMIN')], ['portal', grab('PORTAL')], ['mobile/customer', grab('CM')], ['mobile/courier', grab('K')]]) {
  for (const r of list) {
    const ax = axe.filter((x) => x.app === app && x.url === `/${app}/#${r}`);
    const axv = ax.reduce((a, x) => a + x.violations.length, 0); const rtl = ax.some((x) => x.requested === 'ar' && x.dir === 'rtl'); const ltr = ax.some((x) => x.requested === 'en' && x.dir === 'ltr' && x.langApplied); const kb = ax.every((x) => x.keyboard?.ok !== false);
    const u = ui.filter((x) => x.app === app && x.route === r);
    const widths = u.map((x) => x.w).sort((a, b) => a - b);
    const overflow = u.filter((x) => x.pageOverflowX > 1).map((x) => x.w);
    const small = u.filter((x) => x.smallTargets?.length && !x.smallTargets.every((s) => s.startsWith('g.'))).map((x) => x.w);
    const markersOnly = u.some((x) => x.smallTargets?.length && x.smallTargets.every((s) => s.startsWith('g.')));
    const c = crawl[app + r]; const raw = (c?.errors ?? []).filter((e) => !IGNORE_ERR.test(e)); const errs = raw.filter((e) => !TRIAGED.has(app + r));
    const l = l10n.filter((x) => x.app === app && x.route === r); const lraw = l.reduce((a, x) => a + x.codes.filter((k) => !['tracking', 'invoice'].includes(k.token ?? k)).length, 0);
    const pass = axv === 0 && rtl && ltr && kb && !overflow.length && !small.length && errs.length === 0 && lraw === 0 && ax.length > 0;
    rows.push(`| ${idFor(app, r) || '—'} | ${app} | \`${r}\` | ${ax.length ? axv : 'غير مُشغَّل'} | ${rtl && ltr ? 'نعم' : 'لا'} | ${kb ? 'نعم' : 'لا'} | ${widths.length ? widths.join('/') : '—'} | ${overflow.length ? 'تمرير@' + overflow.join(',') : 'لا'} | ${small.length ? 'صغيرة@' + small.join(',') : markersOnly ? 'علامات الخريطة (استثناء)' : 'لا'} | ${c ? `${c.clicked}/${c.interactive}` : '—'} | ${raw.length}${raw.length && !errs.length ? ' (فُحصت: تعمل)' : ''} | ${lraw} | ${pass ? '**ناجح**' : 'مراجعة'} |`);
  }
}
console.log(rows.join('\n'));
const n = rows.length, ok = rows.filter((r) => r.includes('**ناجح**')).length; console.error('screens', n, 'pass', ok);
