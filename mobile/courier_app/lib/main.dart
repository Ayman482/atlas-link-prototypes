import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'pages/shell.dart';
import 'offline.dart';

const courierAccounts = [
  DemoAccount('courier1@medlog.demo', 'محمد الدوسري', 'Mohammed Al-Dosari', 'courier'),
  DemoAccount('courier2@medlog.demo', 'ناصر اليامي', 'Nasser Al-Yami', 'courier'),
];

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState(ApiClient(), 'courier');
  await state.load();
  await OfflineQueue.instance.load();
  runApp(CourierApp(state: state));
}

class CourierApp extends StatelessWidget {
  final AppState state;
  const CourierApp({super.key, required this.state});
  @override
  Widget build(BuildContext context) => AppScope(
        state: state,
        child: ListenableBuilder(
          listenable: Listenable.merge([state, OfflineQueue.instance]),
          builder: (_, __) => MaterialApp(
            title: 'Atlas Link — Courier',
            debugShowCheckedModeBanner: false,
            theme: AtlasTheme.light(),
            darkTheme: AtlasTheme.dark(),
            themeMode: state.themeMode,
            locale: state.locale,
            supportedLocales: const [Locale('ar'), Locale('en')],
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            home: state.signedIn && state.roles.contains('courier') ? const CourierShell() : LoginScreen(title: state.s.t('تطبيق المندوب', 'Courier app'), accounts: courierAccounts, allowed: (r) => r.contains('courier')),
          ),
        ),
      );
}
