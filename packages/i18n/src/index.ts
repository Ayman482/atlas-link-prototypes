// القاموس الموحّد والمنسّقات — عربي (RTL) وإنجليزي (LTR) لكل الخيارات الثلاثة وتطبيقات Flutter (تُصدَّر ARB)
export type Lang = 'ar' | 'en';
export type Entry = { ar: string; en: string };
const E = (ar: string, en: string): Entry => ({ ar, en });

export const dict = {
  app: { name: E('أطلس لينك للشحن الطبي', 'Atlas Link Medical Cargo'), short: E('أطلس لينك', 'Atlas Link'), admin: E('لوحة الإدارة والعمليات', 'Operations & Admin'), portal: E('بوابة العملاء', 'Customer Portal'), customerApp: E('تطبيق العميل', 'Customer App'), courierApp: E('تطبيق المندوب', 'Courier App'), demoBadge: E('بيانات عرض', 'Demo data'), simulated: E('محاكاة', 'Simulated') },
  common: {
    save: E('حفظ', 'Save'), cancel: E('إلغاء', 'Cancel'), confirm: E('تأكيد', 'Confirm'), close: E('إغلاق', 'Close'), back: E('رجوع', 'Back'), next: E('التالي', 'Next'), submit: E('إرسال', 'Submit'), edit: E('تعديل', 'Edit'), delete: E('حذف', 'Delete'), create: E('إنشاء', 'Create'), add: E('إضافة', 'Add'), search: E('بحث', 'Search'), filter: E('تصفية', 'Filter'), filters: E('عوامل التصفية', 'Filters'), clear: E('مسح', 'Clear'), export: E('تصدير', 'Export'), refresh: E('تحديث', 'Refresh'), view: E('عرض', 'View'), details: E('التفاصيل', 'Details'), actions: E('الإجراءات', 'Actions'), status: E('الحالة', 'Status'), all: E('الكل', 'All'), yes: E('نعم', 'Yes'), no: E('لا', 'No'), none: E('لا يوجد', 'None'), loading: E('جارٍ التحميل…', 'Loading…'), saving: E('جارٍ الحفظ…', 'Saving…'), empty: E('لا توجد بيانات لعرضها', 'Nothing to show yet'), noResults: E('لا نتائج مطابقة لعوامل التصفية', 'No results match your filters'), error: E('حدث خطأ', 'Something went wrong'), retry: E('إعادة المحاولة', 'Retry'), success: E('تم بنجاح', 'Done'), required: E('حقل مطلوب', 'Required'), optional: E('اختياري', 'Optional'), page: E('صفحة', 'Page'), of: E('من', 'of'), rowsPerPage: E('صفوف في الصفحة', 'Rows per page'), showing: E('عرض', 'Showing'), language: E('اللغة', 'Language'), switchLang: E('English', 'العربية'), signOut: E('تسجيل الخروج', 'Sign out'), profile: E('الملف الشخصي', 'Profile'), notifications: E('الإشعارات', 'Notifications'), markAllRead: E('تعليم الكل كمقروء', 'Mark all as read'), today: E('اليوم', 'Today'), yesterday: E('أمس', 'Yesterday'), lastUpdated: E('آخر تحديث', 'Last updated'), reason: E('السبب', 'Reason'), note: E('ملاحظة', 'Note'), from: E('من', 'From'), to: E('إلى', 'To'), date: E('التاريخ', 'Date'), time: E('الوقت', 'Time'), total: E('الإجمالي', 'Total'), amount: E('المبلغ', 'Amount'), city: E('المدينة', 'City'), customer: E('العميل', 'Customer'), branch: E('الفرع', 'Branch'), approve: E('اعتماد', 'Approve'), reject: E('رفض', 'Reject'), resetDemo: E('إعادة ضبط بيانات العرض', 'Reset demo data'), areYouSure: E('هل أنت متأكد؟', 'Are you sure?'), irreversible: E('لا يمكن التراجع عن هذا الإجراء', 'This action cannot be undone'), copied: E('تم النسخ', 'Copied'), open: E('فتح', 'Open'), download: E('تنزيل', 'Download'), print: E('طباعة', 'Print'),
  },
  auth: { signIn: E('تسجيل الدخول', 'Sign in'), email: E('البريد الإلكتروني', 'Email'), password: E('كلمة المرور', 'Password'), mfaTitle: E('التحقق الثنائي', 'Two-factor verification'), mfaHint: E('أدخل الرمز المكوّن من 6 أرقام', 'Enter the 6-digit code'), verify: E('تحقق', 'Verify'), demoAccounts: E('حسابات العرض', 'Demo accounts'), demoNote: E('كلمة المرور لكل الحسابات Demo@2026 ورمز التحقق 123456', 'Password for all accounts is Demo@2026, verification code 123456'), otp: E('رمز التحقق عبر الجوال', 'Mobile verification code'), phone: E('رقم الجوال', 'Mobile number'), sendCode: E('إرسال الرمز', 'Send code') },
  roles: {
    super_admin: E('مدير المنصة', 'Platform admin'), ops_controller: E('مراقب العمليات', 'Operations controller'), warehouse: E('موظف المستودع', 'Warehouse staff'), quality: E('مسؤول الجودة', 'Quality officer'), finance: E('المسؤول المالي', 'Finance officer'), finance_approver: E('المعتمِد المالي', 'Finance approver'), compliance: E('مسؤول الامتثال', 'Compliance officer'), iot_engineer: E('مهندس إنترنت الأشياء', 'IoT engineer'), customer_service: E('خدمة العملاء', 'Customer service'), executive: E('الإدارة التنفيذية', 'Executive'), courier: E('مندوب', 'Courier'), partner: E('ناقل شريك', 'Carrier partner'), corp_admin: E('مدير المؤسسة', 'Corporate admin'), branch_manager: E('مدير الفرع', 'Branch manager'), branch_operator: E('مشغّل الفرع', 'Branch operator'), branch_viewer: E('مشاهد الفرع', 'Branch viewer'), corp_finance: E('مالية المؤسسة', 'Corporate finance'), individual: E('عميل فرد', 'Individual customer'), receiving_lab: E('مختبر الاستلام', 'Receiving laboratory'),
  },
  shipmentStatus: { draft: E('مسودة', 'Draft'), confirmed: E('مؤكدة', 'Confirmed'), pickup_scheduled: E('جُدول الاستلام', 'Pickup scheduled'), collected: E('تم الاستلام', 'Collected'), in_transit: E('في الطريق', 'In transit'), at_handover: E('عند نقطة التسليم', 'At handover'), delivered: E('تم التسليم', 'Delivered'), failed: E('تعذّر التسليم', 'Delivery failed'), return_pending: E('بانتظار الإرجاع', 'Return pending'), returned: E('تم الإرجاع', 'Returned'), cancelled: E('ملغاة', 'Cancelled'), exception: E('استثناء', 'Exception'), in_air_transit: E('على متن رحلة', 'In air transit') },
  thermal: { chilled: E('مبرّد', 'Chilled'), frozen: E('مجمّد', 'Frozen'), ambient: E('محيط', 'Ambient') },
  level: { standard: E('عادي', 'Standard'), express: E('سريع', 'Express'), stat: E('عاجل STAT', 'STAT') },
  requestType: { on_demand: E('عند الطلب', 'On demand'), scheduled: E('مجدول', 'Scheduled'), recurring: E('متكرر', 'Recurring') },
  mode: { road: E('بري', 'Road'), road_air: E('بري + جوي', 'Road + air'), air: E('جوي', 'Air') },
  boxStatus: { available: E('متاح', 'Available'), assigned: E('مُسند', 'Assigned'), in_use: E('قيد الاستخدام', 'In use'), returning: E('عائد للمستودع', 'Returning'), cleaning: E('تنظيف', 'Cleaning'), inspection: E('فحص', 'Inspection'), maintenance: E('صيانة', 'Maintenance'), partner_custody: E('لدى شريك', 'Partner custody'), retired: E('متقاعد', 'Retired') },
  deviceState: { ready: E('جاهز', 'Ready'), assigned: E('مُسند', 'Assigned'), low_battery: E('بطارية منخفضة', 'Low battery'), offline: E('غير متصل', 'Offline'), maintenance: E('صيانة', 'Maintenance'), faulty: E('معطل', 'Faulty'), suspended: E('موقوف', 'Suspended'), retired: E('متقاعد', 'Retired') },
  freshness: { live: E('مباشر', 'Live'), delayed: E('متأخر', 'Delayed'), stale: E('قديم', 'Stale'), none: E('لا بيانات', 'No data'), inferred: E('مستنتج', 'Inferred'), planned: E('مخطط', 'Planned'), manual: E('يدوي', 'Manual') },
  custodian: { customer: E('العميل', 'Customer'), courier: E('المندوب', 'Courier'), warehouse: E('المستودع', 'Warehouse'), partner: E('شريك', 'Partner'), air_carrier: E('الناقل الجوي', 'Air carrier'), recipient: E('المستلم', 'Recipient') },
  severity: { critical: E('حرج', 'Critical'), high: E('مرتفع', 'High'), medium: E('متوسط', 'Medium'), low: E('منخفض', 'Low'), major: E('رئيسي', 'Major'), minor: E('طفيف', 'Minor') },
  excursionStatus: { open: E('مفتوح', 'Open'), acknowledged: E('تم الإقرار', 'Acknowledged'), under_review: E('قيد المراجعة', 'Under review'), closed: E('مغلق', 'Closed') },
  incidentStatus: { open: E('مفتوح', 'Open'), investigating: E('قيد التحقيق', 'Investigating'), decision: E('بانتظار القرار', 'Decision'), closed: E('مغلق', 'Closed') },
  claimStatus: { submitted: E('مقدّمة', 'Submitted'), investigating: E('قيد التحقيق', 'Investigating'), assessed: E('مقيّمة', 'Assessed'), approved: E('معتمدة', 'Approved'), rejected: E('مرفوضة', 'Rejected'), closed: E('مغلقة', 'Closed') },
  invoiceStatus: { draft: E('مسودة', 'Draft'), issued: E('صادرة', 'Issued'), partially_paid: E('مدفوعة جزئياً', 'Partially paid'), paid: E('مدفوعة', 'Paid'), overdue: E('متأخرة', 'Overdue'), void: E('ملغاة', 'Void') },
  settlementStatus: { draft: E('مسودة', 'Draft'), reconciled: E('مطابَقة', 'Reconciled'), approved: E('معتمدة', 'Approved'), paid: E('مدفوعة', 'Paid'), disputed: E('محل خلاف', 'Disputed') },
  licenseStatus: { valid: E('ساري', 'Valid'), expiring: E('ينتهي قريباً', 'Expiring'), expired: E('منتهٍ', 'Expired'), pending_verification: E('بانتظار التحقق', 'Pending verification') },
  approvalKind: { device_exception: E('استثناء جاهزية', 'Readiness exception'), credit_note: E('إشعار دائن', 'Credit note'), settlement: E('تسوية شريك', 'Partner settlement'), rate_plan: E('تعرفة', 'Tariff'), config: E('إعداد نظام', 'System setting'), cost_override: E('تجاوز توزيع تكلفة', 'Cost override'), device_command: E('أمر جهاز', 'Device command'), lost_declaration: E('إعلان فقدان', 'Loss declaration'), claim_resolution: E('قرار مطالبة', 'Claim resolution') },
  nav: {
    controlTower: E('برج التحكم', 'Control tower'), map: E('خريطة الشحنات', 'Shipment map'), shipments: E('الشحنات', 'Shipments'), newShipment: E('شحنة جديدة', 'New shipment'), dispatch: E('التوزيع', 'Dispatch'), routes: E('المسارات', 'Routes'), legs: E('أرجل النقل', 'Transport legs'), couriers: E('المندوبون', 'Couriers'), vehicles: E('المركبات', 'Vehicles'), partners: E('الشركاء والناقلون', 'Partners & carriers'),
    boxes: E('الصناديق', 'Boxes'), devices: E('أجهزة GPT45-M', 'GPT45-M devices'), gateway: E('كونسول البوابة', 'Gateway console'), commands: E('أوامر الأجهزة', 'Device commands'),
    excursions: E('الانحرافات الحرارية', 'Excursions'), profiles: E('الملفات الحرارية', 'Thermal profiles'), incidents: E('حوادث الجودة', 'Quality incidents'), capa: E('CAPA', 'CAPA'), claims: E('المطالبات', 'Claims'), lost: E('المفقود والتالف', 'Lost & damaged'), returns: E('المرتجعات', 'Returns'),
    inventory: E('المخزون والحركات', 'Inventory'), cleaning: E('التنظيف والتأهيل', 'Cleaning & qualification'), partnerCustody: E('الحيازة لدى الشركاء', 'Partner custody'), consumables: E('المستهلكات', 'Consumables'),
    customers: E('العملاء', 'Customers'), contracts: E('العقود', 'Contracts'), ratePlans: E('التعرفة', 'Tariffs'), simulations: E('محاكاة التسعير', 'Pricing simulation'), quotes: E('عروض الأسعار', 'Quotes'),
    invoices: E('الفواتير', 'Invoices'), creditNotes: E('الإشعارات الدائنة', 'Credit notes'), payments: E('المدفوعات والتسوية', 'Payments'), accounts: E('دليل الحسابات', 'Chart of accounts'), journals: E('قيود اليومية', 'Journals'), arap: E('الذمم والأعمار', 'AR/AP & aging'), costs: E('التكاليف والتوزيع', 'Costs & allocation'), settlements: E('تسويات الشركاء', 'Partner settlements'),
    requirements: E('متطلبات الامتثال', 'Requirements'), licenses: E('التراخيص والمؤهلات', 'Licenses'), blocks: E('الحظر التشغيلي', 'Operational blocks'), retention: E('الاحتفاظ والأرشفة', 'Retention'), legalHolds: E('الحجز القانوني', 'Legal holds'),
    reportsOps: E('التقارير التشغيلية', 'Operations reports'), reportsFin: E('التقارير المالية', 'Finance reports'), delays: E('تنبيهات التأخير', 'Delay alerts'),
    notifications: E('الإشعارات والقوالب', 'Notifications & templates'), integrations: E('التكاملات', 'Integrations'), settings: E('إعدادات النظام', 'Settings'), approvals: E('صندوق الاعتمادات', 'Approvals'), users: E('المستخدمون والصلاحيات', 'Users & roles'), audit: E('سجل التدقيق', 'Audit log'), security: E('الأمن والجلسات', 'Security & sessions'), health: E('صحة النظام والنسخ', 'System health & backup'),
    groups: { ops: E('العمليات', 'Operations'), assets: E('الأصول وIoT', 'Assets & IoT'), quality: E('الجودة', 'Quality'), warehouse: E('المستودع', 'Warehouse'), commercial: E('العملاء والتجاري', 'Customers & commercial'), finance: E('المالية', 'Finance'), compliance: E('الامتثال', 'Compliance'), reports: E('التقارير', 'Reports'), system: E('النظام', 'System') },
    home: E('الرئيسية', 'Home'), myShipments: E('شحناتي', 'My shipments'), track: E('تتبع', 'Track'), recurring: E('الاستلامات المتكررة', 'Recurring pickups'), addresses: E('العناوين', 'Addresses'), branches: E('الفروع', 'Branches'), members: E('المستخدمون', 'Users'), billing: E('الفواتير والمدفوعات', 'Billing'), api: E('تكامل API', 'API & webhooks'), inbound: E('الشحنات الواردة', 'Inbound shipments'), account: E('الحساب', 'Account'), tasks: E('المهام', 'Tasks'), scan: E('مسح', 'Scan'), sync: E('المزامنة', 'Sync'), history: E('السجل', 'History'),
  },
  ship: {
    tracking: E('رقم التتبع', 'Tracking no.'), sender: E('المرسل', 'Sender'), receiver: E('المستلم', 'Receiver'), pickupWindow: E('نافذة الاستلام', 'Pickup window'), deliverBy: E('التسليم قبل', 'Deliver by'), thermalClass: E('الفئة الحرارية', 'Thermal class'), serviceLevel: E('مستوى الخدمة', 'Service level'), items: E('العناصر', 'Items'), weight: E('الوزن (كجم)', 'Weight (kg)'), quantity: E('الكمية', 'Quantity'), dedicatedBox: E('صندوق مخصص', 'Dedicated box'), price: E('السعر', 'Price'), vat: E('ضريبة القيمة المضافة 15%', 'VAT 15%'), coveredByContract: E('مشمول بالعقد', 'Covered by contract'),
    timeline: E('الخط الزمني', 'Timeline'), custody: E('الحيازة', 'Custody'), temperature: E('الحرارة', 'Temperature'), legs: E('الأرجل', 'Legs'), pod: E('إثبات التسليم', 'Proof of delivery'), billing: E('الفوترة', 'Billing'), incidents: E('الحوادث', 'Incidents'),
    lastConfirmed: E('آخر موقع مؤكد', 'Last confirmed position'), lastKnownReading: E('آخر قراءة معروفة', 'Last known reading'), atTime: E('في', 'at'), noLiveInFlight: E('لا يُعرض موقع حي أثناء الطيران', 'No live position is shown during flight'), eta: E('الوصول المتوقع', 'ETA'), etaUnavailable: E('غير متاح', 'Unavailable'), confidence: E('الثقة', 'Confidence'),
    gap: E('فجوة بيانات', 'Data gap'), gapNotCompliance: E('الفجوة لا تعني الالتزام', 'A gap does not imply compliance'), inRange: E('ضمن النطاق', 'In range'), clinicalDisclaimer: E('القرار السريري للمؤسسة المستلمة فقط', 'Clinical decision belongs to the receiving institution only'), disposition: E('قرار المؤسسة المستلمة', 'Receiving institution decision'),
    create: E('إنشاء شحنة', 'Create shipment'), stepRoute: E('المسار', 'Route'), stepSample: E('العينة والخدمة', 'Sample & service'), stepSchedule: E('الموعد', 'Schedule'), stepReview: E('المراجعة والسعر', 'Review & price'), cancelShipment: E('إلغاء الشحنة', 'Cancel shipment'), reschedule: E('إعادة الجدولة', 'Reschedule'), requestReturn: E('طلب إرجاع', 'Request return'), fileClaim: E('تقديم مطالبة', 'File claim'), downloadReport: E('تنزيل تقرير الحرارة', 'Download temperature report'),
  },
  courier: { startShift: E('بدء المناوبة', 'Start shift'), endShift: E('إنهاء المناوبة', 'End shift'), scanShipment: E('امسح رمز الشحنة', 'Scan shipment QR'), scanBox: E('امسح رمز الصندوق', 'Scan box QR'), manualEntry: E('إدخال يدوي', 'Manual entry'), confirmPickup: E('تأكيد الاستلام', 'Confirm pickup'), startTransit: E('بدء النقل', 'Start transit'), arrive: E('وصلت', 'Arrived'), handover: E('نقل الحيازة', 'Hand over'), deliver: E('تسليم', 'Deliver'), recipientName: E('اسم المستلم', 'Recipient name'), signHere: E('وقّع هنا', 'Sign here'), photo: E('صورة (اختياري)', 'Photo (optional)'), failAttempt: E('تعذّر التسليم', 'Could not deliver'), offline: E('دون اتصال', 'Offline'), online: E('متصل', 'Online'), queued: E('في الطابور', 'Queued'), syncNow: E('مزامنة الآن', 'Sync now'), conflicts: E('تعارضات', 'Conflicts'), cameraSimulated: E('كاميرا محاكاة — اختر رمزاً أو أدخله يدوياً', 'Simulated camera — pick a code or type it') },
  errors: { network: E('تعذّر الاتصال بالخادم', 'Could not reach the server'), forbidden: E('ليست لديك صلاحية', 'You do not have permission'), notFound: E('غير موجود', 'Not found'), validation: E('تحقق من الحقول المظللة', 'Check the highlighted fields') },
} as const;

/** الوصول بمسار نقطي: t(lang, 'nav.shipments') */
export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const v = key.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), dict);
  let s = v && typeof v === 'object' && 'ar' in v ? (v as Entry)[lang] : key;
  if (vars) for (const [k, x] of Object.entries(vars)) s = s.replace(`{${k}}`, String(x));
  return s;
}
export const L = (lang: Lang, l: { ar: string; en: string } | null | undefined) => (l ? l[lang] : '');
export const dir = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr');

// ---------- المنسّقات (BR-011: التخزين UTC والعرض بتوقيت الرياض) ----------
const TZ = 'Asia/Riyadh';
const loc = (lang: Lang) => (lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB');
export const fmtDateTime = (lang: Lang, iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(loc(lang), { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: lang === 'en' ? false : true }).format(new Date(iso)) : '—');
export const fmtDate = (lang: Lang, iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(loc(lang), { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—');
export const fmtTime = (lang: Lang, iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(loc(lang), { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: lang !== 'en' }).format(new Date(iso)) : '—');
export const fmtNumber = (lang: Lang, n: number | null | undefined, digits = 0) => (n == null ? '—' : new Intl.NumberFormat(loc(lang), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n));
/** المبالغ مخزنة بالهللة — تُعرض بالريال */
export const fmtSAR = (lang: Lang, halala: number | null | undefined) => (halala == null ? '—' : `${new Intl.NumberFormat(loc(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(halala / 100)} ${lang === 'ar' ? 'ر.س' : 'SAR'}`);
export const fmtTemp = (lang: Lang, c: number | null | undefined) => (c == null ? '—' : `${fmtNumber(lang, c, 1)} °${lang === 'ar' ? 'م' : 'C'}`);
export function fmtRelative(lang: Lang, iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '—';
  const m = Math.round((Date.parse(iso) - now) / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  if (Math.abs(m) < 60) return rtf.format(m, 'minute');
  if (Math.abs(m) < 1440) return rtf.format(Math.round(m / 60), 'hour');
  return rtf.format(Math.round(m / 1440), 'day');
}
/** عزل المعرّفات والأرقام اللاتينية داخل نص عربي (أرقام التتبع، IMEI، الجوال) */
export const ltr = (s: string | number) => `⁦${s}⁩`;
export const maskPhone = (p: string) => (p ? p.replace(/(\+9665)\d{4}(\d{4})/, '$1••••$2') : '');

/** تصدير ARB لتطبيقات Flutter */
export function toArb(lang: Lang) {
  const out: Record<string, string> = { '@@locale': lang };
  const walk = (o: any, prefix: string) => { for (const [k, v] of Object.entries(o)) { const key = (prefix ? prefix + '_' : '') + k; if (v && typeof v === 'object' && 'ar' in (v as any)) out[key.replace(/[^a-zA-Z0-9_]/g, '_')] = (v as Entry)[lang]; else walk(v, key); } };
  walk(dict, '');
  return out;
}
