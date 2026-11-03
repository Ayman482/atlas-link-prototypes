/// تنسيقات العرض: الريال من الهللات، والتاريخ والوقت بتوقيت الرياض (UTC+3) دون اعتماد على حزم إضافية.
class Fmt {
  final String lang;
  const Fmt(this.lang);
  static const _arMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  static const _enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  DateTime? _riyadh(String? iso) { if (iso == null || iso.isEmpty) return null; final d = DateTime.tryParse(iso); return d?.toUtc().add(const Duration(hours: 3)); }
  String _two(int n) => n.toString().padLeft(2, '0');
  String dt(String? iso) {
    final d = _riyadh(iso); if (d == null) return '—';
    final h12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final ampm = d.hour < 12 ? 'ص' : 'م';
    // مطابق للويب (fmtDateTime): العربية بنظام 12 ساعة (ص/م)، والإنجليزية بنظام 24 ساعة
    return lang == 'ar' ? '${_two(d.day)} ${_arMonths[d.month - 1]}، ${_two(h12)}:${_two(d.minute)} $ampm' : '${_two(d.day)} ${_enMonths[d.month - 1]}, ${_two(d.hour)}:${_two(d.minute)}';
  }
  String time(String? iso) { final d = _riyadh(iso); if (d == null) return '—'; return '${_two(d.hour)}:${_two(d.minute)}'; }
  String sar(num? halala) {
    if (halala == null) return '—';
    final v = (halala / 100).toStringAsFixed(2);
    final parts = v.split('.');
    final whole = parts[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
    return '$whole.${parts[1]} ${lang == 'ar' ? 'ر.س' : 'SAR'}'; // مطابق للويب (fmtSAR)
  }
  /// الحرارة والأرقام اللاتينية تُعزل اتجاهياً (LRI…PDI) كي لا تنقلب داخل النص العربي
  /// الوحدة كما في الويب (fmtTemp): «°م» بالعربية و«°C» بالإنجليزية، مع عزل الاتجاه للقيم السالبة
  String temp(num? c) => c == null ? '—' : '\u2066${c.toStringAsFixed(1)} °${lang == 'ar' ? 'م' : 'C'}\u2069';
  static String ltr(Object? v) => v == null ? '—' : '\u2066$v\u2069';
}
