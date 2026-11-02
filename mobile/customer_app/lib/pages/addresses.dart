import 'package:flutter/material.dart';
import 'package:atlas_shared/atlas_shared.dart';
import 'common.dart';

/// CM11 العناوين المعتمدة + إضافة عنوان (address.create) مع تحقق صيغة الجوال السعودي
class AddressesPage extends StatelessWidget {
  const AddressesPage({super.key});
  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context); final s = st.s;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('العناوين', 'Addresses'))),
      floatingActionButton: canCreate(st.roles) ? FloatingActionButton.extended(onPressed: () => _add(context, st), icon: const Icon(Icons.add_location_alt_outlined), label: Text(s.t('عنوان جديد', 'New address'))) : null,
      body: AsyncView<List<Map<String, dynamic>>>(
        reloadKey: st.tick,
        load: () async => (await st.api.list('addresses', pageSize: 300)).where((a) => a['organizationId'] == orgId(st)).toList(),
        builder: (ctx, rows) => rows.isEmpty ? const EmptyView() : ListView(padding: const EdgeInsets.all(16), children: [
          for (var i = 0; i < rows.length; i++) FadeSlideIn(index: i, child: Card(child: ListTile(leading: const Icon(Icons.place_outlined), title: Text('${(rows[i]['label'] as Map)[st.lang]}'), subtitle: Text('${city(rows[i]['cityCode'], st.lang)} · ${rows[i]['contactName']} · ${Fmt.ltr(rows[i]['contactPhone'])}')))),
        ]),
      ),
    );
  }

  Future<void> _add(BuildContext context, AppState st) async {
    final s = st.s; final label = TextEditingController(), district = TextEditingController(), name = TextEditingController(), phone = TextEditingController(); String cityCode = cities.keys.isNotEmpty ? cities.keys.first : 'RUH'; String? err;
    await showModalBottomSheet(context: context, isScrollControlled: true, showDragHandle: true, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => Padding(padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(ctx).bottom), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(s.t('عنوان جديد', 'New address'), style: Theme.of(ctx).textTheme.titleLarge), const SizedBox(height: 12),
      TextField(controller: label, decoration: InputDecoration(labelText: s.t('الوصف', 'Label'))), const SizedBox(height: 10),
      DropdownButtonFormField<String>(initialValue: cityCode, decoration: InputDecoration(labelText: s.d('common.city')), items: [for (final k in cities.keys) DropdownMenuItem(value: k, child: Text(city(k, st.lang)))], onChanged: (v) => set(() => cityCode = v!)), const SizedBox(height: 10),
      TextField(controller: district, decoration: InputDecoration(labelText: s.t('الحي', 'District'))), const SizedBox(height: 10),
      TextField(controller: name, decoration: InputDecoration(labelText: s.t('جهة الاتصال', 'Contact'))), const SizedBox(height: 10),
      TextField(controller: phone, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: '+9665XXXXXXXX')),
      if (err != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(err!, style: TextStyle(color: AtlasColors.of(ctx).critical))),
      const SizedBox(height: 12),
      FilledButton(onPressed: () async {
        if ([label, district, name].any((c) => c.text.trim().isEmpty)) { set(() => err = s.required); return; }
        if (!RegExp(r'^\+9665\d{8}$').hasMatch(phone.text.trim())) { set(() => err = s.t('رقم الجوال بصيغة ‎+9665XXXXXXXX', 'Mobile must be +9665XXXXXXXX')); return; }
        try { await st.run('address.create', {'organizationId': orgId(st), 'branchId': null, 'labelAr': label.text.trim(), 'cityCode': cityCode, 'districtAr': district.text.trim(), 'contactName': name.text.trim(), 'contactPhone': phone.text.trim()}); if (ctx.mounted) Navigator.pop(ctx); if (context.mounted) await showSuccess(context, s.t('أُضيف العنوان', 'Address added')); } on ApiException catch (e) { set(() => err = e.message(st.lang)); }
      }, child: Text(s.save)),
    ]))));
  }
}
