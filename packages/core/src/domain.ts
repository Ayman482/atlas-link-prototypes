// قواعد المجال المشتركة: الانتقالات المحروسة، جاهزية الصناديق، الأهلية، إسناد القراءات
import type * as T from './types';
import type { Ctx } from './engine';
import { MIN } from './util';

// SHP-004: الانتقالات المسموحة — لا يُقبل تغيير حالة اعتباطي من العميل
export const TRANSITIONS: Record<T.ShipmentStatus, T.ShipmentStatus[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['pickup_scheduled', 'cancelled'],
  pickup_scheduled: ['collected', 'confirmed', 'cancelled'],
  collected: ['in_transit', 'exception'],
  in_transit: ['at_handover', 'delivered', 'failed', 'exception'],
  at_handover: ['delivered', 'in_transit', 'failed', 'exception'],
  delivered: [],
  failed: ['return_pending', 'in_transit'],
  return_pending: ['returned', 'in_transit'],
  returned: [],
  cancelled: [],
  exception: ['in_transit', 'return_pending', 'at_handover'],
};
export const ACTIVE: T.ShipmentStatus[] = ['collected', 'in_transit', 'at_handover', 'failed', 'return_pending', 'exception'];
export const OPEN: T.ShipmentStatus[] = ['confirmed', 'pickup_scheduled', ...ACTIVE];

export function transition(ctx: Ctx, sh: T.Shipment, to: T.ShipmentStatus, reason: string, source = 'admin', expectedVersion?: number) {
  if (expectedVersion !== undefined && expectedVersion !== sh.version) ctx.fail('VERSION_MISMATCH', 'تم تعديل الشحنة من مستخدم آخر؛ حدّث الصفحة', 'Shipment was modified by someone else; refresh', 412);
  if (!TRANSITIONS[sh.status].includes(to)) ctx.fail('SHIPMENT_TRANSITION_NOT_ALLOWED', `لا يمكن نقل الشحنة من «${sh.status}» إلى «${to}»`, `Cannot move shipment from "${sh.status}" to "${to}"`, 422);
  ctx.db.statusEvents.push({ id: ctx.id('sev'), shipmentId: sh.id, fromStatus: sh.status, toStatus: to, reason, occurredAt: ctx.nowIso, actorId: ctx.actor.user.id, source });
  const from = sh.status;
  sh.status = to; sh.updatedAt = ctx.nowIso; sh.version++;
  ctx.emit(`shipment.${to}`, 'shipment', sh.id, sh.organizationId, { from, to, reason });
  ctx.audit('shipment.transition', 'shipment', sh.id, `${sh.trackingNo}: ${from} → ${to}${reason ? ' — ' + reason : ''}`);
}

export const shipment = (ctx: Ctx, idOrTracking: string) => {
  const s = ctx.db.shipments.find((x) => x.id === idOrTracking || x.trackingNo === idOrTracking || x.qrToken === idOrTracking);
  if (!s) ctx.fail('NOT_FOUND', 'الشحنة غير موجودة', 'Shipment not found', 404);
  return s!;
};
export const activePairing = (db: T.Db, boxId: string) => db.pairings.find((p) => p.boxId === boxId && !p.unpairedAt) ?? null;
export const deviceOfBox = (db: T.Db, boxId: string) => { const p = activePairing(db, boxId); return p ? db.devices.find((d) => d.id === p.deviceId) ?? null : null; };
export const activePackings = (db: T.Db, boxId: string) => db.packings.filter((p) => p.boxId === boxId && !p.unpackedAt);
export const packingOf = (db: T.Db, shipmentId: string) => db.packings.find((p) => p.shipmentId === shipmentId && !p.unpackedAt) ?? null;
export const activeBlock = (db: T.Db, scopeType: T.OperationalBlock['scopeType'], scopeId: string) => db.blocks.find((b) => b.scopeType === scopeType && b.scopeId === scopeId && !b.resolvedAt) ?? null;

export interface Readiness { ready: boolean; reasons: { code: string; ar: string; en: string; overridable: boolean }[] }
/** DHC-001..017 / BR-009: فحص جاهزية الصندوق وجهازه قبل الإسناد */
export function boxReadiness(db: T.Db, box: T.Box, now: number, thermal?: T.ThermalClass): Readiness {
  const reasons: Readiness['reasons'] = [];
  const add = (code: string, ar: string, en: string, overridable = false) => reasons.push({ code, ar, en, overridable });
  if (box.status === 'retired') add('BOX_RETIRED', 'الصندوق متقاعد', 'Box is retired');
  if (['cleaning', 'inspection', 'maintenance', 'returning', 'partner_custody'].includes(box.status)) add('BOX_NOT_AVAILABLE', `الصندوق في حالة «${box.status}»`, `Box is in "${box.status}" state`);
  if (box.qualificationStatus !== 'qualified' || Date.parse(box.qualificationExpiry) < now) add('BOX_QUALIFICATION_EXPIRED', 'تأهيل الصندوق الحراري منتهٍ', 'Box thermal qualification expired');
  if (box.condition === 'damaged') add('BOX_DAMAGED', 'الصندوق تالف', 'Box is damaged');
  if (thermal && box.thermalClass !== thermal) add('THERMAL_MISMATCH', 'الفئة الحرارية للصندوق لا تطابق الشحنة', 'Box thermal class does not match shipment');
  const dev = deviceOfBox(db, box.id);
  if (!dev) add('NO_TRACKER', 'لا يوجد جهاز تتبع مقترن', 'No paired tracker');
  else {
    if (['faulty', 'maintenance', 'suspended', 'retired'].includes(dev.state)) add('TRACKER_UNFIT', `جهاز التتبع في حالة «${dev.state}»`, `Tracker is "${dev.state}"`);
    if (dev.state === 'offline' || (dev.lastSeenAt && now - Date.parse(dev.lastSeenAt) > 60 * MIN && box.status === 'available')) add('TRACKER_OFFLINE', 'جهاز التتبع غير متصل', 'Tracker offline', true);
    if (dev.batteryPct !== null && dev.batteryPct < 20) add('TRACKER_LOW_BATTERY', `بطارية الجهاز ${dev.batteryPct}%`, `Tracker battery ${dev.batteryPct}%`, true);
  }
  if (activeBlock(db, 'box', box.id)) add('BOX_BLOCKED', 'الصندوق محظور تشغيلياً', 'Box is operationally blocked');
  return { ready: reasons.length === 0, reasons };
}

/** RTE-005 / CMP / BR-009: أهلية المندوب والشريك والمركبة */
export function courierEligibility(db: T.Db, c: T.Courier, now: number) {
  const r: string[] = [];
  if (!c.qualified || Date.parse(c.qualificationExpiry) < now) r.push('COURIER_NOT_QUALIFIED');
  if (c.status === 'suspended' || c.status === 'off_shift') r.push('COURIER_UNAVAILABLE');
  if (activeBlock(db, 'courier', c.id)) r.push('COURIER_BLOCKED');
  if (c.partnerId) { const p = db.partners.find((x) => x.id === c.partnerId); if (!p || p.status !== 'active' || activeBlock(db, 'partner', p.id)) r.push('PARTNER_BLOCKED'); }
  if (c.vehicleId) { const v = db.vehicles.find((x) => x.id === c.vehicleId); if (v && (v.qualificationStatus !== 'qualified' || Date.parse(v.qualificationExpiry) < now || activeBlock(db, 'vehicle', v.id))) r.push('VEHICLE_NOT_QUALIFIED'); }
  return r;
}
export function partnerEligibility(db: T.Db, p: T.Partner, now: number) {
  const r: string[] = [];
  if (p.status !== 'active' || activeBlock(db, 'partner', p.id)) r.push('PARTNER_BLOCKED');
  if (db.licenses.some((l) => l.holderType === 'partner' && l.holderId === p.id && Date.parse(l.validTo) < now)) r.push('PARTNER_LICENSE_EXPIRED');
  return r;
}
export const ELIGIBILITY_TEXT: Record<string, { ar: string; en: string }> = {
  COURIER_NOT_QUALIFIED: { ar: 'تأهيل المندوب منتهٍ', en: 'Courier qualification expired' },
  COURIER_UNAVAILABLE: { ar: 'المندوب غير متاح', en: 'Courier unavailable' },
  COURIER_BLOCKED: { ar: 'المندوب محظور تشغيلياً', en: 'Courier is blocked' },
  PARTNER_BLOCKED: { ar: 'الشريك محظور أو غير نشط', en: 'Partner blocked or inactive' },
  PARTNER_LICENSE_EXPIRED: { ar: 'ترخيص الشريك منتهٍ', en: 'Partner license expired' },
  VEHICLE_NOT_QUALIFIED: { ar: 'المركبة غير مؤهلة', en: 'Vehicle not qualified' },
};

/** E5: إسناد قراءة لشحنات حسب تقاطع زمن الحدث مع فترات التعبئة (لا حسب الاقتران الحالي) */
export function shipmentsForReading(db: T.Db, r: T.Reading): T.Shipment[] {
  if (!r.boxId) return [];
  const t = r.deviceTime;
  return db.packings.filter((p) => p.boxId === r.boxId && p.packedAt <= t && (!p.unpackedAt || p.unpackedAt >= t)).map((p) => db.shipments.find((s) => s.id === p.shipmentId)!).filter(Boolean);
}

/** TEMP-003: تقييم قراءة مقابل الملف الحراري الساري — يفتح أو يمدّ انحرافاً */
export function evaluateReading(ctx: Ctx, r: T.Reading) {
  if (r.tempC === null) return;
  for (const sh of shipmentsForReading(ctx.db, r)) {
    const prof = ctx.db.serviceProfiles.find((p) => p.id === sh.serviceProfileId)!;
    const out = r.tempC < prof.minC || r.tempC > prof.maxC;
    const open = ctx.db.excursions.find((e) => e.shipmentId === sh.id && e.boxId === r.boxId && !e.endedAt);
    if (out) {
      const delta = r.tempC > prof.maxC ? r.tempC - prof.maxC : prof.minC - r.tempC;
      const severity: T.Excursion['severity'] = delta > 4 ? 'critical' : delta > 1.5 ? 'major' : 'minor';
      if (open) { open.peakC = Math.abs(r.tempC - (prof.minC + prof.maxC) / 2) > Math.abs(open.peakC - (prof.minC + prof.maxC) / 2) ? r.tempC : open.peakC; if (rank(severity) > rank(open.severity)) open.severity = severity; }
      else {
        const ex: T.Excursion = { id: ctx.id('exc'), shipmentId: sh.id, boxId: r.boxId!, deviceId: r.deviceId, profileId: prof.id, startedAt: r.deviceTime, endedAt: null, peakC: r.tempC, severity, status: 'open', acknowledgedBy: null, reviewDecision: null, incidentId: null };
        ctx.db.excursions.push(ex);
        ctx.emit('cold_chain.excursion_detected', 'shipment', sh.id, sh.organizationId, { excursionId: ex.id, tempC: r.tempC });
        ctx.notify({ audience: 'staff', critical: true, title: { ar: `انحراف حراري — ${sh.trackingNo}`, en: `Temperature excursion — ${sh.trackingNo}` }, body: { ar: `قراءة ${r.tempC} °م خارج النطاق ${prof.minC}..${prof.maxC} °م (بيانات عرض)`, en: `Reading ${r.tempC} °C outside ${prof.minC}..${prof.maxC} °C (demo data)` }, link: `/shipments/${sh.id}` });
        ctx.notify({ audience: 'customer', organizationId: sh.organizationId, title: { ar: `تنبيه حرارة ${sh.trackingNo}`, en: `Temperature alert ${sh.trackingNo}` }, body: { ar: 'رُصد انحراف حراري ويجري التحقيق.', en: 'An excursion was detected and is under review.' }, link: `/shipments/${sh.id}` });
      }
    } else if (open) {
      open.endedAt = r.deviceTime;
      ctx.emit('cold_chain.excursion_resolved', 'shipment', sh.id, sh.organizationId, { excursionId: open.id });
    }
  }
}
const rank = (s: string) => ['minor', 'major', 'critical'].indexOf(s);

export function addCustody(ctx: Ctx, e: Omit<T.CustodyEvent, 'id' | 'receivedAt' | 'actorId'> & { receivedAt?: string }) {
  if (!e.evidence?.signedBy) ctx.fail('CUSTODY_EVIDENCE_REQUIRED', 'نقل الحيازة يتطلب اسم الموقّع ودليلاً', 'Custody transfer requires signer and evidence', 422, 'evidence');
  const ev: T.CustodyEvent = { id: ctx.id('cus'), receivedAt: e.receivedAt ?? ctx.nowIso, actorId: ctx.actor.user.id, ...e } as T.CustodyEvent;
  ctx.db.custody.push(ev);
  const sh = ctx.db.shipments.find((s) => s.id === e.shipmentId)!;
  ctx.emit('shipment.custody_transferred', 'shipment', sh.id, sh.organizationId, { custodyEventId: ev.id, to: e.toType });
  ctx.audit('custody.transfer', 'shipment', sh.id, `${sh.trackingNo}: ${e.fromType} → ${e.toType} (${e.evidence.signedBy})`);
  return ev;
}

export const currentCustodian = (db: T.Db, shipmentId: string) => {
  const evs = db.custody.filter((c) => c.shipmentId === shipmentId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return evs.length ? { type: evs[evs.length - 1].toType, id: evs[evs.length - 1].toId } : null;
};
