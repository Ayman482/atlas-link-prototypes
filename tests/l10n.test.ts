// اختبارات المصدر المعتمد للتوطين (packages/i18n/src/terms.ts): التغطية الكاملة لقيم المجال، عدم وجود رموز خام في العربية،
// تطابق ملف Flutter المولّد، التحية، وحل الرموز المتعددة المعنى بالسياق
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dict } from '../packages/i18n/src/index';
import { LABELS, TERM_OVERRIDES, TERMS_C, allLabels, allTerms, greeting, label, term, timelineTitle, timelineDetail, comma } from '../packages/i18n/src/terms';
import { renderLabelsDart } from '../mobile/tool/gen_labels';

const AR = /[؀-ۿ]/;
// common.switchLang بالإنجليزية = «العربية» عمداً (زر التبديل يعرض اسم اللغة الهدف)
// قيم في types.ts ليست قيماً معروضة للمستخدم (لغات، مفاتيح بنيوية، أحجام صناديق، أسماء حقول)
const NOT_DISPLAYED = new Set(['ar', 'en', 'meta', 'L', 'M', 'S', 'channel', 'costType', 'tcp', 'udp', 'fhir', 'qr', 'pin']);

test('ملف Flutter المولّد مطابق للمصدر المعتمد (أعد التوليد: npx tsx mobile/tool/gen_labels.ts)', () => {
  const onDisk = fs.readFileSync('mobile/atlas_shared/lib/src/l10n/labels.g.dart', 'utf8');
  assert.equal(onDisk, renderLabelsDart());
});

test('كل قيمة حرفية في نموذج المجال (types.ts) لها تسمية عربية وإنجليزية', () => {
  const src = fs.readFileSync('packages/core/src/types.ts', 'utf8');
  const lits = [...new Set([...src.matchAll(/'([a-zA-Z_][a-zA-Z0-9_]*)'/g)].map((m) => m[1]))].filter((x) => !NOT_DISPLAYED.has(x));
  const missing = lits.filter((v) => label('ar', v) === v || !AR.test(label('ar', v)) && !/^[A-Z0-9 ()/+-]+$/.test(label('ar', v)));
  assert.deepEqual(missing, [], `قيم بلا تسمية عربية: ${missing.join(', ')}`);
  for (const v of lits) assert.ok(label('en', v).length > 0);
});

test('لا رموز خام (snake_case) ولا إنجليزية صغيرة داخل النصوص العربية، ولا عربية داخل الإنجليزية', () => {
  const all = { ...allLabels(), ...allTerms() };
  const bad: string[] = [];
  for (const [k, v] of Object.entries(all)) {
    if (/\b[a-z]+_[a-z_]+\b/.test(v.ar) || /(?<![A-Za-z])[a-z]{4,}(?![A-Za-z])/.test(v.ar.replace(/\{[a-z]+\}/g, ''))) bad.push(`${k}: «${v.ar}»`);
    if (AR.test(v.en) && k !== 'common.switchLang') bad.push(`${k} (en): «${v.en}»`);
    if (!v.ar.trim() || !v.en.trim()) bad.push(`${k}: فارغ`);
  }
  assert.deepEqual(bad, []);
});

test('تصحيحات المصطلحات تشير لمفاتيح موجودة، ولا تكرار متعارض بين التسميات وتصحيحات القاموس', () => {
  const get = (p: string) => p.split('.').reduce<any>((o, k) => o?.[k], dict);
  for (const k of Object.keys(TERM_OVERRIDES)) assert.ok(get(k), `مفتاح غير موجود في القاموس: ${k}`);
  for (const k of Object.keys(TERMS_C)) assert.equal(get(k), undefined, `مفتاح جديد يكرر مفتاحاً موجوداً: ${k}`);
  // نفس المفهوم بنفس الصياغة: حالة الشحنة في القاموس المصحح = تسميتها كقيمة
  assert.equal(term('ar', 'thermal.ambient'), label('ar', 'ambient'));
  assert.equal(term('ar', 'level.stat'), label('ar', 'stat'));
  assert.equal(label('ar', 'pickup_scheduled'), 'الاستلام مجدول');
});

test('التحية: «مساء الخير» بعد الظهر والمساء، ولا «مساء النور» أبداً', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 10, 2, h - 3, 30)); // ساعة الرياض h
  assert.equal(greeting('ar', at(9)), 'صباح الخير');
  assert.equal(greeting('ar', at(15)), 'مساء الخير');
  assert.equal(greeting('ar', at(21)), 'مساء الخير');
  assert.equal(greeting('en', at(21)), 'Good evening');
  for (let h = 0; h < 24; h++) assert.notEqual(greeting('ar', at(h)), 'مساء النور');
  assert.equal(comma('en'), ', '); assert.equal(comma('ar'), '، ');
  assert.ok(!JSON.stringify({ LABELS, TERMS_C, TERM_OVERRIDES }).includes('مساء النور'));
});

test('الرموز المتعددة المعنى تُحل بالسياق', () => {
  assert.equal(label('ar', 'failed'), 'تعذّر التسليم'); // حالة شحنة
  assert.equal(label('ar', 'failed', 'outcome'), 'فشل'); // نتيجة نسخ احتياطي أو دفع
  assert.equal(label('ar', 'partner', 'custodian'), 'الشريك الناقل');
  assert.equal(label('ar', 'approved', 'claimStatus'), 'معتمدة');
  assert.equal(label('ar', 'no_such_code'), 'no_such_code');
  assert.equal(label('ar', null), '—');
});

test('عناوين وتفاصيل الخط الزمني تُبنى من الرموز المنظمة لا من نص يحوي رموزاً خاماً', () => {
  const e = { kind: 'custody', title: { ar: 'نقل حيازة: customer ← courier', en: 'Custody: customer → courier' }, detail: 'أ. خالد (signature)', codes: { fromType: 'customer', toType: 'courier', method: 'signature' } };
  assert.equal(timelineTitle('ar', e), 'نقل الحيازة: العميل ← المندوب');
  assert.equal(timelineTitle('en', e), 'Custody transfer: Customer → Courier');
  assert.equal(timelineDetail('ar', e), 'أ. خالد (توقيع)');
  assert.equal(timelineTitle('ar', { kind: 'status', title: { ar: 'جُدول الاستلام', en: '' }, codes: { status: 'pickup_scheduled' } }), 'الاستلام مجدول');
  assert.equal(timelineTitle('ar', { kind: 'carrier', title: { ar: 'الناقل: loaded', en: '' }, codes: { eventType: 'loaded' } }), 'الناقل: تم التحميل على الطائرة');
});
