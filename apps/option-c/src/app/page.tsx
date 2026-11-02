// صفحة الخيار C — تجربة رعاية صحية متميزة: روابط التطبيقات الأربعة
const APPS = [
  { href: 'admin/', h: 'linear-gradient(135deg,#087F70,#0B9A87)', ar: 'لوحة الإدارة والعمليات', en: 'Administration & operations', dar: '60 شاشة: برج تحكم حي، خريطة بمسارات متحركة، توزيع، أصول، جودة، مالية، امتثال', den: '60 screens: live control tower, animated route map, dispatch, assets, quality, finance, compliance' },
  { href: 'portal/', h: 'linear-gradient(135deg,#E6A65D,#F2C994)', ar: 'بوابة العملاء', en: 'Customer portal', dar: '20 شاشة للمستشفيات والمختبرات والفروع والأفراد ومختبر الاستلام', den: '20 screens for hospitals, labs, branches, individuals and the receiving lab' },
  { href: 'mobile/customer/', h: 'linear-gradient(135deg,#173B4D,#3D6B80)', ar: 'تطبيق العميل (معاينة)', en: 'Customer app (preview)', dar: 'طلب بخطوات، تتبع حي، تقرير حرارة، دفع', den: 'Step-by-step request, live tracking, temperature report, payment' },
  { href: 'mobile/courier/', h: 'linear-gradient(135deg,#C98A3E,#E6A65D)', ar: 'تطبيق المندوب (معاينة)', en: 'Courier app (preview)', dar: 'مهام، مسح متحرك، توقيع، حيازة، عمل دون اتصال', den: 'Tasks, animated scanning, signatures, custody, offline work' },
];
export default function Home() {
  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '48px max(16px, 4vw)', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <span className="sim" style={{ alignSelf: 'flex-start' }}>بيانات عرض · Demo data</span>
      <h1 style={{ fontSize: '2.2rem', fontWeight: 500 }}>أطلس لينك — الخيار C: تجربة رعاية صحية متميزة</h1>
      <p className="muted">Atlas Link Medical Cargo — Option C: Premium Healthcare Experience. هوية هادئة دافئة بمساحات سخية وحركة ناعمة فوق نفس البيانات والمنطق. كلمة المرور <code>Demo@2026</code> ورمز التحقق <code>123456</code>.</p>
      <div className="grid">{APPS.map((a, i) => <a key={a.href} href={a.href} className="card" style={{ textDecoration: 'none', color: 'inherit', animationDelay: `${i * 90}ms` }}>
        <span style={{ height: 6, borderRadius: 6, background: a.h }} />
        <h2 style={{ fontSize: '1.25rem' }}>{a.ar}</h2><p className="muted">{a.en}</p><p>{a.dar}</p><p className="muted">{a.den}</p></a>)}</div>
    </main>
  );
}
