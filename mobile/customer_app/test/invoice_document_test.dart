import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'package:atlas_customer/pages/invoice_document.dart';
import 'package:atlas_customer/pages/invoice_pdf.dart';

/// Phase 17.1 — الفاتورة الضريبية في تطبيق العميل. المستند في fixtures مولَّد من الاستعلام الحقيقي invoice.document
/// (packages/core) لضمان تطابق البيانات مع الويب: npx tsx mobile/tool/gen_invoice_fixtures.ts
Map<String, dynamic> fixture(String id) => (jsonDecode(File('test/fixtures/$id.json').readAsStringSync()) as Map).cast<String, dynamic>();

MockClient api(Map<String, dynamic> doc, List<String> log) => MockClient((r) async {
      log.add('${r.method} ${r.url.path}');
      if (r.url.path.endsWith('/queries/invoice.document')) return http.Response.bytes(utf8.encode(jsonEncode({'data': doc})), 200);
      return http.Response(jsonEncode({'error': {'code': 'NOT_FOUND'}}), 404);
    });

Future<void> settle(WidgetTester t) async { for (var i = 0; i < 12; i++) { await t.pump(const Duration(milliseconds: 150)); } }

Future<AppState> mount(WidgetTester tester, Map<String, dynamic> doc, String lang, List<String> log) async {
  final st = AppState(ApiClient(base: 'http://t/api/v1', client: api(doc, log)), 'customer')..lang = lang;
  await tester.binding.setSurfaceSize(const Size(412, 1600));
  await tester.pumpWidget(AppScope(state: st, child: MaterialApp(theme: AtlasTheme.light(), home: Directionality(textDirection: lang == 'ar' ? TextDirection.rtl : TextDirection.ltr, child: InvoiceDocumentPage(invoiceId: '${(doc['invoice'] as Map)['id']}')))));
  await settle(tester);
  return st;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('معاينة الفاتورة بالعربية: النوع والأرقام الضريبية والإجماليات وQR وتنبيه المحاكاة', (tester) async {
    final doc = fixture('inv_0001'); final log = <String>[];
    await mount(tester, doc, 'ar', log);
    expect(log, contains('GET /api/v1/queries/invoice.document'));
    expect(find.textContaining('فاتورة ضريبية'), findsWidgets);
    expect(find.textContaining('310987654300003'), findsOneWidget);
    expect(find.textContaining('محاكاة'), findsWidgets);
    expect(find.text('تنزيل PDF'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('تنزيل PDF'))), TextDirection.rtl);
    final total = Fmt('ar').sar((doc['totals'] as Map)['total'] as num);
    expect(find.text(total), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('تبديل لغة المستند إلى الإنجليزية يقلب الاتجاه إلى LTR دون أخطاء تخطيط', (tester) async {
    await mount(tester, fixture('inv_0022'), 'ar', []);
    await tester.tap(find.text('English'));
    await settle(tester);
    expect(find.text('Download PDF'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('Download PDF'))), TextDirection.ltr);
    expect(find.textContaining('Line items (26)'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('ملف PDF بحجم A4 بالعربية والإنجليزية (فاتورة من سطر واحد وفاتورة من 26 بنداً)', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    Directory('build/invoice_pdf').createSync(recursive: true);
    for (final id in ['inv_0001', 'inv_0022']) {
      for (final lang in ['ar', 'en']) {
        final bytes = await buildInvoicePdf(fixture(id), lang);
        final s = latin1.decode(bytes, allowInvalid: true);
        expect(s.startsWith('%PDF-'), isTrue);
        expect(RegExp(r'/MediaBox\s*\[\s*0\s+0\s+595\.27\d*\s+841\.88\d*\s*\]').hasMatch(s), isTrue, reason: 'A4');
        File('build/invoice_pdf/flutter_${id}_$lang.pdf').writeAsBytesSync(bytes);
      }
    }
  });
}
