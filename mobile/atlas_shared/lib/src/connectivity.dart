import 'dart:async';
import 'package:flutter/foundation.dart';
import 'api/api_client.dart';

/// مراقبة الاتصال بالخادم (وليس بالشبكة فقط): نبض خفيف إلى /health بدون مصادقة.
/// - متصل: فحص كل [onlineInterval]. منقطع: فحص كل [offlineInterval] حتى يعود.
/// - أي طلب يفشل بخطأ شبكة يبلّغ [reportNetworkFailure] فيتحول فوراً لوضع الانقطاع دون انتظار الدورة.
/// - عند العودة تُستدعى [onReconnect] (المزامنة التلقائية في تطبيق المندوب).
/// يعمل على Android وiOS والويب دون إضافة أذونات نظام؛ لا يعتمد على حالة Wi-Fi لأن وجود شبكة لا يعني الوصول للخادم.
class ConnectivityMonitor extends ChangeNotifier {
  final ApiClient api;
  final Duration onlineInterval;
  final Duration offlineInterval;
  bool online = true;
  DateTime? lastOnlineAt;
  DateTime? lastCheckAt;
  final List<Future<void> Function()> _onReconnect = [];
  Timer? _timer;
  bool _checking = false;

  ConnectivityMonitor(this.api, {this.onlineInterval = const Duration(seconds: 30), this.offlineInterval = const Duration(seconds: 5)});

  void onReconnect(Future<void> Function() fn) => _onReconnect.add(fn);

  void start() { _schedule(); }
  void stop() { _timer?.cancel(); _timer = null; }
  void _schedule() { _timer?.cancel(); _timer = Timer(online ? onlineInterval : offlineInterval, () async { await check(); _schedule(); }); }

  /// فحص فوري؛ يعيد حالة الاتصال
  Future<bool> check() async {
    if (_checking) return online;
    _checking = true;
    try { await api.ping(); _set(true); } on ApiException catch (e) { if (e.isNetwork) _set(false); else _set(true); } catch (_) { _set(false); } finally { _checking = false; lastCheckAt = DateTime.now(); }
    return online;
  }

  void reportNetworkFailure() { if (online) { _set(false); _schedule(); } }
  void reportSuccess() => _set(true);

  void _set(bool v) {
    final was = online; online = v;
    if (v) lastOnlineAt = DateTime.now();
    if (was != v) {
      notifyListeners();
      if (v && !was) { for (final f in List.of(_onReconnect)) { unawaited(f().catchError((_) {})); } }
      if (_timer != null) _schedule();
    }
  }

  @override
  void dispose() { stop(); super.dispose(); }
}
