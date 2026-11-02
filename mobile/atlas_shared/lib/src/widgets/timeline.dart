import 'package:flutter/material.dart';
import '../theme/atlas_theme.dart';
import '../l10n/strings.dart';
import '../format.dart';
import '../motion.dart';

/// خط زمني بمصدر كل حدث؛ كل حدث قابل للتوسيع لعرض وقت الجهاز ووقت الاستلام والتأخير والتفاصيل
class AtlasTimeline extends StatefulWidget {
  final List<Map<String, dynamic>> items;
  const AtlasTimeline({super.key, required this.items});
  @override
  State<AtlasTimeline> createState() => _AtlasTimelineState();
}

class _AtlasTimelineState extends State<AtlasTimeline> {
  final _open = <int>{};
  static const _src = {'device': ['جهاز التتبع', 'Tracker device'], 'courier_app': ['تطبيق المندوب', 'Courier app'], 'offline_sync': ['مزامنة بعد انقطاع', 'Offline sync'], 'carrier': ['الناقل', 'Carrier'], 'admin': ['العمليات', 'Operations'], 'system': ['النظام', 'System'], 'warehouse': ['المستودع', 'Warehouse'], 'customer': ['العميل', 'Customer']};
  @override
  Widget build(BuildContext context) {
    final s = S(Localizations.localeOf(context).languageCode); final f = Fmt(s.lang); final c = AtlasColors.of(context); final cs = Theme.of(context).colorScheme;
    final items = widget.items.reversed.toList();
    return Column(children: [for (var i = 0; i < items.length; i++) _row(context, items[i], i, s, f, c, cs, i == items.length - 1)]);
  }

  Widget _row(BuildContext context, Map<String, dynamic> e, int i, S s, Fmt f, AtlasColors c, ColorScheme cs, bool last) {
    final kind = '${e['kind']}';
    final dot = kind == 'excursion' ? c.critical : kind == 'pod' ? c.success : kind == 'attempt' ? c.warning : cs.primary;
    final title = (e['title'] as Map?)?[s.lang] ?? '';
    final src = _src['${e['source']}']?[s.ar ? 0 : 1] ?? '${e['source']}';
    final lag = e['receivedAt'] != null ? DateTime.parse(e['receivedAt']).difference(DateTime.parse(e['at'])).inMinutes : 0;
    final open = _open.contains(i);
    return FadeSlideIn(index: i, child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(width: 24, child: Column(children: [
        Container(margin: const EdgeInsets.only(top: 14), width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: i == 0 ? dot : cs.surface, border: Border.all(color: dot, width: 3))),
        if (!last) Expanded(child: Container(width: 2, color: c.line)),
      ])),
      Expanded(child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => setState(() => open ? _open.remove(i) : _open.add(i)),
        child: Semantics(button: true, expanded: open, child: Padding(padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text('$title', style: const TextStyle(fontWeight: FontWeight.w600))), if (lag > 5) Padding(padding: const EdgeInsetsDirectional.only(start: 6), child: Text(s.t('وصل متأخراً', 'Late'), style: TextStyle(color: c.warning, fontSize: 11))), AnimatedRotation(turns: open ? .5 : 0, duration: Motion.d(context, const Duration(milliseconds: 160)), child: Icon(Icons.expand_more, size: 18, color: c.muted))]),
          Text('${f.dt(e['at'])} · $src', style: TextStyle(fontSize: 12, color: c.muted)),
          AnimatedSize(duration: Motion.d(context, const Duration(milliseconds: 220)), curve: Curves.easeOut, child: !open ? const SizedBox(width: double.infinity) : Padding(padding: const EdgeInsets.only(top: 8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _kv(s.t('وقت الحدث (الجهاز/الميدان)', 'Event time (device/field)'), f.dt(e['at']), c),
            _kv(s.t('وقت الاستلام في النظام', 'Received by system'), e['receivedAt'] == null ? '—' : '${f.dt(e['receivedAt'])}${lag > 0 ? s.t(' · بعد $lag د', ' · $lag min later') : ''}', c),
            if (e['detail'] != null) _kv(s.t('التفاصيل', 'Details'), '${e['detail']}', c),
          ]))),
        ]))),
      )),
    ])));
  }

  Widget _kv(String k, String v, AtlasColors c) => Padding(padding: const EdgeInsets.only(bottom: 4), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(k, style: TextStyle(fontSize: 11, color: c.muted)), Text(v, style: const TextStyle(fontSize: 13))]));
}
