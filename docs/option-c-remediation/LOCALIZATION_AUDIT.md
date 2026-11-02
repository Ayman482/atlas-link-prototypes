# تدقيق التوطين — الخيار C (عربي/إنجليزي)

## 1. النطاق والطريقة

| الفحص | الأداة | النتيجة قبل | النتيجة بعد |
|---|---|---|---|
| تعارض التسميات بين مصادر التوطين | سكربت مقارنة المصادر الستة | 24 رمزاً بتسميات مختلفة | مصدر واحد — 0 تعارض (`tests/l10n.test.ts`) |
| رموز تقنية خام ظاهرة في الواجهة العربية | `l10n-scan.js`: 94 شاشة × لغتين = 188 تشغيلاً، مع فتح كل تبويب | 43 رمزاً مميزاً (+ 5 رموز أهلية بأحرف كبيرة اكتُشفت بعد توسيع الفحص) | 4 رموز، كلها مقصودة: متغيرا قالب `{tracking}` و`{invoice}`، واسم تكامل من بيانات العرض |
| نص عربي داخل الواجهة الإنجليزية | `l10n-scan.js` | 0 | 0 |
| تغطية قيم نموذج المجال | `tests/l10n.test.ts` على كل قيمة حرفية في `packages/core/src/types.ts` | قيم بلا تسمية (تظهر خاماً) | 100% لها عربي وإنجليزي |
| `failed` في سياق غير الشحنات | `l10n-scan.js` (سياق «تعذّر التسليم») | يظهر في سجل النسخ الاحتياطي | لا يظهر إلا لحالات الشحنات (المرتجعات، مهمة المندوب) |
| الاتجاه RTL/LTR لكل شاشة | `audit.js` (195 تشغيلاً) | صحيح | صحيح (`rtlOk`، `ltrOk`) |
| الاتجاه داخل القيم المختلطة | لقطات + مراجعة | RPO/RTO مقلوبة، حرارة سالبة وأرقام تتبع | `<bdi>`، `dir="ltr"`، عزل LRI/PDI في Flutter |
| تطابق الويب وFlutter | `tests/l10n.test.ts` يقارن `labels.g.dart` بالمصدر | ملف مولّد من مصادر متعددة | يُولَّد من `terms.ts` فقط؛ الاختبار يفشل عند عدم التطابق |

## 2. المصدر المعتمد الوحيد

`packages/i18n/src/terms.ts` هو المرجع الوحيد لمصطلحات الخيار C على الويب (`apps/option-c`) وتطبيقي Flutter (`mobile/tool/gen_labels.ts` ← `labels.g.dart`). القاموس الأساسي `packages/i18n/src/index.ts` باقٍ كما هو للخيارين A وB. أُزيلت المصادر الموازية:

- `ui.tsx`: `DICTS`، و`EXTRA`، و`SRC`.
- `gen_labels.ts`: `EXTRA`.
- Flutter: `_src` في `timeline.dart`.
- `l10n.ts`: صار واجهة رقيقة.

**قاعدة الإضافة:** أي مصطلح جديد يُضاف في `terms.ts` ثم `npx tsx mobile/tool/gen_labels.ts`.

## 3. التحية

| الوقت (الرياض) | قبل (الإدارة) | قبل (البوابة) | بعد (كل الواجهات + Flutter) |
|---|---|---|---|
| قبل 12:00 | صباح الخير / Good morning | صباح الخير / Good morning | صباح الخير / Good morning |
| 12:00–17:59 | مساء الخير / Good afternoon | مساء الخير / Good afternoon | مساء الخير / Good afternoon |
| 18:00 وما بعد | **مساء النور** / Good evening | مساء الخير / **Good afternoon** | مساء الخير / Good evening |
| الفاصل | «،» حتى في الإنجليزية | «،» حتى في الإنجليزية | «، » بالعربية و«, » بالإنجليزية |

«مساء النور» ردّ على التحية وليست تحية ابتدائية. اختبار يتحقق أنها لا تظهر في أي ساعة من الـ24.

## 4. المصطلحات المصححة

### أ. تصحيحات مفاتيح القاموس (`TERM_OVERRIDES`)

| المفتاح | كان (عربي) | صار (عربي) | الإنجليزية |
|---|---|---|---|
| `nav.legs` | أرجل النقل | مراحل النقل | Transport legs |
| `nav.gateway` | كونسول البوابة | لوحة بوابة الأجهزة | Device gateway console |
| `nav.devices` | أجهزة GPT45-M | أجهزة التتبع GPT45-M | GPT45-M trackers |
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
| `nav.api` | تكامل API | تكامل الأنظمة (API) | API & webhooks |
| `ship.legs` | الأرجل | مراحل النقل | Legs |
| `ship.pickupWindow` | نافذة الاستلام | فترة الاستلام | Pickup window |
| `ship.temperature` | الحرارة | درجة الحرارة | Temperature |
| `ship.confidence` | الثقة | درجة الثقة | Confidence |
| `ship.timeline` | الخط الزمني | سجل الأحداث | Timeline |
| `ship.items` | العناصر | محتويات الشحنة | Items |
| `ship.disposition` | قرار المؤسسة المستلمة | قرار الجهة المستلمة | Receiving institution decision |
| `ship.lastConfirmed` | آخر موقع مؤكد | آخر موقع مؤكد | Last confirmed position |
| `ship.lastKnownReading` | آخر قراءة معروفة | آخر قراءة حرارة معروفة | Last known temperature reading |
| `ship.noLiveInFlight` | لا يُعرض موقع حي أثناء الطيران | لا يتوفر موقع مباشر أثناء الرحلة الجوية؛ المعروض هو آخر موقع مؤكد قبل الإقلاع | No live position during the flight; showing the last confirmed position before departure |
| `ship.gapNotCompliance` | الفجوة لا تعني الالتزام | الفجوة في البيانات لا تعني الالتزام بالنطاق | A data gap does not imply compliance |
| `ship.vat` | ضريبة القيمة المضافة 15% | ضريبة القيمة المضافة (15%) | VAT (15%) |
| `errors.validation` | تحقق من الحقول المظللة | يرجى مراجعة الحقول المحددة | Please review the highlighted fields |
| `auth.mfaTitle` | التحقق الثنائي | التحقق بخطوتين | Two-step verification |
| `common.empty` | لا توجد بيانات لعرضها | لا توجد بيانات بعد | Nothing to show yet |
| `level.stat` | عاجل STAT | طارئ (STAT) | STAT |
| `thermal.ambient` | محيط | حرارة الغرفة | Ambient |

### ب. مفاتيح جديدة (`TERMS_C`)

| المفتاح | العربية | الإنجليزية |
|---|---|---|
| `greet.morning` | صباح الخير | Good morning |
| `greet.afternoon` | مساء الخير | Good afternoon |
| `greet.evening` | مساء الخير | Good evening |
| `track.source` | المصدر | Source |
| `track.notLive` | ليس موقعاً مباشراً | Not a live position |
| `track.noneYet` | لا يوجد موقع مؤكد بعد | No confirmed position yet |
| `track.deviceTime` | وقت الجهاز | Device time |
| `track.receivedAt` | وقت الاستلام في النظام | Received by system |
| `track.backfilled` | قراءة مخزنة وصلت لاحقاً | Backfilled reading |
| `track.tempView` | عرض الحرارة | Temperature view |
| `track.tempCurrent` | حالية | Current |
| `track.tempLastKnown` | آخر قيمة معروفة فقط | Last known value only |
| `session.expired` | انتهت الجلسة. سجّل الدخول مجدداً. | Your session expired. Please sign in again. |

### ج. تسميات القيم: ما تغيّر عن القاموس الأساسي، وما كان يظهر خاماً

| الرمز | كان | صار (عربي) | الإنجليزية |
|---|---|---|---|
| `pickup_scheduled` | جُدول الاستلام (shipmentStatus) | الاستلام مجدول | Pickup scheduled |
| `exception` | استثناء (shipmentStatus) | حالة استثنائية | Exception |
| `in_air_transit` | على متن رحلة (shipmentStatus) | في رحلة جوية | In air transit |
| `retired` | متقاعد (boxStatus) | خارج الخدمة | Retired |
| `returning` | عائد للمستودع (boxStatus) | عائد إلى المستودع | Returning |
| `cleaning` | تنظيف (boxStatus) | قيد التنظيف | Cleaning |
| `inspection` | فحص (boxStatus) | قيد الفحص | Inspection |
| `maintenance` | صيانة (boxStatus) | قيد الصيانة | Maintenance |
| `faulty` | معطل (deviceState) | معطّل | Faulty |
| `ambient` | محيط (thermal) | حرارة الغرفة | Ambient |
| `stale` | قديم (freshness) | بيانات قديمة | Stale |
| `stat` | عاجل STAT (level) | طارئ (STAT) | STAT |
| `major` | رئيسي (severity) | جسيم | Major |
| `reconciled` | مطابَقة (settlementStatus) | تمت المطابقة | Reconciled |
| `disputed` | محل خلاف (settlementStatus) | متنازع عليها | Disputed |
| `partner` | شريك (custodian) | الشريك الناقل | Partner |
| `return_to_sender` | يظهر خاماً «return_to_sender» | إرجاع للمرسل | Return to sender |
| `signature` | يظهر خاماً «signature» | توقيع | Signature |
| `weekly` | يظهر خاماً «weekly» | أسبوعي | Weekly |
| `monthly` | يظهر خاماً «monthly» | شهري | Monthly |
| `annual` | يظهر خاماً «annual» | سنوي | Annual |
| `in_app` | يظهر خاماً «in_app» | داخل التطبيق | In-app |
| `email` | يظهر خاماً «email» | البريد الإلكتروني | Email |
| `push` | يظهر خاماً «push» | إشعار الجوال | Push |
| `staff` | يظهر خاماً «staff» | موظفو المنصة | Platform staff |
| `carrier` | يظهر خاماً «carrier» | الناقل | Carrier |
| `simulated_sent` | يظهر خاماً «simulated_sent» | أُرسل (محاكاة) | Sent (simulated) |
| `warehouse` | المستودع (custodian) | مستودع | Warehouse |
| `air_cargo` | يظهر خاماً «air_cargo» | شحن جوي | Air cargo |
| `individual` | عميل فرد (roles) | فرد | Individual |
| `vehicle` | يظهر خاماً «vehicle» | مركبة | Vehicle |
| `request_position` | يظهر خاماً «request_position» | طلب الموقع الآن | Request position |
| `set_interval` | يظهر خاماً «set_interval» | ضبط فترة الإرسال | Set reporting interval |
| `reboot` | يظهر خاماً «reboot» | إعادة تشغيل الجهاز | Reboot device |
| `courier_app` | يظهر خاماً «courier_app» | تطبيق المندوب | Courier app |
| `manual` | يدوي (freshness) | إدخال يدوي | Manual |
| `system` | يظهر خاماً «system» | النظام | System |
| `cold_chain` | يظهر خاماً «cold_chain» | مراقبة سلسلة التبريد | Cold-chain monitoring |
| `good` | يظهر خاماً «good» | سليم | Good |
| `thermal_mapping` | يظهر خاماً «thermal_mapping» | رسم الخريطة الحرارية | Thermal mapping |
| `pass` | يظهر خاماً «pass» | اجتاز | Pass |
| `suspected` | يظهر خاماً «suspected» | مشتبه بفقدها | Suspected |
| `invoice` | يظهر خاماً «invoice» | فاتورة | Invoice |
| `per_shipment` | يظهر خاماً «per_shipment» | لكل شحنة | Per shipment |
| `per_kg` | يظهر خاماً «per_kg» | لكل كيلوجرام | Per kg |
| `per_box_hour` | يظهر خاماً «per_box_hour» | لكل ساعة استخدام صندوق | Per box-hour |
| `retain` | يظهر خاماً «retain» | احتفاظ | Retain |
| `delete` | يظهر خاماً «delete» | حذف | Delete |
| `converted` | يظهر خاماً «converted» | تحوّل إلى شحنة | Converted |
| `active` | يظهر خاماً «active» | نشط | Active |
| `approved` | معتمدة (claimStatus) | معتمد | Approved |
| `rejected` | مرفوضة (claimStatus) | مرفوض | Rejected |
| `overdue` | متأخرة (invoiceStatus) | متأخر | Overdue |

المجموع: 212 تسمية — 22 تصحيح لتسمية أساسية، 31 رمزاً كان يظهر خاماً في فحص المتصفح، 144 تسمية لقيم لا مقابل لها في القاموس الأساسي (تغطية كاملة لقيم نموذج المجال).

### د. تسميات بحسب السياق (`DOMAIN_LABELS`)

| السياق | الرمز | العربية | الإنجليزية | لماذا |
|---|---|---|---|---|
| outcome | `failed` | فشل | Failed | نتيجة عملية (نسخ احتياطي، دفع): «فشل» لا «تعذّر التسليم» |
| outcome | `success` | نجح | Success | نتيجة عملية (نسخ احتياطي، دفع): «فشل» لا «تعذّر التسليم» |
| custodian | `customer` | العميل | Customer | طرف الحيازة |
| custodian | `courier` | المندوب | Courier | طرف الحيازة |
| custodian | `warehouse` | المستودع | Warehouse | طرف الحيازة |
| custodian | `partner` | الشريك الناقل | Partner | طرف الحيازة |
| custodian | `air_carrier` | الناقل الجوي | Air carrier | طرف الحيازة |
| custodian | `recipient` | المستلم | Recipient | طرف الحيازة |
| role | (كل الأدوار) | من `dict.roles` | | دور المستخدم |
| claimStatus | `approved` | معتمدة | Approved | تأنيث «المطالبة» |
| claimStatus | `rejected` | مرفوضة | Rejected | تأنيث «المطالبة» |
| claimStatus | `closed` | مغلقة | Closed | تأنيث «المطالبة» |
| invoiceStatus | `overdue` | متأخرة السداد | Overdue | تأخر السداد |
| confidence | `high` | ثقة مرتفعة | High confidence | ثقة الوصول المتوقع لا تُقرأ كشدة |
| confidence | `medium` | ثقة متوسطة | Medium confidence | ثقة الوصول المتوقع لا تُقرأ كشدة |
| confidence | `low` | ثقة منخفضة | Low confidence | ثقة الوصول المتوقع لا تُقرأ كشدة |
| confidence | `unavailable` | غير متاح | Unavailable | ثقة الوصول المتوقع لا تُقرأ كشدة |


## 5. ملاحظات مهنية على الصياغة (لوجستيات طبية، سلسلة تبريد، مالية، امتثال، مندوبون)

| المجال | الملاحظات |
|---|---|
| سلسلة التبريد | «حرارة الغرفة» بدل «محيط» (ترجمة حرفية لـ ambient). «طارئ (STAT)» بدل «عاجل STAT». «انحراف حراري» للمطالبة من نوع temperature. «الفجوة في البيانات لا تعني الالتزام بالنطاق». «آخر قراءة حرارة معروفة». «رسم الخريطة الحرارية» للتأهيل (thermal mapping) |
| التتبع | «لا يتوفر موقع مباشر أثناء الرحلة الجوية؛ المعروض هو آخر موقع مؤكد قبل الإقلاع» بدل الصياغة المختصرة. «ليس موقعاً مباشراً». «قراءة مخزنة وصلت لاحقاً» (backfilled) |
| الحيازة | «نقل الحيازة: العميل ← المندوب» (السهم يتبع اتجاه القراءة). «الشريك الناقل»، «الناقل الجوي». طريقة التوثيق «توقيع / رمز QR / رمز تحقق» |
| المالية | «متأخرة السداد» للفاتورة. «لكل كيلوجرام»، «لكل ساعة استخدام صندوق». «تمت المطابقة»، «متنازع عليها»، «تسوية شريك»، «إشعار دائن». الدفع المحاكى معلَّم «(محاكاة)» دائماً |
| الامتثال | «التحفظ القانوني على السجلات» (legal hold) بدل «الحجز القانوني». «القيود التشغيلية» بدل «الحظر». «إخفاء الهوية» (anonymize). «مادة بيولوجية – الفئة ب (UN3373)» |
| المندوبون | «تعذّر الدخول إلى الموقع»، «المستلم غير متاح»، «رفض الاستلام». رموز الأهلية تُعرض بنصوص المحرك الرسمية (`ELIGIBILITY_TEXT`) بدل `COURIER_UNAVAILABLE` |
| النظام | «رسائل متعذرة المعالجة» (dead-letter) بدل الإبقاء على الإنجليزية. «معزولة للمراجعة» (quarantined). «تم تأكيد الاستلام» (acked) بدل «مُستلم ACK» |
| المسميات المعتمدة دولياً | تبقى بجانب العربية: STAT، UN3373، HL7/FHIR، RPO/RTO، API، QR، IMEI، GPT45-M |

## 6. ما بقي (مقصود)

- `{tracking}` و`{invoice}` في شاشة قوالب الإشعارات متغيرات قالب يجب أن تظهر كما هي لمحرر القالب.
- «Al-Ufuq carrier events»: اسم تكامل في بيانات العرض الأولية (`seed.ts`). يُعامل كاسم علم من نظام خارجي. للإنتاج يُفضَّل حقل اسم ثنائي اللغة.
- أسماء أحداث ونطاقات API (`shipment.delivered`، `shipments:read`) تُعرض بخط أحادي كمعرّفات تقنية لا تُترجم.
- غير مختبَر: قراءة النصوص بقارئ شاشة عربي فعلي، والمراجعة اللغوية من مختص بشري في المصطلحات السريرية.
