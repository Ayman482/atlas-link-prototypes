'use client';
// Phase 17.1 — مستند الفاتورة الضريبية ثنائي اللغة: معاينة، طباعة A4، وتنزيل PDF (صفحة لكل ورقة A4 بدقة عالية).
// الصفحات مقسّمة مسبقاً (البنود لا تنقسم بين صفحتين، والمجاميع ورمز QR لا تنفصل عن آخر صفحة) لتطابق المعاينة والطباعة وPDF.
// حقول الفوترة الإلكترونية محاكاة ومعلَّمة بوضوح — لا ادعاء امتثال ولا تكامل مع الهيئة.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { InvoiceDocument, InvoiceDocLine } from '@medlog/core';
import { useApp, useQ } from './store';
import { Btn, ErrorBox, Loading, Modal, cx } from './ui';
import { Layer, useBackgroundLock } from './overlay';

type DL = 'ar' | 'en';
const n2 = (h: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(h / 100);
const d10 = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) : '—');
const dt = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '—');
const STATUS: Record<string, [string, string]> = { draft: ['مسودة', 'Draft'], issued: ['صادرة — غير مدفوعة', 'Issued — unpaid'], partially_paid: ['مدفوعة جزئياً', 'Partially paid'], paid: ['مدفوعة بالكامل', 'Paid in full'], overdue: ['متأخرة السداد', 'Overdue'], void: ['ملغاة', 'Void'] };
const ZSTATUS: Record<string, [string, string]> = { not_submitted: ['لم تُرسل (محاكاة)', 'Not submitted (simulated)'], simulated_cleared: ['مقبولة (محاكاة)', 'Cleared (simulated)'], simulated_rejected: ['مرفوضة (محاكاة)', 'Rejected (simulated)'] };
const METHOD: Record<string, [string, string]> = { bank_transfer: ['تحويل بنكي', 'Bank transfer'], card_simulated: ['بطاقة مدى/فيزا (محاكاة)', 'Mada/Visa card (simulated)'], sadad_simulated: ['سداد (محاكاة)', 'SADAD (simulated)'] };

/** تسمية ثنائية: الأساسية بلغة المستند والثانوية تحتها بخط أصغر */
const Bi = ({ ar, en, l }: { ar: string; en: string; l: DL }) => <span className="bi"><span lang={l}>{l === 'ar' ? ar : en}</span><span className="sub" lang={l === 'ar' ? 'en' : 'ar'} dir={l === 'ar' ? 'ltr' : 'rtl'}>{l === 'ar' ? en : ar}</span></span>;
const Logo = () => <svg width="44" height="44" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#087F70" /><path d="M16 25s-8-5-8-11a4.4 4.4 0 0 1 8-2.6A4.4 4.4 0 0 1 24 14c0 6-8 11-8 11z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /><path d="M11 16h3l1.5-2.5 2 4 1.2-1.5H21" fill="none" stroke="#E6A65D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** تقسيم البنود على صفحات A4 حسب سعات محددة لكل صفحة؛ ما يزيد يذهب لصفحات لاحقة بسعة افتراضية. المجاميع دائماً في الأخيرة. */
export function paginate(lines: InvoiceDocLine[], limits: number[] = [], first = 12, middle = 22, tail = false): InvoiceDocLine[][] {
  const pages: InvoiceDocLine[][] = []; let i = 0; let p = 0;
  while (i < lines.length || pages.length === 0) { const cap = limits[p] ?? (p === 0 ? first : middle); pages.push(lines.slice(i, i + cap)); i += cap; p++; if (p > 200) break; }
  if (tail) pages.push([]); // صفحة أخيرة للإجماليات وحدها حين لا تتسع مع آخر بند
  return pages;
}
/** يقيس كل ورقة بعد الرسم؛ إن تجاوز محتواها ارتفاع A4 يُنقل بند واحد للصفحة التالية ويُعاد القياس حتى لا يتجاوز شيء */
function useFitPagination(lines: InvoiceDocLine[], root: React.RefObject<HTMLDivElement>, deps: unknown[]) {
  const [limits, setLimits] = useState<number[]>([]); const [tail, setTail] = useState(false);
  useEffect(() => { setLimits([]); setTail(false); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = useMemo(() => paginate(lines, limits, 12, 22, tail), [lines, limits, tail]);
  React.useLayoutEffect(() => {
    const sheets = [...(root.current?.querySelectorAll<HTMLElement>('.sheet') ?? [])];
    for (let i = 0; i < sheets.length; i++) {
      const el = sheets[i]; if (el.scrollHeight <= el.clientHeight + 1) continue;
      const rows = pages[i]?.length ?? 0; const lastPage = i === pages.length - 1;
      // الصفحة الأخيرة تحمل الإجماليات: لا نُفرغ صفحةً من بنودها لأجلها — نُكمل الإجماليات في صفحة مستقلة
      if (lastPage && !tail && rows <= 1) { setLimits(pages.map((pg) => pg.length)); setTail(true); return; }
      if (rows > 0) { const next = pages.slice(0, i + 1).map((pg) => pg.length); next[i] = rows - 1; setLimits(next); return; }
      if (i === pages.length - 1 && i > 0 && pages[i - 1].length > 0) { const next = pages.slice(0, i).map((pg) => pg.length); next[i - 1] -= 1; setLimits(next); return; }
    }
  });
  return pages;
}

export function InvoiceDocumentView({ doc, l, onPages }: { doc: InvoiceDocument; l: DL; onPages?(n: number): void }) {
  const [qr, setQr] = useState<string | null>(null); const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (doc.zatca.qrBase64) QRCode.toDataURL(doc.zatca.qrBase64, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: '#173B4D', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(null)); }, [doc.zatca.qrBase64]);
  const pages = useFitPagination(doc.lines, root, [doc.invoice.id, l]);
  useEffect(() => { onPages?.(pages.length); }, [pages.length, onPages]);
  const dir = l === 'ar' ? 'rtl' : 'ltr'; const x = (v: { ar: string; en: string } | null | undefined) => (v ? v[l] : '—');
  const simplified = doc.invoice.type === 'simplified';
  const st = STATUS[doc.invoice.status] ?? [doc.invoice.status, doc.invoice.status];
  return (
    <div className="inv-sheets" dir={dir} lang={l} ref={root}>
      {pages.map((pl, pi) => {
        const last = pi === pages.length - 1; const firstPage = pi === 0;
        return (
          <section className="sheet" key={pi} aria-label={`${l === 'ar' ? 'صفحة' : 'Page'} ${pi + 1}`}>
            <div className="sim-ribbon" role="note">{l === 'ar' ? 'نموذج عرض — بيانات خيالية وفوترة إلكترونية محاكاة' : 'Demo document — fictional data and simulated e-invoicing'}</div>
            <header className="ihead">
              <div className="seller-id"><Logo /><div><b>{x(doc.seller.legalName)}</b><span className="sub">{l === 'ar' ? doc.seller.legalName.en : doc.seller.legalName.ar}</span></div></div>
              <div className="ititle"><h1>{simplified ? (l === 'ar' ? 'فاتورة ضريبية مبسطة' : 'Simplified Tax Invoice') : (l === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice')}</h1><span className="sub">{simplified ? (l === 'ar' ? 'Simplified Tax Invoice' : 'فاتورة ضريبية مبسطة') : (l === 'ar' ? 'Tax Invoice' : 'فاتورة ضريبية')}</span></div>
            </header>
            {firstPage && <>
              <dl className="imeta">
                <div><dt><Bi l={l} ar="رقم الفاتورة" en="Invoice no." /></dt><dd className="ltr">{doc.invoice.invoiceNo}</dd></div>
                <div><dt><Bi l={l} ar="تاريخ الإصدار" en="Issue date" /></dt><dd className="ltr">{dt(doc.invoice.issueDate)}</dd></div>
                <div><dt><Bi l={l} ar="فترة التوريد" en="Supply period" /></dt><dd className="ltr">{d10(doc.invoice.supplyFrom)} – {d10(doc.invoice.supplyTo)}</dd></div>
                <div><dt><Bi l={l} ar="تاريخ الاستحقاق" en="Due date" /></dt><dd className="ltr">{d10(doc.invoice.dueDate)}</dd></div>
                <div><dt><Bi l={l} ar="رقم العقد" en="Contract no." /></dt><dd className="ltr">{doc.invoice.contractNo ?? '—'}</dd></div>
                <div><dt><Bi l={l} ar="العملة" en="Currency" /></dt><dd>{l === 'ar' ? 'ريال سعودي (SAR)' : 'Saudi Riyal (SAR)'}</dd></div>
                <div><dt><Bi l={l} ar="حالة السداد" en="Payment status" /></dt><dd><span className={cx('ipill', doc.invoice.status)}>{l === 'ar' ? st[0] : st[1]}</span></dd></div>
                <div><dt><Bi l={l} ar="نوع الفاتورة" en="Invoice type" /></dt><dd className="ltr">{doc.invoice.typeCode} / {doc.invoice.subtypeCode}</dd></div>
              </dl>
              <div className="parties">
                <div className="party"><h2><Bi l={l} ar="البائع" en="Seller" /></h2>
                  <p className="pn">{x(doc.seller.legalName)}</p>
                  <dl>
                    <div><dt><Bi l={l} ar="الرقم الضريبي" en="VAT no." /></dt><dd className="ltr">{doc.seller.vatNumber}</dd></div>
                    <div><dt><Bi l={l} ar="السجل التجاري" en="CR no." /></dt><dd className="ltr">{doc.seller.crNumber}</dd></div>
                    <div><dt><Bi l={l} ar="العنوان الوطني" en="National address" /></dt><dd>{doc.seller.address.building} {x(doc.seller.address.street)}، {x(doc.seller.address.district)}، {x(doc.seller.address.city)} {doc.seller.address.postalCode} — {l === 'ar' ? 'الرقم الإضافي' : 'Add. no.'} {doc.seller.address.additionalNo}</dd></div>
                    <div><dt><Bi l={l} ar="التواصل" en="Contact" /></dt><dd className="ltr">{doc.seller.phone} · {doc.seller.email}</dd></div>
                  </dl>
                </div>
                <div className="party"><h2><Bi l={l} ar="المشتري" en="Buyer" /></h2>
                  <p className="pn">{x(doc.buyer.legalName)}</p>
                  <dl>
                    <div><dt><Bi l={l} ar="الرقم الضريبي" en="VAT no." /></dt><dd className="ltr">{doc.buyer.vatNumber ?? (l === 'ar' ? 'غير مسجل' : 'Not registered')}</dd></div>
                    {doc.buyer.crNumber && <div><dt><Bi l={l} ar="السجل التجاري" en="CR no." /></dt><dd className="ltr">{doc.buyer.crNumber}</dd></div>}
                    <div><dt><Bi l={l} ar="العنوان" en="Address" /></dt><dd>{doc.buyer.address.district ? `${x(doc.buyer.address.district)}، ` : ''}{x(doc.buyer.address.city)}، {x(doc.buyer.address.country)}</dd></div>
                    {doc.invoice.branch && <div><dt><Bi l={l} ar="الفرع" en="Branch" /></dt><dd>{x(doc.invoice.branch)}</dd></div>}
                    {doc.buyer.address.contact && <div><dt><Bi l={l} ar="جهة الاتصال" en="Contact" /></dt><dd>{doc.buyer.address.contact} <span className="ltr">{doc.buyer.address.phone}</span></dd></div>}
                  </dl>
                </div>
              </div>
            </>}
            {(pl.length > 0 || doc.lines.length === 0 || !last || pi === 0) && <table className="ilines">
              <thead><tr>
                <th className="c">#</th><th><Bi l={l} ar="وصف الخدمة" en="Service description" /></th><th className="n"><Bi l={l} ar="الكمية" en="Qty" /></th>
                <th className="n"><Bi l={l} ar="سعر الوحدة" en="Unit price" /></th><th className="n"><Bi l={l} ar="الخصم" en="Discount" /></th>
                <th className="n"><Bi l={l} ar="المبلغ الخاضع للضريبة" en="Taxable amount" /></th><th className="n"><Bi l={l} ar="نسبة الضريبة" en="VAT rate" /></th>
                <th className="n"><Bi l={l} ar="مبلغ الضريبة" en="VAT amount" /></th><th className="n"><Bi l={l} ar="الإجمالي شامل الضريبة" en="Total incl. VAT" /></th>
              </tr></thead>
              <tbody>
                {pl.length === 0 && doc.lines.length === 0 && <tr><td colSpan={9} className="empty">{l === 'ar' ? 'لا بنود' : 'No lines'}</td></tr>}
                {pl.map((ln) => <tr key={ln.no}>
                  <td className="c">{ln.no}</td>
                  <td className="desc"><span>{x(ln.description)}</span><span className="sub">{l === 'ar' ? ln.description.en : ln.description.ar}</span>{ln.shipmentRef && <span className="ref ltr">{ln.shipmentRef}{ln.serviceDate ? ` · ${d10(ln.serviceDate)}` : ''}</span>}</td>
                  <td className="n">{ln.qty}</td><td className="n">{n2(ln.unitPrice)}</td><td className="n">{n2(ln.discount)}</td><td className="n">{n2(ln.taxable)}</td>
                  <td className="n">{ln.vatRate}%</td><td className="n">{n2(ln.vat)}</td><td className="n b">{n2(ln.total)}</td>
                </tr>)}
              </tbody>
            </table>}
            {!last && <p className="cont">{l === 'ar' ? 'يتبع في الصفحة التالية…' : 'Continued on next page…'}</p>}
            {last && <>
              <div className="ibottom">
                <div className="totals">
                  <table><tbody>
                    <tr><th><Bi l={l} ar="الإجمالي غير شامل الضريبة" en="Total excl. VAT" /></th><td>{n2(doc.totals.gross)}</td></tr>
                    <tr><th><Bi l={l} ar="إجمالي الخصومات" en="Total discount" /></th><td>{n2(doc.totals.discount)}</td></tr>
                    <tr><th><Bi l={l} ar="الإجمالي الخاضع للضريبة" en="Total taxable amount" /></th><td>{n2(doc.totals.taxable)}</td></tr>
                    <tr><th><Bi l={l} ar={`ضريبة القيمة المضافة ${doc.totals.vatRate}%`} en={`VAT ${doc.totals.vatRate}%`} /></th><td>{n2(doc.totals.vat)}</td></tr>
                    <tr className="grand"><th><Bi l={l} ar="الإجمالي المستحق شامل الضريبة" en="Total amount due incl. VAT" /></th><td>{n2(doc.totals.total)} <small>SAR</small></td></tr>
                    {doc.totals.paid > 0 && <tr><th><Bi l={l} ar="المدفوع" en="Paid" /></th><td>({n2(doc.totals.paid)})</td></tr>}
                    {doc.totals.credited > 0 && <tr><th><Bi l={l} ar="إشعارات دائنة معتمدة" en="Approved credit notes" /></th><td>({n2(doc.totals.credited)})</td></tr>}
                    <tr className="bal"><th><Bi l={l} ar="الرصيد المتبقي" en="Balance due" /></th><td>{n2(doc.totals.balance)} <small>SAR</small></td></tr>
                  </tbody></table>
                </div>
                <div className="zatca">
                  {doc.zatca.qrBase64 ? (qr ? <img src={qr} alt={l === 'ar' ? 'رمز QR للفاتورة (محاكاة)' : 'Invoice QR code (simulated)'} width={128} height={128} /> : <div className="qrph" />) : <div className="qrph">{l === 'ar' ? 'لا رمز للمسودة' : 'No QR for drafts'}</div>}
                  <div className="zinfo">
                    <b>{l === 'ar' ? 'الفوترة الإلكترونية (محاكاة)' : 'E-invoicing (simulated)'}</b>
                    <span>{l === 'ar' ? 'الحالة' : 'Status'}: {(ZSTATUS[doc.zatca.status] ?? [doc.zatca.status, doc.zatca.status])[l === 'ar' ? 0 : 1]}</span>
                    <span className="ltr">UUID: {doc.zatca.uuid}</span>
                    <span className="ltr">ICV: {doc.zatca.icv} · Hash: {doc.zatca.invoiceHash} · PIH: {doc.zatca.previousHash}</span>
                  </div>
                </div>
              </div>
              {(doc.payments.length > 0 || doc.creditNotes.length > 0) && <div className="refs">
                {doc.payments.length > 0 && <div><h3><Bi l={l} ar="المدفوعات المسجلة" en="Recorded payments" /></h3><ul>{doc.payments.map((p) => <li key={p.ref}><span className="ltr">{p.ref}</span> · {d10(p.date)} · {(METHOD[p.method] ?? [p.method, p.method])[l === 'ar' ? 0 : 1]}{p.bankRef ? <> · <span className="ltr">{p.bankRef}</span></> : null} · <b className="ltr">{n2(p.amount)} SAR</b></li>)}</ul></div>}
                {doc.creditNotes.length > 0 && <div><h3><Bi l={l} ar="الإشعارات الدائنة المرتبطة" en="Related credit notes" /></h3><ul>{doc.creditNotes.map((c) => <li key={c.creditNo}><span className="ltr">{c.creditNo}</span> · {d10(c.date)} · {c.reason} · <b className="ltr">{n2(c.amount)} SAR</b></li>)}</ul></div>}
              </div>}
              <div className="bankline"><Bi l={l} ar="الدفع بالتحويل إلى" en="Pay by transfer to" />: <span className="ltr">{doc.seller.bank.iban}</span> — {x(doc.seller.bank.name)} · {l === 'ar' ? 'يُرجى ذكر رقم الفاتورة في مرجع التحويل' : 'Please quote the invoice number as transfer reference'}</div>
              <p className="znote">{x(doc.zatca.note)}</p>
            </>}
            <footer className="ifoot"><span>{x(doc.seller.legalName)} · <span className="ltr">VAT {doc.seller.vatNumber}</span></span><span>{l === 'ar' ? `صفحة ${pi + 1} من ${pages.length}` : `Page ${pi + 1} of ${pages.length}`}</span></footer>
          </section>
        );
      })}
    </div>
  );
}

/** عارض الفاتورة: نافذة كاملة بشريط أدوات (لغة المستند، طباعة، تنزيل PDF) ومعاينة صفحات A4 مصغّرة لتناسب العرض */
export function InvoiceViewer({ id, onClose }: { id: string; onClose(): void }) {
  const { lang, toast } = useApp();
  const d = useQ<InvoiceDocument>('invoice.document', { id }, [id]);
  const [l, setL] = useState<DL>(lang);
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null); const [scale, setScale] = useState(1); const [np, setNp] = useState(1);
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, (el.clientWidth - 24) / 794)));
    ro.observe(el); return () => ro.disconnect();
  }, [d.data]);
  const print = () => {
    // نسخة ثابتة من الأوراق في جذر مستقل تحت body: لا يقصّها إطار الجوال ولا التحجيم ولا طبقات الواجهة
    const sheets = stage.current?.querySelector('.inv-sheets'); if (!sheets) return;
    document.getElementById('inv-print-root')?.remove();
    const root = document.createElement('div'); root.id = 'inv-print-root'; root.appendChild(sheets.cloneNode(true)); document.body.appendChild(root);
    document.body.classList.add('printing-invoice');
    const done = () => { document.body.classList.remove('printing-invoice'); root.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 60);
  };
  const pdf = async () => {
    if (!d.data) return; setBusy(true);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
      const sheets = [...(stage.current?.querySelectorAll<HTMLElement>('.sheet') ?? [])];
      const out = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      out.setProperties({ title: `${d.data.invoice.invoiceNo}`, subject: lang === 'ar' ? 'فاتورة ضريبية (نموذج عرض)' : 'Tax invoice (demo)', creator: 'Atlas Link prototype' });
      for (let i = 0; i < sheets.length; i++) {
        const png = await toPng(sheets[i], { pixelRatio: 2.5, backgroundColor: '#ffffff', cacheBust: true, style: { transform: 'none', margin: '0' } });
        if (i > 0) out.addPage('a4', 'portrait');
        out.addImage(png, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
      out.save(`${d.data.invoice.invoiceNo}.pdf`);
      toast(lang === 'ar' ? 'تم تنزيل ملف PDF' : 'PDF downloaded');
    } catch (e) { toast((lang === 'ar' ? 'تعذّر إنشاء PDF: ' : 'Could not create PDF: ') + String((e as Error)?.message ?? e), 'error'); }
    finally { setBusy(false); }
  };
  useBackgroundLock(true);
  const dlg = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // حبس التركيز داخل العارض (يلزم داخل إطار الجوال حيث ما خارج الإطار ليس خاملاً)
      if (e.key === 'Tab' && dlg.current) {
        const f = [...dlg.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]; if (!f.length) return;
        const a = f[0], z = f[f.length - 1]; const inside = dlg.current.contains(document.activeElement);
        if (!inside) { e.preventDefault(); a.focus(); } else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const closeRef = useRef<HTMLButtonElement>(null); useEffect(() => { setTimeout(() => closeRef.current?.focus(), 50); }, []);
  return (
    <Layer>
      <div ref={dlg} className="inv-viewer" role="dialog" aria-modal="true" aria-label={lang === 'ar' ? 'معاينة الفاتورة الضريبية' : 'Tax invoice preview'}>
        <div className="inv-bar">
          <b>{lang === 'ar' ? 'الفاتورة الضريبية' : 'Tax invoice'} {d.data && <span className="ltr">{d.data.invoice.invoiceNo}</span>}</b>
          <div className="row">
            <div className="inv-seg" role="group" aria-label={lang === 'ar' ? 'لغة المستند' : 'Document language'}>
              <button type="button" aria-pressed={l === 'ar'} className={l === 'ar' ? 'on' : ''} onClick={() => setL('ar')}>العربية</button>
              <button type="button" aria-pressed={l === 'en'} className={l === 'en' ? 'on' : ''} onClick={() => setL('en')}>English</button>
            </div>
            <Btn onClick={print} disabled={!d.data}>{lang === 'ar' ? 'طباعة' : 'Print'}</Btn>
            <Btn kind="primary" onClick={pdf} disabled={!d.data || busy} aria-busy={busy || undefined}>{busy ? (lang === 'ar' ? 'جارٍ الإنشاء…' : 'Generating…') : (lang === 'ar' ? 'تنزيل PDF' : 'Download PDF')}</Btn>
            <button ref={closeRef} type="button" className="x" onClick={onClose} aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}>×</button>
          </div>
        </div>
        <div className="inv-stage" ref={stage} tabIndex={0} aria-label={lang === 'ar' ? 'صفحات الفاتورة (قابلة للتمرير)' : 'Invoice pages (scrollable)'}>
          {d.error ? <ErrorBox error={d.error} /> : !d.data ? <Loading /> : <div className="inv-scale" style={{ '--s': scale, height: `${(1123 * np + 18 * (np - 1)) * scale}px` } as React.CSSProperties}><InvoiceDocumentView doc={d.data} l={l} onPages={setNp} /></div>}
        </div>
      </div>
    </Layer>
  );
}

/** زر يفتح عارض الفاتورة من أي شاشة (الإدارة، البوابة، جوال العميل) */
export function InvoiceDocButton({ id, kind = 'default', label }: { id: string; kind?: 'default' | 'primary' | 'ghost'; label?: string }) {
  const { lang } = useApp(); const [open, setOpen] = useState(false);
  return <>
    <Btn kind={kind} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{label ?? (lang === 'ar' ? 'عرض الفاتورة الضريبية' : 'View tax invoice')}</Btn>
    {open && <InvoiceViewer id={id} onClose={() => setOpen(false)} />}
  </>;
}
void Modal;
