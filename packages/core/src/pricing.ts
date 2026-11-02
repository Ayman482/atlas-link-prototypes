// محرك التسعير — FIN-002 / SIM-001..010
import type { Db, PriceBreakdown, RatePlan, ServiceLevel, ThermalClass, Halala } from './types';
import { pct, sar } from './util';

export const VAT_PCT = 15; // ضريبة القيمة المضافة في المملكة — حالة ZATCA للفواتير الإلكترونية محاكاة (FIN-006)
export const DEDICATED_BOX_FEE = sar(150);
export const FREE_KG = 2;
export const LEVEL_SURCHARGE_PCT: Record<ServiceLevel, number> = { standard: 0, express: 35, stat: 80 };

export function defaultRules(): RatePlan['rules'] {
  const rows: RatePlan['rules'] = [];
  const base: Record<ThermalClass, [number, number, number]> = { ambient: [85, 190, 420], chilled: [120, 260, 560], frozen: [165, 340, 720] };
  (Object.keys(base) as ThermalClass[]).forEach((tc) => {
    (['standard', 'express', 'stat'] as ServiceLevel[]).forEach((lvl) => {
      const [s, r, a] = base[tc];
      rows.push({ thermalClass: tc, serviceLevel: lvl, sameCity: sar(s), intercityRoad: sar(r), air: sar(a), perKg: sar(tc === 'frozen' ? 9 : 6) });
    });
  });
  return rows;
}

export function activePlan(db: Db, at = new Date().toISOString()): RatePlan {
  const published = db.ratePlans.filter((p) => p.status === 'published' && p.effectiveFrom <= at).sort((a, b) => b.version - a.version);
  if (!published[0]) throw new Error('no published rate plan');
  return published[0];
}

export interface PriceInput { thermalClass: ThermalClass; serviceLevel: ServiceLevel; originCity: string; destCity: string; mode: 'road' | 'road_air'; weightKg: number; dedicatedBox: boolean }

export function price(plan: RatePlan, input: PriceInput, opts: { coveredByContract?: boolean; adjustPct?: number } = {}): PriceBreakdown {
  const rule = plan.rules.find((r) => r.thermalClass === input.thermalClass && r.serviceLevel === input.serviceLevel) ?? plan.rules[0];
  let base: Halala = input.originCity === input.destCity ? rule.sameCity : input.mode === 'road_air' ? rule.air : rule.intercityRoad;
  if (opts.adjustPct) base += pct(base, opts.adjustPct);
  const weight = Math.max(0, Math.ceil(input.weightKg - FREE_KG)) * rule.perKg;
  const levelSurcharge = pct(base, LEVEL_SURCHARGE_PCT[input.serviceLevel]);
  const dedicatedBox = input.dedicatedBox ? DEDICATED_BOX_FEE : 0;
  let subtotal = base + weight + levelSurcharge + dedicatedBox;
  // الشحنات المشمولة بعقد: تُغطّى القيمة الأساسية برسم العقد الشهري، وتُفوتر الإضافات فقط
  if (opts.coveredByContract) subtotal = weight + levelSurcharge + dedicatedBox;
  const vat = pct(subtotal, VAT_PCT);
  return { base, weight, levelSurcharge, dedicatedBox, subtotal, vat, total: subtotal + vat, ratePlanId: plan.id, ratePlanVersion: plan.version, coveredByContract: !!opts.coveredByContract };
}
