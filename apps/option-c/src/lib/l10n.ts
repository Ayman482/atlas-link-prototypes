// طبقة التوطين للخيار C — واجهة رقيقة فوق المصدر المعتمد الوحيد packages/i18n/src/terms.ts
// (نفس المصدر يولّد ملف Flutter labels.g.dart؛ لا تُضف تسميات هنا).
import { TERM_OVERRIDES, LABELS, termEntry } from '@medlog/i18n/src/terms';
export { label, term, greeting, comma, timelineTitle, timelineDetail, sysText, configLabel, CONFIG_LABELS } from '@medlog/i18n/src/terms';
export const DICT_OVERRIDES = TERM_OVERRIDES;
export const VALUE_LABELS = LABELS;

/** يطبّق التصحيحات على كائن قاموس فرعي (مثل dict.nav) مع الحفاظ على بنيته */
export function withOverrides<T extends Record<string, any>>(obj: T, prefix: string): T {
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const key = `${prefix}.${k}`;
    out[k] = v && typeof v === 'object' && !('ar' in v) ? withOverrides(v, key) : (termEntry(key) ?? v);
  }
  return out;
}
