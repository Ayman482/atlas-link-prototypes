import 'package:flutter/material.dart';
import 'theme/tokens.dart';

/// نظام الحركة في Flutter (نظير motion.tsx على الويب):
/// المدد 120–300ms للتفاعلات و420ms للتأكيد فقط، والمنحنيات من الرموز. عند تفعيل «إزالة الحركة» في إعدادات الوصول
/// (MediaQuery.disableAnimations على Android / Reduce Motion على iOS) تصبح المدة صفراً ويظهر المحتوى مباشرة.
class Motion {
  static bool reduced(BuildContext c) => MediaQuery.maybeDisableAnimationsOf(c) ?? false;
  static Duration d(BuildContext c, Duration base) => reduced(c) ? Duration.zero : base;
}

/// دخول متتابع: تلاشٍ + انزلاق 8 بكسل، مع تأخير index × 40ms (حتى 6 عناصر)
class FadeSlideIn extends StatefulWidget {
  final Widget child;
  final int index;
  const FadeSlideIn({super.key, required this.child, this.index = 0});
  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: AtlasTokens.durBase);
  bool _started = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) { _c.value = 1; return; }
    Future.delayed(AtlasTokens.stagger * widget.index.clamp(0, 6), () { if (mounted) _c.forward(); });
  }
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final a = CurvedAnimation(parent: _c, curve: AtlasTokens.easeDecelerate);
    return FadeTransition(opacity: a, child: AnimatedBuilder(animation: a, builder: (_, child) => Transform.translate(offset: Offset(0, 8 * (1 - a.value)), child: child), child: widget.child));
  }
}

/// عدّاد يتحرك من القيمة السابقة إلى الجديدة (900ms) — الرقم النهائي هو الحقيقي دائماً
class CountUp extends StatelessWidget {
  final num value;
  final TextStyle? style;
  final int decimals;
  const CountUp(this.value, {super.key, this.style, this.decimals = 0});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value.toDouble()),
        duration: Motion.d(context, const Duration(milliseconds: 900)),
        curve: Curves.easeOutCubic,
        builder: (_, v, __) => Text(v.toStringAsFixed(decimals), style: style, semanticsLabel: value.toStringAsFixed(decimals)),
      );
}

/// نبض هادئ للمؤشرات الحرجة: حلقة تتسع وتتلاشى. لا يؤخر ظهور المحتوى ويتوقف مع تقليل الحركة.
class Pulse extends StatefulWidget {
  final Color color;
  final double size;
  const Pulse({super.key, required this.color, this.size = 10});
  @override
  State<Pulse> createState() => _PulseState();
}

class _PulseState extends State<Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));
  @override
  void didChangeDependencies() { super.didChangeDependencies(); if (Motion.reduced(context)) { _c.stop(); } else if (!_c.isAnimating) { _c.repeat(); } }
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => SizedBox(
        width: widget.size * 2.4,
        height: widget.size * 2.4,
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, __) => Stack(alignment: Alignment.center, children: [
            Opacity(opacity: (1 - _c.value) * .6, child: Container(width: widget.size * (1 + 1.4 * _c.value), height: widget.size * (1 + 1.4 * _c.value), decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color.withValues(alpha: .35)))),
            Container(width: widget.size, height: widget.size, decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color)),
          ]),
        ),
      );
}
