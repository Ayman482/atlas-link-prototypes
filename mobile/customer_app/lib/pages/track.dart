import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'common.dart';
import 'temperature.dart';

/// CM05 التتبع + CM07 الإجراءات (إعادة الجدولة/الإلغاء/الإرجاع/المطالبة)
/// يميّز بوضوح: آخر موقع مؤكد ووقته ومصدره، حداثة البيانات، وأن القراءات بيانات عرض. لا تحريك لموقع محاكى.
class TrackPage extends StatelessWidget {
  final String id;
  const TrackPage({super.key, required this.id});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('تتبع الشحنة', 'Track shipment'))),
      body: AsyncView<dynamic>(
        reloadKey: st.tick,
        load: () => st.api.query('shipment.detail', {'id': id}),
        builder: (ctx, d) {
          final sh = d['shipment'] as Map; final tr = d['tracking'] as Map? ?? {}; final c = AtlasColors.of(context); final cs = Theme.of(context).colorScheme;
          final steps = ['confirmed', 'pickup_scheduled', 'collected', 'in_transit', 'delivered'];
          final idx = steps.indexOf(sh['status'] == 'at_handover' ? 'in_transit' : sh['status']);
          final pos = tr['lastConfirmedPosition'] as Map?; final rd = tr['lastReading'] as Map?; final eta = sh['eta'] as Map?;
          final owner = canCreate(st.roles) && ((st.me?['organizations'] as List?) ?? []).any((o) => o['id'] == sh['organizationId']);
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [Text('${sh['trackingNo']}', textDirection: TextDirection.ltr, style: Theme.of(context).textTheme.titleLarge), const Spacer(), StatusPill('${tr['operationalStatus'] ?? sh['status']}')]),
            const SizedBox(height: 12),
            Semantics(label: s.t('تقدّم الشحنة: ${s.label(sh['status'])}', 'Progress: ${s.label(sh['status'])}'), child: Row(children: [for (var i = 0; i < steps.length; i++) Expanded(child: AnimatedContainer(duration: Motion.d(context, AtlasTokens.durSlow), margin: const EdgeInsets.symmetric(horizontal: 2), height: 6, decoration: BoxDecoration(borderRadius: BorderRadius.circular(4), color: i <= idx ? cs.primary : c.line)))])),
            const SizedBox(height: 14),
            FadeSlideIn(child: Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${(d['sender']?['label'] as Map?)?[st.lang] ?? ''} ${arrow(st.lang)} ${(d['receiver']?['label'] as Map?)?[st.lang] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
              Text('${city(sh['originCity'], st.lang)} ${arrow(st.lang)} ${city(sh['destCity'], st.lang)} · ${s.label(sh['thermalClass'])} · ${s.label(sh['serviceLevel'])} · ${s.label(sh['mode'])}', style: TextStyle(color: c.muted)),
              const Divider(height: 24),
              _row(s.d('ship.eta'), eta?['at'] == null ? s.label('unavailable') : f.dt(eta!['at']), trailing: eta == null ? null : StatusPill('${eta['confidence']}', domain: 'confidence', tone: eta['confidence'] == 'high' ? Tone.good : Tone.warn)),
              // آخر موقع مؤكد بوقته ومصدره؛ «مباشر» فقط إن كان الموقع حياً فعلاً (ليس أثناء الطيران أو انقطاع الجهاز)
              _row(s.d('ship.lastConfirmed'), pos == null ? s.t('لا يوجد بعد', 'None yet') : '${f.dt(pos['at'])} · ${s.label(pos['source'])}${pos['isLive'] == true ? '' : s.t(' · ليس موقعاً مباشراً', ' · not a live position')}', trailing: pos == null ? null : StatusPill(pos['isLive'] == true ? 'live' : (tr['inAir'] == true ? 'inferred' : (tr['freshness'] == 'live' ? 'delayed' : '${tr['freshness']}')))),
              if (tr['operationalStatus'] == 'in_air_transit') Padding(padding: const EdgeInsets.only(top: 4), child: Text(s.d('ship.noLiveInFlight'), style: TextStyle(color: c.info))),
              _row(s.d('ship.lastKnownReading'), rd == null ? '—' : '${f.temp(rd['tempC'])} · ${f.dt(rd['deviceTime'])}', trailing: const SimBadge()),
            ])))),
            const SizedBox(height: 10),
            OutlinedButton.icon(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TemperaturePage(id: id))), icon: const Icon(Icons.thermostat), label: Text(s.t('تقرير الحرارة', 'Temperature report'))),
            if (d['pod'] != null) ...[const SizedBox(height: 10), Card(child: ListTile(leading: Icon(Icons.verified, color: c.success), title: Text(s.d('ship.pod')), subtitle: Text('${d['pod']['recipientName']} · ${f.dt(d['pod']['deliveredAt'])}')))],
            if (owner) ...[const SizedBox(height: 12), Wrap(spacing: 8, runSpacing: 8, children: _actions(context, st, sh))],
            const SizedBox(height: 18),
            Text(s.d('ship.timeline'), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            AtlasTimeline(items: (d['timeline'] as List).cast<Map<String, dynamic>>()),
          ]);
        },
      ),
    );
  }

  Widget _row(String k, String v, {Widget? trailing}) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(k, style: const TextStyle(fontSize: 12)), Text(v, style: const TextStyle(fontWeight: FontWeight.w600))])), if (trailing != null) trailing]));

  List<Widget> _actions(BuildContext context, AppState st, Map sh) {
    final s = st.s; final status = '${sh['status']}';
    final early = ['draft', 'confirmed', 'pickup_scheduled'].contains(status);
    return [
      if (early) OutlinedButton(onPressed: () => _reschedule(context, st, sh), child: Text(s.d('ship.reschedule'))),
      if (early) OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: AtlasColors.of(context).critical), onPressed: () => _form(context, st, s.d('ship.cancelShipment'), [s.reason], (v) => st.run('shipment.cancel', {'id': sh['id'], 'reason': v[0], 'version': sh['version']}), note: s.t('لا يمكن الإلغاء خلال الساعة السابقة لموعد الاستلام.', 'Cannot cancel within one hour of pickup.')), child: Text(s.d('ship.cancelShipment'))),
      if (['failed', 'in_transit', 'at_handover', 'exception'].contains(status)) OutlinedButton(onPressed: () => _form(context, st, s.d('ship.requestReturn'), [s.reason], (v) => st.run('returns.request', {'shipment': sh['id'], 'reasonCode': 'CUSTOMER_REQUEST', 'note': v[0]})), child: Text(s.d('ship.requestReturn'))),
      if (status != 'draft') OutlinedButton(onPressed: () => _claim(context, st, sh), child: Text(s.d('ship.fileClaim'))),
    ];
  }

  Future<void> _reschedule(BuildContext context, AppState st, Map sh) async {
    final s = st.s; final now = DateTime.now();
    final d = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 30)), initialDate: now);
    if (d == null || !context.mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(now.add(const Duration(hours: 2))));
    if (t == null || !context.mounted) return;
    final start = DateTime(d.year, d.month, d.day, t.hour, t.minute);
    try { await st.run('shipment.reschedule', {'id': sh['id'], 'pickupWindowStart': start.toUtc().toIso8601String(), 'pickupWindowEnd': start.add(const Duration(hours: 2)).toUtc().toIso8601String()}); if (context.mounted) await showSuccess(context, s.t('أُعيدت جدولة الاستلام', 'Pickup rescheduled')); } catch (e) { if (context.mounted) showError(context, e); }
  }

  Future<void> _claim(BuildContext context, AppState st, Map sh) async {
    final s = st.s; String type = 'damage';
    final amount = TextEditingController(), desc = TextEditingController(); String? err;
    await showModalBottomSheet(context: context, isScrollControlled: true, showDragHandle: true, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(ctx).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(s.d('ship.fileClaim'), style: Theme.of(ctx).textTheme.titleLarge), const SizedBox(height: 12),
        SegmentedButton<String>(showSelectedIcon: false, segments: [for (final k in ['damage', 'loss', 'delay', 'temperature']) ButtonSegment(value: k, label: Text(s.label(k)))], selected: {type}, onSelectionChanged: (v) => set(() => type = v.first)),
        const SizedBox(height: 12),
        TextField(controller: amount, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: s.t('المبلغ (ر.س)', 'Amount (SAR)'))),
        const SizedBox(height: 12),
        TextField(controller: desc, maxLines: 3, decoration: InputDecoration(labelText: s.t('الوصف (10 أحرف على الأقل)', 'Description (min 10 chars)'))),
        if (err != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(err!, style: TextStyle(color: AtlasColors.of(ctx).critical))),
        const SizedBox(height: 12),
        FilledButton(onPressed: () async {
          try { await st.run('claim.submit', {'shipment': sh['id'], 'claimType': type, 'amountSar': num.tryParse(amount.text) ?? 0, 'description': desc.text}); if (ctx.mounted) Navigator.pop(ctx); if (context.mounted) await showSuccess(context, s.t('قُدّمت المطالبة', 'Claim submitted')); }
          on ApiException catch (e) { set(() => err = e.message(st.lang)); }
        }, child: Text(s.t('تقديم', 'Submit'))),
      ]),
    )));
  }
}

/// نموذج نصي بسيط في ورقة سفلية مع عرض خطأ الخادم بجانب الحقل
Future<void> _form(BuildContext context, AppState st, String title, List<String> labels, Future<dynamic> Function(List<String>) submit, {String? note}) async {
  final ctrls = [for (final _ in labels) TextEditingController()]; String? err;
  await showModalBottomSheet(context: context, isScrollControlled: true, showDragHandle: true, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => Padding(
    padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(ctx).bottom),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(title, style: Theme.of(ctx).textTheme.titleLarge),
      if (note != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(note)),
      for (var i = 0; i < labels.length; i++) Padding(padding: const EdgeInsets.only(top: 12), child: TextField(controller: ctrls[i], maxLines: 2, decoration: InputDecoration(labelText: labels[i]))),
      if (err != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(err!, style: TextStyle(color: AtlasColors.of(ctx).critical))),
      const SizedBox(height: 12),
      FilledButton(onPressed: () async {
        if (ctrls.any((c) => c.text.trim().isEmpty)) { set(() => err = st.s.required); return; }
        try { await submit([for (final c in ctrls) c.text.trim()]); if (ctx.mounted) Navigator.pop(ctx); if (context.mounted) await showSuccess(context, st.s.t('تم بنجاح', 'Done')); } on ApiException catch (e) { set(() => err = e.message(st.lang)); }
      }, child: Text(st.s.confirm)),
    ]),
  )));
}
