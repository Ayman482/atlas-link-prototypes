import 'dart:convert';
import 'package:http/http.dart' as http;

/// خطأ مجال من الخادم: رمز ثابت + رسالة مترجمة (لا يكشف وجود موارد عميل آخر)
class ApiException implements Exception {
  final String code;
  final String messageAr;
  final String messageEn;
  final int status;
  final String? field;
  ApiException(this.code, this.messageAr, this.messageEn, this.status, [this.field]);
  String message(String lang) => lang == 'ar' ? messageAr : messageEn;
  bool get isNetwork => code == 'NETWORK';
  @override
  String toString() => 'ApiException($code, $status)';
}

class LoginResult {
  final String? token;
  final bool mfaRequired;
  final String? challengeId;
  LoginResult({this.token, this.mfaRequired = false, this.challengeId});
}

/// عميل خادم المحاكاة (packages/mock-api) — نفس الأوامر والاستعلامات التي تستخدمها واجهات الويب.
/// العنوان يُضبط عند البناء: --dart-define=API_BASE=http://10.0.2.2:4000/api/v1 (محاكي Android)
class ApiClient {
  static const defaultBase = String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:4000/api/v1');
  final String base;
  final http.Client _http;
  String? token;
  String lang = 'ar';
  ApiClient({String? base, http.Client? client}) : base = base ?? defaultBase, _http = client ?? http.Client();

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        'accept-language': lang,
        if (token != null) 'authorization': 'Bearer $token',
      };

  Future<dynamic> _send(String method, String path, [Object? body, String? idempotencyKey]) async {
    final uri = Uri.parse('$base$path');
    http.Response r;
    try {
      final h = {..._headers, if (idempotencyKey != null) 'idempotency-key': idempotencyKey};
      r = method == 'GET' ? await _http.get(uri, headers: h).timeout(const Duration(seconds: 20)) : await _http.post(uri, headers: h, body: jsonEncode(body ?? {})).timeout(const Duration(seconds: 20));
    } catch (_) {
      throw ApiException('NETWORK', 'تعذّر الاتصال بالخادم. تحقق من الشبكة.', 'Could not reach the server. Check your connection.', 0);
    }
    if (r.statusCode == 204) return null;
    final j = r.body.isEmpty ? null : jsonDecode(utf8.decode(r.bodyBytes));
    if (r.statusCode >= 400) {
      final e = (j is Map ? j['error'] : null) as Map? ?? {};
      final details = (e['details'] as List?) ?? const [];
      throw ApiException('${e['code'] ?? 'ERROR'}', '${e['message_ar'] ?? e['message'] ?? 'حدث خطأ'}', '${e['message_en'] ?? e['message'] ?? 'Error'}', r.statusCode, details.isNotEmpty ? '${details.first['field']}' : null);
    }
    return j;
  }

  Future<LoginResult> login(String email, String password) async {
    final j = await _send('POST', '/auth/login', {'email': email, 'password': password});
    if (j['mfaRequired'] == true) return LoginResult(mfaRequired: true, challengeId: j['challengeId']);
    token = j['token'];
    return LoginResult(token: token);
  }

  Future<String> verifyMfa(String challengeId, String code) async {
    final j = await _send('POST', '/auth/mfa/verify', {'challengeId': challengeId, 'code': code});
    token = j['token'];
    return token!;
  }

  Future<void> logout() async {
    try { await _send('POST', '/auth/logout'); } catch (_) {}
    token = null;
  }

  /// تنفيذ أمر مجال (ذرّي في الخادم). المفتاح الاختياري يمنع التكرار عند إعادة المحاولة.
  Future<dynamic> exec(String command, [Map<String, dynamic>? input, String? idempotencyKey]) async => (await _send('POST', '/commands/$command', input ?? {}, idempotencyKey))['data'];

  /// استعلام مقيّد بنطاق المستخدم
  Future<dynamic> query(String name, [Map<String, dynamic>? params]) async => (await _send('GET', '/queries/$name?p=${Uri.encodeComponent(jsonEncode(params ?? {}))}'))['data'];

  Future<List<Map<String, dynamic>>> list(String collection, {String? sort, String dir = 'desc', int pageSize = 200}) async {
    final r = await query('list', {'collection': collection, 'pageSize': pageSize, if (sort != null) 'sort': sort, 'dir': dir});
    return ((r['items'] as List?) ?? const []).cast<Map<String, dynamic>>();
  }
}
