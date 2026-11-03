import 'package:flutter/material.dart';
import '../mode.dart';
import '../app_state.dart';
import '../api/api_client.dart';
import '../theme/atlas_theme.dart';
import '../motion.dart';
import 'states.dart';
import '../format.dart';

class DemoAccount { final String email, nameAr, nameEn, role; const DemoAccount(this.email, this.nameAr, this.nameEn, this.role); }

/// شاشة الدخول والتحقق بخطوتين (CM01 / K01) مع قائمة حسابات العرض. ترفض الحسابات غير المسموح لها بهذا التطبيق.
class LoginScreen extends StatefulWidget {
  final String title;
  final List<DemoAccount> accounts;
  final bool Function(List<String> roles) allowed;
  const LoginScreen({super.key, required this.title, required this.accounts, required this.allowed});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController(), _pw = TextEditingController(), _code = TextEditingController();
  String? challenge; String? err; bool busy = false;

  Future<void> _finish(AppState st, String token) async {
    await st.signedInWith(token);
    if (!widget.allowed(st.roles)) { await st.signOut(); setState(() { challenge = null; err = st.s.t('هذا الحساب لا يملك صلاحية على هذا التطبيق', 'This account has no access to this app'); }); }
  }

  Future<void> _login(AppState st, [String? e, String? p]) async {
    final email = e ?? _email.text.trim(), pw = p ?? _pw.text;
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(email)) { setState(() => err = st.s.t('أدخل بريداً إلكترونياً صحيحاً', 'Enter a valid email')); return; }
    if (pw.isEmpty) { setState(() => err = st.s.t('كلمة المرور مطلوبة', 'Password is required')); return; }
    setState(() { busy = true; err = null; });
    try { final r = await st.api.login(email, pw); if (r.mfaRequired) { setState(() => challenge = r.challengeId); } else { await _finish(st, r.token!); } }
    on ApiException catch (x) { setState(() => err = x.message(st.lang)); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _verify(AppState st) async {
    if (!RegExp(r'^\d{6}$').hasMatch(_code.text)) { setState(() => err = st.s.t('أدخل 6 أرقام', 'Enter 6 digits')); return; }
    setState(() { busy = true; err = null; });
    try { await _finish(st, await st.api.verifyMfa(challenge!, _code.text)); } on ApiException catch (x) { setState(() => err = x.message(st.lang)); } finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final c = AtlasColors.of(context); final cs = Theme.of(context).colorScheme;
    return Scaffold(body: SafeArea(child: ListView(padding: const EdgeInsets.all(20), children: [
      Row(children: [if (kDemoMode) SimBadge(text: s.demoBadge), const Spacer(), TextButton(onPressed: () => st.setLang(st.lang == 'ar' ? 'en' : 'ar'), child: Text(st.lang == 'ar' ? 'English' : 'العربية'))]),
      const SizedBox(height: 12),
      FadeSlideIn(child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(28), gradient: LinearGradient(colors: [cs.primary, Color.lerp(cs.primary, c.navy, .45)!])),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.favorite_border, color: cs.onPrimary, size: 30), const SizedBox(height: 12),
          Text(widget.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: cs.onPrimary)),
          Text(s.appName, style: TextStyle(color: cs.onPrimary.withValues(alpha: .85))),
        ]),
      )),
      const SizedBox(height: 18),
      if (st.sessionExpired && err == null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Semantics(liveRegion: true, child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: c.warningSoft, borderRadius: BorderRadius.circular(14)), child: Text(s.t('انتهت الجلسة. سجّل الدخول مجدداً — الإجراءات المحفوظة دون اتصال لم تُحذف وستُزامن بعد دخولك.', 'Your session expired. Sign in again — actions saved offline were kept and will sync after you sign in.'))))),
      if (err != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Semantics(liveRegion: true, child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: c.criticalSoft, borderRadius: BorderRadius.circular(14)), child: Text(err!, style: TextStyle(color: c.critical))))),
      if (challenge == null) ...[
        TextField(controller: _email, keyboardType: TextInputType.emailAddress, textDirection: TextDirection.ltr, decoration: InputDecoration(labelText: s.email)),
        const SizedBox(height: 12),
        TextField(controller: _pw, obscureText: true, textDirection: TextDirection.ltr, decoration: InputDecoration(labelText: s.password)),
        const SizedBox(height: 14),
        FilledButton(onPressed: busy ? null : () => _login(st), child: Text(s.signIn)),
        if (kDemoMode) ...[
        const SizedBox(height: 22),
        Text(s.demoAccounts, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        for (var i = 0; i < widget.accounts.length; i++) FadeSlideIn(index: i, child: Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(
          minVerticalPadding: 12,
          leading: CircleAvatar(backgroundColor: cs.primaryContainer, child: Text((st.lang == 'ar' ? widget.accounts[i].nameAr : widget.accounts[i].nameEn).replaceAll(RegExp(r'^(د\.|م\.|أ\.)\s*'), '').substring(0, 1), style: TextStyle(color: cs.onPrimaryContainer))),
          title: Text(st.lang == 'ar' ? widget.accounts[i].nameAr : widget.accounts[i].nameEn),
          subtitle: Text('${s.d('roles.${widget.accounts[i].role}')} · ${Fmt.ltr(widget.accounts[i].email)}'),
          onTap: busy ? null : () { _email.text = widget.accounts[i].email; _pw.text = 'Demo@2026'; _login(st, widget.accounts[i].email, 'Demo@2026'); },
        )))),
        ],
      ] else ...[
        Text(s.mfaTitle, style: Theme.of(context).textTheme.titleLarge),
        Text(kDemoMode ? '${s.mfaHint} — ${s.t('رمز تجريبي للعرض', 'Demo code')} 123456' : s.mfaHint),
        const SizedBox(height: 12),
        TextField(controller: _code, keyboardType: TextInputType.number, maxLength: 6, textAlign: TextAlign.center, textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 24, letterSpacing: 10), autofocus: true, onSubmitted: (_) => _verify(st)),
        FilledButton(onPressed: busy ? null : () => _verify(st), child: Text(s.verify)),
        TextButton(onPressed: () => setState(() { challenge = null; _code.clear(); }), child: Text(s.back)),
      ],
    ])));
  }
}
