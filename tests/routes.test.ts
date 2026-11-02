import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../packages/core/src/index';
// RTE-002: إعادة ترتيب التوقفات بالسحب — التحقق في الخادم يطابق التحقق في الواجهة
test('route.reorder: يرفض التسليم قبل الاستلام ويقبل ترتيباً صالحاً', () => {
  const e = new Engine(null);
  const route = e.db.routes.find((r) => r.status !== 'completed' && e.db.routeStops.filter((s) => s.routeId === r.id).some((s) => s.stopType === 'pickup') && e.db.routeStops.filter((s) => s.routeId === r.id).some((s) => s.stopType === 'delivery' && e.db.routeStops.some((p) => p.routeId === r.id && p.stopType === 'pickup' && p.shipmentIds.some((x) => s.shipmentIds.includes(x)))))!;
  assert.ok(route, 'يوجد مسار فيه استلام وتسليم لنفس الشحنة');
  const stops = e.db.routeStops.filter((s) => s.routeId === route.id).sort((a, b) => a.seq - b.seq);
  const del = stops.find((s) => s.stopType === 'delivery' && stops.some((p) => p.stopType === 'pickup' && p.shipmentIds.some((x) => s.shipmentIds.includes(x))))!;
  const bad = [del.id, ...stops.filter((s) => s.id !== del.id).map((s) => s.id)];
  const lockedMove = stops.findIndex((s) => s.id === del.id) !== 0 && stops[0].status === 'done';
  assert.throws(() => e.exec('route.reorder', 'usr_ops', { routeId: route.id, order: bad }), (x: any) => ['STOP_LOCKED', 'PICKUP_AFTER_DELIVERY'].includes(x.code) && (lockedMove ? x.code === 'STOP_LOCKED' : true));
  e.exec('route.reorder', 'usr_ops', { routeId: route.id, order: stops.map((s) => s.id) });
});
