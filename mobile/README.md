# تطبيقا Flutter — أطلس لينك (الخيار C · Emerald Health)

| المجلد | المحتوى |
|---|---|
| `atlas_shared/` | مكتبة مشتركة: رموز التصميم المولّدة (`lib/src/theme/tokens.dart`)، السمة الفاتحة والداكنة، عميل خادم المحاكاة، التوطين العربي/الإنجليزي المولّد من نفس مصدر الويب، الحركة (مع احترام «إزالة الحركة»)، ومكوّنات: شارة الحالة، هيكل التحميل، علامة النجاح، منحنى الحرارة التفاعلي، الخط الزمني القابل للتوسيع، لوحة التوقيع، لوحة المسح بحالاتها، شاشة الدخول والتحقق بخطوتين. الخطوط Alexandria وNoto Sans Arabic مضمّنة (رخصة OFL 1.1). |
| `customer_app/` | تطبيق العميل CM01–CM12 |
| `courier_app/` | تطبيق المندوب K01–K14 مع طابور العمل دون اتصال والمزامنة |
| `tool/gen_labels.ts` | يولّد `labels.g.dart` من القاموس المشترك وطبقة توطين الخيار C |

## التشغيل

```bash
# 1) خادم المحاكاة (من جذر المستودع)
npm install && npm run api            # http://localhost:4000/api/v1

# 2) التطبيق — اختر عنوان الخادم حسب الجهاز
cd mobile/customer_app                # أو mobile/courier_app
flutter pub get
flutter run --dart-define=API_BASE=http://10.0.2.2:4000/api/v1    # محاكي Android
flutter run --dart-define=API_BASE=http://localhost:4000/api/v1    # محاكي iOS أو الويب (-d chrome)
flutter run --dart-define=API_BASE=http://<IP-الحاسوب>:4000/api/v1 # جهاز فعلي على نفس الشبكة
```

### وضع العرض ووضع الإنتاج (Phase 17)

```bash
flutter run   --dart-define=DEMO_MODE=false --dart-define=API_BASE=https://api.example/api/v1   # بناء إنتاجي: لا حسابات عرض ولا رمز MFA تجريبي ولا شارة «بيانات عرض»
flutter build apk --dart-define=DEMO_MODE=false --dart-define=API_BASE=https://api.example/api/v1
```

`DEMO_MODE` ثابت وقت الترجمة (`kDemoMode` في `atlas_shared`)، ولا يمكن تفعيله أثناء التشغيل. الافتراضي `true` للنماذج فقط.

خادم المحاكاة بوضع الإنتاج المحمي: `NODE_ENV=production MEDLOG_SECRET=<32+ حرفاً> CORS_ORIGIN=https://app.example npm run api` — يرفض البدء دون المتغيرين، ويعطّل كل مصادقة العرض (501) وإعادة الضبط والأصل المحلي. لا يوجد مزوّد هوية إنتاجي في النموذج.

### إعدادات خادم المحاكاة (أمن)

| المتغير | الافتراضي | الوصف |
|---|---|---|
| `MEDLOG_SECRET` | عشوائي لكل تشغيل | مفتاح توقيع الرموز. اضبطه لتبقى الجلسات بعد إعادة التشغيل |
| `CORS_ORIGIN` | أصول `localhost` و`127.0.0.1` فقط | قائمة أصول مسموحة مفصولة بفواصل. لتطبيق Flutter Web على عنوان آخر أضِفه هنا |
| `MEDLOG_ENABLE_DEMO_LOGIN` | معطّل | `1` يفعّل الدخول السريع لحسابات العرض غير المحمية بالتحقق بخطوتين فقط |
| `MEDLOG_SESSION_IDLE_MIN` / `MEDLOG_SESSION_MAX_MIN` | 720 / 10080 | انتهاء الجلسة بالخمول وبالحد الأقصى |

الخادم للنماذج فقط (`productionReady: false`) — ليس تكاملاً إنتاجياً.

### العمل دون اتصال (تطبيق المندوب)

- الطابور محفوظ لكل مندوب على حدة.
- أي إجراء يفشل بسبب الشبكة يُحفظ تلقائياً بنفس معرّفه، وهو أيضاً مفتاح Idempotency.
- فتح التطبيق دون شبكة يُبقي المندوب داخله بآخر ملف محفوظ.
- انتهاء الجلسة يعيده لشاشة الدخول دون حذف الطابور.
- مراقبة الاتصال (`ConnectivityMonitor`): نبضة `/health` كل 30 ثانية متصلاً و5 ثوانٍ منقطعاً، وأي خطأ شبكة يحوّل الوضع فوراً؛ عند العودة تُزامن الطابور تلقائياً مرة واحدة.
- إجراء معلّق واحد لكل شحنة لكل نوع (مسح/استلام/تسليم/تعذّر/تسليم لطرف)، وحارس ضد الضغط المزدوج.
- الشريط يميّز «انقطاع فعلي» عن «محاكاة».

ملاحظة Android: الاتصال بخادم HTTP محلي يتطلب السماح بحركة غير مشفرة في بناء التطوير (`android:usesCleartextTraffic="true"` في `AndroidManifest.xml` للتصحيح فقط)، أو تشغيل الخادم خلف HTTPS.

## الاختبار

```bash
cd mobile/atlas_shared && flutter test     # 10 اختبارات: التنسيق وتطابقه مع الويب، التوطين، عقد API، وضع الإنتاج
cd mobile/atlas_shared && flutter test --dart-define=DEMO_MODE=false test/prod_mode_test.dart   # بناء إنتاجي بلا عناصر عرض
cd mobile/customer_app && flutter test     # الدخول بحساب عرض ← الرئيسية بالعربية RTL، تبديل LTR، تقليل الحركة
cd mobile/courier_app && flutter test      # 12 اختباراً: المهام، رمز خاطئ، الطابور، مراقبة الاتصال، المزامنة التلقائية، منع التكرار
# اختبار عقد حي لرحلة مندوب كاملة مقابل الخادم الحقيقي:
npm run api:reset && cd mobile/courier_app && LIVE_API=http://localhost:4000/api/v1 flutter test test/live_api_test.dart
```

## ما تم التحقق منه وما لم يُتحقق منه

- تم: `flutter analyze` بلا ملاحظات للمشاريع الثلاثة، كل الاختبارات أعلاه ناجحة، بناء الويب `flutter build web --release` للتطبيقين، وتشغيله مقابل خادم المحاكاة مع لقطات شاشة (الدخول، الرئيسية، التتبع، المهام، تفاصيل المهمة).
- لم يتم في بيئة التسليم (Phase 17 أيضاً): اختبار على أجهزة أو محاكيات Android/iOS؛ بناء ملفات APK/AAB (لا توجد أدوات Android SDK) أو IPA (يتطلب macOS وXcode). المشروعان يحتويان مجلدي `android/` و`ios/` القياسيين من `flutter create` ولا يستخدمان أي إضافات أصلية غير `shared_preferences`، لذا يُتوقع أن يُبنيا مباشرة على جهاز مطوّر مثبّت عليه الأدوات.
- الكاميرا لمسح QR محاكاة (اختيار رمز أو إدخال يدوي). لتفعيل كاميرا حقيقية تُضاف حزمة مسح (مثل `mobile_scanner`) مع أذونات الكاميرا في `AndroidManifest.xml` و`Info.plist`، وتبقى حالات النجاح/الفشل/إعادة المحاولة في `ScanPanel` كما هي.
