# تحسين الخيار C — Emerald Health: فهرس التسليمات

هذا تحسين للاتجاه المعتمد للخيار C، دون إعادة تصميم ودون تقليص النطاق الوظيفي: كل الشاشات (لوحة الإدارة 61، البوابة 16، معاينتا الجوال 17) باقية بنفس المسارات والوظائف.

## الحفاظ على النسخة الأصلية

| المرجع | الوصف |
|---|---|
| الوسم `option-c-v1-baseline` | النسخة المعتمدة قبل أي تعديل |
| الفرع `backup/option-c-v1` | نسخة احتياطية من النسخة الأصلية |
| الفرع `feature/option-c-emerald` | كل أعمال التحسين (دُمج في `main` للنشر) |
| المعاينة `/option-c-v1/` | النسخة الأصلية منشورة للمقارنة |

## التسليمات الثمانية

| # | التسليم | المكان |
|---|---|---|
| 1 | مصدر الخيار C المحدَّث | `apps/option-c/` · المحرك `packages/core/` (تحقق `route.reorder`، `reasonEn`، مصدر الموقع) |
| 2 | معاينات ويب تعمل | https://ayman482.github.io/atlas-link-prototypes/option-c/ (والأصلية في `/option-c-v1/`) — محلياً: `npm run build -w apps/option-c` ثم خدمة `apps/option-c/out` |
| 3 | تطبيقات Flutter قابلة للتشغيل (وليست HTML) | `mobile/customer_app`، `mobile/courier_app`، الحزمة المشتركة `mobile/atlas_shared` — التشغيل في `mobile/README.md` |
| 4 | مكتبة المكوّنات ورموز التصميم | [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md) · `packages/tokens/` |
| 5 | مواصفة الحركة | [MOTION_SPEC.md](MOTION_SPEC.md) |
| 6 | إصلاحات التوطين AR/EN | [LOCALIZATION_FIXES.md](LOCALIZATION_FIXES.md) · `apps/option-c/src/lib/l10n.ts` |
| 7 | تقرير الاختبار الوظيفي وإمكانية الوصول شاشة بشاشة | [TEST_REPORT.md](TEST_REPORT.md) · `audit-results.json` · `functional-checks-results.json` |
| 8 | لقطات قبل/بعد | [BEFORE_AFTER.md](BEFORE_AFTER.md) · `screenshots/before/` · `screenshots/after/` |

## إعادة إنتاج الفحوص

```bash
npm install
npm test                                   # 33 اختباراً للمحرك
npm run build -w apps/option-c             # البناء الثابت
python3 -m http.server 5057 -d apps/option-c/out &
npm i --no-save axe-core@4.14.0
BASE=http://localhost:5057 node docs/option-c-enhancement/audit.js audit.json        # axe + لوحة المفاتيح + الاتجاه
BASE=http://localhost:5057 node docs/option-c-enhancement/functional-checks.js       # المكوّنات التفاعلية
BASE=http://localhost:5057 node docs/option-c-enhancement/shots.js out-dir           # اللقطات
cd mobile/atlas_shared && flutter test     # وكذلك customer_app وcourier_app
```

## حدود معلنة

- لا حزم APK/IPA: بيئة البناء Linux دون Android SDK، وiOS يتطلب macOS. أوامر البناء في `mobile/README.md`.
- تطبيقات Flutter تحتاج خادم المحاكاة (`npm run api`) لأنها تتصل بـ API حقيقي؛ لذلك لا تُنشر على GitHub Pages (لا يوجد خادم هناك).
- الكاميرا والدفع محاكاة؛ المواقع بيانات عرض وتُعلَّم بذلك دائماً.
- لم يُختبر على قارئ شاشة حقيقي ولا على أجهزة فعلية لقياس 60 إطاراً/ث.
