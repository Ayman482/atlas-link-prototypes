// وضع التشغيل يُحدَّد وقت البناء: «demo» (النماذج والمعاينات المستضافة) أو «production».
// في production: لا محرك محلي داخل المتصفح (هويته = معرّف المستخدم، أي قابل للانتحال)، ولا دخول سريع، ولا قوائم حسابات العرض.
// Next.js يستبدل process.env.NEXT_PUBLIC_MEDLOG_MODE بقيمة ثابتة وقت البناء، فتُحذف فروع العرض من حزمة الإنتاج.
export type MedlogMode = 'demo' | 'production';
export const MEDLOG_MODE: MedlogMode = process.env.NEXT_PUBLIC_MEDLOG_MODE === 'production' ? 'production' : 'demo';
export const IS_DEMO = MEDLOG_MODE === 'demo';
