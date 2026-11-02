import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'pages/shell.dart';

const customerAccounts = [
  DemoAccount('corp.admin@medlog.demo', 'د. أحمد الزامل', 'Dr. Ahmed Al-Zamil', 'corp_admin'),
  DemoAccount('branch.op@medlog.demo', 'أ. سارة العتيبي', 'Sara Al-Otaibi', 'branch_operator'),
  DemoAccount('corp.finance@medlog.demo', 'أ. وليد التميمي', 'Waleed Al-Tamimi', 'corp_finance'),
  DemoAccount('individual@medlog.demo', 'عبدالله المطيري', 'Abdullah Al-Mutairi', 'individual'),
];
const customerRoles = ['corp_admin', 'branch_manager', 'branch_operator', 'branch_viewer', 'corp_finance', 'individual'];

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState(ApiClient(), 'customer');
  await state.load();
  runApp(CustomerApp(state: state));
}

class CustomerApp extends StatelessWidget {
  final AppState state;
  const CustomerApp({super.key, required this.state});
  @override
  Widget build(BuildContext context) => AppScope(
        state: state,
        child: ListenableBuilder(
          listenable: state,
          builder: (_, __) => MaterialApp(
            title: 'Atlas Link — Customer',
            debugShowCheckedModeBanner: false,
            theme: AtlasTheme.light(),
            darkTheme: AtlasTheme.dark(),
            themeMode: state.themeMode,
            locale: state.locale,
            supportedLocales: const [Locale('ar'), Locale('en')],
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            home: state.signedIn && state.roles.any(customerRoles.contains)
                ? const CustomerShell()
                : LoginScreen(title: state.s.t('تطبيق العميل', 'Customer app'), accounts: customerAccounts, allowed: (r) => r.any(customerRoles.contains)),
          ),
        ),
      );
}
