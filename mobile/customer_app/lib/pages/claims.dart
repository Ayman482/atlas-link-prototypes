import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'track.dart';

/// CM10 المطالبات: الحالة والمبلغ المطالب والمعتمد؛ تقديم مطالبة يتم من صفحة الشحنة
class ClaimsPage extends StatelessWidget {
  const ClaimsPage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('المطالبات', 'Claims'))),
      body: AsyncView<List<Map<String, dynamic>>>(
        reloadKey: st.tick,
        load: () => st.api.list('claims', sort: 'createdAt'),
        builder: (ctx, rows) => ListView(padding: const EdgeInsets.all(16), children: [
          Text(s.t('لتقديم مطالبة افتح الشحنة واختر «تقديم مطالبة».', 'To file a claim, open the shipment and choose “File claim”.')),
          const SizedBox(height: 10),
          if (rows.isEmpty) const EmptyView(),
          for (var i = 0; i < rows.length; i++) FadeSlideIn(index: i, child: Card(child: ListTile(
            title: Text('${rows[i]['code']} · ${s.label(rows[i]['claimType'])}'),
            subtitle: Text('${f.sar(rows[i]['claimedAmount'])}${rows[i]['approvedAmount'] != null && ['approved', 'closed'].contains(rows[i]['status']) ? ' ${st.lang == 'ar' ? '←' : '→'} ${f.sar(rows[i]['approvedAmount'])}' : ''}\n${f.dt(rows[i]['createdAt'])}'),
            isThreeLine: true,
            trailing: StatusPill('${rows[i]['status']}'),
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TrackPage(id: rows[i]['shipmentId']))),
          ))),
        ]),
      ),
    );
  }
}
