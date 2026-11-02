# إصلاحات التوطين العربي/الإنجليزي — الخيار C

> نطاق المراجعة: كل شاشات لوحة الإدارة (61)، بوابة العملاء (16)، معاينتا الجوال (17)، وتطبيقا Flutter — باللغتين وفي اتجاهي RTL/LTR.
> مبدأ العمل: مصطلحات لوجستيات العينات الطبية وسلسلة التبريد كما تُستخدم في المنشآت الصحية في المملكة، لا ترجمة حرفية.

## 1. كيف طُبّقت الإصلاحات

- **دون المساس بالخيارين A وB:** القاموس المشترك `packages/i18n` بقي كما هو. التصحيحات في `apps/option-c/src/lib/l10n.ts`:
  - `DICT_OVERRIDES`: تصحيح مفاتيح القاموس (تُفحص أولاً داخل `t()` وفي قائمة التنقل عبر `withOverrides`).
  - `VALUE_LABELS`: تسميات لكل قيمة تقنية كانت تظهر خاماً للمستخدم (تُفحص أولاً داخل `label()`).
- **Flutter:** `mobile/tool/gen_labels.ts` يولّد `atlas_shared/lib/src/l10n/labels.g.dart` من نفس المصدر، فلا تختلف المصطلحات بين الويب والجوال.

## 2. تصحيح المصطلحات (القاموس)

| المفتاح | قبل (عربي) | بعد (عربي) | بعد (إنجليزي) |
|---|---|---|---|
| `nav.legs` | أرجل النقل | مراحل النقل | Transport legs |
| `nav.gateway` | كونسول البوابة | لوحة بوابة الأجهزة | Device gateway console |
| `nav.capa` | CAPA | الإجراءات التصحيحية والوقائية | CAPA |
| `nav.arap` | الذمم والأعمار | الذمم وأعمار الديون | AR/AP & aging |
| `nav.blocks` | الحظر التشغيلي | القيود التشغيلية | Operational blocks |
| `nav.legalHolds` | الحجز القانوني | التحفظ القانوني على السجلات | Legal holds |
| `nav.health` | صحة النظام والنسخ | سلامة النظام والنسخ الاحتياطي | System health & backups |
| `nav.ratePlans` | التعرفة | جداول الأسعار | Tariffs |
| `nav.inventory` | المخزون والحركات | المخزون وحركاته | Inventory & movements |
| `nav.groups.assets` | الأصول وIoT | الأصول والأجهزة | Assets & devices |
| `nav.groups.commercial` | العملاء والتجاري | العملاء والعقود | Customers & contracts |
| `nav.users` | المستخدمون والصلاحيات | المستخدمون والأدوار | Users & roles |
| `ship.legs` | الأرجل | مراحل النقل | Legs |
| `ship.pickupWindow` | نافذة الاستلام | فترة الاستلام | Pickup window |
| `ship.temperature` | الحرارة | درجة الحرارة | Temperature |
| `ship.confidence` | الثقة | درجة الثقة | Confidence |
| `ship.timeline` | الخط الزمني | سجل الأحداث | Timeline |
| `ship.items` | العناصر | محتويات الشحنة | Items |
| `ship.disposition` | قرار المؤسسة المستلمة | قرار الجهة المستلمة | Receiving institution decision |
| `errors.validation` | تحقق من الحقول المظللة | يرجى مراجعة الحقول المحددة | Please review the highlighted fields |
| `auth.mfaTitle` | التحقق الثنائي | التحقق بخطوتين | Two-step verification |
| `common.empty` | لا توجد بيانات لعرضها | لا توجد بيانات بعد | Nothing to show yet |

## 3. القيم التقنية التي كانت تظهر خاماً أو بترجمة غير دقيقة

عدد التسميات: 99 — منها 65 قيمة كانت تظهر كرمز إنجليزي خام داخل الواجهة العربية (مثل `bank_transfer`، `in_app`، `warehouse_in`، `RECIPIENT_UNAVAILABLE`).

|القيمة الخام | كانت تظهر | التسمية العربية | التسمية الإنجليزية |
|---|---|---|---|
| `pickup_scheduled` | جُدول الاستلام | الاستلام مجدول | Pickup scheduled |
| `exception` | استثناء | حالة استثنائية | Exception |
| `in_air_transit` | على متن رحلة | في رحلة جوية | In air transit |
| `retired` | متقاعد | خارج الخدمة | Retired |
| `returning` | عائد للمستودع | عائد إلى المستودع | Returning |
| `cleaning` | تنظيف | قيد التنظيف | Cleaning |
| `inspection` | فحص | قيد الفحص | Inspection |
| `maintenance` | صيانة | قيد الصيانة | Maintenance |
| `faulty` | معطل | معطّل | Faulty |
| `ambient` | محيط | حرارة الغرفة | Ambient |
| `stale` | قديم | بيانات قديمة | Stale |
| `stat` | عاجل STAT | طارئ (STAT) | STAT |
| `major` | رئيسي | جسيم | Major |
| `reconciled` | مطابَقة | تمت المطابقة | Reconciled |
| `disputed` | محل خلاف | متنازع عليها | Disputed |
| `damage` | `damage` (رمز خام) | تلف | Damage |
| `loss` | `loss` (رمز خام) | فقد | Loss |
| `delay` | `delay` (رمز خام) | تأخير | Delay |
| `temperature` | الحرارة | انحراف حراري | Temperature |
| `company` | `company` (رمز خام) | الشركة | Company |
| `partner` | ناقل شريك | الشريك الناقل | Partner |
| `customer` | العميل | العميل | Customer |
| `accepted` | `accepted` (رمز خام) | مقبولة | Accepted |
| `accepted_with_note` | `accepted_with_note` (رمز خام) | مقبولة بملاحظة | Accepted with note |
| `approve` | اعتماد | اعتماد | Approve |
| `reject` | رفض | رفض | Reject |
| `retry` | إعادة المحاولة | إعادة المحاولة | Retry |
| `alternate_destination` | `alternate_destination` (رمز خام) | وجهة بديلة معتمدة | Alternate destination |
| `qualified_hold` | `qualified_hold` (رمز خام) | حجز مؤقت مؤهَّل | Qualified hold |
| `return_to_sender` | `return_to_sender` (رمز خام) | إرجاع للمرسل | Return to sender |
| `authorized` | `authorized` (رمز خام) | معتمد | Authorized |
| `bank_transfer` | `bank_transfer` (رمز خام) | تحويل بنكي | Bank transfer |
| `card_simulated` | `card_simulated` (رمز خام) | بطاقة مدى/فيزا (محاكاة) | mada/Visa card (simulated) |
| `sadad_simulated` | `sadad_simulated` (رمز خام) | سداد (محاكاة) | SADAD (simulated) |
| `signature` | `signature` (رمز خام) | توقيع | Signature |
| `qr` | `qr` (رمز خام) | رمز QR | QR code |
| `pin` | `pin` (رمز خام) | رمز تحقق | PIN |
| `in` | `in` (رمز خام) | وارد | Incoming |
| `out` | `out` (رمز خام) | صادر | Outgoing |
| `daily` | `daily` (رمز خام) | يومي | Daily |
| `weekdays` | `weekdays` (رمز خام) | أيام العمل | Weekdays |
| `weekly` | `weekly` (رمز خام) | أسبوعي | Weekly |
| `monthly` | `monthly` (رمز خام) | شهري | Monthly |
| `annual` | `annual` (رمز خام) | سنوي | Annual |
| `in_app` | `in_app` (رمز خام) | داخل التطبيق | In-app |
| `sms` | `sms` (رمز خام) | رسالة نصية | SMS |
| `email` | البريد الإلكتروني | البريد الإلكتروني | Email |
| `push` | `push` (رمز خام) | إشعار الجوال | Push |
| `payment` | `payment` (رمز خام) | الدفع | Payment |
| `zatca` | `zatca` (رمز خام) | هيئة الزكاة والضريبة والجمارك | ZATCA |
| `carrier` | `carrier` (رمز خام) | الناقل | Carrier |
| `maps` | `maps` (رمز خام) | الخرائط | Maps |
| `fhir` | `fhir` (رمز خام) | HL7/FHIR | HL7/FHIR |
| `employee` | `employee` (رمز خام) | موظف | Employee |
| `road` | بري | بري | Road |
| `air` | جوي | جوي | Air |
| `warehouse` | موظف المستودع | مستودع | Warehouse |
| `issue` | `issue` (رمز خام) | صرف | Issue |
| `receipt` | `receipt` (رمز خام) | استلام مخزني | Receipt |
| `adjustment` | `adjustment` (رمز خام) | تسوية مخزنية | Adjustment |
| `transfer` | `transfer` (رمز خام) | نقل | Transfer |
| `partner_handover` | `partner_handover` (رمز خام) | تسليم لشريك | Partner handover |
| `partner_return` | `partner_return` (رمز خام) | إعادة من شريك | Partner return |
| `warehouse_in` | `warehouse_in` (رمز خام) | دخول المستودع | Warehouse in |
| `warehouse_out` | `warehouse_out` (رمز خام) | خروج من المستودع | Warehouse out |
| `loaded` | `loaded` (رمز خام) | تم التحميل | Loaded |
| `unloaded` | `unloaded` (رمز خام) | تم التفريغ | Unloaded |
| `released` | `released` (رمز خام) | تم الإفراج | Released |
| `sensor_fault` | `sensor_fault` (رمز خام) | عطل في المستشعر | Sensor fault |
| `missing_readings` | `missing_readings` (رمز خام) | قراءات مفقودة | Missing readings |
| `low_battery` | بطارية منخفضة | بطارية منخفضة | Low battery |
| `courier_app` | `courier_app` (رمز خام) | تطبيق المندوب | Courier app |
| `admin` | لوحة الإدارة والعمليات | العمليات | Operations |
| `carrier_api` | `carrier_api` (رمز خام) | واجهة الناقل | Carrier API |
| `offline_sync` | `offline_sync` (رمز خام) | مزامنة بعد انقطاع | Offline sync |
| `device` | `device` (رمز خام) | جهاز التتبع | Tracker |
| `courier` | مندوب | المندوب | Courier |
| `manual` | يدوي | إدخال يدوي | Manual |
| `asset` | `asset` (رمز خام) | أصول | Asset |
| `liability` | `liability` (رمز خام) | خصوم | Liability |
| `equity` | `equity` (رمز خام) | حقوق ملكية | Equity |
| `revenue` | `revenue` (رمز خام) | إيرادات | Revenue |
| `expense` | `expense` (رمز خام) | مصروفات | Expense |
| `posted` | `posted` (رمز خام) | مرحّل | Posted |
| `snapshot` | `snapshot` (رمز خام) | لقطة كاملة | Snapshot |
| `pitr` | `pitr` (رمز خام) | استعادة لنقطة زمنية | Point-in-time |
| `restore_drill` | `restore_drill` (رمز خام) | تمرين استعادة | Restore drill |
| `scanPack` | `scanPack` (رمز خام) | مسح وتعبئة | Scan & pack |
| `failAttempt` | تعذّر التسليم | محاولة فاشلة | Failed attempt |
| `deliver` | تسليم | تسليم | Deliver |
| `RECIPIENT_UNAVAILABLE` | `RECIPIENT_UNAVAILABLE` (رمز خام) | المستلم غير متاح | Recipient unavailable |
| `ADDRESS_ISSUE` | `ADDRESS_ISSUE` (رمز خام) | مشكلة في العنوان | Address issue |
| `REFUSED` | `REFUSED` (رمز خام) | رفض الاستلام | Refused |
| `CUSTOMER_REQUEST` | `CUSTOMER_REQUEST` (رمز خام) | بطلب العميل | Customer request |
| `ACCESS_DENIED` | `ACCESS_DENIED` (رمز خام) | تعذّر الدخول إلى الموقع | Site access denied |
| `converted` | `converted` (رمز خام) | تحوّل إلى شحنة | Converted |
| `on_demand` | عند الطلب | عند الطلب | On demand |
| `scheduled` | مجدول | مجدول | Scheduled |
| `recurring` | متكرر | متكرر | Recurring |


## 4. إصلاحات الاتجاه (RTL/LTR)

| المشكلة | الإصلاح | المكان |
|---|---|---|
| سهم المسار «→» ثابت فيظهر معكوس المعنى في العربية (الرياض → جدة تُقرأ من اليمين) | سهم حسب اللغة: `←` في العربية و`→` في الإنجليزية | كل ملفات الويب + `arrow()` في Flutter |
| أرقام الهاتف، درجات الحرارة السالبة، أرقام التتبع تنقلب داخل الجملة العربية (مثل «-20°» تصبح «°20-») | عزل الاتجاه بـ LRI/PDI (`Fmt.temp`، `Fmt.ltr`) و`dir="ltr"`/`TextDirection.ltr` للرموز | Flutter `format.dart`، الويب `mono` |
| الدرج الجانبي ينزلق من الجهة الخطأ في RTL | يُحسب الجانب من `document.dir` | `Drawer` |
| بطاقة الخريطة والتلميحات | تستخدم الخصائص المنطقية `inset-inline-*` | globals.css |
| تحية Flutter تعرض بادئة اللقب «د.» كاسم | إزالة البادئات (د./م./أ./Dr./Eng.) من الحروف الأولى والتحية | Flutter + الويب |

## 5. إصلاحات نصية داخل المكوّنات

- «الرجل/الأرجل» (ترجمة حرفية لـ leg) ← «المرحلة / مراحل النقل» في كل الشاشات.
- «Outbox» و«Webhooks» في الواجهة العربية ← «تأخر صندوق الأحداث الصادرة (ث)» و«تكامل الأنظمة (API والإشعارات الآلية Webhooks)».
- رسائل التعارض دون اتصال كانت تُخزَّن بالعربية فقط؛ أصبح الخادم يخزّن `reasonEn` وتُعرض حسب اللغة.
- شارة التطبيق في Flutter كانت «محاكاة» ← `app.demoBadge` «بيانات عرض» لتطابق الويب.
- تسميات الأزرار في الجداول التي بلا عنوان أصبح لها اسم مقروء «إجراءات/Actions» لقارئ الشاشة.

## 6. خلل وظيفي اكتُشف أثناء مراجعة التوطين

- **فلتر نوع الشريك في تطبيق المندوب** كان يقارن `partnerType === 'air_carrier'` بينما القيمة في البيانات `'air'`/`'road'`، فكانت قائمة شركاء نقل الحيازة فارغة. أُصلح في الخيار C. **الخلل ما زال موجوداً في الخيارين A وB** (لم يُعدَّلا التزاماً بنطاق الطلب).

## 7. ما لم يُغيَّر عن قصد

- الاختصارات المعتمدة دولياً تبقى بين قوسين بجانب العربية: STAT، CAPA (في الإنجليزية)، HL7/FHIR، IMEI، QR.
- أرقام الشاشات (A02، K05…) ورموز المتطلبات (RTE-002، OPS-004) تبقى لاتينية لأنها مراجع للمواصفة.
