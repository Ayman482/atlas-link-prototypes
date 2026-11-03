// يُشغَّل ببناء الإنتاج: flutter test --dart-define=DEMO_MODE=false test/prod_mode_test.dart
// يتحقق أن شاشة الدخول لا تعرض حسابات العرض ولا رمز التحقق ولا شارة «بيانات عرض».
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atlas_shared/atlas_shared.dart';

void main() {
  testWidgets('بناء الإنتاج: لا حسابات عرض ولا رمز عرض ولا شارة عرض في شاشة الدخول', (t) async {
    SharedPreferences.setMockInitialValues({});
    final st = AppState(ApiClient(base: 'http://x'), 'courier');
    await t.pumpWidget(AppScope(state: st, child: MaterialApp(theme: AtlasTheme.light(), locale: const Locale('ar'), supportedLocales: const [Locale('ar'), Locale('en')], localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: const LoginScreen(title: 'x', accounts: [DemoAccount('courier1@medlog.demo', 'محمد', 'Mohammed', 'courier')], allowed: _any))));
    for (var i = 0; i < 10; i++) { await t.pump(const Duration(milliseconds: 100)); }
    expect(find.text('محمد'), kDemoMode ? findsOneWidget : findsNothing);
    expect(find.textContaining('courier1@medlog.demo'), kDemoMode ? findsOneWidget : findsNothing);
    expect(find.text(S('ar').demoBadge), kDemoMode ? findsOneWidget : findsNothing);
  });
}
bool _any(List<String> r) => true;
