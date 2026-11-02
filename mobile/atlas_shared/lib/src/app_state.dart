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
      try { me = await api.query('me'); } catch (_) { api.token = null; }
    }
    notifyListeners();
  }

  Future<void> setLang(String l) async { lang = l; api.lang = l; (await SharedPreferences.getInstance()).setString('lang', l); notifyListeners(); }
  Future<void> setTheme(ThemeMode m) async { themeMode = m; (await SharedPreferences.getInstance()).setInt('theme', m.index); notifyListeners(); }

  Future<void> signedInWith(String token) async {
    api.token = token;
    me = await api.query('me');
    (await SharedPreferences.getInstance()).setString('$appKey.token', token);
    notifyListeners();
  }

  Future<void> signOut() async {
    await api.logout();
    me = null;
    (await SharedPreferences.getInstance()).remove('$appKey.token');
    notifyListeners();
  }

  /// ينفّذ أمراً ويحدّث الشاشات؛ يعيد الخطأ للمستدعي ليعرضه بجانب الحقل أو في رسالة
  Future<dynamic> run(String cmd, [Map<String, dynamic>? input]) async {
    final r = await api.exec(cmd, input);
    tick++;
    notifyListeners();
    return r;
  }

  void refresh() { tick++; notifyListeners(); }
}

/// وصول مختصر للحالة من أي ودجت
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);
  static AppState of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
