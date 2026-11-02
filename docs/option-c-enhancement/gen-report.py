# يولّد جدول «شاشة بشاشة» من audit-results.json — الاستخدام: python3 gen-report.py > screens-table.md
import json, collections
r = json.load(open('audit-results.json'))
rows = collections.OrderedDict()
for x in r:
    k = (x['app'], x['url'].split('#')[-1] or '/')
    rows.setdefault(k, []).append(x)
names = {'admin': 'لوحة الإدارة', 'portal': 'بوابة العملاء', 'mobile/customer': 'معاينة تطبيق العميل', 'mobile/courier': 'معاينة تطبيق المندوب'}
print('| # | الواجهة | المسار | تحميل | RTL/LTR | مخالفات axe | لوحة المفاتيح (تركيز مرئي) | عناصر قابلة للتركيز |')
print('|---|---|---|---|---|---|---|---|')
for i, ((app, path), xs) in enumerate(rows.items(), 1):
    load = 'ناجح' if all(y['loaded'] for y in xs) else 'فشل'
    dirs = ' / '.join(sorted({f"{y['lang']}:{y['dir']}" for y in xs}))
    v = sum(len(y['violations']) for y in xs)
    kb = 'ناجح' if all(y['keyboard'].get('ok') and y['keyboard'].get('visible') for y in xs) else 'فشل'
    print(f"| {i} | {names[app]} | `{path}` | {load} | {dirs} | {v} | {kb} | {max(y['focusables'] for y in xs)} |")
print(f"\nإجمالي التشغيلات: {len(r)} (تشمل اللغتين وعرض 390px) — شاشات فريدة: {len(rows)}")
