// سيناريوهات العرض S01..S12 — خطوات قابلة للتشغيل بنفس الأوامر التي تستخدمها الواجهات
// كل خطوة تُنفّذ بحساب دور محدد، لإثبات انتقال الحالة بين الإدارة والعميل والمندوب.
import type { Db, Shipment } from './types';

export interface ScenarioApi { exec<R = any>(as: string, cmd: string, input?: unknown): R; query<R = any>(as: string, q: string, p?: unknown): R; db(): Db; now(): number }
export interface Step { as: string; expectError?: string; title: { ar: string; en: string }; run(api: ScenarioApi, ctx: Record<string, any>): unknown }
export interface Scenario { id: string; title: { ar: string; en: string }; proves: { ar: string; en: string }; uat: string[]; steps: Step[] }

const L = (ar: string, en: string) => ({ ar, en });
const H = 3600_000;
const addr = (db: Db, branchId: string) => db.addresses.find((a) => a.branchId === branchId)!;
const readyBox = (api: ScenarioApi, tc: string) => api.query<any>('usr_ops', 'dispatch.board', {}).boxes.find((b: any) => b.thermalClass === tc && b.status === 'available' && b.readiness.ready);
const lastCustody = (db: Db, id: string) => db.custody.filter((c) => c.shipmentId === id).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).pop();

export const SCENARIOS: Scenario[] = [
  {
    id: 'S01', title: L('شحنة مبرّدة من فرع العليا إلى المختبر المرجعي', 'Chilled shipment from Olaya to the reference lab'), uat: ['UAT-003'],
    proves: L('دورة حياة كاملة عبر العميل والعمليات والمندوب والمختبر المستلم', 'Full lifecycle across customer, operations, courier and receiving lab'),
    steps: [
      { as: 'usr_branch_op', title: L('العميل ينشئ الطلب ويؤكده', 'Customer creates and confirms the request'), run(api, c) {
        const db = api.db(); const s = api.exec<Shipment>('usr_branch_op', 'shipment.create', { organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: addr(db, 'br_nkh_oly').id, receiverAddressId: addr(db, 'br_nrl_main').id, receiverOrgId: 'org_nrl', thermalClass: 'chilled', serviceLevel: 'express', pickupWindowStart: new Date(api.now() + 0.5 * H).toISOString(), pickupWindowEnd: new Date(api.now() + 2.5 * H).toISOString(), items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 4, weightKg: 1.2 }] });
        c.id = s.id; c.tracking = s.trackingNo; return { trackingNo: s.trackingNo, status: s.status, priceSAR: s.priceTotal / 100 }; } },
      { as: 'usr_ops', title: L('العمليات تسند المندوب وصندوقاً جاهزاً', 'Operations assign courier and a ready box'), run(api, c) { const b = readyBox(api, 'chilled'); c.box = b.code; api.exec('usr_ops', 'dispatch.assign', { shipmentId: c.id, courierId: 'cou_01', boxId: b.id }); return { courier: 'cou_01', box: b.code }; } },
      { as: 'usr_courier1', title: L('المندوب يمسح الشحنة والصندوق', 'Courier scans shipment and box'), run(api, c) { return api.exec<any>('usr_courier1', 'courier.scanPack', { shipment: c.tracking, boxCode: c.box }).box.code; } },
      { as: 'usr_courier1', title: L('الاستلام بتوقيع وبدء النقل', 'Signed pickup and start transit'), run(api, c) { api.exec('usr_courier1', 'courier.pickup', { shipment: c.id, signedBy: 'م. سارة العتيبي' }); return api.exec<Shipment>('usr_courier1', 'courier.startTransit', { shipment: c.id }).status; } },
      { as: 'usr_courier1', title: L('التسليم مع إثبات', 'Delivery with proof'), run(api, c) { return api.exec<Shipment>('usr_courier1', 'courier.deliver', { shipment: c.id, recipientName: 'د. ليلى الحمدان', signature: 'sig-demo' }).status; } },
      { as: 'usr_lab', title: L('المختبر المستلم يسجّل قراره السريري', 'Receiving lab records its clinical decision'), run(api, c) { return api.exec<any>('usr_lab', 'disposition.record', { shipment: c.id, decision: 'accepted', authorizedContact: 'د. ليلى الحمدان' }).decision; } },
      { as: 'usr_corp_admin', title: L('العميل يرى التسليم والإثبات والقرار', 'Customer sees delivery, proof and decision'), run(api, c) { const d = api.query<any>('usr_corp_admin', 'shipment.detail', { id: c.id }); return { status: d.shipment.status, pod: d.pod?.recipientName, disposition: d.disposition?.decision, timelineEvents: d.timeline.length }; } },
    ],
  },
  {
    id: 'S02', title: L('صندوق مشترك لعميلين', 'Shared box, two customers'), uat: ['UAT-002'], proves: L('كل عميل يرى شحنته فقط والعمليات ترى الصندوق كاملاً', 'Each customer sees only its shipment; operations sees the whole box'),
    steps: [
      { as: 'usr_ops', title: L('العمليات: محتوى الصندوق BX-CM-002', 'Operations: contents of BX-CM-002'), run(api) { return api.query<any>('usr_ops', 'box.detail', { id: 'BX-CM-002' }).packings.filter((p: any) => !p.unpackedAt).map((p: any) => `${p.trackingNo} — ${p.organization.ar}`); } },
      { as: 'usr_corp_admin', title: L('النخبة: ترى رمز الصندوق دون الشحنات الأخرى', 'Al-Nukhba: sees box code but no other shipments'), run(api, c) { const db = api.db(); const own = db.packings.find((p) => p.boxId === 'box_002' && !p.unpackedAt && db.shipments.find((s) => s.id === p.shipmentId)!.organizationId === 'org_nkh')!; c.other = db.packings.find((p) => p.boxId === 'box_002' && !p.unpackedAt && p.shipmentId !== own.shipmentId)!.shipmentId; const d = api.query<any>('usr_corp_admin', 'shipment.detail', { id: own.shipmentId }); return { box: d.box, coPackedVisible: d.box.coPacked !== undefined }; } },
      { as: 'usr_corp_admin', expectError: 'NOT_FOUND', title: L('محاولة فتح شحنة العميل الآخر', 'Attempt to open the other customer’s shipment'), run(api, c) { return api.query('usr_corp_admin', 'shipment.detail', { id: c.other }); } },
    ],
  },
  {
    id: 'S03', title: L('انحراف حراري من الإنذار إلى الإجراء التصحيحي والوقائي (CAPA)', 'Temperature excursion from alert to CAPA'), uat: ['UAT-004'], proves: L('القراءة خارج النطاق تفتح انحرافاً حرارياً يظهر في مركز مراقبة العمليات وسير عمل الجودة', 'An out-of-range reading opens an excursion seen by the tower and quality'),
    steps: [
      { as: 'usr_iot', title: L('قراءة تجريبية 11.8 °م على صندوق مبرّد نشط', 'Demo reading of 11.8 °C on an active chilled box'), run(api, c) { const db = api.db(); const p = db.packings.find((x) => !x.unpackedAt && ['box_001', 'box_003', 'box_005', 'box_006', 'box_008'].includes(x.boxId) && db.shipments.find((s) => s.id === x.shipmentId)!.status === 'in_transit')!; c.ship = p.shipmentId; const dev = db.pairings.find((x) => x.boxId === p.boxId && !x.unpairedAt)!.deviceId; api.exec('usr_iot', 'telemetry.injectDemo', { device: dev, tempC: 11.8 }); c.exc = api.db().excursions.at(-1)!.id; return { excursion: c.exc, shipment: db.shipments.find((s) => s.id === c.ship)!.trackingNo }; } },
      { as: 'usr_ops', title: L('يظهر في مركز مراقبة العمليات والعمليات تُقرّ به', 'Appears in the tower; operations acknowledge'), run(api, c) { const seen = api.query<any>('usr_ops', 'controlTower.summary', {}).alerts.some((a: any) => a.id === c.exc); api.exec('usr_ops', 'excursion.acknowledge', { id: c.exc }); return { inTower: seen, status: 'acknowledged' }; } },
      { as: 'usr_quality', title: L('الجودة تراجع وتفتح حادثة جودة', 'Quality reviews and opens an incident'), run(api, c) { const e = api.exec<any>('usr_quality', 'excursion.qualityReview', { id: c.exc, decision: 'انحراف رئيسي أثناء توقف المسار؛ فتح تحقيق', openIncident: true }); c.inc = e.incidentId; return e.status; } },
      { as: 'usr_quality', title: L('إضافة إجراء تصحيحي ووقائي (CAPA)', 'Add a CAPA action'), run(api, c) { return api.exec<any>('usr_quality', 'capa.create', { incidentId: c.inc, actionType: 'corrective', description: 'تقليص زمن فتح الصندوق في نقاط التوقف', ownerId: 'usr_ops', dueAt: new Date(api.now() + 7 * 24 * H).toISOString() }).status; } },
      { as: 'usr_corp_admin', title: L('العميل يرى الانحراف في تقرير الأدلة', 'Customer sees the excursion in the evidence report'), run(api, c) { const db = api.db(); const sh = db.shipments.find((s) => s.id === c.ship)!; const owner = sh.organizationId === 'org_nkh' ? 'usr_corp_admin' : null; return owner ? api.query<any>('usr_corp_admin', 'shipment.temperatureReport', { id: c.ship }).excursions : { note: 'الشحنة لعميل آخر — يُعرض للعمليات', excursions: api.query<any>('usr_ops', 'shipment.temperatureReport', { id: c.ship }).excursions.length }; } },
    ],
  },
  {
    id: 'S05', title: L('صندوق غير جاهز واستثناء خاضع للضوابط', 'Box not ready and a controlled exception'), uat: ['UAT-007'], proves: L('المنع التلقائي للإسناد، والاستثناء باعتماد الجودة، مع بقاء الضوابط الإلزامية', 'Automatic block, quality-approved exception, mandatory safeguards stay'),
    steps: [
      { as: 'usr_branch_op', title: L('طلب جديد', 'New request'), run(api, c) { const db = api.db(); const s = api.exec<Shipment>('usr_branch_op', 'shipment.create', { organizationId: 'org_nkh', branchId: 'br_nkh_oly', senderAddressId: addr(db, 'br_nkh_oly').id, receiverAddressId: addr(db, 'br_nrl_main').id, thermalClass: 'chilled', serviceLevel: 'standard', pickupWindowStart: new Date(api.now() + H).toISOString(), pickupWindowEnd: new Date(api.now() + 3 * H).toISOString(), items: [{ descriptionCode: 'SERUM_ALIQUOT', quantity: 2, weightKg: 0.8 }] }); c.id = s.id; return s.trackingNo; } },
      { as: 'usr_ops', expectError: 'BOX_NOT_READY', title: L('إسناد BX-CS-010 (بطارية 14%) — يُرفض', 'Assign BX-CS-010 (battery 14%) — blocked'), run(api, c) { return api.exec('usr_ops', 'dispatch.assign', { shipmentId: c.id, courierId: 'cou_01', boxId: 'box_010' }); } },
      { as: 'usr_ops', expectError: 'EXCEPTION_NOT_PERMITTED', title: L('استثناء على BX-CS-013 المعطل — غير مسموح', 'Exception on faulty BX-CS-013 — not permitted'), run(api, c) { return api.exec('usr_ops', 'dispatch.requestException', { shipmentId: c.id, boxId: 'box_013', reason: 'عاجل' }); } },
      { as: 'usr_ops', title: L('طلب استثناء مبرر لـ BX-CS-010', 'Justified exception request for BX-CS-010'), run(api, c) { c.apr = api.exec<any>('usr_ops', 'dispatch.requestException', { shipmentId: c.id, boxId: 'box_010', reason: 'لا صندوق مبرّد آخر في الفرع؛ الرحلة 40 دقيقة' }).id; return c.apr; } },
      { as: 'usr_quality', title: L('الجودة تعتمد الاستثناء', 'Quality approves the exception'), run(api, c) { return api.exec<any>('usr_quality', 'approval.decide', { id: c.apr, decision: 'approve' }).status; } },
      { as: 'usr_ops', title: L('الإسناد ينجح بالاستثناء المعتمد', 'Assignment succeeds with the approved exception'), run(api, c) { return api.exec<any>('usr_ops', 'dispatch.assign', { shipmentId: c.id, courierId: 'cou_01', boxId: 'box_010', exceptionApprovalId: c.apr }).shipment.status; } },
    ],
  },
  {
    id: 'S06', title: L('تعذّر التسليم والإرجاع', 'Failed delivery and return'), uat: ['UAT-008'], proves: L('قرار مخوّل وتحميل التكلفة للطرف المسؤول واستمرار الحيازة', 'Authorized decision, cost to responsible party, custody continuity'),
    steps: [
      { as: 'usr_ops', title: L('قرار الإرجاع على حساب العميل', 'Return decision billed to the customer'), run(api, c) { const f = api.db().shipments.find((s) => s.status === 'failed')!; c.id = f.id; c.ret = api.exec<any>('usr_ops', 'returns.authorize', { shipment: f.id, decision: 'return_to_sender', responsibleParty: 'customer' }).id; return f.trackingNo; } },
      { as: 'usr_ops', title: L('إتمام الإرجاع بتوقيع', 'Complete the return with signature'), run(api, c) { return api.exec<any>('usr_ops', 'returns.complete', { returnId: c.ret, signedBy: 'مكتب الاستقبال' }).status; } },
      { as: 'usr_finance', title: L('رسم الإرجاع ينتظر الفوترة', 'Return fee awaits invoicing'), run(api, c) { return api.db().invoiceLines.filter((l) => l.invoiceId === 'pending' && l.shipmentId === c.id).map((l) => l.description.ar); } },
    ],
  },
  {
    id: 'S07', title: L('شحنة مفقودة ثم مستردة', 'Lost then recovered'), uat: ['UAT-009'], proves: L('الاعتماد المشترك إلزامي، والاسترداد لا يمحو الإعلان', 'Joint approval required; recovery keeps the declaration'),
    steps: [
      { as: 'usr_ops', title: L('العمليات تعتمد الإعلان', 'Operations approve the declaration'), run(api, c) { const s = api.db().shipments.find((x) => x.lostState === 'suspected')!; c.id = s.id; return api.exec<Shipment>('usr_ops', 'lost.approve', { shipment: s.id, decision: 'approve' }).lostState; } },
      { as: 'usr_quality', title: L('الجودة تعتمد ← أُعلن فقدان الشحنة', 'Quality approves → declared lost'), run(api, c) { return api.exec<Shipment>('usr_quality', 'lost.approve', { shipment: c.id, decision: 'approve' }).lostState; } },
      { as: 'usr_ops', title: L('تسجيل الاسترداد', 'Record recovery'), run(api, c) { return api.exec<Shipment>('usr_ops', 'lost.recover', { shipment: c.id, note: 'وُجدت في نقطة تسليم الدمام', signedBy: 'أ. عمر الجهني' }).lostState; } },
      { as: 'usr_ops', title: L('سجل الإعلان ما زال محفوظاً', 'Declaration record is still there'), run(api, c) { return api.db().statusEvents.filter((e) => e.shipmentId === c.id && /فقدان/.test(e.reason)).map((e) => e.reason); } },
    ],
  },
  {
    id: 'S08', title: L('فاتورة ودفع إلكتروني', 'Invoice and online payment'), uat: ['UAT-011'], proves: L('الفاتورة تظهر للعميل والدفع يرحّل قيداً متوازناً', 'Invoice reaches the customer; payment posts a balanced entry'),
    steps: [
      { as: 'usr_finance', title: L('توليد مسودة من الشحنات المسلّمة', 'Draft from delivered shipments'), run(api, c) { const inv = api.exec<any>('usr_finance', 'invoice.generate', { organizationId: 'org_nkh', periodFrom: new Date(api.now() - 3 * 24 * H).toISOString(), periodTo: new Date(api.now() + H).toISOString() }); c.inv = inv.id; return { invoiceNo: inv.invoiceNo, totalSAR: inv.total / 100 }; } },
      { as: 'usr_finance', title: L('إصدار الفاتورة (ربط ZATCA محاكى) وترحيل القيد', 'Issue (ZATCA simulated) and post'), run(api, c) { return api.exec<any>('usr_finance', 'invoice.issue', { id: c.inv }).zatcaStatus; } },
      { as: 'usr_corp_finance', title: L('مالية العميل تدفع (مزود محاكى)', 'Customer finance pays (simulated provider)'), run(api, c) { return api.exec<any>('usr_corp_finance', 'customer.payInvoice', { invoiceId: c.inv, method: 'card_simulated' }).invoice.status; } },
      { as: 'usr_finance', title: L('ميزان المراجعة متوازن وأرصدة الذمم المدينة مطابقة', 'Trial balance balanced, AR reconciled'), run(api) { const tb = api.query<any>('usr_finance', 'ledger.trialBalance', {}); return { balanced: tb.balanced, arReconciled: tb.arReconciled }; } },
    ],
  },
  {
    id: 'S09', title: L('تسوية شريك', 'Partner settlement'), uat: ['UAT-010'], proves: L('الاعتماد ليس دفعاً، والدفع المكرر مرفوض', 'Approval is not payment; duplicate payment refused'),
    steps: [
      { as: 'usr_finance', expectError: 'SETTLEMENT_NOT_APPROVED', title: L('محاولة دفع قبل الاعتماد', 'Pay before approval'), run(api, c) { const s = api.db().settlements.find((x) => x.status === 'reconciled')!; c.id = s.id; return api.exec('usr_finance', 'settlement.recordPayment', { id: s.id, bankRef: 'SNB-OUT-77' }); } },
      { as: 'usr_approver', title: L('المعتمِد المالي يعتمد', 'Finance approver approves'), run(api, c) { const a = api.db().approvalRequests.find((x) => x.kind === 'settlement' && x.subjectId === c.id)!; return api.exec<any>('usr_approver', 'approval.decide', { id: a.id, decision: 'approve' }).status; } },
      { as: 'usr_finance', title: L('تسجيل السداد', 'Record payment'), run(api, c) { return api.exec<any>('usr_finance', 'settlement.recordPayment', { id: c.id, bankRef: 'SNB-OUT-77' }).status; } },
      { as: 'usr_finance', expectError: 'DUPLICATE_PAYMENT', title: L('محاولة دفع ثانية', 'Second payment attempt'), run(api, c) { return api.exec('usr_finance', 'settlement.recordPayment', { id: c.id, bankRef: 'SNB-OUT-78' }); } },
    ],
  },
  {
    id: 'S10', title: L('محاكاة تسعير', 'Pricing simulation'), uat: ['UAT-012'], proves: L('لا أثر على الأسعار أو الفواتير الفعلية', 'No effect on live prices or invoices'),
    steps: [
      { as: 'usr_finance', title: L('محاكاة +8% على المجمّد', 'Simulate +8% on frozen'), run(api, c) { c.before = JSON.stringify([api.db().ratePlans, api.db().invoices.length, api.db().journals.length]); const s = api.exec<any>('usr_finance', 'simulation.run', { name: 'مجمّد +8%', adjustments: [{ thermalClass: 'frozen', pct: 8 }] }); return { currentSAR: s.result.currentRevenue / 100, proposedSAR: s.result.proposedRevenue / 100, liveChangesApplied: s.liveChangesApplied }; } },
      { as: 'usr_finance', title: L('التحقق: البيانات الفعلية لم تتغير', 'Check: live state unchanged'), run(api, c) { return { unchanged: c.before === JSON.stringify([api.db().ratePlans, api.db().invoices.length, api.db().journals.length]) }; } },
    ],
  },
  {
    id: 'S11', title: L('انتهاء ترخيص ناقل', 'Carrier license expiry'), uat: ['UAT-013'], proves: L('حظر الإسناد الجديد وتصعيد الشحنات النشطة', 'New assignments blocked; active shipments escalated'),
    steps: [
      { as: 'usr_compliance', title: L('تشغيل فحص الانتهاء (ترخيص خطوط الساحل منتهٍ)', 'Run expiry check (Sahil license expired)'), run(api) { return api.exec('usr_compliance', 'compliance.runExpiryCheck', {}); } },
      { as: 'usr_ops', expectError: 'ELIGIBILITY_BLOCKED', title: L('محاولة إسناد مندوب الساحل', 'Try to assign the Sahil courier'), run(api) { const s = api.db().shipments.find((x) => x.status === 'confirmed')!; return api.exec('usr_ops', 'dispatch.assign', { shipmentId: s.id, courierId: 'cou_09' }); } },
    ],
  },
  {
    id: 'S12', title: L('مندوب دون اتصال', 'Offline courier'), uat: ['NFR-009'], proves: L('المزامنة تقبل الصحيح وتحفظ التعارض بأدلته', 'Sync accepts valid actions and records conflicts with evidence'),
    steps: [
      { as: 'usr_courier1', title: L('مزامنة تسليمين للشحنة نفسها', 'Sync two deliveries of the same shipment'), run(api) { const db = api.db(); const s = db.shipments.find((x) => x.status === 'in_transit' && lastCustody(db, x.id)?.toType === 'courier' && lastCustody(db, x.id)?.toId === 'cou_01')!; return api.exec<any>('usr_courier1', 'courier.sync', { actions: [{ clientActionId: `off-${api.now()}-a`, type: 'deliver', shipment: s.id, occurredAt: new Date(api.now() - 600_000).toISOString(), payload: { recipientName: 'مكتب الاستقبال', signature: 'sig' } }, { clientActionId: `off-${api.now()}-b`, type: 'deliver', shipment: s.id, occurredAt: new Date(api.now() - 300_000).toISOString(), payload: { recipientName: 'شخص آخر', signature: 'sig' } }] }).results.map((r: any) => `${r.status}: ${r.message.ar}`); } },
    ],
  },
];
