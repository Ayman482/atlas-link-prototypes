import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:atlas_shared/atlas_shared.dart';

/// اختبار عقد حي مقابل خادم المحاكاة الحقيقي (packages/mock-api):
///   npm run api:reset   ثم   LIVE_API=http://localhost:4000/api/v1 flutter test test/live_api_test.dart
/// يغطي رحلة المندوب: دخول ← المهام ← مسح وتعبئة ← استلام ← بدء النقل ← تسليم بإثبات.
void main() {
  final base = Platform.environment['LIVE_API'];
  test('رحلة مندوب كاملة عبر الخادم', () async {
    final api = ApiClient(base: base);
    final l = await api.login('courier1@medlog.demo', 'Demo@2026');
    expect(l.token, isNotNull);
    final d = await api.query('courier.tasks');
    final t = (d['tasks'] as List).firstWhere((x) => x['kind'] == 'pickup');
    final boxes = [if (t['plannedBox'] != null) t['plannedBox'], for (final b in d['boxesInCustody'] as List) if (b['thermalClass'] == t['thermalClass']) b['code']];
    ApiException? last; var packed = false;
    for (final code in boxes) { try { await api.exec('courier.scanPack', {'shipment': t['shipmentId'], 'boxCode': code}); packed = true; break; } on ApiException catch (e) { last = e; } }
    expect(packed, isTrue, reason: 'لا صندوق صالح: ${last?.code}');
    await api.exec('courier.pickup', {'shipment': t['shipmentId'], 'signedBy': 'اختبار Flutter', 'method': 'signature'});
    await api.exec('courier.startTransit', {'shipment': t['shipmentId']});
    final after = ((await api.query('courier.tasks'))['tasks'] as List).firstWhere((x) => x['shipmentId'] == t['shipmentId']);
    if (after['kind'] == 'delivery') {
      final r = await api.exec('courier.deliver', {'shipment': t['shipmentId'], 'recipientName': 'مختبر', 'signature': 'data:image/png;base64,AA=='});
      expect(r['status'], 'delivered');
    } else {
      expect(after['status'], 'in_transit');
    }
    try { await api.exec('courier.deliver', {'shipment': 'shp_does_not_exist', 'recipientName': 'x', 'signature': 'y'}); fail('expected'); } on ApiException catch (e) { expect(e.status, 404); }
  }, skip: base == null ? 'عيّن LIVE_API لتشغيل اختبار العقد الحي' : false);
}
