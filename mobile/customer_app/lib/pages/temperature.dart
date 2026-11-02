import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';

/// CM06 تقرير الحرارة: تنبيه أن البيانات عرض وأن القرار السريري للمؤسسة المستلمة، الملخص، المنحنى التفاعلي، الفجوات والانحرافات
class TemperaturePage extends StatelessWidget {
  final String id;
  const TemperaturePage({super.key, required this.id});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('تقرير الحرارة', 'Temperature report'))),
      body: AsyncView<dynamic>(
        load: () => st.api.query('shipment.temperatureReport', {'id': id}),
        builder: (ctx, r) {
          final sum = r['summary'] as Map; final prof = r['profile'] as Map;
          final ex = (r['excursions'] as List).cast<Map>();
          return ListView(padding: const EdgeInsets.all(16), children: [
            if (ex.any((e) => e['status'] == 'open')) Container(margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: c.criticalSoft, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.critical)), child: Row(children: [Pulse(color: c.critical, size: 8), const SizedBox(width: 8), Expanded(child: Text(s.t('انحراف حراري مفتوح على هذه الشحنة', 'Open temperature excursion on this shipment'), style: TextStyle(color: c.critical, fontWeight: FontWeight.w600)))])),
            Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: c.goldSoft, borderRadius: BorderRadius.circular(14)), child: Text('${(r['disclaimer'] as Map)[st.lang]}', style: TextStyle(color: c.goldText))),
            const SizedBox(height: 12),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${(prof['name'] as Map)[st.lang]} (${Fmt(st.lang).temp(prof['minC'] as num?)} … ${Fmt(st.lang).temp(prof['maxC'] as num?)})', style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Text('${s.t('قراءات', 'Readings')}: ${sum['count']} · ${s.d('ship.inRange')}: ${sum['inRangePct'] ?? '—'}% · ${s.d('ship.gap')}: ${sum['gapMinutes']} ${s.t('د', 'min')}'),
              const SizedBox(height: 14),
              TempChart(report: Map<String, dynamic>.from(r)),
            ]))),
            for (final g in (r['gaps'] as List).cast<Map>()) Card(child: ListTile(leading: const Icon(Icons.signal_wifi_off), title: Text('${s.d('ship.gap')} ${g['minutes']} ${s.t('دقيقة', 'min')}'), subtitle: Text('${f.dt(g['from'])} ${st.lang == 'ar' ? '←' : '→'} ${f.dt(g['to'])}\n${(g['reason'] as Map)[st.lang]}'))),
            for (final e in ex) Card(child: ListTile(leading: Icon(Icons.thermostat, color: c.critical), title: Text('${s.t('انحراف', 'Excursion')} · ${f.temp(e['peakC'])}'), subtitle: Text(f.dt(e['startedAt'])), trailing: StatusPill('${e['status']}'))),
          ]);
        },
      ),
    );
  }
}
