// يولّد mobile/atlas_shared/lib/src/l10n/labels.g.dart من القاموس المشترك وطبقة توطين الخيار C — نفس المصطلحات على الويب وFlutter
import { dict } from '../../packages/i18n/src/index';
import { VALUE_LABELS, DICT_OVERRIDES } from '../../apps/option-c/src/lib/l10n';
import { writeFileSync, mkdirSync } from 'node:fs';
const labels: Record<string, { ar: string; en: string }> = {};
const DICTS = ['shipmentStatus', 'boxStatus', 'deviceState', 'excursionStatus', 'incidentStatus', 'claimStatus', 'invoiceStatus', 'settlementStatus', 'licenseStatus', 'severity', 'freshness', 'thermal', 'level', 'mode', 'custodian', 'requestType'] as const;
for (const d of DICTS) for (const [k, v] of Object.entries((dict as any)[d])) labels[k] ??= v as any;
const EXTRA: Record<string, { ar: string; en: string }> = { pending: { ar: 'معلّق', en: 'Pending' }, done: { ar: 'منجز', en: 'Done' }, active: { ar: 'نشط', en: 'Active' }, on_route: { ar: 'في مسار', en: 'On route' }, off_shift: { ar: 'خارج المناوبة', en: 'Off shift' }, available: { ar: 'متاح', en: 'Available' }, high: { ar: 'مرتفع', en: 'High' }, medium: { ar: 'متوسط', en: 'Medium' }, low: { ar: 'منخفض', en: 'Low' }, pickup: { ar: 'استلام', en: 'Pickup' }, delivery: { ar: 'تسليم', en: 'Delivery' }, handover: { ar: 'نقل حيازة', en: 'Handover' }, return: { ar: 'إرجاع', en: 'Return' }, BLOOD_TUBES: { ar: 'أنابيب دم', en: 'Blood tubes' }, TISSUE_BIOPSY: { ar: 'خزعة نسيجية', en: 'Tissue biopsy' }, SWAB_PCR: { ar: 'مسحة PCR', en: 'PCR swab' }, URINE_CULTURE: { ar: 'مزرعة بول', en: 'Urine culture' }, CSF_SAMPLE: { ar: 'سائل نخاعي', en: 'CSF sample' }, SERUM_ALIQUOT: { ar: 'عينة مصل', en: 'Serum aliquot' }, rejected: { ar: 'مرفوض', en: 'Rejected' }, approved: { ar: 'معتمد', en: 'Approved' }, high_confidence: { ar: 'مرتفعة', en: 'High' }, unavailable: { ar: 'غير متاح', en: 'Unavailable' }, online: { ar: 'متصل', en: 'Online' } };
Object.assign(labels, EXTRA, VALUE_LABELS);
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$');
const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `  '${esc(k)}': ['${esc(v.ar)}', '${esc(v.en)}'],`).join('\n');
const flat: Record<string, { ar: string; en: string }> = {};
const walk = (o: any, p: string) => { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === 'object' && 'ar' in (v as any) && typeof (v as any).ar === 'string') flat[key] = (DICT_OVERRIDES[key] ?? v) as any; else if (v && typeof v === 'object') walk(v, key); } };
walk(dict, '');
const dictEntries = Object.entries(flat).map(([k, v]) => `  '${esc(k)}': ['${esc(v.ar)}', '${esc(v.en)}'],`).join('\n');
mkdirSync('atlas_shared/lib/src/l10n', { recursive: true });
writeFileSync('atlas_shared/lib/src/l10n/labels.g.dart', `// مولَّد آلياً من packages/i18n وapps/option-c/src/lib/l10n.ts — لا تعدّله يدوياً (npx tsx tool/gen_labels.ts)\n// القيمة: [عربي، إنجليزي]\nconst Map<String, List<String>> kValueLabels = {\n${entries}\n};\n\nconst Map<String, List<String>> kDict = {\n${dictEntries}\n};\n`);
console.log('labels', Object.keys(labels).length, 'dict', Object.keys(flat).length);
