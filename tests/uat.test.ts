// اختبارات القبول على مستوى المحرك — مربوطة بكتالوج UAT في SRS §11 و DB-AT في ERD §I
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, type Db, type Shipment } from '../packages/core/src/index';

const NOW = Date.parse('2026-11-02T10:00:00Z');
let clock = NOW;
const fresh = () => { clock = NOW; return new Engine(null, { clock: () => clock }); };
const U = { admin: 'usr_admin', ops: 'usr_ops', ops2: 'usr_ops2', wh: 'usr_warehouse', q: 'usr_quality', fin: 'usr_finance', apr: 'usr_approver', cmp: 'usr_compliance', iot: 'usr_iot', corp: 'usr_corp_admin', bop: 'usr_branch_op', cfin: 'usr_corp_finance', ind: 'usr_individual', lab: 'usr_lab', c1: 'usr_courier1', c2: 'usr_courier2', partner: 'usr_partner' };
const code = (fn: () => unknown) => { try { fn(); return 'OK'; } catch (e: any) { return e.code ?? String(e); } };
const byStatus = (db: Db, st: string) => db.shipments.filter((s) => s.status === st);
const H = 3600_000;

test('UAT-001 عزل الفروع: لا قراءة ولا كتابة خارج المنح', () => {
  const e = fresh();
  const mlq = e.db.shipments.find((s) => s.branchId === 'br_nkh_mlq')!;
  const oly = e.db.shipments.find((s) => s.branchId === 'br_nkh_oly')!;
  assert.equal(code(() => e.query('shipment.detail', U.bop, { id: mlq.id })), 'NOT_FOUND');
  assert.equal(code(() => e.query('shipment.detail', U.bop, { id: oly.id })), 'OK');
  const list = e.query<any>('list', U.bop, { collection: 'shipments', pageSize: 500 });
  assert.ok(list.items.every((s: Shipment) => ['br_nkh_oly', 'br_nkh_rwd'].includes(s.branchId!)));
  // مشاهد فقط في فرع جدة: لا إنشاء
  const rwdAddr = e.db.addresses.find((a) => a.branchId === 'br_nkh_rwd')!;
  const dest = e.db.addresses.find((a) => a.branchId === 'br_nrl_main')!;
  const input = { organizationId: 'org_nkh', branchId: 'br_nkh_rwd', senderAddressId: rwdAddr.id, receiverAddressId: dest.id, thermalClass: 'chilled', serviceLevel: 'standard', weightKg: 1, pickupWindowStart: new Date(NOW + 2 * H).toISOString(), pickupWindowEnd: new Date(NOW + 4 * H).toISOString(), items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 2, weightKg: 1 }] };
  assert.equal(code(() => e.exec('shipment.create', U.bop, input)), 'FORBIDDEN');
  // عميل آخر لا يرى شيئاً من النخبة
  assert.equal(code(() => e.query('shipment.detail', U.ind, { id: oly.id })), 'NOT_FOUND');
});

test('UAT-002 الصندوق المشترك: كل عميل يرى شحنته فقط، والعمليات ترى المجمّع', () => {
  const e = fresh();
  const inBox = e.db.packings.filter((p) => p.boxId === 'box_002' && !p.unpackedAt).map((p) => e.db.shipments.find((s) => s.id === p.shipmentId)!);
  assert.equal(new Set(inBox.map((s) => s.organizationId)).size, 2);
  const nkh = inBox.find((s) => s.organizationId === 'org_nkh')!, dqa = inBox.find((s) => s.organizationId === 'org_dqa')!;
  const cust = e.query<any>('shipment.detail', U.corp, { id: nkh.id });
  assert.equal(cust.box.code, 'BX-CM-002');
  assert.equal(cust.box.coPacked, undefined);
  assert.equal(code(() => e.query('shipment.detail', U.corp, { id: dqa.id })), 'NOT_FOUND');
  const ops = e.query<any>('shipment.detail', U.ops, { id: nkh.id });
  assert.ok(ops.box.coPacked.some((x: any) => x.shipmentId === dqa.id));
  const rep = e.query<any>('shipment.temperatureReport', U.corp, { id: nkh.id });
  assert.ok(rep.readings.length > 0 && rep.readings.every((r: any) => r.lat === undefined));
});

function newOlyShipment(e: Engine, extra: Record<string, unknown> = {}) {
  const from = e.db.addresses.find((a) => a.branchId === 'br_nkh_oly')!;
  const to = e.db.addresses.find((a) => a.branchId === 'br_nrl_main')!;
  return e.exec<Shipment>('shipment.create', U.bop, { organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: from.id, receiverAddressId: to.id, receiverOrgId: 'org_nrl', thermalClass: 'chilled', serviceLevel: 'express', pickupWindowStart: new Date(NOW + 1 * H).toISOString(), pickupWindowEnd: new Date(NOW + 3 * H).toISOString(), items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 3, weightKg: 1.4 }], ...extra });
}
const readyChilled = (e: Engine) => e.query<any>('dispatch.board', U.ops, {}).boxes.find((b: any) => b.thermalClass === 'chilled' && b.readiness.ready && b.status === 'available');

test('UAT-003 + سير العمل الكامل: إنشاء ← إسناد ← مسح ← استلام ← تسليم مع إثبات', () => {
  const e = fresh();
  const sh = newOlyShipment(e);
  assert.equal(sh.status, 'confirmed');
  assert.ok(e.query<any>('dispatch.board', U.ops, {}).unassigned.some((s: Shipment) => s.id === sh.id), 'يظهر في لوحة التوزيع');
  const box = readyChilled(e);
  assert.ok(box, 'صندوق مبرّد جاهز');
  e.exec('dispatch.assign', U.ops, { shipmentId: sh.id, courierId: 'cou_01', boxId: box.id });
  const tasks = e.query<any>('courier.tasks', U.c1, {});
  assert.ok(tasks.tasks.some((t: any) => t.shipmentId === sh.id && t.kind === 'pickup' && t.plannedBox === box.code));
  assert.equal(code(() => e.exec('courier.pickup', U.c1, { shipment: sh.id, signedBy: 'x' })), 'NOT_PACKED');
  assert.equal(code(() => e.exec('courier.scanPack', U.c1, { shipment: sh.trackingNo, boxCode: 'BX-CS-010' })), 'WRONG_BOX');
  clock += 60_000; e.exec('courier.scanPack', U.c1, { shipment: sh.trackingNo, boxCode: box.code });
  clock += 60_000; e.exec('courier.pickup', U.c1, { shipment: sh.id, signedBy: 'م. سارة العتيبي' });
  clock += 60_000; e.exec('courier.startTransit', U.c1, { shipment: sh.id });
  // مندوب آخر لا يستطيع التسليم (ليس صاحب الحيازة)
  assert.equal(code(() => e.exec('courier.deliver', U.c2, { shipment: sh.id, recipientName: 'x', signature: 'y' })), 'NOT_FOUND');
  assert.equal(code(() => e.exec('courier.deliver', U.c1, { shipment: sh.id, recipientName: '', signature: 'y' })), 'VALIDATION');
  clock += 30 * 60_000; e.exec('courier.deliver', U.c1, { shipment: sh.id, recipientName: 'د. ليلى الحمدان', signature: 'sig-demo' });
  const d = e.query<any>('shipment.detail', U.corp, { id: sh.id });
  assert.equal(d.shipment.status, 'delivered');
  assert.ok(d.pod && d.pod.recipientName === 'د. ليلى الحمدان');
  const cus = e.db.custody.filter((c) => c.shipmentId === sh.id);
  assert.equal(cus.length, 2);
  assert.ok(cus.every((c) => c.actorId === U.c1 && c.occurredAt && c.evidence.signedBy));
  assert.equal(e.db.boxes.find((b) => b.id === box.id)!.status, 'returning');
  // المختبر المستلم يسجّل القرار السريري منفصلاً
  e.exec('disposition.record', U.lab, { shipment: sh.id, decision: 'accepted', authorizedContact: 'د. ليلى الحمدان' });
  assert.equal(e.query<any>('shipment.detail', U.corp, { id: sh.id }).disposition.decision, 'accepted');
  assert.equal(code(() => e.exec('disposition.record', U.q, { shipment: sh.id, decision: 'accepted', authorizedContact: 'x' })), 'VALIDATION');
});

test('UAT-004 انحراف حراري: حدث + تنبيه + تحقيق + دليل، دون حكم سريري', () => {
  const e = fresh();
  const sh = e.db.shipments.find((s) => s.status === 'in_transit' && s.thermalClass === 'chilled' && e.db.packings.some((p) => p.shipmentId === s.id && !p.unpackedAt && p.boxId !== 'box_004' && p.boxId !== 'box_002'))!;
  const box = e.db.packings.find((p) => p.shipmentId === sh.id && !p.unpackedAt)!.boxId;
  const dev = e.db.pairings.find((p) => p.boxId === box && !p.unpairedAt)!.deviceId;
  const before = e.db.excursions.length;
  e.exec('telemetry.injectDemo', U.iot, { device: dev, tempC: 11.4 });
  const ex = e.db.excursions[e.db.excursions.length - 1];
  assert.equal(e.db.excursions.length, before + 1);
  assert.equal(ex.shipmentId, sh.id);
  assert.ok(e.query<any>('controlTower.summary', U.ops, {}).alerts.some((a: any) => a.kind === 'excursion' && a.shipmentId === sh.id));
  assert.equal(code(() => e.exec('excursion.qualityReview', U.q, { id: ex.id, decision: 'x', openIncident: true })), 'NOT_ACKNOWLEDGED');
  e.exec('excursion.acknowledge', U.ops, { id: ex.id });
  assert.equal(code(() => e.exec('excursion.qualityReview', U.q, { id: ex.id, decision: 'العينة صالحة سريرياً', openIncident: false })), 'CLINICAL_DECISION_FORBIDDEN');
  e.exec('excursion.qualityReview', U.q, { id: ex.id, decision: 'انحراف رئيسي أثناء التوقف؛ فتح تحقيق', openIncident: true });
  assert.ok(e.db.incidents.some((i) => i.id === e.db.excursions.find((x) => x.id === ex.id)!.incidentId));
  const rep = e.query<any>('shipment.temperatureReport', U.corp, { id: sh.id });
  assert.ok(rep.excursions.length >= 1);
});

test('UAT-005 جهاز دون اتصال وبيانات متأخرة: لا التزام مُختلق، والتكرار بلا أثر', () => {
  const e = fresh();
  const off = e.db.shipments.find((s) => e.db.packings.some((p) => p.shipmentId === s.id && p.boxId === 'box_026' && !p.unpackedAt))!;
  const rep = e.query<any>('shipment.temperatureReport', U.ops, { id: off.id });
  assert.ok(rep.gaps.some((g: any) => /مستمرة/.test(g.reason.ar)), 'فجوة مستمرة صريحة');
  const tr = e.query<any>('shipment.detail', U.ops, { id: off.id }).tracking;
  assert.equal(tr.temperatureVisibility, 'last_known_only');
  const back = e.db.shipments.find((s) => e.db.packings.some((p) => p.shipmentId === s.id && p.boxId === 'box_018' && !p.unpackedAt))!;
  assert.ok(e.query<any>('shipment.temperatureReport', U.ops, { id: back.id }).summary.backfilled > 0);
  // قراءة متأخرة تُسند حسب وقت الحدث لا وقت الاستلام
  const dev = e.db.pairings.find((p) => p.boxId === 'box_026' && !p.unpairedAt)!.deviceId;
  const t = new Date(NOW - 30 * 60_000).toISOString();
  const r1 = e.exec<any>('telemetry.injectDemo', U.iot, { device: dev, tempC: 21.1, deviceTime: t });
  assert.equal(r1.reading.backfilled, true);
  const n = e.db.readings.length;
  const r2 = e.exec<any>('telemetry.injectDemo', U.iot, { device: dev, tempC: 21.1, deviceTime: t });
  assert.equal(r2.message.parseStatus, 'duplicate');
  assert.equal(e.db.readings.length, n, 'DB-AT-004: لا أثر مكرر');
  const bad = e.exec<any>('telemetry.injectDemo', U.iot, { device: dev, tempC: 500 });
  assert.equal(bad.reading, null); assert.equal(bad.message.parseStatus, 'dead_letter');
});

test('UAT-006 رجل جوية بلا GPS: آخر موقع مؤكد فقط، ووصول الطائرة لا يعني التسليم', () => {
  const e = fresh();
  const air = e.db.shipments.find((s) => s.mode === 'road_air' && s.status === 'in_transit' && e.db.shipmentLegs.some((x) => x.shipmentId === s.id && e.db.legs.find((l) => l.id === x.legId)!.mode === 'air' && e.db.legs.find((l) => l.id === x.legId)!.status === 'departed'))!;
  assert.ok(air, 'شحنة على متن رحلة');
  const tr = e.query<any>('shipment.detail', U.corp, { id: air.id }).tracking;
  assert.equal(tr.inAir, true); assert.equal(tr.lastConfirmedPosition.isLive, false); assert.equal(tr.eta.confidence, 'unavailable');
  const leg = e.db.legs.find((l) => l.mode === 'air' && e.db.shipmentLegs.some((x) => x.legId === l.id && x.shipmentId === air.id))!;
  e.exec('carrier.event', U.ops, { legId: leg.id, eventType: 'arrived' });
  e.exec('carrier.event', U.ops, { legId: leg.id, eventType: 'arrived' }); // مكرر
  assert.equal(e.db.carrierEvents.filter((c) => c.legId === leg.id && c.eventType === 'arrived').length, 1);
  assert.notEqual(e.db.shipments.find((s) => s.id === air.id)!.status, 'delivered');
});

test('UAT-007 صندوق غير جاهز: حظر الإسناد، والاستثناء المضبوط فقط', () => {
  const e = fresh();
  const sh = newOlyShipment(e);
  assert.equal(code(() => e.exec('dispatch.assign', U.ops, { shipmentId: sh.id, courierId: 'cou_01', boxId: 'box_010' })), 'BOX_NOT_READY');
  assert.equal(code(() => e.exec('dispatch.requestException', U.ops, { shipmentId: sh.id, boxId: 'box_013', reason: 'عاجل' })), 'BOX_NOT_READY'.replace('BOX_NOT_READY', 'EXCEPTION_NOT_PERMITTED'));
  assert.equal(code(() => e.exec('dispatch.assign', U.ops, { shipmentId: sh.id, courierId: 'cou_09', boxId: null })), 'ELIGIBILITY_BLOCKED');
  const req = e.exec<any>('dispatch.requestException', U.ops, { shipmentId: sh.id, boxId: 'box_010', reason: 'لا صناديق أخرى في الفرع؛ البطارية تكفي لساعتين' });
  assert.equal(code(() => e.exec('approval.decide', U.ops, { id: req.id, decision: 'approve' })), 'FORBIDDEN');
  e.exec('approval.decide', U.q, { id: req.id, decision: 'approve' });
  assert.equal(code(() => e.exec('dispatch.assign', U.ops, { shipmentId: sh.id, courierId: 'cou_01', boxId: 'box_010', exceptionApprovalId: req.id })), 'OK');
});

test('UAT-008 تسليم فاشل: قرار مخوّل، استمرارية الحيازة، وتحميل التكلفة للطرف الصحيح', () => {
  const e = fresh();
  const f = byStatus(e.db, 'failed')[0];
  assert.equal(code(() => e.exec('returns.authorize', U.bop, { shipment: f.id, decision: 'return_to_sender', responsibleParty: 'customer' })), 'FORBIDDEN');
  const r = e.exec<any>('returns.authorize', U.ops, { shipment: f.id, decision: 'return_to_sender', responsibleParty: 'customer' });
  assert.equal(e.db.shipments.find((s) => s.id === f.id)!.status, 'return_pending');
  assert.ok(e.db.invoiceLines.some((l) => l.invoiceId === 'pending' && l.shipmentId === f.id), 'رسم على العميل');
  e.exec('returns.complete', U.ops, { returnId: r.id, signedBy: 'مكتب الاستقبال' });
  assert.equal(e.db.shipments.find((s) => s.id === f.id)!.status, 'returned');
  assert.ok(e.db.custody.some((c) => c.shipmentId === f.id && c.eventType === 'return'));
});

test('UAT-009 فقدان واسترداد: اعتماد مشترك، والاسترداد لا يمحو الإعلان', () => {
  const e = fresh();
  const lost = e.db.shipments.find((s) => s.lostState === 'suspected')!;
  assert.equal(code(() => e.exec('lost.suspect', U.ops, { shipment: e.db.shipments.find((s) => s.status === 'in_transit')!.id, basis: ['gps_silence'], note: 'x' })), 'INSUFFICIENT_BASIS');
  e.exec('lost.approve', U.ops, { shipment: lost.id, decision: 'approve' });
  assert.equal(e.db.shipments.find((s) => s.id === lost.id)!.lostState, 'suspected', 'العمليات وحدها لا تكفي (DB-AT-010)');
  assert.equal(code(() => e.exec('lost.approve', U.ops2, { shipment: lost.id, decision: 'approve' })), 'ALREADY_APPROVED');
  e.exec('lost.approve', U.q, { shipment: lost.id, decision: 'approve' });
  assert.equal(e.db.shipments.find((s) => s.id === lost.id)!.lostState, 'declared');
  e.exec('lost.recover', U.ops, { shipment: lost.id, note: 'وُجدت في نقطة التسليم بالدمام', signedBy: 'أ. عمر' });
  const s = e.db.shipments.find((x) => x.id === lost.id)!;
  assert.equal(s.lostState, 'recovered');
  assert.ok(e.db.statusEvents.some((x) => x.shipmentId === lost.id && /إعلان فقدان نهائي/.test(x.reason)), 'الإعلان محفوظ');
});

test('UAT-010 تسوية الشريك: مسودة تلقائية، اعتماد إلزامي، منع الدفع المكرر', () => {
  const e = fresh();
  const st = e.db.settlements.find((s) => s.status === 'reconciled')!;
  assert.equal(code(() => e.exec('settlement.recordPayment', U.fin, { id: st.id, bankRef: 'X1' })), 'SETTLEMENT_NOT_APPROVED');
  const apr = e.db.approvalRequests.find((a) => a.kind === 'settlement' && a.subjectId === st.id)!;
  e.exec('approval.decide', U.apr, { id: apr.id, decision: 'approve' });
  assert.equal(e.db.settlements.find((s) => s.id === st.id)!.status, 'approved');
  assert.ok(!e.db.payments.some((p) => p.direction === 'out' && e.db.settlements.find((s) => s.id === st.id)!.paymentId === p.id), 'الاعتماد ليس دفعاً');
  e.exec('settlement.recordPayment', U.fin, { id: st.id, bankRef: 'SNB-OUT-9' });
  assert.equal(code(() => e.exec('settlement.recordPayment', U.fin, { id: st.id, bankRef: 'SNB-OUT-10' })), 'DUPLICATE_PAYMENT');
  assert.equal(code(() => e.exec('settlement.generate', U.fin, { partnerId: st.partnerId, periodStart: st.periodStart, periodEnd: st.periodEnd })), 'NOTHING_TO_SETTLE');
});

test('UAT-011 القيد المزدوج: رفض غير المتوازن ومنع تعديل المرحّل والعكس قابل للتتبع', () => {
  const e = fresh();
  const j = e.exec<any>('journal.createDraft', U.fin, { description: 'اختبار', lines: [{ accountCode: '5400', debitSar: 100, creditSar: 0 }, { accountCode: '1100', debitSar: 0, creditSar: 90 }] });
  assert.equal(code(() => e.exec('journal.post', U.fin, { id: j.id })), 'JOURNAL_UNBALANCED');
  e.exec('journal.updateDraft', U.fin, { id: j.id, lines: [{ accountCode: '5400', debitSar: 100, creditSar: 0 }, { accountCode: '1100', debitSar: 0, creditSar: 100 }] });
  e.exec('journal.post', U.fin, { id: j.id });
  assert.equal(code(() => e.exec('journal.updateDraft', U.fin, { id: j.id, lines: [] })), 'JOURNAL_POSTED_IMMUTABLE');
  const r = e.exec<any>('journal.reverse', U.fin, { id: j.id, reason: 'خطأ تصنيف' });
  assert.equal(r.reversalOfId, j.id);
  assert.equal(code(() => e.exec('journal.reverse', U.fin, { id: j.id, reason: 'مرة ثانية' })), 'JOURNAL_ALREADY_REVERSED');
  const tb = e.query<any>('ledger.trialBalance', U.fin, {});
  assert.equal(tb.balanced, true); assert.equal(tb.arReconciled, true);
});

test('UAT-012 محاكاة التسعير بلا آثار جانبية', () => {
  const e = fresh();
  const snap = JSON.stringify({ r: e.db.ratePlans, i: e.db.invoices, j: e.db.journals, c: e.db.contracts, s: e.db.shipments, q: e.db.quotes });
  const sim = e.exec<any>('simulation.run', U.fin, { name: 'زيادة 10% مبرّد', adjustments: [{ thermalClass: 'chilled', pct: 10 }] });
  assert.equal(sim.liveChangesApplied, false);
  assert.ok(sim.result.proposedRevenue > sim.result.currentRevenue);
  assert.equal(JSON.stringify({ r: e.db.ratePlans, i: e.db.invoices, j: e.db.journals, c: e.db.contracts, s: e.db.shipments, q: e.db.quotes }), snap);
  // النشر يتطلب اعتماداً (BR-008)
  const draft = e.exec<any>('simulation.toDraftPlan', U.fin, { simulationId: sim.id, effectiveFrom: new Date(NOW + 40 * 24 * H).toISOString() });
  assert.equal(code(() => e.exec('ratePlan.publish', U.fin, { id: draft.id })), 'NOT_APPROVED');
});

test('UAT-013 ترخيص إلزامي منتهٍ: حظر الإسناد الجديد وتصعيد النشط بأمان', () => {
  const e = fresh();
  const lic = e.db.licenses.find((l) => l.holderId === 'ptr_ufuq')!;
  lic.validTo = new Date(NOW - H).toISOString();
  const res = e.exec<any>('compliance.runExpiryCheck', U.cmp, {});
  assert.ok(res.newBlocks >= 1);
  assert.equal(e.db.partners.find((p) => p.id === 'ptr_ufuq')!.status, 'blocked');
  const leg = e.db.legs.find((l) => l.mode === 'air' && l.status === 'planned')!;
  assert.equal(code(() => e.exec('leg.assignPartner', U.ops, { legId: leg.id, partnerId: 'ptr_ufuq' })), 'ELIGIBILITY_BLOCKED');
  assert.ok(e.db.delayAlerts.some((d) => d.ruleVersion === 'CMP-ESC' && d.escalated), 'تصعيد الشحنات النشطة');
  const blk = e.db.blocks.find((b) => b.scopeId === 'ptr_ufuq' && !b.resolvedAt)!;
  assert.equal(code(() => e.exec('block.resolve', U.cmp, { id: blk.id, note: 'x' })), 'BLOCK_CAUSE_ACTIVE');
  e.exec('license.renew', U.cmp, { id: lic.id, newValidTo: new Date(NOW + 365 * 24 * H).toISOString() });
  e.exec('license.verify', U.cmp, { id: lic.id });
  assert.equal(e.db.partners.find((p) => p.id === 'ptr_ufuq')!.status, 'active');
});

test('UAT-014 لوحات العميل بلا تكلفة أو هامش داخلي', () => {
  const e = fresh();
  const id = e.db.shipments.find((s) => s.organizationId === 'org_nkh' && s.status === 'delivered')!.id;
  const d = e.query<any>('shipment.detail', U.corp, { id });
  assert.equal(d.costs, undefined); assert.equal(d.shipment.allocatedCost, undefined);
  assert.equal(code(() => e.query('reports.finance', U.corp, {})), 'FORBIDDEN');
  for (const col of ['costAllocations', 'costRecords', 'journals', 'settlements', 'glAccounts']) assert.equal(e.query<any>('list', U.cfin, { collection: col }).total, 0, col);
  const dash = JSON.stringify(e.query('customer.dashboard', U.corp, {}));
  assert.ok(!/cost|margin|allocat/i.test(dash));
  // المالية الداخلية ترى التكلفة
  assert.ok(e.query<any>('shipment.detail', U.fin, { id }).costs !== undefined);
});

test('UAT-015 الحجز القانوني يمنع الأرشفة، والسياسات غير المعتمدة لا تُنفّذ', () => {
  const e = fresh();
  assert.equal(code(() => e.exec('retention.runArchive', U.cmp, { category: 'telemetry_readings' })), 'POLICY_NOT_APPROVED');
  const held = e.db.legalHolds.filter((h) => !h.releasedAt).map((h) => h.subjectId);
  clock = NOW + 800 * 24 * H;
  const run = e.exec<any>('retention.runArchive', U.cmp, { category: 'financial_records' });
  assert.ok(run.skippedForHold >= held.length - 1);
  assert.ok(run.heldSubjects.includes(held[0]));
});

test('Idempotency + التراجع الذرّي (API-REL-01)', () => {
  const e = fresh();
  const from = e.db.addresses.find((a) => a.branchId === 'br_nkh_oly')!, to = e.db.addresses.find((a) => a.branchId === 'br_nrl_main')!;
  const input = { organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: from.id, receiverAddressId: to.id, thermalClass: 'ambient', serviceLevel: 'standard', pickupWindowStart: new Date(NOW + 2 * H).toISOString(), pickupWindowEnd: new Date(NOW + 4 * H).toISOString(), items: [{ descriptionCode: 'SWAB_PCR', quantity: 1, weightKg: 0.5 }] };
  const a = e.exec<Shipment>('shipment.create', U.bop, input, 'key-1');
  const b = e.exec<Shipment>('shipment.create', U.bop, input, 'key-1');
  assert.equal(a.id, b.id);
  assert.equal(code(() => e.exec('shipment.create', U.bop, { ...input, serviceLevel: 'stat' }, 'key-1')), 'IDEMPOTENCY_CONFLICT');
  const before = JSON.stringify(e.db);
  assert.equal(code(() => e.exec('shipment.create', U.bop, { ...input, pickupWindowEnd: input.pickupWindowStart })), 'VALIDATION');
  assert.equal(JSON.stringify(e.db), before);
});

test('المزامنة دون اتصال: تعارض محفوظ بأدلته، والتكرار بلا أثر (API-REL-03)', () => {
  const e = fresh();
  const notMine = e.db.shipments.find((s) => { const cs = e.db.custody.filter((c) => c.shipmentId === s.id).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)); const last = cs[cs.length - 1]; return s.status === 'in_transit' && last?.toType === 'courier' && last.toId === 'cou_01'; })!;
  const res = e.exec<any>('courier.sync', U.c1, { actions: [
    { clientActionId: 'off-1', type: 'deliver', shipment: notMine.id, occurredAt: new Date(NOW - 10 * 60_000).toISOString(), payload: { recipientName: 'مستلم', signature: 'sig' } },
    { clientActionId: 'off-2', type: 'deliver', shipment: notMine.id, occurredAt: new Date(NOW - 5 * 60_000).toISOString(), payload: { recipientName: 'مستلم آخر', signature: 'sig' } },
  ] });
  assert.equal(res.results[0].status, 'accepted');
  assert.equal(res.results[1].status, 'conflict');
  assert.equal(e.db.offlineConflicts.length, 1);
  const again = e.exec<any>('courier.sync', U.c1, { actions: [{ clientActionId: 'off-1', type: 'deliver', shipment: notMine.id, occurredAt: new Date(NOW).toISOString(), payload: {} }] });
  assert.equal(again.results[0].status, 'duplicate');
});

test('فصل المهام والفوترة إلى بوابة العميل والدفع المحاكى', () => {
  const e = fresh();
  const pend = e.db.approvalRequests.find((a) => a.kind === 'credit_note' && a.status === 'pending')!;
  assert.equal(code(() => e.exec('approval.decide', U.fin, { id: pend.id, decision: 'approve' })), 'FORBIDDEN');
  e.exec('approval.decide', U.apr, { id: pend.id, decision: 'approve' });
  const sh = newOlyShipment(e, { thermalClass: 'ambient' });
  e.exec('dispatch.assign', U.ops, { shipmentId: sh.id, courierId: 'cou_01', boxId: e.query<any>('dispatch.board', U.ops, {}).boxes.find((b: any) => b.thermalClass === 'ambient' && b.readiness.ready && b.status === 'available')?.id ?? null });
  const inv = e.exec<any>('invoice.generate', U.fin, { organizationId: 'org_nkh', periodFrom: new Date(NOW - 3 * 24 * H).toISOString(), periodTo: new Date(NOW + H).toISOString() });
  assert.equal(e.query<any>('list', U.cfin, { collection: 'invoices', pageSize: 200 }).items.some((x: any) => x.id === inv.id), false, 'المسودة لا تظهر للعميل');
  e.exec('invoice.issue', U.fin, { id: inv.id });
  assert.ok(e.query<any>('list', U.cfin, { collection: 'invoices', pageSize: 200 }).items.some((x: any) => x.id === inv.id));
  assert.equal(code(() => e.exec('customer.payInvoice', U.cfin, { invoiceId: inv.id, method: 'card_simulated', simulateFailure: true })), 'PAYMENT_DECLINED');
  e.exec('customer.payInvoice', U.cfin, { invoiceId: inv.id, method: 'card_simulated' });
  assert.equal(e.db.invoices.find((x) => x.id === inv.id)!.status, 'paid');
  const tb = e.query<any>('ledger.trialBalance', U.fin, {});
  assert.equal(tb.balanced, true); assert.equal(tb.arReconciled, true);
});
