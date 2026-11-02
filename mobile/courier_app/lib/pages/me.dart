import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';

/// K14 الحساب: المناوبة، التأهيل، المركبة، اللغة، السمة، سجل الحيازة
class MePage extends StatelessWidget {
  const MePage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final u = st.me?['user'] as Map? ?? {};
    return Scaffold(
      appBar: AppBar(title: Text(s.t('حسابي', 'Me'))),
      body: AsyncView<dynamic>(
        reloadKey: st.tick,
        load: () async => [await st.api.query('courier.tasks', {}), await st.api.list('custody', sort: 'occurredAt')],
        builder: (ctx, r) {
          final d = r[0] as Map; final cou = d['courier'] as Map; final veh = d['vehicle'] as Map?;
          final hist = (r[1] as List).cast<Map>().where((e) => e['toId'] == cou['id'] || e['fromId'] == cou['id']).take(15).toList();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Card(child: ListTile(title: Text('${(u['name'] as Map?)?[st.lang] ?? ''}'), subtitle: Text('${u['email']}\n${s.label(cou['employmentType'])} · ${s.t('التأهيل حتى', 'Qualified until')} ${f.dt(cou['qualificationExpiry'])}${veh != null ? ' · ${veh['plate']}' : ''}'), isThreeLine: true)),
            const SizedBox(height: 10),
            Card(child: ListTile(title: Text(s.t('المناوبة', 'Shift')), trailing: StatusPill('${cou['status']}'), subtitle: Padding(padding: const EdgeInsets.only(top: 8), child: Align(alignment: AlignmentDirectional.centerStart, child: cou['status'] == 'off_shift'
                ? FilledButton(onPressed: () => st.run('courier.setStatus', {'courierId': cou['id'], 'status': 'available'}).catchError((e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message(st.lang) : '$e'))); }), child: Text(s.d('courier.startShift')))
                : OutlinedButton(onPressed: () => st.run('courier.setStatus', {'courierId': cou['id'], 'status': 'off_shift'}).catchError((e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message(st.lang) : '$e'))); }), child: Text(s.d('courier.endShift'))))))),
            const SizedBox(height: 10),
            SegmentedButton<String>(showSelectedIcon: false, segments: const [ButtonSegment(value: 'ar', label: Text('العربية')), ButtonSegment(value: 'en', label: Text('English'))], selected: {st.lang}, onSelectionChanged: (v) => st.setLang(v.first)),
            const SizedBox(height: 10),
            SegmentedButton<ThemeMode>(showSelectedIcon: false, segments: [ButtonSegment(value: ThemeMode.system, label: Text(s.t('تلقائي', 'Auto'))), ButtonSegment(value: ThemeMode.light, label: Text(s.t('فاتح', 'Light'))), ButtonSegment(value: ThemeMode.dark, label: Text(s.t('داكن', 'Dark')))], selected: {st.themeMode}, onSelectionChanged: (v) => st.setTheme(v.first)),
            const SizedBox(height: 16),
            Text(s.t('سجل الحيازة', 'Custody history'), style: Theme.of(context).textTheme.titleMedium),
            for (final e in hist) ListTile(dense: true, leading: const Icon(Icons.swap_horiz), title: Text('${s.label(e['eventType'])} · ${s.label(e['source'])}'), subtitle: Text('${f.dt(e['occurredAt'])} · ${(e['evidence'] as Map?)?['signedBy'] ?? ''}')),
            const SizedBox(height: 12),
            OutlinedButton.icon(style: OutlinedButton.styleFrom(foregroundColor: AtlasColors.of(context).critical), onPressed: st.signOut, icon: const Icon(Icons.logout), label: Text(s.signOut)),
          ]);
        },
      ),
    );
  }
}
