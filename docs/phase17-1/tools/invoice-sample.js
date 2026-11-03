// Phase 17.1 — يولّد ملفات PDF عينة من زر «تنزيل PDF» في العارض نفسه (الإدارة) لفاتورة محددة باللغتين، مع لقطة لكل صفحة.
// الاستخدام: BASE=… OUT=dir INV=inv_0022 node invoice-sample.js
const { chromium } = require('playwright'); const fs = require('fs');
const B = process.env.BASE || 'http://127.0.0.1:5057'; const OUT = process.env.OUT || 'invoice'; const INV = process.env.INV || 'inv_0022';
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  for (const lang of ['ar', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); const p = await ctx.newPage(); p.setDefaultNavigationTimeout(90000);
    await p.goto(`${B}/admin/`); await p.evaluate((l) => localStorage.setItem('al-lang', l), lang); await p.reload(); await p.waitForTimeout(900);
    await p.click('text=finance@medlog.demo'); await p.waitForTimeout(500); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click(lang === 'ar' ? 'button:has-text("تحقق")' : 'button:has-text("Verify")'); } await p.waitForTimeout(1300);
    await p.goto(`${B}/admin/#/invoices/${INV}`); await p.reload(); await p.waitForTimeout(1500);
    await p.click(lang === 'ar' ? 'button:has-text("عرض الفاتورة الضريبية")' : 'button:has-text("View tax invoice")'); await p.waitForTimeout(2500);
    const sheets = await p.locator('.inv-viewer .sheet').count();
    for (let i = 0; i < sheets; i++) await p.locator('.inv-viewer .sheet').nth(i).screenshot({ path: `${OUT}/sheet_${INV}_${lang}_p${i + 1}.png` });
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), p.click(lang === 'ar' ? 'button:has-text("تنزيل PDF")' : 'button:has-text("Download PDF")')]);
    const f = `${OUT}/${dl.suggestedFilename().replace('.pdf', `_${lang}.pdf`)}`; await dl.saveAs(f);
    console.log(lang, 'sheets', sheets, f, fs.statSync(f).size);
    await ctx.close();
  }
  await b.close();
})();
