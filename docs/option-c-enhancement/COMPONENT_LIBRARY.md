# مكتبة المكوّنات ورموز التصميم — الخيار C (Emerald Health)

## 1. رموز التصميم (Design Tokens)

**المصدر الوحيد:** `packages/tokens/tokens.json`. التشغيل: `npm run build -w packages/tokens` يولّد:

| المخرج | المسار | المستهلك |
|---|---|---|
| متغيرات CSS (فاتح/داكن + `prefers-color-scheme` + `[data-theme]`) | `packages/tokens/tokens.css` | `apps/option-c` (يُستورد في `layout.tsx` قبل `globals.css`) |
| ثوابت Dart (`AtlasTokens`) | `mobile/atlas_shared/lib/src/theme/tokens.dart` | تطبيقا Flutter عبر `AtlasTheme` و`AtlasColors` |
| تقرير التباين | `packages/tokens/contrast-report.json` | يفشل البناء إذا انخفض أي زوج نصّي عن 4.5:1 |

### 1.1 هوية Emerald Health

| الرمز | القيمة | الدور |
|---|---|---|
| Primary (Emerald) | `#087F70` | الإجراء الأساسي، الحالة النشطة، التركيز |
| Navy | `#173B4D` | النص الأساسي، الترويسات، الخلفيات الداكنة |
| Background | `#F4FAF8` | خلفية التطبيق |
| Mint | `#D9EEE8` | الأسطح الناعمة للحالة النشطة (`primarySoft`) |
| Gold | `#E6A65D` | التمييز الثانوي، شارات «محاكاة/بيانات عرض» (النص عليه `goldText #8A5A14`) |

ألوان دلالية متاحة الوصول: `success #1C7A43`، `warning #975A00`، `critical #B42318`، `info #1F5F99` — لكل منها نسخة `*Soft` للخلفية. النص فوق الخلفيات الناعمة يستخدم `primaryText #05665A` (لأن Emerald على Mint = 4.05:1 فقط).

### 1.2 حداثة البيانات (إلزامي تشغيلياً)

| الحالة | الرمز اللوني | المعنى المعروض للمستخدم |
|---|---|---|
| مباشر `live` | success | قراءة حديثة من جهاز التتبع |
| متأخر `delayed` | warning | آخر قراءة أقدم من المتوقع |
| بيانات قديمة `stale` | critical | الجهاز غير متصل؛ يُعرض **آخر موقع مؤكد** ووقته |
| مستنتج `inferred` | info | موقع مستنتج من حدث حيازة (مسح/تسليم) وليس GPS |
| مخطط `planned` | muted | لا يوجد موقع مؤكد بعد؛ يُعرض موقع الاستلام المخطط |
| محاكاة `simulated` | goldText | شارة دائمة «بيانات عرض/محاكاة» على الخرائط والمؤشرات |

### 1.3 المسافات والزوايا واللمس

- الزوايا: `radius.sm 8` · `md 12` · `lg 18` · `xl 28` · `pill 999`.
- المسافات: مقياس 4px (4، 8، 12، 16، 20، 24، 32، 40، 48).
- **أدنى هدف لمس:** `touch.minTarget = 44px` (`--touch-min`) لعناصر الجوال وأزرار الأدراج؛ أصغر هدف في لوحة الإدارة 32px مع تباعد يحقق معيار WCAG 2.5.8 (24px).
- الخطوط: Alexandria (العناوين) + Noto Sans Arabic (النص) + خط أحادي للأرقام والرموز (رقم التتبع، IMEI) مع عزل الاتجاه LTR.

### 1.4 تقرير التباين (مولَّد آليًا)


`faint` يُستخدم فقط للعناصر الزخرفية والفواصل؛ لم يعد يُستخدم لأي نص (تم نقل معرّفات الشاشات وتسميات شريط التبويب إلى `muted`).

## 2. مكوّنات الويب (`apps/option-c/src/lib`)

| المكوّن | الملف | السلوك التفاعلي | الربط بالـ API | الوصول |
|---|---|---|---|---|
| `Page` / `Section` | ui.tsx | دخول متتابع | — | عناوين هرمية h1/h2 |
| `Kpis` + `CountUp` | ui.tsx | نقر للانتقال للقائمة المصفّاة | استعلامات اللوحة | البطاقة الحرجة بلا تأخير |
| `DataTable` | ui.tsx | فرز، بحث، ترقيم، **صفوف قابلة للتوسيع** (`expand`)، **تحديد متعدد + إجراءات جماعية** (`bulk`)، تصدير المحدد CSV | أي استعلام قائمة؛ الإجراءات الجماعية تنفذ أوامر حقيقية (مثل `excursion.acknowledge`) | `aria-sort`، أزرار رؤوس، `aria-expanded`، عمود الإجراءات باسم مخفي |
| `Timeline` | ui.tsx | توسيع الحدث: وقت الجهاز مقابل وقت الاستلام، التأخير، المصدر؛ «توسيع الكل» | `shipment.detail` | أزرار حقيقية + `aria-expanded` |
| `TempChart` | ui.tsx | نطاقات 1س/6س/24س/الكل، مؤشر بالفأرة واللمس **والأسهم**، خطوط الحد الأدنى/الأعلى، فجوات مظللة للقراءات المفقودة | `cold_chain.report` | `role=img` بوصف، قراءة `aria-live` |
| `KsaMap` | ui.tsx | علامات قابلة للنقر/Enter ← بطاقة: نوع الموقع، وقت آخر موقع، المصدر، المسار المخطط، «فتح الشحنة» | `control_tower` / `courier.tasks` | مفتاح ألوان مع تلميحات، شارة محاكاة دائمة |
| `Pill` | ui.tsx | تلميح اختياري؛ نبض للمباشر فقط | — | النص لا يعتمد على اللون وحده |
| `Modal` | ui.tsx | دخول/خروج متحرك | `ActionForm` ← أوامر | حبس التركيز، Esc، إرجاع التركيز |
| `Drawer` | motion.tsx | ينزلق من جهة النهاية وينعكس في RTL؛ يُرسم في `document.body` | — | `role=dialog`، `aria-modal`، حبس التركيز |
| `Tip` | motion.tsx | hover/focus، Esc للإغلاق | — | `role=tooltip` + `aria-describedby` |
| `Collapse` / الأكورديون | motion.tsx | ارتفاع متحرك | — | `aria-expanded` على الزر |
| `Tabs` | ui.tsx | تبويبات | — | `role=tablist/tab` + `aria-selected` |
| لوحة الأوامر `Ctrl K` | AdminApp.tsx | بحث عن شحنة/صندوق/IMEI/عميل/شاشة | استعلام `search` | `aria-keyshortcuts` |
| `CriticalBar` | AdminApp.tsx | انحرافات حرجة مفتوحة + «إقرار الآن» | `excursion.acknowledge` | `role=alert`، لا تأخير |
| `NotificationCenter` | AdminApp.tsx | تبويبات: الكل/غير المقروء/الحرج/تتطلب إجراء؛ إقرار، تصعيد، تعليم الكل كمقروء | `notification.markRead`، `notification.markAllRead`، `excursion.acknowledge`، `delay.action` (تصعيد) | درج حواري، العدد ضمن الاسم المقروء |
| مخطط المسار (السحب والإفلات) | ops.tsx `RoutesScreen` | سحب HTML5 + مقبض لوحة مفاتيح (↑/↓)، **تحقق** (التوقف المنجز مقفل في مكانه، الاستلام قبل التسليم)، **تراجع** (Ctrl+Z)، حفظ | `route.reorder` (الخادم يعيد التحقق: `ROUTE_LOCKED`، `STOP_LOCKED`، `PICKUP_AFTER_DELIVERY`) | قائمة مرتبة `<ol>`، إعلان التغيير |
| معالج إنشاء الشحنة | ops.tsx `ShipmentCreate` | 4 خطوات، تحقق فوري لكل حقل، عرض السعر، تأكيد | `shipment.quote` (استعلام)، `shipment.create`، `shipment.submit` | `<ol>` + `aria-current="step"`، الأخطاء مربوطة بالحقل |
| تعارضات العمل دون اتصال | ops.tsx `OfflineConflicts` | قبول/رفض مع مبرر | `offline.resolve` | — |
| `ScanSim` (QR) | mobile/kit.tsx | idle → جاري → نجاح / فشل + «إعادة المحاولة»، إدخال يدوي | أوامر المسح الحقيقية تعيد رسالة الخطأ | `role=alert` للفشل |
| `SuccessMark` / التنبيهات المنبثقة | motion.tsx / store.tsx | علامة ✓ مرسومة | نتيجة الأمر | `aria-live` |

## 3. مكوّنات Flutter (`mobile/atlas_shared`)

| المكوّن | الملف | الوصف |
|---|---|---|
| `AtlasTheme` / `AtlasColors` | theme/atlas_theme.dart | سمة Material 3 فاتحة/داكنة من `AtlasTokens`؛ امتداد للألوان الدلالية |
| `ApiClient` | api/api_client.dart | `login`، `verifyMfa`، `exec` (أوامر)، `query`، `list`؛ `ApiException` برسائل عربية/إنجليزية ورمز الحقل |
| `S` (التوطين) | l10n/strings.dart + labels.g.dart | نفس القاموس وتسميات القيم المولّدة من الويب (`tool/gen_labels.ts`) |
| `AppState` / `AppScope` | app_state.dart | الجلسة، اللغة، السمة — محفوظة في `shared_preferences` |
| `Fmt` | format.dart | التاريخ، الريال، الحرارة؛ عزل LRI/PDI للأرقام والهواتف داخل النص العربي |
| `FadeSlideIn`، `CountUp`، `Pulse` | motion.dart | تحترم `disableAnimations` |
| `StatusPill` | widgets/status_pill.dart | حالة + لون دلالي |
| `Skeleton`، `EmptyView`، `ErrorView`، `SimBadge`، `AsyncView` | widgets/states.dart | حالات التحميل/الفراغ/الخطأ مع إعادة المحاولة |
| `SuccessCheck` / `showSuccess` | widgets/success_check.dart | تأكيد متحرك |
| `KpiTile` | widgets/kpi_tile.dart | بطاقة مؤشر |
| `AtlasTimeline` | widgets/timeline.dart | خط زمني قابل للتوسيع (وقت الجهاز/الاستلام/المصدر) |
| `TempChart` | widgets/temp_chart.dart | نطاقات، لمس/سحب، خطوط الحدود |
| `SignaturePad` | widgets/signature_pad.dart | توقيع يُصدَّر PNG ويُرسل مع أمر الاستلام/التسليم |
| `ScanPanel` | widgets/scan_panel.dart | حالات المسح نفسها في الويب (الكاميرا محاكاة + إدخال يدوي) |
| `LoginScreen` | widgets/login_screen.dart | حسابات العرض + التحقق بخطوتين |

### التطبيقات

- **تطبيق العميل `mobile/customer_app`**: الرئيسية، الشحنات، إنشاء شحنة (4 خطوات + عرض سعر)، التتبع (تقدم، الوقت المتوقع، آخر موقع مؤكد، إجراءات: إعادة جدولة/إلغاء/إرجاع/مطالبة)، الحرارة، الإشعارات، الفواتير (دفع محاكى مع خيار فشل)، المطالبات، العناوين، الحساب.
- **تطبيق المندوب `mobile/courier_app`**: المهام، تفاصيل المهمة (مسح الشحنة ← مسح الصندوق ← الاستلام بتوقيع ← بدء النقل/الوصول ← نقل الحيازة ← التسليم بإثبات ← محاولة فاشلة ← المرتجع)، المسار (رسم تخطيطي معنون «ليست مواقع حية»)، الصناديق، المزامنة (طابور دون اتصال محفوظ)، الحساب.
