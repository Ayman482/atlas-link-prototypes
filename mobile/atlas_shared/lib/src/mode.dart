/// وضع التشغيل يُحدَّد وقت البناء: `--dart-define=DEMO_MODE=false` لبناء الإنتاج.
/// في الإنتاج تُحذف (tree-shaking لأن القيمة ثابتة) قوائم حسابات العرض وكلمة المرور ورمز التحقق المعبّأة مسبقاً وشارة «بيانات عرض».
const bool kDemoMode = bool.fromEnvironment('DEMO_MODE', defaultValue: true);
