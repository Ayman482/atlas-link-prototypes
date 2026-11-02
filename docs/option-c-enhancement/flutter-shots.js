// لقطات تطبيقي Flutter (بناء الويب) مقابل خادم المحاكاة الحقيقي. Flutter يرسم على Canvas، لذا النقر بالإحداثيات.
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
const step = process.argv[3] || 'all';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const shoot = async (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  // تطبيق العميل
  let p = await b.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2 });
  await p.goto(process.env.BASE_C || 'http://localhost:5071'); await p.waitForTimeout(7000);
  await shoot(p, '16-flutter-customer-1-login');
  await p.mouse.click(206, 470); await p.waitForTimeout(3000);
  await p.keyboard.type('123456'); await p.keyboard.press('Enter'); await p.waitForTimeout(5000);
  await shoot(p, '16-flutter-customer-2-home');
  await p.mouse.click(206, Number(process.env.CARD_Y || 430)); await p.waitForTimeout(4000);
  await shoot(p, '16-flutter-customer-3-tracking');
  await p.close();
  // تطبيق المندوب
  p = await b.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2 });
  await p.goto(process.env.BASE_K || 'http://localhost:5072'); await p.waitForTimeout(7000);
  await p.mouse.click(206, 470); await p.waitForTimeout(5000);
  await shoot(p, '17-flutter-courier-2-tasks');
  await p.mouse.click(206, Number(process.env.TASK_Y || 330)); await p.waitForTimeout(4000);
  await shoot(p, '17-flutter-courier-3-task');
  await b.close();
})();
