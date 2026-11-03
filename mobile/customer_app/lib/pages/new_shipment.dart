import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'common.dart';
import 'track.dart';

/// CM04 طلب شحنة بأربع خطوات: المسار ← العينة والخدمة ← الموعد ← المراجعة والسعر. تحقق مباشر على كل خطوة،
/// عرض السعر من shipment.quote، والتأكيد ينشئ الشحنة عبر shipment.create ثم يعرض علامة نجاح وينتقل للتتبع.
class NewShipmentPage extends StatefulWidget {
  final VoidCallback onDone;
  const NewShipmentPage({super.key, required this.onDone});
  @override
  State<NewShipmentPage> createState() => _NewShipmentPageState();
}

class _NewShipmentPageState extends State<NewShipmentPage> {
  int step = 0; bool busy = false; Map<String, String> errs = {}; Map? quote;
  String? branchId, fromId, toId; String thermal = 'chilled', level = 'standard', code = 'BLOOD_TUBES';
  final qty = TextEditingController(text: '2'), kg = TextEditingController(text: '1');
  DateTime start = DateTime.now().add(const Duration(hours: 1)); Duration window = const Duration(hours: 2);
  List<Map<String, dynamic>> addrs = [], branches = [];

  @override
  void initState() { super.initState(); WidgetsBinding.instance.addPostFrameCallback((_) => _load()); }
  Future<void> _load() async {
    final st = AppScope.of(context);
    final a = await st.api.list('addresses', pageSize: 300); final b = await st.api.list('branches', pageSize: 100);
    if (!mounted) return;
    setState(() { addrs = a; branches = b.where((x) => x['organizationId'] == orgId(st)).toList(); if (branches.length == 1) branchId = branches.first['id']; });
  }

  Map<String, String> _validate(S s) {
    final e = <String, String>{};
    if (step == 0) { if (fromId == null) e['from'] = s.required; if (toId == null) e['to'] = s.required; if (fromId != null && fromId == toId) e['to'] = s.t('عنوانا الاستلام والتسليم متطابقان', 'Pickup and delivery addresses are the same'); }
    if (step == 1) { if ((int.tryParse(qty.text) ?? 0) < 1) e['qty'] = s.t('الكمية 1 على الأقل', 'At least 1'); final w = double.tryParse(kg.text) ?? 0; if (w <= 0 || w > 25) e['kg'] = s.t('الوزن بين 0.1 و25 كغ', 'Weight between 0.1 and 25 kg'); }
    if (step == 2 && start.isBefore(DateTime.now().subtract(const Duration(minutes: 15)))) e['start'] = s.t('لا يمكن الجدولة في الماضي', 'Cannot schedule in the past');
    return e;
  }

  Map<String, dynamic> _base(AppState st) => {'organizationId': orgId(st), 'senderAddressId': fromId, 'receiverAddressId': toId, 'thermalClass': thermal, 'serviceLevel': level, 'weightKg': double.tryParse(kg.text) ?? 1};

  Future<void> _next(AppState st) async {
    final e = _validate(st.s); setState(() => errs = e); if (e.isNotEmpty) return;
    if (step == 2) { setState(() => busy = true); try { quote = await st.api.exec('shipment.quote', _base(st)); } on ApiException catch (x) { setState(() { busy = false; errs = {'form': x.message(st.lang)}; }); return; } setState(() => busy = false); }
    setState(() => step++);
  }

  Future<void> _submit(AppState st) async {
    setState(() => busy = true);
    try {
      final to = addrs.firstWhere((a) => a['id'] == toId, orElse: () => {});
      final sh = await st.run('shipment.create', {..._base(st), 'branchId': branchId, 'receiverOrgId': to['organizationId'] != orgId(st) ? to['organizationId'] : null, 'pickupWindowStart': start.toUtc().toIso8601String(), 'pickupWindowEnd': start.add(window).toUtc().toIso8601String(), 'items': [{'descriptionCode': code, 'quantity': int.parse(qty.text), 'weightKg': double.parse(kg.text)}], 'submit': true});
      if (!mounted) return;
      await showSuccess(context, st.s.t('تم إنشاء الطلب ${sh['trackingNo']}', 'Request ${sh['trackingNo']} created'));
      if (!mounted) return;
      setState(() { step = 0; quote = null; });
      widget.onDone();
      Navigator.push(context, MaterialPageRoute(builder: (_) => TrackPage(id: sh['id'])));
    } on ApiException catch (x) { setState(() => errs = {'form': x.message(st.lang)}); } finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context);
    if (!canCreate(st.roles)) return Scaffold(appBar: AppBar(), body: EmptyView(text: s.t('إنشاء الطلبات غير متاح لدورك', 'Creating requests is not available to your role'), icon: Icons.lock_outline));
    final titles = [s.d('ship.stepRoute'), s.d('ship.stepSample'), s.d('ship.stepSchedule'), s.d('ship.stepReview')];
    final mine = addrs.where((a) => a['organizationId'] == orgId(st)).toList();
    String lbl(Map a) => '${(a['label'] as Map)[st.lang]} — ${city(a['cityCode'], st.lang)}';
    Widget dd(String key, String label, String? value, List<Map<String, dynamic>> items, ValueChanged<String?> on) => Padding(padding: const EdgeInsets.only(bottom: 12), child: DropdownButtonFormField<String>(initialValue: value, isExpanded: true, decoration: InputDecoration(labelText: label, errorText: errs[key]), items: [for (final a in items) DropdownMenuItem(value: a['id'] as String, child: Text(lbl(a), overflow: TextOverflow.ellipsis))], onChanged: (v) { on(v); if (errs.isNotEmpty) setState(() => errs = _validate(s)); }));
    final body = switch (step) {
      0 => Column(children: [
          if (branches.length > 1) Padding(padding: const EdgeInsets.only(bottom: 12), child: DropdownButtonFormField<String>(initialValue: branchId, decoration: InputDecoration(labelText: s.d('common.branch')), items: [for (final b in branches) DropdownMenuItem(value: b['id'] as String, child: Text('${(b['name'] as Map)[st.lang]}'))], onChanged: (v) => setState(() => branchId = v))),
          dd('from', s.t('من (الاستلام)', 'From (pickup)'), fromId, mine, (v) => setState(() => fromId = v)),
          dd('to', s.t('إلى (المختبر المستلم)', 'To (receiving lab)'), toId, addrs, (v) => setState(() => toId = v)),
        ]),
      1 => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          DropdownButtonFormField<String>(initialValue: code, decoration: InputDecoration(labelText: s.t('نوع العينة', 'Sample type')), items: [for (final k in ['BLOOD_TUBES', 'SWAB_PCR', 'URINE_CULTURE', 'TISSUE_BIOPSY', 'SERUM_ALIQUOT', 'CSF_SAMPLE']) DropdownMenuItem(value: k, child: Text(s.label(k)))], onChanged: (v) => setState(() => code = v!)),
          const SizedBox(height: 12),
          Text(s.d('ship.thermalClass')), const SizedBox(height: 6),
          SegmentedButton<String>(showSelectedIcon: false, segments: [for (final k in ['chilled', 'frozen', 'ambient']) ButtonSegment(value: k, label: Text(s.label(k)))], selected: {thermal}, onSelectionChanged: (v) => setState(() => thermal = v.first)),
          const SizedBox(height: 12),
          Text(s.d('ship.serviceLevel')), const SizedBox(height: 6),
          SegmentedButton<String>(showSelectedIcon: false, segments: [for (final k in ['standard', 'express', 'stat']) ButtonSegment(value: k, label: Text(s.label(k)))], selected: {level}, onSelectionChanged: (v) => setState(() => level = v.first)),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: TextField(controller: qty, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: s.d('ship.quantity'), errorText: errs['qty']), onChanged: (_) { if (errs.isNotEmpty) setState(() => errs = _validate(s)); })),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: kg, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: s.d('ship.weight'), errorText: errs['kg']), onChanged: (_) { if (errs.isNotEmpty) setState(() => errs = _validate(s)); })),
          ]),
        ]),
      2 => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Card(child: ListTile(leading: const Icon(Icons.event), title: Text(s.t('بداية فترة الاستلام', 'Pickup window start')), subtitle: Text(f.dt(start.toUtc().toIso8601String())), onTap: () async {
            final d = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 30)), initialDate: start);
            if (d == null || !context.mounted) return;
            final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(start));
            if (t != null) setState(() { start = DateTime(d.year, d.month, d.day, t.hour, t.minute); errs = _validate(s); });
          })),
          if (errs['start'] != null) Text(errs['start']!, style: TextStyle(color: c.critical)),
          const SizedBox(height: 12),
          Text(s.t('مدة فترة الاستلام', 'Window length')),
          SegmentedButton<int>(showSelectedIcon: false, segments: [for (final h in [1, 2, 4]) ButtonSegment(value: h, label: Text(s.t('$h س', '${h}h')))], selected: {window.inHours}, onSelectionChanged: (v) => setState(() => window = Duration(hours: v.first))),
        ]),
      _ => quote == null ? const Skeleton() : Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('${s.t('عرض السعر', 'Quote')} ${quote!['quoteNo']}', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          for (final (k, ar, en) in [('base', 'السعر الأساسي', 'Base'), ('weight', 'رسوم الوزن', 'Weight'), ('levelSurcharge', 'رسوم مستوى الخدمة', 'Service level'), ('dedicatedBox', 'صندوق مخصص', 'Dedicated box')]) if ((quote!['snapshot'][k] ?? 0) != 0) Row(children: [Expanded(child: Text(s.t(ar, en))), Text(f.sar(quote!['snapshot'][k]), style: TextStyle(decoration: k == 'base' && quote!['snapshot']['coveredByContract'] == true ? TextDecoration.lineThrough : null))]),
          Row(children: [Expanded(child: Text(s.d('ship.vat'))), Text(f.sar(quote!['snapshot']['vat']))]),
          const Divider(height: 20),
          Row(children: [Expanded(child: Text(s.t('الإجمالي', 'Total'), style: const TextStyle(fontWeight: FontWeight.w700))), Text(f.sar(quote!['total']), style: const TextStyle(fontWeight: FontWeight.w700))]),
          if (quote!['snapshot']['coveredByContract'] == true) Padding(padding: const EdgeInsets.only(top: 8), child: Align(alignment: AlignmentDirectional.centerStart, child: StatusPill(null, text: s.d('ship.coveredByContract'), tone: Tone.good))),
        ]))),
    };
    return Scaffold(
      appBar: AppBar(title: Text(s.d('ship.create'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Semantics(label: s.t('الخطوة ${step + 1} من 4: ${titles[step]}', 'Step ${step + 1} of 4: ${titles[step]}'), child: Row(children: [for (var i = 0; i < 4; i++) Expanded(child: Column(children: [AnimatedContainer(duration: Motion.d(context, AtlasTokens.durBase), height: 5, margin: const EdgeInsets.symmetric(horizontal: 2), decoration: BoxDecoration(borderRadius: BorderRadius.circular(4), color: i <= step ? Theme.of(context).colorScheme.primary : c.line)), const SizedBox(height: 4), Text(titles[i], style: TextStyle(fontSize: 11, color: i == step ? Theme.of(context).colorScheme.primary : c.muted, fontWeight: i == step ? FontWeight.w600 : FontWeight.w400))]))])),
        const SizedBox(height: 18),
        if (errs['form'] != null) Container(margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: c.criticalSoft, borderRadius: BorderRadius.circular(14)), child: Text(errs['form']!, style: TextStyle(color: c.critical))),
        AnimatedSwitcher(duration: Motion.d(context, AtlasTokens.durBase), transitionBuilder: (w, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(.04, 0), end: Offset.zero).animate(a), child: w)), child: KeyedSubtree(key: ValueKey(step), child: body)),
        const SizedBox(height: 18),
        Row(children: [
          if (step > 0) OutlinedButton(onPressed: busy ? null : () => setState(() { step--; errs = {}; }), child: Text(s.back)),
          if (step > 0) const SizedBox(width: 10),
          Expanded(child: FilledButton(onPressed: busy ? null : () => step < 3 ? _next(st) : _submit(st), child: busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text(step < 3 ? s.next : s.t('تأكيد الطلب', 'Confirm request')))),
        ]),
      ]),
    );
  }
}
