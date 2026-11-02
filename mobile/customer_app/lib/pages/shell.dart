import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'home.dart';
import 'shipments.dart';
import 'new_shipment.dart';
import 'notifications.dart';
import 'account.dart';
import 'common.dart';

/// الهيكل: شريط تنقل سفلي بخمسة أقسام. الانتقال بين الأقسام بتلاشٍ قصير (220ms)
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});
  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int i = 0;
  @override
  void didChangeDependencies() { super.didChangeDependencies(); loadCities(AppScope.of(context)).then((_) { if (mounted) setState(() {}); }).catchError((_) {}); }
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s;
    final pages = [HomePage(onNew: () => setState(() => i = 2)), const ShipmentsPage(), NewShipmentPage(onDone: () => setState(() => i = 1)), const NotificationsPage(), const AccountPage()];
    return Scaffold(
      body: AnimatedSwitcher(duration: Motion.d(context, AtlasTokens.durBase), child: KeyedSubtree(key: ValueKey(i), child: pages[i])),
      bottomNavigationBar: NavigationBar(
        selectedIndex: i,
        onDestinationSelected: (v) => setState(() => i = v),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: s.t('الرئيسية', 'Home')),
          NavigationDestination(icon: const Icon(Icons.inventory_2_outlined), selectedIcon: const Icon(Icons.inventory_2), label: s.t('شحناتي', 'Shipments')),
          NavigationDestination(icon: const Icon(Icons.add_circle_outline), selectedIcon: const Icon(Icons.add_circle), label: s.t('طلب', 'Request')),
          NavigationDestination(icon: const Icon(Icons.notifications_none), selectedIcon: const Icon(Icons.notifications), label: s.notifications),
          NavigationDestination(icon: const Icon(Icons.person_outline), selectedIcon: const Icon(Icons.person), label: s.t('حسابي', 'Account')),
        ],
      ),
    );
  }
}
