// التحكم بالوصول والنطاق — SEC-001, MBR-001..015, BR-003, BI-003, UAT-001/002/014
import type { Db, ID, Membership, RoleCode, Shipment, User } from './types';
import { STAFF_ROLES } from './types';

export interface Actor { user: User; memberships: Membership[]; roles: RoleCode[]; activeBranchId?: ID | null }

export function actorFor(db: Db, userId: ID): Actor | null {
  const user = db.users.find((u) => u.id === userId && u.status === 'active');
  if (!user) return null;
  const memberships = db.memberships.filter((m) => m.userId === userId && m.status === 'active');
  return { user, memberships, roles: [...new Set(memberships.map((m) => m.role))] };
}

export const isStaff = (a: Actor) => a.roles.some((r) => STAFF_ROLES.includes(r));
export const has = (a: Actor, ...roles: RoleCode[]) => a.roles.includes('super_admin') || a.roles.some((r) => roles.includes(r));
export const hasStrict = (a: Actor, ...roles: RoleCode[]) => a.roles.some((r) => roles.includes(r));
export const isCourier = (a: Actor) => a.roles.includes('courier') || !!courierOf(a, null);
export const customerOrgIds = (a: Actor) => [...new Set(a.memberships.filter((m) => m.organizationId).map((m) => m.organizationId!))];

export function courierOf(a: Actor, db: Db | null) {
  return db ? db.couriers.find((c) => c.userId === a.user.id) ?? null : null;
}

/** صلاحيات الفرع لمستخدم العميل: null = كل فروع المؤسسة */
export function branchGrants(a: Actor, orgId: ID): { all: boolean; read: Set<ID>; write: Set<ID> } {
  const ms = a.memberships.filter((m) => m.organizationId === orgId);
  const all = ms.some((m) => ['corp_admin', 'corp_finance', 'individual'].includes(m.role) && !m.branchId);
  const read = new Set<ID>(), write = new Set<ID>();
  for (const m of ms) if (m.branchId) {
    read.add(m.branchId);
    if (['branch_manager', 'branch_operator'].includes(m.role)) write.add(m.branchId);
  }
  return { all, read, write };
}

export function canReadShipment(db: Db, a: Actor, s: Shipment): boolean {
  if (isStaff(a)) return true;
  const cou = courierOf(a, db);
  if (cou) return courierShipmentIds(db, cou.id).has(s.id);
  const partner = a.memberships.find((m) => m.role === 'partner')?.partnerId;
  if (partner) return db.shipmentLegs.some((x) => x.shipmentId === s.id && db.legs.find((l) => l.id === x.legId)?.partnerId === partner);
  // مختبر الاستلام: الشحنات الواردة إليه فقط
  if (a.roles.includes('receiving_lab') && a.memberships.some((m) => m.role === 'receiving_lab' && m.organizationId === s.receiverOrgId)) return true;
  if (!customerOrgIds(a).includes(s.organizationId)) return false;
  const g = branchGrants(a, s.organizationId);
  if (g.all) return true;
  return !!s.branchId && g.read.has(s.branchId);
}

export function canWriteShipmentFor(a: Actor, orgId: ID, branchId: ID | null): boolean {
  if (has(a, 'ops_controller', 'customer_service')) return true;
  const g = branchGrants(a, orgId);
  if (a.memberships.some((m) => m.organizationId === orgId && ['corp_admin', 'individual'].includes(m.role))) return true;
  return !!branchId && g.write.has(branchId);
}

export function courierShipmentIds(db: Db, courierId: ID): Set<ID> {
  const ids = new Set<ID>();
  const legIds = new Set(db.legs.filter((l) => l.courierId === courierId).map((l) => l.id));
  db.shipmentLegs.forEach((x) => legIds.has(x.legId) && ids.add(x.shipmentId));
  const routeIds = new Set(db.routes.filter((r) => r.courierId === courierId).map((r) => r.id));
  db.routeStops.forEach((st) => routeIds.has(st.routeId) && st.shipmentIds.forEach((i) => ids.add(i)));
  return ids;
}

/** عرض الشحنة بحسب الدور — العملاء لا يرون التكاليف الداخلية أو الهوامش (BI-003) */
export function shipmentView(db: Db, a: Actor, s: Shipment) {
  const base: Record<string, unknown> = { ...s };
  if (!isStaff(a)) {
    delete base.qrToken;
    if (a.roles.includes('receiving_lab') && !customerOrgIds(a).includes(s.organizationId)) { delete base.priceTotal; delete base.contractId; delete base.quoteId; }
  } else {
    if (has(a, 'finance', 'finance_approver', 'executive')) {
      base.allocatedCost = db.costAllocations.filter((c) => c.shipmentId === s.id).reduce((x, c) => x + c.amount, 0);
    }
  }
  return base;
}

export const FINANCE_COLLECTIONS = new Set(['journals', 'glAccounts', 'costRecords', 'costAllocations', 'allocationRules', 'settlements', 'simulations', 'ratePlans']);
export const canSeeInternalFinance = (a: Actor) => has(a, 'finance', 'finance_approver', 'executive');
