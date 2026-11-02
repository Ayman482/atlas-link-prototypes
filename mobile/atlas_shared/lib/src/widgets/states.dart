import 'package:flutter/material.dart';
import '../theme/atlas_theme.dart';
import '../l10n/strings.dart';
import '../api/api_client.dart';

/// هيكل تحميل متلألئ يناسب سياق القائمة (بدلاً من دوّار عام)
class Skeleton extends StatefulWidget {
  final int lines;
  const Skeleton({super.key, this.lines = 3});
  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat();
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return Semantics(
      label: S(Localizations.localeOf(context).languageCode).loading,
      child: Column(children: List.generate(widget.lines, (i) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: AnimatedBuilder(animation: _c, builder: (_, __) => Container(
          height: i == 0 ? 76 : 64,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), gradient: LinearGradient(begin: Alignment(-1 + 2 * (reduce ? .5 : _c.value) - .6, 0), end: Alignment(-1 + 2 * (reduce ? .5 : _c.value) + .6, 0), colors: [base, base.withValues(alpha: .45), base])),
        )),
      ))),
    );
  }
}

class EmptyView extends StatelessWidget {
  final String? text;
  final IconData icon;
  const EmptyView({super.key, this.text, this.icon = Icons.inbox_outlined});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(32),
        child: Column(children: [Icon(icon, size: 48, color: Theme.of(context).colorScheme.primary), const SizedBox(height: 12), Text(text ?? S(Localizations.localeOf(context).languageCode).empty, textAlign: TextAlign.center)]),
      );
}

class ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback? onRetry;
  const ErrorView(this.error, {super.key, this.onRetry});
  @override
  Widget build(BuildContext context) {
    final s = S(Localizations.localeOf(context).languageCode);
    final c = AtlasColors.of(context);
    final msg = error is ApiException ? (error as ApiException).message(s.lang) : '$error';
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: c.criticalSoft, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [Icon(Icons.error_outline, color: c.critical), const SizedBox(width: 12), Expanded(child: Text(msg, style: TextStyle(color: c.critical))), if (onRetry != null) TextButton(onPressed: onRetry, child: Text(s.retry))]),
    );
  }
}

/// شارة «بيانات عرض/محاكاة» بلون ذهبي مقروء
class SimBadge extends StatelessWidget {
  final String? text;
  const SimBadge({super.key, this.text});
  @override
  Widget build(BuildContext context) {
    final c = AtlasColors.of(context);
    return Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: c.goldSoft, borderRadius: BorderRadius.circular(99)), child: Text(text ?? S(Localizations.localeOf(context).languageCode).simulated, style: TextStyle(color: c.goldText, fontSize: 11, fontWeight: FontWeight.w600)));
  }
}

/// يحمّل بيانات مستقبلية مع هيكل التحميل وعرض الخطأ وإعادة المحاولة، ويعيد التحميل عند تغيّر المفتاح
class AsyncView<T> extends StatefulWidget {
  final Future<T> Function() load;
  final Object? reloadKey;
  final Widget Function(BuildContext, T) builder;
  final int skeletonLines;
  const AsyncView({super.key, required this.load, required this.builder, this.reloadKey, this.skeletonLines = 3});
  @override
  State<AsyncView<T>> createState() => _AsyncViewState<T>();
}

class _AsyncViewState<T> extends State<AsyncView<T>> {
  late Future<T> _f = widget.load();
  @override
  void didUpdateWidget(covariant AsyncView<T> old) { super.didUpdateWidget(old); if (old.reloadKey != widget.reloadKey) setState(() => _f = widget.load()); }
  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: _f,
        builder: (c, s) {
          if (s.hasError) return ErrorView(s.error!, onRetry: () => setState(() => _f = widget.load()));
          if (!s.hasData) return Padding(padding: const EdgeInsets.all(16), child: Skeleton(lines: widget.skeletonLines));
          return AnimatedSwitcher(duration: const Duration(milliseconds: 220), child: KeyedSubtree(key: ValueKey(widget.reloadKey), child: widget.builder(c, s.data as T)));
        },
      );
}
