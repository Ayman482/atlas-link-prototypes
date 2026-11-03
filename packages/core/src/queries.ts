// الاستعلامات المقيّدة بالنطاق — كل قراءة تمر عبر صلاحيات الدور والمؤسسة والفرع (UAT-001/002/014)
import type * as T from './types';
import { DomainError } from './types';
import { defineQuery } from './engine';
import { FINANCE_COLLECTIONS, branchGrants, canReadShipment, canSeeInternalFinance, courierOf, courierShipmentIds, customerOrgIds, has, isStaff, shipmentView, type Actor } from './access';
import { ACTIVE, TRANSITIONS, boxReadiness, courierEligibility, currentCustodian, deviceOfBox, partnerEligibility } from './domain';
import { label, configLabel } from '../../i18n/src/terms';
import { DAY, HOUR, MIN, iso } from './util';

const nf = () => new DomainError('NOT_FOUND', 404, { ar: 'غير موجود', en: 'Not found' });
const forbid = () => new DomainError('FORBIDDEN', 403, { ar: 'ليست لديك صلاحية', en: 'Forbidden' });
const partnerOf = (a: Actor) => a.memberships.find((m) => m.role === 'partner')?.partnerId ?? null;

/** تصفية عامة لكل مجموعة حسب نطاق المستخدم */
export function scoped(db: T.Db, a: Actor, col: T.Collection): unknown[] {
  const all = db[col] as unknown[];
  if (isStaff(a)) {
    if (FINANCE_COLLECTIONS.has(col) && !canSeeInternalFinance(a) && !has(a, 'super_admin')) return col === 'ratePlans' ? all : [];
    if (col === 'audit' && !has(a, 'super_admin', 'compliance', 'executive')) return (all as T.AuditEvent[]).filter((x) => x.actorId === a.user.id);
    // الجلسات: كل موظف يرى جلساته فقط؛ مدير المنصة ومسؤول الامتثال يرون الكل (معرّفات الجلسات حساسة)
    if (col === 'sessions' && !has(a, 'super_admin', 'compliance')) return (all as T.Session[]).filter((x) => x.userId === a.user.id);
    return all;
  }
  const orgs = new Set(customerOrgIds(a));
  const shipIds = new Set(db.shipments.filter((s) => canReadShipment(db, a, s)).map((s) => s.id));
  const finRole = a.roles.some((r) => ['corp_admin', 'corp_finance', 'individual'].includes(r));
  const corpAdmin = (orgId: string | null) => !!orgId && a.memberships.some((m) => m.role === 'corp_admin' && m.organizationId === orgId);
  const partner = partnerOf(a);
  const cou = courierOf(a, db);
  switch (col) {
    case 'shipments': return db.shipments.filter((s) => shipIds.has(s.id)).map((s) => shipmentView(db, a, s));
    case 'shipmentItems': case 'statusEvents': case 'pods': case 'deliveryAttempts': case 'returns': case 'dispositions':
      return (all as { shipmentId: string }[]).filter((x) => shipIds.has(x.shipmentId));
    case 'custody': return db.custody.filter((x) => shipIds.has(x.shipmentId));
    case 'excursions': return db.excursions.filter((x) => shipIds.has(x.shipmentId)).map((e) => ({ ...e, deviceId: undefined }));
    case 'organizations': return db.organizations.filter((o) => orgs.has(o.id) || db.shipments.some((s) => shipIds.has(s.id) && s.receiverOrgId === o.id)).map((o) => (orgs.has(o.id) ? o : { id: o.id, legalName: o.legalName, cityCode: o.cityCode, customerType: o.customerType }));
    case 'branches': return db.branches.filter((b) => orgs.has(b.organizationId) && (branchGrants(a, b.organizationId).all || branchGrants(a, b.organizationId).read.has(b.id)));
    case 'addresses': return db.addresses.filter((x) => (x.organizationId && orgs.has(x.organizationId)) || db.shipments.some((s) => shipIds.has(s.id) && (s.receiverAddressId === x.id || s.senderAddressId === x.id)));
    case 'cities': case 'serviceProfiles': case 'integrations': return all;
    case 'quotes': return db.quotes.filter((q) => orgs.has(q.organizationId));
    case 'contracts': return finRole || a.roles.includes('branch_manager') ? db.contracts.filter((c) => orgs.has(c.organizationId)).map((c) => ({ ...c, ratePlanId: undefined })) : [];
    case 'invoices': return finRole ? db.invoices.filter((i) => orgs.has(i.organizationId) && i.status !== 'draft' && i.status !== 'void') : [];
    case 'invoiceLines': { const ids = new Set(db.invoices.filter((i) => orgs.has(i.organizationId) && !['draft', 'void'].includes(i.status)).map((i) => i.id)); return finRole ? db.invoiceLines.filter((l) => ids.has(l.invoiceId)) : []; }
    case 'creditNotes': { const ids = new Set(db.invoices.filter((i) => orgs.has(i.organizationId)).map((i) => i.id)); return finRole ? db.creditNotes.filter((c) => ids.has(c.invoiceId) && c.status === 'approved') : []; }
    case 'payments': return finRole ? db.payments.filter((p) => p.direction === 'in' && orgs.has(p.counterpartyId)).map((p) => ({ ...p, journalId: undefined })) : [];
    case 'paymentAllocations': { const ids = new Set(db.payments.filter((p) => orgs.has(p.counterpartyId)).map((p) => p.id)); return db.paymentAllocations.filter((x) => ids.has(x.paymentId)); }
    case 'claims': return db.claims.filter((c) => orgs.has(c.organizationId)).map((c) => ({ ...c, liability: c.status === 'approved' || c.status === 'rejected' || c.status === 'closed' ? c.liability : null }));
    case 'notifications': return db.notifications.filter((n) => n.userId === a.user.id || (n.audience === 'customer' && !n.userId && n.organizationId && orgs.has(n.organizationId)) || (cou && n.audience === 'courier' && n.userId === a.user.id));
    case 'notificationPrefs': case 'sessions': return (all as { userId: string }[]).filter((x) => x.userId === a.user.id);
    case 'memberships': return db.memberships.filter((m) => m.userId === a.user.id || corpAdmin(m.organizationId));
    case 'users': { const ids = new Set(db.memberships.filter((m) => corpAdmin(m.organizationId)).map((m) => m.userId)); ids.add(a.user.id); return db.users.filter((u) => ids.has(u.id)); }
    case 'webhooks': case 'apiClients': return (all as { organizationId: string | null }[]).filter((x) => corpAdmin(x.organizationId));
    case 'recurrings': return db.recurrings.filter((r) => orgs.has(r.organizationId));
    case 'legs': return partner ? db.legs.filter((l) => l.partnerId === partner) : cou ? db.legs.filter((l) => l.courierId === cou.id) : [];
    case 'settlements': return partner ? db.settlements.filter((s) => s.partnerId === partner) : [];
    case 'carrierEvents': return partner ? db.carrierEvents.filter((e) => e.partnerId === partner) : [];
    case 'scorecards': return partner ? db.scorecards.filter((s) => s.partnerId === partner) : [];
    case 'partners': return partner ? db.partners.filter((p) => p.id === partner) : cou ? db.partners.filter((p) => p.partnerType !== 'warehouse').map((p) => ({ id: p.id, name: p.name, partnerType: p.partnerType, status: p.status })) : [];
    case 'couriers': return cou ? db.couriers.filter((c) => c.id === cou.id || c.cityCode === cou.cityCode).map((c) => ({ id: c.id, name: c.name, cityCode: c.cityCode, status: c.status, employmentType: c.employmentType })) : [];
    case 'warehouses': return cou ? db.warehouses : [];
    case 'boxes': return cou ? db.boxes.map((b) => ({ id: b.id, code: b.code, size: b.size, thermalClass: b.thermalClass, status: b.status })) : [];
    case 'templates': return [];
    default: return [];
  }
}

const getPath = (o: any, p: string) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const textOf = (o: any): string => JSON.stringify(o).toLowerCase();

defineQuery<{ collection: T.Collection; filter?: Record<string, unknown>; q?: string; sort?: string; dir?: 'asc' | 'desc'; page?: number; pageSize?: number }, { items: unknown[]; total: number; page: number; pageSize: number }>({
  name: 'list', guard: 'any',
  run(db, a, p) {
    // Object.hasOwn: لا تُقبل أسماء موروثة مثل constructor أو __proto__ (كانت تعيد 500)
    if (typeof p.collection !== 'string' || !Object.hasOwn(db, p.collection) || p.collection === ('meta' as never) || !Array.isArray(db[p.collection])) throw nf();
    let items = scoped(db, a, p.collection);
    for (const [k, v] of Object.entries(p.filter ?? {})) {
      if (v === undefined || v === '' || v === null) continue;
      items = items.filter((x) => (Array.isArray(v) ? v.includes(getPath(x, k)) : getPath(x, k) === v));
    }
    if (p.q?.trim()) { const q = p.q.trim().toLowerCase(); items = items.filter((x) => textOf(x).includes(q)); }
    const sort = p.sort ?? 'createdAt'; const dir = p.dir ?? 'desc';
    items = [...items].sort((x, y) => { const A = getPath(x, sort), B = getPath(y, sort); if (A === B) return 0; if (A == null) return 1; if (B == null) return -1; return (A > B ? 1 : -1) * (dir === 'asc' ? 1 : -1); });
    const pageSize = Math.min(500, Math.max(1, p.pageSize ?? 25)); const page = Math.max(1, p.page ?? 1);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
  },
});

defineQuery<{ id: string; collection: T.Collection }, unknown>({
  name: 'get', guard: 'any',
  run(db, a, { id, collection }) { if (typeof collection !== 'string' || !Object.hasOwn(db, collection) || !Array.isArray(db[collection])) throw nf(); const x = (scoped(db, a, collection) as { id?: string }[]).find((r) => r.id === id); if (!x) throw nf(); return x; },
});

defineQuery<Record<string, never>, unknown>({
  name: 'me', guard: 'any',
  run(db, a) {
    const cou = courierOf(a, db);
    const orgs = customerOrgIds(a).map((id) => db.organizations.find((o) => o.id === id)).filter(Boolean);
    return { user: a.user, roles: a.roles, memberships: a.memberships.map((m) => ({ ...m, branch: db.branches.find((b) => b.id === m.branchId) ?? null, organization: db.organizations.find((o) => o.id === m.organizationId) ?? null, partner: db.partners.find((p) => p.id === m.partnerId) ?? null })), staff: isStaff(a), courier: cou, organizations: orgs, partnerId: partnerOf(a), unread: (scoped(db, a, 'notifications') as T.Notification[]).filter((n) => !n.readAt && (isStaff(a) ? n.audience === 'staff' && (!n.userId || n.userId === a.user.id) : true)).length };
  },
});

/** الخط الزمني الموحّد بمصادره (MMT-001..018) */
function timeline(db: T.Db, a: Actor, s: T.Shipment) {
  const ev: { at: string; receivedAt?: string; kind: string; source: string; title: T.L; detail?: string; live?: boolean; codes?: Record<string, string | number> }[] = [];
  const S: Record<string, T.L> = { draft: { ar: 'مسودة', en: 'Draft' }, confirmed: { ar: 'مؤكدة', en: 'Confirmed' }, pickup_scheduled: { ar: 'الاستلام مجدول', en: 'Pickup scheduled' }, collected: { ar: 'تم الاستلام', en: 'Collected' }, in_transit: { ar: 'في الطريق', en: 'In transit' }, at_handover: { ar: 'عند نقطة التسليم', en: 'At handover' }, delivered: { ar: 'تم التسليم', en: 'Delivered' }, failed: { ar: 'تعذّر التسليم', en: 'Delivery failed' }, return_pending: { ar: 'بانتظار الإرجاع', en: 'Return pending' }, returned: { ar: 'تم الإرجاع', en: 'Returned' }, cancelled: { ar: 'ملغاة', en: 'Cancelled' }, exception: { ar: 'استثناء', en: 'Exception' } };
  for (const e of db.statusEvents.filter((x) => x.shipmentId === s.id)) ev.push({ at: e.occurredAt, kind: 'status', source: e.source, title: e.fromStatus === e.toStatus ? { ar: e.reason, en: e.reason } : S[e.toStatus], detail: e.fromStatus === e.toStatus ? undefined : e.reason , codes: { status: e.toStatus } });
  for (const c of db.custody.filter((x) => x.shipmentId === s.id)) ev.push({ at: c.occurredAt, receivedAt: c.receivedAt, kind: 'custody', source: c.source, title: { ar: `نقل حيازة: ${label('ar', c.fromType, 'custodian')} ← ${label('ar', c.toType, 'custodian')}`, en: `Custody: ${label('en', c.fromType, 'custodian')} → ${label('en', c.toType, 'custodian')}` }, detail: `${c.evidence.signedBy} (${c.evidence.method})` , codes: { fromType: c.fromType, toType: c.toType, method: c.evidence.method } });
  const legIds = db.shipmentLegs.filter((x) => x.shipmentId === s.id).map((x) => x.legId);
  for (const c of db.carrierEvents.filter((x) => legIds.includes(x.legId))) ev.push({ at: c.occurredAt, receivedAt: c.receivedAt, kind: 'carrier', source: 'carrier_api (محاكاة)', title: { ar: `الناقل: ${label('ar', c.eventType)}`, en: `Carrier: ${label('en', c.eventType)}` }, detail: db.legs.find((l) => l.id === c.legId)?.flightNo ?? '' , codes: { eventType: c.eventType } });
  for (const e of db.excursions.filter((x) => x.shipmentId === s.id)) ev.push({ at: e.startedAt, kind: 'excursion', source: 'cold_chain', title: { ar: `انحراف حراري (ذروة ${e.peakC} °م)`, en: `Excursion (peak ${e.peakC} °C)` }, detail: e.status , codes: { status: e.status, peakC: e.peakC } });
  for (const p of db.pods.filter((x) => x.shipmentId === s.id)) ev.push({ at: p.deliveredAt, kind: 'pod', source: 'courier_app', title: { ar: 'إثبات التسليم', en: 'Proof of delivery' }, detail: p.recipientName });
  for (const d of db.deliveryAttempts.filter((x) => x.shipmentId === s.id)) ev.push({ at: d.attemptedAt, kind: 'attempt', source: 'courier_app', title: { ar: 'محاولة تسليم فاشلة', en: 'Failed attempt' }, detail: d.reasonCode , codes: { reasonCode: d.reasonCode } });
  if (isStaff(a)) { const pk = db.packings.find((p) => p.shipmentId === s.id); if (pk) for (const h of db.deviceHealth.filter((h) => h.deviceId === deviceOfBox(db, pk.boxId)?.id && h.observedAt >= pk.packedAt && (!pk.unpackedAt || h.observedAt <= pk.unpackedAt))) ev.push({ at: h.observedAt, kind: 'device', source: 'gpt45m', title: { ar: `الجهاز: ${label('ar', h.eventType)}`, en: `Device: ${label('en', h.eventType)}` } , codes: { eventType: h.eventType } }); }
  return ev.sort((x, y) => x.at.localeCompare(y.at));
}

/** اسم الحائز الحالي للعرض (لا يُعرض معرّف داخلي مثل cou_01 للعميل) */
function custodianName(db: T.Db, c: { type: string; id: string } | null): T.L | null {
  if (!c) return null;
  if (c.type === 'courier') return db.couriers.find((x) => x.id === c.id)?.name ?? null;
  if (c.type === 'partner' || c.type === 'air_carrier') return db.partners.find((x) => x.id === c.id)?.name ?? null;
  if (c.type === 'warehouse') return db.warehouses.find((x) => x.id === c.id)?.name ?? null;
  if (c.type === 'customer') { const o = db.organizations.find((x) => x.id === c.id); return o ? o.legalName : null; }
  return null;
}

/** التتبع: آخر موقع مؤكد وحداثة البيانات — لا موقع حي مختلق (API §4.2) */
function tracking(db: T.Db, s: T.Shipment, now: number) {
  const pk = db.packings.find((p) => p.shipmentId === s.id && !p.unpackedAt) ?? db.packings.filter((p) => p.shipmentId === s.id).pop();
  const dev = pk ? deviceOfBox(db, pk.boxId) : null;
  const reads = pk ? db.readings.filter((r) => r.boxId === pk.boxId && r.deviceTime >= pk.packedAt && (!pk.unpackedAt || r.deviceTime <= pk.unpackedAt)) : [];
  const last = reads.reduce<T.Reading | null>((m, r) => (!m || r.deviceTime > m.deviceTime ? r : m), null);
  const inAir = db.shipmentLegs.some((x) => x.shipmentId === s.id && db.legs.some((l) => l.id === x.legId && l.mode === 'air' && l.status === 'departed'));
  const ageMin = last ? (now - Date.parse(last.receivedAt)) / MIN : null;
  const freshness: 'live' | 'delayed' | 'stale' | 'none' = ageMin === null ? 'none' : ageMin <= 15 ? 'live' : ageMin <= 60 ? 'delayed' : 'stale';
  return {
    operationalStatus: inAir ? 'in_air_transit' : s.status,
    lastConfirmedPosition: s.lastPosition ? { ...s.lastPosition, isLive: freshness === 'live' && !inAir } : null,
    lastReading: last ? { tempC: last.tempC, deviceTime: last.deviceTime, receivedAt: last.receivedAt, backfilled: last.backfilled, demo: true } : null,
    freshness, ageMin: ageMin === null ? null : Math.round(ageMin),
    deviceConnectivity: inAir ? 'offline_expected_or_unknown' : !dev ? 'no_device' : freshness === 'live' ? 'online' : 'offline_or_delayed',
    temperatureVisibility: inAir || freshness !== 'live' ? 'last_known_only' : 'current',
    eta: s.eta, inAir,
  };
}

defineQuery<{ id: string }, unknown>({
  name: 'shipment.detail', guard: 'any',
  run(db, a, { id }, now) {
    const s = db.shipments.find((x) => x.id === id || x.trackingNo === id || (isStaff(a) && x.qrToken === id));
    if (!s || !canReadShipment(db, a, s)) throw nf();
    const staff = isStaff(a);
    const packs = db.packings.filter((p) => p.shipmentId === s.id);
    const box = packs.length ? db.boxes.find((b) => b.id === packs[packs.length - 1].boxId) : null;
    // BR-003: العميل يرى رمز الصندوق فقط، لا الشحنات الأخرى المشتركة فيه
    const coPacked = staff && box ? db.packings.filter((p) => p.boxId === box.id && !p.unpackedAt && p.shipmentId !== s.id).map((p) => { const o = db.shipments.find((x) => x.id === p.shipmentId)!; return { shipmentId: o.id, trackingNo: o.trackingNo, organization: db.organizations.find((g) => g.id === o.organizationId)?.legalName }; }) : undefined;
    const legs = db.shipmentLegs.filter((x) => x.shipmentId === s.id).sort((x, y) => x.seq - y.seq).map((x) => { const l = db.legs.find((g) => g.id === x.legId)!; return { ...l, partner: db.partners.find((p) => p.id === l.partnerId)?.name ?? null, courier: db.couriers.find((c) => c.id === l.courierId)?.name ?? null }; });
    const quote = db.quotes.find((q) => q.id === s.quoteId);
    const allowed = staff ? TRANSITIONS[s.status] : [];
    return {
      shipment: shipmentView(db, a, s),
      organization: db.organizations.find((o) => o.id === s.organizationId)?.legalName, branch: db.branches.find((b) => b.id === s.branchId)?.name ?? null,
      sender: db.addresses.find((x) => x.id === s.senderAddressId), receiver: db.addresses.find((x) => x.id === s.receiverAddressId), receiverOrg: db.organizations.find((o) => o.id === s.receiverOrgId)?.legalName ?? null,
      items: db.shipmentItems.filter((x) => x.shipmentId === s.id), profile: db.serviceProfiles.find((p) => p.id === s.serviceProfileId),
      box: box ? (staff ? { ...box, device: deviceOfBox(db, box.id), coPacked } : { code: box.code, size: box.size, thermalClass: box.thermalClass }) : null,
      packings: staff ? packs : packs.map((p) => ({ packedAt: p.packedAt, unpackedAt: p.unpackedAt })),
      legs, timeline: timeline(db, a, s), tracking: tracking(db, s, now), custodian: currentCustodian(db, s.id), custodianName: custodianName(db, currentCustodian(db, s.id)),
      pod: db.pods.find((p) => p.shipmentId === s.id) ?? null, attempts: db.deliveryAttempts.filter((x) => x.shipmentId === s.id), returns: db.returns.filter((x) => x.shipmentId === s.id),
      excursions: db.excursions.filter((x) => x.shipmentId === s.id), incidents: staff ? db.incidents.filter((x) => x.shipmentId === s.id) : [], claims: db.claims.filter((x) => x.shipmentId === s.id && (staff || customerOrgIds(a).includes(x.organizationId))),
      disposition: db.dispositions.find((d) => d.shipmentId === s.id) ?? null, legalHold: staff ? db.legalHolds.find((h) => h.subjectId === s.id && !h.releasedAt) ?? null : null,
      quote: quote && (staff || customerOrgIds(a).includes(s.organizationId)) ? quote.snapshot : null,
      costs: canSeeInternalFinance(a) ? db.costAllocations.filter((c) => c.shipmentId === s.id) : undefined,
      lostApprovals: staff ? db.approvals.filter((x) => x.subjectType === 'lost_declaration' && x.subjectId === s.id) : undefined,
      delayAlerts: staff ? db.delayAlerts.filter((d) => d.shipmentId === s.id) : [],
      allowedTransitions: allowed,
    };
  },
});

/** تقرير الأدلة الحرارية بفجوات صريحة (TEMP-005 / UAT-005) */
defineQuery<{ id: string }, unknown>({
  name: 'shipment.temperatureReport', guard: 'any',
  run(db, a, { id }, now) {
    const s = db.shipments.find((x) => x.id === id || x.trackingNo === id);
    if (!s || !canReadShipment(db, a, s)) throw nf();
    const prof = db.serviceProfiles.find((p) => p.id === s.serviceProfileId)!;
    const packs = db.packings.filter((p) => p.shipmentId === s.id);
    const reads = packs.flatMap((pk) => db.readings.filter((r) => r.boxId === pk.boxId && r.deviceTime >= pk.packedAt && r.deviceTime <= (pk.unpackedAt ?? iso(now))))
      .sort((x, y) => x.deviceTime.localeCompare(y.deviceTime));
    const gaps: { from: string; to: string; minutes: number; reason: T.L }[] = [];
    const air = db.shipmentLegs.filter((x) => x.shipmentId === s.id).map((x) => db.legs.find((l) => l.id === x.legId)!).find((l) => l.mode === 'air');
    for (let i = 1; i < reads.length; i++) {
      const d = (Date.parse(reads[i].deviceTime) - Date.parse(reads[i - 1].deviceTime)) / MIN;
      if (d > 15) { const inAir = air && reads[i - 1].deviceTime <= (air.actualArrival ?? air.scheduledArrival) && reads[i].deviceTime >= (air.actualDeparture ?? air.scheduledDeparture); gaps.push({ from: reads[i - 1].deviceTime, to: reads[i].deviceTime, minutes: Math.round(d), reason: inAir ? { ar: 'رحلة جوية — لا بيانات (لم يُتحقق من دعم الجهاز لتخزين القراءات)', en: 'Air leg — no data (buffering not verified)' } : { ar: 'لا بيانات من الجهاز', en: 'No device data' } }); }
    }
    const open = packs.find((p) => !p.unpackedAt);
    if (open && reads.length && now - Date.parse(reads[reads.length - 1].deviceTime) > 15 * MIN) gaps.push({ from: reads[reads.length - 1].deviceTime, to: iso(now), minutes: Math.round((now - Date.parse(reads[reads.length - 1].deviceTime)) / MIN), reason: { ar: 'مستمرة حتى الآن — آخر قراءة معروفة فقط', en: 'Ongoing — last known reading only' } });
    const valid = reads.filter((r) => r.tempC !== null);
    const inRange = valid.filter((r) => r.tempC! >= prof.minC && r.tempC! <= prof.maxC).length;
    return {
      trackingNo: s.trackingNo, profile: { name: prof.name, minC: prof.minC, maxC: prof.maxC, version: prof.version, approvedForProduction: false },
      readings: reads.map((r) => ({ t: r.deviceTime, receivedAt: r.receivedAt, c: r.tempC, backfilled: r.backfilled, ...(isStaff(a) ? { lat: r.lat, lng: r.lng } : {}) })),
      gaps, excursions: db.excursions.filter((e) => e.shipmentId === s.id).map((e) => ({ startedAt: e.startedAt, endedAt: e.endedAt, peakC: e.peakC, severity: e.severity, status: e.status })),
      summary: { count: reads.length, inRangePct: valid.length ? Math.round((inRange / valid.length) * 1000) / 10 : null, minC: valid.length ? Math.min(...valid.map((r) => r.tempC!)) : null, maxC: valid.length ? Math.max(...valid.map((r) => r.tempC!)) : null, gapMinutes: gaps.reduce((x, g) => x + g.minutes, 0), backfilled: reads.filter((r) => r.backfilled).length },
      disclaimer: { ar: 'بيانات عرض تجريبية — ليست قراءات أجهزة حقيقية. فجوات البيانات لا تعني الالتزام بالنطاق الحراري. القرار السريري للجهة المستلمة فقط.', en: 'Demo data — not real device readings. Gaps do not imply compliance. Clinical decisions belong to the receiving institution only.' },
      disposition: db.dispositions.find((d) => d.shipmentId === s.id) ?? null,
    };
  },
});

/** مركز مراقبة العمليات (OPS-001..004) */
defineQuery<{ city?: string; thermalClass?: string; customerId?: string; severity?: string }, unknown>({
  name: 'controlTower.summary', guard: 'staff',
  run(db, a, f, now) {
    let ships = db.shipments.filter((s) => [...ACTIVE, 'pickup_scheduled', 'confirmed'].includes(s.status));
    if (f.city) ships = ships.filter((s) => s.originCity === f.city || s.destCity === f.city);
    if (f.thermalClass) ships = ships.filter((s) => s.thermalClass === f.thermalClass);
    if (f.customerId) ships = ships.filter((s) => s.organizationId === f.customerId);
    const ids = new Set(ships.map((s) => s.id));
    const alerts: { id: string; kind: string; status?: string; severity: 'critical' | 'high' | 'medium' | 'low'; title: T.L; at: string; link: string; shipmentId?: string }[] = [];
    db.excursions.filter((e) => e.status !== 'closed' && (ids.has(e.shipmentId) || !f.city)).forEach((e) => { const s = db.shipments.find((x) => x.id === e.shipmentId)!; const ES: Record<string, [string, string]> = { open: ['مفتوح', 'open'], acknowledged: ['تم الإقرار', 'acknowledged'], under_review: ['قيد المراجعة', 'under review'] }; alerts.push({ id: e.id, kind: 'excursion', status: e.status, severity: e.severity === 'critical' ? 'critical' : e.severity === 'major' ? 'high' : 'medium', title: { ar: `انحراف حراري ${s.trackingNo} — ${e.peakC} °م (${ES[e.status]?.[0] ?? e.status})`, en: `Excursion ${s.trackingNo} — ${e.peakC} °C (${ES[e.status]?.[1] ?? e.status})` }, at: e.startedAt, link: `/shipments/${s.id}`, shipmentId: s.id }); });
    db.delayAlerts.filter((d) => !d.resolvedAt && ids.has(d.shipmentId)).forEach((d) => { const s = db.shipments.find((x) => x.id === d.shipmentId)!; alerts.push({ id: d.id, kind: 'delay', severity: d.risk === 'high' ? 'high' : 'medium', title: { ar: `${s.trackingNo}: ${d.reason.ar}`, en: `${s.trackingNo}: ${d.reason.en}` }, at: d.raisedAt, link: `/shipments/${s.id}`, shipmentId: s.id }); });
    db.shipments.filter((s) => s.status === 'failed' && ids.has(s.id)).forEach((s) => alerts.push({ id: `fail_${s.id}`, kind: 'failed', severity: 'high', title: { ar: `تعذّر تسليم ${s.trackingNo} — بانتظار قرار`, en: `Failed delivery ${s.trackingNo} — decision needed` }, at: s.updatedAt, link: `/returns`, shipmentId: s.id }));
    db.shipments.filter((s) => s.lostState === 'suspected').forEach((s) => alerts.push({ id: `lost_${s.id}`, kind: 'lost', severity: 'critical', title: { ar: `اشتباه فقدان ${s.trackingNo}`, en: `Suspected loss ${s.trackingNo}` }, at: s.updatedAt, link: `/shipments/${s.id}`, shipmentId: s.id }));
    db.devices.filter((d) => ['offline', 'low_battery', 'faulty'].includes(d.state)).forEach((d) => alerts.push({ id: `dev_${d.id}`, kind: 'device', severity: d.state === 'faulty' ? 'medium' : 'low', title: { ar: `جهاز ${d.imei.slice(-6)}: ${({ offline: 'غير متصل', low_battery: 'بطارية منخفضة', faulty: 'معطل' } as Record<string, string>)[d.state]}`, en: `Device ${d.imei.slice(-6)}: ${d.state.replace('_', ' ')}` }, at: d.lastSeenAt ?? iso(now), link: `/devices/${d.id}` }));
    db.blocks.filter((b) => !b.resolvedAt).forEach((b) => alerts.push({ id: b.id, kind: 'compliance', severity: 'medium', title: { ar: `قيد تشغيلي على ${({ partner: 'شريك', vehicle: 'مركبة', courier: 'مندوب', route: 'مسار', box: 'صندوق', device: 'جهاز' } as Record<string, string>)[b.scopeType]}: ${b.reason}`, en: `${b.scopeType} blocked: ${b.reason}` }, at: b.activeFrom, link: '/compliance/blocks' }));
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
    const filtered = (f.severity ? alerts.filter((x) => x.severity === f.severity) : alerts).sort((x, y) => sevRank[x.severity] - sevRank[y.severity] || y.at.localeCompare(x.at));
    const map = ships.filter((s) => s.lastPosition || ['pickup_scheduled', 'confirmed'].includes(s.status)).map((s) => {
      const tr = tracking(db, s, now);
      const src = s.lastPosition ?? (() => { const ad = db.addresses.find((x) => x.id === s.senderAddressId)!; return { lat: ad.lat, lng: ad.lng, at: s.pickupWindowStart, source: 'manual' as const }; })();
      // OPS-004: تمييز بصري بين الحي والمتأخر واليدوي والمستنتج
      const dataKind = tr.inAir ? 'inferred' : !s.lastPosition ? 'planned' : tr.freshness === 'live' ? 'live' : tr.freshness === 'delayed' ? 'delayed' : 'stale';
      return { id: s.id, trackingNo: s.trackingNo, status: s.status, thermalClass: s.thermalClass, lat: src.lat, lng: src.lng, at: src.at, dataKind, source: src.source, origin: s.originCity, dest: s.destCity, hasAlert: filtered.some((x) => x.shipmentId === s.id) };
    });
    const boxes = db.boxes.filter((b) => b.status !== 'retired');
    const kpis = {
      active: ships.filter((s) => ACTIVE.includes(s.status)).length,
      awaitingPickup: ships.filter((s) => ['confirmed', 'pickup_scheduled'].includes(s.status)).length,
      overduePickups: ships.filter((s) => s.status === 'pickup_scheduled' && Date.parse(s.pickupWindowEnd) < now).length,
      overdueDeliveries: ships.filter((s) => ACTIVE.includes(s.status) && Date.parse(s.deliverBy) < now).length,
      exceptions: ships.filter((s) => ['exception', 'failed'].includes(s.status)).length,
      openExcursions: db.excursions.filter((e) => e.status !== 'closed').length,
      deliveredToday: db.shipments.filter((s) => s.status === 'delivered' && now - Date.parse(s.updatedAt) < DAY).length,
      boxesReady: boxes.filter((b) => b.status === 'available' && boxReadiness(db, b, now).ready).length,
      boxesNotReady: boxes.filter((b) => b.status === 'available' && !boxReadiness(db, b, now).ready).length,
      boxesInUse: boxes.filter((b) => ['in_use', 'assigned'].includes(b.status)).length,
      couriersAvailable: db.couriers.filter((c) => c.status === 'available' && !courierEligibility(db, c, now).length).length,
      couriersOnRoute: db.couriers.filter((c) => c.status === 'on_route').length,
    };
    return { kpis, alerts: filtered, map, cities: db.cities.filter((c) => c.active), couriers: db.couriers.map((c) => ({ id: c.id, name: c.name, status: c.status, cityCode: c.cityCode, lastPosition: c.lastPosition, eligibility: courierEligibility(db, c, now) })), generatedAt: iso(now) };
  },
});

/** لوحة التوزيع: الطلبات غير المسندة + المندوبون والصناديق مع الأهلية (A07) */
defineQuery<{ city?: string }, unknown>({
  name: 'dispatch.board', guard: ['ops_controller', 'customer_service', 'executive'],
  run(db, a, { city }, now) {
    const S = (s: T.Shipment) => ({ ...s, organization: db.organizations.find((o) => o.id === s.organizationId)?.legalName, sender: db.addresses.find((x) => x.id === s.senderAddressId)?.label, receiver: db.addresses.find((x) => x.id === s.receiverAddressId)?.label, plannedBoxId: s.subStatus?.startsWith('box:') ? s.subStatus.slice(4) : null, courierId: db.routes.find((r) => db.routeStops.some((st) => st.routeId === r.id && st.shipmentIds.includes(s.id) && st.stopType === 'pickup'))?.courierId ?? null });
    const inCity = (s: T.Shipment) => !city || s.originCity === city;
    return {
      unassigned: db.shipments.filter((s) => s.status === 'confirmed' && inCity(s)).sort((x, y) => x.pickupWindowStart.localeCompare(y.pickupWindowStart)).map(S),
      scheduled: db.shipments.filter((s) => s.status === 'pickup_scheduled' && inCity(s)).sort((x, y) => x.pickupWindowStart.localeCompare(y.pickupWindowStart)).map(S),
      couriers: db.couriers.filter((c) => !city || c.cityCode === city).map((c) => ({ ...c, partner: db.partners.find((p) => p.id === c.partnerId)?.name ?? null, blockers: courierEligibility(db, c, now), load: db.routeStops.filter((st) => st.status === 'pending' && db.routes.find((r) => r.id === st.routeId)?.courierId === c.id).length })),
      boxes: db.boxes.filter((b) => b.status !== 'retired' && (!city || b.locationCity === city)).map((b) => ({ ...b, readiness: boxReadiness(db, b, now), device: deviceOfBox(db, b.id), occupancy: db.packings.filter((p) => p.boxId === b.id && !p.unpackedAt).length })),
      partners: db.partners.map((p) => ({ ...p, blockers: partnerEligibility(db, p, now) })),
      exceptionApprovals: db.approvalRequests.filter((x) => x.kind === 'device_exception'),
    };
  },
});

defineQuery<{ id: string }, unknown>({
  name: 'box.detail', guard: 'staff',
  run(db, a, { id }, now) {
    const b = db.boxes.find((x) => x.id === id || x.code === id); if (!b) throw nf();
    return { box: b, readiness: boxReadiness(db, b, now), pairings: db.pairings.filter((p) => p.boxId === b.id).map((p) => ({ ...p, device: db.devices.find((d) => d.id === p.deviceId) })), device: deviceOfBox(db, b.id),
      packings: db.packings.filter((p) => p.boxId === b.id).sort((x, y) => y.packedAt.localeCompare(x.packedAt)).map((p) => { const s = db.shipments.find((x) => x.id === p.shipmentId)!; return { ...p, trackingNo: s.trackingNo, organization: db.organizations.find((o) => o.id === s.organizationId)?.legalName, status: s.status }; }),
      qualifications: db.boxQualifications.filter((q) => q.boxId === b.id), movements: db.boxMovements.filter((m) => m.boxId === b.id).sort((x, y) => y.eventAt.localeCompare(x.eventAt)), partnerCustody: db.partnerCustody.filter((c) => c.boxId === b.id),
      readings: db.readings.filter((r) => r.boxId === b.id).slice(-144) };
  },
});
defineQuery<{ id: string }, unknown>({
  name: 'device.detail', guard: 'staff',
  run(db, a, { id }) {
    const d = db.devices.find((x) => x.id === id || x.imei === id); if (!d) throw nf();
    return { device: d, pairings: db.pairings.filter((p) => p.deviceId === d.id).map((p) => ({ ...p, box: db.boxes.find((b) => b.id === p.boxId)?.code })), readings: db.readings.filter((r) => r.deviceId === d.id).sort((x, y) => x.deviceTime.localeCompare(y.deviceTime)).slice(-288), health: db.deviceHealth.filter((h) => h.deviceId === d.id), commands: db.deviceCommands.filter((c) => c.deviceId === d.id), messages: db.gatewayMessages.filter((m) => m.deviceId === d.id).slice(-50), simulated: true };
  },
});
defineQuery<Record<string, never>, unknown>({
  name: 'gateway.console', guard: ['iot_engineer', 'super_admin'],
  run(db, a, _p, now) {
    const recent = db.gatewayMessages.filter((m) => now - Date.parse(m.receivedAt) < HOUR);
    const byStatus = (s: T.GatewayMessage['parseStatus']) => db.gatewayMessages.filter((m) => m.parseStatus === s && !m.replayed).length;
    return { metrics: { activeSessions: db.devices.filter((d) => d.lastSeenAt && now - Date.parse(d.lastSeenAt) < 15 * MIN).length, packetsLastHour: recent.length, parseFailures: byStatus('dead_letter'), quarantined: byStatus('quarantined'), duplicates: byStatus('duplicate'), offlineDevices: db.devices.filter((d) => d.state === 'offline' || (d.lastSeenAt && now - Date.parse(d.lastSeenAt) > 60 * MIN && d.state !== 'retired')).length, queueLagSec: 2, telemetryAgeP95Sec: 41 },
      messages: [...db.gatewayMessages].sort((x, y) => y.receivedAt.localeCompare(x.receivedAt)).slice(0, 200), simulated: true, note: { ar: 'لوحة محاكاة — البروتوكول الفعلي لـ GPT45-M غير متحقق (VAL-01..09)', en: 'Simulated console — actual GPT45-M protocol not verified (VAL-01..09)' } };
  },
});

defineQuery<{ days?: number; city?: string }, unknown>({
  name: 'reports.operations', guard: ['ops_controller', 'executive', 'quality', 'super_admin'],
  run(db, a, { days = 14, city }, now) {
    const from = now - days * DAY;
    const ships = db.shipments.filter((s) => Date.parse(s.createdAt) >= from && (!city || s.originCity === city || s.destCity === city));
    const delivered = ships.filter((s) => s.status === 'delivered');
    const onTime = delivered.filter((s) => (db.pods.find((p) => p.shipmentId === s.id)?.deliveredAt ?? s.updatedAt) <= s.deliverBy).length;
    const byDay: Record<string, { created: number; delivered: number }> = {};
    for (let i = days - 1; i >= 0; i--) byDay[iso(now - i * DAY).slice(0, 10)] = { created: 0, delivered: 0 };
    ships.forEach((s) => { const k = s.createdAt.slice(0, 10); if (byDay[k]) byDay[k].created++; if (s.status === 'delivered') { const d = s.updatedAt.slice(0, 10); if (byDay[d]) byDay[d].delivered++; } });
    const withReads = delivered.filter((s) => db.excursions.every((e) => e.shipmentId !== s.id || e.status === 'closed' && e.severity === 'minor'));
    const byRoute: Record<string, { shipments: number; onTime: number; delivered: number }> = {};
    ships.forEach((s) => { const k = `${s.originCity}→${s.destCity}`; byRoute[k] ??= { shipments: 0, onTime: 0, delivered: 0 }; byRoute[k].shipments++; if (s.status === 'delivered') { byRoute[k].delivered++; if (s.updatedAt <= s.deliverBy) byRoute[k].onTime++; } });
    const busyHours = db.packings.filter((p) => Date.parse(p.packedAt) >= from).reduce((x, p) => x + ((p.unpackedAt ? Date.parse(p.unpackedAt) : now) - Date.parse(p.packedAt)) / HOUR, 0);
    return { days, totals: { created: ships.length, delivered: delivered.length, onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 1000) / 10 : null, tempCompliancePct: delivered.length ? Math.round((withReads.length / delivered.length) * 1000) / 10 : null, incidents: db.incidents.filter((i) => Date.parse(i.openedAt) >= from).length, boxUtilizationPct: Math.round((busyHours / (db.boxes.filter((b) => b.status !== 'retired').length * days * 24)) * 1000) / 10, cancelled: ships.filter((s) => s.status === 'cancelled').length },
      byDay: Object.entries(byDay).map(([date, v]) => ({ date, ...v })), byRoute: Object.entries(byRoute).map(([route, v]) => ({ route, ...v, onTimePct: v.delivered ? Math.round((v.onTime / v.delivered) * 100) : null })).sort((x, y) => y.shipments - x.shipments),
      byThermal: (['chilled', 'frozen', 'ambient'] as const).map((t) => ({ thermalClass: t, count: ships.filter((s) => s.thermalClass === t).length })),
      byStatus: Object.entries(ships.reduce<Record<string, number>>((m, s) => ((m[s.status] = (m[s.status] ?? 0) + 1), m), {})).map(([status, count]) => ({ status, count })) };
  },
});

defineQuery<{ days?: number }, unknown>({
  name: 'reports.finance', guard: ['finance', 'finance_approver', 'executive', 'super_admin'],
  run(db, a, { days = 90 }, now) {
    const from = now - days * DAY;
    const lines = db.invoiceLines.filter((l) => { const inv = db.invoices.find((i) => i.id === l.invoiceId); return inv && !['draft', 'void'].includes(inv.status) && Date.parse(inv.issueDate ?? inv.createdAt) >= from; });
    const revenue = lines.reduce((x, l) => x + l.unitPrice * l.qty, 0);
    const cost = db.costRecords.filter((c) => Date.parse(c.incurredAt) >= from).reduce((x, c) => x + (c.actual ?? c.estimated), 0);
    const byCustomer: Record<string, { revenue: number; cost: number }> = {};
    lines.forEach((l) => { const inv = db.invoices.find((i) => i.id === l.invoiceId)!; byCustomer[inv.organizationId] ??= { revenue: 0, cost: 0 }; byCustomer[inv.organizationId].revenue += l.unitPrice * l.qty; });
    db.costAllocations.forEach((c) => { const s = db.shipments.find((x) => x.id === c.shipmentId); if (s && byCustomer[s.organizationId]) byCustomer[s.organizationId].cost += c.amount; });
    const byCity: Record<string, { revenue: number; cost: number }> = {};
    lines.filter((l) => l.shipmentId).forEach((l) => { const s = db.shipments.find((x) => x.id === l.shipmentId)!; byCity[s.originCity] ??= { revenue: 0, cost: 0 }; byCity[s.originCity].revenue += l.unitPrice; byCity[s.originCity].cost += db.costAllocations.filter((c) => c.shipmentId === s.id).reduce((x, c) => x + c.amount, 0); });
    const aging = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
    db.invoices.filter((i) => ['issued', 'partially_paid', 'overdue'].includes(i.status)).forEach((i) => { const out = i.total - i.paid - db.creditNotes.filter((c) => c.invoiceId === i.id && c.status === 'approved').reduce((x, c) => x + c.amount, 0); const late = (now - Date.parse(i.dueDate ?? i.createdAt)) / DAY; if (late <= 0) aging.current += out; else if (late <= 30) aging.d30 += out; else if (late <= 60) aging.d60 += out; else if (late <= 90) aging.d90 += out; else aging.d90plus += out; });
    const ap = db.partners.map((p) => ({ partnerId: p.id, name: p.name, payable: db.settlements.filter((s) => s.partnerId === p.id && s.status === 'approved').reduce((x, s) => x + (s.approved ?? 0), 0), unsettledDraft: db.settlements.filter((s) => s.partnerId === p.id && ['draft', 'reconciled', 'disputed'].includes(s.status)).reduce((x, s) => x + s.calculated, 0) }));
    return { days, revenue, cost, contribution: revenue - cost, marginPct: revenue ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null,
      byCustomer: Object.entries(byCustomer).map(([id, v]) => ({ organizationId: id, name: db.organizations.find((o) => o.id === id)?.legalName, ...v, margin: v.revenue - v.cost })).sort((x, y) => y.revenue - x.revenue),
      byCity: Object.entries(byCity).map(([city, v]) => ({ city, ...v, margin: v.revenue - v.cost })), aging, ap };
  },
});

defineQuery<Record<string, never>, unknown>({
  name: 'ledger.trialBalance', guard: ['finance', 'finance_approver', 'executive', 'super_admin'],
  run(db) {
    const rows = db.glAccounts.map((acct) => { let d = 0, c = 0; db.journals.filter((j) => j.status === 'posted').forEach((j) => j.lines.filter((l) => l.accountId === acct.id).forEach((l) => { d += l.debit; c += l.credit; })); return { ...acct, debit: d, credit: c, balance: ['asset', 'expense'].includes(acct.type) ? d - c : c - d }; });
    const td = rows.reduce((x, r) => x + r.debit, 0), tc = rows.reduce((x, r) => x + r.credit, 0);
    const unbalanced = db.journals.filter((j) => j.status === 'posted' && j.lines.reduce((x, l) => x + l.debit - l.credit, 0) !== 0).map((j) => j.journalNo);
    const arControl = rows.find((r) => r.code === '1200')!.balance;
    const arSub = db.invoices.filter((i) => !['draft', 'void'].includes(i.status)).reduce((x, i) => x + i.total, 0) - db.payments.filter((p) => p.direction === 'in' && p.journalId).reduce((x, p) => x + p.amount, 0) - db.creditNotes.filter((c) => c.status === 'approved').reduce((x, c) => x + c.amount, 0);
    return { rows, totalDebit: td, totalCredit: tc, balanced: td === tc && unbalanced.length === 0, unbalancedJournals: unbalanced, arControl, arSubledger: arSub, arReconciled: arControl === arSub };
  },
});

/** مهام المندوب لليوم (K02) — من المسارات ومراحل النقل المسندة له */
defineQuery<Record<string, never>, unknown>({
  name: 'courier.tasks', guard: ['courier', 'ops_controller'],
  run(db, a, _p, now) {
    const c = courierOf(a, db); if (!c) throw forbid();
    const ids = courierShipmentIds(db, c.id);
    const tasks = db.shipments.filter((s) => ids.has(s.id)).map((s) => {
      const cur = currentCustodian(db, s.id); const mine = cur?.type === 'courier' && cur.id === c.id;
      const stop = db.routeStops.filter((st) => st.shipmentIds.includes(s.id) && db.routes.find((r) => r.id === st.routeId)?.courierId === c.id).sort((x, y) => x.seq - y.seq);
      const pending = stop.find((st) => st.status === 'pending');
      const kind = ['pickup_scheduled'].includes(s.status) ? 'pickup' : mine && ['collected', 'in_transit', 'at_handover', 'exception'].includes(s.status) ? (s.originCity !== s.destCity && !db.custody.some((x) => x.shipmentId === s.id && x.toType === 'air_carrier') && s.mode === 'road_air' && db.custody.filter((x) => x.shipmentId === s.id).length === 1 ? 'handover' : 'delivery') : s.status === 'return_pending' && mine ? 'return' : 'done';
      const box = db.packings.find((p) => p.shipmentId === s.id && !p.unpackedAt);
      const plannedBox = s.subStatus?.startsWith('box:') ? db.boxes.find((b) => b.id === s.subStatus!.slice(4)) : null;
      return { shipmentId: s.id, trackingNo: s.trackingNo, qrToken: s.qrToken, status: s.status, kind, mine, thermalClass: s.thermalClass, serviceLevel: s.serviceLevel, pickupWindowStart: s.pickupWindowStart, pickupWindowEnd: s.pickupWindowEnd, deliverBy: s.deliverBy, sender: db.addresses.find((x) => x.id === s.senderAddressId), receiver: db.addresses.find((x) => x.id === s.receiverAddressId), organization: db.organizations.find((o) => o.id === s.organizationId)?.legalName, items: db.shipmentItems.filter((i) => i.shipmentId === s.id), box: box ? db.boxes.find((b) => b.id === box.boxId)?.code : null, plannedBox: plannedBox?.code ?? null, seq: pending?.seq ?? stop[0]?.seq ?? 99, mode: s.mode, lastReading: tracking(db, s, now).lastReading };
    }).sort((x, y) => (x.kind === 'done' ? 1 : 0) - (y.kind === 'done' ? 1 : 0) || x.seq - y.seq || x.pickupWindowStart.localeCompare(y.pickupWindowStart));
    return { courier: c, vehicle: db.vehicles.find((v) => v.id === c.vehicleId) ?? null, tasks, boxesInCustody: db.boxes.filter((b) => b.custodianType === 'courier' && b.custodianId === c.id && ['in_use', 'assigned'].includes(b.status)).map((b) => ({ ...b, device: deviceOfBox(db, b.id) })), conflicts: db.offlineConflicts.filter((x) => x.courierId === c.id), partners: db.partners.filter((p) => p.status === 'active' && p.partnerType !== 'warehouse').map((p) => ({ id: p.id, name: p.name, partnerType: p.partnerType })), warehouses: db.warehouses, colleagues: db.couriers.filter((x) => x.id !== c.id && x.qualified).map((x) => ({ id: x.id, name: x.name, cityCode: x.cityCode })) };
  },
});

/** لوحة العميل — بلا أي تكلفة داخلية أو هامش (BI-003 / UAT-014) */
defineQuery<{ branchId?: string; days?: number }, unknown>({
  name: 'customer.dashboard', guard: 'any',
  run(db, a, { branchId, days = 30 }, now) {
    if (isStaff(a)) throw forbid();
    let ships = (scoped(db, a, 'shipments') as T.Shipment[]).filter((s) => now - Date.parse(s.createdAt) < days * DAY);
    if (branchId) ships = ships.filter((s) => s.branchId === branchId);
    const own = new Set(customerOrgIds(a));
    ships = ships.filter((s) => own.has(s.organizationId));
    const delivered = ships.filter((s) => s.status === 'delivered');
    const onTime = delivered.filter((s) => s.updatedAt <= s.deliverBy).length;
    const exc = db.excursions.filter((e) => ships.some((s) => s.id === e.shipmentId));
    const contracts = (scoped(db, a, 'contracts') as T.Contract[]).filter((c) => c.status === 'active');
    const invoices = scoped(db, a, 'invoices') as T.Invoice[];
    const byBranch = (scoped(db, a, 'branches') as T.Branch[]).map((b) => { const bs = ships.filter((s) => s.branchId === b.id); const bd = bs.filter((s) => s.status === 'delivered'); return { branchId: b.id, name: b.name, shipments: bs.length, onTimePct: bd.length ? Math.round((bd.filter((s) => s.updatedAt <= s.deliverBy).length / bd.length) * 100) : null }; });
    return { days, totals: { shipments: ships.length, active: ships.filter((s) => ACTIVE.includes(s.status) || s.status === 'pickup_scheduled').length, delivered: delivered.length, onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 1000) / 10 : null, excursions: exc.length, tempCompliancePct: delivered.length ? Math.round(((delivered.length - new Set(exc.map((e) => e.shipmentId)).size) / delivered.length) * 1000) / 10 : null },
      contracts: contracts.map((c) => ({ contractNo: c.contractNo, includedShipments: c.includedShipments, usedShipments: c.usedShipments, validTo: c.validTo, billingCycle: c.billingCycle })),
      openInvoices: invoices.filter((i) => ['issued', 'partially_paid', 'overdue'].includes(i.status)).map((i) => ({ id: i.id, invoiceNo: i.invoiceNo, total: i.total, paid: i.paid, dueDate: i.dueDate, status: i.status })),
      byBranch, recent: ships.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)).slice(0, 8) };
  },
});

defineQuery<Record<string, never>, unknown>({
  name: 'approvals.inbox', guard: 'staff',
  run(db, a) {
    const canDecide = (x: T.ApprovalRequest) => x.status === 'pending' && x.requestedBy !== a.user.id && (x.kind === 'lost_declaration' ? has(a, 'quality', 'ops_controller') && !db.approvals.some((p) => p.subjectType === 'lost_declaration' && p.subjectId === x.subjectId && p.approverId === a.user.id) : has(a, x.requiredRole));
    return { pending: db.approvalRequests.filter(canDecide), mine: db.approvalRequests.filter((x) => x.requestedBy === a.user.id), history: db.approvalRequests.filter((x) => x.status !== 'pending').slice(-50).reverse(), all: has(a, 'super_admin', 'executive') ? db.approvalRequests : undefined };
  },
});

defineQuery<{ q: string }, unknown>({
  name: 'search', guard: 'any',
  run(db, a, { q }) {
    const s = (q ?? '').trim().toLowerCase(); if (s.length < 2) return { shipments: [], boxes: [], devices: [], organizations: [] };
    const ships = (scoped(db, a, 'shipments') as T.Shipment[]).filter((x) => x.trackingNo.toLowerCase().includes(s) || x.id === s).slice(0, 8);
    if (!isStaff(a)) return { shipments: ships, boxes: [], devices: [], organizations: [] };
    return { shipments: ships, boxes: db.boxes.filter((b) => b.code.toLowerCase().includes(s)).slice(0, 6), devices: db.devices.filter((d) => d.imei.includes(s)).slice(0, 6), organizations: db.organizations.filter((o) => (o.legalName.ar + o.legalName.en + o.code).toLowerCase().includes(s)).slice(0, 6) };
  },
});

defineQuery<Record<string, never>, unknown>({
  name: 'system.health', guard: ['super_admin', 'iot_engineer', 'executive'],
  run(db, a, _p, now) {
    const last = db.backups.filter((b) => b.kind === 'snapshot' && b.status === 'success').sort((x, y) => y.at.localeCompare(x.at))[0];
    const drill = db.backups.filter((b) => b.kind === 'restore_drill').sort((x, y) => y.at.localeCompare(x.at))[0];
    return { simulated: true, api: { p50ms: 84, p95ms: 312, p99ms: 690, errorRatePct: 0.4, rps: 23 }, queue: { waiting: 3, active: 2, failed: 1, deadLetter: db.gatewayMessages.filter((m) => m.parseStatus === 'dead_letter' && !m.replayed).length, outboxLagSec: 1 },
      database: { cpuPct: 31, connections: 42, slowQueries: 2, storageGb: 18.4 }, coldChain: { openExcursions: db.excursions.filter((e) => e.status !== 'closed').length, overdueAcks: db.excursions.filter((e) => e.status === 'open' && now - Date.parse(e.startedAt) > 30 * MIN).length },
      finance: { unbalancedAttempts: db.audit.filter((x) => x.action === 'journal.rejected').length, duplicatePostingAttempts: 0 }, security: { privilegedChanges24h: db.audit.filter((x) => now - Date.parse(x.occurredAt) < DAY && /user\.|membership\.|config\./.test(x.action)).length, activeSessions: db.sessions.filter((s) => !s.revokedAt).length },
      backup: { lastSnapshotAt: last?.at ?? null, lastSnapshotAgeH: last ? Math.round((now - Date.parse(last.at)) / HOUR) : null, lastDrill: drill ?? null, targets: { opsRpoMin: 15, opsRtoMin: 120, financeRpoMin: 15, financeRtoMin: 240 } }, backups: db.backups.sort((x, y) => y.at.localeCompare(x.at)) };
  },
});

defineQuery<Record<string, never>, unknown>({
  name: 'partner.portal', guard: ['partner'],
  run(db, a) {
    const pid = partnerOf(a); if (!pid) throw forbid();
    const legs = db.legs.filter((l) => l.partnerId === pid).sort((x, y) => y.scheduledDeparture.localeCompare(x.scheduledDeparture));
    return { partner: db.partners.find((p) => p.id === pid), legs: legs.map((l) => ({ ...l, shipments: db.shipmentLegs.filter((x) => x.legId === l.id).map((x) => db.shipments.find((s) => s.id === x.shipmentId)!.trackingNo), events: db.carrierEvents.filter((e) => e.legId === l.id) })), settlements: db.settlements.filter((s) => s.partnerId === pid), scorecards: db.scorecards.filter((s) => s.partnerId === pid), licenses: db.licenses.filter((l) => l.holderId === pid), blocks: db.blocks.filter((b) => b.scopeId === pid) };
  },
});

defineQuery<Record<string, never>, unknown>({
  name: 'meta.commands', guard: 'any',
  run() { return {}; },
});
