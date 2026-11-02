import 'package:flutter/material.dart';
import '../theme/atlas_theme.dart';
import '../l10n/strings.dart';
import '../format.dart';
import '../motion.dart';

/// منحنى حرارة تفاعلي: اختيار النطاق (1س/6س/24س/الكل)، لمس أو سحب لقراءة كل نقطة، خطا الحدين، والفجوات مظللة صراحةً.
/// الخط يُرسم تدريجياً (300ms) ويظهر مكتملاً مع تقليل الحركة.
class TempChart extends StatefulWidget {
  final Map<String, dynamic> report;
  const TempChart({super.key, required this.report});
  @override
  State<TempChart> createState() => _TempChartState();
}

class _TempChartState extends State<TempChart> with SingleTickerProviderStateMixin {
  String range = 'all';
  int? sel;
  late final AnimationController _draw = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  @override
  void didChangeDependencies() { super.didChangeDependencies(); Motion.reduced(context) ? _draw.value = 1 : _draw.forward(from: 0); }
  @override
  void dispose() { _draw.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final s = S(Localizations.localeOf(context).languageCode); final f = Fmt(s.lang); final c = AtlasColors.of(context); final cs = Theme.of(context).colorScheme;
    final all = ((widget.report['readings'] as List?) ?? const []).cast<Map>().where((r) => r['c'] != null).toList();
    if (all.isEmpty) return Padding(padding: const EdgeInsets.all(16), child: Text(s.t('لا قراءات لهذه الشحنة بعد', 'No readings for this shipment yet')));
    final last = DateTime.parse(all.last['t']);
    final hours = {'1h': 1, '6h': 6, '24h': 24}[range];
    final pts = hours == null ? all : all.where((r) => last.difference(DateTime.parse(r['t'])).inMinutes <= hours * 60).toList();
    final prof = widget.report['profile'] as Map; final minC = (prof['minC'] as num).toDouble(); final maxC = (prof['maxC'] as num).toDouble();
    final gaps = ((widget.report['gaps'] as List?) ?? const []).cast<Map>();
    final p = sel != null && sel! < pts.length ? pts[sel!] : null;
    bool out(num v) => v > maxC || v < minC;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SegmentedButton<String>(
        segments: [for (final r in ['1h', '6h', '24h', 'all']) ButtonSegment(value: r, label: Text(r == 'all' ? s.t('الكل', 'All') : s.ar ? r.replaceAll('h', ' س') : r))],
        selected: {range},
        showSelectedIcon: false,
        onSelectionChanged: (v) { setState(() { range = v.first; sel = null; }); if (!Motion.reduced(context)) _draw.forward(from: 0); },
      ),
      const SizedBox(height: 8),
      Semantics(
        liveRegion: true,
        child: Text(p == null ? s.t('المس المنحنى أو اسحب لقراءة كل نقطة', 'Touch or drag the chart to read each point') : '${f.temp(p['c'])} · ${f.dt(p['t'])}${out(p['c']) ? s.t(' · خارج النطاق', ' · Out of range') : ''}', style: TextStyle(color: p != null && out(p['c']) ? c.critical : c.muted, fontWeight: p != null ? FontWeight.w600 : FontWeight.w400)),
      ),
      const SizedBox(height: 6),
      LayoutBuilder(builder: (ctx, box) {
        void pick(Offset o) { final x = (o.dx / box.maxWidth).clamp(0.0, 1.0); setState(() => sel = (x * (pts.length - 1)).round()); }
        return GestureDetector(
          onTapDown: (d) => pick(d.localPosition),
          onHorizontalDragUpdate: (d) => pick(d.localPosition),
          child: Semantics(
            label: s.t('منحنى الحرارة: ${pts.length} قراءة، النطاق المسموح ${minC.toStringAsFixed(1)} إلى ${maxC.toStringAsFixed(1)} درجة', 'Temperature chart: ${pts.length} readings, allowed range ${minC.toStringAsFixed(1)} to ${maxC.toStringAsFixed(1)} °C'),
            child: AnimatedBuilder(animation: _draw, builder: (_, __) => CustomPaint(
              size: Size(box.maxWidth, 200),
              painter: _ChartPainter(pts: pts, gaps: gaps, minC: minC, maxC: maxC, progress: _draw.value, sel: sel, line: cs.primary, band: c.successSoft, bandLine: c.success, crit: c.critical, grid: c.line, label: c.muted, rtl: Directionality.of(context) == TextDirection.rtl),
            )),
          ),
        );
      }),
      const SizedBox(height: 8),
      Wrap(spacing: 14, runSpacing: 4, children: [
        _legend(c.successSoft, s.t('النطاق ${f.temp(minC)} إلى ${f.temp(maxC)} (غير معتمد بعد)', 'Range ${f.temp(minC)} to ${f.temp(maxC)} (not yet approved)'), c),
        _legend(c.line, s.t('فجوة بيانات — لا تعني الالتزام', 'Data gap — does not imply compliance'), c),
        _legend(c.critical, s.t('خارج النطاق', 'Out of range'), c),
      ]),
    ]);
  }

  Widget _legend(Color col, String t, AtlasColors c) => Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 12, height: 10, decoration: BoxDecoration(color: col, borderRadius: BorderRadius.circular(3))), const SizedBox(width: 6), Text(t, style: TextStyle(fontSize: 11, color: c.muted))]);
}

class _ChartPainter extends CustomPainter {
  final List<Map> pts; final List<Map> gaps; final double minC, maxC, progress; final int? sel;
  final Color line, band, bandLine, crit, grid, label; final bool rtl;
  _ChartPainter({required this.pts, required this.gaps, required this.minC, required this.maxC, required this.progress, required this.sel, required this.line, required this.band, required this.bandLine, required this.crit, required this.grid, required this.label, required this.rtl});
  @override
  void paint(Canvas canvas, Size size) {
    final temps = pts.map((p) => (p['c'] as num).toDouble()).toList();
    final lo = [minC - 2, ...temps].reduce((a, b) => a < b ? a : b), hi = [maxC + 2, ...temps].reduce((a, b) => a > b ? a : b);
    final t0 = DateTime.parse(pts.first['t']).millisecondsSinceEpoch.toDouble(), t1 = DateTime.parse(pts.last['t']).millisecondsSinceEpoch.toDouble();
    const pad = 8.0;
    // المحور الزمني يبقى من اليسار لليمين حتى في العربية (اصطلاح المخططات الزمنية)، ويُذكر ذلك في التوثيق
    double x(double t) => pad + ((t - t0) / (t1 - t0 == 0 ? 1 : t1 - t0)) * (size.width - 2 * pad);
    double y(double v) => pad + (1 - (v - lo) / (hi - lo)) * (size.height - 2 * pad);
    canvas.drawRect(Rect.fromLTRB(pad, y(maxC), size.width - pad, y(minC)), Paint()..color = band);
    final dash = Paint()..color = bandLine..strokeWidth = 1.2;
    for (final v in [minC, maxC]) { for (double xx = pad; xx < size.width - pad; xx += 10) { canvas.drawLine(Offset(xx, y(v)), Offset(xx + 5, y(v)), dash); } }
    for (final g in gaps) {
      final a = DateTime.parse(g['from']).millisecondsSinceEpoch.toDouble(), b = DateTime.parse(g['to']).millisecondsSinceEpoch.toDouble();
      if (b < t0) continue;
      final r = Rect.fromLTRB(x(a.clamp(t0, t1)), pad, x(b.clamp(t0, t1)), size.height - pad);
      canvas.drawRect(r, Paint()..color = grid.withValues(alpha: .6));
    }
    final path = Path();
    for (var i = 0; i < pts.length; i++) {
      final px = x(DateTime.parse(pts[i]['t']).millisecondsSinceEpoch.toDouble()), py = y(temps[i]);
      final gap = i > 0 && DateTime.parse(pts[i]['t']).difference(DateTime.parse(pts[i - 1]['t'])).inMinutes > 15;
      if (i == 0 || gap) { path.moveTo(px, py); } else { path.lineTo(px, py); }
    }
    final pen = Paint()..color = line..strokeWidth = 2.4..style = PaintingStyle.stroke..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round;
    for (final m in path.computeMetrics()) { canvas.drawPath(m.extractPath(0, m.length * progress), pen); }
    for (var i = 0; i < pts.length; i++) { if (temps[i] > maxC || temps[i] < minC) canvas.drawCircle(Offset(x(DateTime.parse(pts[i]['t']).millisecondsSinceEpoch.toDouble()), y(temps[i])), 3.2, Paint()..color = crit); }
    if (sel != null && sel! < pts.length) {
      final sx = x(DateTime.parse(pts[sel!]['t']).millisecondsSinceEpoch.toDouble()), sy = y(temps[sel!]);
      canvas.drawLine(Offset(sx, pad), Offset(sx, size.height - pad), Paint()..color = label.withValues(alpha: .5));
      canvas.drawCircle(Offset(sx, sy), 6, Paint()..color = (temps[sel!] > maxC || temps[sel!] < minC) ? crit : line);
      canvas.drawCircle(Offset(sx, sy), 6, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);
    }
  }
  @override
  bool shouldRepaint(_ChartPainter o) => o.progress != progress || o.sel != sel || o.pts != pts;
}
