import 'package:flutter/material.dart';
import '../theme/atlas_theme.dart';
import '../motion.dart';

/// علامة نجاح تُرسم (دائرة تتسع ثم علامة صح) — 420ms، تظهر مكتملة فوراً مع تقليل الحركة
class SuccessCheck extends StatefulWidget {
  final double size;
  const SuccessCheck({super.key, this.size = 72});
  @override
  State<SuccessCheck> createState() => _SuccessCheckState();
}

class _SuccessCheckState extends State<SuccessCheck> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  @override
  void didChangeDependencies() { super.didChangeDependencies(); Motion.reduced(context) ? _c.value = 1 : _c.forward(); }
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Semantics(
        label: 'OK',
        child: AnimatedBuilder(animation: _c, builder: (_, __) => CustomPaint(size: Size.square(widget.size), painter: _P(_c.value, AtlasColors.of(context).success))),
      );
}

class _P extends CustomPainter {
  final double t;
  final Color color;
  _P(this.t, this.color);
  @override
  void paint(Canvas c, Size s) {
    final r = s.width / 2 * Curves.easeOutBack.transform((t * 1.6).clamp(0, 1));
    c.drawCircle(s.center(Offset.zero), r, Paint()..color = color);
    final k = ((t - .35) / .65).clamp(0.0, 1.0);
    if (k <= 0) return;
    final p = Path()..moveTo(s.width * .3, s.height * .52)..lineTo(s.width * .44, s.height * .66)..lineTo(s.width * .72, s.height * .38);
    final m = p.computeMetrics().first;
    c.drawPath(m.extractPath(0, m.length * k), Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = s.width * .08..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round);
  }
  @override
  bool shouldRepaint(_P o) => o.t != t;
}

/// حوار تأكيد نجاح موجز يُغلق تلقائياً
Future<void> showSuccess(BuildContext context, String text) async {
  final nav = Navigator.of(context);
  showDialog(context: context, barrierDismissible: true, builder: (_) => Dialog(child: Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisSize: MainAxisSize.min, children: [const SuccessCheck(), const SizedBox(height: 16), Text(text, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium)]))));
  await Future.delayed(const Duration(milliseconds: 1300));
  if (nav.canPop()) nav.pop();
}
