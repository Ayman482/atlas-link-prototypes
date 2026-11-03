// Phase 17.1 — الفاتورة الضريبية والملفات الحرارية المعتمدة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, decodeTlvBase64, SELLER, resolveProfile } from '../packages/core/src/index';

const T0 = Date.parse('2026-11-04T06:00:00Z');
const fresh = (at = T0) => { let clock = at; const e = new Engine(null, { clock: () => clock }); return { e, db: e.db as any, tick: (ms: number) => { clock += ms; } }; };

test('مستند الفاتورة: الأطراف والأرقام الضريبية والمجاميع متسقة مع الفاتورة وبنودها', () => {
  const { e, db } = fresh();
  for (const inv of db.invoices.filter((i: any) => i.status !== 'draft')) {
    const d = e.query<any>('invoice.document', 'usr_finance', { id: inv.id });
    assert.match(d.seller.vatNumber, /^3\d{13}3$/, 'رقم ضريبي للبائع 15 رقماً يبدأ وينتهي بـ 3');
    if (d.buyer.vatNumber) assert.match(d.buyer.vatNumber, /^3\d{13}3$/, `رقم المشتري ${d.buyer.vatNumber}`);
    const taxable = d.lines.reduce((a: number, l: any) => a + l.taxable, 0); const vat = d.lines.reduce((a: number, l: any) => a + l.vat, 0);
    assert.equal(taxable, inv.subtotal, `${inv.invoiceNo} الخاضع للضريبة`); assert.equal(vat, inv.vat); assert.equal(d.totals.total, inv.subtotal + inv.vat);
    assert.equal(d.totals.gross - d.totals.discount, d.totals.taxable);
    for (const l of d.lines) assert.equal(l.taxable, l.qty * l.unitPrice - l.discount);
    assert.equal(d.totals.balance, Math.max(0, inv.total - inv.paid - d.totals.credited));
    assert.equal(d.zatca.simulated, true);
  }
});

test('رمز QR: ترميز TLV للوسوم 1–5 يُفك إلى البائع والرقم الضريبي والوقت والمجموع والضريبة', () => {
  const { e, db } = fresh(); const inv = db.invoices.find((i: any) => i.invoiceNo === 'INV-2026-00001');
  const d = e.query<any>('invoice.document', 'usr_finance', { id: inv.id });
  const tags = decodeTlvBase64(d.zatca.qrBase64);
  assert.deepEqual(tags.map((t) => t.tag), [1, 2, 3, 4, 5]);
  assert.equal(tags[0].value, SELLER.legalName.ar); assert.equal(tags[1].value, SELLER.vatNumber);
  assert.match(tags[2].value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.equal(tags[3].value, (inv.total / 100).toFixed(2)); assert.equal(tags[4].value, (inv.vat / 100).toFixed(2));
  assert.match(d.zatca.note.ar, /محاكاة/); assert.match(d.zatca.note.en, /not claimed to be compliant/);
});

test('فاتورة متعددة الصفحات بخصم: 26 بنداً والخصم يُطرح قبل الضريبة', () => {
  const { e, db } = fresh(); const inv = db.invoices.find((i: any) => i.organizationId === 'org_gnm' && i.periodFrom.startsWith('2026-10-01'));
  const d = e.query<any>('invoice.document', 'usr_finance', { id: inv.id });
  assert.equal(d.lines.length, 26); assert.ok(d.totals.discount > 0);
  assert.equal(d.totals.vat, d.lines.reduce((a: number, l: any) => a + Math.round(l.taxable * 0.15), 0));
});

test('عزل الوصول للفاتورة: العميل يرى فواتير مؤسسته فقط، ولا مسودات، والمندوب لا شيء', () => {
  const { e, db } = fresh();
  const own = db.invoices.find((i: any) => i.organizationId === 'org_nkh' && i.status !== 'draft');
  const other = db.invoices.find((i: any) => i.organizationId !== 'org_nkh' && i.status !== 'draft');
  assert.ok(e.query('invoice.document', 'usr_corp_admin', { id: own.id }));
  assert.throws(() => e.query('invoice.document', 'usr_corp_admin', { id: other.id }), /NOT_FOUND/);
  assert.throws(() => e.query('invoice.document', 'usr_courier1', { id: own.id }), /NOT_FOUND/);
  assert.throws(() => e.query('invoice.document', 'usr_branch_op', { id: own.id }), /NOT_FOUND/, 'مشغّل الفرع بلا صلاحية مالية');
  const draft = e.exec<any>('invoice.generate', 'usr_finance', { organizationId: 'org_nkh', periodFrom: '2026-01-01T00:00:00Z', periodTo: new Date(T0).toISOString() });
  assert.ok(e.query('invoice.document', 'usr_finance', { id: draft.id }), 'المالية الداخلية تعاين المسودة');
  assert.throws(() => e.query('invoice.document', 'usr_corp_admin', { id: draft.id }), /NOT_FOUND/);
});

test('الملف الحراري الافتراضي للمبرّد +4 إلى +8 °م، وملف +2 إلى +8 °م غير مطبَّق على أي شحنة', () => {
  const { db } = fresh();
  const def = resolveProfile(db, { thermalClass: 'chilled' }, T0);
  assert.equal(def.minC, 4); assert.equal(def.maxC, 8);
  const active28 = db.serviceProfiles.filter((p: any) => p.minC === 2 && p.maxC === 8 && p.status === 'active');
  assert.deepEqual(active28, []);
  assert.equal(db.shipments.filter((s: any) => db.serviceProfiles.find((p: any) => p.id === s.serviceProfileId)?.minC === 2).length, 0);
});

test('ملف حراري لاتفاقية خدمة: لا يسري قبل اعتماد الامتثال وتاريخ البدء، والجودة لا تعتمد اقتراحها (فصل المهام)', () => {
  const { e, db, tick } = fresh();
  const org = db.organizations.find((o: any) => o.code === 'DQA'); const a = db.addresses.find((x: any) => x.organizationId === org.id); const b = db.addresses.find((x: any) => x.organizationId && x.organizationId !== org.id && x.cityCode === a.cityCode);
  const mk = () => e.exec<any>('shipment.create', 'usr_ops', { organizationId: org.id, branchId: a.branchId, senderAddressId: a.id, receiverAddressId: b.id, thermalClass: 'chilled', serviceLevel: 'standard', pickupWindowStart: new Date(T0 + 864e5 * 9).toISOString(), pickupWindowEnd: new Date(T0 + 864e5 * 9 + 72e5).toISOString(), items: [{ descriptionCode: 'BLOOD_TUBES', quantity: 1, weightKg: 0.5 }] }).serviceProfileId;
  assert.equal(mk(), 'svc_chilled_v2', 'المقترح بانتظار الاعتماد لا يؤثر');
  const apr = db.approvalRequests.find((x: any) => x.subjectId === 'svc_chilled_dqa_v1');
  assert.throws(() => e.exec('approval.decide', 'usr_quality', { id: apr.id, decision: 'approve' }), /FORBIDDEN/);
  e.exec('approval.decide', 'usr_compliance', { id: apr.id, decision: 'approve' });
  assert.equal(mk(), 'svc_chilled_v2', 'قبل تاريخ بدء السريان');
  tick(864e5 * 8);
  assert.equal(mk(), 'svc_chilled_dqa_v1', 'بعد الاعتماد وتاريخ البدء: ملف الاتفاقية');
  const nkh = db.organizations.find((o: any) => o.code === 'NKH'); assert.equal(resolveProfile(db, { thermalClass: 'chilled', organizationId: nkh.id }, T0 + 864e5 * 8).id, 'svc_chilled_v2', 'العملاء الآخرون على الافتراضي');
});

test('اقتراح ملف حسب نوع العينة يُطبّق فقط حين تكون كل عينات الشحنة من النوع المشمول', () => {
  const { e, db } = fresh();
  const p = e.exec<any>('profile.propose', 'usr_quality', { thermalClass: 'frozen', nameAr: 'مجمّد لعينات المصل', nameEn: 'Frozen for serum', minC: -30, maxC: -15, toleranceMinutes: 10, sampleTypes: ['SERUM_ALIQUOT'], effectiveFrom: new Date(T0).toISOString(), basis: 'قرار الجودة رقم تجريبي' });
  assert.throws(() => e.exec('profile.propose', 'usr_quality', { thermalClass: 'frozen', nameAr: 'x', nameEn: 'x', minC: -30, maxC: -15, toleranceMinutes: 10, sampleTypes: ['SERUM_ALIQUOT'], effectiveFrom: new Date(T0).toISOString(), basis: 'x' }), /PENDING_EXISTS/);
  assert.throws(() => e.exec('profile.propose', 'usr_quality', { thermalClass: 'frozen', nameAr: 'x', nameEn: 'x', minC: -10, maxC: -20, toleranceMinutes: 10, effectiveFrom: new Date(T0).toISOString(), basis: 'x' }), /VALIDATION/);
  const apr = (e.db as any).approvalRequests.find((x: any) => x.subjectId === p.id);
  e.exec('approval.decide', 'usr_compliance', { id: apr.id, decision: 'approve' });
  assert.equal(resolveProfile(e.db as any, { thermalClass: 'frozen', sampleTypes: ['SERUM_ALIQUOT'] }, T0 + 1000).id, p.id);
  assert.notEqual(resolveProfile(e.db as any, { thermalClass: 'frozen', sampleTypes: ['SERUM_ALIQUOT', 'BLOOD_TUBES'] }, T0 + 1000).id, p.id);
});
