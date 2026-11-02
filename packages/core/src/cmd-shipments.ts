// أوامر دورة حياة الشحنة والتوزيع والحيازة والمرتجعات والفقدان — M01/M04/M09/M10
import type * as T from './types';
import { defineCommand, must, type Ctx } from './engine';
import { activePlan, price } from './pricing';
import { branchGrants, canReadShipment, canWriteShipmentFor, courierOf, customerOrgIds, has, isStaff } from './access';
import { ACTIVE, ELIGIBILITY_TEXT, addCustody, activePackings, boxReadiness, courierEligibility, currentCustodian, packingOf, partnerEligibility, shipment, transition } from './domain';
import { DAY, HOUR, MIN, haversineKm, iso, sar } from './util';

const L = (ar: string, en: string) => ({ ar, en });
const STAFF_OPS: T.RoleCode[] = ['ops_controller', 'customer_service'];

function readable(ctx: Ctx, idOrTracking: string) {
  const s = shipment(ctx, idOrTracking);
  // لا نكشف وجود شحنة عميل آخر — 404 بدل 403 (API §1.2)
  if (!canReadShipment(ctx.db, ctx.actor, s)) ctx.fail('NOT_FOUND', 'الشحنة غير موجودة', 'Shipment not found', 404);
  return s;
}
const addr = (ctx: Ctx, id: string) => must(ctx, ctx.db.addresses.find((a) => a.id === id), 'address');
const activeContract = (db: T.Db, orgId: string, now: number) => db.contracts.find((c) => c.organizationId === orgId && c.status === 'active' && Date.parse(c.validTo) >= now) ?? null;

export interface QuoteInput { organizationId?: string; thermalClass: T.ThermalClass; serviceLevel: T.ServiceLevel; senderAddressId: string; receiverAddressId: string; weightKg: number; dedicatedBox?: boolean }
function computeQuote(ctx: Ctx, i: QuoteInput, orgId: string) {
  const from = addr(ctx, i.senderAddressId), to = addr(ctx, i.receiverAddressId);
  for (const c of [from.cityCode, to.cityCode]) if (!ctx.db.cities.find((x) => x.code === c)?.active) ctx.fail('CITY_NOT_ACTIVE', 'المدينة غير مفعّلة للخدمة بعد', 'City not yet activated for service', 422);
  const dest = ctx.db.cities.find((x) => x.code === to.cityCode)!;
  const orig = ctx.db.cities.find((x) => x.code === from.cityCode)!;
  const mode: 'road' | 'road_air' = from.cityCode === to.cityCode ? 'road' : haversineKm(from, to) > 600 && dest.hasAirport && orig.hasAirport ? 'road_air' : 'road';
  const contract = activeContract(ctx.db, orgId, ctx.now);
  const covered = !!contract && contract.usedShipments < contract.includedShipments;
  const pb = price(activePlan(ctx.db, ctx.nowIso), { thermalClass: i.thermalClass, serviceLevel: i.serviceLevel, originCity: from.cityCode, destCity: to.cityCode, mode, weightKg: Number(i.weightKg) || 0, dedicatedBox: !!i.dedicatedBox }, { coveredByContract: covered });
  return { pb, mode, from, to, contract: covered ? contract : null };
}

defineCommand<QuoteInput, T.Quote>({
  name: 'shipment.quote', guard: 'any', desc: L('عرض سعر لشحنة (لا يُنشئ حجزاً)', 'Price quote (no booking)'),
  run(ctx, i) {
    const orgId = i.organizationId ?? customerOrgIds(ctx.actor)[0];
    if (!orgId) ctx.fail('VALIDATION', 'حدد العميل', 'Customer is required', 400, 'organizationId');
    if (!isStaff(ctx.actor) && !customerOrgIds(ctx.actor).includes(orgId)) ctx.fail('NOT_FOUND', 'العميل غير موجود', 'Customer not found', 404);
    const { pb } = computeQuote(ctx, i, orgId);
    const q: T.Quote = { id: ctx.id('quo'), quoteNo: `QE-${ctx.seq('quote', 6)}`, organizationId: orgId, shipmentId: null, snapshot: pb, total: pb.total, expiresAt: iso(ctx.now + DAY), status: 'open', createdAt: ctx.nowIso };
    ctx.db.quotes.push(q);
    return q;
  },
});

export interface CreateShipmentInput extends QuoteInput { organizationId: string; branchId: string | null; receiverOrgId?: string | null; pickupWindowStart: string; pickupWindowEnd: string; requestType?: T.RequestType; items: { descriptionCode: string; quantity: number; weightKg: number; handlingClass?: T.ShipmentItem['handlingClass'] }[]; submit?: boolean; recurringId?: string | null }
defineCommand<CreateShipmentInput, T.Shipment>({
  name: 'shipment.create', guard: 'any', desc: L('إنشاء شحنة (SHP-001)', 'Create shipment (SHP-001)'),
  run(ctx, i) {
    const org = must(ctx, ctx.db.organizations.find((o) => o.id === i.organizationId), 'organization');
    if (!isStaff(ctx.actor) && !customerOrgIds(ctx.actor).includes(org.id)) ctx.fail('NOT_FOUND', 'العميل غير موجود', 'Customer not found', 404);
    if (!canWriteShipmentFor(ctx.actor, org.id, i.branchId)) ctx.fail('FORBIDDEN', 'ليست لديك صلاحية إنشاء شحنات لهذا الفرع', 'No permission to create shipments for this branch', 403, 'branchId');
    if (i.branchId && !ctx.db.branches.some((b) => b.id === i.branchId && b.organizationId === org.id)) ctx.fail('VALIDATION', 'الفرع لا يتبع العميل', 'Branch does not belong to customer', 422, 'branchId');
    const from = addr(ctx, i.senderAddressId);
    if (from.organizationId !== org.id || !from.authorized) ctx.fail('VALIDATION', 'عنوان الاستلام غير معتمد لهذا العميل', 'Pickup address is not authorized for this customer', 422, 'senderAddressId');
    if (i.senderAddressId === i.receiverAddressId) ctx.fail('VALIDATION', 'عنوان الاستلام والتسليم متطابقان', 'Pickup and delivery addresses are identical', 422, 'receiverAddressId');
    const ps = Date.parse(i.pickupWindowStart), pe = Date.parse(i.pickupWindowEnd);
    if (!(ps > 0 && pe > ps)) ctx.fail('VALIDATION', 'نافذة الاستلام غير صحيحة (النهاية قبل البداية)', 'Invalid pickup window (end before start)', 422, 'pickupWindowEnd');
    if (ps < ctx.now - 15 * MIN) ctx.fail('VALIDATION', 'لا يمكن جدولة الاستلام في الماضي', 'Pickup cannot be in the past', 422, 'pickupWindowStart');
    if (!i.items?.length) ctx.fail('VALIDATION', 'أضف عنصراً واحداً على الأقل', 'Add at least one item', 422, 'items');
    const weight = i.items.reduce((a, x) => a + (Number(x.weightKg) || 0), 0);
    if (weight <= 0 || weight > 25) ctx.fail('VALIDATION', 'الوزن الإجمالي يجب أن يكون بين 0.1 و 25 كجم', 'Total weight must be between 0.1 and 25 kg', 422, 'items');
    const { pb, mode, to, contract } = computeQuote(ctx, { ...i, weightKg: weight }, org.id);
    const n = ctx.seq('trk', 6);
    const transitH = mode === 'road_air' ? 7 : from.cityCode === to.cityCode ? 1.5 : haversineKm(from, to) / 75 + 1;
    const sh: T.Shipment = {
      id: `shp_${n}`, trackingNo: `ML-2026-${n}`, qrToken: `qr_${n}_${ctx.now.toString(36)}`, organizationId: org.id, branchId: i.branchId ?? null,
      serviceProfileId: ctx.db.serviceProfiles.find((p) => p.thermalClass === i.thermalClass && p.status === 'active')!.id, thermalClass: i.thermalClass, serviceLevel: i.serviceLevel,
      requestType: i.requestType ?? 'on_demand', recurringId: i.recurringId ?? null, senderAddressId: from.id, receiverAddressId: to.id,
      receiverOrgId: i.receiverOrgId ?? to.organizationId ?? null, originCity: from.cityCode, destCity: to.cityCode,
      pickupWindowStart: iso(ps), pickupWindowEnd: iso(pe), deliverBy: iso(pe + (transitH + (i.serviceLevel === 'stat' ? 0.5 : 3)) * HOUR), status: 'draft', subStatus: null,
      dedicatedBox: !!i.dedicatedBox, mode, quoteId: null, contractId: contract?.id ?? null, priceTotal: pb.total, createdBy: ctx.actor.user.id,
      createdOnBehalf: isStaff(ctx.actor), createdAt: ctx.nowIso, updatedAt: ctx.nowIso, version: 1, lastPosition: null, eta: null, lostState: 'none',
    };
    ctx.db.shipments.push(sh);
    i.items.forEach((it) => ctx.db.shipmentItems.push({ id: ctx.id('itm'), shipmentId: sh.id, descriptionCode: it.descriptionCode, quantity: Math.max(1, Number(it.quantity) || 1), weightKg: Number(it.weightKg) || 0, handlingClass: it.handlingClass ?? 'biohazard_cat_b' }));
    const q: T.Quote = { id: ctx.id('quo'), quoteNo: `QT-${n}`, organizationId: org.id, shipmentId: sh.id, snapshot: pb, total: pb.total, expiresAt: iso(ctx.now + DAY), status: 'converted', createdAt: ctx.nowIso };
    ctx.db.quotes.push(q); sh.quoteId = q.id;
    ctx.db.statusEvents.push({ id: ctx.id('sev'), shipmentId: sh.id, fromStatus: null, toStatus: 'draft', reason: sh.createdOnBehalf ? 'أُنشئت من موظف نيابة عن العميل' : '', occurredAt: ctx.nowIso, actorId: ctx.actor.user.id, source: isStaff(ctx.actor) ? 'admin' : 'customer' });
    ctx.emit('shipment.created', 'shipment', sh.id, org.id, { trackingNo: sh.trackingNo });
    ctx.audit('shipment.create', 'shipment', sh.id, `إنشاء ${sh.trackingNo}`, sh.createdOnBehalf ? org.id : null);
    if (i.submit !== false) submit(ctx, sh);
    return sh;
  },
});

function submit(ctx: Ctx, sh: T.Shipment) {
  transition(ctx, sh, 'confirmed', 'تأكيد الطلب', isStaff(ctx.actor) ? 'admin' : 'customer');
  const c = sh.contractId ? ctx.db.contracts.find((x) => x.id === sh.contractId) : null;
  if (c) c.usedShipments++;
  ctx.emit('shipment.submitted', 'shipment', sh.id, sh.organizationId);
  ctx.notify({ audience: 'staff', title: L(`طلب جديد ${sh.trackingNo}`, `New request ${sh.trackingNo}`), body: L('بانتظار الإسناد في لوحة التوزيع', 'Awaiting assignment on dispatch board'), link: `/dispatch?shipment=${sh.id}`, critical: sh.serviceLevel === 'stat' });
  ctx.notify({ audience: 'customer', organizationId: sh.organizationId, title: L(`تم تأكيد ${sh.trackingNo}`, `${sh.trackingNo} confirmed`), body: L('سنبلغك عند إسناد المندوب.', 'We will notify you once a courier is assigned.'), link: `/shipments/${sh.id}` });
}

defineCommand<{ id: string }, T.Shipment>({
  name: 'shipment.submit', guard: 'any', desc: L('تقديم مسودة', 'Submit draft'),
  run(ctx, { id }) { const sh = readable(ctx, id); if (!canWriteShipmentFor(ctx.actor, sh.organizationId, sh.branchId)) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403); submit(ctx, sh); return sh; },
});

defineCommand<{ id: string; patch: Partial<Pick<T.Shipment, 'serviceLevel' | 'thermalClass' | 'receiverAddressId' | 'pickupWindowStart' | 'pickupWindowEnd' | 'dedicatedBox'>> }, T.Shipment>({
  name: 'shipment.updateDraft', guard: 'any', desc: L('تعديل مسودة', 'Edit draft'),
  run(ctx, { id, patch }) {
    const sh = readable(ctx, id);
    if (sh.status !== 'draft') ctx.fail('SHIPMENT_NOT_DRAFT', 'يمكن تعديل المسودات فقط', 'Only drafts can be edited', 422);
    if (!canWriteShipmentFor(ctx.actor, sh.organizationId, sh.branchId)) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403);
    Object.assign(sh, patch); sh.updatedAt = ctx.nowIso; sh.version++;
    if (patch.thermalClass) sh.serviceProfileId = ctx.db.serviceProfiles.find((p) => p.thermalClass === patch.thermalClass && p.status === 'active')!.id;
    ctx.audit('shipment.update_draft', 'shipment', sh.id, `تعديل مسودة ${sh.trackingNo}`);
    return sh;
  },
});

defineCommand<{ id: string; reason: string; version?: number }, T.Shipment>({
  name: 'shipment.cancel', guard: 'any', desc: L('إلغاء شحنة حسب السياسة (SHP-006)', 'Cancel per policy (SHP-006)'),
  run(ctx, { id, reason, version }) {
    const sh = readable(ctx, id);
    if (!reason?.trim()) ctx.fail('VALIDATION', 'سبب الإلغاء مطلوب', 'Cancellation reason is required', 422, 'reason');
    if (!canWriteShipmentFor(ctx.actor, sh.organizationId, sh.branchId)) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403);
    if (!isStaff(ctx.actor) && sh.status === 'pickup_scheduled' && Date.parse(sh.pickupWindowStart) - ctx.now < HOUR) ctx.fail('CANCEL_WINDOW_PASSED', 'لا يمكن الإلغاء قبل أقل من ساعة من الاستلام؛ تواصل مع خدمة العملاء', 'Cannot cancel within 1 hour of pickup; contact support', 422);
    transition(ctx, sh, 'cancelled', reason, isStaff(ctx.actor) ? 'admin' : 'customer', version);
    const pk = packingOf(ctx.db, sh.id); if (pk) pk.unpackedAt = ctx.nowIso;
    for (const b of ctx.db.boxes.filter((b) => b.status === 'assigned' && ctx.db.routeStops.some((s) => s.shipmentIds.includes(sh.id)))) if (!activePackings(ctx.db, b.id).length) b.status = 'available';
    ctx.db.routeStops.filter((s) => s.shipmentIds.includes(sh.id) && s.status === 'pending').forEach((s) => (s.status = 'skipped'));
    if (sh.contractId) { const c = ctx.db.contracts.find((x) => x.id === sh.contractId); if (c && c.usedShipments > 0) c.usedShipments--; }
    ctx.emit('shipment.cancelled', 'shipment', sh.id, sh.organizationId, { reason });
    return sh;
  },
});

defineCommand<{ id: string; pickupWindowStart: string; pickupWindowEnd: string }, T.Shipment>({
  name: 'shipment.reschedule', guard: 'any', desc: L('إعادة جدولة الاستلام', 'Reschedule pickup'),
  run(ctx, { id, pickupWindowStart, pickupWindowEnd }) {
    const sh = readable(ctx, id);
    if (!canWriteShipmentFor(ctx.actor, sh.organizationId, sh.branchId)) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403);
    if (!['draft', 'confirmed', 'pickup_scheduled'].includes(sh.status)) ctx.fail('RESCHEDULE_NOT_ALLOWED', 'لا يمكن إعادة الجدولة بعد الاستلام', 'Cannot reschedule after collection', 422);
    const ps = Date.parse(pickupWindowStart), pe = Date.parse(pickupWindowEnd);
    if (!(pe > ps) || ps < ctx.now) ctx.fail('VALIDATION', 'نافذة غير صحيحة', 'Invalid window', 422, 'pickupWindowStart');
    const shift = ps - Date.parse(sh.pickupWindowStart);
    sh.pickupWindowStart = iso(ps); sh.pickupWindowEnd = iso(pe); sh.deliverBy = iso(Date.parse(sh.deliverBy) + shift); sh.updatedAt = ctx.nowIso; sh.version++;
    ctx.db.routeStops.filter((s) => s.shipmentIds.includes(sh.id) && s.stopType === 'pickup').forEach((s) => (s.plannedAt = sh.pickupWindowStart));
    ctx.db.statusEvents.push({ id: ctx.id('sev'), shipmentId: sh.id, fromStatus: sh.status, toStatus: sh.status, reason: `إعادة جدولة إلى ${sh.pickupWindowStart}`, occurredAt: ctx.nowIso, actorId: ctx.actor.user.id, source: 'customer' });
    ctx.audit('shipment.reschedule', 'shipment', sh.id, `إعادة جدولة ${sh.trackingNo}`);
    ctx.emit('shipment.rescheduled', 'shipment', sh.id, sh.organizationId);
    return sh;
  },
});

// ---------------- التوزيع (M04 / BR-009 / UAT-007) ----------------
export interface AssignInput { shipmentId: string; courierId: string; boxId?: string | null; exceptionApprovalId?: string | null }
defineCommand<AssignInput, { shipment: T.Shipment; routeId: string }>({
  name: 'dispatch.assign', guard: ['ops_controller'], desc: L('إسناد مندوب وصندوق مع فحص الأهلية', 'Assign courier and box with eligibility check'),
  run(ctx, i) {
    const sh = shipment(ctx, i.shipmentId);
    if (!['confirmed', 'pickup_scheduled'].includes(sh.status)) ctx.fail('ASSIGN_NOT_ALLOWED', 'يمكن الإسناد للشحنات المؤكدة فقط', 'Only confirmed shipments can be assigned', 422);
    const c = must(ctx, ctx.db.couriers.find((x) => x.id === i.courierId), 'courier');
    const blockers = courierEligibility(ctx.db, c, ctx.now);
    if (blockers.length) ctx.fail('ELIGIBILITY_BLOCKED', blockers.map((b) => ELIGIBILITY_TEXT[b].ar).join('، '), blockers.map((b) => ELIGIBILITY_TEXT[b].en).join(', '), 422, 'courierId');
    if (i.boxId) {
      const box = must(ctx, ctx.db.boxes.find((b) => b.id === i.boxId), 'box');
      const rd = boxReadiness(ctx.db, box, ctx.now, sh.thermalClass);
      const hard = rd.reasons.filter((r) => !r.overridable);
      if (hard.length) ctx.fail('BOX_NOT_READY', hard.map((r) => r.ar).join('، '), hard.map((r) => r.en).join(', '), 422, 'boxId');
      if (rd.reasons.length) {
        const ok = ctx.db.approvalRequests.find((a) => a.id === i.exceptionApprovalId && a.kind === 'device_exception' && a.subjectId === `${box.id}:${sh.id}` && a.status === 'approved');
        if (!ok) ctx.fail('BOX_NOT_READY', `${rd.reasons.map((r) => r.ar).join('، ')} — يتطلب استثناءً معتمداً`, `${rd.reasons.map((r) => r.en).join(', ')} — requires an approved exception`, 422, 'boxId');
      }
      const occupied = activePackings(ctx.db, box.id);
      if (sh.dedicatedBox && occupied.length) ctx.fail('BOX_NOT_EMPTY', 'الشحنة تتطلب صندوقاً مخصصاً فارغاً', 'Shipment requires an empty dedicated box', 422, 'boxId');
      if (occupied.some((p) => p.dedicated)) ctx.fail('BOX_DEDICATED', 'الصندوق مخصص لشحنة أخرى', 'Box is dedicated to another shipment', 422, 'boxId');
      if (box.status === 'available') box.status = 'assigned';
      box.custodianType = 'courier'; box.custodianId = c.id;
    }
    // إلغاء إسناد سابق إن وُجد
    ctx.db.routeStops.filter((s) => s.shipmentIds.includes(sh.id) && s.status === 'pending').forEach((s) => (s.shipmentIds = s.shipmentIds.filter((x) => x !== sh.id)));
    const day = new Date(Date.parse(sh.pickupWindowStart));
    const code = `RT-${sh.originCity}-${String(day.getUTCMonth() + 1).padStart(2, '0')}${String(day.getUTCDate()).padStart(2, '0')}-${c.id.slice(-2)}`;
    let route = ctx.db.routes.find((r) => r.code === code && r.courierId === c.id);
    if (!route) { route = { id: ctx.id('rte'), code, serviceDate: iso(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())), originCity: sh.originCity, destCity: sh.originCity, status: 'planned', courierId: c.id, vehicleId: c.vehicleId, plannedDistanceKm: 0, createdAt: ctx.nowIso }; ctx.db.routes.push(route); }
    const seqN = ctx.db.routeStops.filter((s) => s.routeId === route!.id).length;
    ctx.db.routeStops.push({ id: ctx.id('stp'), routeId: route.id, seq: seqN + 1, addressId: sh.senderAddressId, stopType: 'pickup', shipmentIds: [sh.id], plannedAt: sh.pickupWindowStart, actualAt: null, status: 'pending' });
    if (sh.originCity === sh.destCity) ctx.db.routeStops.push({ id: ctx.id('stp'), routeId: route.id, seq: seqN + 2, addressId: sh.receiverAddressId, stopType: 'delivery', shipmentIds: [sh.id], plannedAt: sh.deliverBy, actualAt: null, status: 'pending' });
    // أرجل الرحلة
    if (!ctx.db.shipmentLegs.some((x) => x.shipmentId === sh.id)) {
      const leg = (l: Omit<T.TransportLeg, 'id'>) => { const x = { id: ctx.id('leg'), ...l }; ctx.db.legs.push(x); ctx.db.shipmentLegs.push({ id: ctx.id('shl'), shipmentId: sh.id, legId: x.id, seq: ctx.db.shipmentLegs.filter((y) => y.shipmentId === sh.id).length + 1, loadedAt: null, unloadedAt: null }); return x; };
      const ps = Date.parse(sh.pickupWindowStart);
      if (sh.mode === 'road_air') {
        leg({ routeId: route.id, mode: 'road', partnerId: null, courierId: c.id, vehicleId: c.vehicleId, originCity: sh.originCity, destCity: sh.originCity, flightNo: null, scheduledDeparture: iso(ps), scheduledArrival: iso(ps + HOUR), actualDeparture: null, actualArrival: null, status: 'planned' });
        leg({ routeId: null, mode: 'air', partnerId: null, courierId: null, vehicleId: null, originCity: sh.originCity, destCity: sh.destCity, flightNo: null, scheduledDeparture: iso(ps + 2.5 * HOUR), scheduledArrival: iso(ps + 4.5 * HOUR), actualDeparture: null, actualArrival: null, status: 'planned' });
        leg({ routeId: null, mode: 'road', partnerId: null, courierId: null, vehicleId: null, originCity: sh.destCity, destCity: sh.destCity, flightNo: null, scheduledDeparture: iso(ps + 5 * HOUR), scheduledArrival: iso(Date.parse(sh.deliverBy)), actualDeparture: null, actualArrival: null, status: 'planned' });
      } else leg({ routeId: route.id, mode: 'road', partnerId: null, courierId: c.id, vehicleId: c.vehicleId, originCity: sh.originCity, destCity: sh.destCity, flightNo: null, scheduledDeparture: iso(ps), scheduledArrival: sh.deliverBy, actualDeparture: null, actualArrival: null, status: 'planned' });
    } else {
      const first = ctx.db.legs.find((l) => l.id === ctx.db.shipmentLegs.find((x) => x.shipmentId === sh.id && x.seq === 1)?.legId);
      if (first && first.status === 'planned') { first.courierId = c.id; first.vehicleId = c.vehicleId; first.routeId = route.id; }
    }
    if (i.boxId) (sh as T.Shipment & { plannedBoxId?: string }).subStatus = `box:${i.boxId}`;
    if (sh.status === 'confirmed') transition(ctx, sh, 'pickup_scheduled', `إسناد ${c.name.ar}${i.boxId ? ' + صندوق' : ''}`);
    else { sh.version++; ctx.audit('dispatch.reassign', 'shipment', sh.id, `إعادة إسناد ${sh.trackingNo} إلى ${c.name.ar}`); }
    ctx.emit('box.assigned', 'shipment', sh.id, sh.organizationId, { courierId: c.id, boxId: i.boxId ?? null });
    if (c.userId) ctx.notify({ audience: 'courier', userId: c.userId, critical: sh.serviceLevel === 'stat', title: L(`مهمة جديدة ${sh.trackingNo}`, `New task ${sh.trackingNo}`), body: L('تمت إضافة استلام إلى مسارك', 'A pickup was added to your route'), link: `/tasks/${sh.id}` });
    ctx.notify({ audience: 'customer', organizationId: sh.organizationId, title: L(`تمت جدولة الاستلام ${sh.trackingNo}`, `Pickup scheduled ${sh.trackingNo}`), body: L(`المندوب: ${c.name.ar}`, `Courier: ${c.name.en}`), link: `/shipments/${sh.id}` });
    return { shipment: sh, routeId: route.id };
  },
});

defineCommand<{ shipmentId: string; boxId: string; reason: string }, T.ApprovalRequest>({
  name: 'dispatch.requestException', guard: ['ops_controller'], desc: L('طلب استثناء جاهزية مضبوط (DHC)', 'Request controlled readiness exception (DHC)'),
  run(ctx, { shipmentId, boxId, reason }) {
    const sh = shipment(ctx, shipmentId); const box = must(ctx, ctx.db.boxes.find((b) => b.id === boxId), 'box');
    const rd = boxReadiness(ctx.db, box, ctx.now, sh.thermalClass);
    if (rd.ready) ctx.fail('NO_EXCEPTION_NEEDED', 'الصندوق جاهز ولا يحتاج استثناءً', 'Box is ready; no exception needed', 422);
    if (rd.reasons.some((r) => !r.overridable)) ctx.fail('EXCEPTION_NOT_PERMITTED', 'لا يُسمح باستثناء يتجاوز ضوابط سلسلة التبريد الإلزامية', 'Exceptions cannot override mandatory cold-chain safeguards', 422);
    if (!reason?.trim()) ctx.fail('VALIDATION', 'المبرر مطلوب', 'Justification required', 422, 'reason');
    const a: T.ApprovalRequest = { id: ctx.id('apr'), kind: 'device_exception', subjectId: `${box.id}:${sh.id}`, title: L(`استثناء جاهزية ${box.code} لـ ${sh.trackingNo} — ${rd.reasons.map((r) => r.ar).join('، ')}`, `Readiness exception ${box.code} for ${sh.trackingNo} — ${rd.reasons.map((r) => r.en).join(', ')}`), requestedBy: ctx.actor.user.id, requiredRole: 'quality', status: 'pending', decidedBy: null, decidedAt: null, note: reason, createdAt: ctx.nowIso };
    ctx.db.approvalRequests.push(a);
    ctx.audit('dispatch.exception_requested', 'box', box.id, a.title.ar);
    ctx.notify({ audience: 'staff', title: L('طلب استثناء جاهزية', 'Readiness exception requested'), body: a.title, link: '/approvals' });
    return a;
  },
});

// ---------------- تطبيق المندوب: المسح والاستلام والتسليم ----------------
function courierGuard(ctx: Ctx, sh: T.Shipment) {
  if (isStaff(ctx.actor)) return null;
  const c = courierOf(ctx.actor, ctx.db);
  if (!c || !canReadShipment(ctx.db, ctx.actor, sh)) ctx.fail('NOT_FOUND', 'المهمة غير موجودة', 'Task not found', 404);
  return c;
}

defineCommand<{ shipment: string; boxCode: string }, { packing: T.Packing; box: T.Box }>({
  name: 'courier.scanPack', guard: ['courier', 'ops_controller', 'warehouse'], desc: L('مسح QR للشحنة والصندوق وربطهما (SHP-003)', 'Scan shipment and box QR and link them (SHP-003)'),
  run(ctx, { shipment: ref, boxCode }) {
    const sh = shipment(ctx, ref); courierGuard(ctx, sh);
    if (!['pickup_scheduled', 'collected'].includes(sh.status)) ctx.fail('SCAN_NOT_ALLOWED', 'الشحنة ليست في مرحلة الاستلام', 'Shipment is not at pickup stage', 422);
    if (packingOf(ctx.db, sh.id)) ctx.fail('ALREADY_PACKED', 'الشحنة مرتبطة بصندوق بالفعل', 'Shipment already packed in a box', 409);
    const box = ctx.db.boxes.find((b) => b.code === boxCode?.trim().toUpperCase() || b.id === boxCode);
    if (!box) ctx.fail('BOX_NOT_FOUND', 'رمز الصندوق غير معروف', 'Unknown box code', 404, 'boxCode');
    const planned = sh.subStatus?.startsWith('box:') ? sh.subStatus.slice(4) : null;
    if (planned && planned !== box!.id) ctx.fail('WRONG_BOX', 'هذا ليس الصندوق المسند لهذه الشحنة', 'This is not the box assigned to this shipment', 422, 'boxCode');
    const rd = boxReadiness(ctx.db, box!, ctx.now, sh.thermalClass);
    const hard = rd.reasons.filter((r) => !r.overridable && r.code !== 'BOX_NOT_AVAILABLE');
    if (hard.length) ctx.fail('BOX_NOT_READY', hard.map((r) => r.ar).join('، '), hard.map((r) => r.en).join(', '), 422, 'boxCode');
    if (rd.reasons.some((r) => r.overridable) && !ctx.db.approvalRequests.some((a) => a.kind === 'device_exception' && a.subjectId === `${box!.id}:${sh.id}` && a.status === 'approved')) ctx.fail('BOX_NOT_READY', rd.reasons.map((r) => r.ar).join('، '), rd.reasons.map((r) => r.en).join(', '), 422, 'boxCode');
    const occ = activePackings(ctx.db, box!.id);
    if (occ.length >= box!.capacity) ctx.fail('BOX_FULL', 'الصندوق ممتلئ', 'Box is at capacity', 422, 'boxCode');
    if ((sh.dedicatedBox && occ.length) || occ.some((p) => p.dedicated)) ctx.fail('BOX_DEDICATED', 'تعارض مع صندوق مخصص', 'Conflicts with a dedicated box', 422, 'boxCode');
    const p: T.Packing = { id: ctx.id('pck'), shipmentId: sh.id, boxId: box!.id, packedAt: ctx.nowIso, unpackedAt: null, packedBy: ctx.actor.user.id, dedicated: sh.dedicatedBox };
    ctx.db.packings.push(p);
    const cou = courierOf(ctx.actor, ctx.db);
    Object.assign(box!, { status: 'in_use', custodianType: 'courier', custodianId: cou?.id ?? box!.custodianId, locationCity: sh.originCity });
    const dev = ctx.db.devices.find((d) => ctx.db.pairings.some((x) => x.boxId === box!.id && !x.unpairedAt && x.deviceId === d.id));
    if (dev && dev.state === 'ready') dev.state = 'assigned';
    sh.subStatus = null; sh.version++;
    ctx.emit('shipment.packed', 'shipment', sh.id, sh.organizationId, { boxId: box!.id });
    ctx.audit('shipment.pack', 'shipment', sh.id, `${sh.trackingNo} ← ${box!.code}`);
    return { packing: p, box: box! };
  },
});

export interface CustodyInput { shipment: string; signedBy: string; method?: 'signature' | 'qr' | 'pin'; lat?: number | null; lng?: number | null; occurredAt?: string; offline?: boolean }
defineCommand<CustodyInput, T.Shipment>({
  name: 'courier.pickup', guard: ['courier', 'ops_controller'], desc: L('تأكيد الاستلام من العميل مع دليل الحيازة', 'Confirm pickup with custody evidence'),
  run(ctx, i) {
    const sh = shipment(ctx, i.shipment); const c = courierGuard(ctx, sh);
    const pk = packingOf(ctx.db, sh.id);
    if (!pk) ctx.fail('NOT_PACKED', 'امسح رمز الصندوق أولاً لربط الشحنة به', 'Scan the box QR first to link the shipment', 422);
    const from = ctx.db.addresses.find((a) => a.id === sh.senderAddressId)!;
    const courier = c ?? ctx.db.couriers.find((x) => ctx.db.routes.some((r) => r.courierId === x.id && ctx.db.routeStops.some((s) => s.routeId === r.id && s.shipmentIds.includes(sh.id))))!;
    addCustody(ctx, { shipmentId: sh.id, boxId: pk!.boxId, fromType: 'customer', fromId: sh.organizationId, toType: 'courier', toId: courier.id, eventType: 'pickup', occurredAt: i.occurredAt ?? ctx.nowIso, evidence: { signedBy: i.signedBy, method: i.method ?? 'signature' }, source: i.offline ? 'offline_sync' : c ? 'courier_app' : 'admin', lat: i.lat ?? from.lat, lng: i.lng ?? from.lng });
    transition(ctx, sh, 'collected', 'استلام من المرسل', c ? 'courier_app' : 'admin');
    ctx.db.routeStops.filter((s) => s.shipmentIds.includes(sh.id) && s.stopType === 'pickup' && s.status === 'pending').forEach((s) => { s.status = 'done'; s.actualAt = ctx.nowIso; const r = ctx.db.routes.find((x) => x.id === s.routeId); if (r && r.status !== 'in_progress') r.status = 'in_progress'; });
    const leg1 = ctx.db.legs.find((l) => l.id === ctx.db.shipmentLegs.find((x) => x.shipmentId === sh.id && x.seq === 1)?.legId);
    if (leg1 && !leg1.actualDeparture) { leg1.actualDeparture = ctx.nowIso; leg1.status = 'departed'; }
    if (courier) courier.status = 'on_route';
    ctx.notify({ audience: 'customer', organizationId: sh.organizationId, title: L(`تم استلام ${sh.trackingNo}`, `${sh.trackingNo} collected`), body: L('الشحنة الآن بعهدة المندوب.', 'Shipment is now in courier custody.'), link: `/shipments/${sh.id}` });
    return sh;
  },
});

defineCommand<{ shipment: string }, T.Shipment>({
  name: 'courier.startTransit', guard: ['courier', 'ops_controller'], desc: L('بدء النقل', 'Start transit'),
  run(ctx, { shipment: ref }) { const sh = shipment(ctx, ref); courierGuard(ctx, sh); transition(ctx, sh, 'in_transit', 'بدء النقل', 'courier_app'); return sh; },
});

defineCommand<{ shipment: string }, T.Shipment>({
  name: 'courier.arrive', guard: ['courier', 'ops_controller'], desc: L('الوصول إلى نقطة التسليم', 'Arrive at handover point'),
  run(ctx, { shipment: ref }) { const sh = shipment(ctx, ref); courierGuard(ctx, sh); transition(ctx, sh, 'at_handover', 'الوصول إلى نقطة التسليم', 'courier_app'); return sh; },
});

export interface HandoverInput extends CustodyInput { toType: 'partner' | 'air_carrier' | 'warehouse' | 'courier'; toId: string; legId?: string }
defineCommand<HandoverInput, T.Shipment>({
  name: 'custody.handover', guard: ['courier', 'ops_controller', 'warehouse'], desc: L('نقل حيازة ذرّي مع دليل (BR-005)', 'Atomic custody transfer with evidence (BR-005)'),
  run(ctx, i) {
    const sh = shipment(ctx, i.shipment); courierGuard(ctx, sh);
    if (!['collected', 'in_transit', 'at_handover', 'return_pending'].includes(sh.status)) ctx.fail('HANDOVER_NOT_ALLOWED', 'الحالة الحالية لا تسمح بنقل الحيازة', 'Current status does not allow handover', 422);
    const cur = currentCustodian(ctx.db, sh.id);
    if (!cur) ctx.fail('NO_CUSTODY', 'لا توجد حيازة مسجلة', 'No recorded custody', 422);
    const me = courierOf(ctx.actor, ctx.db);
    if (me && !(cur!.type === 'courier' && cur!.id === me.id)) ctx.fail('NOT_CUSTODIAN', 'الشحنة ليست بعهدتك حالياً', 'Shipment is not currently in your custody', 409);
    if (i.toType === 'partner' || i.toType === 'air_carrier') {
      const p = must(ctx, ctx.db.partners.find((x) => x.id === i.toId), 'partner');
      const e = partnerEligibility(ctx.db, p, ctx.now);
      if (e.length) ctx.fail('ELIGIBILITY_BLOCKED', e.map((x) => ELIGIBILITY_TEXT[x].ar).join('، '), e.map((x) => ELIGIBILITY_TEXT[x].en).join(', '), 422, 'toId');
    }
    if (i.toType === 'courier') { const c2 = must(ctx, ctx.db.couriers.find((x) => x.id === i.toId), 'courier'); const e = courierEligibility(ctx.db, c2, ctx.now).filter((x) => x !== 'COURIER_UNAVAILABLE'); if (e.length) ctx.fail('ELIGIBILITY_BLOCKED', e.map((x) => ELIGIBILITY_TEXT[x].ar).join('، '), e.map((x) => ELIGIBILITY_TEXT[x].en).join(', '), 422, 'toId'); }
    const pk = packingOf(ctx.db, sh.id);
    addCustody(ctx, { shipmentId: sh.id, boxId: pk?.boxId ?? null, fromType: cur!.type, fromId: cur!.id, toType: i.toType, toId: i.toId, eventType: i.toType === 'warehouse' ? 'warehouse_in' : 'handover', occurredAt: i.occurredAt ?? ctx.nowIso, evidence: { signedBy: i.signedBy, method: i.method ?? 'qr' }, source: me ? (i.offline ? 'offline_sync' : 'courier_app') : 'admin', lat: i.lat ?? null, lng: i.lng ?? null });
    const legs = ctx.db.shipmentLegs.filter((x) => x.shipmentId === sh.id).map((x) => ({ x, leg: ctx.db.legs.find((l) => l.id === x.legId)! }));
    if (i.toType === 'air_carrier') { const air = legs.find((l) => l.leg.mode === 'air'); if (air && !air.leg.partnerId) air.leg.partnerId = i.toId; }
    if (i.toType === 'courier') { const nextLeg = legs.find((l) => l.leg.status === 'planned' && l.leg.mode === 'road'); if (nextLeg) { nextLeg.leg.courierId = i.toId; nextLeg.leg.status = 'departed'; nextLeg.leg.actualDeparture = ctx.nowIso; } }
    if (sh.status === 'collected' || sh.status === 'at_handover') transition(ctx, sh, 'in_transit', `تسليم إلى ${i.toType}`, me ? 'courier_app' : 'admin');
    if (pk) { const box = ctx.db.boxes.find((b) => b.id === pk.boxId)!; box.custodianType = i.toType; box.custodianId = i.toId; }
    return sh;
  },
});

export interface DeliverInput { shipment: string; recipientName: string; signature: string; photoRef?: string | null; notes?: string; occurredAt?: string; offline?: boolean }
defineCommand<DeliverInput, T.Shipment>({
  name: 'courier.deliver', guard: ['courier', 'ops_controller'], desc: L('التسليم مع إثبات التسليم', 'Deliver with proof of delivery'),
  run(ctx, i) {
    const sh = shipment(ctx, i.shipment); const c = courierGuard(ctx, sh);
    if (!i.recipientName?.trim()) ctx.fail('VALIDATION', 'اسم المستلم مطلوب', 'Recipient name is required', 422, 'recipientName');
    if (!i.signature?.trim()) ctx.fail('VALIDATION', 'توقيع المستلم مطلوب', 'Recipient signature is required', 422, 'signature');
    if (!['in_transit', 'at_handover', 'exception'].includes(sh.status)) ctx.fail('SHIPMENT_TRANSITION_NOT_ALLOWED', 'لا يمكن التسليم قبل وصول الشحنة', 'Cannot deliver before arrival', 422);
    const cur = currentCustodian(ctx.db, sh.id);
    if (c && !(cur?.type === 'courier' && cur.id === c.id)) ctx.fail('NOT_CUSTODIAN', 'لا يمكن التسليم: الشحنة ليست بعهدتك (حيازة مفقودة)', 'Cannot deliver: shipment is not in your custody', 409);
    if (!c && cur?.type !== 'courier') ctx.fail('NOT_CUSTODIAN', 'يجب أن تكون الشحنة بعهدة مندوب', 'Shipment must be in courier custody', 409);
    const to = ctx.db.addresses.find((a) => a.id === sh.receiverAddressId)!;
    const pk = packingOf(ctx.db, sh.id);
    addCustody(ctx, { shipmentId: sh.id, boxId: pk?.boxId ?? null, fromType: 'courier', fromId: cur!.id, toType: 'recipient', toId: sh.receiverOrgId ?? to.id, eventType: 'delivery', occurredAt: i.occurredAt ?? ctx.nowIso, evidence: { signedBy: i.recipientName, method: 'signature' }, source: i.offline ? 'offline_sync' : c ? 'courier_app' : 'admin', lat: to.lat, lng: to.lng });
    ctx.db.pods.push({ id: ctx.id('pod'), shipmentId: sh.id, recipientName: i.recipientName, signature: i.signature, photoRef: i.photoRef ?? null, deliveredAt: i.occurredAt ?? ctx.nowIso, verifiedBy: ctx.actor.user.id, notes: i.notes ?? '' });
    if (sh.status === 'exception') transition(ctx, sh, 'at_handover', 'استئناف بعد استثناء');
    transition(ctx, sh, 'delivered', 'تسليم مع إثبات', c ? 'courier_app' : 'admin');
    sh.eta = null;
    if (pk) {
      pk.unpackedAt = ctx.nowIso;
      const box = ctx.db.boxes.find((b) => b.id === pk.boxId)!;
      if (!activePackings(ctx.db, box.id).length) { box.status = 'returning'; ctx.emit('box.returned', 'box', box.id, null, { reason: 'empty after delivery' }); }
    }
    ctx.db.routeStops.filter((s) => s.shipmentIds.includes(sh.id) && s.stopType === 'delivery' && s.status === 'pending').forEach((s) => { s.status = 'done'; s.actualAt = ctx.nowIso; });
    ctx.db.legs.filter((l) => ctx.db.shipmentLegs.some((x) => x.shipmentId === sh.id && x.legId === l.id) && l.status === 'departed').forEach((l) => { l.status = 'arrived'; l.actualArrival = ctx.nowIso; });
    ctx.db.delayAlerts.filter((d) => d.shipmentId === sh.id && !d.resolvedAt).forEach((d) => (d.resolvedAt = ctx.nowIso));
    ctx.notify({ audience: 'customer', organizationId: sh.organizationId, title: L(`تم تسليم ${sh.trackingNo}`, `${sh.trackingNo} delivered`), body: L(`المستلم: ${i.recipientName}`, `Recipient: ${i.recipientName}`), link: `/shipments/${sh.id}` });
    if (sh.receiverOrgId) ctx.notify({ audience: 'customer', organizationId: sh.receiverOrgId, title: L(`وصلت شحنة واردة ${sh.trackingNo}`, `Inbound ${sh.trackingNo} arrived`), body: L('يمكنكم تسجيل القرار السريري', 'You can record the clinical disposition'), link: `/inbound/${sh.id}` });
    return sh;
  },
});

defineCommand<{ shipment: string; reasonCode: string; notes?: string; occurredAt?: string }, T.Shipment>({
  name: 'courier.failAttempt', guard: ['courier', 'ops_controller'], desc: L('تسجيل محاولة تسليم فاشلة', 'Record failed delivery attempt'),
  run(ctx, i) {
    const sh = shipment(ctx, i.shipment); const c = courierGuard(ctx, sh);
    if (!i.reasonCode) ctx.fail('VALIDATION', 'السبب مطلوب', 'Reason required', 422, 'reasonCode');
    ctx.db.deliveryAttempts.push({ id: ctx.id('att'), shipmentId: sh.id, attemptedAt: i.occurredAt ?? ctx.nowIso, outcome: 'failed', reasonCode: i.reasonCode, notes: i.notes ?? '', courierId: c?.id ?? null });
    transition(ctx, sh, 'failed', i.notes || i.reasonCode, c ? 'courier_app' : 'admin');
    ctx.emit('shipment.delivery_attempt_failed', 'shipment', sh.id, sh.organizationId, { reasonCode: i.reasonCode });
    ctx.notify({ audience: 'staff', critical: true, title: L(`تسليم فاشل ${sh.trackingNo}`, `Delivery failed ${sh.trackingNo}`), body: L('مطلوب قرار مخوّل: إعادة محاولة / وجهة بديلة / حجز / إرجاع', 'Authorized decision needed: retry / alternate / hold / return'), link: `/returns?shipment=${sh.id}` });
    ctx.notify({ audience: 'customer', organizationId: sh.organizationId, title: L(`تعذّر تسليم ${sh.trackingNo}`, `Delivery failed ${sh.trackingNo}`), body: L('سنتواصل معكم لتحديد الإجراء.', 'We will contact you about next steps.'), link: `/shipments/${sh.id}` });
    return sh;
  },
});

// ---------------- المرتجعات (RET-001..015 / UAT-008) ----------------
defineCommand<{ shipment: string; reasonCode: string; alternateAddressId?: string | null; note?: string }, T.ReturnOrder>({
  name: 'returns.request', guard: 'any', desc: L('طلب إرجاع أو وجهة بديلة', 'Request return or alternate destination'),
  run(ctx, i) {
    const sh = readable(ctx, i.shipment);
    if (!isStaff(ctx.actor) && !canWriteShipmentFor(ctx.actor, sh.organizationId, sh.branchId)) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403);
    if (!['failed', 'in_transit', 'at_handover', 'exception'].includes(sh.status)) ctx.fail('RETURN_NOT_ALLOWED', 'لا يمكن طلب إرجاع في هذه الحالة', 'Return not allowed in this status', 422);
    if (ctx.db.returns.some((r) => r.shipmentId === sh.id && ['requested', 'authorized', 'in_progress'].includes(r.status))) ctx.fail('RETURN_EXISTS', 'يوجد طلب إرجاع مفتوح', 'An open return already exists', 409);
    if (i.alternateAddressId) { const a = addr(ctx, i.alternateAddressId); if (!a.authorized) ctx.fail('VALIDATION', 'الوجهة البديلة غير معتمدة', 'Alternate destination not authorized', 422, 'alternateAddressId'); }
    const r: T.ReturnOrder = { id: ctx.id('ret'), shipmentId: sh.id, reasonCode: i.reasonCode, decision: null, responsibleParty: null, requestedBy: ctx.actor.user.id, authorizedBy: null, status: 'requested', alternateAddressId: i.alternateAddressId ?? null, costHalala: 0, createdAt: ctx.nowIso, completedAt: null };
    ctx.db.returns.push(r);
    ctx.emit('shipment.return_requested', 'shipment', sh.id, sh.organizationId, { returnId: r.id });
    ctx.audit('returns.request', 'shipment', sh.id, `طلب إرجاع ${sh.trackingNo}: ${i.reasonCode}`);
    ctx.notify({ audience: 'staff', title: L(`طلب إرجاع ${sh.trackingNo}`, `Return requested ${sh.trackingNo}`), body: L('بانتظار قرار العمليات', 'Awaiting operations decision'), link: '/returns' });
    return r;
  },
});

defineCommand<{ returnId?: string; shipment?: string; decision: NonNullable<T.ReturnOrder['decision']>; responsibleParty: NonNullable<T.ReturnOrder['responsibleParty']>; alternateAddressId?: string | null; note?: string }, T.ReturnOrder>({
  name: 'returns.authorize', guard: ['ops_controller'], desc: L('قرار مخوّل للتسليم الفاشل', 'Authorized decision on failed delivery'),
  run(ctx, i) {
    let r = i.returnId ? ctx.db.returns.find((x) => x.id === i.returnId) : undefined;
    const sh = shipment(ctx, r?.shipmentId ?? i.shipment!);
    if (!r) { r = { id: ctx.id('ret'), shipmentId: sh.id, reasonCode: 'OPS_DECISION', decision: null, responsibleParty: null, requestedBy: ctx.actor.user.id, authorizedBy: null, status: 'requested', alternateAddressId: null, costHalala: 0, createdAt: ctx.nowIso, completedAt: null }; ctx.db.returns.push(r); }
    if (r.status !== 'requested') ctx.fail('RETURN_DECIDED', 'تم اتخاذ القرار مسبقاً', 'Decision already made', 409);
    r.decision = i.decision; r.responsibleParty = i.responsibleParty; r.authorizedBy = ctx.actor.user.id; r.status = 'in_progress';
    r.costHalala = i.decision === 'retry' ? sar(60) : i.decision === 'return_to_sender' ? sar(95) : i.decision === 'alternate_destination' ? sar(80) : sar(120);
    if (i.decision === 'alternate_destination') {
      const a = addr(ctx, i.alternateAddressId ?? r.alternateAddressId ?? ''); sh.receiverAddressId = a.id; sh.destCity = a.cityCode; sh.receiverOrgId = a.organizationId; r.alternateAddressId = a.id;
    }
    if (i.decision === 'retry' || i.decision === 'alternate_destination') { transition(ctx, sh, 'in_transit', i.decision === 'retry' ? 'إعادة محاولة التسليم' : 'تحويل إلى وجهة بديلة معتمدة'); r.status = 'completed'; r.completedAt = ctx.nowIso; }
    else { if (sh.status !== 'return_pending') { if (sh.status !== 'failed') transition(ctx, sh, 'failed', 'قرار إرجاع'); transition(ctx, sh, 'return_pending', i.decision === 'qualified_hold' ? 'حجز مؤقت مؤهل بانتظار القرار' : 'إرجاع إلى المرسل'); } sh.subStatus = i.decision; }
    // تحميل التكلفة للطرف المسؤول (RET / 6.2)
    if (i.responsibleParty === 'customer') ctx.db.invoiceLines.push({ id: ctx.id('inl'), invoiceId: 'pending', shipmentId: sh.id, description: L(`رسم ${i.decision === 'retry' ? 'إعادة محاولة' : i.decision === 'return_to_sender' ? 'إرجاع' : i.decision === 'alternate_destination' ? 'تحويل وجهة' : 'حجز مؤقت'} ${sh.trackingNo}`, `${i.decision} fee ${sh.trackingNo}`), qty: 1, unitPrice: r.costHalala, vat: Math.round(r.costHalala * 0.15), lineTotal: r.costHalala + Math.round(r.costHalala * 0.15) });
    else ctx.db.costRecords.push({ id: ctx.id('cst'), costType: 'courier', sourceRef: `return:${r.id}:${i.responsibleParty}`, estimated: r.costHalala, actual: null, incurredAt: ctx.nowIso, allocated: false });
    ctx.audit('returns.authorize', 'shipment', sh.id, `${sh.trackingNo}: ${i.decision} — التكلفة على ${i.responsibleParty}`);
    ctx.notify({ audience: 'customer', organizationId: sh.organizationId, title: L(`قرار بشأن ${sh.trackingNo}`, `Decision on ${sh.trackingNo}`), body: L(`القرار: ${i.decision}`, `Decision: ${i.decision}`), link: `/shipments/${sh.id}` });
    return r;
  },
});

defineCommand<{ returnId: string; signedBy: string }, T.ReturnOrder>({
  name: 'returns.complete', guard: ['ops_controller', 'courier'], desc: L('إتمام الإرجاع مع دليل الحيازة', 'Complete return with custody evidence'),
  run(ctx, { returnId, signedBy }) {
    const r = must(ctx, ctx.db.returns.find((x) => x.id === returnId), 'return');
    const sh = shipment(ctx, r.shipmentId); courierGuard(ctx, sh);
    if (r.status !== 'in_progress' || sh.status !== 'return_pending') ctx.fail('RETURN_NOT_IN_PROGRESS', 'الإرجاع غير جارٍ', 'Return is not in progress', 422);
    const cur = currentCustodian(ctx.db, sh.id);
    const pk = packingOf(ctx.db, sh.id);
    addCustody(ctx, { shipmentId: sh.id, boxId: pk?.boxId ?? null, fromType: cur?.type ?? 'courier', fromId: cur?.id ?? 'unknown', toType: 'customer', toId: sh.organizationId, eventType: 'return', occurredAt: ctx.nowIso, evidence: { signedBy, method: 'signature' }, source: 'admin', lat: null, lng: null });
    transition(ctx, sh, 'returned', 'تم الإرجاع إلى المرسل');
    if (pk) { pk.unpackedAt = ctx.nowIso; const box = ctx.db.boxes.find((b) => b.id === pk.boxId)!; if (!activePackings(ctx.db, box.id).length) box.status = 'returning'; }
    r.status = 'completed'; r.completedAt = ctx.nowIso;
    ctx.emit('shipment.return_completed', 'shipment', sh.id, sh.organizationId, { returnId });
    return r;
  },
});

// ---------------- الفقدان والاسترداد (LDM / UAT-009) ----------------
defineCommand<{ shipment: string; basis: ('custody_gap' | 'gps_silence' | 'partner_report' | 'customer_report')[]; note: string }, T.Shipment>({
  name: 'lost.suspect', guard: ['ops_controller', 'quality'], desc: L('فتح اشتباه فقدان', 'Open suspected loss'),
  run(ctx, { shipment: ref, basis, note }) {
    const sh = shipment(ctx, ref);
    if (!basis?.length || (basis.length === 1 && basis[0] === 'gps_silence')) ctx.fail('INSUFFICIENT_BASIS', 'صمت GPS وحده لا يكفي لاشتباه الفقدان (LDM)', 'GPS silence alone is insufficient for suspected loss (LDM)', 422, 'basis');
    if (sh.lostState !== 'none' && sh.lostState !== 'recovered') ctx.fail('ALREADY_SUSPECTED', 'الحالة مسجلة مسبقاً', 'Already recorded', 409);
    if (sh.status !== 'exception') transition(ctx, sh, 'exception', `اشتباه فقدان: ${note}`);
    sh.lostState = 'suspected'; sh.subStatus = 'suspected_lost';
    const inc: T.Incident = { id: ctx.id('inc'), code: `QI-2026-${ctx.seq('qi', 4)}`, shipmentId: sh.id, incidentType: 'suspected_lost', severity: 'critical', status: 'investigating', title: L(`اشتباه فقدان ${sh.trackingNo}`, `Suspected loss ${sh.trackingNo}`), findings: note, openedAt: ctx.nowIso, closedAt: null, ownerId: ctx.actor.user.id };
    ctx.db.incidents.push(inc);
    ctx.db.approvalRequests.push({ id: ctx.id('apr'), kind: 'lost_declaration', subjectId: sh.id, title: L(`إعلان فقدان ${sh.trackingNo} — يتطلب العمليات والجودة`, `Declare ${sh.trackingNo} lost — needs operations and quality`), requestedBy: ctx.actor.user.id, requiredRole: 'quality', status: 'pending', decidedBy: null, decidedAt: null, note, createdAt: ctx.nowIso });
    ctx.emit('shipment.suspected_lost', 'shipment', sh.id, sh.organizationId);
    return sh;
  },
});

defineCommand<{ shipment: string; decision: 'approve' | 'reject'; note?: string }, T.Shipment>({
  name: 'lost.approve', guard: ['ops_controller', 'quality'], desc: L('اعتماد إعلان الفقدان (مشترك: العمليات + الجودة)', 'Approve loss declaration (joint ops + quality)'),
  run(ctx, { shipment: ref, decision, note }) {
    const sh = shipment(ctx, ref);
    if (sh.lostState !== 'suspected') ctx.fail('NOT_SUSPECTED', 'لا يوجد اشتباه فقدان مفتوح', 'No open suspected loss', 422);
    const role: T.RoleCode = ctx.actor.roles.includes('quality') ? 'quality' : 'ops_controller';
    if (ctx.db.approvals.some((a) => a.subjectType === 'lost_declaration' && a.subjectId === sh.id && a.approvalRole === role && a.decision === 'approve')) ctx.fail('ALREADY_APPROVED', 'سبق اعتماد هذا الدور', 'This role has already approved', 409);
    ctx.db.approvals.push({ id: ctx.id('apv'), subjectType: 'lost_declaration', subjectId: sh.id, approvalRole: role, approverId: ctx.actor.user.id, decision, decidedAt: ctx.nowIso, note: note ?? '' });
    ctx.audit('lost.approval', 'shipment', sh.id, `${role} ${decision} — ${sh.trackingNo}`);
    const req = ctx.db.approvalRequests.find((a) => a.kind === 'lost_declaration' && a.subjectId === sh.id && a.status === 'pending');
    if (decision === 'reject') { sh.lostState = 'none'; sh.subStatus = null; if (req) Object.assign(req, { status: 'rejected', decidedBy: ctx.actor.user.id, decidedAt: ctx.nowIso }); return sh; }
    const roles = new Set(ctx.db.approvals.filter((a) => a.subjectType === 'lost_declaration' && a.subjectId === sh.id && a.decision === 'approve').map((a) => a.approvalRole));
    if (roles.has('ops_controller') && roles.has('quality')) {
      sh.lostState = 'declared'; sh.subStatus = 'lost_declared'; sh.version++;
      if (req) Object.assign(req, { status: 'approved', decidedBy: ctx.actor.user.id, decidedAt: ctx.nowIso });
      ctx.db.statusEvents.push({ id: ctx.id('sev'), shipmentId: sh.id, fromStatus: sh.status, toStatus: sh.status, reason: 'إعلان فقدان نهائي باعتماد مشترك (العمليات + الجودة)', occurredAt: ctx.nowIso, actorId: ctx.actor.user.id, source: 'admin' });
      ctx.emit('shipment.loss_confirmed', 'shipment', sh.id, sh.organizationId);
      ctx.notify({ audience: 'customer', organizationId: sh.organizationId, critical: true, title: L(`إشعار فقدان ${sh.trackingNo}`, `Loss notice ${sh.trackingNo}`), body: L('تم إعلان فقدان الشحنة بعد التحقيق؛ يمكنكم تقديم مطالبة.', 'The shipment was declared lost after investigation; you may file a claim.'), link: `/shipments/${sh.id}` });
    }
    return sh;
  },
});

defineCommand<{ shipment: string; note: string; signedBy: string }, T.Shipment>({
  name: 'lost.recover', guard: ['ops_controller'], desc: L('تسجيل استرداد شحنة (لا يحذف الإعلان)', 'Record recovery (declaration retained)'),
  run(ctx, { shipment: ref, note, signedBy }) {
    const sh = shipment(ctx, ref);
    if (!['suspected', 'declared'].includes(sh.lostState)) ctx.fail('NOT_LOST', 'الشحنة غير معلنة مفقودة', 'Shipment is not lost', 422);
    const prev = sh.lostState;
    sh.lostState = 'recovered'; sh.subStatus = 'recovered';
    addCustody(ctx, { shipmentId: sh.id, boxId: packingOf(ctx.db, sh.id)?.boxId ?? null, fromType: 'warehouse', fromId: 'unknown', toType: 'warehouse', toId: 'wh_ruh', eventType: 'warehouse_in', occurredAt: ctx.nowIso, evidence: { signedBy, method: 'signature' }, source: 'admin', lat: null, lng: null });
    transition(ctx, sh, 'in_transit', `استرداد بعد ${prev === 'declared' ? 'إعلان فقدان' : 'اشتباه'}: ${note}`);
    ctx.emit('shipment.recovered', 'shipment', sh.id, sh.organizationId, { previous: prev });
    ctx.db.approvalRequests.filter((a) => a.kind === 'lost_declaration' && a.subjectId === sh.id && a.status === 'pending').forEach((a) => Object.assign(a, { status: 'rejected', decidedBy: ctx.actor.user.id, decidedAt: ctx.nowIso, note: 'تم الاسترداد' }));
    return sh;
  },
});

// ---------------- القرار السريري (TEMP-006 / QMS-002) ----------------
defineCommand<{ shipment: string; decision: T.ClinicalDisposition['decision']; authorizedContact: string; note?: string; evidenceRef?: string }, T.ClinicalDisposition>({
  name: 'disposition.record', guard: ['receiving_lab', 'quality', 'customer_service'], desc: L('تسجيل قرار المؤسسة المستلمة', 'Record receiving institution disposition'),
  run(ctx, i) {
    const sh = readable(ctx, i.shipment);
    if (sh.status !== 'delivered') ctx.fail('NOT_DELIVERED', 'يُسجّل القرار بعد التسليم فقط', 'Disposition is recorded after delivery only', 422);
    const onBehalf = isStaff(ctx.actor);
    if (!onBehalf && !ctx.actor.memberships.some((m) => m.role === 'receiving_lab' && m.organizationId === sh.receiverOrgId)) ctx.fail('FORBIDDEN', 'فقط المؤسسة المستلمة المخوّلة', 'Only the authorized receiving institution', 403);
    if (onBehalf && !i.evidenceRef) ctx.fail('VALIDATION', 'الإدخال نيابة يتطلب مرفق دليل من المؤسسة', 'On-behalf entry requires institution evidence', 422, 'evidenceRef');
    if (!i.authorizedContact?.trim()) ctx.fail('VALIDATION', 'اسم المخوّل مطلوب', 'Authorized contact required', 422, 'authorizedContact');
    if (ctx.db.dispositions.some((d) => d.shipmentId === sh.id)) ctx.fail('ALREADY_RECORDED', 'تم تسجيل القرار مسبقاً', 'Already recorded', 409);
    const d: T.ClinicalDisposition = { id: ctx.id('dsp'), shipmentId: sh.id, institutionId: sh.receiverOrgId ?? 'unknown', decision: i.decision, decidedAt: ctx.nowIso, authorizedContact: i.authorizedContact, note: i.note ?? '', enteredBy: ctx.actor.user.id, onBehalf };
    ctx.db.dispositions.push(d);
    ctx.audit('disposition.record', 'shipment', sh.id, `قرار المؤسسة المستلمة: ${i.decision}${onBehalf ? ' (نيابة بدليل)' : ''}`);
    ctx.emit('quality.clinical_disposition_recorded', 'shipment', sh.id, sh.organizationId, { decision: i.decision });
    return d;
  },
});

// ---------------- الطلبات المتكررة (SHP-002) ----------------
defineCommand<{ organizationId: string; branchId: string | null; senderAddressId: string; receiverAddressId: string; thermalClass: T.ThermalClass; serviceLevel: T.ServiceLevel; rrule: T.Recurring['rrule']; time: string }, T.Recurring>({
  name: 'recurring.create', guard: 'any', desc: L('جدولة استلام متكرر', 'Create recurring pickup'),
  run(ctx, i) {
    if (!canWriteShipmentFor(ctx.actor, i.organizationId, i.branchId)) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403);
    if (!/^\d{2}:\d{2}$/.test(i.time)) ctx.fail('VALIDATION', 'الوقت بصيغة HH:MM', 'Time must be HH:MM', 422, 'time');
    const r: T.Recurring = { id: ctx.id('rec'), organizationId: i.organizationId, branchId: i.branchId, template: { thermalClass: i.thermalClass, serviceLevel: i.serviceLevel, senderAddressId: i.senderAddressId, receiverAddressId: i.receiverAddressId }, rrule: i.rrule, time: i.time, active: true, nextRunAt: iso(ctx.now + DAY), createdBy: ctx.actor.user.id };
    ctx.db.recurrings.push(r); ctx.audit('recurring.create', 'recurring', r.id, `جدولة ${i.rrule} ${i.time}`); return r;
  },
});
defineCommand<{ id: string; active: boolean }, T.Recurring>({
  name: 'recurring.toggle', guard: 'any', desc: L('إيقاف/تفعيل التكرار', 'Pause/resume recurring'),
  run(ctx, { id, active }) { const r = must(ctx, ctx.db.recurrings.find((x) => x.id === id), 'recurring'); if (!canWriteShipmentFor(ctx.actor, r.organizationId, r.branchId)) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403); r.active = active; return r; },
});
defineCommand<{ id: string }, T.Shipment>({
  name: 'recurring.runNow', guard: 'any', desc: L('توليد طلب الاستلام التالي الآن', 'Generate next pickup now'),
  run(ctx, { id }) {
    const r = must(ctx, ctx.db.recurrings.find((x) => x.id === id), 'recurring');
    if (!r.active) ctx.fail('RECURRING_PAUSED', 'التكرار موقوف', 'Recurring is paused', 422);
    const start = Math.ceil((ctx.now + HOUR) / (15 * MIN)) * 15 * MIN;
    const sh = ctx.exec<T.Shipment>('shipment.create', { organizationId: r.organizationId, branchId: r.branchId, senderAddressId: r.template.senderAddressId!, receiverAddressId: r.template.receiverAddressId!, receiverOrgId: r.template.receiverOrgId ?? null, thermalClass: r.template.thermalClass!, serviceLevel: r.template.serviceLevel!, pickupWindowStart: iso(start), pickupWindowEnd: iso(start + 2 * HOUR), requestType: 'recurring', recurringId: r.id, items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 4, weightKg: 1.2 }], submit: true });
    r.nextRunAt = iso(ctx.now + DAY);
    return sh;
  },
});

// ---------------- العمل دون اتصال (RTE-003 / NFR-009 / API-REL-03) ----------------
export interface OfflineAction { clientActionId: string; type: 'scanPack' | 'pickup' | 'handover' | 'deliver' | 'failAttempt'; shipment: string; occurredAt: string; payload: Record<string, unknown> }
defineCommand<{ actions: OfflineAction[] }, { results: { clientActionId: string; status: 'accepted' | 'duplicate' | 'conflict'; message: { ar: string; en: string } }[] }>({
  name: 'courier.sync', guard: ['courier'], desc: L('مزامنة إجراءات دون اتصال مع تقرير تعارض', 'Sync offline actions with conflict report'),
  run(ctx, { actions }) {
    const c = courierOf(ctx.actor, ctx.db); if (!c) ctx.fail('FORBIDDEN', 'ليس مندوباً', 'Not a courier', 403);
    const seen = new Set(ctx.db.audit.filter((a) => a.action === 'offline.action').map((a) => a.entityId));
    const map: Record<OfflineAction['type'], string> = { scanPack: 'courier.scanPack', pickup: 'courier.pickup', handover: 'custody.handover', deliver: 'courier.deliver', failAttempt: 'courier.failAttempt' };
    const results = [];
    for (const a of [...actions].sort((x, y) => x.occurredAt.localeCompare(y.occurredAt))) {
      if (seen.has(a.clientActionId)) { results.push({ clientActionId: a.clientActionId, status: 'duplicate' as const, message: L('تمت معالجته مسبقاً — لا أثر مكرر', 'Already processed — no duplicate effect') }); continue; }
      const snapshot = JSON.stringify(ctx.db.shipments.find((s) => s.id === a.shipment || s.trackingNo === a.shipment));
      try {
        ctx.exec(map[a.type], { ...a.payload, shipment: a.shipment, occurredAt: a.occurredAt, offline: true });
        ctx.audit('offline.action', 'offline', a.clientActionId, `${a.type} ${a.shipment} (وقت الجهاز ${a.occurredAt})`);
        seen.add(a.clientActionId);
        results.push({ clientActionId: a.clientActionId, status: 'accepted' as const, message: L('تمت المزامنة', 'Synced') });
      } catch (e: any) {
        void snapshot;
        const msg = e?.detail ?? L(String(e?.message ?? e), String(e?.message ?? e));
        const sh = ctx.db.shipments.find((s) => s.id === a.shipment || s.trackingNo === a.shipment);
        ctx.db.offlineConflicts.push({ id: ctx.id('ofc'), clientActionId: a.clientActionId, courierId: c!.id, shipmentId: sh?.id ?? a.shipment, action: a.type, reason: msg.ar, occurredAt: a.occurredAt, receivedAt: ctx.nowIso, resolution: 'pending' });
        ctx.audit('offline.conflict', 'offline', a.clientActionId, `تعارض: ${msg.ar}`);
        results.push({ clientActionId: a.clientActionId, status: 'conflict' as const, message: msg });
      }
    }
    return { results };
  },
});
defineCommand<{ id: string; resolution: 'accepted' | 'rejected'; note: string }, T.OfflineConflict>({
  name: 'offline.resolve', guard: ['ops_controller'], desc: L('حسم تعارض مزامنة', 'Resolve sync conflict'),
  run(ctx, { id, resolution, note }) { const c = must(ctx, ctx.db.offlineConflicts.find((x) => x.id === id), 'conflict'); c.resolution = resolution; ctx.audit('offline.resolve', 'offline', id, `${resolution}: ${note}`); return c; },
});

// ---------------- النقل متعدد الوسائط (RTE-004 / MMT) ----------------
defineCommand<{ legId: string; partnerId: string; flightNo?: string }, T.TransportLeg>({
  name: 'leg.assignPartner', guard: ['ops_controller'], desc: L('إسناد شريك لرجل نقل مع فحص الأهلية', 'Assign partner to leg with eligibility'),
  run(ctx, { legId, partnerId, flightNo }) {
    const leg = must(ctx, ctx.db.legs.find((l) => l.id === legId), 'leg'); const p = must(ctx, ctx.db.partners.find((x) => x.id === partnerId), 'partner');
    const e = partnerEligibility(ctx.db, p, ctx.now);
    if (e.length) ctx.fail('ELIGIBILITY_BLOCKED', e.map((x) => ELIGIBILITY_TEXT[x].ar).join('، '), e.map((x) => ELIGIBILITY_TEXT[x].en).join(', '), 422, 'partnerId');
    if (leg.mode === 'air' && p.partnerType !== 'air') ctx.fail('VALIDATION', 'الرجل الجوية تتطلب ناقلاً جوياً', 'Air leg requires an air carrier', 422, 'partnerId');
    leg.partnerId = p.id; if (flightNo) leg.flightNo = flightNo;
    ctx.audit('leg.assign_partner', 'leg', leg.id, `${p.name.ar}${flightNo ? ' — ' + flightNo : ''}`); return leg;
  },
});
defineCommand<{ legId: string; eventType: T.CarrierEvent['eventType']; occurredAt?: string }, T.CarrierEvent>({
  name: 'carrier.event', guard: ['partner', 'ops_controller'], desc: L('حدث ناقل (محاكاة واجهة الناقل)', 'Carrier event (simulated carrier API)'),
  run(ctx, { legId, eventType, occurredAt }) {
    const leg = must(ctx, ctx.db.legs.find((l) => l.id === legId), 'leg');
    if (!leg.partnerId) ctx.fail('NO_PARTNER', 'لا يوجد ناقل مسند لهذه الرجل', 'No carrier assigned', 422);
    const myPartner = ctx.actor.memberships.find((m) => m.role === 'partner')?.partnerId;
    if (myPartner && myPartner !== leg.partnerId) ctx.fail('NOT_FOUND', 'الرجل غير موجودة', 'Leg not found', 404);
    const extId = `${leg.partnerId}-${legId}-${eventType}`;
    const dup = ctx.db.carrierEvents.find((e) => e.partnerId === leg.partnerId && e.externalEventId === extId);
    if (dup) return dup; // DB-AT-004: نفس الحدث مرتين = أثر واحد
    const ev: T.CarrierEvent = { id: ctx.id('cev'), partnerId: leg.partnerId!, legId, externalEventId: extId, eventType, occurredAt: occurredAt ?? ctx.nowIso, receivedAt: ctx.nowIso, simulated: true };
    ctx.db.carrierEvents.push(ev);
    if (eventType === 'departed') { leg.actualDeparture = ev.occurredAt; leg.status = 'departed'; ctx.emit('transport.leg_departed', 'leg', leg.id, null); }
    if (eventType === 'arrived') { leg.actualArrival = ev.occurredAt; leg.status = 'arrived'; ctx.emit('transport.leg_arrived', 'leg', leg.id, null); }
    // E6: وصول الطائرة لا يعني التسليم للمستلم — يحدّث ETA فقط
    for (const x of ctx.db.shipmentLegs.filter((y) => y.legId === leg.id)) {
      const sh = ctx.db.shipments.find((s) => s.id === x.shipmentId)!;
      if (eventType === 'departed') sh.eta = { at: null, confidence: 'unavailable', basis: 'الشحنة على متن الرحلة؛ لا يُفترض موقع حي' };
      if (eventType === 'arrived') sh.eta = { at: iso(ctx.now + 90 * MIN), confidence: 'medium', basis: 'وصول الرحلة + زمن الاستلام من مكتب الشحن والتوصيل البري' };
      ctx.emit('carrier.event_recorded', 'shipment', sh.id, sh.organizationId, { eventType });
      ctx.db.statusEvents.push({ id: ctx.id('sev'), shipmentId: sh.id, fromStatus: sh.status, toStatus: sh.status, reason: `حدث الناقل: ${eventType}`, occurredAt: ev.occurredAt, actorId: ctx.actor.user.id, source: 'carrier_api' });
    }
    ctx.audit('carrier.event', 'leg', leg.id, `${eventType} (محاكاة)`);
    return ev;
  },
});

// ---------------- المسارات (RTE-002) ----------------
defineCommand<{ routeId: string; order: string[] }, T.Route>({
  name: 'route.reorder', guard: ['ops_controller'], desc: L('إعادة ترتيب التوقفات', 'Reorder stops'),
  run(ctx, { routeId, order }) {
    const r = must(ctx, ctx.db.routes.find((x) => x.id === routeId), 'route');
    const stops = ctx.db.routeStops.filter((s) => s.routeId === routeId);
    if (order.length !== stops.length || !stops.every((s) => order.includes(s.id))) ctx.fail('VALIDATION', 'الترتيب لا يطابق التوقفات', 'Order does not match stops', 422);
    if (r.status === 'completed') ctx.fail('ROUTE_LOCKED', 'المسار مكتمل ولا يمكن تعديل ترتيبه', 'Route is completed and cannot be reordered', 422);
    const seq = order.map((sid) => stops.find((s) => s.id === sid)!);
    const current = [...stops].sort((a, b) => a.seq - b.seq);
    if (seq.some((s, i) => s.status === 'done' && current[i].id !== s.id)) ctx.fail('STOP_LOCKED', 'التوقفات المنجزة ثابتة في موضعها', 'Completed stops are locked in place', 422);
    seq.forEach((s, i) => { if (s.stopType === 'delivery') for (const sh of s.shipmentIds) { const pi = seq.findIndex((x) => x.stopType === 'pickup' && x.shipmentIds.includes(sh)); if (pi > i) ctx.fail('PICKUP_AFTER_DELIVERY', 'لا يمكن وضع التسليم قبل الاستلام لنفس الشحنة', 'A delivery cannot come before its pickup', 422); } });
    order.forEach((sid, i) => (stops.find((s) => s.id === sid)!.seq = i + 1));
    ctx.audit('route.reorder', 'route', r.id, `إعادة ترتيب ${r.code}`); return r;
  },
});
defineCommand<{ routeId: string }, T.Route>({
  name: 'route.dispatch', guard: ['ops_controller'], desc: L('إرسال المسار بعد فحص الامتثال', 'Dispatch route after compliance check'),
  run(ctx, { routeId }) {
    const r = must(ctx, ctx.db.routes.find((x) => x.id === routeId), 'route');
    if (r.status !== 'planned') ctx.fail('ROUTE_NOT_PLANNED', 'المسار ليس في حالة التخطيط', 'Route is not planned', 422);
    const c = ctx.db.couriers.find((x) => x.id === r.courierId);
    const e = c ? courierEligibility(ctx.db, c, ctx.now) : ['COURIER_UNAVAILABLE'];
    if (e.length) ctx.fail('ELIGIBILITY_BLOCKED', e.map((x) => ELIGIBILITY_TEXT[x].ar).join('، '), e.map((x) => ELIGIBILITY_TEXT[x].en).join(', '), 422);
    r.status = 'dispatched'; ctx.audit('route.dispatch', 'route', r.id, r.code); ctx.emit('route.dispatched', 'route', r.id, null); return r;
  },
});

// المساعد العام لقراءة الشحنة لنطاق المستخدم (مستخدم أيضاً في الاستعلامات)
export { readable as readableShipment, ACTIVE, branchGrants, has };
