import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'track.dart';

/// CM08 الإشعارات: الحرج أولاً بلون واضح، تعليم كمقروء، والضغط يفتح الشحنة المرتبطة
class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(s.notifications)),
      body: RefreshIndicator(onRefresh: () async => st.refresh(), child: AsyncView<List<Map<String, dynamic>>>(
        reloadKey: st.tick,
        load: () => st.api.list('notifications', sort: 'createdAt'),
        builder: (ctx, rows) {
          if (rows.isEmpty) return ListView(children: const [EmptyView(icon: Icons.notifications_none)]);
          final unread = rows.where((n) => n['readAt'] == null).toList();
          return ListView(padding: const EdgeInsets.all(16), children: [
            if (unread.isNotEmpty) Align(alignment: AlignmentDirectional.centerEnd, child: TextButton(onPressed: () => st.run('notification.markAllRead', {'ids': rows.map((r) => r['id']).toList()}), child: Text(s.d('common.markAllRead')))),
            for (var i = 0; i < rows.length; i++) FadeSlideIn(index: i, child: Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(
              color: rows[i]['critical'] == true ? c.criticalSoft : null,
              child: ListTile(
                leading: rows[i]['critical'] == true ? Icon(Icons.warning_amber_rounded, color: c.critical) : Icon(rows[i]['readAt'] == null ? Icons.circle : Icons.circle_outlined, size: 12, color: Theme.of(context).colorScheme.primary),
                title: Text('${(rows[i]['title'] as Map)[st.lang]}', style: TextStyle(fontWeight: rows[i]['readAt'] == null ? FontWeight.w700 : FontWeight.w400)),
                subtitle: Text('${(rows[i]['body'] as Map)[st.lang]}\n${f.dt(rows[i]['createdAt'])}'),
                isThreeLine: true,
                onTap: () {
                  st.run('notification.markRead', {'id': rows[i]['id']});
                  final m = RegExp(r'^/(?:shipments|inbound)/(.+)$').firstMatch('${rows[i]['link'] ?? ''}');
                  if (m != null) Navigator.push(context, MaterialPageRoute(builder: (_) => TrackPage(id: m.group(1)!)));
                },
              ),
            ))),
          ]);
        },
      )),
    );
  }
}
