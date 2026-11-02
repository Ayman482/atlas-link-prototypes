// يولّد mobile/atlas_shared/lib/src/l10n/labels.g.dart من المصدر المعتمد الوحيد packages/i18n/src/terms.ts
// — نفس المصطلحات والتسميات على الويب وFlutter. التشغيل: npx tsx tool/gen_labels.ts (من مجلد mobile)
// اختبار tests/l10n.test.ts في جذر المستودع يفشل إن لم يُعَد التوليد بعد تعديل المصدر.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { allLabels, allTerms } from '../../packages/i18n/src/terms';

export function renderLabelsDart(): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$');
  const map = (o: Record<string, { ar: string; en: string }>) => Object.entries(o).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `  '${esc(k)}': ['${esc(v.ar)}', '${esc(v.en)}'],`).join('\n');
  return `// مولَّد آلياً من packages/i18n/src/terms.ts — لا تعدّله يدوياً (npx tsx tool/gen_labels.ts)\n// القيمة: [عربي، إنجليزي]. مفاتيح السياق بصيغة domain.code (مثل outcome.failed)\nconst Map<String, List<String>> kValueLabels = {\n${map(allLabels())}\n};\n\nconst Map<String, List<String>> kDict = {\n${map(allTerms())}\n};\n`;
}
const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(here, '../atlas_shared/lib/src/l10n');
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'labels.g.dart'), renderLabelsDart());
  console.log('labels', Object.keys(allLabels()).length, 'terms', Object.keys(allTerms()).length);
}
