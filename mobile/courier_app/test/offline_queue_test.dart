// اختبارات طابور العمل دون اتصال في تطبيق Flutter الفعلي (مستقلة عن معاينة المتصفح):
// العزل بين حسابات المندوبين على نفس الجهاز، الحفظ التلقائي عند انقطاع الشبكة، مفتاح Idempotency،
// المزامنة المنقطعة، منع المزامنة المزدوجة، عدم فقدان إجراء أُضيف أثناء المزامنة، وانتهاء الجلسة.
import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'package:atlas_courier/offline.dart';

/// خادم وهمي قابل للتحكم: يسجّل الطلبات، ويمكن جعله «غير متاح» أو تأخير ردّ المزامنة أو إرجاع 401
class FakeServer {
  final log = <http.Request>[];
  bool down = false; bool expired = false;
  String user = 'usr_courier1';
  Completer<void>? holdSync;
  Completer<void>? holdCommands;
  final processed = <String>{};
  late final client = MockClient((r) async {
    log.add(r);
    if (down) throw http.ClientException('offline');
    final p = r.url.path;
    http.Response j(Object o, [int s = 200]) => http.Response.bytes(utf8.encode(jsonEncode(o)), s);
    if (expired && !p.endsWith('/auth/login')) return j({'error': {'code': 'SESSION_EXPIRED', 'message_ar': 'انتهت الجلسة', 'message_en': 'Session expired'}}, 401);
    if (p.endsWith('/queries/me')) return j({'data': {'user': {'id': user, 'name': {'ar': 'م', 'en': 'C'}}, 'roles': ['courier']}});
    if (holdCommands != null && p.contains('/commands/') && !p.endsWith('courier.sync')) await holdCommands!.future;
    if (p.endsWith('/health')) return j({'ok': true});
    if (p.endsWith('/commands/courier.sync')) {
      if (holdSync != null) await holdSync!.future;
      final acts = (jsonDecode(r.body)['actions'] as List).cast<Map>();
      return j({'data': {'results': [for (final a in acts) {'clientActionId': a['clientActionId'], 'status': processed.add('${a['clientActionId']}') ? 'accepted' : 'duplicate', 'message': {'ar': '', 'en': ''}}]}});
    }
    return j({'data': {}});
  });
}

Future<(AppState, OfflineQueue, FakeServer)> boot({String user = 'usr_courier1'}) async {
  final srv = FakeServer()..user = user;
  final st = AppState(ApiClient(base: 'http://t/api/v1', client: srv.client), 'courier');
  await st.signedInWith('tok-$user');
  final q = OfflineQueue()..attach(st);
  await Future<void>.delayed(Duration.zero); await q.bind(OfflineQueue.ownerOf(st));
  return (st, q, srv);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('الطابور مربوط بالمندوب: مندوب آخر على نفس الجهاز لا يرى ولا يزامن إجراءات غيره', () async {
    final (st, q, _) = await boot();
    q.offline = true;
    await q.act(st, 'deliver', 'courier.deliver', 'shp_1', {'recipientName': 'أ'}, 'تسليم');
    expect(q.items, hasLength(1));
    // خروج ثم دخول مندوب آخر
    final (st2, q2, srv2) = await boot(user: 'usr_courier2');
    expect(q2.items, isEmpty, reason: 'إجراءات المندوب الأول لا تظهر للثاني');
    q2.offline = false; await q2.sync(st2);
    expect(srv2.log.where((r) => r.url.path.endsWith('courier.sync')), isEmpty, reason: 'لا مزامنة لطابور فارغ');
    // عودة المندوب الأول: إجراؤه ما زال محفوظاً
    final (_, q3, _) = await boot();
    expect(q3.items, hasLength(1));
    expect(st.me?['user']['id'], 'usr_courier1');
  });

  test('انقطاع فعلي للشبكة أثناء إجراء مباشر يحفظه في الطابور بنفس المعرّف', () async {
    final (st, q, srv) = await boot();
    srv.down = true;
    final done = await q.act(st, 'pickup', 'courier.pickup', 'shp_2', {'signedBy': 'x'}, 'استلام');
    expect(done, isFalse);
    expect(q.items, hasLength(1));
    final sentKey = srv.log.last.headers['idempotency-key'];
    expect(sentKey, isNotNull, reason: 'الإجراء المباشر يُرسل بمفتاح Idempotency');
    expect(q.items.first['clientActionId'], sentKey, reason: 'نفس المعرّف — إن كان الخادم قد نفّذه فالمزامنة تعيده كمكرر');
  });

  test('مزامنة منقطعة تُبقي الطابور كاملاً، وإعادة الإرسال آمنة', () async {
    final (st, q, srv) = await boot();
    q.offline = true;
    await q.act(st, 'deliver', 'courier.deliver', 'shp_3', {}, 'تسليم');
    q.offline = false; srv.down = true;
    await expectLater(q.sync(st), throwsA(isA<ApiException>()));
    expect(q.items, hasLength(1)); expect(q.syncing, isFalse);
    srv.down = false; await q.sync(st);
    expect(q.items, isEmpty); expect(q.lastResults.single['status'], 'accepted');
  });

  test('لا مزامنتان متزامنتان، وإجراء أُضيف أثناء المزامنة لا يضيع', () async {
    final (st, q, srv) = await boot();
    q.offline = true;
    await q.act(st, 'deliver', 'courier.deliver', 'shp_4', {}, 'أول');
    q.offline = false; srv.holdSync = Completer<void>();
    final first = q.sync(st);
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(q.syncing, isTrue);
    await q.sync(st); // ضغطة ثانية أثناء المزامنة
    q.offline = true; await q.act(st, 'failAttempt', 'courier.failAttempt', 'shp_5', {}, 'ثانٍ');
    srv.holdSync!.complete(); await first;
    expect(srv.log.where((r) => r.url.path.endsWith('courier.sync')), hasLength(1), reason: 'طلب مزامنة واحد');
    expect(q.items.map((a) => a['label']), ['ثانٍ'], reason: 'الإجراء المضاف أثناء المزامنة باقٍ');
  });

  test('انتهاء الجلسة أثناء المزامنة: يعود لشاشة الدخول ويُحفظ الطابور لنفس المندوب', () async {
    final (st, q, srv) = await boot();
    q.offline = true; await q.act(st, 'deliver', 'courier.deliver', 'shp_6', {}, 'تسليم'); q.offline = false;
    srv.expired = true;
    await expectLater(q.sync(st), throwsA(isA<ApiException>()));
    expect(st.signedIn, isFalse); expect(st.sessionExpired, isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(q.items, isEmpty, reason: 'لا يُعرض طابور بعد الخروج');
    final (_, q2, _) = await boot();
    expect(q2.items, hasLength(1), reason: 'الطابور محفوظ لنفس المندوب بعد إعادة الدخول');
  });

  test('فتح التطبيق دون شبكة يُبقي المندوب داخل التطبيق بآخر ملف محفوظ؛ و401 عند الفتح يخرجه', () async {
    final (st, _, srv) = await boot();
    expect(st.signedIn, isTrue);
    srv.down = true;
    final again = AppState(ApiClient(base: 'http://t/api/v1', client: srv.client), 'courier');
    await again.load();
    expect(again.signedIn, isTrue); expect(again.startedOffline, isTrue);
    srv.down = false; srv.expired = true;
    final third = AppState(ApiClient(base: 'http://t/api/v1', client: srv.client), 'courier');
    await third.load();
    expect(third.signedIn, isFalse); expect(third.sessionExpired, isTrue);
  });

  test('مراقبة الاتصال: الانقطاع الفعلي يُكتشف بالنبض، والعودة تطلق مزامنة تلقائية مرة واحدة', () async {
    final (st, q, srv) = await boot();
    final m = ConnectivityMonitor(st.api, onlineInterval: const Duration(hours: 1), offlineInterval: const Duration(hours: 1));
    q.attachMonitor(m);
    srv.down = true;
    expect(await m.check(), isFalse);
    expect(q.offline, isTrue, reason: 'الانقطاع الفعلي يجعل الطابور في وضع دون اتصال');
    await q.act(st, 'deliver', 'courier.deliver', 'shp_7', {'recipientName': 'أ'}, 'تسليم');
    expect(q.items, hasLength(1));
    srv.down = false;
    expect(await m.check(), isTrue);
    for (var i = 0; i < 20 && q.items.isNotEmpty; i++) { await Future<void>.delayed(const Duration(milliseconds: 10)); }
    expect(q.items, isEmpty, reason: 'مزامنة تلقائية بعد العودة');
    expect(srv.log.where((r) => r.url.path.endsWith('courier.sync')), hasLength(1));
    await m.check(); // فحص ثانٍ وهو متصل: لا مزامنة جديدة
    expect(srv.log.where((r) => r.url.path.endsWith('courier.sync')), hasLength(1));
    m.dispose();
  });

  test('خطأ شبكة أثناء إجراء مباشر يحوّل المراقب فوراً لوضع الانقطاع دون انتظار الدورة', () async {
    final (st, q, srv) = await boot();
    final m = ConnectivityMonitor(st.api, onlineInterval: const Duration(hours: 1));
    q.attachMonitor(m);
    srv.down = true;
    expect(await q.act(st, 'pickup', 'courier.pickup', 'shp_8', {}, 'استلام'), isFalse);
    expect(m.online, isFalse);
    // الإجراء التالي يُحفظ مباشرة دون محاولة طلب (لا انتظار مهلة 20 ثانية)
    final before = srv.log.length;
    await q.act(st, 'deliver', 'courier.deliver', 'shp_9', {}, 'تسليم');
    expect(srv.log.length, before, reason: 'لا طلب أثناء الانقطاع المعروف');
    m.dispose();
  });

  test('منع التكرار: تسليم أو استلام نفس الشحنة مرتين دون اتصال يُحفظ مرة واحدة', () async {
    final (st, q, _) = await boot();
    q.offline = true;
    await q.act(st, 'deliver', 'courier.deliver', 'shp_10', {'recipientName': 'أ'}, 'تسليم');
    await q.act(st, 'deliver', 'courier.deliver', 'shp_10', {'recipientName': 'أ'}, 'تسليم');
    await q.act(st, 'pickup', 'courier.pickup', 'shp_11', {}, 'استلام');
    await q.act(st, 'pickup', 'courier.pickup', 'shp_11', {}, 'استلام');
    expect(q.items.where((a) => a['shipment'] == 'shp_10'), hasLength(1));
    expect(q.items.where((a) => a['shipment'] == 'shp_11'), hasLength(1));
  });

  test('ضغط مزدوج أثناء إجراء مباشر يرسل طلباً واحداً فقط', () async {
    final (st, q, srv) = await boot();
    srv.holdCommands = Completer<void>();
    final a = q.act(st, 'deliver', 'courier.deliver', 'shp_12', {'recipientName': 'أ'}, 'تسليم');
    await Future<void>.delayed(const Duration(milliseconds: 5));
    final b = await q.act(st, 'deliver', 'courier.deliver', 'shp_12', {'recipientName': 'أ'}, 'تسليم');
    expect(b, isFalse);
    srv.holdCommands!.complete(); await a;
    expect(srv.log.where((r) => r.url.path.endsWith('/commands/courier.deliver')), hasLength(1));
  });
}
