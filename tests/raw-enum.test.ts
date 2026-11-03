// Phase 17 — انحدار التوطين: لا تُعرض قيم الحالات/الأنواع الخام (مثل pass أو suspected) مباشرة في الواجهة،
// ولا عناوين أعمدة إنجليزية ثابتة دون مقابل عربي. فحص ثابت لملفات TSX في الخيار C.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const files: string[] = [];
const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.tsx')) files.push(p); } };
walk('apps/option-c/src');

test('لا قيمة تعداد خام داخل شارة أو نص (يجب المرور عبر label())', () => {
  const bad: string[] = [];
  const pats = [
    /<Pill[^>]*>\{[a-zA-Z]+\.(status|decision|result|severity|lostState|deliveryStatus|kind|state|outcome|channel)\}<\/Pill>/g,
    />\s*\{[a-zA-Z]+\.(status|decision|result|severity|lostState|deliveryStatus)\}\s*</g,
    /· \{[a-zA-Z]+\.(status|decision|result|severity|outcome)\}/g,
  ];
  for (const f of files) { const s = fs.readFileSync(f, 'utf8'); for (const re of pats) for (const m of s.matchAll(re)) bad.push(`${f}: ${m[0].slice(0, 80)}`); }
  assert.deepEqual(bad, []);
});

// الاختصارات المعتمدة في المسرد (IMEI, GPS, ZATCA, URL, MFA, IP, SKU) تبقى كما هي في الواجهتين
test('لا عنوان عمود إنجليزي ثابت دون بديل عربي (عدا الاختصارات المعتمدة)', () => {
  const bad: string[] = [];
  for (const f of files) { const s = fs.readFileSync(f, 'utf8'); for (const m of s.matchAll(/\{ key: '[a-zA-Z]+', label: '([A-Za-z][A-Za-z ]+)'/g)) if (!/^[A-Z]{2,6}$/.test(m[1])) bad.push(`${f}: ${m[1]}`); }
  assert.deepEqual(bad, []);
});
