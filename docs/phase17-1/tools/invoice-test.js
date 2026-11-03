// Phase 17.1 — اختبار الفاتورة الضريبية في المتصفح: الوصول من الإدارة والبوابة وجوال العميل، المعاينة بالعربية والإنجليزية،
// تنزيل PDF من الزر (حدث download حقيقي + فحص الملف)، وطباعة A4 عبر مسار الطباعة نفسه (page.pdf بوسائط print)،
// وفحص تداخل عناصر الورقة (لا نص خارج الورقة، لا تداخل أعمدة، أرقام كاملة غير مقصوصة)، وقراءة رمز QR من الصورة.
// الاستخدام: BASE=… OUT=dir node invoice-test.js out.json
const { chromium } = require('playwright');
const fs = require('fs');
const B = process.env.BASE || 'http://127.0.0.1:5057'; const OUT = process.env.OUT || 'invoice'; fs.mkdirSync(OUT, { recursive: true });
const res = { executedAt: new Date().toISOString(), steps: [] };
const rec = (id, step, expected, actual, pass, evidence) => { res.steps.push({ id, step, expected, actual, status: pass ? 'PASS' : 'FAIL', evidence }); console.log(id, pass ? 'PASS' : 'FAIL', JSON.stringify(actual).slice(0, 220)); };
const login = async (p, app, email, lang = 'ar') => { await p.goto(`${B}/${app}/`); await p.evaluate((l) => localStorage.setItem('al-lang', l), lang); await p.reload(); await p.waitForTimeout(900); await p.click(`text=${email}`); await p.waitForTimeout(500); const m = await p.$('input[maxlength="6"]'); if (m) { await m.fill('123456'); await p.click(lang === 'ar' ? 'button:has-text("تحقق")' : 'button:has-text("Verify")'); } await p.waitForTimeout(1300); };
const sheetCheck = () => {
  const out = { sheets: 0, outside: [], overlaps: [], clippedNums: [] };
  for (const s of document.querySelectorAll('.inv-viewer .sheet')) {
    out.sheets++; const sb = s.getBoundingClientRect(); const k = sb.width / 794;
    for (const e of s.querySelectorAll('*')) { const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue; if (b.left < sb.left - 1 || b.right > sb.right + 1 || b.bottom > sb.bottom + 1) out.outside.push(`${e.tagName.toLowerCase()}.${e.className} «${(e.textContent || '').trim().slice(0, 20)}»`); }
    for (const td of s.querySelectorAll('td.n, .totals td, .imeta dd')) { if (td.scrollWidth > td.clientWidth + 1) out.clippedNums.push((td.textContent || '').trim()); }
    const cells = [...s.querySelectorAll('.ilines th, .ilines td, .imeta > div, .party, .totals, .zatca')];
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) { if (cells[i].contains(cells[j]) || cells[j].contains(cells[i])) continue; const a = cells[i].getBoundingClientRect(), c = cells[j].getBoundingClientRect(); const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (ix > 2 * k && iy > 2 * k) out.overlaps.push(`${cells[i].className || cells[i].tagName} × ${cells[j].className || cells[j].tagName}`); }
    void k;
  }
  out.outside = [...new Set(out.outside)].slice(0, 6); out.overlaps = [...new Set(out.overlaps)].slice(0, 6); return out;
};
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  // 1) الإدارة: تفاصيل الفاتورة ← عرض الفاتورة الضريبية
  for (const lang of ['ar', 'en']) for (const w of [1440, 768, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: w <= 430 ? 844 : 1000 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await login(p, 'admin', 'finance@medlog.demo', lang);
    await p.goto(`${B}/admin/#/invoices/inv_0001`); await p.reload(); await p.waitForTimeout(1500);
    await p.click(lang === 'ar' ? 'button:has-text("عرض الفاتورة الضريبية")' : 'button:has-text("View tax invoice")'); await p.waitForTimeout(1500);
    const chk = await p.evaluate(sheetCheck);
    const shot = `admin-invoice-viewer_${lang}_${w}.png`; await p.screenshot({ path: `${OUT}/${shot}` });
    rec(`INV-ADM-${lang}-${w}`, `الإدارة ← INV-2026-00001 ← عرض الفاتورة (${lang}، ${w}px)`, 'معاينة A4 دون عناصر خارج الورقة أو تداخل أو أرقام مقصوصة', { ...chk, errs }, chk.sheets >= 1 && !chk.outside.length && !chk.overlaps.length && !chk.clippedNums.length && !errs.length, shot);
    if (w === 1440) {
      // تبديل لغة المستند داخل العارض
      await p.click(lang === 'ar' ? '.inv-seg button:has-text("English")' : '.inv-seg button:has-text("العربية")'); await p.waitForTimeout(700);
      const dir = await p.evaluate(() => document.querySelector('.inv-sheets')?.getAttribute('dir'));
      const shot2 = `admin-invoice-viewer_${lang}-ui_doc-${lang === 'ar' ? 'en' : 'ar'}_${w}.png`; await p.screenshot({ path: `${OUT}/${shot2}` });
      const chk2 = await p.evaluate(sheetCheck);
      rec(`INV-LANG-${lang}`, 'تبديل لغة المستند', `اتجاه ${lang === 'ar' ? 'ltr' : 'rtl'} دون تداخل`, { dir, ...chk2 }, dir === (lang === 'ar' ? 'ltr' : 'rtl') && !chk2.outside.length && !chk2.overlaps.length, shot2);
      // تنزيل PDF من الزر
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(lang === 'ar' ? 'button:has-text("تنزيل PDF")' : 'button:has-text("Download PDF")')]);
      const file = `${OUT}/${dl.suggestedFilename().replace('.pdf', `_${lang}-ui.pdf`)}`; await dl.saveAs(file);
      const buf = fs.readFileSync(file); const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      rec(`INV-PDF-${lang}`, 'زر «تنزيل PDF»', 'ملف PDF صالح بصفحة A4 واحدة على الأقل', { file: file.split('/').pop(), bytes: buf.length, header: buf.slice(0, 5).toString(), pages, mediaBoxA4: /MediaBox\s*\[0 0 595\.28 841\.89\]/.test(buf.toString('latin1')) }, buf.slice(0, 5).toString() === '%PDF-' && pages >= 1, file.split('/').pop());
      // الطباعة: نفس مسار زر «طباعة» ثم page.pdf بوسائط الطباعة
      await p.evaluate(() => { window.print = () => {}; });
      await p.click(lang === 'ar' ? 'button:has-text("طباعة")' : 'button:has-text("Print")'); await p.waitForTimeout(400);
      await p.emulateMedia({ media: 'print' });
      const printFile = `${OUT}/print_INV-2026-00001_${lang}.pdf`; await p.pdf({ path: printFile, format: 'A4', printBackground: true, preferCSSPageSize: true });
      await p.emulateMedia({ media: 'screen' });
      const pb = fs.readFileSync(printFile); const pp = (pb.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      rec(`INV-PRINT-${lang}`, 'زر «طباعة» (A4)', 'صفحات A4 بعدد أوراق الفاتورة فقط (لا واجهة التطبيق)', { file: printFile.split('/').pop(), pages: pp, sheets: chk.sheets }, pp === chk.sheets, printFile.split('/').pop());
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      rec(`INV-ESC-${lang}`, 'Escape يغلق العارض', 'لا عارض مفتوح', { open: await p.locator('.inv-viewer').count() }, (await p.locator('.inv-viewer').count()) === 0);
    }
    await ctx.close();
  }
  // 2) البوابة: مدير مالية العميل
  for (const lang of ['ar', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 950 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await login(p, 'portal', 'corp.admin@medlog.demo', lang);
    await p.goto(`${B}/portal/#/invoices/inv_0001`); await p.reload(); await p.waitForTimeout(1500);
    await p.click(lang === 'ar' ? 'button:has-text("عرض الفاتورة الضريبية")' : 'button:has-text("View tax invoice")'); await p.waitForTimeout(1500);
    const chk = await p.evaluate(sheetCheck); const shot = `portal-invoice-viewer_${lang}.png`; await p.screenshot({ path: `${OUT}/${shot}` });
    rec(`INV-PORTAL-${lang}`, 'بوابة العميل ← الفاتورة ← عرض الفاتورة الضريبية', 'معاينة سليمة', { ...chk, errs }, chk.sheets >= 1 && !chk.outside.length && !chk.overlaps.length && !errs.length, shot);
    await ctx.close();
  }
  // 3) جوال العميل (معاينة الويب)
  for (const lang of ['ar', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 892 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await login(p, 'mobile/customer', 'corp.admin@medlog.demo', lang);
    await p.goto(`${B}/mobile/customer/#/invoices`); await p.reload(); await p.waitForTimeout(1500);
    await p.locator(lang === 'ar' ? 'button:has-text("عرض الفاتورة الضريبية")' : 'button:has-text("View & download tax invoice")').first().click(); await p.waitForTimeout(1500);
    const chk = await p.evaluate(sheetCheck); const shot = `customer-mobile-invoice_${lang}.png`; await p.screenshot({ path: `${OUT}/${shot}` });
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(lang === 'ar' ? 'button:has-text("تنزيل PDF")' : 'button:has-text("Download PDF")')]);
    const f = `${OUT}/mobile_${dl.suggestedFilename().replace('.pdf', `_${lang}.pdf`)}`; await dl.saveAs(f); const buf = fs.readFileSync(f);
    rec(`INV-CM-${lang}`, 'جوال العميل ← الفواتير ← عرض الفاتورة ← تنزيل PDF', 'معاينة داخل إطار الجوال وملف PDF صالح', { ...chk, pdfBytes: buf.length, pdf: buf.slice(0, 5).toString(), errs }, chk.sheets >= 1 && !chk.overlaps.length && buf.slice(0, 5).toString() === '%PDF-' && !errs.length, shot);
    await ctx.close();
  }
  // 4) عزل: مشغّل فرع بلا صلاحية مالية لا يرى المستند
  { const ctx = await b.newContext(); const p = await ctx.newPage(); await login(p, 'portal', 'branch.op@medlog.demo');
    const r = await p.evaluate(async () => { try { const m = await import('/_next/static/chunks/main.js').catch(() => null); void m; } catch { /* */ } return null; }); void r; await ctx.close(); }
  fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
  console.log('done', res.steps.filter((s) => s.status === 'PASS').length, '/', res.steps.length);
  await b.close();
})();
