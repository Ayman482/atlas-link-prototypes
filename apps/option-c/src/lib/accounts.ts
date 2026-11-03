// حسابات العرض لكل تطبيق (مطابقة لبيانات seed)
import type { DemoAcct } from './login';
import { IS_DEMO } from '@medlog/client';
// في بناء الإنتاج تكون كل القوائم فارغة (يُحذف المحتوى من الحزمة لأن IS_DEMO ثابت وقت البناء)
const A = (email: string, ar: string, en: string, role: string): DemoAcct => ({ email, name: { ar, en }, role });
export const ADMIN_ACCOUNTS: DemoAcct[] = !IS_DEMO ? [] : [
  A('admin@medlog.demo', 'م. ياسر القرني', 'Eng. Yasser Al-Qarni', 'super_admin'), A('ops@medlog.demo', 'أ. منى الرشيد', 'Mona Al-Rashid', 'ops_controller'),
  A('warehouse@medlog.demo', 'أ. عمر الجهني', 'Omar Al-Juhani', 'warehouse'), A('quality@medlog.demo', 'د. هند الفيصل', 'Dr. Hind Al-Faisal', 'quality'),
  A('finance@medlog.demo', 'أ. فيصل البلوي', 'Faisal Al-Balawi', 'finance'), A('approver@medlog.demo', 'أ. نوف العمري', 'Nouf Al-Omari', 'finance_approver'),
  A('compliance@medlog.demo', 'أ. رائد السهلي', 'Raed Al-Sahli', 'compliance'), A('iot@medlog.demo', 'م. عبير الحازمي', 'Eng. Abeer Al-Hazmi', 'iot_engineer'),
  A('support@medlog.demo', 'أ. شهد المالكي', 'Shahad Al-Malki', 'customer_service'), A('exec@medlog.demo', 'أ. سعود الراجحي', 'Saud Al-Rajhi', 'executive'),
  A('partner@medlog.demo', 'أ. حمد — الصحراء', 'Hamad (Sahra Logistics)', 'partner'),
];
export const PORTAL_ACCOUNTS: DemoAcct[] = !IS_DEMO ? [] : [
  A('corp.admin@medlog.demo', 'د. أحمد الزامل', 'Dr. Ahmed Al-Zamil', 'corp_admin'), A('branch.op@medlog.demo', 'أ. سارة العتيبي', 'Sara Al-Otaibi', 'branch_operator'),
  A('corp.finance@medlog.demo', 'أ. وليد التميمي', 'Waleed Al-Tamimi', 'corp_finance'), A('individual@medlog.demo', 'عبدالله المطيري', 'Abdullah Al-Mutairi', 'individual'),
  A('lab@medlog.demo', 'د. ليلى الحمدان', 'Dr. Layla Al-Hamdan', 'receiving_lab'),
];
export const COURIER_ACCOUNTS: DemoAcct[] = !IS_DEMO ? [] : [A('courier1@medlog.demo', 'محمد الدوسري', 'Mohammed Al-Dosari', 'courier'), A('courier2@medlog.demo', 'ناصر اليامي', 'Nasser Al-Yami', 'courier')];
export const CUSTOMER_APP_ACCOUNTS = PORTAL_ACCOUNTS.filter((a) => a.role !== 'receiving_lab');
