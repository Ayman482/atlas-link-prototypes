// طبقة التوطين للخيار C (مراجعة Emerald Health):
// 1) تصحيحات مصطلحات على القاموس المشترك تُطبَّق في الخيار C فقط (القاموس المشترك يبقى كما هو للخيارين A وB).
// 2) تسميات لكل الرموز التقنية التي كانت تظهر خاماً (نوع المطالبة، طريقة الدفع، التكرار، القنوات، أنواع الحركات…).
// المرجع: review/LOCALIZATION_GLOSSARY.md — مصطلحات لوجستيات العينات الطبية في المملكة.
type L = { ar: string; en: string };

/** تصحيحات مفاتيح القاموس المشترك (المسار بالنقاط مثل nav.legs) */
export const DICT_OVERRIDES: Record<string, L> = {
  'nav.legs': { ar: 'مراحل النقل', en: 'Transport legs' },
  'nav.gateway': { ar: 'لوحة بوابة الأجهزة', en: 'Device gateway console' },
  'nav.capa': { ar: 'الإجراءات التصحيحية والوقائية', en: 'CAPA' },
  'nav.arap': { ar: 'الذمم وأعمار الديون', en: 'AR/AP & aging' },
  'nav.blocks': { ar: 'القيود التشغيلية', en: 'Operational blocks' },
  'nav.legalHolds': { ar: 'التحفظ القانوني على السجلات', en: 'Legal holds' },
  'nav.health': { ar: 'سلامة النظام والنسخ الاحتياطي', en: 'System health & backups' },
  'nav.ratePlans': { ar: 'جداول الأسعار', en: 'Tariffs' },
  'nav.inventory': { ar: 'المخزون وحركاته', en: 'Inventory & movements' },
  'nav.groups.assets': { ar: 'الأصول والأجهزة', en: 'Assets & devices' },
  'nav.groups.commercial': { ar: 'العملاء والعقود', en: 'Customers & contracts' },
  'nav.users': { ar: 'المستخدمون والأدوار', en: 'Users & roles' },
  'ship.legs': { ar: 'مراحل النقل', en: 'Legs' },
  'ship.pickupWindow': { ar: 'فترة الاستلام', en: 'Pickup window' },
  'ship.temperature': { ar: 'درجة الحرارة', en: 'Temperature' },
  'ship.confidence': { ar: 'درجة الثقة', en: 'Confidence' },
  'ship.timeline': { ar: 'سجل الأحداث', en: 'Timeline' },
  'ship.items': { ar: 'محتويات الشحنة', en: 'Items' },
  'ship.disposition': { ar: 'قرار الجهة المستلمة', en: 'Receiving institution decision' },
  'errors.validation': { ar: 'يرجى مراجعة الحقول المحددة', en: 'Please review the highlighted fields' },
  'auth.mfaTitle': { ar: 'التحقق بخطوتين', en: 'Two-step verification' },
  'common.empty': { ar: 'لا توجد بيانات بعد', en: 'Nothing to show yet' },
};

/** تسميات القيم والحالات: تُفحص قبل القاموس المشترك */
export const VALUE_LABELS: Record<string, L> = {
  // حالات الشحنة والصندوق والجهاز (تصحيحات مصطلحية)
  pickup_scheduled: { ar: 'الاستلام مجدول', en: 'Pickup scheduled' },
  exception: { ar: 'حالة استثنائية', en: 'Exception' },
  in_air_transit: { ar: 'في رحلة جوية', en: 'In air transit' },
  retired: { ar: 'خارج الخدمة', en: 'Retired' },
  returning: { ar: 'عائد إلى المستودع', en: 'Returning' },
  cleaning: { ar: 'قيد التنظيف', en: 'Cleaning' },
  inspection: { ar: 'قيد الفحص', en: 'Inspection' },
  maintenance: { ar: 'قيد الصيانة', en: 'Maintenance' },
  faulty: { ar: 'معطّل', en: 'Faulty' },
  ambient: { ar: 'حرارة الغرفة', en: 'Ambient' },
  stale: { ar: 'بيانات قديمة', en: 'Stale' },
  stat: { ar: 'طارئ (STAT)', en: 'STAT' },
  major: { ar: 'جسيم', en: 'Major' },
  reconciled: { ar: 'تمت المطابقة', en: 'Reconciled' },
  disputed: { ar: 'متنازع عليها', en: 'Disputed' },
  // أنواع المطالبات
  damage: { ar: 'تلف', en: 'Damage' }, loss: { ar: 'فقد', en: 'Loss' }, delay: { ar: 'تأخير', en: 'Delay' }, temperature: { ar: 'انحراف حراري', en: 'Temperature' },
  // المسؤولية والقرارات
  company: { ar: 'الشركة', en: 'Company' }, partner: { ar: 'الشريك الناقل', en: 'Partner' }, customer: { ar: 'العميل', en: 'Customer' },
  accepted: { ar: 'مقبولة', en: 'Accepted' }, accepted_with_note: { ar: 'مقبولة بملاحظة', en: 'Accepted with note' },
  approve: { ar: 'اعتماد', en: 'Approve' }, reject: { ar: 'رفض', en: 'Reject' },
  retry: { ar: 'إعادة المحاولة', en: 'Retry' }, alternate_destination: { ar: 'وجهة بديلة معتمدة', en: 'Alternate destination' }, qualified_hold: { ar: 'حجز مؤقت مؤهَّل', en: 'Qualified hold' }, return_to_sender: { ar: 'إرجاع للمرسل', en: 'Return to sender' },
  authorized: { ar: 'معتمد', en: 'Authorized' },
  // طرق الدفع والتحقق
  bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer' }, card_simulated: { ar: 'بطاقة مدى/فيزا (محاكاة)', en: 'mada/Visa card (simulated)' }, sadad_simulated: { ar: 'سداد (محاكاة)', en: 'SADAD (simulated)' },
  signature: { ar: 'توقيع', en: 'Signature' }, qr: { ar: 'رمز QR', en: 'QR code' }, pin: { ar: 'رمز تحقق', en: 'PIN' },
  in: { ar: 'وارد', en: 'Incoming' }, out: { ar: 'صادر', en: 'Outgoing' },
  // التكرار ودورات الفوترة
  daily: { ar: 'يومي', en: 'Daily' }, weekdays: { ar: 'أيام العمل', en: 'Weekdays' }, weekly: { ar: 'أسبوعي', en: 'Weekly' }, monthly: { ar: 'شهري', en: 'Monthly' }, annual: { ar: 'سنوي', en: 'Annual' },
  // القنوات والتكاملات
  in_app: { ar: 'داخل التطبيق', en: 'In-app' }, sms: { ar: 'رسالة نصية', en: 'SMS' }, email: { ar: 'البريد الإلكتروني', en: 'Email' }, push: { ar: 'إشعار الجوال', en: 'Push' },
  payment: { ar: 'الدفع', en: 'Payment' }, zatca: { ar: 'هيئة الزكاة والضريبة والجمارك', en: 'ZATCA' }, carrier: { ar: 'الناقل', en: 'Carrier' }, maps: { ar: 'الخرائط', en: 'Maps' }, fhir: { ar: 'HL7/FHIR', en: 'HL7/FHIR' },
  // أنواع العاملين والشركاء
  employee: { ar: 'موظف', en: 'Employee' }, road: { ar: 'بري', en: 'Road' }, air: { ar: 'جوي', en: 'Air' }, warehouse: { ar: 'مستودع', en: 'Warehouse' },
  // حركات المخزون والصناديق
  issue: { ar: 'صرف', en: 'Issue' }, receipt: { ar: 'استلام مخزني', en: 'Receipt' }, adjustment: { ar: 'تسوية مخزنية', en: 'Adjustment' }, transfer: { ar: 'نقل', en: 'Transfer' }, partner_handover: { ar: 'تسليم لشريك', en: 'Partner handover' }, partner_return: { ar: 'إعادة من شريك', en: 'Partner return' },
  // أحداث الحيازة والناقل والجهاز
  warehouse_in: { ar: 'دخول المستودع', en: 'Warehouse in' }, warehouse_out: { ar: 'خروج من المستودع', en: 'Warehouse out' },
  loaded: { ar: 'تم التحميل', en: 'Loaded' }, unloaded: { ar: 'تم التفريغ', en: 'Unloaded' }, released: { ar: 'تم الإفراج', en: 'Released' },
  sensor_fault: { ar: 'عطل في المستشعر', en: 'Sensor fault' }, missing_readings: { ar: 'قراءات مفقودة', en: 'Missing readings' }, low_battery: { ar: 'بطارية منخفضة', en: 'Low battery' },
  // مصادر البيانات
  courier_app: { ar: 'تطبيق المندوب', en: 'Courier app' }, admin: { ar: 'العمليات', en: 'Operations' }, carrier_api: { ar: 'واجهة الناقل', en: 'Carrier API' }, offline_sync: { ar: 'مزامنة بعد انقطاع', en: 'Offline sync' }, device: { ar: 'جهاز التتبع', en: 'Tracker' }, courier: { ar: 'المندوب', en: 'Courier' }, manual: { ar: 'إدخال يدوي', en: 'Manual' },
  // المحاسبة
  asset: { ar: 'أصول', en: 'Asset' }, liability: { ar: 'خصوم', en: 'Liability' }, equity: { ar: 'حقوق ملكية', en: 'Equity' }, revenue: { ar: 'إيرادات', en: 'Revenue' }, expense: { ar: 'مصروفات', en: 'Expense' }, posted: { ar: 'مرحّل', en: 'Posted' },
  // النسخ الاحتياطي
  snapshot: { ar: 'لقطة كاملة', en: 'Snapshot' }, pitr: { ar: 'استعادة لنقطة زمنية', en: 'Point-in-time' }, restore_drill: { ar: 'تمرين استعادة', en: 'Restore drill' },
  // إجراءات المزامنة دون اتصال
  scanPack: { ar: 'مسح وتعبئة', en: 'Scan & pack' }, failAttempt: { ar: 'محاولة فاشلة', en: 'Failed attempt' }, deliver: { ar: 'تسليم', en: 'Deliver' },
  // أسباب التسليم الفاشل
  RECIPIENT_UNAVAILABLE: { ar: 'المستلم غير متاح', en: 'Recipient unavailable' }, ADDRESS_ISSUE: { ar: 'مشكلة في العنوان', en: 'Address issue' }, REFUSED: { ar: 'رفض الاستلام', en: 'Refused' }, CUSTOMER_REQUEST: { ar: 'بطلب العميل', en: 'Customer request' }, ACCESS_DENIED: { ar: 'تعذّر الدخول إلى الموقع', en: 'Site access denied' },
  // أخرى
  converted: { ar: 'تحوّل إلى شحنة', en: 'Converted' }, on_demand: { ar: 'عند الطلب', en: 'On demand' }, scheduled: { ar: 'مجدول', en: 'Scheduled' }, recurring: { ar: 'متكرر', en: 'Recurring' },
};

/** يطبّق التصحيحات على كائن قاموس فرعي (مثل dict.nav) مع الحفاظ على بنيته */
export function withOverrides<T extends Record<string, any>>(obj: T, prefix: string): T {
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const key = `${prefix}.${k}`;
    out[k] = DICT_OVERRIDES[key] ?? (v && typeof v === 'object' && !('ar' in v) ? withOverrides(v, key) : v);
  }
  return out;
}
