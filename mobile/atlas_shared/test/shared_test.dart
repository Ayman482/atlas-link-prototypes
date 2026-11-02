import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:atlas_shared/atlas_shared.dart';

void main() {
  group('Fmt', () {
    test('الريال من الهللات مع فواصل الآلاف', () {
      expect(const Fmt('ar').sar(2118300), '21,183.00 ر.س');
      expect(const Fmt('en').sar(2118300), 'SAR 21,183.00');
    });
    test('التاريخ بتوقيت الرياض (UTC+3)', () {
      expect(const Fmt('en').dt('2026-11-02T18:30:00Z'), '02 Nov, 09:30 PM');
      expect(const Fmt('ar').dt('2026-11-02T06:05:00Z'), '02 نوفمبر، 09:05 ص');
    });
  });

  group('S (التوطين)', () {
    test('تسميات الحالات من نفس مصدر الويب، والرموز التقنية مترجمة', () {
      expect(const S('ar').label('pickup_scheduled'), 'الاستلام مجدول');
      expect(const S('en').label('card_simulated'), 'mada/Visa card (simulated)');
      expect(const S('ar').label('damage'), 'تلف');
      expect(const S('ar').label('unknown_code'), 'unknown_code');
    });
    test('تصحيحات القاموس للخيار C', () => expect(const S('ar').d('nav.legs'), 'مراحل النقل'));
  });

  group('ApiClient', () {
    test('الدخول مع تحقق بخطوتين ثم أمر برمز الجلسة', () async {
      final calls = <String>[];
      final mock = MockClient((r) async {
        calls.add('${r.method} ${r.url.path}');
        if (r.url.path.endsWith('/auth/login')) return http.Response(jsonEncode({'mfaRequired': true, 'challengeId': 'c1'}), 200);
        if (r.url.path.endsWith('/auth/mfa/verify')) return http.Response(jsonEncode({'token': 't1'}), 200);
        expect(r.headers['authorization'], 'Bearer t1');
        expect(r.headers['accept-language'], 'en');
        return http.Response(jsonEncode({'data': {'ok': true}}), 200);
      });
      final api = ApiClient(base: 'http://x/api/v1', client: mock)..lang = 'en';
      final l = await api.login('a@b.c', 'p');
      expect(l.mfaRequired, isTrue);
      await api.verifyMfa(l.challengeId!, '123456');
      expect(await api.exec('courier.pickup', {'shipment': 's'}), {'ok': true});
      expect(calls.last, 'POST /api/v1/commands/courier.pickup');
    });
    test('أخطاء المجال تُعاد برمزها ورسالتيها والحقل المعني', () async {
      final api = ApiClient(base: 'http://x', client: MockClient((r) async => http.Response.bytes(utf8.encode(jsonEncode({'error': {'code': 'NOT_CUSTODIAN', 'message_ar': 'ليست بعهدتك', 'message_en': 'Not in your custody', 'details': [{'field': 'shipment'}]}})), 409)));
      try { await api.exec('courier.deliver'); fail('expected error'); } on ApiException catch (e) { expect(e.code, 'NOT_CUSTODIAN'); expect(e.message('ar'), 'ليست بعهدتك'); expect(e.field, 'shipment'); expect(e.status, 409); }
    });
    test('انقطاع الشبكة يُعاد كخطأ NETWORK مفهوم', () async {
      final api = ApiClient(base: 'http://x', client: MockClient((_) async => throw Exception('down')));
      try { await api.query('me'); fail('expected'); } on ApiException catch (e) { expect(e.isNetwork, isTrue); }
    });
  });
}
