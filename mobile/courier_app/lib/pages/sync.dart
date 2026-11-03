import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import '../offline.dart';

/// K12 العمل دون اتصال: تبديل وضع الشبكة (محاكاة)، الطابور، المزامنة ونتائجها، وسجل التعارضات
class SyncPage extends StatelessWidget {
  const SyncPage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final f = Fmt(st.lang); final c = AtlasColors.of(context); final q = OfflineQueue.instance;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('دون اتصال والمزامنة', 'Offline & sync'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: SwitchListTile(value: q.simulatedOffline, onChanged: (_) => q.toggle(), title: Text(s.t('محاكاة انقطاع الشبكة', 'Simulate network loss')), subtitle: Text(s.t('تُخزّن الإجراءات محلياً بمعرّف فريد وتُزامن دون تكرار.', 'Actions are stored locally with unique IDs and synced idempotently.')), secondary: Icon(q.offline ? Icons.cloud_off : Icons.cloud_done, color: q.offline ? c.warning : c.success))),
        const SizedBox(height: 8),
        // حالة الاتصال الفعلي بالخادم (مستقلة عن مفتاح المحاكاة)
        Card(child: ListTile(leading: Icon((q.monitor?.online ?? true) ? Icons.cloud_done_outlined : Icons.cloud_off_outlined, color: (q.monitor?.online ?? true) ? c.success : c.critical),
          title: Text((q.monitor?.online ?? true) ? s.t('الخادم متصل', 'Server reachable') : s.t('لا اتصال بالخادم', 'Server unreachable')),
          subtitle: Text([
            if (q.monitor?.lastOnlineAt != null) '${s.t('آخر اتصال', 'Last online')}: ${f.dt(q.monitor!.lastOnlineAt!.toUtc().toIso8601String())}',
            s.t('المزامنة تلقائية عند عودة الاتصال', 'Syncs automatically when back online'),
            if (q.lastSyncError != null) '${s.t('آخر خطأ مزامنة', 'Last sync error')}: ${q.lastSyncError}',
          ].join('\n')),
          trailing: TextButton(onPressed: () => q.monitor?.check(), child: Text(s.t('فحص الآن', 'Check now'))))),
        const SizedBox(height: 12),
        Text('${s.t('قائمة الانتظار', 'Queue')} (${q.items.length})', style: Theme.of(context).textTheme.titleMedium),
        if (q.items.isEmpty) EmptyView(text: s.t('لا إجراءات معلّقة', 'Nothing pending'), icon: Icons.done_all),
        for (final a in q.items) Card(margin: const EdgeInsets.only(top: 8), child: ListTile(leading: const Icon(Icons.schedule), title: Text('${a['label']}'), subtitle: Text('${a['clientActionId']} · ${f.dt(a['occurredAt'])}'))),
        const SizedBox(height: 12),
        FilledButton.icon(onPressed: q.items.isEmpty || q.offline || q.syncing ? null : () async { try { await q.sync(st); if (context.mounted) await showSuccess(context, s.t('اكتملت المزامنة', 'Sync complete')); } catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message(st.lang) : '$e'))); } }, icon: const Icon(Icons.sync), label: Text(s.t('مزامنة الآن', 'Sync now'))),
        for (final r in q.lastResults) Card(margin: const EdgeInsets.only(top: 8), child: ListTile(title: Text('${r['label']}'), subtitle: Text('${(r['message'] as Map?)?[st.lang] ?? ''}'), trailing: StatusPill(null, text: '${r['status']}' == 'accepted' ? s.t('مقبول', 'Accepted') : '${r['status']}' == 'duplicate' ? s.t('مكرر', 'Duplicate') : s.t('تعارض', 'Conflict'), tone: '${r['status']}' == 'accepted' ? Tone.good : '${r['status']}' == 'duplicate' ? Tone.mute : Tone.crit))),
        const SizedBox(height: 16),
        AsyncView<dynamic>(reloadKey: st.tick, skeletonLines: 1, load: () => st.api.query('courier.tasks', {}), builder: (ctx, d) {
          final cf = ((d['conflicts'] as List?) ?? []).cast<Map>();
          if (cf.isEmpty) return const SizedBox.shrink();
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(s.t('سجل التعارضات', 'Conflict log'), style: Theme.of(context).textTheme.titleMedium), for (final x in cf) Card(margin: const EdgeInsets.only(top: 8), child: ListTile(title: Text(s.label('${x['action']}')), subtitle: Text('${st.lang == 'en' && x['reasonEn'] != null ? x['reasonEn'] : x['reason']}\n${f.dt(x['occurredAt'])}'), isThreeLine: true, trailing: StatusPill('${x['resolution']}')))]);
        }),
      ]),
    );
  }
}
