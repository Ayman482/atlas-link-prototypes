import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'task.dart';

const kindLabels = {'pickup': ['استلام', 'Pickup'], 'delivery': ['تسليم', 'Delivery'], 'handover': ['تسليم لشريك', 'Handover'], 'return': ['إرجاع', 'Return'], 'done': ['منجزة', 'Done']};
String kindLabel(String k, String lang) => kindLabels[k]?[lang == 'ar' ? 0 : 1] ?? k;

/// K02 مهام اليوم مرتبة حسب تسلسل المسار؛ المنجزة مطوية
class TasksPage extends StatefulWidget {
  const TasksPage({super.key});
  @override
  State<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends State<TasksPage> {
  bool showDone = false;
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final c = AtlasColors.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('مهام اليوم', 'Today’s tasks'))),
      body: RefreshIndicator(onRefresh: () async => st.refresh(), child: AsyncView<dynamic>(
        reloadKey: st.tick,
        load: () => st.api.query('courier.tasks', {}),
        builder: (ctx, d) {
          final tasks = (d['tasks'] as List).cast<Map<String, dynamic>>();
          final open = tasks.where((t) => t['kind'] != 'done').toList(); final done = tasks.where((t) => t['kind'] == 'done').toList();
          final conflicts = ((d['conflicts'] as List?) ?? []).where((x) => x['resolution'] == 'pending').length;
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              Expanded(child: KpiTile(label: kindLabel('pickup', st.lang), value: open.where((t) => t['kind'] == 'pickup').length, icon: Icons.inventory, highlight: true)),
              const SizedBox(width: 10),
              Expanded(child: KpiTile(label: kindLabel('delivery', st.lang), value: open.where((t) => t['kind'] != 'pickup').length, icon: Icons.local_shipping_outlined)),
              const SizedBox(width: 10),
              Expanded(child: KpiTile(label: s.t('صناديق', 'Boxes'), value: (d['boxesInCustody'] as List).length, icon: Icons.ac_unit)),
            ]),
            if (conflicts > 0) Padding(padding: const EdgeInsets.only(top: 12), child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: c.warningSoft, borderRadius: BorderRadius.circular(14)), child: Text(s.t('لديك $conflicts تعارض مزامنة بانتظار العمليات', 'You have $conflicts sync conflict(s) awaiting operations'), style: TextStyle(color: c.warning)))),
            const SizedBox(height: 14),
            if (open.isEmpty) EmptyView(text: s.t('لا مهام مفتوحة', 'No open tasks'), icon: Icons.task_alt),
            for (var i = 0; i < open.length; i++) _card(context, open[i], i),
            if (done.isNotEmpty) TextButton(onPressed: () => setState(() => showDone = !showDone), child: Text(s.t('المنجزة (${done.length})', 'Completed (${done.length})'))),
            if (showDone) for (var i = 0; i < done.length; i++) _card(context, done[i], i),
          ]);
        },
      )),
    );
  }

  Widget _card(BuildContext context, Map<String, dynamic> t, int i) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context); final cs = Theme.of(context).colorScheme;
    final a = (t['kind'] == 'pickup' ? t['sender'] : t['receiver']) as Map?;
    final hue = {'pickup': c.navy, 'delivery': cs.primary, 'handover': c.warning, 'return': c.critical}[t['kind']] ?? c.success;
    return FadeSlideIn(index: i, child: Padding(padding: const EdgeInsets.only(bottom: 10), child: Card(clipBehavior: Clip.antiAlias, child: InkWell(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TaskPage(id: t['shipmentId']))),
      child: Container(decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: hue, width: 4))), padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Text('#${t['seq'] == 99 ? '—' : t['seq']}  ', style: TextStyle(color: c.muted)), Text(kindLabel('${t['kind']}', st.lang), style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(width: 8), StatusPill('${t['serviceLevel']}'), const Spacer(), StatusPill('${t['status']}')]),
        const SizedBox(height: 6),
        Text('${(a?['label'] as Map?)?[st.lang] ?? ''}'),
        Text('${Fmt.ltr(t['trackingNo'])} · ${s.label(t['thermalClass'])} · ${t['kind'] == 'pickup' ? f.dt(t['pickupWindowStart']) : '${s.d('ship.deliverBy')} ${f.dt(t['deliverBy'])}'}', style: TextStyle(color: c.muted, fontSize: 12)),
      ])),
    ))));
  }
}
