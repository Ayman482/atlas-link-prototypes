// Phase 17.1 — فحص سريع للنسخة المنشورة: الدخول ← فاتورة ← عارض الفاتورة الضريبية (ورقة A4 وQR)، ونافذة المطابقة البنكية فوق الجدول
const { chromium } = require('playwright');
const B = process.env.BASE || 'https://ayman482.github.io/atlas-link-prototypes/option-c';
(async () => { const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] }); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); p.setDefaultNavigationTimeout(90000); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${B}/admin/`); await p.waitForTimeout(1500); await p.click('text=finance@medlog.demo'); await p.waitForTimeout(700); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click('button:has-text("تحقق")'); } await p.waitForTimeout(2000);
  await p.goto(`${B}/admin/#/invoices/inv_0022`); await p.reload(); await p.waitForTimeout(2500);
  await p.click('button:has-text("عرض الفاتورة الضريبية")'); await p.waitForTimeout(3000);
  const inv = await p.evaluate(() => ({ sheets: document.querySelectorAll('.inv-viewer .sheet').length, qr: !!document.querySelector('.inv-viewer .zatca img'), sim: (document.querySelector('.inv-viewer .znote')?.textContent || '').includes('محاكاة') }));
  await p.screenshot({ path: process.argv[2] || 'live.png' }); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.goto(`${B}/admin/#/payments`); await p.reload(); await p.waitForTimeout(2500);
  const rb = p.locator('main button:has-text("مطابقة بنكية")').first(); let top = null;
  if (await rb.count()) { await rb.click(); await p.waitForTimeout(800); top = await p.evaluate(() => { const d = document.querySelector('[role=dialog]'); const r = d.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { inLayer: !!d.closest('#al-layer'), centerInDialog: d.contains(e) }; }); }
  console.log(JSON.stringify({ inv, reconcile: top, errs })); await b.close(); })();
