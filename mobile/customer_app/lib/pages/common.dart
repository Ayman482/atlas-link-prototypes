import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';

bool canCreate(List<String> r) => r.any(['corp_admin', 'branch_manager', 'branch_operator', 'individual'].contains);
bool canPay(List<String> r) => r.any(['corp_admin', 'corp_finance', 'individual'].contains);
String? orgId(AppState st) => ((st.me?['organizations'] as List?)?.firstOrNull as Map?)?['id'] as String?;

/// أسماء المدن (تُحمّل مرة عند فتح التطبيق)
final Map<String, Map> cities = {};
Future<void> loadCities(AppState st) async { if (cities.isNotEmpty) return; for (final c in await st.api.list('cities', pageSize: 100)) { cities['${c['code']}'] = c['name'] as Map; } }
String city(String? code, String lang) => (cities[code]?[lang] as String?) ?? (code ?? '—');

/// سهم المسار حسب اتجاه اللغة
String arrow(String lang) => lang == 'ar' ? '←' : '→';

Future<void> showError(BuildContext context, Object e) async {
  final st = AppScope.of(context);
  final msg = e is ApiException ? e.message(st.lang) : '$e';
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: AtlasColors.of(context).critical));
}

class ShipmentCard extends StatelessWidget {
  final Map<String, dynamic> s;
  final VoidCallback onTap;
  final int index;
  const ShipmentCard(this.s, {super.key, required this.onTap, this.index = 0});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final t = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context);
    final status = '${s['status']}';
    final hue = status == 'delivered' ? c.success : ['failed', 'exception'].contains(status) ? c.critical : ['in_transit', 'collected', 'at_handover'].contains(status) ? Theme.of(context).colorScheme.primary : c.navy;
    return FadeSlideIn(index: index, child: Padding(padding: const EdgeInsets.only(bottom: 10), child: Card(clipBehavior: Clip.antiAlias, child: InkWell(onTap: onTap, child: Container(
      decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: hue, width: 4))),
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Text('${s['trackingNo']}', textDirection: TextDirection.ltr, style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600)), const Spacer(), StatusPill(status)]),
        const SizedBox(height: 6),
        Text('${city(s['originCity'], st.lang)} ${arrow(st.lang)} ${city(s['destCity'], st.lang)} · ${t.label(s['thermalClass'])} · ${t.label(s['serviceLevel'])}'),
        Text('${t.d('ship.deliverBy')}: ${f.dt(s['deliverBy'])}', style: TextStyle(color: c.muted, fontSize: 12)),
      ]),
    )))));
  }
}
