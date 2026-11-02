import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api/api_client.dart';
import 'l10n/strings.dart';

/// حالة التطبيق: اللغة واتجاهها، السمة، الجلسة، والمستخدم الحالي. تُحفظ اللغة والسمة والجلسة على الجهاز.
class AppState extends ChangeNotifier {
  final ApiClient api;
  final String appKey;
  AppState(this.api, this.appKey);

  String lang = 'ar';
  ThemeMode themeMode = ThemeMode.system;
  Map<String, dynamic>? me;
  int tick = 0; // يزيد بعد كل أمر لتحديث الشاشات
  bool sessionExpired = false; // تُعرض رسالة «انتهت الجلسة» في شاشة الدخول
  bool startedOffline = false; // فُتح التطبيق دون شبكة باستخدام آخر ملف مستخدم محفوظ

  S get s => S(lang);
  Locale get locale => Locale(lang);
  bool get signedIn => api.token != null && me != null;
  List<String> get roles => ((me?['roles'] as List?) ?? const []).cast<String>();

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    lang = p.getString('lang') ?? 'ar';
    themeMode = ThemeMode.values[p.getInt('theme') ?? 0];
    api.lang = lang;
    final t = p.getString('$appKey.token');
    if (t != null) {
      api.token = t;
      try {
        me = await api.query('me');
        p.setString('$appKey.me', jsonEncode(me));
      } on ApiException catch (e) {
        if (e.isNetwork) {
          // دون شبكة عند الفتح: يبقى المندوب داخل التطبيق بآخر ملف محفوظ ليعمل دون اتصال (لا يُخرج)
          final cached = p.getString('$appKey.me');
          if (cached != null) { me = (jsonDecode(cached) as Map).cast<String, dynamic>(); startedOffline = true; } else { api.token = null; }
        } else {
          await _dropSession(p, expired: e.status == 401);
        }
      } catch (_) { api.token = null; }
    }
    notifyListeners();
  }

  Future<void> setLang(String l) async { lang = l; api.lang = l; (await SharedPreferences.getInstance()).setString('lang', l); notifyListeners(); }
  Future<void> setTheme(ThemeMode m) async { themeMode = m; (await SharedPreferences.getInstance()).setInt('theme', m.index); notifyListeners(); }

  Future<void> signedInWith(String token) async {
    api.token = token;
    me = await api.query('me');
    sessionExpired = false; startedOffline = false;
    final p = await SharedPreferences.getInstance();
    p.setString('$appKey.token', token);
    p.setString('$appKey.me', jsonEncode(me));
    notifyListeners();
  }

  Future<void> signOut() async {
    await api.logout();
    await _dropSession(await SharedPreferences.getInstance());
  }

  Future<void> _dropSession(SharedPreferences p, {bool expired = false}) async {
    api.token = null; me = null; sessionExpired = expired;
    p.remove('$appKey.token'); p.remove('$appKey.me');
    notifyListeners();
  }

  /// ينفّذ أمراً ويحدّث الشاشات؛ يعيد الخطأ للمستدعي ليعرضه بجانب الحقل أو في رسالة.
  /// انتهاء الجلسة (401) يعيد المستخدم لشاشة الدخول مع رسالة، دون حذف أي إجراءات محفوظة دون اتصال.
  Future<dynamic> run(String cmd, [Map<String, dynamic>? input, String? idempotencyKey]) async {
    try {
      final r = await api.exec(cmd, input, idempotencyKey);
      startedOffline = false;
      tick++;
      notifyListeners();
      return r;
    } on ApiException catch (e) {
      if (e.status == 401) await _dropSession(await SharedPreferences.getInstance(), expired: true);
      rethrow;
    }
  }

  void refresh() { tick++; notifyListeners(); }
}

/// وصول مختصر للحالة من أي ودجت
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);
  static AppState of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
