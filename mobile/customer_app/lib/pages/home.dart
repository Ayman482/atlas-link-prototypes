import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'common.dart';
import 'track.dart';
import 'invoices.dart';
import 'claims.dart';
import 'addresses.dart';

/// CM02 الرئيسية: مؤشرات حقيقية من customer.dashboard (لا تظهر أي تكلفة داخلية — BI-003)
class HomePage extends StatelessWidget {
  final VoidCallback onNew;
  const HomePage({super.key, required this.onNew});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s; final name = (((st.me?['user']?['name'] as Map?)?[st.lang] ?? '') as String).replaceAll(RegExp(r'^(د\.|م\.|أ\.|Dr\.|Eng\.)\s*'), '');
    return Scaffold(
      appBar: AppBar(title: Text(s.t('أهلاً ${name.split(' ').first}', 'Hi ${name.split(' ').first}')), actions: [Padding(padding: const EdgeInsetsDirectional.only(end: 12), child: Center(child: SimBadge(text: s.demoBadge)))]),
      body: RefreshIndicator(
        onRefresh: () async => st.refresh(),
        child: AsyncView<dynamic>(
          reloadKey: st.tick,
          load: () => st.api.query('customer.dashboard', {}),
          builder: (ctx, d) {
            final t = d['totals'] as Map; final recent = (d['recent'] as List).cast<Map<String, dynamic>>(); final inv = (d['openInvoices'] as List);
            return ListView(padding: const EdgeInsets.all(16), children: [
              Row(children: [
                Expanded(child: KpiTile(label: s.t('نشطة', 'Active'), value: t['active'] ?? 0, icon: Icons.local_shipping_outlined, highlight: true)),
                const SizedBox(width: 10),
                Expanded(child: KpiTile(label: s.t('مسلّمة', 'Delivered'), value: t['delivered'] ?? 0, icon: Icons.check_circle_outline)),
                const SizedBox(width: 10),
                Expanded(child: KpiTile(label: s.t('انحرافات', 'Excursions'), value: t['excursions'] ?? 0, icon: Icons.thermostat, critical: (t['excursions'] ?? 0) > 0)),
              ]),
              const SizedBox(height: 14),
              if (canCreate(st.roles)) FilledButton.icon(onPressed: onNew, icon: const Icon(Icons.add), label: Text(s.t('طلب استلام جديد', 'Request a pickup'))),
              const SizedBox(height: 18),
              Text(s.t('آخر الشحنات', 'Recent shipments'), style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (recent.isEmpty) const EmptyView(),
              for (var i = 0; i < recent.length && i < 5; i++) ShipmentCard(recent[i], index: i, onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TrackPage(id: recent[i]['id'])))),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                if (canPay(st.roles)) ActionChip(avatar: const Icon(Icons.receipt_long, size: 18), label: Text('${s.t('الفواتير', 'Invoices')}${inv.isNotEmpty ? ' (${inv.length})' : ''}'), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InvoicesPage()))),
                ActionChip(avatar: const Icon(Icons.gavel_outlined, size: 18), label: Text(s.t('المطالبات', 'Claims')), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ClaimsPage()))),
                ActionChip(avatar: const Icon(Icons.place_outlined, size: 18), label: Text(s.t('العناوين', 'Addresses')), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AddressesPage()))),
              ]),
            ]);
          },
        ),
      ),
    );
  }
}
