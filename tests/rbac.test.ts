// مصفوفة الصلاحيات: كل أمر محمي بقائمة أدوار يُرفض (FORBIDDEN) لكل دور خارجها — قبل أي تحقق من المدخلات أو أثر.
// وكل استعلام للموظفين يُرفض للعميل والمندوب والشريك.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, listCommands, listQueries } from '../packages/core/src/index';

const ROLE_USER: Record<string, string> = { super_admin: 'usr_admin', ops_controller: 'usr_ops', warehouse: 'usr_warehouse', quality: 'usr_quality', finance: 'usr_finance', finance_approver: 'usr_approver', compliance: 'usr_compliance', iot_engineer: 'usr_iot', customer_service: 'usr_support', executive: 'usr_exec', partner: 'usr_partner', corp_admin: 'usr_corp_admin', branch_operator: 'usr_branch_op', corp_finance: 'usr_corp_finance', individual: 'usr_individual', receiving_lab: 'usr_lab', courier: 'usr_courier1' };
const STAFF = ['super_admin', 'ops_controller', 'warehouse', 'quality', 'finance', 'finance_approver', 'compliance', 'iot_engineer', 'customer_service', 'executive'];

test('كل أمر محمي يُرفض لكل دور غير مخوّل (مصفوفة كاملة)', () => {
  const e = new Engine(null, { clock: () => Date.parse('2026-11-02T10:00:00Z') });
  const before = JSON.stringify(e.db);
  let checked = 0; const leaks: string[] = [];
  for (const c of listCommands()) {
    if (c.guard === 'any') continue;
    const allowed = c.guard === 'staff' ? STAFF : (c.guard as string[]);
    for (const [role, uid] of Object.entries(ROLE_USER)) {
      if (role === 'super_admin' || allowed.includes(role)) continue;
      try { e.exec(c.name, uid, {}); leaks.push(`${c.name} ← ${role} (نُفّذ)`); }
      catch (x: any) { if (x.code !== 'FORBIDDEN') leaks.push(`${c.name} ← ${role}: ${x.code}`); }
      checked++;
    }
  }
  assert.deepEqual(leaks, []);
  assert.ok(checked > 800, `عدد الحالات المفحوصة ${checked}`);
  assert.equal(JSON.stringify(e.db), before, 'لا أثر لأي محاولة مرفوضة');
});

test('استعلامات الموظفين مرفوضة للعميل والمندوب والشريك', () => {
  const e = new Engine(null);
  const outsiders = ['usr_corp_admin', 'usr_branch_op', 'usr_individual', 'usr_lab', 'usr_courier1', 'usr_partner'];
  const CUSTOMERISH = ['corp_admin', 'branch_operator', 'branch_manager', 'branch_viewer', 'corp_finance', 'individual', 'receiving_lab', 'courier', 'partner'];
  const staffQueries = listQueries().filter((q) => q.guard === 'staff' || (Array.isArray(q.guard) && !q.guard.some((r: string) => CUSTOMERISH.includes(r))));
  assert.ok(staffQueries.length >= 3, `استعلامات الموظفين: ${staffQueries.length}`);
  for (const q of staffQueries) for (const u of outsiders) {
    let codeV = 'OK'; try { e.query(q.name, u, {}); } catch (x: any) { codeV = x.code; }
    assert.equal(codeV, 'FORBIDDEN', `${q.name} ← ${u}`);
  }
});

test('مستخدم معطّل أو جلسة لمستخدم غير موجود: غير مصادق', () => {
  const e = new Engine(null);
  e.db.users.find((u) => u.id === 'usr_support')!.status = 'disabled' as any;
  assert.throws(() => e.query('me', 'usr_support', {}), (x: any) => x.code === 'UNAUTHENTICATED');
  assert.throws(() => e.query('me', 'usr_nobody', {}), (x: any) => x.code === 'UNAUTHENTICATED');
});
