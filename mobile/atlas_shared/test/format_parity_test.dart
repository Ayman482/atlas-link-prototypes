// تطابق التنسيقات مع الويب (tests/formats.test.ts في جذر المستودع): نفس القيم ونفس النتائج المتوقعة
import 'package:flutter_test/flutter_test.dart';
import 'package:atlas_shared/atlas_shared.dart';

String strip(String s) => s.replaceAll(RegExp('[\u2066\u2069]'), '');
void main() {
  test('التاريخ والعملة والحرارة مطابقة للويب', () {
    expect(Fmt('ar').dt('2026-11-02T18:05:00Z'), '02 نوفمبر، 09:05 م');
    expect(Fmt('en').dt('2026-11-02T18:05:00Z'), '02 Nov, 21:05');
    expect(Fmt('ar').sar(1234567), '12,345.67 ر.س');
    expect(Fmt('en').sar(1234567), '12,345.67 SAR');
    expect(strip(Fmt('ar').temp(-20)), '-20.0 °م');
    expect(strip(Fmt('en').temp(5.25)), '5.3 °C');
  });
}
