import 'package:flutter/material.dart';
import '../theme/atlas_theme.dart';
import '../l10n/strings.dart';
import '../motion.dart';

enum Tone { good, warn, crit, info, mute }

const _tones = <String, Tone>{
  'delivered': Tone.good, 'confirmed': Tone.info, 'pickup_scheduled': Tone.info, 'collected': Tone.info, 'in_transit': Tone.info, 'at_handover': Tone.info,
  'draft': Tone.mute, 'cancelled': Tone.mute, 'returned': Tone.mute, 'failed': Tone.crit, 'exception': Tone.crit, 'return_pending': Tone.warn,
  'open': Tone.crit, 'acknowledged': Tone.warn, 'under_review': Tone.warn, 'closed': Tone.good, 'submitted': Tone.info, 'approved': Tone.good, 'rejected': Tone.mute,
  'issued': Tone.info, 'partially_paid': Tone.warn, 'paid': Tone.good, 'overdue': Tone.crit, 'live': Tone.good, 'delayed': Tone.warn, 'stale': Tone.crit, 'inferred': Tone.info, 'planned': Tone.mute,
  'critical': Tone.crit, 'high': Tone.crit, 'medium': Tone.warn, 'low': Tone.info, 'available': Tone.good, 'on_route': Tone.info, 'off_shift': Tone.mute, 'in_use': Tone.info, 'assigned': Tone.info,
  'pending': Tone.warn, 'accepted': Tone.good, 'done': Tone.good, 'stat': Tone.crit, 'express': Tone.warn, 'standard': Tone.mute,
};

/// شارة حالة بلون دلالي ونقطة (تنبض للحالات المباشرة والحرجة). تحمل وصفاً لقارئ الشاشة.
class StatusPill extends StatelessWidget {
  final String? value;
  final String? text;
  final Tone? tone;
  final String? domain; // سياق التسمية (مثل confidence) — نفس منطق الويب
  const StatusPill(this.value, {super.key, this.text, this.tone, this.domain});
  @override
  Widget build(BuildContext context) {
    final c = AtlasColors.of(context);
    final t = tone ?? _tones[value] ?? Tone.mute;
    final (fg, bg) = switch (t) { Tone.good => (c.success, c.successSoft), Tone.warn => (c.warning, c.warningSoft), Tone.crit => (c.critical, c.criticalSoft), Tone.info => (c.info, c.infoSoft), Tone.mute => (c.muted, c.line.withValues(alpha: .5)) };
    final label = text ?? S(Localizations.localeOf(context).languageCode).label(value, domain);
    final pulse = value == 'live' || value == 'open' || value == 'critical';
    return Semantics(
      label: label,
      excludeSemantics: true,
      child: AnimatedContainer(
        duration: Motion.d(context, const Duration(milliseconds: 220)),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          pulse ? Pulse(color: fg, size: 6) : Container(width: 6, height: 6, decoration: BoxDecoration(color: fg, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 12)),
        ]),
      ),
    );
  }
}
