// Phase 17.1 — مستند الفاتورة الضريبية (FIN-003/FIN-006): كل ما يلزم لعرض فاتورة ضريبية ثنائية اللغة وطباعتها وتصديرها PDF.
// الوصول: نفس نطاق مجموعة «invoices» (المالية الداخلية للموظفين، والمالية لدى العميل لمؤسساته فقط؛ لا مسودات للعميل).
// حقول الفوترة الإلكترونية محاكاة: رمز QR بصيغة TLV (الوسوم 1–5 بترميز Base64) يُولَّد محلياً؛ لا يوجد ختم تشفيري ولا إرسال للهيئة.
import type * as T from './types';
import { DomainError } from './types';
import { defineQuery } from './engine';
import { scoped } from './queries';
import { isStaff, type Actor } from './access';
import { fingerprint } from './util';
import { VAT_PCT } from './pricing';

type L = { ar: string; en: string };
const L = (ar: string, en: string): L => ({ ar, en });

/** بيانات البائع — شركة خيالية لأغراض العرض فقط */
export const SELLER = {
  legalName: L('شركة أطلس لينك للخدمات اللوجستية الطبية', 'Atlas Link Medical Logistics Company'),
  vatNumber: '310987654300003',
  crNumber: '1010987654',
  address: {
    building: '2451', street: L('طريق الملك فهد', 'King Fahd Road'), district: L('حي العليا', 'Al Olaya District'),
    city: L('الرياض', 'Riyadh'), postalCode: '12214', additionalNo: '7788', country: L('المملكة العربية السعودية', 'Kingdom of Saudi Arabia'),
  },
  phone: '+966 11 000 4455', email: 'billing@atlaslink.example',
  bank: { name: L('بنك تجريبي', 'Demo Bank'), iban: 'SA03 8000 0000 6080 1016 7519' },
  fictional: true,
};

const CITY: Record<string, L> = { RUH: L('الرياض', 'Riyadh'), JED: L('جدة', 'Jeddah'), DMM: L('الدمام', 'Dammam'), MKK: L('مكة المكرمة', 'Makkah'), MED: L('المدينة المنورة', 'Madinah'), AHB: L('أبها', 'Abha') };

/** ترميز TLV لرمز QR (الوسوم 1–5) — الطول بالبايت بعد UTF-8 */
export function zatcaTlvBase64(fields: string[]): string {
  const enc = new TextEncoder(); const parts: number[] = [];
  fields.forEach((v, i) => { const b = enc.encode(v); if (b.length > 255) throw new Error('TLV value too long'); parts.push(i + 1, b.length, ...b); });
  let bin = ''; for (const x of parts) bin += String.fromCharCode(x);
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(parts).toString('base64');
}
export function decodeTlvBase64(b64: string): { tag: number; value: string }[] {
  const raw = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0)); const out: { tag: number; value: string }[] = [];
  for (let i = 0; i < bytes.length;) { const tag = bytes[i], len = bytes[i + 1]; out.push({ tag, value: new TextDecoder().decode(bytes.slice(i + 2, i + 2 + len)) }); i += 2 + len; }
  return out;
}
const amt = (h: number) => (h / 100).toFixed(2);

export interface InvoiceDocLine { no: number; description: L; shipmentRef: string | null; serviceDate: string | null; qty: number; unitPrice: number; discount: number; taxable: number; vatRate: number; vat: number; total: number }
export interface InvoiceDocument {
  invoice: { id: string; invoiceNo: string; type: 'standard' | 'simplified'; typeCode: string; subtypeCode: string; status: T.Invoice['status']; issueDate: string | null; supplyFrom: string; supplyTo: string; dueDate: string | null; currency: 'SAR'; contractNo: string | null; branch: L | null };
  seller: typeof SELLER;
  buyer: { legalName: L; vatNumber: string | null; crNumber: string | null; customerType: T.Organization['customerType']; address: { district: L | null; city: L; country: L; contact: string | null; phone: string | null } };
  lines: InvoiceDocLine[];
  totals: { gross: number; discount: number; taxable: number; vat: number; total: number; vatRate: number; paid: number; credited: number; balance: number };
  payments: { ref: string; date: string; amount: number; method: string; bankRef: string | null }[];
  creditNotes: { creditNo: string; date: string; amount: number; reason: string }[];
  zatca: { simulated: true; status: T.Invoice['zatcaStatus']; uuid: string; icv: number; invoiceHash: string; previousHash: string; qrBase64: string | null; qrTags: { tag: number; label: L; value: string }[]; note: L };
}

const TAG_LABELS: L[] = [L('اسم البائع', 'Seller name'), L('الرقم الضريبي للبائع', 'Seller VAT number'), L('تاريخ ووقت الفاتورة', 'Invoice timestamp'), L('الإجمالي شامل الضريبة', 'Total with VAT'), L('إجمالي ضريبة القيمة المضافة', 'VAT total')];

export function buildInvoiceDocument(db: T.Db, inv: T.Invoice, a?: Actor): InvoiceDocument {
  const org = db.organizations.find((o) => o.id === inv.organizationId)!;
  const branch = inv.branchId ? db.branches.find((b) => b.id === inv.branchId) ?? null : null;
  const addr = db.addresses.find((x) => x.organizationId === org.id && (!inv.branchId || x.branchId === inv.branchId)) ?? db.addresses.find((x) => x.organizationId === org.id) ?? null;
  const contract = db.contracts.find((c) => c.organizationId === org.id && c.status === 'active') ?? db.contracts.filter((c) => c.organizationId === org.id && c.status !== 'draft').sort((x, y) => y.validFrom.localeCompare(x.validFrom))[0] ?? null;
  const rawLines = db.invoiceLines.filter((l) => l.invoiceId === inv.id);
  const lines: InvoiceDocLine[] = rawLines.map((l, i) => {
    const sh = l.shipmentId ? db.shipments.find((s) => s.id === l.shipmentId) : null;
    const gross = l.unitPrice * l.qty; const discount = (l as T.InvoiceLine & { discount?: number }).discount ?? 0; const taxable = gross - discount;
    return { no: i + 1, description: l.description, shipmentRef: sh?.trackingNo ?? null, serviceDate: sh?.updatedAt ?? null, qty: l.qty, unitPrice: l.unitPrice, discount, taxable, vatRate: taxable ? Math.round((l.vat / taxable) * 100) : VAT_PCT, vat: l.vat, total: taxable + l.vat };
  });
  const gross = lines.reduce((x, l) => x + l.unitPrice * l.qty, 0); const discount = lines.reduce((x, l) => x + l.discount, 0);
  const allocs = db.paymentAllocations.filter((p) => p.invoiceId === inv.id);
  const payments = allocs.map((al) => { const p = db.payments.find((x) => x.id === al.paymentId)!; return { ref: p.ref, date: p.receivedAt, amount: al.amount, method: p.method, bankRef: p.bankRef }; });
  const creditNotes = db.creditNotes.filter((c) => c.invoiceId === inv.id && c.status === 'approved').map((c) => ({ creditNo: c.creditNo, date: c.createdAt, amount: c.amount, reason: c.reason }));
  const credited = creditNotes.reduce((x, c) => x + c.amount, 0);
  const type: 'standard' | 'simplified' = org.customerType === 'individual' || !org.taxId ? 'simplified' : 'standard';
  const icv = Number(inv.invoiceNo.split('-').pop()) || 0;
  const prev = db.invoices.filter((x) => x.issueDate && inv.issueDate && x.issueDate < inv.issueDate).sort((x, y) => (y.issueDate ?? '').localeCompare(x.issueDate ?? ''))[0];
  const h = (x: T.Invoice | undefined) => (x ? fingerprint(['inv', x.id, x.invoiceNo, x.total, x.issueDate]) : '0'.repeat(16));
  const issued = !!inv.issueDate && inv.status !== 'draft';
  const fields = [SELLER.legalName.ar, SELLER.vatNumber, (inv.issueDate ?? '').replace(/\.\d{3}Z$/, 'Z'), amt(inv.total), amt(inv.vat)];
  void a;
  return {
    invoice: { id: inv.id, invoiceNo: inv.invoiceNo, type, typeCode: '388', subtypeCode: type === 'standard' ? '0100000' : '0200000', status: inv.status, issueDate: inv.issueDate, supplyFrom: inv.periodFrom, supplyTo: inv.periodTo, dueDate: inv.dueDate, currency: 'SAR', contractNo: contract?.contractNo ?? null, branch: branch?.name ?? null },
    seller: SELLER,
    buyer: { legalName: org.legalName, vatNumber: org.taxId, crNumber: org.customerType === 'individual' ? null : `10${fingerprint(['cr', org.id]).replace(/\D/g, '').padEnd(8, '7').slice(0, 8)}`, customerType: org.customerType, address: { district: addr?.district ?? null, city: CITY[org.cityCode] ?? L(org.cityCode, org.cityCode), country: L('المملكة العربية السعودية', 'Kingdom of Saudi Arabia'), contact: addr?.contactName ?? null, phone: addr?.contactPhone ?? null } },
    lines,
    totals: { gross, discount, taxable: inv.subtotal, vat: inv.vat, total: inv.total, vatRate: VAT_PCT, paid: inv.paid, credited, balance: Math.max(0, inv.total - inv.paid - credited) },
    payments, creditNotes,
    zatca: {
      simulated: true, status: inv.zatcaStatus, uuid: uuidFrom(inv.id), icv, invoiceHash: h(inv), previousHash: h(prev),
      qrBase64: issued ? zatcaTlvBase64(fields) : null,
      qrTags: issued ? fields.map((v, i) => ({ tag: i + 1, label: TAG_LABELS[i], value: v })) : [],
      note: L('بيانات الفوترة الإلكترونية محاكاة لأغراض العرض: لم تُرسل الفاتورة إلى هيئة الزكاة والضريبة والجمارك، ولا يوجد ختم تشفيري (CSID) ولا رمز تحقق صادر من الهيئة. لا تُعد هذه الفاتورة متوافقة نظامياً قبل التكامل الفعلي والتحقق.', 'E-invoicing data is simulated for demonstration: the invoice was not submitted to ZATCA, there is no cryptographic stamp (CSID) and no authority-issued validation. This invoice is not claimed to be compliant before real integration and verification.'),
    },
  };
}

function uuidFrom(id: string): string {
  const hex = (fingerprint(['uuid', id]) + fingerprint(['uuid2', id]) + fingerprint(['uuid3', id])).replace(/[^0-9a-f]/gi, '0').padEnd(32, '0').slice(0, 32).toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

defineQuery<{ id: string }, InvoiceDocument>({
  name: 'invoice.document', guard: 'any',
  run(db, a, { id }) {
    const inv = (scoped(db, a, 'invoices') as T.Invoice[]).find((x) => x.id === id || x.invoiceNo === id);
    if (!inv) throw new DomainError('NOT_FOUND', 404, { ar: 'الفاتورة غير موجودة', en: 'Invoice not found' });
    if (!isStaff(a) && inv.status === 'draft') throw new DomainError('NOT_FOUND', 404, { ar: 'الفاتورة غير موجودة', en: 'Invoice not found' });
    return buildInvoiceDocument(db, inv, a);
  },
});
