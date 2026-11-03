import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atlas_shared/atlas_shared.dart';

/// طابور العمل دون اتصال (RTE-003 / NFR-009): كل إجراء يحمل معرّفاً فريداً ووقت الجهاز، ويُرسل لاحقاً إلى courier.sync
/// الذي يقبله أو يرفضه كتعارض أو يتجاهله إن كان مكرراً — دون أي أثر مزدوج.
///
/// ضمانات هذا التنفيذ:
/// - الطابور مربوط بحساب المندوب (مفتاح تخزين لكل مستخدم): مندوب آخر يسجّل الدخول على نفس الجهاز لا يرى ولا يزامن إجراءات غيره،
///   وإجراءات المندوب تبقى محفوظة بعد انتهاء جلسته حتى يعود ويزامنها بنفسه.
/// - الإجراء المباشر يُرسل بمفتاح Idempotency هو نفس معرّفه؛ إن انقطعت الشبكة (NETWORK) يُحفظ في الطابور تلقائياً بنفس المعرّف.
/// - المزامنة لا تعمل مرتين في الوقت نفسه، ولا تحذف إلا الإجراءات التي أعاد الخادم لها نتيجة نهائية؛
///   ما أُضيف أثناء المزامنة أو لم يصل يبقى في الطابور. انقطاع المزامنة يُبقي الطابور كاملاً، وإعادة الإرسال آمنة (duplicate).
class OfflineQueue extends ChangeNotifier {
  static final instance = OfflineQueue();
  bool simulatedOffline = false; // مفتاح «محاكاة الانقطاع» للاختبار الميداني
  ConnectivityMonitor? monitor; // مراقبة الاتصال الفعلي بالخادم
  String? lastSyncError;
  final Set<String> _inflight = {}; // إجراءات مباشرة قيد الإرسال (منع الضغط المزدوج)
  /// منقطع = المحاكاة أو فشل الوصول الفعلي للخادم
  bool get offline => simulatedOffline || !(monitor?.online ?? true);
  set offline(bool v) { simulatedOffline = v; notifyListeners(); }
  bool syncing = false;
  String? owner; // معرّف المندوب المالك للطابور الحالي
  List<Map<String, dynamic>> items = [];
  List<Map<String, dynamic>> lastResults = [];
  AppState? _st;

  static String keyFor(String owner) => 'courier.queue.$owner';
  static String? ownerOf(AppState st) { final u = st.me?['user'] as Map?; return (u?['id'] ?? u?['email'])?.toString(); }

  /// يربط الطابور بمراقب الاتصال: عند عودة الاتصال تبدأ مزامنة تلقائية (مرة واحدة، وفقط لمندوب مسجّل الدخول)
  void attachMonitor(ConnectivityMonitor m) {
    monitor?.removeListener(notifyListeners);
    monitor = m;
    m.addListener(notifyListeners);
    m.onReconnect(() => autoSync());
  }

  /// مزامنة تلقائية آمنة: لا تعمل أثناء المحاكاة أو دون جلسة؛ الخطأ يُحفظ للعرض ولا يُرمى
  Future<void> autoSync() async {
    final st = _st;
    if (st == null || !st.signedIn || simulatedOffline || items.isEmpty) return;
    try { await sync(st); lastSyncError = null; } on ApiException catch (e) { lastSyncError = e.message(st.lang); if (e.isNetwork) monitor?.reportNetworkFailure(); notifyListeners(); }
  }

  /// يربط الطابور بحالة التطبيق: يُعاد تحميله عند تغيّر الحساب
  void attach(AppState st) {
    _st?.removeListener(_onState);
    _st = st;
    st.addListener(_onState);
    _onState();
  }
  void _onState() { final o = _st == null ? null : ownerOf(_st!); if (o != owner) bind(o); }

  /// يحمّل طابور المستخدم المحدد (أو يفرغ العرض عند الخروج دون حذف المحفوظ)
  Future<void> bind(String? user) async {
    owner = user; lastResults = [];
    if (user == null) { items = []; notifyListeners(); return; }
    final p = await SharedPreferences.getInstance();
    if (owner != user) return; // تغيّر الحساب أثناء التحميل
    items = (jsonDecode(p.getString(keyFor(user)) ?? '[]') as List).cast<Map>().map((e) => e.cast<String, dynamic>()).toList();
    notifyListeners();
  }

  /// للتوافق: تحميل أولي — الطابور القديم غير المربوط بمستخدم لا يُحمّل لأي حساب
  Future<void> load() async => bind(owner);

  Future<void> _save() async { final o = owner; if (o == null) return; (await SharedPreferences.getInstance()).setString(keyFor(o), jsonEncode(items)); }
  void toggle() { simulatedOffline = !simulatedOffline; notifyListeners(); if (!simulatedOffline) autoSync(); }

  /// الإجراءات التي تُنفَّذ مرة واحدة لكل شحنة: لا يُضاف لها عنصر ثانٍ في الطابور ما دام الأول معلّقاً
  static const _oncePerShipment = {'scanPack', 'pickup', 'deliver', 'failAttempt', 'handover'};
  Map<String, dynamic>? pendingFor(String type, String shipment) {
    for (final a in items) { if (a['type'] == type && a['shipment'] == shipment) return a; }
    return null;
  }

  static String newId() => 'ca-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${Random().nextInt(1 << 20).toRadixString(36)}';

  Future<void> push(String type, String shipment, Map<String, dynamic> payload, String label, {String? id}) async {
    if (owner == null) throw StateError('no signed-in courier');
    if (_oncePerShipment.contains(type) && pendingFor(type, shipment) != null) return; // منع التكرار (مثل تسليم مرتين دون اتصال)
    items.add({'clientActionId': id ?? newId(), 'type': type, 'shipment': shipment, 'occurredAt': DateTime.now().toUtc().toIso8601String(), 'payload': payload, 'label': label});
    await _save(); notifyListeners();
  }

  /// ينفّذ مباشرة أو يضيف للطابور حسب حالة الشبكة. يعيد true إن نُفّذ فوراً، وfalse إن حُفظ للمزامنة.
  Future<bool> act(AppState st, String type, String cmd, String shipment, Map<String, dynamic> payload, String label) async {
    final key = '$type:$shipment';
    if (_inflight.contains(key)) return false; // ضغطة ثانية أثناء الإرسال: لا طلب ثانٍ
    final pending = pendingFor(type, shipment);
    if (pending != null) return false; // الإجراء نفسه معلّق في الطابور
    final id = newId();
    if (offline) { await push(type, shipment, payload, label, id: id); return false; }
    _inflight.add(key);
    try {
      await st.run(cmd, {'shipment': shipment, ...payload}, id);
      monitor?.reportSuccess();
      return true;
    } on ApiException catch (e) {
      if (!e.isNetwork) rethrow;
      monitor?.reportNetworkFailure();
      await push(type, shipment, payload, label, id: id); // انقطاع فعلي: لا يضيع الإجراء، بنفس المعرّف
      return false;
    } finally {
      _inflight.remove(key);
    }
  }

  Future<void> sync(AppState st) async {
    if (syncing || items.isEmpty) return;
    syncing = true; notifyListeners();
    final batchOwner = owner;
    final batch = [for (final a in items) Map<String, dynamic>.from(a)];
    try {
      final r = await st.run('courier.sync', {'actions': [for (final a in batch) {...a}..remove('label')]});
      if (owner != batchOwner) return; // تغيّر الحساب أثناء المزامنة: لا يُمس طابور الحساب الجديد
      final results = (r['results'] as List).cast<Map>();
      final done = {for (final x in results) '${x['clientActionId']}'};
      lastResults = [for (final x in results) {...x.cast<String, dynamic>(), 'label': batch.firstWhere((i) => i['clientActionId'] == x['clientActionId'], orElse: () => {'label': ''})['label']}];
      items = items.where((a) => !done.contains(a['clientActionId'])).toList();
      await _save();
      monitor?.reportSuccess();
    } finally {
      syncing = false; notifyListeners();
    }
  }
}
