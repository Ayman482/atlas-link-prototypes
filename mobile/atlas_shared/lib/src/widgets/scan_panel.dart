import 'package:flutter/material.dart';
import '../theme/atlas_theme.dart';
import '../l10n/strings.dart';
import '../motion.dart';
import 'success_check.dart';
import 'states.dart';

enum ScanState { idle, busy, ok, bad }

/// مسح QR بحالات واضحة: جاهز ← جارٍ القراءة ← نجاح (علامة تُرسم) أو فشل (السبب + إعادة المحاولة).
/// الكاميرا في هذا الإصدار محاكاة: يختار المندوب رمزاً مقترحاً أو يكتبه يدوياً (التوثيق يذكر خطوات تفعيل كاميرا حقيقية).
class ScanPanel extends StatefulWidget {
  final String title;
  final List<(String code, String hint)> suggestions;
  /// يعيد null عند النجاح أو رسالة الخطأ
  final Future<String?> Function(String code) onScan;
  const ScanPanel({super.key, required this.title, required this.suggestions, required this.onScan});
  @override
  State<ScanPanel> createState() => _ScanPanelState();
}

class _ScanPanelState extends State<ScanPanel> with SingleTickerProviderStateMixin {
  ScanState st = ScanState.idle; String? msg; String? code;
  final _manual = TextEditingController();
  late final AnimationController _laser = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
  @override
  void didChangeDependencies() { super.didChangeDependencies(); if (!Motion.reduced(context)) _laser.repeat(reverse: true); }
  @override
  void dispose() { _laser.dispose(); _manual.dispose(); super.dispose(); }

  Future<void> _go(String v) async {
    setState(() { st = ScanState.busy; code = v; msg = null; });
    await Future.delayed(Motion.d(context, const Duration(milliseconds: 450)));
    String? e;
    try { e = await widget.onScan(v); } catch (x) { e = '$x'; }
    if (!mounted) return;
    setState(() { st = e == null ? ScanState.ok : ScanState.bad; msg = e; });
  }

  @override
  Widget build(BuildContext context) {
    final s = S(Localizations.localeOf(context).languageCode); final c = AtlasColors.of(context);
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(widget.title, style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      ClipRRect(borderRadius: BorderRadius.circular(20), child: Container(height: 150, color: const Color(0xFF0E2129), child: AnimatedBuilder(animation: _laser, builder: (_, __) => Stack(children: [
        Positioned.fill(child: CustomPaint(painter: _Corners(const Color(0xFFD9EEE8)))),
        Positioned(left: 30, right: 30, top: 20 + 110 * _laser.value, child: Container(height: 2, decoration: BoxDecoration(color: st == ScanState.ok ? c.success : const Color(0xFFD9EEE8), boxShadow: const [BoxShadow(color: Color(0xAA3CC4AE), blurRadius: 10)]))),
      ])))),
      const SizedBox(height: 10),
      Semantics(liveRegion: true, child: AnimatedSwitcher(duration: Motion.d(context, const Duration(milliseconds: 220)), child: switch (st) {
        ScanState.busy => Row(key: const ValueKey('b'), children: [const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)), const SizedBox(width: 10), Text(s.t('جارٍ قراءة الرمز…', 'Reading code…'))]),
        ScanState.ok => Container(key: const ValueKey('o'), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: c.successSoft, borderRadius: BorderRadius.circular(14)), child: Row(children: [const SuccessCheck(size: 28), const SizedBox(width: 10), Expanded(child: Text('${s.t('تم التحقق من الرمز', 'Code verified')} · $code', style: TextStyle(color: c.success, fontWeight: FontWeight.w600)))])),
        ScanState.bad => Container(key: const ValueKey('x'), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: c.criticalSoft, borderRadius: BorderRadius.circular(14)), child: Row(children: [Icon(Icons.error_outline, color: c.critical), const SizedBox(width: 10), Expanded(child: Text(msg ?? '', style: TextStyle(color: c.critical))), TextButton(onPressed: () => setState(() => st = ScanState.idle), child: Text(s.retry))])),
        ScanState.idle => const SizedBox.shrink(key: ValueKey('i')),
      })),
      const SizedBox(height: 6),
      Align(alignment: AlignmentDirectional.centerStart, child: SimBadge(text: s.t('الكاميرا محاكاة — اختر رمزاً أو أدخله يدوياً', 'Camera simulated — pick a code or type it'))),
      const SizedBox(height: 8),
      for (final (code, hint) in widget.suggestions) Padding(padding: const EdgeInsets.only(bottom: 6), child: OutlinedButton(onPressed: st == ScanState.busy ? null : () => _go(code), style: OutlinedButton.styleFrom(alignment: AlignmentDirectional.centerStart), child: Text('$code · $hint', textDirection: TextDirection.ltr))),
      Row(children: [Expanded(child: TextField(controller: _manual, textDirection: TextDirection.ltr, decoration: InputDecoration(labelText: s.t('إدخال يدوي', 'Manual entry')))), const SizedBox(width: 8), FilledButton(onPressed: st == ScanState.busy ? null : () { final v = _manual.text.trim(); if (v.isNotEmpty) { _manual.clear(); _go(v); } }, child: Text(s.confirm))]),
    ])));
  }
}

class _Corners extends CustomPainter {
  final Color c; _Corners(this.c);
  @override
  void paint(Canvas canvas, Size s) {
    final p = Paint()..color = c..strokeWidth = 3..style = PaintingStyle.stroke..strokeCap = StrokeCap.round; const l = 26.0, m = 16.0;
    canvas.drawPath(Path()..moveTo(m, m + l)..lineTo(m, m)..lineTo(m + l, m), p);
    canvas.drawPath(Path()..moveTo(s.width - m - l, m)..lineTo(s.width - m, m)..lineTo(s.width - m, m + l), p);
    canvas.drawPath(Path()..moveTo(m, s.height - m - l)..lineTo(m, s.height - m)..lineTo(m + l, s.height - m), p);
    canvas.drawPath(Path()..moveTo(s.width - m - l, s.height - m)..lineTo(s.width - m, s.height - m)..lineTo(s.width - m, s.height - m - l), p);
  }
  @override
  bool shouldRepaint(_Corners o) => false;
}
