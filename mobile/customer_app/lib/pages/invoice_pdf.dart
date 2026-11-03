import 'dart:typed_data';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:atlas_shared/atlas_shared.dart';

/// Phase 17.1 — ملف PDF للفاتورة الضريبية (A4) من مستند `invoice.document` نفسه الذي يعرضه الويب.
/// العربية بخط Noto Sans Arabic (من atlas_shared) واللاتينية بخط DejaVu Sans احتياطياً؛ الاتجاه يتبع لغة المستند.
/// رمز QR بصيغة TLV محاكاة — لا ختم تشفيري ولا تحقق من الهيئة (يظهر ذلك صراحةً في الملف).
String money(num? h) {
  if (h == null) return '—';
  final v = (h / 100).toStringAsFixed(2).split('.');
  return '${v[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',')}.${v[1]}';
}

/// تاريخ الفاتورة بلا وقت (بتوقيت الرياض): «03 سبتمبر 2026» / «03 Sep 2026»
String day(Object? iso, String lang) {
  final d = DateTime.tryParse('${iso ?? ''}')?.toUtc().add(const Duration(hours: 3));
  if (d == null) return '—';
  const arM = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const enM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${d.day.toString().padLeft(2, '0')} ${(lang == 'ar' ? arM : enM)[d.month - 1]} ${d.year}';
}

String tx(Object? l, String lang) => l is Map ? '${l[lang] ?? l['ar'] ?? ''}' : (l == null ? '—' : '$l');

Future<Uint8List> buildInvoicePdf(Map<String, dynamic> d, String lang) async {
  final ar = lang == 'ar';
  final sep = ar ? '، ' : ', ';
  String t(String a, String e) => ar ? a : e;
  final arR = pw.Font.ttf(await rootBundle.load('packages/atlas_shared/assets/fonts/NotoSansArabic-Regular.ttf'));
  final arB = pw.Font.ttf(await rootBundle.load('packages/atlas_shared/assets/fonts/NotoSansArabic-SemiBold.ttf'));
  final laR = pw.Font.ttf(await rootBundle.load('assets/fonts/DejaVuSans.ttf'));
  final laB = pw.Font.ttf(await rootBundle.load('assets/fonts/DejaVuSans-Bold.ttf'));
  final theme = ar
      ? pw.ThemeData.withFont(base: arR, bold: arB, fontFallback: [laR, laB])
      : pw.ThemeData.withFont(base: laR, bold: laB, fontFallback: [arR, arB]);
  final inv = d['invoice'] as Map, seller = d['seller'] as Map, buyer = d['buyer'] as Map, totals = d['totals'] as Map, z = d['zatca'] as Map;
  final lines = (d['lines'] as List).cast<Map>();
  final dir = ar ? pw.TextDirection.rtl : pw.TextDirection.ltr;
  const ink = PdfColor.fromInt(0xFF0F2E2A), emerald = PdfColor.fromInt(0xFF0E7C66), soft = PdfColor.fromInt(0xFFE8F3EF), line = PdfColor.fromInt(0xFFD5E2DD), muted = PdfColor.fromInt(0xFF5B6B67);
  pw.Widget kv(String k, String v, {bool ltr = false}) => pw.Padding(padding: const pw.EdgeInsets.only(bottom: 2), child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.SizedBox(width: 92, child: pw.Text(k, style: const pw.TextStyle(fontSize: 7.5, color: muted))),
        pw.Expanded(child: pw.Text(v, style: const pw.TextStyle(fontSize: 8), textDirection: ltr ? pw.TextDirection.ltr : null)),
      ]));
  final sa = seller['address'] as Map, ba = buyer['address'] as Map;
  final standard = inv['type'] == 'standard';
  final doc = pw.Document(title: '${inv['invoiceNo']}', author: tx(seller['legalName'], 'en'), creator: 'Atlas Link (prototype)');
  doc.addPage(pw.MultiPage(
    pageFormat: PdfPageFormat.a4,
    theme: theme,
    textDirection: dir,
    margin: const pw.EdgeInsets.fromLTRB(32, 28, 32, 28),
    header: (ctx) => ctx.pageNumber == 1
        ? pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
            pw.Container(color: const PdfColor.fromInt(0xFFFFF4D6), padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4), child: pw.Text(t('نموذج أولي — بيانات خيالية وحالة الهيئة محاكاة', 'Prototype — fictional data, simulated authority status'), style: const pw.TextStyle(fontSize: 7.5, color: PdfColor.fromInt(0xFF7A5200)))),
            pw.SizedBox(height: 10),
            pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Text(tx(seller['legalName'], lang), style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: ink)),
                pw.Text('${sa['building']} ${[tx(sa['street'], lang), tx(sa['district'], lang), '${tx(sa['city'], lang)} ${sa['postalCode']}'].join(sep)}', style: const pw.TextStyle(fontSize: 7.5, color: muted)),
              ])),
              pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
                pw.Text(standard ? t('فاتورة ضريبية', 'Tax Invoice') : t('فاتورة ضريبية مبسطة', 'Simplified Tax Invoice'), style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: emerald)),
                pw.Text(standard ? (ar ? 'Tax Invoice' : 'فاتورة ضريبية') : (ar ? 'Simplified Tax Invoice' : 'فاتورة ضريبية مبسطة'), textDirection: ar ? pw.TextDirection.ltr : pw.TextDirection.rtl, style: const pw.TextStyle(fontSize: 8, color: muted)),
              ]),
            ]),
            pw.Divider(color: emerald, thickness: 1.2),
          ])
        : pw.Padding(padding: const pw.EdgeInsets.only(bottom: 8), child: pw.Text('${inv['invoiceNo']} — ${t('تابع', 'continued')}', style: const pw.TextStyle(fontSize: 8, color: muted))),
    footer: (ctx) => pw.Row(children: [
      pw.Expanded(child: pw.Text('${t('الرقم الضريبي للبائع', 'Seller VAT No.')} ${seller['vatNumber']} · ${t('السجل التجاري', 'CR')} ${seller['crNumber']}', style: const pw.TextStyle(fontSize: 7, color: muted))),
      pw.Text(t('صفحة ${ctx.pageNumber} من ${ctx.pagesCount}', 'Page ${ctx.pageNumber} of ${ctx.pagesCount}'), style: const pw.TextStyle(fontSize: 7, color: muted)),
    ]),
    build: (ctx) => [
      // البيانات الأساسية
      pw.Container(padding: const pw.EdgeInsets.all(8), decoration: pw.BoxDecoration(color: soft, borderRadius: pw.BorderRadius.circular(4)), child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(child: pw.Column(children: [kv(t('رقم الفاتورة', 'Invoice No.'), '${inv['invoiceNo']}', ltr: true), kv(t('تاريخ الإصدار', 'Issue date'), day(inv['issueDate'], lang)), kv(t('تاريخ الاستحقاق', 'Due date'), day(inv['dueDate'], lang))])),
        pw.SizedBox(width: 12),
        pw.Expanded(child: pw.Column(children: [kv(t('فترة التوريد', 'Supply period'), '${day(inv['supplyFrom'], lang)} — ${day(inv['supplyTo'], lang)}'), kv(t('رقم العقد', 'Contract No.'), '${inv['contractNo'] ?? '—'}', ltr: true), kv(t('العملة', 'Currency'), t('ريال سعودي (SAR)', 'Saudi Riyal (SAR)'))])),
      ])),
      pw.SizedBox(height: 10),
      // البائع والمشتري
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(child: _party(t('البائع', 'Seller'), [
          kv(t('الاسم', 'Name'), tx(seller['legalName'], lang)),
          kv(t('الرقم الضريبي', 'VAT No.'), '${seller['vatNumber']}', ltr: true),
          kv(t('السجل التجاري', 'CR No.'), '${seller['crNumber']}', ltr: true),
          kv(t('العنوان الوطني', 'National address'), '${[sa['building'], tx(sa['street'], lang), tx(sa['district'], lang), '${tx(sa['city'], lang)} ${sa['postalCode']}'].join(sep)} — ${t('الرقم الإضافي', 'Add. No.')} ${sa['additionalNo']}'),
        ], emerald)),
        pw.SizedBox(width: 10),
        pw.Expanded(child: _party(t('المشتري', 'Buyer'), [
          kv(t('الاسم', 'Name'), tx(buyer['legalName'], lang)),
          kv(t('الرقم الضريبي', 'VAT No.'), '${buyer['vatNumber'] ?? t('غير مسجل', 'Not registered')}', ltr: buyer['vatNumber'] != null),
          kv(t('السجل التجاري', 'CR No.'), '${buyer['crNumber'] ?? '—'}', ltr: true),
          kv(t('العنوان', 'Address'), [if (ba['district'] != null) tx(ba['district'], lang), tx(ba['city'], lang), tx(ba['country'], lang)].join(sep)),
        ], emerald)),
      ]),
      pw.SizedBox(height: 10),
      // البنود
      pw.TableHelper.fromTextArray(
        headers: ['#', t('الوصف', 'Description'), t('الكمية', 'Qty'), t('سعر الوحدة', 'Unit price'), t('الخصم', 'Discount'), t('المبلغ الخاضع', 'Taxable'), t('الضريبة %', 'VAT %'), t('الضريبة', 'VAT'), t('الإجمالي', 'Total')],
        data: [for (final l in lines) ['${l['no']}', '${tx(l['description'], lang)}${l['shipmentRef'] != null ? '\n${l['shipmentRef']}' : ''}', '${l['qty']}', money(l['unitPrice'] as num), money(l['discount'] as num), money(l['taxable'] as num), '${l['vatRate']}%', money(l['vat'] as num), money(l['total'] as num)]],
        headerStyle: pw.TextStyle(fontSize: 7, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
        headerDecoration: const pw.BoxDecoration(color: emerald),
        cellStyle: const pw.TextStyle(fontSize: 7.2),
        cellAlignments: {0: pw.Alignment.center, 1: ar ? pw.Alignment.centerRight : pw.Alignment.centerLeft, for (var i = 2; i < 9; i++) i: pw.Alignment.centerRight},
        columnWidths: {0: const pw.FixedColumnWidth(18), 1: const pw.FlexColumnWidth(3.2), 2: const pw.FixedColumnWidth(26), for (var i = 3; i < 9; i++) i: const pw.FlexColumnWidth(1.25)},
        border: const pw.TableBorder(horizontalInside: pw.BorderSide(color: line, width: .5), bottom: pw.BorderSide(color: line, width: .5)),
        rowDecoration: const pw.BoxDecoration(),
        oddRowDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF6FAF8)),
        cellPadding: const pw.EdgeInsets.symmetric(horizontal: 3, vertical: 3),
      ),
      pw.SizedBox(height: 10),
      // الإجماليات + QR
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          if (z['qrBase64'] != null) pw.BarcodeWidget(barcode: pw.Barcode.qrCode(), data: '${z['qrBase64']}', width: 92, height: 92, drawText: false),
          pw.SizedBox(height: 4),
          pw.Text(t('بيانات الفوترة الإلكترونية (محاكاة)', 'E-invoicing data (simulated)'), style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold)),
          kv('UUID', '${z['uuid']}', ltr: true),
          kv(t('عداد الفاتورة (ICV)', 'Invoice counter (ICV)'), '${z['icv']}', ltr: true),
          kv(t('حالة الهيئة', 'Authority status'), S(lang).label('${z['status']}')),
        ])),
        pw.SizedBox(width: 14),
        pw.SizedBox(width: 220, child: pw.Column(children: [
          _tot(t('الإجمالي قبل الخصم', 'Gross amount'), money(totals['gross'] as num)),
          _tot(t('الخصم', 'Discount'), money(totals['discount'] as num)),
          _tot(t('المبلغ الخاضع للضريبة', 'Taxable amount'), money(totals['taxable'] as num)),
          _tot(t('ضريبة القيمة المضافة ${totals['vatRate']}%', 'VAT ${totals['vatRate']}%'), money(totals['vat'] as num)),
          pw.Container(color: emerald, child: _tot(t('الإجمالي شامل الضريبة (ر.س)', 'Total incl. VAT (SAR)'), money(totals['total'] as num), bold: true, color: PdfColors.white)),
          _tot(t('المدفوع', 'Paid'), money(totals['paid'] as num)),
          if ((totals['credited'] as num) > 0) _tot(t('إشعارات دائنة', 'Credit notes'), money(totals['credited'] as num)),
          _tot(t('الرصيد المستحق', 'Balance due'), money(totals['balance'] as num), bold: true),
        ])),
      ]),
      if ((d['payments'] as List).isNotEmpty || (d['creditNotes'] as List).isNotEmpty) ...[
        pw.SizedBox(height: 8),
        pw.Text(t('المدفوعات والإشعارات الدائنة', 'Payments and credit notes'), style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
        for (final p in (d['payments'] as List).cast<Map>()) kv('${p['ref']}', '${day(p['date'], lang)} · ${money(p['amount'] as num)} ${t('ر.س', 'SAR')}${p['bankRef'] != null ? ' · ${p['bankRef']}' : ''}'),
        for (final c in (d['creditNotes'] as List).cast<Map>()) kv('${c['creditNo']}', '${day(c['date'], lang)} · ${money(c['amount'] as num)} ${t('ر.س', 'SAR')} · ${c['reason']}'),
      ],
      pw.SizedBox(height: 8),
      kv(t('الحساب البنكي (IBAN)', 'Bank account (IBAN)'), '${(seller['bank'] as Map)['iban']}', ltr: true),
      pw.SizedBox(height: 6),
      pw.Container(padding: const pw.EdgeInsets.all(6), decoration: pw.BoxDecoration(border: pw.Border.all(color: const PdfColor.fromInt(0xFFE0B54A), width: .6)), child: pw.Text(tx(z['note'], lang), style: const pw.TextStyle(fontSize: 7, color: PdfColor.fromInt(0xFF7A5200)))),
    ],
  ));
  return doc.save();
}

pw.Widget _party(String title, List<pw.Widget> rows, PdfColor c) => pw.Container(
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(border: pw.Border.all(color: const PdfColor.fromInt(0xFFD5E2DD), width: .6), borderRadius: pw.BorderRadius.circular(4)),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [pw.Text(title, style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: c)), pw.SizedBox(height: 4), ...rows]),
    );

pw.Widget _tot(String k, String v, {bool bold = false, PdfColor? color}) => pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
      child: pw.Row(children: [
        pw.Expanded(child: pw.Text(k, style: pw.TextStyle(fontSize: 8, fontWeight: bold ? pw.FontWeight.bold : null, color: color))),
        pw.Text(v, textDirection: pw.TextDirection.ltr, style: pw.TextStyle(fontSize: 8.5, fontWeight: bold ? pw.FontWeight.bold : null, color: color)),
      ]),
    );
