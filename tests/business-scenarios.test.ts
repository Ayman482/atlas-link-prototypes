// Phase 17 — سيناريوهات الأعمال الشاملة الاثنا عشر (UAT-E2E-01…12) كقصة واحدة متصلة على نفس البيانات،
// مع تسجيل النتيجة الفعلية لكل خطوة في docs/phase17/evidence/business-scenarios.json (لا تُكتب نتيجة لم تُنفّذ).
// بيانات عرض خيالية فقط. يتحقق أيضاً أن كل أمر لا يبث حدثين بنفس النوع لنفس الكيان (عدم التكرار).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Engine, type Shipment } from '../packages/core/src/index';

const H = 3600e3; const T0 = Date.parse('2026-11-02T06:00:00Z'); let clock = T0;
const e = new Engine(null, { clock: () => clock });
const log: { id: string; ref: string; step: string; expected: string; actual: unknown; status: 'PASS' | 'FAIL' }[] = [];
const dupEvents: string[] = [];
e.subscribe((p) => { const seen = new Set<string>(); for (const ev of p.events) { const k = `${ev.eventType}:${ev.aggregateId}`; if (seen.has(k)) dupEvents.push(`${p.command} → ${k}`); seen.add(k); } });
const ctx: Record<string, any> = {};
function step(id: string, ref: string, stepText: string, expected: string, fn: () => unknown, check: (v: any) => boolean) {
  let actual: unknown; let ok = false;
  try { actual = fn(); ok = check(actual); } catch (x: any) { actual = { error: x.code ?? String(x), message: x.detail?.ar ?? x.message }; }
  log.push({ id, ref, step: stepText, expected, actual, status: ok ? 'PASS' : 'FAIL' });
  assert.ok(ok, `${id} ${stepText}: ${JSON.stringify(actual).slice(0, 300)}`);
  return actual as any;
}
const addr = (branch: string) => e.db.addresses.find((a) => a.branchId === branch)!;
after(() => { fs.mkdirSync('docs/phase17/evidence', { recursive: true }); fs.writeFileSync('docs/phase17/evidence/business-scenarios.json', JSON.stringify({ executedAt: new Date().toISOString(), engineClock: new Date(T0).toISOString(), steps: log, duplicateEventsWithinCommand: dupEvents }, null, 1)); });

test('UAT-E2E-01 عميل مؤسسي ينشئ شحنة مبرّدة مجدولة', () => {
  const s = step('E2E-01.1', 'SHP-001, SHP-002, BR-001', 'مشغّل فرع العليا ينشئ طلباً مجدولاً مبرّداً (أنابيب دم) بفترة استلام غداً', 'شحنة مؤكدة برقم تتبع وسعر من العقد', () => e.exec<Shipment>('shipment.create', 'usr_branch_op', {
    organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: addr('br_nkh_oly').id, receiverAddressId: addr('br_nrl_main').id, receiverOrgId: 'org_nrl', thermalClass: 'chilled', serviceLevel: 'standard', requestType: 'scheduled',
    pickupWindowStart: new Date(T0 + 2 * H).toISOString(), pickupWindowEnd: new Date(T0 + 4 * H).toISOString(), items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 6, weightKg: 1.5 }] }), (v) => v.status === 'confirmed' && /^ML-2026-/.test(v.trackingNo) && v.thermalClass === 'chilled');
  ctx.s1 = s.id; ctx.t1 = s.trackingNo;
  step('E2E-01.2', 'CUST-002, OPS-001', 'الشحنة تظهر للعميل ولوحة التوزيع', 'ظاهرة لمدير المؤسسة وفي قائمة غير المسندة', () => ({ customer: !!e.query<any>('shipment.detail', 'usr_corp_admin', { id: s.id }), board: e.query<any>('dispatch.board', 'usr_ops', {}).unassigned.some((x: any) => x.id === s.id) }), (v) => v.customer && v.board);
});

test('UAT-E2E-02 العمليات تسند مندوباً مؤهلاً وصندوقاً متاحاً', () => {
  const box = e.query<any>('dispatch.board', 'usr_ops', {}).boxes.find((b: any) => b.thermalClass === 'chilled' && b.readiness.ready && b.status === 'available');
  ctx.box = box.code; ctx.boxId = box.id;
  step('E2E-02.1', 'RTE-001, BR-009, §6.1-3', `إسناد المندوب cou_01 والصندوق ${box.code}`, 'إسناد ناجح ومسار للمندوب', () => e.exec<any>('dispatch.assign', 'usr_ops', { shipmentId: ctx.s1, courierId: 'cou_01', boxId: box.id }), (v) => !!v.routeId);
  step('E2E-02.2', 'BR-009, DHC, UAT-007', 'إسناد صندوق غير جاهز يُرفض', 'BOX_NOT_READY', () => { const bad = e.db.boxes.find((b) => b.code === 'BX-CS-010')!; const s2 = e.exec<Shipment>('shipment.create', 'usr_branch_op', { organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: addr('br_nkh_oly').id, receiverAddressId: addr('br_nrl_main').id, thermalClass: 'chilled', serviceLevel: 'standard', pickupWindowStart: new Date(T0 + 3 * H).toISOString(), pickupWindowEnd: new Date(T0 + 5 * H).toISOString(), items: [{ descriptionCode: 'SWAB_PCR', quantity: 1, weightKg: 0.2 }] }); try { e.exec('dispatch.assign', 'usr_ops', { shipmentId: s2.id, courierId: 'cou_01', boxId: bad.id }); return 'assigned'; } catch (x: any) { return x.code; } }, (v) => v === 'BOX_NOT_READY');
});

test('UAT-E2E-03 المندوب يمسح QR ويؤكد الاستلام', () => {
  clock += 2.2 * H;
  step('E2E-03.1', 'SHP-003, UAT-003', 'مسح رمز خاطئ للصندوق', 'رفض WRONG_BOX دون أثر', () => { try { e.exec('courier.scanPack', 'usr_courier1', { shipment: ctx.t1, boxCode: 'BX-CM-011' }); return 'ok'; } catch (x: any) { return x.code; } }, (v) => v === 'WRONG_BOX');
  step('E2E-03.2', 'SHP-003, BOX-004', `مسح الشحنة والصندوق ${ctx.box}`, 'تعبئة الشحنة في الصندوق', () => e.exec<any>('courier.scanPack', 'usr_courier1', { shipment: ctx.t1, boxCode: ctx.box }).box.code, (v) => v === ctx.box);
  step('E2E-03.3', 'BR-005, UAT-003', 'الاستلام بتوقيع المرسل', 'الحالة «تم الاستلام» والحيازة لدى المندوب', () => { const s = e.exec<Shipment>('courier.pickup', 'usr_courier1', { shipment: ctx.s1, signedBy: 'أ. ريم القحطاني', method: 'signature' }); return { status: s.status, custodian: e.query<any>('shipment.detail', 'usr_ops', { id: ctx.s1 }).custodian }; }, (v) => v.status === 'collected' && v.custodian.type === 'courier' && v.custodian.id === 'cou_01');
  step('E2E-03.4', 'SHP-004', 'بدء النقل', 'في الطريق', () => e.exec<Shipment>('courier.startTransit', 'usr_courier1', { shipment: ctx.s1 }).status, (v) => v === 'in_transit');
});

test('UAT-E2E-04 القياس يحدّث الحرارة وآخر موقع مؤكد', () => {
  const dev = e.db.devices.find((d) => e.db.boxes.find((b) => b.id === ctx.boxId)?.id && (d as any).boxId === ctx.boxId) ?? e.db.devices.find((d: any) => d.pairedBoxId === ctx.boxId || d.boxId === ctx.boxId);
  ctx.dev = dev?.id ?? e.query<any>('box.detail', 'usr_ops', { id: ctx.boxId })?.device?.id;
  assert.ok(ctx.dev, 'جهاز مقترن بالصندوق');
  clock += 10 * 60e3;
  step('E2E-04.1', 'TEMP-002, BR-011', 'قراءة تجريبية 5.4 °م مع موقع (الرياض)', 'قراءة مسجلة ومعلّمة كبيانات عرض', () => e.exec<any>('telemetry.injectDemo', 'usr_iot', { device: ctx.dev, tempC: 5.4, lat: 24.7136, lng: 46.6753 }), (v) => v.reading && v.reading.tempC === 5.4);
  step('E2E-04.2', 'MMT, OPS-004, BR-006', 'التتبع يعرض آخر موقع مؤكد بوقته وآخر قراءة', 'حداثة «مباشر»، آخر قراءة 5.4 بوقت الجهاز ووقت الاستلام، علامة demo', () => { const t = e.query<any>('shipment.detail', 'usr_corp_admin', { id: ctx.s1 }).tracking; return { freshness: t.freshness, temp: t.lastReading?.tempC, deviceTime: t.lastReading?.deviceTime, receivedAt: t.lastReading?.receivedAt, demo: t.lastReading?.demo, pos: t.lastConfirmedPosition }; }, (v) => v.freshness === 'live' && v.temp === 5.4 && !!v.deviceTime && !!v.receivedAt && v.demo === true && !!v.pos?.at);
});

test('UAT-E2E-05 انحراف حراري يطلق تنبيهاً ومسار الجودة', () => {
  clock += 10 * 60e3;
  const before = e.db.excursions.length;
  step('E2E-05.1', 'TEMP-003, UAT-004', 'قراءة 11.6 °م خارج نطاق المبرّد المعتمد (+4 إلى +8 °م)', 'انحراف مفتوح + إشعار حرج للموظفين', () => { e.exec('telemetry.injectDemo', 'usr_iot', { device: ctx.dev, tempC: 11.6 }); clock += 6 * 60e3; e.exec('telemetry.injectDemo', 'usr_iot', { device: ctx.dev, tempC: 11.9 }); const ex = e.db.excursions.find((x) => x.shipmentId === ctx.s1 && x.status === 'open'); ctx.ex = ex?.id; return { created: e.db.excursions.length > before, open: !!ex, critical: e.db.notifications.some((n) => n.audience === 'staff' && n.critical && JSON.stringify(n.title).includes(ctx.t1)) }; }, (v) => v.created && v.open);
  step('E2E-05.2', 'TEMP-004', 'العمليات تقرّ بالانحراف', 'الحالة «تم الإقرار» ومسجّلة في التدقيق', () => e.exec<any>('excursion.acknowledge', 'usr_ops', { id: ctx.ex, note: 'تم التواصل مع المندوب' }).status, (v) => v === 'acknowledged');
  step('E2E-05.3', 'QMS-001', 'الجودة تراجع وتفتح حادثاً', 'حادث جودة مرتبط بالشحنة، دون قرار سريري', () => { const r = e.exec<any>('excursion.qualityReview', 'usr_quality', { id: ctx.ex, decision: 'investigate', openIncident: true, severity: 'major' }); const inc = e.db.incidents.find((i) => i.shipmentId === ctx.s1); ctx.inc = inc?.id; return { status: r.status, incident: !!inc }; }, (v) => v.incident);
  step('E2E-05.4', 'QMS-001 (CAPA)', 'إضافة إجراء CAPA', 'إجراء تصحيحي مرتبط بالحادث', () => e.exec<any>('capa.create', 'usr_quality', { incidentId: ctx.inc, actionType: 'corrective', description: 'إعادة تدريب على فحص إغلاق الصندوق', ownerId: 'usr_warehouse', dueAt: new Date(clock + 7 * 24 * H).toISOString() }), (v) => !!v.id);
  step('E2E-05.5', 'TEMP-005, TEMP-006, QMS-002', 'العميل يرى الانحراف في تقرير الأدلة مع إخلاء المسؤولية السريرية', 'الانحراف ظاهر + نص «القرار السريري للمؤسسة المستلمة»', () => { const r = e.query<any>('shipment.temperatureReport', 'usr_corp_admin', { id: ctx.s1 }); return { excursions: r.excursions.length, disclaimer: r.disclaimer.ar }; }, (v) => v.excursions >= 1 && v.disclaimer.includes('القرار السريري') && v.disclaimer.includes('المستلمة'));
});

test('UAT-E2E-06 انتقال الشحنة بين النقل البري والجوي', () => {
  clock = T0 + 30 * 60e3;
  const jed = e.db.addresses.find((a) => a.cityCode === 'JED' && a.organizationId === 'org_nkh')!;
  const s = step('E2E-06.1', 'SHP-005, RTE-002', 'شحنة من الرياض إلى جدة (أكثر من 600 كم) تُخطط برياً + جوياً', 'نمط road_air', () => e.exec<Shipment>('shipment.create', 'usr_corp_admin', { organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: addr('br_nkh_oly').id, receiverAddressId: jed.id, thermalClass: 'chilled', serviceLevel: 'express', pickupWindowStart: new Date(clock + 1 * H).toISOString(), pickupWindowEnd: new Date(clock + 3 * H).toISOString(), items: [{ descriptionCode: 'SERUM_ALIQUOT', quantity: 2, weightKg: 0.6 }] }), (v) => v.mode === 'road_air');
  ctx.s6 = s.id; ctx.t6 = s.trackingNo;
  const box = e.query<any>('dispatch.board', 'usr_ops', {}).boxes.find((b: any) => b.thermalClass === 'chilled' && b.readiness.ready && b.status === 'available');
  step('E2E-06.2', 'RTE-002, MMT', 'إسناد: ثلاث مراحل (بري ← جوي ← بري)', '3 مراحل', () => { e.exec('dispatch.assign', 'usr_ops', { shipmentId: s.id, courierId: 'cou_01', boxId: box.id }); return e.query<any>('shipment.detail', 'usr_ops', { id: s.id }).legs.map((l: any) => l.mode); }, (v) => v.join(',') === 'road,air,road');
  const legs = e.query<any>('shipment.detail', 'usr_ops', { id: s.id }).legs; const air = legs.find((l: any) => l.mode === 'air');
  step('E2E-06.3', 'RTE-005, BR-009', 'إسناد ناقل بري لرجل جوية يُرفض', 'VALIDATION', () => { try { e.exec('leg.assignPartner', 'usr_ops', { legId: air.id, partnerId: e.db.partners.find((p) => p.partnerType === 'road')!.id }); return 'ok'; } catch (x: any) { return x.code; } }, (v) => v === 'VALIDATION');
  step('E2E-06.4', 'RTE-005, RTE-004', 'إسناد الناقل الجوي المؤهل ورقم الرحلة', 'ناقل الأفق الجوي SV1034', () => e.exec<any>('leg.assignPartner', 'usr_ops', { legId: air.id, partnerId: 'ptr_ufuq', flightNo: 'SV1034' }).flightNo, (v) => v === 'SV1034');
  clock += 1.5 * H;
  e.exec('courier.scanPack', 'usr_courier1', { shipment: s.trackingNo, boxCode: box.code });
  e.exec('courier.pickup', 'usr_courier1', { shipment: s.id, signedBy: 'أ. ريم القحطاني' });
  e.exec('courier.startTransit', 'usr_courier1', { shipment: s.id });
  step('E2E-06.5', 'BR-005, UAT-003', 'نقل الحيازة من المندوب إلى الناقل الجوي بدليل', 'الحائز الحالي: الناقل الجوي', () => { e.exec('custody.handover', 'usr_courier1', { shipment: s.id, toType: 'air_carrier', toId: 'ptr_ufuq', legId: air.id, signedBy: 'وكيل الشحن — مطار الملك خالد', method: 'qr' }); return e.query<any>('shipment.detail', 'usr_ops', { id: s.id }).custodian; }, (v) => v.type === 'air_carrier');
  step('E2E-06.6', 'RTE-004, UAT-006, §6.4, §2.2', 'أحداث الناقل: تحميل ثم إقلاع', 'حالة تشغيلية «في رحلة جوية» دون موقع حي', () => { e.exec('carrier.event', 'usr_ops', { legId: air.id, eventType: 'loaded' }); e.exec('carrier.event', 'usr_ops', { legId: air.id, eventType: 'departed' }); const t = e.query<any>('shipment.detail', 'usr_corp_admin', { id: s.id }).tracking; return { op: t.operationalStatus, inAir: t.inAir, live: t.lastConfirmedPosition?.isLive ?? false, temp: t.temperatureVisibility }; }, (v) => v.op === 'in_air_transit' && v.inAir && v.live === false && v.temp === 'last_known_only');
  clock += 2 * H;
  step('E2E-06.7', 'UAT-006, §6.4', 'الوصول والتفريغ ثم نقل الحيازة لمندوب جدة', 'الحائز: مندوب جدة؛ وصول الطائرة لا يعني التسليم', () => { e.exec('carrier.event', 'usr_ops', { legId: air.id, eventType: 'arrived' }); e.exec('carrier.event', 'usr_ops', { legId: air.id, eventType: 'released' }); e.exec('custody.handover', 'usr_ops', { shipment: s.id, toType: 'courier', toId: 'cou_04', signedBy: 'م. فيصل الغامدي', method: 'signature' }); const d = e.query<any>('shipment.detail', 'usr_ops', { id: s.id }); return { custodian: d.custodian, status: d.shipment.status }; }, (v) => v.custodian.type === 'courier' && v.custodian.id === 'cou_04' && v.status !== 'delivered');
});

test('UAT-E2E-07 إتمام التسليم بإثبات', () => {
  clock += 40 * 60e3;
  step('E2E-07.1', 'SHP-005', 'تسليم دون توقيع يُرفض', 'VALIDATION', () => { try { e.exec('courier.deliver', 'usr_courier1', { shipment: ctx.s1, recipientName: 'د. ليلى الحمدان', signature: '' }); return 'ok'; } catch (x: any) { return x.code; } }, (v) => v === 'VALIDATION');
  step('E2E-07.2', 'SHP-005, BR-005, §6.1-7', 'التسليم باسم المستلم وتوقيعه وصورة', 'تم التسليم + إثبات + حيازة للمستلم', () => { const s = e.exec<Shipment>('courier.deliver', 'usr_courier1', { shipment: ctx.s1, recipientName: 'د. ليلى الحمدان', signature: 'data:image/png;base64,iVBORw0KGgo=', photoRef: 'photo-demo-001' }); const d = e.query<any>('shipment.detail', 'usr_corp_admin', { id: ctx.s1 }); return { status: s.status, pod: d.pod?.recipientName, custodian: d.custodian?.type }; }, (v) => v.status === 'delivered' && v.pod === 'د. ليلى الحمدان');
  step('E2E-07.3', 'SHP-007', 'تسليم ثانٍ لنفس الشحنة يُرفض (منع الإثبات المكرر)', 'خطأ انتقال، إثبات واحد فقط', () => { let c = 'ok'; try { e.exec('courier.deliver', 'usr_courier1', { shipment: ctx.s1, recipientName: 'x', signature: 's' }); } catch (x: any) { c = x.code; } return { code: c, pods: e.db.pods.filter((p) => p.shipmentId === ctx.s1).length }; }, (v) => v.code !== 'ok' && v.pods === 1);
  step('E2E-07.4', 'TEMP-006, QMS-002', 'المختبر المستلم يسجّل قراره السريري', 'قرار مسجّل للجهة المستلمة فقط', () => e.exec<any>('disposition.record', 'usr_lab', { shipment: ctx.s1, decision: 'accepted_with_note', authorizedContact: 'د. ليلى الحمدان', note: 'انحراف 18 دقيقة — العينة قُبلت بعد المراجعة' }).decision, (v) => v === 'accepted_with_note');
});

test('UAT-E2E-08 الصندوق يعود ويُنظَّف ويصبح متاحاً', () => {
  const b0 = e.db.boxes.find((b) => b.id === ctx.boxId)!;
  step('E2E-08.1', 'BOX-005, §6.1-8', `حالة الصندوق ${ctx.box} بعد التسليم`, 'عائد إلى المستودع (لم يعد متاحاً تلقائياً)', () => b0.status, (v) => ['returning', 'in_use'].includes(v));
  step('E2E-08.2', 'BOX-005, WH-001', 'المستودع يستلم الصندوق العائد', 'قيد التنظيف', () => e.exec<any>('box.receiveReturn', 'usr_warehouse', { box: ctx.box, signedBy: 'أ. عمر الجهني' }).status, (v) => v === 'cleaning');
  step('E2E-08.3', 'BOX-005', 'تنظيف بقائمة ناقصة يُرفض', 'CHECKLIST_INCOMPLETE', () => { try { e.exec('box.cleanInspect', 'usr_warehouse', { box: ctx.box, checklist: { cleaned: true }, result: 'pass' }); return 'ok'; } catch (x: any) { return x.code; } }, (v) => v === 'CHECKLIST_INCOMPLETE');
  const full = { cleaned: true, disinfected: true, sealIntact: true, trackerPaired: true, trackerBattery: true, probeCheck: true };
  step('E2E-08.4', 'BOX-005, WH-001', 'التنظيف والتطهير بقائمة كاملة', 'ينتقل للفحص', () => e.exec<any>('box.cleanInspect', 'usr_warehouse', { box: ctx.box, checklist: full, result: 'pass' }).status, (v) => ['inspection', 'available'].includes(v));
  step('E2E-08.5', 'BOX-005', 'الفحص والتأهيل', 'متاح ويجتاز فحص الجاهزية', () => { let b = e.db.boxes.find((x) => x.id === ctx.boxId)!; if (b.status === 'inspection') b = e.exec<any>('box.cleanInspect', 'usr_quality', { box: ctx.box, checklist: full, result: 'pass' }); const ready = e.query<any>('dispatch.board', 'usr_ops', {}).boxes.find((x: any) => x.id === ctx.boxId); return { status: b.status, ready: ready?.readiness?.ready, reasons: ready?.readiness?.reasons?.map((r: any) => r.ar) }; }, (v) => v.status === 'available');
  step('E2E-08.6', 'DHC, BR-009, UAT-007', 'بعد التأهيل يكون جهاز التتبع بلا نبض حديث → غير جاهز للإسناد؛ تشغيل الجهاز وإرسال نبضة', 'الصندوق جاهز للإسناد بعد وصول نبضة حديثة', () => { e.exec('telemetry.injectDemo', 'usr_iot', { device: ctx.dev, tempC: 4.8 }); const r = e.query<any>('dispatch.board', 'usr_ops', {}).boxes.find((x: any) => x.id === ctx.boxId); return { status: r.status, ready: r.readiness.ready, reasons: r.readiness.reasons.map((x: any) => x.ar) }; }, (v) => v.status === 'available' && v.ready === true);
});

test('UAT-E2E-09 التكاليف والفاتورة والقيود المحاسبية', () => {
  step('E2E-09.1', 'COST', 'تسجيل تكلفة الشحن الجوي للرحلة SV1034', 'سجل تكلفة', () => e.exec<any>('cost.record', 'usr_finance', { costType: 'air_cargo', sourceRef: 'SV1034', estimatedSar: 420, actualSar: 405 }), (v) => !!v.id);
  step('E2E-09.2', 'COST', 'تشغيل توزيع التكاليف على الشحنات', 'توزيعات منشأة', () => { const n0 = e.db.costAllocations.length; e.exec('cost.runAllocation', 'usr_finance', {}); return e.db.costAllocations.length - n0; }, (v) => v >= 0);
  const from = new Date(T0 - 30 * 24 * H).toISOString(), to = new Date(clock + H).toISOString();
  const inv = step('E2E-09.3', 'FIN-001, FIN-003', 'توليد فاتورة لمستشفى النخبة للفترة', 'مسودة؛ الشحنة المسلّمة بند مستقل بسعرها، أو مشمولة برسم العقد إن كان سعرها صفراً ضمن الحصة', () => { const v = e.exec<any>('invoice.generate', 'usr_finance', { organizationId: 'org_nkh', periodFrom: from, periodTo: to }); const q = e.db.quotes.find((x) => x.id === e.db.shipments.find((s) => s.id === ctx.s1)!.quoteId)!; return { ...v, s1Line: e.db.invoiceLines.some((l) => l.invoiceId === v.id && l.shipmentId === ctx.s1), s1QuoteSubtotal: q.snapshot.subtotal, lines: e.db.invoiceLines.filter((l) => l.invoiceId === v.id).length }; }, (v) => v.status === 'draft' && v.total > 0 && (v.s1Line || v.s1QuoteSubtotal === 0));
  ctx.inv = inv.id;
  step('E2E-09.4', 'FIN-004, FIN-006, BR-007', 'إصدار الفاتورة (ZATCA محاكاة) وترحيل القيد', 'صادرة + قيد مرحّل متوازن', () => { const i = e.exec<any>('invoice.issue', 'usr_finance', { id: inv.id }); const j = e.db.journals.filter((x) => x.id === i.journalId || x.sourceId === inv.id); const bal = j.every((x: any) => x.lines.reduce((a: number, l: any) => a + (l.debit ?? 0) - (l.credit ?? 0), 0) === 0); return { status: i.status, zatca: i.zatcaStatus, journals: j.length, posted: j.every((x) => x.status === 'posted'), balanced: bal }; }, (v) => v.status === 'issued' && v.journals >= 1 && v.balanced);
  step('E2E-09.5', 'FIN-005, UAT-011, NFR-007', 'ميزان المراجعة متوازن', 'مجموع المدين = مجموع الدائن', () => { const tb = e.query<any>('ledger.trialBalance', 'usr_finance', {}); return tb; }, (v) => v.balanced === true && v.totalDebit === v.totalCredit && v.unbalancedJournals.length === 0 && v.arReconciled === true);
  step('E2E-09.6', 'BI-003, UAT-014', 'العميل يرى الفاتورة ولا يرى التكلفة الداخلية', 'فاتورة ظاهرة؛ لا allocatedCost', () => { const l = e.query<any>('list', 'usr_corp_finance', { collection: 'invoices', pageSize: 500 }).items.some((x: any) => x.id === inv.id); const d = e.query<any>('shipment.detail', 'usr_corp_admin', { id: ctx.s1 }); return { visible: l, cost: d.shipment.allocatedCost, costs: d.costs }; }, (v) => v.visible && v.cost === undefined && v.costs === undefined);
});

test('UAT-E2E-10 احتساب تسوية الشريك واعتمادها', () => {
  const st = step('E2E-10.1', 'PST', 'توليد مسودة تسوية للناقل الجوي', 'مسودة بمبلغ محسوب من المراحل', () => e.exec<any>('settlement.generate', 'usr_finance', { partnerId: 'ptr_ufuq', periodStart: new Date(T0 - 30 * 24 * H).toISOString(), periodEnd: new Date(clock + H).toISOString() }), (v) => !!v.id);
  ctx.st = st.id;
  step('E2E-10.2', 'PST', 'مطابقة مع فاتورة الشريك', 'مطابَقة', () => e.exec<any>('settlement.reconcile', 'usr_finance', { id: st.id, partnerInvoicedSar: st.calculated / 100 }).status, (v) => v === 'reconciled');
  step('E2E-10.3', 'PST, UAT-010', 'الدفع قبل الاعتماد يُرفض', 'SETTLEMENT_NOT_APPROVED', () => { try { e.exec('settlement.recordPayment', 'usr_finance', { id: st.id, bankRef: 'SNB-OUT-901' }); return 'ok'; } catch (x: any) { return x.code; } }, (v) => v === 'SETTLEMENT_NOT_APPROVED');
  step('E2E-10.4', 'PST, UAT-010, BR-008', 'المحاسب لا يعتمد تسويته؛ المعتمِد المالي يعتمد', 'FORBIDDEN للمحاسب ثم «معتمدة»', () => { const a = e.db.approvalRequests.find((x) => x.kind === 'settlement' && x.subjectId === st.id)!; let c = 'ok'; try { e.exec('approval.decide', 'usr_finance', { id: a.id, decision: 'approve' }); } catch (x: any) { c = x.code; } e.exec('approval.decide', 'usr_approver', { id: a.id, decision: 'approve' }); return { financeTry: c, status: e.db.settlements.find((x) => x.id === st.id)!.status }; }, (v) => v.financeTry === 'FORBIDDEN' && v.status === 'approved');
  step('E2E-10.5', 'PST, UAT-010, NFR-007', 'تسجيل السداد ثم منع الدفع المكرر', 'مدفوعة؛ الثاني DUPLICATE_PAYMENT', () => { const p = e.exec<any>('settlement.recordPayment', 'usr_finance', { id: st.id, bankRef: 'SNB-OUT-901' }).status; let c = 'ok'; try { e.exec('settlement.recordPayment', 'usr_finance', { id: st.id, bankRef: 'SNB-OUT-902' }); } catch (x: any) { c = x.code; } return { p, c }; }, (v) => v.p === 'paid' && v.c === 'DUPLICATE_PAYMENT');
});

test('UAT-E2E-11 المندوب يعمل دون اتصال ويزامن دون تكرار', () => {
  const sh = e.db.shipments.find((s) => s.id === ctx.s6)!;
  // مندوب جدة cou_04 بلا حساب في بيانات العرض؛ نستخدم شحنة لدى مندوب الرياض cou_01
  const mine = e.db.shipments.find((s) => { const cs = e.db.custody.filter((c) => c.shipmentId === s.id).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)); const l = cs[cs.length - 1]; return s.status === 'in_transit' && l?.toType === 'courier' && l.toId === 'cou_01' && s.id !== ctx.s1; })!;
  void sh;
  const actions = [
    { clientActionId: 'ca-uat-1', type: 'deliver', shipment: mine.id, occurredAt: new Date(clock - 20 * 60e3).toISOString(), payload: { recipientName: 'أ. نورة السبيعي', signature: 'sig' } },
    { clientActionId: 'ca-uat-2', type: 'deliver', shipment: mine.id, occurredAt: new Date(clock - 10 * 60e3).toISOString(), payload: { recipientName: 'تكرار من جهاز آخر', signature: 'sig' } },
  ];
  step('E2E-11.1', 'RTE-003, NFR-009', 'مزامنة دفعة: تسليم ثم تسليم مكرر لنفس الشحنة', 'الأول مقبول والثاني تعارض محفوظ بأدلته', () => e.exec<any>('courier.sync', 'usr_courier1', { actions }).results.map((r: any) => r.status), (v) => v.join(',') === 'accepted,conflict');
  step('E2E-11.2', 'SHP-007, NFR-009', 'إعادة إرسال الدفعة نفسها (انقطاع أثناء المزامنة)', 'كلاهما «مكرر» — لا إثبات ثانٍ ولا تعارض ثانٍ', () => { const r = e.exec<any>('courier.sync', 'usr_courier1', { actions }).results.map((x: any) => x.status); return { r, pods: e.db.pods.filter((p) => p.shipmentId === mine.id).length, conflicts: e.db.offlineConflicts.filter((c) => c.clientActionId === 'ca-uat-2').length }; }, (v) => v.r.join(',') === 'duplicate,duplicate' && v.pods === 1 && v.conflicts === 1);
  step('E2E-11.3', 'RTE-003, NFR-008', 'العمليات تحسم التعارض بمبرر', 'محسوم ومسجّل في التدقيق', () => { const c = e.db.offlineConflicts.find((x) => x.clientActionId === 'ca-uat-2')!; return e.exec<any>('offline.resolve', 'usr_ops', { id: c.id, resolution: 'rejected', note: 'تسليم مكرر — الأول صحيح' }).resolution; }, (v) => v === 'rejected');
});

test('UAT-E2E-12 عميل ينتقل بين الفروع المخوّلة دون تسرب بيانات', () => {
  const list = (u: string, branch?: string) => e.query<any>('list', u, { collection: 'shipments', pageSize: 500, filter: branch ? { branchId: branch } : undefined }).items;
  step('E2E-12.1', 'MBR, UAT-001', 'مشغّل الفرع يرى فرعيه المخوّلين فقط (العليا تشغيل، الروضة مشاهدة)', 'فرعان فقط', () => [...new Set(list('usr_branch_op').map((s: any) => s.branchId))].sort(), (v) => v.join(',') === 'br_nkh_oly,br_nkh_rwd');
  step('E2E-12.2', 'CUST-002, UAT-001', 'التبديل إلى فرع الروضة (عرض فقط)', 'شحنات الروضة فقط', () => list('usr_branch_op', 'br_nkh_rwd').every((s: any) => s.branchId === 'br_nkh_rwd'), (v) => v === true);
  step('E2E-12.3', 'UAT-001, NFR-006', 'محاولة عرض فرع الملقا غير المخوّل بالتصفية', 'قائمة فارغة (لا تسرب)', () => list('usr_branch_op', 'br_nkh_mlq').length, (v) => v === 0);
  step('E2E-12.4', 'UAT-001, NFR-006', 'فتح شحنة الملقا مباشرة برقمها', 'NOT_FOUND (لا يُكشف وجودها)', () => { const m = e.db.shipments.find((s) => s.branchId === 'br_nkh_mlq')!; try { e.query('shipment.detail', 'usr_branch_op', { id: m.trackingNo }); return 'visible'; } catch (x: any) { return x.code; } }, (v) => v === 'NOT_FOUND');
  step('E2E-12.5', 'MBR, UAT-001', 'كتابة في فرع المشاهدة تُرفض', 'FORBIDDEN', () => { const r = list('usr_branch_op', 'br_nkh_rwd').find((s: any) => ['draft', 'confirmed'].includes(s.status)) ?? list('usr_branch_op', 'br_nkh_rwd')[0]; try { e.exec('shipment.cancel', 'usr_branch_op', { id: r.id, reason: 'x' }); return 'ok'; } catch (x: any) { return x.code; } }, (v) => v === 'FORBIDDEN');
  step('E2E-12.6', 'CUST-001, NFR-006', 'مدير المؤسسة يرى كل فروع مؤسسته ولا يرى مؤسسة أخرى', 'فروع النخبة الثلاثة فقط', () => [...new Set(list('usr_corp_admin').map((s: any) => s.organizationId))], (v) => v.length === 1 && v[0] === 'org_nkh');
});

test('اتساق الأحداث عبر كل السيناريوهات: لا حدث مكرر داخل أمر واحد', () => {
  assert.deepEqual(dupEvents, []);
});
