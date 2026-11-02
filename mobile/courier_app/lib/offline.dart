import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atlas_shared/atlas_shared.dart';

/// طابور العمل دون اتصال (RTE-003 / NFR-009): كل إجراء يحمل معرّفاً فريداً ووقت الجهاز، ويُرسل لاحقاً إلى courier.sync
/// الذي يقبله أو يرفضه كتعارض أو يتجاهله إن كان مكرراً — دون أي أثر مزدوج.
class OfflineQueue extends ChangeNotifier {
  static final instance = OfflineQueue();
  bool offline = false; // وضع محاكاة انقطاع الشبكة للاختبار الميداني
  List<Map<String, dynamic>> items = [];
  List<Map<String, dynamic>> lastResults = [];

  Future<void> load() async { final p = await SharedPreferences.getInstance(); items = (jsonDecode(p.getString('courier.queue') ?? '[]') as List).cast<Map<String, dynamic>>(); notifyListeners(); }
  Future<void> _save() async => (await SharedPreferences.getInstance()).setString('courier.queue', jsonEncode(items));
  void toggle() { offline = !offline; notifyListeners(); }

  Future<void> push(String type, String shipment, Map<String, dynamic> payload, String label) async {
    final id = 'ca-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${Random().nextInt(1 << 20).toRadixString(36)}';
    items.add({'clientActionId': id, 'type': type, 'shipment': shipment, 'occurredAt': DateTime.now().toUtc().toIso8601String(), 'payload': payload, 'label': label});
    await _save(); notifyListeners();
  }

  /// ينفّذ مباشرة أو يضيف للطابور حسب حالة الشبكة. يعيد true إن نُفّذ فوراً.
  Future<bool> act(AppState st, String type, String cmd, String shipment, Map<String, dynamic> payload, String label) async {
    if (offline) { await push(type, shipment, payload, label); return false; }
    await st.run(cmd, {'shipment': shipment, ...payload});
    return true;
  }

  Future<void> sync(AppState st) async {
    final r = await st.run('courier.sync', {'actions': [for (final a in items) {...a}..remove('label')]});
    lastResults = [for (final x in (r['results'] as List).cast<Map>()) {...x.cast<String, dynamic>(), 'label': items.firstWhere((i) => i['clientActionId'] == x['clientActionId'], orElse: () => {'label': ''})['label']}];
    items = []; await _save(); notifyListeners();
  }
}
