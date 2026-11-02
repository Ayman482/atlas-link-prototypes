import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'package:atlas_customer/main.dart';

/// خادم مزيّف صغير يحاكي عقد packages/mock-api لاختبارات الواجهة دون شبكة
MockClient fakeApi(List<String> log) => MockClient((r) async {
  final p = r.url.path; log.add('${r.method} $p');
  Map<String, dynamic> ok(Object d) => {'data': d};
  if (p.endsWith('/auth/login')) return http.Response(jsonEncode({'token': 'tok'}), 200);
  if (p.endsWith('/queries/me')) return http.Response.bytes(utf8.encode(jsonEncode(ok({'user': {'name': {'ar': 'د. أحمد الزامل', 'en': 'Dr. Ahmed'}, 'email': 'corp.admin@medlog.demo'}, 'roles': ['corp_admin'], 'organizations': [{'id': 'org_nkh'}]}))), 200);
  if (p.endsWith('/queries/customer.dashboard')) return http.Response.bytes(utf8.encode(jsonEncode(ok({'totals': {'active': 6, 'delivered': 5, 'excursions': 1}, 'recent': [{'id': 'shp_1', 'trackingNo': 'ML-2026-000001', 'status': 'in_transit', 'thermalClass': 'chilled', 'serviceLevel': 'standard', 'originCity': 'RUH', 'destCity': 'JED', 'deliverBy': '2026-11-02T18:00:00Z'}], 'openInvoices': []}))), 200);
  if (p.endsWith('/queries/list')) return http.Response.bytes(utf8.encode(jsonEncode(ok({'items': [{'code': 'RUH', 'name': {'ar': 'الرياض', 'en': 'Riyadh'}}, {'code': 'JED', 'name': {'ar': 'جدة', 'en': 'Jeddah'}}]}))), 200);
  return http.Response(jsonEncode({'error': {'code': 'NOT_FOUND', 'message_ar': 'غير موجود', 'message_en': 'Not found'}}), 404);
});

/// حركات مستمرة (النبض والهيكل المتلألئ) تمنع pumpAndSettle؛ نتقدم بالزمن خطوات محددة
Future<void> settle(WidgetTester t) async { for (var i = 0; i < 15; i++) { await t.pump(const Duration(milliseconds: 150)); } }

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('CM01→CM02: دخول بحساب عرض يفتح الرئيسية بالعربية RTL مع المؤشرات الحقيقية', (tester) async {
    final log = <String>[];
    final state = AppState(ApiClient(base: 'http://t/api/v1', client: fakeApi(log)), 'customer');
    await state.load();
    await tester.pumpWidget(CustomerApp(state: state));
    await tester.pumpAndSettle();
    expect(find.text('حسابات العرض'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('حسابات العرض'))), TextDirection.rtl);
    await tester.tap(find.text('د. أحمد الزامل'));
    await settle(tester);
    expect(log, contains('POST /api/v1/auth/login'));
    expect(find.text('ML-2026-000001'), findsOneWidget);
    expect(find.text('الرياض ← جدة · مبرّد · عادي'), findsOneWidget);
    expect(find.text('طلب استلام جديد'), findsOneWidget);
  });

  testWidgets('تبديل اللغة إلى الإنجليزية يقلب الاتجاه إلى LTR', (tester) async {
    final state = AppState(ApiClient(base: 'http://t/api/v1', client: fakeApi([])), 'customer');
    await state.load();
    await tester.pumpWidget(CustomerApp(state: state));
    await tester.pumpAndSettle();
    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();
    expect(find.text('Demo accounts'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('Demo accounts'))), TextDirection.ltr);
  });

  testWidgets('تقليل الحركة: المحتوى يظهر فوراً دون انتظار الحركة', (tester) async {
    final state = AppState(ApiClient(base: 'http://t/api/v1', client: fakeApi([])), 'customer');
    await state.load();
    await tester.pumpWidget(MediaQuery(data: const MediaQueryData(disableAnimations: true), child: CustomerApp(state: state)));
    await tester.pump();
    expect(find.text('حسابات العرض'), findsOneWidget);
  });
}
