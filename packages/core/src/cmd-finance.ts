// العقود والتسعير والفوترة ودفتر الأستاذ والتكاليف وتسويات الشركاء — M05 / BR-007 / BR-008 / E8
import type * as T from './types';
import { defineCommand, must, type Ctx } from './engine';
import { customerOrgIds } from './access';
import { activePlan, price, VAT_PCT } from './pricing';
import { DAY, iso, pct, sar } from './util';

const L = (ar: string, en: string) => ({ ar, en });
const acc = (ctx: Ctx, code: string) => must(ctx, ctx.db.glAccounts.find((a) => a.code === code && a.active), `account ${code}`);

/** محرك الترحيل: يرفض القيد غير المتوازن أو ذي السطر الواحد (DB-AT-005) */
export function validateJournal(ctx: Ctx, lines: T.JournalLine[]) {
  if (!lines || lines.length < 2) ctx.fail('JOURNAL_TOO_FEW_LINES', 'القيد يتطلب سطرين على الأقل', 'Journal requires at least two lines', 422, 'lines');
  for (const l of lines) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit) || l.debit < 0 || l.credit < 0) ctx.fail('JOURNAL_INVALID_AMOUNT', 'المبالغ يجب أن تكون موجبة وبالهللة', 'Amounts must be non-negative halalas', 422, 'lines');
    if ((l.debit > 0) === (l.credit > 0)) ctx.fail('JOURNAL_DEBIT_XOR_CREDIT', 'كل سطر إما مدين أو دائن', 'Each line is either debit or credit', 422, 'lines');
    if (!ctx.db.glAccounts.some((a) => a.id === l.accountId && a.active)) ctx.fail('JOURNAL_UNKNOWN_ACCOUNT', 'حساب غير معروف', 'Unknown account', 422, 'lines');
  }
  const d = lines.reduce((a, l) => a + l.debit, 0), c = lines.reduce((a, l) => a + l.credit, 0);
  if (d !== c) ctx.fail('JOURNAL_UNBALANCED', `القيد غير متوازن: مدين ${(d / 100).toFixed(2)} ≠ دائن ${(c / 100).toFixed(2)}`, `Unbalanced: debit ${(d / 100).toFixed(2)} ≠ credit ${(c / 100).toFixed(2)}`, 422, 'lines');
}
export function postJournal(ctx: Ctx, description: string, sourceType: string, sourceId: string | null, lines: T.JournalLine[]): T.Journal {
  validateJournal(ctx, lines);
  const j: T.Journal = { id: ctx.id('jnl'), journalNo: `JV-2026-${ctx.seq('jv')}`, entryDate: ctx.nowIso, status: 'posted', sourceType, sourceId, description, lines, postedAt: ctx.nowIso, postedBy: ctx.actor.user.id, reversalOfId: null, reversedById: null, createdAt: ctx.nowIso };
  ctx.db.journals.push(j);
  ctx.emit('journal.entry_posted', 'journal', j.id, null, { journalNo: j.journalNo });
  ctx.audit('journal.post', 'journal', j.id, `${j.journalNo} — ${description}`);
  return j;
}

// ---------------- الفوترة ----------------
defineCommand<{ organizationId: string; periodFrom: string; periodTo: string; includeContractFee?: boolean }, T.Invoice>({
  name: 'invoice.generate', guard: ['finance'], desc: L('توليد فاتورة من الشحنات المسلّمة غير المفوترة', 'Generate invoice from uninvoiced delivered shipments'),
  run(ctx, i) {
    const org = must(ctx, ctx.db.organizations.find((o) => o.id === i.organizationId), 'organization');
    const from = Date.parse(i.periodFrom), to = Date.parse(i.periodTo);
    if (!(to > from)) ctx.fail('VALIDATION', 'فترة غير صحيحة', 'Invalid period', 422, 'periodTo');
    const invoiced = new Set(ctx.db.invoiceLines.filter((l) => l.shipmentId && l.invoiceId !== 'pending' && ctx.db.invoices.find((x) => x.id === l.invoiceId)?.status !== 'void').map((l) => l.shipmentId));
    const ships = ctx.db.shipments.filter((s) => s.organizationId === org.id && s.status === 'delivered' && !invoiced.has(s.id) && Date.parse(s.updatedAt) >= from && Date.parse(s.updatedAt) <= to);
    const pending = ctx.db.invoiceLines.filter((l) => l.invoiceId === 'pending' && ctx.db.shipments.find((s) => s.id === l.shipmentId)?.organizationId === org.id);
    const contract = ctx.db.contracts.find((c) => c.organizationId === org.id && c.status === 'active');
    const n = ctx.seq('inv');
    const inv: T.Invoice = { id: `inv_${n}`, invoiceNo: `INV-2026-${n}`, organizationId: org.id, branchId: null, issueDate: null, dueDate: null, periodFrom: iso(from), periodTo: iso(to), subtotal: 0, vat: 0, total: 0, paid: 0, status: 'draft', zatcaStatus: 'not_submitted', journalId: null, createdAt: ctx.nowIso };
    const lines: T.InvoiceLine[] = [];
    if (i.includeContractFee !== false && contract?.monthlyFee) { const v = pct(contract.monthlyFee, VAT_PCT); lines.push({ id: ctx.id('inl'), invoiceId: inv.id, shipmentId: null, description: L(`رسم العقد ${contract.contractNo}`, `Contract fee ${contract.contractNo}`), qty: 1, unitPrice: contract.monthlyFee, vat: v, lineTotal: contract.monthlyFee + v }); }
    for (const s of ships) { const q = ctx.db.quotes.find((x) => x.id === s.quoteId); if (q && q.snapshot.subtotal > 0) lines.push({ id: ctx.id('inl'), invoiceId: inv.id, shipmentId: s.id, description: L(`نقل عينات ${s.trackingNo}`, `Sample transport ${s.trackingNo}`), qty: 1, unitPrice: q.snapshot.subtotal, vat: q.snapshot.vat, lineTotal: q.snapshot.total }); }
    pending.forEach((l) => { l.invoiceId = inv.id; });
    if (!lines.length && !pending.length) ctx.fail('NOTHING_TO_INVOICE', 'لا توجد شحنات أو رسوم غير مفوترة في الفترة', 'No uninvoiced shipments or charges in period', 422);
    ctx.db.invoiceLines.push(...lines);
    const all = [...lines, ...pending];
    inv.subtotal = all.reduce((a, l) => a + l.unitPrice * l.qty, 0); inv.vat = all.reduce((a, l) => a + l.vat, 0); inv.total = inv.subtotal + inv.vat;
    ctx.db.invoices.push(inv);
    ctx.audit('invoice.generate', 'invoice', inv.id, `${inv.invoiceNo} مسودة — ${all.length} بنود`); return inv;
  },
});

defineCommand<{ id: string }, T.Invoice>({
  name: 'invoice.issue', guard: ['finance'], desc: L('إصدار الفاتورة وترحيل القيد (ZATCA محاكاة)', 'Issue invoice and post journal (ZATCA simulated)'),
  run(ctx, { id }) {
    const inv = must(ctx, ctx.db.invoices.find((x) => x.id === id), 'invoice');
    if (inv.status !== 'draft') ctx.fail('INVOICE_NOT_DRAFT', 'الفاتورة صادرة مسبقاً', 'Invoice already issued', 409);
    if (inv.total <= 0) ctx.fail('INVOICE_EMPTY', 'لا يمكن إصدار فاتورة صفرية', 'Cannot issue a zero invoice', 422);
    inv.issueDate = ctx.nowIso; inv.dueDate = iso(ctx.now + 30 * DAY); inv.status = 'issued'; inv.zatcaStatus = 'simulated_cleared';
    inv.journalId = postJournal(ctx, `إصدار فاتورة ${inv.invoiceNo}`, 'invoice', inv.id, [
      { accountId: acc(ctx, '1200').id, debit: inv.total, credit: 0, memo: inv.invoiceNo },
      { accountId: acc(ctx, '4100').id, debit: 0, credit: inv.subtotal, memo: '' },
      { accountId: acc(ctx, '2200').id, debit: 0, credit: inv.vat, memo: `ضريبة ${VAT_PCT}%` },
    ]).id;
    ctx.emit('invoice.issued', 'invoice', inv.id, inv.organizationId, { invoiceNo: inv.invoiceNo, total: inv.total });
    ctx.notify({ audience: 'customer', organizationId: inv.organizationId, title: L(`فاتورة جديدة ${inv.invoiceNo}`, `New invoice ${inv.invoiceNo}`), body: L(`الإجمالي ${(inv.total / 100).toFixed(2)} ر.س — الاستحقاق بعد 30 يوماً`, `Total SAR ${(inv.total / 100).toFixed(2)} — due in 30 days`), link: `/invoices/${inv.id}` });
    return inv;
  },
});
defineCommand<{ id: string; reason: string }, T.Invoice>({
  name: 'invoice.void', guard: ['finance'], desc: L('إلغاء مسودة فاتورة', 'Void draft invoice'),
  run(ctx, { id, reason }) {
    const inv = must(ctx, ctx.db.invoices.find((x) => x.id === id), 'invoice');
    if (inv.status !== 'draft') ctx.fail('INVOICE_NOT_DRAFT', 'الفواتير الصادرة تُصحَّح بإشعار دائن فقط', 'Issued invoices are corrected by credit note only', 422);
    inv.status = 'void'; ctx.db.invoiceLines.filter((l) => l.invoiceId === inv.id && !l.description.ar.startsWith('نقل') && !l.description.ar.startsWith('رسم العقد')).forEach((l) => (l.invoiceId = 'pending'));
    ctx.audit('invoice.void', 'invoice', inv.id, reason); return inv;
  },
});

defineCommand<{ invoiceId: string; amountSar: number; reason: string }, T.CreditNote>({
  name: 'creditNote.request', guard: ['finance'], desc: L('طلب إشعار دائن (تصحيح مضبوط)', 'Request credit note (controlled correction)'),
  run(ctx, i) {
    const inv = must(ctx, ctx.db.invoices.find((x) => x.id === i.invoiceId), 'invoice');
    if (['draft', 'void'].includes(inv.status)) ctx.fail('INVOICE_NOT_ISSUED', 'الإشعار الدائن للفواتير الصادرة فقط', 'Credit notes apply to issued invoices only', 422);
    const credited = ctx.db.creditNotes.filter((c) => c.invoiceId === inv.id && c.status !== 'rejected').reduce((a, c) => a + c.amount, 0);
    const amt = sar(Number(i.amountSar));
    if (!(amt > 0) || amt + credited > inv.total) ctx.fail('VALIDATION', 'المبلغ يتجاوز رصيد الفاتورة القابل للإشعار', 'Amount exceeds creditable invoice balance', 422, 'amountSar');
    if (!i.reason?.trim()) ctx.fail('VALIDATION', 'السبب مطلوب', 'Reason required', 422, 'reason');
    const cn: T.CreditNote = { id: ctx.id('cn'), creditNo: `CN-2026-${ctx.seq('cn')}`, invoiceId: inv.id, reason: i.reason, amount: amt, status: 'pending_approval', requestedBy: ctx.actor.user.id, approvedBy: null, journalId: null, createdAt: ctx.nowIso };
    ctx.db.creditNotes.push(cn);
    ctx.db.approvalRequests.push({ id: ctx.id('apr'), kind: 'credit_note', subjectId: cn.id, title: L(`اعتماد إشعار دائن ${cn.creditNo} — ${i.amountSar} ر.س`, `Approve credit note ${cn.creditNo} — SAR ${i.amountSar}`), requestedBy: ctx.actor.user.id, requiredRole: 'finance_approver', status: 'pending', decidedBy: null, decidedAt: null, note: i.reason, createdAt: ctx.nowIso });
    ctx.audit('credit_note.request', 'credit_note', cn.id, `${cn.creditNo}: ${i.reason}`); return cn;
  },
});

export function applyCreditNote(ctx: Ctx, cn: T.CreditNote) {
  const inv = ctx.db.invoices.find((x) => x.id === cn.invoiceId)!;
  const net = Math.round((cn.amount * 100) / (100 + VAT_PCT)); const vat = cn.amount - net;
  cn.status = 'approved'; cn.approvedBy = ctx.actor.user.id;
  cn.journalId = postJournal(ctx, `إشعار دائن ${cn.creditNo}`, 'credit_note', cn.id, [
    { accountId: acc(ctx, '4900').id, debit: net, credit: 0, memo: inv.invoiceNo }, { accountId: acc(ctx, '2200').id, debit: vat, credit: 0, memo: '' }, { accountId: acc(ctx, '1200').id, debit: 0, credit: cn.amount, memo: '' },
  ]).id;
  const credited = ctx.db.creditNotes.filter((c) => c.invoiceId === inv.id && c.status === 'approved').reduce((a, c) => a + c.amount, 0);
  if (inv.paid + credited >= inv.total) inv.status = 'paid';
  ctx.notify({ audience: 'customer', organizationId: inv.organizationId, title: L(`إشعار دائن ${cn.creditNo}`, `Credit note ${cn.creditNo}`), body: L(`على الفاتورة ${inv.invoiceNo}`, `Against invoice ${inv.invoiceNo}`), link: `/invoices/${inv.id}` });
}

// ---------------- المدفوعات (FIN-004) ----------------
defineCommand<{ organizationId: string; amountSar: number; method: T.Payment['method']; bankRef: string }, T.Payment>({
  name: 'payment.record', guard: ['finance'], desc: L('تسجيل دفعة واردة', 'Record incoming payment'),
  run(ctx, i) {
    must(ctx, ctx.db.organizations.find((o) => o.id === i.organizationId), 'organization');
    const amt = sar(Number(i.amountSar)); if (!(amt > 0)) ctx.fail('VALIDATION', 'المبلغ مطلوب', 'Amount required', 422, 'amountSar');
    if (i.bankRef && ctx.db.payments.some((p) => p.bankRef === i.bankRef)) ctx.fail('DUPLICATE_PAYMENT', 'المرجع البنكي مسجّل مسبقاً', 'Bank reference already recorded', 409, 'bankRef');
    const p: T.Payment = { id: ctx.id('pay'), ref: `RCPT-2026-${ctx.seq('rcpt')}`, direction: 'in', counterpartyType: 'organization', counterpartyId: i.organizationId, amount: amt, method: i.method, status: 'received', bankRef: i.bankRef || null, receivedAt: ctx.nowIso, journalId: null, allocated: 0 };
    ctx.db.payments.push(p);
    p.journalId = postJournal(ctx, `تحصيل ${p.ref}`, 'payment', p.id, [{ accountId: acc(ctx, '1100').id, debit: amt, credit: 0, memo: i.bankRef }, { accountId: acc(ctx, '1200').id, debit: 0, credit: amt, memo: '' }]).id;
    return p;
  },
});
function allocate(ctx: Ctx, p: T.Payment, inv: T.Invoice, amt: number) {
  if (p.counterpartyId !== inv.organizationId) ctx.fail('VALIDATION', 'الدفعة والفاتورة لعميلين مختلفين', 'Payment and invoice belong to different customers', 422);
  const outstanding = inv.total - inv.paid - ctx.db.creditNotes.filter((c) => c.invoiceId === inv.id && c.status === 'approved').reduce((a, c) => a + c.amount, 0);
  if (amt > p.amount - p.allocated) ctx.fail('OVER_ALLOCATION', 'المبلغ يتجاوز الرصيد غير المخصص للدفعة', 'Amount exceeds unallocated payment balance', 422, 'amountSar');
  if (amt > outstanding) ctx.fail('OVER_ALLOCATION', 'المبلغ يتجاوز المستحق على الفاتورة', 'Amount exceeds invoice outstanding', 422, 'amountSar');
  ctx.db.paymentAllocations.push({ id: ctx.id('pal'), paymentId: p.id, invoiceId: inv.id, amount: amt });
  p.allocated += amt; inv.paid += amt;
  const credited = ctx.db.creditNotes.filter((c) => c.invoiceId === inv.id && c.status === 'approved').reduce((a, c) => a + c.amount, 0);
  inv.status = inv.paid + credited >= inv.total ? 'paid' : 'partially_paid';
  ctx.emit('payment.reconciled', 'invoice', inv.id, inv.organizationId, { paymentId: p.id, amount: amt });
}
defineCommand<{ paymentId: string; invoiceId: string; amountSar: number }, T.Invoice>({
  name: 'payment.allocate', guard: ['finance'], desc: L('تخصيص دفعة لفاتورة', 'Allocate payment to invoice'),
  run(ctx, i) {
    const p = must(ctx, ctx.db.payments.find((x) => x.id === i.paymentId), 'payment'); const inv = must(ctx, ctx.db.invoices.find((x) => x.id === i.invoiceId), 'invoice');
    allocate(ctx, p, inv, sar(Number(i.amountSar))); ctx.audit('payment.allocate', 'payment', p.id, `${p.ref} → ${inv.invoiceNo}`); return inv;
  },
});
defineCommand<{ paymentId: string; bankRef: string }, T.Payment>({
  name: 'payment.reconcile', guard: ['finance'], desc: L('مطابقة بنكية', 'Bank reconciliation'),
  run(ctx, { paymentId, bankRef }) { const p = must(ctx, ctx.db.payments.find((x) => x.id === paymentId), 'payment'); if (!bankRef?.trim()) ctx.fail('VALIDATION', 'المرجع البنكي مطلوب', 'Bank reference required', 422, 'bankRef'); p.bankRef = bankRef; p.status = 'reconciled'; ctx.audit('payment.reconcile', 'payment', p.id, bankRef); return p; },
});
/** دفع العميل من البوابة — مزود الدفع محاكاة (OD-006) */
defineCommand<{ invoiceId: string; method: 'card_simulated' | 'sadad_simulated'; simulateFailure?: boolean }, { payment: T.Payment; invoice: T.Invoice }>({
  name: 'customer.payInvoice', guard: ['corp_finance', 'corp_admin', 'individual'], desc: L('دفع فاتورة (محاكاة مزود الدفع)', 'Pay invoice (simulated provider)'),
  run(ctx, { invoiceId, method, simulateFailure }) {
    const inv = must(ctx, ctx.db.invoices.find((x) => x.id === invoiceId), 'invoice');
    if (!customerOrgIds(ctx.actor).includes(inv.organizationId)) ctx.fail('NOT_FOUND', 'الفاتورة غير موجودة', 'Invoice not found', 404);
    if (!['issued', 'partially_paid', 'overdue'].includes(inv.status)) ctx.fail('INVOICE_NOT_PAYABLE', 'الفاتورة غير قابلة للدفع', 'Invoice is not payable', 422);
    if (simulateFailure) ctx.fail('PAYMENT_DECLINED', 'رُفضت العملية من مزود الدفع (محاكاة)', 'Declined by payment provider (simulated)', 402);
    const credited = ctx.db.creditNotes.filter((c) => c.invoiceId === inv.id && c.status === 'approved').reduce((a, c) => a + c.amount, 0);
    const due = inv.total - inv.paid - credited;
    const p: T.Payment = { id: ctx.id('pay'), ref: `RCPT-2026-${ctx.seq('rcpt')}`, direction: 'in', counterpartyType: 'organization', counterpartyId: inv.organizationId, amount: due, method, status: 'received', bankRef: `SIM-${ctx.now.toString(36).toUpperCase()}`, receivedAt: ctx.nowIso, journalId: null, allocated: 0 };
    ctx.db.payments.push(p);
    p.journalId = postJournal(ctx, `تحصيل إلكتروني (محاكاة) ${p.ref}`, 'payment', p.id, [{ accountId: acc(ctx, '1100').id, debit: due, credit: 0, memo: method }, { accountId: acc(ctx, '1200').id, debit: 0, credit: due, memo: inv.invoiceNo }]).id;
    allocate(ctx, p, inv, due);
    ctx.notify({ audience: 'staff', title: L(`دفعة إلكترونية ${p.ref}`, `Online payment ${p.ref}`), body: L(inv.invoiceNo, inv.invoiceNo), link: '/finance/payments' });
    return { payment: p, invoice: inv };
  },
});

// ---------------- دفتر الأستاذ (FIN-004/005, BR-007) ----------------
interface LineIn { accountCode: string; debitSar: number; creditSar: number; memo?: string }
const toLines = (ctx: Ctx, lines: LineIn[]): T.JournalLine[] => lines.map((l) => ({ accountId: acc(ctx, l.accountCode).id, debit: sar(Number(l.debitSar) || 0), credit: sar(Number(l.creditSar) || 0), memo: l.memo ?? '' }));
defineCommand<{ description: string; lines: LineIn[] }, T.Journal>({
  name: 'journal.createDraft', guard: ['finance'], desc: L('إنشاء قيد يومية مسودة', 'Create draft journal'),
  run(ctx, { description, lines }) {
    if (!description?.trim()) ctx.fail('VALIDATION', 'الوصف مطلوب', 'Description required', 422, 'description');
    const j: T.Journal = { id: ctx.id('jnl'), journalNo: `JV-2026-${ctx.seq('jv')}`, entryDate: ctx.nowIso, status: 'draft', sourceType: 'manual', sourceId: null, description, lines: toLines(ctx, lines ?? []), postedAt: null, postedBy: null, reversalOfId: null, reversedById: null, createdAt: ctx.nowIso };
    ctx.db.journals.push(j); ctx.audit('journal.draft', 'journal', j.id, description); return j;
  },
});
defineCommand<{ id: string; lines: LineIn[]; description?: string }, T.Journal>({
  name: 'journal.updateDraft', guard: ['finance'], desc: L('تعديل قيد مسودة (القيود المرحّلة لا تُعدّل)', 'Edit draft (posted entries are immutable)'),
  run(ctx, { id, lines, description }) {
    const j = must(ctx, ctx.db.journals.find((x) => x.id === id), 'journal');
    if (j.status === 'posted') ctx.fail('JOURNAL_POSTED_IMMUTABLE', 'لا يمكن تعديل قيد مرحّل؛ استخدم قيد عكس (BR-007)', 'Posted entries cannot be edited; use a reversal (BR-007)', 422);
    j.lines = toLines(ctx, lines); if (description) j.description = description; return j;
  },
});
defineCommand<{ id: string }, T.Journal>({
  name: 'journal.post', guard: ['finance'], desc: L('ترحيل قيد متوازن', 'Post balanced journal'),
  run(ctx, { id }) {
    const j = must(ctx, ctx.db.journals.find((x) => x.id === id), 'journal');
    if (j.status === 'posted') ctx.fail('JOURNAL_ALREADY_POSTED', 'القيد مرحّل مسبقاً', 'Already posted', 409);
    validateJournal(ctx, j.lines);
    j.status = 'posted'; j.postedAt = ctx.nowIso; j.postedBy = ctx.actor.user.id;
    ctx.emit('journal.entry_posted', 'journal', j.id, null); ctx.audit('journal.post', 'journal', j.id, j.journalNo); return j;
  },
});
defineCommand<{ id: string; reason: string }, T.Journal>({
  name: 'journal.reverse', guard: ['finance'], desc: L('قيد عكسي تعويضي', 'Compensating reversal'),
  run(ctx, { id, reason }) {
    const j = must(ctx, ctx.db.journals.find((x) => x.id === id), 'journal');
    if (j.status !== 'posted') ctx.fail('JOURNAL_NOT_POSTED', 'يُعكس القيد المرحّل فقط', 'Only posted entries can be reversed', 422);
    if (j.reversedById) ctx.fail('JOURNAL_ALREADY_REVERSED', 'القيد معكوس مسبقاً', 'Already reversed', 409);
    if (!reason?.trim()) ctx.fail('VALIDATION', 'سبب العكس مطلوب', 'Reversal reason required', 422, 'reason');
    const r = postJournal(ctx, `عكس ${j.journalNo}: ${reason}`, 'reversal', j.id, j.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit })));
    r.reversalOfId = j.id; j.reversedById = r.id; return r;
  },
});

// ---------------- التكاليف والتوزيع (COST-001..018) ----------------
defineCommand<{ costType: T.CostRecord['costType']; sourceRef: string; estimatedSar: number; actualSar?: number | null }, T.CostRecord>({
  name: 'cost.record', guard: ['finance'], desc: L('تسجيل تكلفة فعلية/تقديرية', 'Record actual/estimated cost'),
  run(ctx, i) {
    if (!(Number(i.estimatedSar) > 0)) ctx.fail('VALIDATION', 'التكلفة التقديرية مطلوبة', 'Estimated cost required', 422, 'estimatedSar');
    const c: T.CostRecord = { id: ctx.id('cst'), costType: i.costType, sourceRef: i.sourceRef || '—', estimated: sar(Number(i.estimatedSar)), actual: i.actualSar ? sar(Number(i.actualSar)) : null, incurredAt: ctx.nowIso, allocated: false };
    ctx.db.costRecords.push(c); ctx.audit('cost.record', 'cost', c.id, `${i.costType} ${i.estimatedSar}`); return c;
  },
});
defineCommand<Record<string, never>, { allocated: number; records: number; skipped: number }>({
  name: 'cost.runAllocation', guard: ['finance'], desc: L('تشغيل قواعد التوزيع المعتمدة', 'Run approved allocation rules'),
  run(ctx) {
    let allocated = 0, records = 0, skipped = 0;
    const delivered = ctx.db.shipments.filter((s) => s.status === 'delivered' && ctx.now - Date.parse(s.updatedAt) < 31 * DAY);
    for (const c of ctx.db.costRecords.filter((x) => !x.allocated)) {
      const rule = ctx.db.allocationRules.find((r) => r.costType === c.costType && r.status === 'active') ?? ctx.db.allocationRules.find((r) => r.basis === 'per_box_hour' && r.status === 'active');
      if (!rule) { skipped++; continue; }
      const total = c.actual ?? c.estimated;
      let targets = ctx.db.shipmentLegs.filter((x) => x.legId === c.sourceRef).map((x) => x.shipmentId);
      if (!targets.length) targets = delivered.map((s) => s.id);
      if (!targets.length) { skipped++; continue; }
      const each = Math.floor(total / targets.length);
      targets.forEach((sid, i) => ctx.db.costAllocations.push({ id: ctx.id('cal'), costRecordId: c.id, shipmentId: sid, ruleId: rule.id, amount: i === targets.length - 1 ? total - each * (targets.length - 1) : each, overrideApprovalId: null, createdAt: ctx.nowIso }));
      c.allocated = true; records++; allocated += total;
    }
    ctx.audit('cost.allocation_run', 'cost', null, `${records} سجلات، ${(allocated / 100).toFixed(2)} ر.س`);
    return { allocated, records, skipped };
  },
});
defineCommand<{ allocationId: string; amountSar: number; reason: string }, T.ApprovalRequest>({
  name: 'cost.requestOverride', guard: ['finance'], desc: L('طلب تجاوز توزيع معتمد', 'Request audited allocation override'),
  run(ctx, { allocationId, amountSar, reason }) {
    const a = must(ctx, ctx.db.costAllocations.find((x) => x.id === allocationId), 'allocation');
    if (!reason?.trim()) ctx.fail('VALIDATION', 'السبب مطلوب', 'Reason required', 422, 'reason');
    const r: T.ApprovalRequest = { id: ctx.id('apr'), kind: 'cost_override', subjectId: `${a.id}:${sar(Number(amountSar))}`, title: L(`تجاوز توزيع التكلفة إلى ${amountSar} ر.س`, `Override allocation to SAR ${amountSar}`), requestedBy: ctx.actor.user.id, requiredRole: 'finance_approver', status: 'pending', decidedBy: null, decidedAt: null, note: reason, createdAt: ctx.nowIso };
    ctx.db.approvalRequests.push(r); return r;
  },
});

// ---------------- تسويات الشركاء (PST-001..017 / UAT-010) ----------------
defineCommand<{ partnerId: string; periodStart: string; periodEnd: string }, T.Settlement>({
  name: 'settlement.generate', guard: ['finance'], desc: L('توليد مسودة تسوية تلقائية', 'Generate automatic settlement draft'),
  run(ctx, i) {
    const p = must(ctx, ctx.db.partners.find((x) => x.id === i.partnerId), 'partner');
    const a = Date.parse(i.periodStart), b = Date.parse(i.periodEnd);
    const settled = new Set(ctx.db.settlements.filter((s) => s.partnerId === p.id).flatMap((s) => s.lines.map((l) => l.legId)));
    const legs = ctx.db.legs.filter((l) => l.partnerId === p.id && l.actualArrival && Date.parse(l.actualArrival) >= a && Date.parse(l.actualArrival) <= b && !settled.has(l.id));
    if (!legs.length) ctx.fail('NOTHING_TO_SETTLE', 'لا توجد خدمات غير مسوّاة في الفترة (منع التسوية المكررة)', 'No unsettled services in period (duplicate settlement prevented)', 422);
    const lines = legs.map((l) => ({ legId: l.id, amount: ctx.db.costRecords.find((c) => c.sourceRef === l.id)?.actual ?? (l.mode === 'air' ? sar(300) : sar(200)), note: l.flightNo ?? `${l.originCity}→${l.destCity}` }));
    const s: T.Settlement = { id: ctx.id('stl'), settlementNo: `ST-${p.code}-${ctx.seq('stl:' + p.code, 3)}`, partnerId: p.id, periodStart: iso(a), periodEnd: iso(b), status: 'draft', calculated: lines.reduce((x, l) => x + l.amount, 0), partnerInvoiced: null, approved: null, approvedBy: null, approvedAt: null, paymentId: null, lines };
    ctx.db.settlements.push(s); ctx.audit('settlement.generate', 'settlement', s.id, `${s.settlementNo} — ${lines.length} بنود`); return s;
  },
});
defineCommand<{ id: string; partnerInvoicedSar: number }, T.Settlement>({
  name: 'settlement.reconcile', guard: ['finance'], desc: L('مطابقة فاتورة الشريك مع المستحقات', 'Reconcile partner invoice with payables'),
  run(ctx, { id, partnerInvoicedSar }) {
    const s = must(ctx, ctx.db.settlements.find((x) => x.id === id), 'settlement');
    if (!['draft', 'disputed'].includes(s.status)) ctx.fail('INVALID_STATE', 'التسوية ليست في مرحلة المطابقة', 'Settlement not in reconciliation', 422);
    s.partnerInvoiced = sar(Number(partnerInvoicedSar));
    const diff = Math.abs(s.partnerInvoiced - s.calculated);
    s.status = diff <= Math.max(100, pct(s.calculated, 1)) ? 'reconciled' : 'disputed';
    if (s.status === 'reconciled' && !ctx.db.approvalRequests.some((a) => a.kind === 'settlement' && a.subjectId === s.id && a.status === 'pending'))
      ctx.db.approvalRequests.push({ id: ctx.id('apr'), kind: 'settlement', subjectId: s.id, title: L(`اعتماد تسوية ${s.settlementNo}`, `Approve settlement ${s.settlementNo}`), requestedBy: ctx.actor.user.id, requiredRole: 'finance_approver', status: 'pending', decidedBy: null, decidedAt: null, note: '', createdAt: ctx.nowIso });
    ctx.audit('settlement.reconcile', 'settlement', s.id, `${s.status} — الفرق ${(diff / 100).toFixed(2)}`); return s;
  },
});
export function approveSettlement(ctx: Ctx, s: T.Settlement) {
  if (s.status !== 'reconciled') ctx.fail('INVALID_STATE', 'تُعتمد التسوية بعد المطابقة فقط', 'Settlement must be reconciled first', 422);
  s.status = 'approved'; s.approved = s.calculated; s.approvedBy = ctx.actor.user.id; s.approvedAt = ctx.nowIso;
  const p = ctx.db.partners.find((x) => x.id === s.partnerId)!;
  postJournal(ctx, `استحقاق تسوية ${s.settlementNo}`, 'settlement', s.id, [{ accountId: acc(ctx, p.partnerType === 'air' ? '5200' : p.partnerType === 'warehouse' ? '5500' : '5300').id, debit: s.calculated, credit: 0, memo: '' }, { accountId: acc(ctx, '2100').id, debit: 0, credit: s.calculated, memo: p.name.ar }]);
  ctx.emit('partner.settlement_approved', 'settlement', s.id, null, { note: 'الاعتماد ليس دفعاً' });
}
defineCommand<{ id: string; bankRef: string }, T.Settlement>({
  name: 'settlement.recordPayment', guard: ['finance'], desc: L('تسجيل سداد تسوية معتمدة (منفصل عن الاعتماد)', 'Record payment of approved settlement (separate from approval)'),
  run(ctx, { id, bankRef }) {
    const s = must(ctx, ctx.db.settlements.find((x) => x.id === id), 'settlement');
    if (s.status !== 'approved') ctx.fail(s.status === 'paid' ? 'DUPLICATE_PAYMENT' : 'SETTLEMENT_NOT_APPROVED', s.status === 'paid' ? 'التسوية مدفوعة مسبقاً — مُنع الدفع المكرر' : 'لا يجوز الدفع قبل اعتماد المالية (DB-AT-007)', s.status === 'paid' ? 'Already paid — duplicate payment prevented' : 'Payment not allowed before finance approval (DB-AT-007)', s.status === 'paid' ? 409 : 422);
    if (!bankRef?.trim()) ctx.fail('VALIDATION', 'المرجع البنكي مطلوب', 'Bank reference required', 422, 'bankRef');
    const pay: T.Payment = { id: ctx.id('pay'), ref: `PAY-2026-${ctx.seq('payout')}`, direction: 'out', counterpartyType: 'partner', counterpartyId: s.partnerId, amount: s.approved!, method: 'bank_transfer', status: 'reconciled', bankRef, receivedAt: ctx.nowIso, journalId: null, allocated: s.approved! };
    ctx.db.payments.push(pay);
    pay.journalId = postJournal(ctx, `سداد تسوية ${s.settlementNo}`, 'partner_payment', s.id, [{ accountId: acc(ctx, '2100').id, debit: pay.amount, credit: 0, memo: '' }, { accountId: acc(ctx, '1100').id, debit: 0, credit: pay.amount, memo: bankRef }]).id;
    s.status = 'paid'; s.paymentId = pay.id;
    ctx.emit('partner.payment_recorded', 'settlement', s.id, null); return s;
  },
});

// ---------------- التسعير والمحاكاة (FIN-002 / SIM / BR-008 / UAT-012) ----------------
type Adj = { thermalClass: T.ThermalClass | 'all'; pct: number };
const adjust = (rules: T.RatePlan['rules'], adj: Adj[]) => rules.map((r) => { const a = adj.find((x) => x.thermalClass === r.thermalClass) ?? adj.find((x) => x.thermalClass === 'all'); if (!a) return { ...r }; const f = (v: number) => v + pct(v, a.pct); return { ...r, sameCity: f(r.sameCity), intercityRoad: f(r.intercityRoad), air: f(r.air) }; });
defineCommand<{ fromPlanId: string; adjustments: Adj[]; effectiveFrom: string }, T.RatePlan>({
  name: 'ratePlan.createDraft', guard: ['finance'], desc: L('مسودة إصدار تعرفة جديد', 'Draft new tariff version'),
  run(ctx, i) {
    const base = must(ctx, ctx.db.ratePlans.find((p) => p.id === i.fromPlanId), 'rate plan');
    if (!(Date.parse(i.effectiveFrom) > ctx.now)) ctx.fail('VALIDATION', 'تاريخ السريان يجب أن يكون مستقبلاً', 'Effective date must be in the future', 422, 'effectiveFrom');
    const v = Math.max(...ctx.db.ratePlans.filter((p) => p.code === base.code).map((p) => p.version)) + 1;
    const p: T.RatePlan = { id: `rp_${base.code.toLowerCase().replace(/[^a-z0-9]/g, '')}_v${v}`, code: base.code, name: base.name, version: v, status: 'draft', effectiveFrom: iso(Date.parse(i.effectiveFrom)), rules: adjust(base.rules, i.adjustments ?? []), approvedBy: null, createdAt: ctx.nowIso };
    ctx.db.ratePlans.push(p); ctx.audit('rate_plan.draft', 'rate_plan', p.id, `${p.code} v${v}`); return p;
  },
});
defineCommand<{ id: string }, T.RatePlan>({
  name: 'ratePlan.submit', guard: ['finance'], desc: L('رفع جدول الأسعار للاعتماد', 'Submit tariff for approval'),
  run(ctx, { id }) {
    const p = must(ctx, ctx.db.ratePlans.find((x) => x.id === id), 'rate plan'); if (p.status !== 'draft') ctx.fail('INVALID_STATE', 'المسودات فقط', 'Drafts only', 422);
    p.status = 'pending_approval';
    ctx.db.approvalRequests.push({ id: ctx.id('apr'), kind: 'rate_plan', subjectId: p.id, title: L(`اعتماد ${p.name.ar} — الإصدار ${p.version}`, `Approve ${p.name.en} v${p.version}`), requestedBy: ctx.actor.user.id, requiredRole: 'finance_approver', status: 'pending', decidedBy: null, decidedAt: null, note: '', createdAt: ctx.nowIso });
    return p;
  },
});
defineCommand<{ id: string }, T.RatePlan>({
  name: 'ratePlan.publish', guard: ['finance', 'finance_approver'], desc: L('نشر تعرفة معتمدة بتاريخ سريان', 'Publish approved tariff with effective date'),
  run(ctx, { id }) {
    const p = must(ctx, ctx.db.ratePlans.find((x) => x.id === id), 'rate plan');
    if (p.status !== 'approved') ctx.fail('NOT_APPROVED', 'لا تُنشر تعرفة قبل الاعتماد (BR-008)', 'Tariff cannot be published before approval (BR-008)', 422);
    p.status = 'published';
    if (Date.parse(p.effectiveFrom) <= ctx.now) ctx.db.ratePlans.filter((x) => x.code === p.code && x.id !== p.id && x.status === 'published').forEach((x) => (x.status = 'superseded'));
    ctx.emit('pricing.rule_published', 'rate_plan', p.id, null, { effectiveFrom: p.effectiveFrom }); ctx.audit('rate_plan.publish', 'rate_plan', p.id, `سريان ${p.effectiveFrom}`); return p;
  },
});
defineCommand<{ name: string; ratePlanId?: string; adjustments: Adj[] }, T.Simulation>({
  name: 'simulation.run', guard: ['finance'], desc: L('محاكاة تسعير معزولة بلا آثار', 'Isolated, side-effect-free pricing simulation'),
  run(ctx, i) {
    const plan = i.ratePlanId ? must(ctx, ctx.db.ratePlans.find((p) => p.id === i.ratePlanId), 'rate plan') : activePlan(ctx.db, ctx.nowIso);
    const proposed = { ...plan, rules: adjust(plan.rules, i.adjustments ?? []) };
    const ships = ctx.db.shipments.filter((s) => ctx.now - Date.parse(s.createdAt) < 30 * DAY && !['draft', 'cancelled'].includes(s.status));
    let cur = 0, prop = 0, cost = 0;
    for (const s of ships) {
      const w = ctx.db.shipmentItems.filter((x) => x.shipmentId === s.id).reduce((a, x) => a + x.weightKg, 0);
      const input = { thermalClass: s.thermalClass, serviceLevel: s.serviceLevel, originCity: s.originCity, destCity: s.destCity, mode: s.mode, weightKg: w, dedicatedBox: s.dedicatedBox };
      cur += price(plan, input).subtotal; prop += price(proposed, input).subtotal;
      cost += ctx.db.costAllocations.filter((c) => c.shipmentId === s.id).reduce((a, c) => a + c.amount, 0);
    }
    // ملاحظة: لا يُكتب شيء في الأسعار أو العقود أو الفواتير أو القيود
    const sim: T.Simulation = { id: ctx.id('sim'), name: i.name || 'محاكاة', createdBy: ctx.actor.user.id, createdAt: ctx.nowIso, ratePlanId: plan.id, adjustments: i.adjustments ?? [], result: { currentRevenue: cur, proposedRevenue: prop, estimatedCost: cost, shipmentsAnalysed: ships.length }, status: 'draft', liveChangesApplied: false };
    ctx.db.simulations.push(sim); return sim;
  },
});
defineCommand<{ id: string }, T.Simulation>({
  name: 'simulation.submit', guard: ['finance'], desc: L('رفع المحاكاة للاعتماد', 'Submit simulation for approval'),
  run(ctx, { id }) { const s = must(ctx, ctx.db.simulations.find((x) => x.id === id), 'simulation'); s.status = 'submitted'; return s; },
});
defineCommand<{ simulationId: string; effectiveFrom: string }, T.RatePlan>({
  name: 'simulation.toDraftPlan', guard: ['finance'], desc: L('تحويل المحاكاة إلى مسودة تعرفة', 'Turn simulation into tariff draft'),
  run(ctx, { simulationId, effectiveFrom }) { const s = must(ctx, ctx.db.simulations.find((x) => x.id === simulationId), 'simulation'); return ctx.exec<T.RatePlan>('ratePlan.createDraft', { fromPlanId: s.ratePlanId, adjustments: s.adjustments, effectiveFrom }); },
});

// ---------------- العقود (FIN-001) ----------------
defineCommand<{ organizationId: string; billingCycle: T.Contract['billingCycle']; validFrom: string; validTo: string; includedShipments: number; monthlyFeeSar: number }, T.Contract>({
  name: 'contract.create', guard: ['finance'], desc: L('إنشاء عقد', 'Create contract'),
  run(ctx, i) {
    must(ctx, ctx.db.organizations.find((o) => o.id === i.organizationId), 'organization');
    if (!(Date.parse(i.validTo) > Date.parse(i.validFrom))) ctx.fail('VALIDATION', 'تاريخ الانتهاء بعد البداية', 'End must be after start', 422, 'validTo');
    const c: T.Contract = { id: ctx.id('con'), contractNo: `CT-2026-${ctx.seq('contract', 3)}`, organizationId: i.organizationId, billingCycle: i.billingCycle, validFrom: iso(Date.parse(i.validFrom)), validTo: iso(Date.parse(i.validTo)), status: 'draft', ratePlanId: activePlan(ctx.db, ctx.nowIso).id, includedShipments: Math.max(0, Math.trunc(i.includedShipments)), usedShipments: 0, monthlyFee: sar(Number(i.monthlyFeeSar) || 0) };
    ctx.db.contracts.push(c); ctx.audit('contract.create', 'contract', c.id, c.contractNo); return c;
  },
});
defineCommand<{ id: string; status: 'active' | 'suspended' }, T.Contract>({
  name: 'contract.setStatus', guard: ['finance_approver', 'finance'], desc: L('تفعيل/تعليق عقد', 'Activate/suspend contract'),
  run(ctx, { id, status }) {
    const c = must(ctx, ctx.db.contracts.find((x) => x.id === id), 'contract');
    if (status === 'active') { ctx.require('finance_approver'); ctx.db.contracts.filter((x) => x.organizationId === c.organizationId && x.status === 'active' && x.id !== c.id).forEach((x) => (x.status = 'expired')); }
    c.status = status; ctx.audit('contract.status', 'contract', c.id, status); return c;
  },
});
