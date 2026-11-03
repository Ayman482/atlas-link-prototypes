// المسرد المعتمد: لا صيغة مرفوضة في أي نص مضمّن (ويب الخيار C، Flutter، المحرك) ولا في القاموس المصحح أو تسميات القيم؛
// ومصطلح المسرد مستخدم بصيغته المعتمدة في المصدر المركزي.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOSSARY, allLabels, allTerms, label, term } from '../packages/i18n/src/terms';
import { extractPairs } from '../tools/extract-strings';

// نصوص المحرك المشتركة مع الخيارين A وB (عناوين الخط الزمني الاحتياطية) — الخيار C يعرض بدلها التسميات من الرموز المنظمة
const ALLOW = [{ file: 'packages/core/src/queries.ts', text: 'جُدول الاستلام' }];
const word = (t: string) => new RegExp(`(^|[\\s(«،:.\\-—/])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s)»،:.\\-—/])`);

test('لا صيغة عربية أو إنجليزية مرفوضة في أي نص مضمّن (الويب وFlutter والمحرك)', () => {
  const pairs = extractPairs();
  assert.ok(pairs.length > 1500, `عدد الأزواج ${pairs.length}`);
  const bad: string[] = [];
  for (const g of GLOSSARY) for (const p of pairs) {
    for (const a of g.avoidAr ?? []) if (word(a).test(p.ar) && !ALLOW.some((x) => p.file.endsWith(x.file) && p.ar.includes(x.text))) bad.push(`${g.id}: «${a}» في ${p.file}:${p.line} — «${p.ar.slice(0, 60)}»`);
    for (const a of g.avoidEn ?? []) if (word(a).test(p.en)) bad.push(`${g.id}: "${a}" في ${p.file}:${p.line} — "${p.en.slice(0, 60)}"`);
  }
  assert.deepEqual(bad, []);
});

test('القاموس المصحح وتسميات القيم خالية من الصيغ المرفوضة', () => {
  const all = { ...allLabels(), ...allTerms() };
  const bad: string[] = [];
  for (const g of GLOSSARY) for (const [k, v] of Object.entries(all)) for (const a of g.avoidAr ?? []) if (word(a).test(v.ar)) bad.push(`${k}: «${v.ar}» يحوي «${a}»`);
  assert.deepEqual(bad, []);
});

test('المصطلحات المعتمدة هي ما تعيده التسميات المركزية', () => {
  assert.equal(label('ar', 'pickup_scheduled'), 'الاستلام مجدول');
  assert.equal(label('ar', 'stale'), 'بيانات قديمة');
  assert.equal(term('ar', 'freshness.stale'), 'بيانات قديمة', 't() وlabel() يتفقان');
  assert.equal(term('ar', 'shipmentStatus.in_air_transit'), 'في رحلة جوية');
  assert.equal(term('ar', 'ship.pickupWindow'), 'فترة الاستلام');
  assert.equal(term('ar', 'nav.legalHolds').includes('التحفظ القانوني'), true);
  const ids = new Set<string>(); for (const g of GLOSSARY) { assert.ok(!ids.has(g.id), `مكرر ${g.id}`); ids.add(g.id); assert.ok(g.ar && g.en); }
});
