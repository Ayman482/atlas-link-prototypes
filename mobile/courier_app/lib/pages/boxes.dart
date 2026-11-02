import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';

/// K13 الصناديق بعهدتي مع حالة جهاز GPT45-M المقترن (بيانات محاكاة)
class BoxesPage extends StatelessWidget {
  const BoxesPage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('الصناديق بعهدتي', 'Boxes in my custody'))),
      body: AsyncView<dynamic>(
        reloadKey: st.tick,
        load: () => st.api.query('courier.tasks', {}),
        builder: (ctx, d) {
          final boxes = (d['boxesInCustody'] as List).cast<Map>();
          if (boxes.isEmpty) return const EmptyView(icon: Icons.inventory_2_outlined);
          return ListView(padding: const EdgeInsets.all(16), children: [
            for (var i = 0; i < boxes.length; i++) FadeSlideIn(index: i, child: Card(margin: const EdgeInsets.only(bottom: 10), child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Text('${boxes[i]['code']}', textDirection: TextDirection.ltr, style: const TextStyle(fontWeight: FontWeight.w700)), const Spacer(), StatusPill('${boxes[i]['status']}')]),
              Text('${s.label(boxes[i]['thermalClass'])} · ${boxes[i]['size']}'),
              const SizedBox(height: 6),
              boxes[i]['device'] == null
                  ? StatusPill(null, text: s.t('لا جهاز مقترن', 'No paired device'), tone: Tone.warn)
                  : Row(children: [Expanded(child: Text('GPT45-M ${boxes[i]['device']['imei']} · ${s.t('بطارية', 'battery')} ${boxes[i]['device']['batteryPct'] ?? '—'}% · ${f.dt(boxes[i]['device']['lastSeenAt'])}', style: TextStyle(color: c.muted, fontSize: 12))), const SimBadge()]),
            ])))),
          ]);
        },
      ),
    );
  }
}
