import 'labels.g.dart';

/// نصوص التطبيقين بالعربية (الافتراضية) والإنجليزية. التسميات والمصطلحات مولّدة من نفس مصدر الويب (labels.g.dart).
class S {
  final String lang;
  const S(this.lang);
  bool get ar => lang == 'ar';
  String t(String ar, String en) => this.ar ? ar : en;

  /// تسمية قيمة رمزية (حالة، نوع، فئة…) — تُعيد الرمز نفسه إن لم توجد له تسمية
  String label(String? v) {
    if (v == null || v.isEmpty) return '—';
    final l = kValueLabels[v];
    return l == null ? v : (ar ? l[0] : l[1]);
  }

  /// مفتاح من القاموس المشترك مثل 'ship.timeline'
  String d(String key) { final l = kDict[key]; return l == null ? key : (ar ? l[0] : l[1]); }

  String get appName => d('app.name');
  String get signIn => d('auth.signIn');
  String get email => d('auth.email');
  String get password => d('auth.password');
  String get verify => d('auth.verify');
  String get mfaTitle => d('auth.mfaTitle');
  String get mfaHint => d('auth.mfaHint');
  String get demoAccounts => d('auth.demoAccounts');
  String get demoBadge => d('app.demoBadge');
  String get simulated => d('app.simulated');
  String get retry => d('common.retry');
  String get cancel => d('common.cancel');
  String get confirm => d('common.confirm');
  String get save => d('common.save');
  String get back => d('common.back');
  String get next => d('common.next');
  String get loading => d('common.loading');
  String get empty => d('common.empty');
  String get signOut => d('common.signOut');
  String get language => d('common.language');
  String get notifications => d('common.notifications');
  String get required => d('common.required');
  String get reason => d('common.reason');
  String get note => d('common.note');
}
