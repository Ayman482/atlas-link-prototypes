import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import '../offline.dart';
import 'tasks.dart';
import 'route_map.dart';
import 'boxes.dart';
import 'sync.dart';
import 'me.dart';

class CourierShell extends StatefulWidget {
  const CourierShell({super.key});
  @override
  State<CourierShell> createState() => _CourierShellState();
}

class _CourierShellState extends State<CourierShell> {
  int i = 0;
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final q = OfflineQueue.instance; final c = AtlasColors.of(context);
    const pages = [TasksPage(), RouteMapPage(), BoxesPage(), SyncPage(), MePage()];
    return Scaffold(
      body: Column(children: [
        AnimatedSize(duration: Motion.d(context, AtlasTokens.durBase), child: (q.offline || st.startedOffline || q.items.isNotEmpty) ? Container(width: double.infinity, color: c.goldSoft, padding: EdgeInsets.fromLTRB(12, MediaQuery.paddingOf(context).top + 6, 12, 6), child: Text(q.simulatedOffline ? s.t('وضع دون اتصال (محاكاة) — ${q.items.length} في قائمة الانتظار', 'Offline mode (simulated) — ${q.items.length} queued') : q.offline ? s.t('لا اتصال بالخادم — ${q.items.length} في قائمة الانتظار؛ المزامنة تلقائية عند عودة الاتصال', 'Server unreachable — ${q.items.length} queued; syncs automatically on reconnect') : st.startedOffline ? s.t('لا اتصال بالخادم — تعمل بآخر بيانات محفوظة؛ الإجراءات تُحفظ للمزامنة', 'No server connection — using last saved data; actions are queued for sync') : s.t('إجراءات بانتظار المزامنة: ${q.items.length}', '${q.items.length} action(s) awaiting sync'), textAlign: TextAlign.center, style: TextStyle(color: c.goldText, fontWeight: FontWeight.w600))) : const SizedBox(width: double.infinity)),
        Expanded(child: AnimatedSwitcher(duration: Motion.d(context, AtlasTokens.durBase), child: KeyedSubtree(key: ValueKey(i), child: pages[i]))),
      ]),
      bottomNavigationBar: NavigationBar(selectedIndex: i, onDestinationSelected: (v) => setState(() => i = v), destinations: [
        NavigationDestination(icon: const Icon(Icons.checklist), label: s.t('المهام', 'Tasks')),
        NavigationDestination(icon: const Icon(Icons.alt_route), label: s.t('المسار', 'Route')),
        NavigationDestination(icon: const Icon(Icons.inventory_2_outlined), label: s.t('الصناديق', 'Boxes')),
        NavigationDestination(icon: Badge(isLabelVisible: q.items.isNotEmpty, label: Text('${q.items.length}'), child: const Icon(Icons.sync)), label: s.t('المزامنة', 'Sync')),
        NavigationDestination(icon: const Icon(Icons.person_outline), label: s.t('حسابي', 'Me')),
      ]),
    );
  }
}
