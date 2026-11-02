// مصدر التوطين المعتمد للخيار C (Emerald Health) — الويب وتطبيقات Flutter يقرآن من هنا فقط.
// - القاموس الأساسي packages/i18n/src/index.ts يبقى للخيارين A وB كما هو.
// - هذا الملف يضيف: تصحيحات مصطلحات على القاموس (TERM_OVERRIDES)، وسجلّ تسميات كل القيم التقنية مع سياق اختياري (domain)
//   لحل الرموز المتعددة المعنى (مثل failed: «تعذّر التسليم» للشحنة و«فشل» لعملية نسخ احتياطي).
// - Flutter: mobile/tool/gen_labels.ts يولّد labels.g.dart من هذا الملف؛ اختبار tests/l10n.test.ts يفشل إن اختلفا.
import { dict, type Entry, type Lang } from './index';

const E = (ar: string, en: string): Entry => ({ ar, en });

/** تصحيحات مفاتيح القاموس (المسار بالنقاط) — مراجعة مصطلحات لوجستيات العينات الطبية وسلسلة التبريد */
export const TERM_OVERRIDES: Record<string, Entry> = {
  'nav.legs': E('مراحل النقل', 'Transport legs'),
  'nav.gateway': E('لوحة بوابة الأجهزة', 'Device gateway console'),
  'nav.devices': E('أجهزة التتبع GPT45-M', 'GPT45-M trackers'),
  'nav.capa': E('الإجراءات التصحيحية والوقائية', 'CAPA'),
  'nav.arap': E('الذمم وأعمار الديون', 'AR/AP & aging'),
  'nav.blocks': E('القيود التشغيلية', 'Operational blocks'),
  'nav.legalHolds': E('التحفظ القانوني على السجلات', 'Legal holds'),
  'nav.health': E('سلامة النظام والنسخ الاحتياطي', 'System health & backups'),
  'nav.ratePlans': E('جداول الأسعار', 'Tariffs'),
  'nav.inventory': E('المخزون وحركاته', 'Inventory & movements'),
  'nav.groups.assets': E('الأصول والأجهزة', 'Assets & devices'),
  'nav.groups.commercial': E('العملاء والعقود', 'Customers & contracts'),
  'nav.users': E('المستخدمون والأدوار', 'Users & roles'),
  'nav.api': E('تكامل الأنظمة (API)', 'API & webhooks'),
  'ship.legs': E('مراحل النقل', 'Legs'),
  'ship.pickupWindow': E('فترة الاستلام', 'Pickup window'),
  'ship.temperature': E('درجة الحرارة', 'Temperature'),
  'ship.confidence': E('درجة الثقة', 'Confidence'),
  'ship.timeline': E('سجل الأحداث', 'Timeline'),
  'ship.items': E('محتويات الشحنة', 'Items'),
  'ship.disposition': E('قرار الجهة المستلمة', 'Receiving institution decision'),
  'ship.lastConfirmed': E('آخر موقع مؤكد', 'Last confirmed position'),
  'ship.lastKnownReading': E('آخر قراءة حرارة معروفة', 'Last known temperature reading'),
  'ship.noLiveInFlight': E('لا يتوفر موقع مباشر أثناء الرحلة الجوية؛ المعروض هو آخر موقع مؤكد قبل الإقلاع', 'No live position during the flight; showing the last confirmed position before departure'),
  'ship.gapNotCompliance': E('الفجوة في البيانات لا تعني الالتزام بالنطاق', 'A data gap does not imply compliance'),
  'ship.vat': E('ضريبة القيمة المضافة (15%)', 'VAT (15%)'),
  'errors.validation': E('يرجى مراجعة الحقول المحددة', 'Please review the highlighted fields'),
  'auth.mfaTitle': E('التحقق بخطوتين', 'Two-step verification'),
  'common.empty': E('لا توجد بيانات بعد', 'Nothing to show yet'),
  'level.stat': E('طارئ (STAT)', 'STAT'),
  'thermal.ambient': E('حرارة الغرفة', 'Ambient'),
};

/** مفاتيح جديدة خاصة بالخيار C (لا توجد في القاموس الأساسي) */
export const TERMS_C: Record<string, Entry> = {
  'greet.morning': E('صباح الخير', 'Good morning'),
  'greet.afternoon': E('مساء الخير', 'Good afternoon'),
  'greet.evening': E('مساء الخير', 'Good evening'),
  'track.source': E('المصدر', 'Source'),
  'track.notLive': E('ليس موقعاً مباشراً', 'Not a live position'),
  'track.noneYet': E('لا يوجد موقع مؤكد بعد', 'No confirmed position yet'),
  'track.deviceTime': E('وقت الجهاز', 'Device time'),
  'track.receivedAt': E('وقت الاستلام في النظام', 'Received by system'),
  'track.backfilled': E('قراءة مخزنة وصلت لاحقاً', 'Backfilled reading'),
  'track.tempView': E('عرض الحرارة', 'Temperature view'),
  'track.tempCurrent': E('حالية', 'Current'),
  'track.tempLastKnown': E('آخر قيمة معروفة فقط', 'Last known value only'),
  'session.expired': E('انتهت الجلسة. سجّل الدخول مجدداً.', 'Your session expired. Please sign in again.'),
};

/** تسميات القيم العامة (بلا سياق) — تُفحص بعد السياق المحدد وقبل القواميس الأساسية */
export const LABELS: Record<string, Entry> = {
  // حالات الشحنة والصندوق والجهاز (تصحيحات)
  pickup_scheduled: E('الاستلام مجدول', 'Pickup scheduled'), exception: E('حالة استثنائية', 'Exception'), in_air_transit: E('في رحلة جوية', 'In air transit'),
  retired: E('خارج الخدمة', 'Retired'), returning: E('عائد إلى المستودع', 'Returning'), cleaning: E('قيد التنظيف', 'Cleaning'), inspection: E('قيد الفحص', 'Inspection'), maintenance: E('قيد الصيانة', 'Maintenance'), faulty: E('معطّل', 'Faulty'),
  ambient: E('حرارة الغرفة', 'Ambient'), stale: E('بيانات قديمة', 'Stale'), stat: E('طارئ (STAT)', 'STAT'), major: E('جسيم', 'Major'), reconciled: E('تمت المطابقة', 'Reconciled'), disputed: E('متنازع عليها', 'Disputed'),
  // أنواع المطالبات والمسؤولية والقرارات
  damage: E('تلف', 'Damage'), loss: E('فقد', 'Loss'), delay: E('تأخير', 'Delay'), temperature: E('انحراف حراري', 'Temperature'),
  company: E('الشركة', 'Company'), partner: E('الشريك الناقل', 'Partner'), customer: E('العميل', 'Customer'),
  accepted: E('مقبولة', 'Accepted'), accepted_with_note: E('مقبولة بملاحظة', 'Accepted with note'), approve: E('اعتماد', 'Approve'), reject: E('رفض', 'Reject'),
  retry: E('إعادة المحاولة', 'Retry'), alternate_destination: E('وجهة بديلة معتمدة', 'Alternate destination'), qualified_hold: E('حجز مؤقت مؤهَّل', 'Qualified hold'), return_to_sender: E('إرجاع للمرسل', 'Return to sender'), authorized: E('معتمد', 'Authorized'),
  // الدفع والتحقق
  bank_transfer: E('تحويل بنكي', 'Bank transfer'), card_simulated: E('بطاقة مدى/فيزا (محاكاة)', 'mada/Visa card (simulated)'), sadad_simulated: E('سداد (محاكاة)', 'SADAD (simulated)'),
  signature: E('توقيع', 'Signature'), qr: E('رمز QR', 'QR code'), pin: E('رمز تحقق', 'PIN'), in: E('وارد', 'Incoming'), out: E('صادر', 'Outgoing'),
  // التكرار ودورات الفوترة
  daily: E('يومي', 'Daily'), weekdays: E('أيام العمل', 'Weekdays'), weekly: E('أسبوعي', 'Weekly'), monthly: E('شهري', 'Monthly'), annual: E('سنوي', 'Annual'),
  // القنوات والجمهور والتكاملات
  in_app: E('داخل التطبيق', 'In-app'), sms: E('رسالة نصية', 'SMS'), email: E('البريد الإلكتروني', 'Email'), push: E('إشعار الجوال', 'Push'),
  staff: E('موظفو المنصة', 'Platform staff'),
  payment: E('الدفع', 'Payment'), zatca: E('هيئة الزكاة والضريبة والجمارك', 'ZATCA'), carrier: E('الناقل', 'Carrier'), maps: E('الخرائط', 'Maps'), fhir: E('HL7/FHIR', 'HL7/FHIR'), iot: E('إنترنت الأشياء', 'IoT'),
  simulated_sent: E('أُرسل (محاكاة)', 'Sent (simulated)'), simulated_failed: E('فشل الإرسال (محاكاة)', 'Failed (simulated)'), simulated_rejected: E('مرفوض (محاكاة)', 'Rejected (simulated)'), simulated_cleared: E('مقبولة (محاكاة)', 'Cleared (simulated)'),
  // أنواع العاملين والشركاء والجهات
  employee: E('موظف', 'Employee'), road: E('بري', 'Road'), air: E('جوي', 'Air'), warehouse: E('مستودع', 'Warehouse'), air_cargo: E('شحن جوي', 'Air cargo'),
  hospital: E('مستشفى', 'Hospital'), laboratory: E('مختبر', 'Laboratory'), clinic_group: E('مجموعة عيادات', 'Clinic group'), individual: E('فرد', 'Individual'),
  organization: E('مؤسسة', 'Organization'), vehicle: E('مركبة', 'Vehicle'), box: E('صندوق', 'Box'), route: E('مسار', 'Route'),
  // حركات المخزون والصناديق
  issue: E('صرف', 'Issue'), receipt: E('استلام مخزني', 'Receipt'), adjustment: E('تسوية مخزنية', 'Adjustment'), transfer: E('نقل', 'Transfer'), partner_handover: E('تسليم لشريك', 'Partner handover'), partner_return: E('إعادة من شريك', 'Partner return'),
  // أحداث الحيازة والناقل والجهاز
  warehouse_in: E('دخول المستودع', 'Warehouse in'), warehouse_out: E('خروج من المستودع', 'Warehouse out'), loaded: E('تم التحميل على الطائرة', 'Loaded'), unloaded: E('تم التفريغ', 'Unloaded'), released: E('تم الإفراج', 'Released'),
  sensor_fault: E('عطل في المستشعر', 'Sensor fault'), missing_readings: E('قراءات مفقودة', 'Missing readings'), low_battery: E('بطارية منخفضة', 'Low battery'), custody_break: E('انقطاع في سلسلة الحيازة', 'Custody break'),
  // أوامر الأجهزة
  request_position: E('طلب الموقع الآن', 'Request position'), set_interval: E('ضبط فترة الإرسال', 'Set reporting interval'), reboot: E('إعادة تشغيل الجهاز', 'Reboot device'),
  // مصادر البيانات
  courier_app: E('تطبيق المندوب', 'Courier app'), admin: E('العمليات', 'Operations'), carrier_api: E('واجهة الناقل (محاكاة)', 'Carrier API (simulated)'), 'carrier_api (محاكاة)': E('واجهة الناقل (محاكاة)', 'Carrier API (simulated)'), offline_sync: E('مزامنة بعد انقطاع', 'Offline sync'), device: E('جهاز التتبع', 'Tracker'),
  courier: E('المندوب', 'Courier'), manual: E('إدخال يدوي', 'Manual'), system: E('النظام', 'System'), cold_chain: E('مراقبة سلسلة التبريد', 'Cold-chain monitoring'), gpt45m: E('جهاز GPT45-M', 'GPT45-M device'),
  // الصناديق: الحالة الفيزيائية والتأهيل
  good: E('سليم', 'Good'), worn: E('به آثار استخدام', 'Worn'), damaged: E('تالف', 'Damaged'), qualified: E('مؤهّل', 'Qualified'), thermal_mapping: E('رسم الخريطة الحرارية', 'Thermal mapping'), pass: E('اجتاز', 'Pass'), fail: E('لم يجتز', 'Fail'),
  // الفقد والمرتجعات
  suspected: E('مشتبه بفقدها', 'Suspected'), suspected_lost: E('اشتباه فقدان', 'Suspected lost'), declared: E('أُعلن الفقد', 'Declared lost'), recovered: E('عُثر عليها', 'Recovered'),
  // التصنيف الحيوي
  biohazard_cat_b: E('مادة بيولوجية – الفئة ب (UN3373)', 'Biological substance, Category B (UN3373)'), exempt: E('عينة معفاة', 'Exempt specimen'),
  // الجودة
  corrective: E('تصحيحي', 'Corrective'), preventive: E('وقائي', 'Preventive'), info: E('معلومة', 'Info'), warning: E('تحذير', 'Warning'),
  // المحاسبة وتوزيع التكاليف
  asset: E('أصول', 'Asset'), liability: E('خصوم', 'Liability'), equity: E('حقوق ملكية', 'Equity'), revenue: E('إيرادات', 'Revenue'), expense: E('مصروفات', 'Expense'), posted: E('مرحّل', 'Posted'),
  invoice: E('فاتورة', 'Invoice'), credit_note: E('إشعار دائن', 'Credit note'), settlement: E('تسوية شريك', 'Partner settlement'),
  per_shipment: E('لكل شحنة', 'Per shipment'), per_kg: E('لكل كيلوجرام', 'Per kg'), per_box_hour: E('لكل ساعة استخدام صندوق', 'Per box-hour'),
  // النسخ الاحتياطي والاحتفاظ
  snapshot: E('لقطة كاملة', 'Snapshot'), pitr: E('استعادة لنقطة زمنية', 'Point-in-time'), restore_drill: E('تمرين استعادة', 'Restore drill'),
  retain: E('احتفاظ', 'Retain'), delete: E('حذف', 'Delete'), anonymize: E('إخفاء الهوية', 'Anonymize'),
  // المزامنة دون اتصال
  scanPack: E('مسح وتعبئة', 'Scan & pack'), failAttempt: E('محاولة فاشلة', 'Failed attempt'), deliver: E('تسليم', 'Deliver'), queued: E('في الطابور', 'Queued'),
  // أسباب التسليم الفاشل
  RECIPIENT_UNAVAILABLE: E('المستلم غير متاح', 'Recipient unavailable'), ADDRESS_ISSUE: E('مشكلة في العنوان', 'Address issue'), REFUSED: E('رفض الاستلام', 'Refused'), CUSTOMER_REQUEST: E('بطلب العميل', 'Customer request'), ACCESS_DENIED: E('تعذّر الدخول إلى الموقع', 'Site access denied'),
  // أنواع العينات
  BLOOD_TUBES: E('أنابيب دم', 'Blood tubes'), TISSUE_BIOPSY: E('خزعة نسيجية', 'Tissue biopsy'), SWAB_PCR: E('مسحة PCR', 'PCR swab'), URINE_CULTURE: E('مزرعة بول', 'Urine culture'), CSF_SAMPLE: E('سائل نخاعي', 'CSF sample'), SERUM_ALIQUOT: E('عينة مصل', 'Serum aliquot'),
  // حالات عامة
  converted: E('تحوّل إلى شحنة', 'Converted'), on_demand: E('عند الطلب', 'On demand'), scheduled: E('مجدول', 'Scheduled'), recurring: E('متكرر', 'Recurring'),
  pending: E('معلّق', 'Pending'), pending_approval: E('بانتظار الاعتماد', 'Pending approval'), active: E('نشط', 'Active'), published: E('منشور', 'Published'), superseded: E('مستبدل بإصدار أحدث', 'Superseded'), planned: E('مخطط', 'Planned'), dispatched: E('أُرسل للمندوب', 'Dispatched'), in_progress: E('جارٍ', 'In progress'), completed: E('مكتمل', 'Completed'), departed: E('غادر', 'Departed'), arrived: E('وصل', 'Arrived'),
  parsed: E('محلَّلة', 'Parsed'), quarantined: E('معزولة للمراجعة', 'Quarantined'), dead_letter: E('رسائل متعذرة المعالجة', 'Dead-letter'), duplicate: E('مكررة', 'Duplicate'), acked: E('تم تأكيد الاستلام', 'Acknowledged'), sent: E('مرسل', 'Sent'), expired: E('منتهٍ', 'Expired'),
  on_route: E('في مسار', 'On route'), off_shift: E('خارج المناوبة', 'Off shift'), done: E('منجز', 'Done'), simulated: E('محاكاة', 'Simulated'), not_configured: E('غير مهيأ', 'Not configured'), planned_phase_2: E('مرحلة لاحقة', 'Later phase'), blocked: E('محظور', 'Blocked'),
  approved: E('معتمد', 'Approved'), rejected: E('مرفوض', 'Rejected'), draft: E('مسودة', 'Draft'), overdue: E('متأخر', 'Overdue'), inactive: E('غير نشط', 'Inactive'), revoked: E('ملغى', 'Revoked'), invited: E('مدعو', 'Invited'), disabled: E('معطل', 'Disabled'), skipped: E('تم تخطيه', 'Skipped'), requested: E('مطلوب', 'Requested'), under_review: E('قيد المراجعة', 'Under review'),
  offline_expected_or_unknown: E('غير متصل (متوقع أثناء الطيران)', 'Offline (expected in flight)'), online: E('متصل', 'Online'), offline_or_delayed: E('غير متصل أو متأخر', 'Offline or delayed'), no_device: E('لا جهاز', 'No device'), unavailable: E('غير متاح', 'Unavailable'),
  pickup: E('استلام', 'Pickup'), delivery: E('تسليم', 'Delivery'), handover: E('نقل حيازة', 'Handover'), return: E('إرجاع', 'Return'),
  applicable: E('منطبق', 'Applicable'), not_applicable: E('غير منطبق', 'Not applicable'), pending_legal_review: E('بانتظار المراجعة القانونية', 'Pending legal review'), success: E('نجح', 'Success'),
  received: E('مستلمة', 'Received'), not_submitted: E('لم تُرسل', 'Not submitted'), paused: E('موقوف', 'Paused'), open: E('مفتوح', 'Open'), high_confidence: E('مرتفعة', 'High'), all: E('الكل', 'All'),
  udp: E('UDP', 'UDP'), tcp: E('TCP', 'TCP'),
};

/** تسميات خاصة بسياق: تُستخدم لحل الرموز المتعددة المعنى */
export const DOMAIN_LABELS: Record<string, Record<string, Entry>> = {
  /** نتيجة عملية (نسخ احتياطي، تمرين، دفع، تأهيل) — failed هنا ليست «تعذّر التسليم» */
  outcome: { failed: E('فشل', 'Failed'), success: E('نجح', 'Success') },
  custodian: { customer: E('العميل', 'Customer'), courier: E('المندوب', 'Courier'), warehouse: E('المستودع', 'Warehouse'), partner: E('الشريك الناقل', 'Partner'), air_carrier: E('الناقل الجوي', 'Air carrier'), recipient: E('المستلم', 'Recipient') },
  role: Object.fromEntries(Object.entries(dict.roles).map(([k, v]) => [k, v as Entry])),
  claimStatus: { approved: E('معتمدة', 'Approved'), rejected: E('مرفوضة', 'Rejected'), closed: E('مغلقة', 'Closed') },
  invoiceStatus: { overdue: E('متأخرة السداد', 'Overdue') },
};

/** القواميس الأساسية التي تُستخدم كاحتياط بعد LABELS (بترتيبها) */
const BASE_ENUMS = ['shipmentStatus', 'boxStatus', 'deviceState', 'excursionStatus', 'incidentStatus', 'claimStatus', 'invoiceStatus', 'settlementStatus', 'licenseStatus', 'severity', 'freshness', 'thermal', 'level', 'mode', 'custodian', 'approvalKind', 'roles', 'requestType'] as const;

/** تسمية قيمة تقنية: السياق ← التسميات المعتمدة ← القواميس الأساسية ← الرمز نفسه */
export function labelEntry(v: string, domain?: string): Entry | null {
  if (domain && DOMAIN_LABELS[domain]?.[v]) return DOMAIN_LABELS[domain][v];
  if (LABELS[v]) return LABELS[v];
  for (const d of BASE_ENUMS) { const e = (dict as any)[d]?.[v]; if (e) return e as Entry; }
  return null;
}
export function label(lang: Lang, v: string | null | undefined, domain?: string): string {
  if (v === null || v === undefined || v === '') return '—';
  return labelEntry(String(v), domain)?.[lang] ?? String(v);
}

/** مفتاح القاموس مع تصحيحات الخيار C */
export function termEntry(key: string): Entry | null {
  if (TERM_OVERRIDES[key]) return TERM_OVERRIDES[key];
  if (TERMS_C[key]) return TERMS_C[key];
  const v = key.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), dict);
  return v && typeof v === 'object' && typeof v.ar === 'string' ? (v as Entry) : null;
}
export function term(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = termEntry(key)?.[lang] ?? key;
  if (vars) for (const [k, x] of Object.entries(vars)) s = s.replace(`{${k}}`, String(x));
  return s;
}

/** التحية حسب الساعة بتوقيت الرياض — «مساء الخير» لكل ما بعد الظهر (لا «مساء النور» فهي ردّ وليست تحية) */
export function greeting(lang: Lang, now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Riyadh' }).format(now));
  return term(lang, h < 12 ? 'greet.morning' : h < 18 ? 'greet.afternoon' : 'greet.evening');
}
/** فاصل الجملة حسب اللغة (الفاصلة العربية لا تظهر في الواجهة الإنجليزية) */
export const comma = (lang: Lang) => (lang === 'ar' ? '، ' : ', ');

/** عنوان حدث الخط الزمني من رموزه المنظمة (إن وُجدت) بدل نص الخادم الذي قد يحوي رموزاً خاماً */
export interface TimelineCodes { status?: string; fromType?: string; toType?: string; method?: string; eventType?: string; reasonCode?: string; peakC?: number }
export function timelineTitle(lang: Lang, e: { kind: string; title: Entry; codes?: TimelineCodes }): string {
  const c = e.codes; if (!c) return e.title[lang];
  const arrow = lang === 'ar' ? ' ← ' : ' → ';
  switch (e.kind) {
    case 'status': return c.status ? label(lang, c.status) : e.title[lang];
    case 'custody': return `${lang === 'ar' ? 'نقل الحيازة' : 'Custody transfer'}: ${label(lang, c.fromType, 'custodian')}${arrow}${label(lang, c.toType, 'custodian')}`;
    case 'carrier': return `${lang === 'ar' ? 'الناقل' : 'Carrier'}: ${label(lang, c.eventType)}`;
    case 'device': return `${lang === 'ar' ? 'جهاز التتبع' : 'Tracker'}: ${label(lang, c.eventType)}`;
    case 'attempt': return `${lang === 'ar' ? 'محاولة تسليم فاشلة' : 'Failed delivery attempt'}: ${label(lang, c.reasonCode)}`;
    default: return e.title[lang];
  }
}

/** تفاصيل حدث الخط الزمني: تُترجم الرموز (طريقة التوثيق، حالة الانحراف، سبب التعذّر) بدل عرضها خاماً */
export function timelineDetail(lang: Lang, e: { kind: string; detail?: string; codes?: TimelineCodes }): string {
  const c = e.codes; const d = e.detail ?? '';
  if (!c) return d;
  if (e.kind === 'custody' && c.method) return `${d.replace(/\s*\([\w-]+\)\s*$/, '')} (${label(lang, c.method)})`;
  if (e.kind === 'excursion' && c.status) return label(lang, c.status);
  if (e.kind === 'attempt' && c.reasonCode) return label(lang, c.reasonCode);
  if (e.kind === 'status' && c.status) return d;
  return d;
}

/** كل التسميات المسطّحة (للمولّد وللاختبارات): رمز ← مدخل، ومفاتيح السياق بصيغة domain.code */
export function allLabels(): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const d of BASE_ENUMS) for (const [k, v] of Object.entries((dict as any)[d])) if (!out[k]) out[k] = v as Entry;
  Object.assign(out, LABELS);
  for (const [d, m] of Object.entries(DOMAIN_LABELS)) for (const [k, v] of Object.entries(m)) out[`${d}.${k}`] = v;
  return out;
}
/** القاموس المسطّح بعد التصحيحات (للمولّد) */
export function allTerms(): Record<string, Entry> {
  const flat: Record<string, Entry> = {};
  const walk = (o: any, p: string) => { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === 'object' && typeof (v as any).ar === 'string') flat[key] = TERM_OVERRIDES[key] ?? (v as Entry); else if (v && typeof v === 'object') walk(v, key); } };
  walk(dict, '');
  return { ...flat, ...TERMS_C };
}
