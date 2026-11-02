import 'package:flutter/material.dart';
import '../theme/atlas_theme.dart';
import '../motion.dart';

/// بطاقة مؤشر برقم يعدّ تصاعدياً. الحالة الحرجة تظهر فوراً بحد ولون حرج ونبض هادئ.
class KpiTile extends StatelessWidget {
  final String label;
  final num value;
  final IconData icon;
  final bool critical;
  final bool highlight;
  const KpiTile({super.key, required this.label, required this.value, required this.icon, this.critical = false, this.highlight = false});
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme; final c = AtlasColors.of(context);
    final fg = highlight ? cs.onPrimary : critical ? c.critical : cs.onSurface;
    return Semantics(
      label: '$label: $value',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: highlight ? cs.primary : critical ? c.criticalSoft : cs.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: critical ? c.critical.withValues(alpha: .5) : highlight ? Colors.transparent : c.line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Icon(icon, size: 18, color: highlight ? cs.onPrimary : critical ? c.critical : cs.primary), const Spacer(), if (critical) Pulse(color: c.critical, size: 7)]),
          const SizedBox(height: 8),
          CountUp(value, style: TextStyle(fontFamily: 'packages/atlas_shared/Alexandria', fontSize: 26, fontWeight: FontWeight.w500, color: fg)),
          Text(label, style: TextStyle(fontSize: 12, color: highlight ? cs.onPrimary.withValues(alpha: .9) : c.muted)),
        ]),
      ),
    );
  }
}
