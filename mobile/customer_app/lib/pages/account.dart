import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';

/// CM12 الحساب: اللغة، السمة، قنوات الإشعار، التحقق بخطوتين، الخروج
class AccountPage extends StatelessWidget {
  const AccountPage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final u = st.me?['user'] as Map? ?? {};
    return Scaffold(
      appBar: AppBar(title: Text(s.t('حسابي', 'Account'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: ListTile(leading: CircleAvatar(child: Text('${(u['name'] as Map?)?[st.lang] ?? '?'}'.replaceAll(RegExp(r'^(د\.|م\.|أ\.)\s*'), '').substring(0, 1))), title: Text('${(u['name'] as Map?)?[st.lang] ?? ''}'), subtitle: Text('${u['email'] ?? ''}\n${st.roles.map((r) => s.d('roles.$r')).join('، ')}'), isThreeLine: true)),
        const SizedBox(height: 12),
        Text(s.language, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 6),
        SegmentedButton<String>(showSelectedIcon: false, segments: const [ButtonSegment(value: 'ar', label: Text('العربية')), ButtonSegment(value: 'en', label: Text('English'))], selected: {st.lang}, onSelectionChanged: (v) => st.setLang(v.first)),
        const SizedBox(height: 14),
        Text(s.t('المظهر', 'Appearance'), style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 6),
        SegmentedButton<ThemeMode>(showSelectedIcon: false, segments: [ButtonSegment(value: ThemeMode.system, label: Text(s.t('تلقائي', 'Auto'))), ButtonSegment(value: ThemeMode.light, label: Text(s.t('فاتح', 'Light'))), ButtonSegment(value: ThemeMode.dark, label: Text(s.t('داكن', 'Dark')))], selected: {st.themeMode}, onSelectionChanged: (v) => st.setTheme(v.first)),
        const SizedBox(height: 14),
        Text(s.notifications, style: Theme.of(context).textTheme.titleMedium),
        AsyncView<List<Map<String, dynamic>>>(reloadKey: st.tick, skeletonLines: 1, load: () => st.api.list('notificationPrefs'), builder: (ctx, prefs) => Column(children: [
          for (final ch in ['push', 'sms', 'email']) SwitchListTile(value: prefs.firstWhere((p) => p['channel'] == ch, orElse: () => {'enabled': true})['enabled'] == true, onChanged: (v) => st.run('notification.setPref', {'channel': ch, 'enabled': v}), title: Text(s.label(ch))),
        ])),
        SwitchListTile(value: u['mfaEnabled'] == true, onChanged: (v) => st.run('me.setMfa', {'enabled': v}).then((_) => st.signedInWith(st.api.token!)), title: Text(s.d('auth.mfaTitle'))),
        const SizedBox(height: 14),
        OutlinedButton.icon(style: OutlinedButton.styleFrom(foregroundColor: AtlasColors.of(context).critical), onPressed: st.signOut, icon: const Icon(Icons.logout), label: Text(s.signOut)),
      ]),
    );
  }
}
