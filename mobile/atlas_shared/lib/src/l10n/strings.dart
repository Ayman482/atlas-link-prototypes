import 'labels.g.dart';

/// نصوص التطبيقين بالعربية (الافتراضية) والإنجليزية. التسميات والمصطلحات مولّدة من نفس مصدر الويب (labels.g.dart).
class S {
  final String lang;
  const S(this.lang);
  bool get ar => lang == 'ar';
  String t(String ar, String en) => this.ar ? ar : en;

  /// تسمية قيمة رمزية (حالة، نوع، فئة…) — تُعيد الرمز نفسه إن لم توجد له تسمية
  /// [domain] يحل الرموز المتعددة المعنى (مثل outcome للنتيجة: failed = «فشل» لا «تعذّر التسليم») — نفس منطق الويب
  String label(String? v, [String? domain]) {
    if (v == null || v.isEmpty) return '—';
    final l = (domain == null ? null : kValueLabels['$domain.$v']) ?? kValueLabels[v];
    return l == null ? v : (ar ? l[0] : l[1]);
  }

  /// التحية حسب الساعة بتوقيت الرياض (UTC+3 دون توقيت صيفي) — «مساء الخير» بعد الظهر
  String greeting([DateTime? now]) {
    final h = (now ?? DateTime.now()).toUtc().add(const Duration(hours: 3)).hour;
    return d(h < 12 ? 'greet.morning' : h < 18 ? 'greet.afternoon' : 'greet.evening');
  }
  String get comma => ar ? '، ' : ', ';

  /// عنوان حدث الخط الزمني من رموزه المنظمة — مطابق لـ timelineTitle في terms.ts
  String timelineTitle(Map e) {
    final c = e['codes'] as Map?; final title = (e['title'] as Map?)?[lang] ?? '';
    if (c == null) return '$title';
    final arrow = ar ? ' ← ' : ' → ';
    switch (e['kind']) {
      case 'status': return c['status'] != null ? label('${c['status']}') : '$title';
      case 'custody': return '${t('نقل الحيازة', 'Custody transfer')}: ${label('${c['fromType']}', 'custodian')}$arrow${label('${c['toType']}', 'custodian')}';
      case 'carrier': return '${t('الناقل', 'Carrier')}: ${label('${c['eventType']}')}';
      case 'device': return '${t('جهاز التتبع', 'Tracker')}: ${label('${c['eventType']}')}';
      case 'attempt': return '${t('محاولة تسليم فاشلة', 'Failed delivery attempt')}: ${label('${c['reasonCode']}')}';
      default: return '$title';
    }
  }
  /// تفاصيل الحدث — مطابق لـ timelineDetail في terms.ts
  String timelineDetail(Map e) {
    final c = e['codes'] as Map?; final dt = '${e['detail'] ?? ''}';
    if (c == null) return dt;
    if (e['kind'] == 'custody' && c['method'] != null) return '${dt.replaceAll(RegExp(r'\s*\([\w-]+\)\s*$'), '')} (${label('${c['method']}')})';
    if (e['kind'] == 'excursion' && c['status'] != null) return label('${c['status']}');
    if (e['kind'] == 'attempt' && c['reasonCode'] != null) return label('${c['reasonCode']}');
    return dt;
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
