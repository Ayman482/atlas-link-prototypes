# تقرير اختبارات الانحدار — الخيار C

البيئة: Linux، Node 22، Chromium + Playwright، Flutter 3.47.7. التاريخ: 2 نوفمبر 2026. الفرع: `fix/option-c-remediation`.

## 1. الأوامر والنتائج

| # | الأمر | ما يختبره | النتيجة |
|---|---|---|---|
| 1 | `npm test` | كل اختبارات المحرك والخادم والويب (9 ملفات) | **68/68 ناجحة** |
| 1.1 | `tests/api.test.ts` | الدخول وMFA، الإنشاء عبر HTTP وSSE، الاستمرارية بعد إعادة التشغيل، OpenAPI | 3/3 |
| 1.2 | `tests/scenarios.test.ts` | سيناريوهات العرض الكاملة | 11/11 |
| 1.3 | `tests/uat.test.ts` | UAT-001…015 + Idempotency + المزامنة + فصل المهام | 18/18 |
| 1.4 | `tests/routes.test.ts` | تحقق إعادة ترتيب المسار | 1/1 |
| 1.5 | `tests/useq.test.ts` **(جديد)** | عزل الحسابات وحالات البيانات وتبديل اللغة (React داخل jsdom) | 8/8 |
| 1.6 | `tests/security.test.ts` **(جديد)** | CORS، تزوير الرمز، الدخول السريع، قفل MFA، الرمز في الرابط، الجلسات، المدخلات، عزل المؤسسة/الفرع، انتهاء الجلسة | 9/9 |
| 1.7 | `tests/offline.test.ts` **(جديد)** | المزامنة دون اتصال في المحرك | 5/5 |
| 1.8 | `tests/l10n.test.ts` **(جديد)** | المصدر المعتمد للتوطين وتطابق Flutter | 7/7 |
| 1.9 | `tests/workflows.test.ts` **(جديد)** | مسح QR، الجوي، الجهاز المنقطع، الفوترة، التنبيه الحرج | 6/6 |
| 2 | `cd mobile/atlas_shared && flutter analyze && flutter test` | الحزمة المشتركة | تحليل نظيف، **8/8** |
| 3 | `cd mobile/customer_app && flutter analyze && flutter test` | تطبيق العميل | تحليل نظيف، **3/3** |
| 4 | `cd mobile/courier_app && flutter analyze && flutter test` | تطبيق المندوب + `offline_queue_test.dart` **(جديد، 6)** | تحليل نظيف، **8/8** + 1 متخطى (اختبار العقد الحي يحتاج `LIVE_API`) |
| 5 | `LIVE_API=http://localhost:4000/api/v1 flutter test test/live_api_test.dart` | رحلة مندوب كاملة عبر الخادم الحقيقي بعد تقوية الأمن | **1/1** |
| 6 | `flutter build web --release --no-web-resources-cdn --dart-define=API_BASE=…` | بناء التطبيقين | ناجح لكليهما |
| 7 | لقطات Flutter Web مقابل الخادم (`flutter-shots.js`) | التطبيقان يعملان مع CORS الجديد (أصل `localhost:5071/5072`) | ناجح: الدخول، المهام، التتبع، الخط الزمني مترجم |
| 8 | `npm run build -w apps/option-c` + `npx tsc --noEmit` | بناء الويب والأنواع | ناجح |
| 9 | `BASE=… node docs/option-c-enhancement/audit.js` | axe WCAG 2.2 AA + تركيز + اتجاه | **195 تشغيلاً، 0 مخالفات**، 0 أخطاء تحميل، RTL/LTR صحيحان |
| 10 | `BASE=… node docs/option-c-enhancement/ui-audit.js` | التخطيط والتركيز والأهداف عند 390/768/1024/1440 | 346 تشغيلاً: 0 تمرير أفقي، 0 تركيز مخفي، 11 هدفاً صغيراً ضمن الاستثناءات |
| 11 | `BASE=… node docs/option-c-enhancement/l10n-scan.js` | رموز خام ونص عربي في الإنجليزية | 188 تشغيلاً: 4 رموز متبقية مقصودة، 0 عربي في الإنجليزية |
| 12 | `BASE=… node docs/option-c-enhancement/functional-checks.js` | المكوّنات التفاعلية | كلها ناجحة (التفاصيل في §3) |
| 13 | `e2e-flows.js` (رحلات شاملة في المتصفح) | فاتورة البوابة، رحلة المندوب، شريط الانقطاع، إنشاء شحنة من جوال العميل، تبديل الاتجاه، شاشة المختبر | ناجحة؛ «غير متاح لدورك» في فواتير جوال العميل لمشغّل الفرع متوقع |

## 2. الإخفاقات (قبل الإصلاح) — الدليل على العيوب

| الاختبار | على الكود الأصلي | بعد الإصلاح |
|---|---|---|
| `useq.test.ts` | **5 من 7 فشلت**: تبديل الحساب (تسرب بيانات فرع آخر)، التبديل المباشر (`me` سابق)، الاستعلام المعطّل (نتائج قديمة)، تغيير المعاملات (شحنة سابقة)، خروج عند خطأ شبكة. نجح: حالات الخطأ والفراغ، والرد المتأخر | 8/8 |
| `security.test.ts` | **7 من 9 فشلت**: CORS، الدخول السريع، قفل MFA، الرمز في الرابط، الجلسات، المدخلات، انتهاء الجلسة. نجح عزل المؤسسة/الفرع. اختبار التزوير نجح على الأصلي فقط لأن الاختبار ضبط المفتاح فارغاً، فأُصلح ليشغّل الخادم دون ضبطه؛ وأثبت فحص HTTP المنفصل قبول الرمز المزوّر (200) | 9/9 |
| `offline.test.ts` | **2 من 5 فشلت**: سجل محاولة وهمي بعد التعارض، وتعارض مكرر عند إعادة الإرسال | 5/5 |
| `courier_app/test/app_test.dart` | فشل بعد تغيير الطابور (الاختبار القديم يفترض طابوراً بلا مستخدم) — حُدّث ليمثّل السلوك الصحيح | ناجح |
| `audit.js` | أثناء العمل: 4 مخالفات `button-name` (زر البحث عند 390px بعد إخفاء نصه) — تراجع أدخله إصلاح U1 | 0 |
| `ui-audit.js` | أثناء العمل: تمرير 3px عند 768px أدخلته قاعدة `min-width: 0` عامة — ضُيّقت على حقل البحث | 0 |

## 3. التغطية حسب المجالات المطلوبة

| المجال المطلوب | الاختبارات |
|---|---|
| إنشاء الشحنة ودورة حياتها | `uat.test.ts` UAT-003 (إنشاء ← إسناد ← مسح ← استلام ← تسليم بإثبات)، `api.test.ts` (إنشاء عبر HTTP وIdempotency)، `e2e-flows.js` (إنشاء من جوال العميل وبوابة)، `functional-checks.js` (تحقق المعالج) |
| مسح QR وإسناد الصندوق | `workflows.test.ts` (صندوق مجهول، صندوق غير المسند، معبأة مسبقاً، شحنة مندوب آخر)، UAT-007 (صندوق غير جاهز)، `functional-checks.js` و`app_test.dart` (فشل وإعادة محاولة في الواجهة) |
| مراقبة سلسلة التبريد والتنبيهات | UAT-004، UAT-005، `workflows.test.ts` (التنبيه الحرج، الإقرار، الصلاحية)، `functional-checks.js` (الإقرار الجماعي يخفي الشريط الحرج، المنحنى) |
| النقل البري والجوي | UAT-006 (جوي بلا GPS)، `workflows.test.ts` (الناقل الجوي إلزامي، لا موقع حي أثناء الطيران)، `routes.test.ts` |
| قيود العميل والفرع | UAT-001، UAT-002، UAT-014، `security.test.ts` (فرع آخر 404، فرع المشاهدة قراءة فقط، مؤسسة أخرى 404، لا فواتير لمشغّل الفرع)، `useq.test.ts` (لا تسرب بين الحسابات في الواجهة) |
| الفوترة والمحاسبة والتسويات | UAT-010، UAT-011، UAT-012، «فصل المهام والفوترة»، `workflows.test.ts` (كل القيود متوازنة، المسودات مخفية عن العميل) |
| المزامنة دون اتصال للمندوب | `offline.test.ts` (المحرك)، `offline_queue_test.dart` (Flutter)، UAT-005، `e2e-flows.js` (شريط الانقطاع في المعاينة) |
| تبديل العربية/الإنجليزية | `useq.test.ts` (الاتجاه واللغة والمصطلحات والحفظ)، `l10n.test.ts`، `audit.js` (كل الشاشات باللغتين)، `l10n-scan.js` |
| تطبيقا Flutter | `flutter test` (19 ناجحاً + اختبار حي)، `flutter analyze`، بناء الويب، لقطات مقابل الخادم |

## 4. ما لا تغطيه هذه الاختبارات

| البند | السبب |
|---|---|
| قارئ شاشة فعلي، وأجهزة لمس فعلية، وقياس 60 إطاراً | غير متاحة في هذه البيئة |
| APK/IPA وتشغيل Flutter على Android/iOS | لا Android SDK، وiOS يحتاج macOS |
| مستمع حالة الشبكة من نظام التشغيل في Flutter (F7) | غير منفّذ؛ التحويل للطابور يحدث عند فشل الطلب |
| مراجعة لغوية بشرية متخصصة للمصطلحات السريرية | توصية قبل الاعتماد النهائي |
| تغطية كل الشاشات الـ94 بفحص يدوي عند كل عرض | الفحص الآلي غطاها جميعاً، والمراجعة البصرية شملت عينة |

## 5. إعادة التشغيل

```bash
npm install
npm test
npm run build -w apps/option-c && python3 -m http.server 5057 -d apps/option-c/out &
MEDLOG_SECRET=dev-secret npm run api &          # للاختبارات الحية وFlutter
npm i --no-save axe-core@4.14.0
BASE=http://localhost:5057 node docs/option-c-enhancement/audit.js audit.json
BASE=http://localhost:5057 node docs/option-c-enhancement/ui-audit.js ui.json
BASE=http://localhost:5057 node docs/option-c-enhancement/l10n-scan.js l10n.json
BASE=http://localhost:5057 node docs/option-c-enhancement/functional-checks.js
cd mobile/atlas_shared && flutter test; cd ../customer_app && flutter test; cd ../courier_app && flutter test
LIVE_API=http://localhost:4000/api/v1 flutter test test/live_api_test.dart
```

الأدلة الخام في `docs/option-c-remediation/evidence/`:

- `axe-after.json`
- `ui-audit-before.json` و`ui-audit-after.json`
- `l10n-scan-before.json` و`l10n-scan-after.json`
