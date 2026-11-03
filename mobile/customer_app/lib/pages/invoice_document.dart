import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'common.dart';
import 'invoice_pdf.dart';

/// Phase 17.1 — الفاتورة الضريبية في تطبيق العميل: معاينة ثنائية اللغة من `invoice.document` (نفس مستند الويب)،
/// مع تنزيل/مشاركة PDF بحجم A4 وطباعة عبر حزمة printing. حالة الهيئة وQR محاكاة ومُعلَّمة صراحةً.
class InvoiceDocumentPage extends StatefulWidget {
  final String invoiceId;
  const InvoiceDocumentPage({super.key, required this.invoiceId});
  @override
  State<InvoiceDocumentPage> createState() => _InvoiceDocumentPageState();
}

class _InvoiceDocumentPageState extends State<InvoiceDocumentPage> {
  String? docLang;
  bool busy = false;

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final lang = docLang ?? st.lang; final ar = lang == 'ar';
    String t(String a, String e) => ar ? a : e;
    final c = AtlasColors.of(context); final f = Fmt(lang);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('الفاتورة الضريبية', 'Tax invoice')), actions: const [Padding(padding: EdgeInsetsDirectional.only(end: 12), child: Center(child: SimBadge()))]),
      body: AsyncView<Map<String, dynamic>>(
        reloadKey: st.tick,
        load: () async => Map<String, dynamic>.from(await st.api.query('invoice.document', {'id': widget.invoiceId}) as Map),
        builder: (ctx, d) {
          final inv = d['invoice'] as Map, seller = d['seller'] as Map, buyer = d['buyer'] as Map, totals = d['totals'] as Map, z = d['zatca'] as Map;
          final lines = (d['lines'] as List).cast<Map>();
          Widget kv(String k, String v, {bool ltr = false, bool strong = false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 128, child: Text(k, style: TextStyle(color: c.muted, fontSize: 12.5))),
                Expanded(child: Text(ltr ? Fmt.ltr(v) : v, style: TextStyle(fontSize: 13.5, fontWeight: strong ? FontWeight.w600 : null))),
              ]));
          Widget card(String title, List<Widget> ch) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(color: c.navy, fontWeight: FontWeight.w600)), const SizedBox(height: 6), ...ch])));
          final standard = inv['type'] == 'standard';
          return Directionality(
            textDirection: ar ? TextDirection.rtl : TextDirection.ltr,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              // شريط الإجراءات: لغة المستند + PDF + طباعة
              Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                SegmentedButton<String>(showSelectedIcon: false, segments: const [ButtonSegment(value: 'ar', label: Text('العربية')), ButtonSegment(value: 'en', label: Text('English'))], selected: {lang}, onSelectionChanged: (v) => setState(() => docLang = v.first)),
                FilledButton.icon(key: const Key('inv-pdf'), onPressed: busy ? null : () => _pdf(context, d, lang, share: true), icon: const Icon(Icons.download), label: Text(t('تنزيل PDF', 'Download PDF'))),
                OutlinedButton.icon(onPressed: busy ? null : () => _pdf(context, d, lang, share: false), icon: const Icon(Icons.print_outlined), label: Text(t('طباعة', 'Print'))),
              ]),
              const SizedBox(height: 12),
              Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: c.warningSoft, borderRadius: BorderRadius.circular(10)), child: Text(t('نموذج أولي: بيانات خيالية، وحالة هيئة الزكاة والضريبة والجمارك محاكاة.', 'Prototype: fictional data; ZATCA status is simulated.'), style: TextStyle(color: c.goldText, fontSize: 12.5))),
              const SizedBox(height: 12),
              Text(standard ? t('فاتورة ضريبية', 'Tax Invoice') : t('فاتورة ضريبية مبسطة', 'Simplified Tax Invoice'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: c.navy, fontWeight: FontWeight.w600)),
              Text(Fmt.ltr(inv['invoiceNo']), style: TextStyle(color: c.muted)),
              const SizedBox(height: 10),
              card(t('بيانات الفاتورة', 'Invoice details'), [
                kv(t('تاريخ الإصدار', 'Issue date'), day(inv['issueDate'], lang)),
                kv(t('تاريخ الاستحقاق', 'Due date'), day(inv['dueDate'], lang)),
                kv(t('فترة التوريد', 'Supply period'), '${day(inv['supplyFrom'], lang)} — ${day(inv['supplyTo'], lang)}'),
                kv(t('رقم العقد', 'Contract No.'), '${inv['contractNo'] ?? '—'}', ltr: true),
                Row(children: [SizedBox(width: 128, child: Text(t('الحالة', 'Status'), style: TextStyle(color: c.muted, fontSize: 12.5))), StatusPill('${inv['status']}')]),
              ]),
              card(t('البائع', 'Seller'), [
                kv(t('الاسم', 'Name'), tx(seller['legalName'], lang), strong: true),
                kv(t('الرقم الضريبي', 'VAT No.'), '${seller['vatNumber']}', ltr: true),
                kv(t('السجل التجاري', 'CR No.'), '${seller['crNumber']}', ltr: true),
              ]),
              card(t('المشتري', 'Buyer'), [
                kv(t('الاسم', 'Name'), tx(buyer['legalName'], lang), strong: true),
                kv(t('الرقم الضريبي', 'VAT No.'), '${buyer['vatNumber'] ?? t('غير مسجل', 'Not registered')}', ltr: buyer['vatNumber'] != null),
                kv(t('السجل التجاري', 'CR No.'), '${buyer['crNumber'] ?? '—'}', ltr: true),
              ]),
              card('${t('البنود', 'Line items')} (${lines.length})', [
                for (final l in lines) Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('${l['no']}. ${tx(l['description'], lang)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text('${t('الكمية', 'Qty')} ${l['qty']} × ${money(l['unitPrice'] as num)}${(l['discount'] as num) > 0 ? ' · ${t('خصم', 'Discount')} ${money(l['discount'] as num)}' : ''} · ${t('الضريبة', 'VAT')} ${l['vatRate']}% = ${money(l['vat'] as num)}', style: TextStyle(color: c.muted, fontSize: 12.5)),
                  Align(alignment: AlignmentDirectional.centerEnd, child: Text(f.sar(l['total'] as num), style: const TextStyle(fontWeight: FontWeight.w600))),
                ])),
              ]),
              card(t('الإجماليات', 'Totals'), [
                kv(t('الإجمالي قبل الخصم', 'Gross amount'), f.sar(totals['gross'] as num)),
                kv(t('الخصم', 'Discount'), f.sar(totals['discount'] as num)),
                kv(t('المبلغ الخاضع للضريبة', 'Taxable amount'), f.sar(totals['taxable'] as num)),
                kv('${t('ضريبة القيمة المضافة', 'VAT')} ${totals['vatRate']}%', f.sar(totals['vat'] as num)),
                kv(t('الإجمالي شامل الضريبة', 'Total incl. VAT'), f.sar(totals['total'] as num), strong: true),
                kv(t('المدفوع', 'Paid'), f.sar(totals['paid'] as num)),
                if ((totals['credited'] as num) > 0) kv(t('إشعارات دائنة', 'Credit notes'), f.sar(totals['credited'] as num)),
                kv(t('الرصيد المستحق', 'Balance due'), f.sar(totals['balance'] as num), strong: true),
              ]),
              card(t('الفوترة الإلكترونية (محاكاة)', 'E-invoicing (simulated)'), [
                if (z['qrBase64'] != null) Center(child: Container(color: Colors.white, padding: const EdgeInsets.all(8), child: QrImageView(data: '${z['qrBase64']}', size: 160, semanticsLabel: t('رمز QR للفاتورة (محاكاة)', 'Invoice QR code (simulated)')))),
                kv('UUID', '${z['uuid']}', ltr: true),
                kv(t('عداد الفاتورة (ICV)', 'Invoice counter (ICV)'), '${z['icv']}', ltr: true),
                kv(t('حالة الهيئة', 'Authority status'), S(lang).label('${z['status']}')),
                const SizedBox(height: 6),
                Text(tx(z['note'], lang), style: TextStyle(color: c.goldText, fontSize: 12)),
              ]),
            ]),
          );
        },
      ),
    );
  }

  Future<void> _pdf(BuildContext context, Map<String, dynamic> d, String lang, {required bool share}) async {
    setState(() => busy = true);
    try {
      final bytes = await buildInvoicePdf(d, lang);
      final name = '${(d['invoice'] as Map)['invoiceNo']}_$lang.pdf';
      if (share) { await Printing.sharePdf(bytes: bytes, filename: name); } else { await Printing.layoutPdf(onLayout: (_) async => bytes, name: name); }
    } catch (e) { if (context.mounted) await showError(context, e); }
    finally { if (mounted) setState(() => busy = false); }
  }
}
