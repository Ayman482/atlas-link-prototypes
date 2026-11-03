# Phase 17 — التثبيت النهائي واختبار القبول وتجميد التصميم

## المستندات الثمانية
1. [FINAL_UAT_REPORT.md](FINAL_UAT_REPORT.md) — النتيجة النهائية، السيناريوهات الاثنا عشر، تقييم معايير التجميد، التوصية.
2. [UI_UX_ACCEPTANCE_MATRIX.md](UI_UX_ACCEPTANCE_MATRIX.md) — حكم لكل شاشة من الـ94 مولّد من الأدلة.
3. [AR_EN_LOCALIZATION_AUDIT.md](AR_EN_LOCALIZATION_AUDIT.md) — التدقيق والمسرد الموحد (63 مصطلحاً).
4. [SECURITY_AND_OFFLINE_TEST_REPORT.md](SECURITY_AND_OFFLINE_TEST_REPORT.md)
5. [BUG_FIX_REGISTER.md](BUG_FIX_REGISTER.md) — 27 عيباً مُصلحاً + عيب أداة، المخاطر، غير المختبر.
6. [DESIGN_SYSTEM_V1.0.md](DESIGN_SYSTEM_V1.0.md)
7. [REQUIREMENTS_TRACEABILITY_MATRIX.md](REQUIREMENTS_TRACEABILITY_MATRIX.md)
8. [PRODUCTION_DEVELOPMENT_READINESS.md](PRODUCTION_DEVELOPMENT_READINESS.md)

## العيوب غير المحلولة والقيود
لا توجد عيوب متحقق منها مفتوحة. القيود: لا اختبار على أجهزة Android/iOS؛ نصوص بيانات العرض داخل حزمة الويب الإنتاجية دون مسار تشغيل (R-SEC-01)؛ لا مزوّد هوية حقيقي؛ طابور المندوب غير مشفر؛ علامات الخريطة < 24px (استثناء موثق)؛ قارئ الشاشة ومعدل الإطارات لم يُقاسا؛ لا مراجعة لغوية بشرية؛ الخادم والتخزين والقياس والفواتير محاكاة. التفاصيل في `BUG_FIX_REGISTER.md` §2–4.

## إعادة تشغيل الأدلة
```bash
npm test                                   # 101 اختبار، منها tests/business-scenarios.test.ts → evidence/business-scenarios.json
cd apps/option-c && npx next build && npx serve out -l 5057   # أو أي خادم ملفات ثابتة
export BASE=http://127.0.0.1:5057
node docs/option-c-enhancement/audit.js evidence/axe.json       # يتطلب axe-core@4.14
node docs/option-c-enhancement/ui-audit.js evidence/ui.json
node docs/option-c-enhancement/l10n-scan.js evidence/l10n.json
node docs/phase17/tools/click-crawl.js evidence/crawl.json        # APP=admin|portal|mobile/customer|mobile/courier, SLICE=k/n
node docs/phase17/tools/nav-check.js evidence/nav.json
node docs/phase17/tools/browser-scenarios.js evidence/shots evidence/bs.json
node docs/phase17/tools/latin-scan.js evidence/latin.json
node docs/phase17/tools/build-matrix.js > evidence/matrix-rows.md
# بناء الإنتاج: NEXT_PUBLIC_MEDLOG_MODE=production NEXT_PUBLIC_MEDLOG_API=https://… npx next build ثم PROD_BASE=… node docs/phase17/tools/prod-web-check.js
```
