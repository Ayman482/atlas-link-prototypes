import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import '../offline.dart';
import 'tasks.dart';

/// K04–K11: تفاصيل المهمة، مسح الشحنة ثم الصندوق، الاستلام بالتوقيع، بدء النقل، الوصول، نقل الحيازة، التسليم مع إثبات، المحاولة الفاشلة، وإتمام الإرجاع.
/// الإجراءات الميدانية (المسح/الاستلام/النقل/التسليم/الفشل) تُحفظ في الطابور عند انقطاع الشبكة.
class TaskPage extends StatefulWidget {
  final String id;
  const TaskPage({super.key, required this.id});
  @override
  State<TaskPage> createState() => _TaskPageState();
}

class _TaskPageState extends State<TaskPage> {
  bool shipScanned = false; String? stage; String? sig; bool photo = false; String? err;
  final name = TextEditingController(), note = TextEditingController();
  String toType = 'air_carrier'; String? toId; String reason = 'RECIPIENT_UNAVAILABLE';

  void _reset() => setState(() { stage = null; sig = null; photo = false; err = null; name.clear(); note.clear(); });

  bool busy = false;
  /// ينفّذ الإجراء مرة واحدة (الضغط المتكرر أثناء الإرسال يُتجاهل)، ورسالة النجاح تعكس النتيجة الفعلية:
  /// إن حُفظ في الطابور (انقطاع محاكى أو فعلي) تظهر «حُفظ في الطابور» لا «تم».
  Future<void> _do(Future<dynamic> Function() fn, String ok) async {
    if (busy) return;
    setState(() { err = null; busy = true; });
    final s = AppScope.of(context).s;
    try {
      final r = await fn();
      _reset();
      if (mounted) await showSuccess(context, r == false ? s.t('حُفظ في الطابور وسيُزامن تلقائياً عند عودة الاتصال', 'Saved to queue — will sync automatically when back online') : ok);
    } on ApiException catch (e) { if (mounted) setState(() => err = e.message(AppScope.of(context).lang)); }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context); final q = OfflineQueue.instance;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('تفاصيل المهمة', 'Task'))),
      body: AsyncView<dynamic>(
        reloadKey: st.tick,
        load: () => st.api.query('courier.tasks', {}),
        builder: (ctx, d) {
          final t = (d['tasks'] as List).cast<Map<String, dynamic>>().where((x) => x['shipmentId'] == widget.id).firstOrNull;
          if (t == null) return EmptyView(text: s.t('المهمة غير موجودة أو لم تعد مسندة إليك', 'Task not found or no longer assigned to you'));
          final a = (t['kind'] == 'pickup' ? t['sender'] : t['receiver']) as Map?;
          final mine = t['mine'] == true; final status = '${t['status']}';
          final queued = q.items.where((x) => x['shipment'] == t['shipmentId']).toList();
          final targets = toType == 'warehouse' ? (d['warehouses'] as List) : toType == 'courier' ? (d['colleagues'] as List) : (d['partners'] as List).where((p) => toType == 'air_carrier' ? p['partnerType'] == 'air' : p['partnerType'] != 'air').toList();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Text('${t['trackingNo']}', textDirection: TextDirection.ltr, style: Theme.of(context).textTheme.titleLarge), const Spacer(), StatusPill(status)]),
              const SizedBox(height: 6),
              Text('${kindLabel('${t['kind']}', st.lang)} — ${(a?['label'] as Map?)?[st.lang] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
              Text('${a?['contactName'] ?? ''} · ${Fmt.ltr(a?['contactPhone'])}'),
              Text('${(t['organization'] as Map?)?[st.lang] ?? ''} · ${s.label(t['thermalClass'])} · ${s.label(t['mode'])}', style: TextStyle(color: c.muted)),
              Text((t['items'] as List).map((i) => '${s.label(i['descriptionCode'])} ×${i['quantity']}').join('، '), style: TextStyle(color: c.muted)),
              Text('${s.t('الصندوق', 'Box')}: ${t['box'] ?? t['plannedBox'] ?? '—'}${t['box'] == null && t['plannedBox'] != null ? s.t(' (مخطط)', ' (planned)') : ''}'),
              if (t['lastReading'] != null) Row(children: [Text('${f.temp(t['lastReading']['tempC'])} · ${f.dt(t['lastReading']['deviceTime'])}  '), const SimBadge()]),
            ]))),
            if (queued.isNotEmpty) Container(margin: const EdgeInsets.only(top: 10), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: c.goldSoft, borderRadius: BorderRadius.circular(12)), child: Text('${s.t('بانتظار المزامنة', 'Awaiting sync')}: ${queued.map((x) => x['label']).join('، ')}', style: TextStyle(color: c.goldText))),
            if (err != null) Container(margin: const EdgeInsets.only(top: 10), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: c.criticalSoft, borderRadius: BorderRadius.circular(12)), child: Text(err!, style: TextStyle(color: c.critical))),
            const SizedBox(height: 12),
            // K05 مسح الشحنة
            if (t['kind'] == 'pickup' && t['box'] == null && !shipScanned) ScanPanel(
              title: s.d('courier.scanShipment'),
              suggestions: [('${t['trackingNo']}', s.t('ملصق الشحنة', 'Shipment label')), ('ML-2026-999999', s.t('رمز خاطئ للاختبار', 'Wrong code (test)'))],
              onScan: (v) async { if (v == t['trackingNo'] || v == t['qrToken']) { Future.delayed(const Duration(milliseconds: 700), () { if (mounted) setState(() => shipScanned = true); }); return null; } return s.t('هذا الرمز لا يخص هذه المهمة. تأكد من ملصق الشحنة.', 'This code does not belong to this task. Check the shipment label.'); },
            ),
            // K06 مسح الصندوق
            if (t['kind'] == 'pickup' && t['box'] == null && shipScanned && !queued.any((x) => x['type'] == 'scanPack')) ScanPanel(
              title: s.d('courier.scanBox'),
              suggestions: [if (t['plannedBox'] != null) ('${t['plannedBox']}', s.t('الصندوق المسند', 'Assigned box')), for (final b in (d['boxesInCustody'] as List).where((b) => b['code'] != t['plannedBox'] && b['thermalClass'] == t['thermalClass']).take(2)) ('${b['code']}', s.t('صندوق بعهدتك', 'Box in your custody'))],
              onScan: (v) async { try { await q.act(st, 'scanPack', 'courier.scanPack', t['shipmentId'], {'boxCode': v}, s.t('تعبئة $v', 'Pack $v')); return null; } on ApiException catch (e) { return e.message(st.lang); } },
            ),
            // K07 الاستلام بالتوقيع
            if (t['kind'] == 'pickup' && (t['box'] != null || queued.any((x) => x['type'] == 'scanPack'))) _section(context, s.d('courier.confirmPickup'), [
              TextField(controller: name, decoration: InputDecoration(labelText: s.t('اسم المُسلِّم', 'Handed over by'))), const SizedBox(height: 10),
              Text(s.d('courier.signHere')), SignaturePad(onChanged: (v) => sig = v),
              FilledButton(onPressed: () { if (name.text.trim().isEmpty || sig == null) { setState(() => err = s.t('الاسم والتوقيع مطلوبان', 'Name and signature are required')); return; } _do(() => q.act(st, 'pickup', 'courier.pickup', t['shipmentId'], {'signedBy': name.text.trim(), 'method': 'signature'}, s.t('استلام', 'Pickup')), s.t('تم الاستلام — الحيازة لديك', 'Collected — custody is yours')); }, child: Text(s.d('courier.confirmPickup'))),
            ]),
            // K08 بدء النقل والوصول (تتطلب اتصالاً)
            if (mine && status == 'collected' && stage == null) FilledButton.icon(onPressed: q.offline ? null : () => _do(() => st.run('courier.startTransit', {'shipment': t['shipmentId']}), s.d('courier.startTransit')), icon: const Icon(Icons.play_arrow), label: Text(s.d('courier.startTransit'))),
            if (mine && t['kind'] == 'delivery' && status == 'in_transit' && stage == null) Padding(padding: const EdgeInsets.only(top: 8), child: OutlinedButton.icon(onPressed: q.offline ? null : () => _do(() => st.run('courier.arrive', {'shipment': t['shipmentId']}), s.d('courier.arrive')), icon: const Icon(Icons.place), label: Text(s.d('courier.arrive')))),
            if (q.offline && mine && ['collected', 'in_transit'].contains(status)) Padding(padding: const EdgeInsets.only(top: 6), child: Text(s.t('تغيير الحالة يتطلب اتصالاً؛ الحيازة والتسليم يُحفظان دون اتصال.', 'Status changes need a connection; custody and delivery are saved offline.'), style: TextStyle(color: c.muted))),
            // K09 نقل الحيازة
            if (mine && ['collected', 'in_transit', 'at_handover'].contains(status) && (t['kind'] == 'handover' || stage == 'handover')) _section(context, s.d('courier.handover'), [
              SegmentedButton<String>(showSelectedIcon: false, segments: [for (final (k, ar, en) in [('air_carrier', 'جوي', 'Air'), ('partner', 'شريك بري', 'Partner'), ('warehouse', 'مستودع', 'Warehouse'), ('courier', 'مندوب', 'Courier')]) ButtonSegment(value: k, label: Text(s.t(ar, en)))], selected: {toType}, onSelectionChanged: (v) => setState(() { toType = v.first; toId = null; })),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(initialValue: toId, isExpanded: true, decoration: InputDecoration(labelText: s.t('الطرف المستلم', 'Receiving party')), items: [for (final p in targets) DropdownMenuItem(value: '${p['id']}', child: Text('${(p['name'] as Map?)?[st.lang] ?? p['id']}'))], onChanged: (v) => setState(() => toId = v)),
              const SizedBox(height: 10),
              TextField(controller: name, decoration: InputDecoration(labelText: s.t('اسم المستلم من الطرف الآخر', 'Receiving person'))),
              const SizedBox(height: 10),
              ScanPanel(title: s.t('امسح رمز الطرف المستلم لتأكيد الحيازة', 'Scan the receiving party QR to confirm custody'), suggestions: [if (toId != null) ('HO-${toId!.substring(toId!.length - 6).toUpperCase()}', s.t('رمز الطرف المستلم', 'Receiver code'))], onScan: (_) async {
                if (toId == null || name.text.trim().isEmpty) return s.t('اختر الطرف المستلم واكتب اسم المستلم أولاً', 'Choose the receiving party and enter the receiver name first');
                try { await q.act(st, 'handover', 'custody.handover', t['shipmentId'], {'toType': toType, 'toId': toId, 'signedBy': name.text.trim(), 'method': 'qr'}, s.t('نقل حيازة', 'Handover')); Future.delayed(const Duration(milliseconds: 900), _reset); return null; } on ApiException catch (e) { return e.message(st.lang); }
              }),
              if (stage != null) TextButton(onPressed: _reset, child: Text(s.cancel)),
            ]),
            // K10 التسليم مع إثبات + K11 المحاولة الفاشلة
            if (mine && t['kind'] == 'delivery' && ['in_transit', 'at_handover', 'exception'].contains(status) && stage == null) Padding(padding: const EdgeInsets.only(top: 10), child: Row(children: [
              Expanded(flex: 2, child: FilledButton(onPressed: () => setState(() => stage = 'deliver'), child: Text(s.d('courier.deliver')))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: () => setState(() => stage = 'fail'), child: Text(s.d('courier.failAttempt')))),
            ])),
            if (mine && t['kind'] == 'delivery' && stage == null) TextButton(onPressed: () => setState(() => stage = 'handover'), child: Text(s.t('تسليم لطرف آخر بدلاً من ذلك', 'Hand over to another party instead'))),
            if (stage == 'deliver') _section(context, s.d('courier.deliver'), [
              TextField(controller: name, decoration: InputDecoration(labelText: s.d('courier.recipientName'))), const SizedBox(height: 10),
              Text(s.d('courier.signHere')), SignaturePad(onChanged: (v) => sig = v),
              SwitchListTile(contentPadding: EdgeInsets.zero, value: photo, onChanged: (v) => setState(() => photo = v), title: Text(s.d('courier.photo')), secondary: const SimBadge()),
              TextField(controller: note, decoration: InputDecoration(labelText: s.note)), const SizedBox(height: 10),
              FilledButton(onPressed: () { if (name.text.trim().isEmpty || sig == null) { setState(() => err = s.t('اسم المستلم والتوقيع مطلوبان', 'Recipient name and signature are required')); return; } _do(() => q.act(st, 'deliver', 'courier.deliver', t['shipmentId'], {'recipientName': name.text.trim(), 'signature': sig, 'photoRef': photo ? 'photo-sim-${DateTime.now().millisecondsSinceEpoch}' : null, 'notes': note.text}, s.d('courier.deliver')), s.t('تم التسليم مع الإثبات', 'Delivered with proof')); }, child: Text(s.t('تأكيد التسليم', 'Confirm delivery'))),
              TextButton(onPressed: _reset, child: Text(s.cancel)),
            ]),
            if (stage == 'fail') _section(context, s.d('courier.failAttempt'), [
              DropdownButtonFormField<String>(initialValue: reason, decoration: InputDecoration(labelText: s.reason), items: [for (final k in ['RECIPIENT_UNAVAILABLE', 'ADDRESS_ISSUE', 'REFUSED', 'ACCESS_DENIED']) DropdownMenuItem(value: k, child: Text(s.label(k)))], onChanged: (v) => setState(() => reason = v!)),
              const SizedBox(height: 10),
              TextField(controller: note, maxLines: 2, decoration: InputDecoration(labelText: s.note)),
              const SizedBox(height: 8),
              Text(s.t('لا تُتلف أي عينة. القرار (إعادة محاولة / وجهة بديلة / حجز / إرجاع) للعمليات.', 'Never destroy samples. Operations decides: retry / alternate / hold / return.'), style: TextStyle(color: c.muted)),
              const SizedBox(height: 10),
              FilledButton(style: FilledButton.styleFrom(backgroundColor: c.critical), onPressed: () => _do(() => q.act(st, 'failAttempt', 'courier.failAttempt', t['shipmentId'], {'reasonCode': reason, 'notes': note.text}, s.d('courier.failAttempt')), s.t('سُجلت المحاولة وأُبلغت العمليات', 'Attempt recorded; operations notified')), child: Text(s.t('تسجيل', 'Record'))),
              TextButton(onPressed: _reset, child: Text(s.cancel)),
            ]),
            if (t['kind'] == 'done') EmptyView(text: s.t('لا إجراءات مطلوبة على هذه المهمة', 'No actions required on this task'), icon: Icons.task_alt),
          ]);
        },
      ),
    );
  }

  Widget _section(BuildContext context, String title, List<Widget> children) => FadeSlideIn(child: Card(margin: const EdgeInsets.only(top: 10), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(title, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 10), ...children]))));
}
