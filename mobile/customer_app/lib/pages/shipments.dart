import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'common.dart';
import 'track.dart';

/// CM03 قائمة الشحنات: تبويبات (نشطة/مكتملة/أخرى) + بحث برقم التتبع
class ShipmentsPage extends StatefulWidget {
  const ShipmentsPage({super.key});
  @override
  State<ShipmentsPage> createState() => _ShipmentsPageState();
}

class _ShipmentsPageState extends State<ShipmentsPage> {
  String g = 'active'; String q = '';
  static const groups = {'active': ['confirmed', 'pickup_scheduled', 'collected', 'in_transit', 'at_handover', 'exception', 'failed', 'return_pending'], 'done': ['delivered', 'returned'], 'other': ['draft', 'cancelled', 'lost']};
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('شحناتي', 'My shipments'))),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 8), child: TextField(textDirection: TextDirection.ltr, decoration: InputDecoration(prefixIcon: const Icon(Icons.search), labelText: s.d('ship.tracking')), onChanged: (v) => setState(() => q = v.trim().toLowerCase()))),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: SegmentedButton<String>(showSelectedIcon: false, segments: [ButtonSegment(value: 'active', label: Text(s.t('نشطة', 'Active'))), ButtonSegment(value: 'done', label: Text(s.t('مكتملة', 'Completed'))), ButtonSegment(value: 'other', label: Text(s.t('أخرى', 'Other')))], selected: {g}, onSelectionChanged: (v) => setState(() => g = v.first))),
        const SizedBox(height: 8),
        Expanded(child: RefreshIndicator(onRefresh: () async => st.refresh(), child: AsyncView<List<Map<String, dynamic>>>(
          reloadKey: st.tick,
          load: () => st.api.list('shipments', sort: 'createdAt'),
          builder: (ctx, all) {
            final rows = all.where((r) => groups[g]!.contains(r['status']) && (q.isEmpty || '${r['trackingNo']}'.toLowerCase().contains(q))).toList();
            if (rows.isEmpty) return ListView(children: const [EmptyView()]);
            return ListView.builder(padding: const EdgeInsets.all(16), itemCount: rows.length, itemBuilder: (_, i) => ShipmentCard(rows[i], index: i, onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TrackPage(id: rows[i]['id'])))));
          },
        ))),
      ]),
    );
  }
}
