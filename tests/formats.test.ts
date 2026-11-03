// تطابق التنسيقات بين الويب وFlutter: نفس القيم المتوقعة مكتوبة هنا وفي mobile/atlas_shared/test/format_parity_test.dart
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDateTime, fmtSAR, fmtTemp } from '../packages/i18n/src/index';
export const CASES = { dt: '2026-11-02T18:05:00Z', sar: 1234567, temp: -20 };
test('تنسيق التاريخ والعملة والحرارة بالعربية والإنجليزية (توقيت الرياض)', () => {
  assert.equal(fmtDateTime('ar', CASES.dt), '02 نوفمبر، 09:05 م');
  assert.equal(fmtDateTime('en', CASES.dt), '02 Nov, 21:05');
  assert.equal(fmtSAR('ar', CASES.sar), '12,345.67 ر.س');
  assert.equal(fmtSAR('en', CASES.sar), '12,345.67 SAR');
  assert.equal(fmtTemp('ar', CASES.temp).replace(/[\u200e\u2066\u2069]/g, ''), '-20.0 °م'); // Intl يضيف علامة LRM للقيم السالبة — مقبولة للاتجاه
  assert.equal(fmtTemp('en', 5.25), '5.3 °C');
});
