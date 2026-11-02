import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'package:atlas_courier/main.dart';
import 'package:atlas_courier/offline.dart';

final task = {'shipmentId': 'shp_9', 'trackingNo': 'ML-2026-000009', 'qrToken': 'q9', 'status': 'pickup_scheduled', 'kind': 'pickup', 'mine': false, 'thermalClass': 'chilled', 'serviceLevel': 'stat', 'pickupWindowStart': '2026-11-02T16:00:00Z', 'deliverBy': '2026-11-02T19:00:00Z', 'sender': {'label': {'ar': 'فرع العليا', 'en': 'Olaya'}, 'contactName': 'أ. فهد', 'contactPhone': '+966500000000', 'lat': 24.7, 'lng': 46.6}, 'receiver': {'label': {'ar': 'المختبر', 'en': 'Lab'}, 'lat': 24.8, 'lng': 46.7}, 'organization': {'ar': 'مستشفى', 'en': 'Hospital'}, 'items': [{'descriptionCode': 'BLOOD_TUBES', 'quantity': 4}], 'box': null, 'plannedBox': 'BX-CS-001', 'seq': 7, 'mode': 'road', 'lastReading': null};

MockClient fakeApi(List<String> log) => MockClient((r) async {
  final p = r.url.path; log.add('${r.method} $p ${r.body}');
  Map<String, dynamic> ok(Object d) => {'data': d};
  http.Response j(Object o) => http.Response.bytes(utf8.encode(jsonEncode(o)), 200);
  if (p.endsWith('/auth/login')) return j({'token': 'tok'});
  if (p.endsWith('/queries/me')) return j(ok({'user': {'name': {'ar': 'محمد الدوسري', 'en': 'Mohammed'}, 'email': 'courier1@medlog.demo'}, 'roles': ['courier']}));
  if (p.endsWith('/queries/courier.tasks')) return j(ok({'courier': {'id': 'cou_1', 'status': 'on_route', 'employmentType': 'employee', 'qualificationExpiry': '2027-01-01T00:00:00Z'}, 'vehicle': null, 'tasks': [task], 'boxesInCustody': [], 'conflicts': [], 'partners': [], 'warehouses': [], 'colleagues': []}));
  if (p.endsWith('/commands/courier.sync')) return j(ok({'results': [{'clientActionId': jsonDecode(r.body)['actions'][0]['clientActionId'], 'status': 'accepted', 'message': {'ar': 'تمت المزامنة', 'en': 'Synced'}}]}));
  return j(ok({}));
});

/// حركات مستمرة (النبض والهيكل المتلألئ) تمنع pumpAndSettle؛ نتقدم بالزمن خطوات محددة
Future<void> settle(WidgetTester t) async { for (var i = 0; i < 15; i++) { await t.pump(const Duration(milliseconds: 150)); } }

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('K01→K02→K05: المهام ثم مسح رمز خاطئ يعرض الفشل وإعادة المحاولة', (tester) async {
    final log = <String>[];
    final state = AppState(ApiClient(base: 'http://t/api/v1', client: fakeApi(log)), 'courier');
    await state.load(); await OfflineQueue.instance.load();
    await tester.pumpWidget(CourierApp(state: state));
    await tester.pumpAndSettle();
    await tester.tap(find.text('محمد الدوسري'));
    await settle(tester);
    expect(find.text('فرع العليا'), findsOneWidget);
    await tester.tap(find.text('فرع العليا'));
    await settle(tester);
    expect(find.text('امسح رمز الشحنة'), findsOneWidget);
    await tester.tap(find.textContaining('ML-2026-999999'));
    await settle(tester);
    expect(find.text('هذا الرمز لا يخص هذه المهمة. تأكد من ملصق الشحنة.'), findsOneWidget);
    expect(find.text('إعادة المحاولة'), findsOneWidget);
  });

  test('الطابور دون اتصال يحتفظ بمعرّف فريد ويُرسل للمزامنة ثم يُفرّغ', () async {
    final log = <String>[];
    final state = AppState(ApiClient(base: 'http://t/api/v1', client: fakeApi(log)), 'courier');
    final q = OfflineQueue.instance; await q.load(); q.offline = true;
    final executed = await q.act(state, 'pickup', 'courier.pickup', 'shp_9', {'signedBy': 'x'}, 'استلام');
    expect(executed, isFalse);
    expect(q.items.single['clientActionId'], startsWith('ca-'));
    q.offline = false;
    await q.sync(state);
    expect(q.items, isEmpty);
    expect(q.lastResults.single['status'], 'accepted');
    expect(log.last, contains('/commands/courier.sync'));
  });
}
