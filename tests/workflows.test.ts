// اختبارات انحدار لسير العمل المطلوبة في مهمة المعالجة: مسح QR وإسناد الصندوق (الحالات السلبية)، النقل البري/الجوي،
// التتبع أثناء الطيران وبعد انقطاع الجهاز، الفوترة إلى القيد المحاسبي، وعرض التنبيه الحرج.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, type Shipment } from '../packages/core/src/index';

const NOW = Date.parse('2026-11-02T10:00:00Z');
let clock = NOW;
const fresh = () => { clock = NOW; return new Engine(null, { clock: () => clock }); };
const code = (fn: () => unknown) => { try { fn(); return 'OK'; } catch (e: any) { return e.code ?? String(e); } };
function newShipment(e: Engine, extra: Record<string, unknown> = {}) {
  const from = e.db.addresses.find((a) => a.branchId === 'br_nkh_oly')!;
  const to = e.db.addresses.find((a) => a.branchId === 'br_nrl_main')!;
  return e.exec<Shipment>('shipment.create', 'usr_branch_op', { organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: from.id, receiverAddressId: to.id, receiverOrgId: 'org_nrl', thermalClass: 'chilled', serviceLevel: 'express', pickupWindowStart: new Date(NOW + 2 * 3600e3).toISOString(), pickupWindowEnd: new Date(NOW + 4 * 3600e3).toISOString(), items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 4, weightKg: 1 }], ...extra });
}
const readyBox = (e: Engine, thermal = 'chilled') => e.query<any>('dispatch.board', 'usr_ops', {}).boxes.find((b: any) => b.thermalClass === thermal && b.readiness.ready && b.status === 'available');

test('مسح QR: رمز صندوق مجهول، صندوق غير المسند، شحنة معبأة مسبقاً، وشحنة مندوب آخر', () => {
  const e = fresh(); const sh = newShipment(e); const box = readyBox(e);
  e.exec('dispatch.assign', 'usr_ops', { shipmentId: sh.id, courierId: 'cou_01', boxId: box.id });
  assert.equal(code(() => e.exec('courier.scanPack', 'usr_courier1', { shipment: sh.trackingNo, boxCode: 'BX-NOPE-999' })), 'BOX_NOT_FOUND');
  const other = e.db.boxes.find((b) => b.id !== box.id && b.thermalClass === 'chilled')!;
  assert.equal(code(() => e.exec('courier.scanPack', 'usr_courier1', { shipment: sh.trackingNo, boxCode: other.code })), 'WRONG_BOX');
  assert.equal(code(() => e.exec('courier.scanPack', 'usr_courier2', { shipment: sh.trackingNo, boxCode: box.code })), 'NOT_FOUND', 'لا يُكشف وجود شحنة مندوب آخر');
  clock += 60_000; e.exec('courier.scanPack', 'usr_courier1', { shipment: sh.trackingNo, boxCode: box.code });
  assert.equal(code(() => e.exec('courier.scanPack', 'usr_courier1', { shipment: sh.trackingNo, boxCode: box.code })), 'ALREADY_PACKED');
  assert.equal(e.db.packings.filter((p) => p.shipmentId === sh.id && !p.unpackedAt).length, 1);
});

test('النقل الجوي: الرجل الجوية تتطلب ناقلاً جوياً مؤهلاً؛ والتتبع أثناء الطيران لا يعرض موقعاً حياً', () => {
  const e = fresh();
  const airLeg = e.db.legs.find((l) => l.mode === 'air')!;
  const road = e.db.partners.find((p) => p.partnerType === 'road')!;
  assert.equal(code(() => e.exec('leg.assignPartner', 'usr_ops', { legId: airLeg.id, partnerId: road.id })), 'VALIDATION');
  const departed = e.db.legs.find((l) => l.mode === 'air' && l.status === 'departed')!;
  assert.ok(departed, 'رحلة جوية مغادرة في البيانات الأولية');
  {
    const shId = e.db.shipmentLegs.find((x) => x.legId === departed.id)!.shipmentId;
    const d = e.query<any>('shipment.detail', 'usr_ops', { id: shId });
    assert.equal(d.tracking.inAir, true);
    assert.equal(d.tracking.operationalStatus, 'in_air_transit');
    assert.notEqual(d.tracking.lastConfirmedPosition?.isLive, true, 'لا موقع حي أثناء الطيران');
    assert.equal(d.tracking.temperatureVisibility, 'last_known_only');
  }
});

test('انقطاع الجهاز: آخر موقع مؤكد بوقته، وحداثة «قديمة» دون ادعاء اتصال', () => {
  const e = fresh();
  const s = e.db.shipments.find((x) => { try { const d = e.query<any>('shipment.detail', 'usr_ops', { id: x.id }); return d.tracking.freshness === 'stale'; } catch { return false; } });
  assert.ok(s, 'توجد شحنة ببيانات قديمة في البيانات الأولية');
  const d = e.query<any>('shipment.detail', 'usr_ops', { id: s!.id });
  assert.equal(d.tracking.deviceConnectivity === 'online', false);
  assert.equal(d.tracking.temperatureVisibility, 'last_known_only');
  if (d.tracking.lastConfirmedPosition) { assert.equal(d.tracking.lastConfirmedPosition.isLive, false); assert.ok(d.tracking.lastConfirmedPosition.at); }
  assert.equal(d.tracking.lastReading?.demo, true, 'القراءة مُعلَّمة كبيانات عرض');
});

test('الخط الزمني يحمل رموزاً منظمة لكل حدث حيازة وحالة (للتوطين في الواجهات)', () => {
  const e = fresh();
  const s = e.db.shipments.find((x) => e.db.custody.some((c) => c.shipmentId === x.id))!;
  const tl = e.query<any>('shipment.detail', 'usr_ops', { id: s.id }).timeline;
  for (const ev of tl.filter((x: any) => x.kind === 'custody')) { assert.ok(ev.codes.fromType && ev.codes.toType && ev.codes.method); }
  for (const ev of tl.filter((x: any) => x.kind === 'status')) assert.ok(ev.codes.status);
  const d = e.query<any>('shipment.detail', 'usr_corp_admin', { id: e.db.shipments.find((x) => x.organizationId === 'org_nkh' && e.db.custody.some((c) => c.shipmentId === x.id && c.toType === 'courier'))!.id });
  if (d.custodian?.type === 'courier') assert.ok(d.custodianName?.ar, 'العميل يرى اسم المندوب لا معرّفه');
});

test('الفوترة: الفاتورة الصادرة تولّد قيداً متوازناً، والعميل لا يرى المسودات', () => {
  const e = fresh();
  for (const j of e.db.journals) {
    const dr = j.lines.reduce((x: number, l: any) => x + (l.debit ?? 0), 0), cr = j.lines.reduce((x: number, l: any) => x + (l.credit ?? 0), 0);
    assert.equal(dr, cr, `قيد غير متوازن ${j.id}`);
  }
  const drafts = e.db.invoices.filter((i) => i.organizationId === 'org_nkh' && i.status === 'draft').map((i) => i.id);
  const seen = e.query<any>('list', 'usr_corp_finance', { collection: 'invoices', pageSize: 500 }).items.map((i: any) => i.id);
  for (const id of drafts) assert.ok(!seen.includes(id));
  assert.equal(e.query<any>('list', 'usr_branch_op', { collection: 'invoices' }).total, 0, 'مشغّل الفرع لا يرى الفواتير');
});

test('التنبيه الحرج: انحراف مفتوح يظهر في ملخص مركز مراقبة العمليات وإشعار حرج للموظفين حتى الإقرار', () => {
  const e = fresh();
  const open = e.db.excursions.find((x) => x.status === 'open')!;
  assert.ok(open);
  assert.ok(e.db.notifications.some((n) => n.audience === 'staff' && n.critical));
  e.exec('excursion.acknowledge', 'usr_ops', { id: open.id, note: 'اختبار' });
  assert.equal(e.db.excursions.find((x) => x.id === open.id)!.status, 'acknowledged');
  assert.ok(e.db.audit.some((a) => a.action === 'excursion.acknowledge' && a.entityId === open.id));
  assert.equal(code(() => e.exec('excursion.acknowledge', 'usr_branch_op', { id: open.id })), 'FORBIDDEN', 'العميل لا يقرّ الانحرافات');
});
