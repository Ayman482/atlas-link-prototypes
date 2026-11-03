// فحص الكلمات اللاتينية الظاهرة في الواجهات العربية (Phase 17): يجمع كل كلمة لاتينية مرئية في كل شاشة عربية
// ويستبعد المعرفات (ML-2026-…, BX-…, INV-…)، والاختصارات المعتمدة في المسرد، والبريد الإلكتروني، ثم يطبع الباقي للمراجعة اليدوية.
// الاستخدام: BASE=http://127.0.0.1:5057 node latin-scan.js out.json
const { chromium } = require('playwright');
const fs = require('fs');
const B = process.env.BASE || 'http://127.0.0.1:5057';
const src = fs.readFileSync(__dirname + '/../../option-c-enhancement/audit.js', 'utf8');
const grab = (name) => eval(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]);
const SETS = [['admin', 'admin@medlog.demo', grab('ADMIN')], ['portal', 'corp.admin@medlog.demo', grab('PORTAL')], ['mobile/customer', 'corp.admin@medlog.demo', grab('CM')], ['mobile/courier', 'courier1@medlog.demo', grab('K')]];
const ALLOW = new Set(['SAR', 'QR', 'GPS', 'IoT', 'IMEI', 'SIM', 'APN', 'ZATCA', 'VAT', 'MFA', 'API', 'SSE', 'URL', 'IP', 'SKU', 'PCR', 'CAPA', 'SLA', 'ETA', 'PDPL', 'CSV', 'PDF', 'SMS', 'TCP', 'UDP', 'GPT45', 'EELINK', 'DHC', 'POD', 'KPI', 'RPO', 'RTO', 'ID', 'OK', 'UTC', 'AST', 'HL7', 'FHIR', 'JSON', 'HTTP', 'HTTPS', 'TLS', 'OTP', 'Atlas', 'Link', 'Emerald', 'Health', 'demo', 'medlog', 'SV', 'XS', 'S', 'M', 'L', 'XL', 'ACK', 'ICCID', 'Webhook', 'webhook', 'BI', 'GL', 'AR', 'AP', 'CN', 'Next', 'js', 'Flutter', 'SADAD', 'IBAN', 'SNB', 'RJHI', 'mlk', 'ptr']);
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [app, email, routes] of SETS) {
    const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
    await p.goto(`${B}/${app}/`); await p.waitForTimeout(900); await p.click(`text=${email}`); await p.waitForTimeout(500);
    const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); } await p.waitForTimeout(1200);
    for (const r of routes) {
      await p.goto(`${B}/${app}/#${r}`); await p.waitForTimeout(900);
      const txt = await p.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let s = ''; let n; while ((n = w.nextNode())) { const e = n.parentElement; if (!e || e.closest('script,style,.mono,code,[dir=ltr],input,textarea') || !e.offsetParent) continue; s += ' ' + n.textContent; } return s; });
      const words = (txt.replace(/[\w.+-]+@[\w.-]+/g, ' ').replace(/\b[A-Z]{1,5}-[\w-]+/g, ' ').match(/[A-Za-z][A-Za-z'’-]*/g) || []).filter((w) => !ALLOW.has(w) && !ALLOW.has(w.toUpperCase()));
      if (words.length) out.push({ app, route: r, words: [...new Set(words)] });
    }
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  const freq = {}; for (const o of out) for (const w of o.words) (freq[w] ||= []).push(`${o.app}${o.route}`);
  for (const [w, where] of Object.entries(freq).sort((a, b) => b[1].length - a[1].length)) console.log(w.padEnd(22), where.length, where.slice(0, 4).join(' '));
  await b.close();
})();
