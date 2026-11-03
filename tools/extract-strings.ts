// يستخرج كل أزواج النصوص العربية/الإنجليزية المضمّنة في واجهات الخيار C (TSX) وتطبيقات Flutter (Dart) ومحرك المجال
// الاستخدام: npx tsx tools/extract-strings.ts out.json
import fs from 'node:fs';
import path from 'node:path';
type Pair = { ar: string; en: string; file: string; line: number; kind: string };
const roots = ['apps/option-c/src', 'mobile/atlas_shared/lib', 'mobile/customer_app/lib', 'mobile/courier_app/lib', 'packages/core/src'];
const files: string[] = [];
const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|dart)$/.test(f) && !f.endsWith('.g.dart') && !p.includes('seed.ts')) files.push(p); } };
roots.forEach(walk);
const str = String.raw`'((?:[^'\\]|\\.)*)'|\x60((?:[^\x60\\]|\\.)*)\x60|"((?:[^"\\]|\\.)*)"`;
const pats: [string, RegExp][] = [
  ['ternary', new RegExp(String.raw`lang === 'ar' \? (?:${str}) : (?:${str})`, 'g')],
  ['ternary-en', new RegExp(String.raw`lang === 'en' \? (?:${str}) : (?:${str})`, 'g')],
  ['object', new RegExp(String.raw`\{ ?ar: (?:${str}), en: (?:${str}) ?\}`, 'g')],
  ['L()', new RegExp(String.raw`\bL\((?:${str}), (?:${str})\)`, 'g')],
  ['s.t()', new RegExp(String.raw`\b(?:s|st\.s|S\([^)]*\))\.t\((?:${str}), (?:${str})\)`, 'g')],
  ['tuple', new RegExp(String.raw`\[(?:${str}), (?:${str})\]`, 'g')],
];
export function extractPairs(): Pair[] {
const out: Pair[] = [];
const AR = /[\u0600-\u06FF]/;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    for (const [kind, re] of pats) for (const m of l.matchAll(re)) {
      const vals = m.slice(1).filter((x) => x !== undefined);
      let [a, b] = vals; if (kind === 'ternary-en') [a, b] = [b, a];
      if (a === undefined || b === undefined) continue;
      if (kind === 'tuple' && !(AR.test(a) && !AR.test(b))) continue;
      if (!AR.test(a) && !AR.test(b)) continue;
      out.push({ ar: a, en: b, file: f, line: i + 1, kind });
    }
  });
}
return out;
}
export type { Pair };
if (process.argv[1]?.endsWith('extract-strings.ts')) { const out = extractPairs(); fs.writeFileSync(process.argv[2] ?? 'strings.json', JSON.stringify(out, null, 1)); console.log('files', files.length, 'pairs', out.length); }
