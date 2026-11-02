import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'common.dart';

/// CM09 الفواتير والدفع (المزود محاكى؛ لا خصم فعلي). يمكن اختبار حالة الرفض.
class InvoicesPage extends StatelessWidget {
  const InvoicesPage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('الفواتير', 'Invoices')), actions: const [Padding(padding: EdgeInsetsDirectional.only(end: 12), child: Center(child: SimBadge()))]),
      body: AsyncView<List<Map<String, dynamic>>>(
        reloadKey: st.tick,
        load: () => st.api.list('invoices', sort: 'issueDate'),
        builder: (ctx, rows) => rows.isEmpty ? const EmptyView() : ListView(padding: const EdgeInsets.all(16), children: [
          for (var i = 0; i < rows.length; i++) FadeSlideIn(index: i, child: Padding(padding: const EdgeInsets.only(bottom: 10), child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [Text('${rows[i]['invoiceNo']}', textDirection: TextDirection.ltr, style: const TextStyle(fontWeight: FontWeight.w600)), const Spacer(), StatusPill('${rows[i]['status']}')]),
            const SizedBox(height: 6),
            Text('${s.t('الإجمالي', 'Total')} ${f.sar(rows[i]['total'])} · ${s.t('المتبقي', 'Due')} ${f.sar((rows[i]['total'] as num) - (rows[i]['paid'] as num))}'),
            Text('${s.t('الاستحقاق', 'Due date')} ${f.dt(rows[i]['dueDate'])}', style: TextStyle(color: c.muted, fontSize: 12)),
            if ((rows[i]['total'] as num) > (rows[i]['paid'] as num) && ['issued', 'partially_paid', 'overdue'].contains(rows[i]['status'])) Padding(padding: const EdgeInsets.only(top: 10), child: FilledButton(onPressed: () => _pay(context, st, rows[i]), child: Text(s.t('ادفع الآن', 'Pay now')))),
          ]))))),
        ]),
      ),
    );
  }

  Future<void> _pay(BuildContext context, AppState st, Map inv) async {
    final s = st.s; final f = Fmt(st.lang); bool fail = false; String method = 'card_simulated';
    final due = (inv['total'] as num) - (inv['paid'] as num);
    await showModalBottomSheet(context: context, showDragHandle: true, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${s.t('دفع', 'Pay')} ${f.sar(due)}', style: Theme.of(ctx).textTheme.titleLarge),
      Text(s.t('مزود الدفع غير محدد بعد؛ لا تُخصم أي مبالغ.', 'No payment provider is selected yet; nothing is charged.')),
      const SizedBox(height: 12),
      SegmentedButton<String>(showSelectedIcon: false, segments: [ButtonSegment(value: 'card_simulated', label: Text(s.label('card_simulated'))), ButtonSegment(value: 'sadad_simulated', label: Text(s.label('sadad_simulated')))], selected: {method}, onSelectionChanged: (v) => set(() => method = v.first)),
      SwitchListTile(value: fail, onChanged: (v) => set(() => fail = v), title: Text(s.t('محاكاة رفض العملية', 'Simulate a declined payment'))),
      FilledButton(onPressed: () async {
        try { await st.run('customer.payInvoice', {'invoiceId': inv['id'], 'method': method, 'simulateFailure': fail}); if (ctx.mounted) Navigator.pop(ctx); if (context.mounted) await showSuccess(context, s.t('تم الدفع (محاكاة)', 'Paid (simulated)')); }
        catch (e) { if (ctx.mounted) Navigator.pop(ctx); if (context.mounted) showError(context, e); }
      }, child: Text(s.confirm)),
    ]))));
  }
}
