// يولّد مستندات الفاتورة لاختبار Flutter من الاستعلام الحقيقي invoice.document (من جذر المستودع): npx tsx mobile/tool/gen_invoice_fixtures.ts
import { Engine } from '../../packages/core/src/index';
import fs from 'fs';
const e = new Engine(null); const db: any = e.db;
const fin = db.users.find((u: any) => u.email === 'finance@medlog.demo').id;
for (const id of ['inv_0001', 'inv_0022']) fs.writeFileSync(`mobile/customer_app/test/fixtures/${id}.json`, JSON.stringify(e.query('invoice.document', fin, { id }), null, 1));
console.log('ok');
