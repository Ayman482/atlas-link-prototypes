// صفحة الخيار A — روابط التطبيقات الأربعة
const APPS = [
  { href: 'admin/', ar: 'لوحة الإدارة والعمليات', en: 'Admin & operations', dar: '60 شاشة: برج التحكم، التوزيع، الأصول، الجودة، المالية، الامتثال، النظام', den: '60 screens: control tower, dispatch, assets, quality, finance, compliance, system' },
  { href: 'portal/', ar: 'بوابة العملاء', en: 'Customer portal', dar: '20 شاشة للمستشفيات والمختبرات والفروع والأفراد ومختبر الاستلام', den: '20 screens for hospitals, labs, branches, individuals and the receiving lab' },
  { href: 'mobile/customer/', ar: 'تطبيق العميل (معاينة)', en: 'Customer app (preview)', dar: 'معاينة متصفح لتطبيق Flutter', den: 'Browser preview of the Flutter app' },
  { href: 'mobile/courier/', ar: 'تطبيق المندوب (معاينة)', en: 'Courier app (preview)', dar: 'المهام، المسح، الحيازة، التسليم، العمل دون اتصال', den: 'Tasks, scanning, custody, delivery, offline work' },
];
export default function Home() {
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '40px max(16px, 4vw)', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <span className="sim" style={{ alignSelf: 'flex-start' }}>بيانات عرض · Demo data</span>
      <h1>أطلس لينك للشحن الطبي — الخيار A: المؤسسي الحديث</h1>
      <p className="muted">Atlas Link Medical Cargo — Option A: Modern Enterprise. التطبيقات الأربعة تتشارك نفس البيانات داخل هذا المتصفح؛ افتحها في تبويبات منفصلة لترى التغييرات تنتقل بينها.</p>
      <div className="grid">{APPS.map((a) => <a key={a.href} href={a.href} className="card" style={{ textDecoration: 'none', color: 'inherit' }}><h2>{a.ar}</h2><p className="muted">{a.en}</p><p>{a.dar}</p><p className="muted">{a.den}</p></a>)}</div>
    </main>
  );
}
