import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'task.dart';
import 'tasks.dart';

/// K03 المسار: ترتيب التوقفات المسند من الإرسال مع مخطط بسيط لمواقع العناوين (ليست مواقع لحظية).
/// الملاحة الفعلية تُفتح في تطبيق الخرائط على الجهاز عند الإنتاج.
class RouteMapPage extends StatelessWidget {
  const RouteMapPage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final c = AtlasColors.of(context); final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('المسار', 'Route'))),
      body: AsyncView<dynamic>(
        reloadKey: st.tick,
        load: () => st.api.query('courier.tasks', {}),
        builder: (ctx, d) {
          final open = (d['tasks'] as List).cast<Map<String, dynamic>>().where((t) => t['kind'] != 'done').toList();
          final pts = [for (final t in open) (t, (t['kind'] == 'pickup' ? t['sender'] : t['receiver']) as Map?)].where((p) => p.$2 != null).toList();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SizedBox(height: 220, child: CustomPaint(painter: _StopsPainter([for (final p in pts) (p.$2!['lat'] as num).toDouble()], [for (final p in pts) (p.$2!['lng'] as num).toDouble()], [for (final p in pts) p.$1['kind'] == 'pickup'], cs.primary, c.navy, c.line))),
              const SizedBox(height: 8),
              Wrap(spacing: 12, children: [_dot(c.navy, kindLabel('pickup', st.lang)), _dot(cs.primary, kindLabel('delivery', st.lang)), SimBadge(text: s.t('عناوين مسندة — ليست مواقع لحظية', 'Assigned addresses — not live positions'))]),
            ]))),
            const SizedBox(height: 12),
            for (var i = 0; i < pts.length; i++) FadeSlideIn(index: i, child: Card(margin: const EdgeInsets.only(bottom: 8), child: ListTile(
              leading: CircleAvatar(backgroundColor: pts[i].$1['kind'] == 'pickup' ? c.navy : cs.primary, foregroundColor: Colors.white, child: Text('${pts[i].$1['seq'] == 99 ? '—' : pts[i].$1['seq']}')),
              title: Text('${(pts[i].$2!['label'] as Map)[st.lang]}'),
              subtitle: Text('${kindLabel('${pts[i].$1['kind']}', st.lang)} · ${pts[i].$1['trackingNo']}'),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TaskPage(id: pts[i].$1['shipmentId']))),
            ))),
          ]);
        },
      ),
    );
  }
  Widget _dot(Color col, String t) => Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 10, height: 10, decoration: BoxDecoration(color: col, shape: BoxShape.circle)), const SizedBox(width: 4), Text(t, style: const TextStyle(fontSize: 12))]);
}

class _StopsPainter extends CustomPainter {
  final List<double> lat, lng; final List<bool> pickup; final Color a, b, grid;
  _StopsPainter(this.lat, this.lng, this.pickup, this.a, this.b, this.grid);
  @override
  void paint(Canvas c, Size s) {
    final g = Paint()..color = grid..strokeWidth = 1;
    for (var i = 1; i < 6; i++) { c.drawLine(Offset(0, s.height * i / 6), Offset(s.width, s.height * i / 6), g); c.drawLine(Offset(s.width * i / 6, 0), Offset(s.width * i / 6, s.height), g); }
    if (lat.isEmpty) return;
    final minLa = lat.reduce((x, y) => x < y ? x : y), maxLa = lat.reduce((x, y) => x > y ? x : y), minLo = lng.reduce((x, y) => x < y ? x : y), maxLo = lng.reduce((x, y) => x > y ? x : y);
    Offset p(int i) => Offset(16 + (lng[i] - minLo) / ((maxLo - minLo) == 0 ? 1 : (maxLo - minLo)) * (s.width - 32), 16 + (maxLa - lat[i]) / ((maxLa - minLa) == 0 ? 1 : (maxLa - minLa)) * (s.height - 32));
    final path = Path()..moveTo(p(0).dx, p(0).dy);
    for (var i = 1; i < lat.length; i++) { path.lineTo(p(i).dx, p(i).dy); }
    c.drawPath(path, Paint()..color = a.withValues(alpha: .5)..strokeWidth = 2..style = PaintingStyle.stroke);
    for (var i = 0; i < lat.length; i++) { c.drawCircle(p(i), 7, Paint()..color = pickup[i] ? b : a); c.drawCircle(p(i), 7, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2); }
  }
  @override
  bool shouldRepaint(_StopsPainter o) => true;
}
