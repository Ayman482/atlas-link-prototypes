// المزامنة دون اتصال للمندوب (courier.sync): لا أثر جزئي للإجراء المتعارض، لا تعارض مكرر عند إعادة الإرسال،
// معالجة التكرار داخل الدفعة نفسها، وإعادة الإرسال بعد انقطاع المزامنة دون أثر مزدوج
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../packages/core/src/index';

const NOW = Date.parse('2026-11-02T10:00:00Z');
const fresh = () => new Engine(null, { clock: () => NOW });
const iso = (m: number) => new Date(NOW + m * 60_000).toISOString();
function myInTransit(e: Engine) {
  return e.db.shipments.find((s) => { const cs = e.db.custody.filter((c) => c.shipmentId === s.id).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)); const last = cs[cs.length - 1]; return s.status === 'in_transit' && last?.toType === 'courier' && last.toId === 'cou_01'; })!;
}

test('إجراء متعارض لا يترك أثراً جزئياً (محاولة فاشلة بعد التسليم)', () => {
  const e = fresh(); const sh = myInTransit(e); assert.ok(sh);
  const attemptsBefore = e.db.deliveryAttempts.filter((a) => a.shipmentId === sh.id).length;
  const res = e.exec<any>('courier.sync', 'usr_courier1', { actions: [
    { clientActionId: 'ca-del', type: 'deliver', shipment: sh.id, occurredAt: iso(-10), payload: { recipientName: 'مستلم', signature: 'sig' } },
    { clientActionId: 'ca-fail', type: 'failAttempt', shipment: sh.id, occurredAt: iso(-5), payload: { reasonCode: 'RECIPIENT_UNAVAILABLE' } },
  ] });
  assert.deepEqual(res.results.map((r: any) => r.status), ['accepted', 'conflict']);
  assert.equal(e.db.shipments.find((s) => s.id === sh.id)!.status, 'delivered');
  assert.equal(e.db.deliveryAttempts.filter((a) => a.shipmentId === sh.id).length, attemptsBefore, 'لا سجل محاولة فاشلة وهمي بعد التعارض');
  assert.equal(e.db.offlineConflicts.filter((c) => c.clientActionId === 'ca-fail').length, 1);
});

test('إعادة إرسال إجراء متعارض (فقدان الاستجابة) لا تنشئ تعارضاً مكرراً', () => {
  const e = fresh(); const sh = myInTransit(e);
  const actions = [
    { clientActionId: 'ca-1', type: 'deliver', shipment: sh.id, occurredAt: iso(-10), payload: { recipientName: 'أ', signature: 's' } },
    { clientActionId: 'ca-2', type: 'deliver', shipment: sh.id, occurredAt: iso(-5), payload: { recipientName: 'ب', signature: 's' } },
  ];
  e.exec('courier.sync', 'usr_courier1', { actions });
  const again = e.exec<any>('courier.sync', 'usr_courier1', { actions }); // نفس الدفعة بعد انقطاع
  assert.deepEqual(again.results.map((r: any) => r.status), ['duplicate', 'duplicate']);
  assert.equal(e.db.offlineConflicts.filter((c) => c.clientActionId === 'ca-2').length, 1);
  assert.equal(e.db.pods.filter((p) => p.shipmentId === sh.id).length, 1, 'إثبات تسليم واحد فقط');
});

test('معرّف إجراء مكرر داخل الدفعة نفسها يُعالج مرة واحدة', () => {
  const e = fresh(); const sh = myInTransit(e);
  const a = { clientActionId: 'ca-x', type: 'deliver', shipment: sh.id, occurredAt: iso(-3), payload: { recipientName: 'أ', signature: 's' } };
  const r = e.exec<any>('courier.sync', 'usr_courier1', { actions: [a, a] });
  assert.deepEqual(r.results.map((x: any) => x.status), ['accepted', 'duplicate']);
  assert.equal(e.db.offlineConflicts.length, 0);
});

test('مندوب آخر لا يستطيع مزامنة إجراء على شحنة ليست له، ولا يُكشف وجودها', () => {
  const e = fresh(); const sh = myInTransit(e);
  const r = e.exec<any>('courier.sync', 'usr_courier2', { actions: [{ clientActionId: 'ca-o', type: 'deliver', shipment: sh.id, occurredAt: iso(-1), payload: { recipientName: 'x', signature: 's' } }] });
  assert.equal(r.results[0].status, 'conflict');
  assert.equal(e.db.shipments.find((s) => s.id === sh.id)!.status, 'in_transit');
});

test('مزامنة فارغة أو بنوع إجراء غير معروف تُرفض بوضوح', () => {
  const e = fresh(); const sh = myInTransit(e);
  assert.deepEqual(e.exec<any>('courier.sync', 'usr_courier1', { actions: [] }).results, []);
  const r = e.exec<any>('courier.sync', 'usr_courier1', { actions: [{ clientActionId: 'ca-u', type: 'teleport', shipment: sh.id, occurredAt: iso(0), payload: {} }] });
  assert.equal(r.results[0].status, 'conflict');
  assert.throws(() => e.exec('courier.sync', 'usr_ops', { actions: [] }), (x: any) => x.code === 'FORBIDDEN');
});
