// خريطة شاشات لوحة الإدارة A01..A60 — المعرّفات مطابقة لجرد الشاشات في وثيقة التحليل
import type React from 'react';
import { dict } from '@medlog/i18n';
import { withOverrides } from '@/lib/l10n';
import * as Ops from './ops';
import * as Assets from './assets';
import * as Q from './quality';
import * as W from './warehouse';
import * as C from './commercial';
import * as F from './finance';
import * as Cmp from './compliance';
import * as R from './reports';
import * as S from './system';

type L = { ar: string; en: string };
export interface RouteDef { id: string; path: string; screen: React.ComponentType<{ params: Record<string, string> }>; roles?: string[] }
const N = withOverrides(dict.nav, 'nav');
const OPS = ['ops_controller', 'customer_service', 'executive', 'quality'];
const FIN = ['finance', 'finance_approver', 'executive'];
const WH = ['warehouse', 'ops_controller', 'quality'];
const IOT = ['iot_engineer', 'ops_controller', 'warehouse'];
const CMP = ['compliance', 'executive'];
const QUAL = ['quality', 'ops_controller'];

export const ROUTES: RouteDef[] = [
  { id: 'A02', path: '/', screen: Ops.ControlTower, roles: [...OPS, 'iot_engineer', 'warehouse', 'compliance', 'finance', 'finance_approver'] },
  { id: 'A03', path: '/map', screen: Ops.MapScreen, roles: OPS },
  { id: 'A04', path: '/shipments', screen: Ops.ShipmentsList, roles: [...OPS, 'finance', 'warehouse'] },
  { id: 'A05', path: '/shipments/new', screen: Ops.ShipmentCreate, roles: ['ops_controller', 'customer_service'] },
  { id: 'A06', path: '/shipments/:id', screen: Ops.ShipmentDetail, roles: [...OPS, 'finance', 'warehouse', 'iot_engineer', 'finance_approver', 'compliance'] },
  { id: 'A07', path: '/dispatch', screen: Ops.Dispatch, roles: ['ops_controller', 'customer_service', 'executive'] },
  { id: 'A08', path: '/routes', screen: Ops.RoutesScreen, roles: ['ops_controller', 'executive'] },
  { id: 'A09', path: '/legs', screen: Ops.Legs, roles: ['ops_controller', 'executive'] },
  { id: 'A10', path: '/couriers', screen: Ops.Couriers, roles: ['ops_controller', 'executive'] },
  { id: 'A11', path: '/vehicles', screen: Ops.Vehicles, roles: ['ops_controller', 'compliance', 'executive'] },
  { id: 'A12', path: '/partners', screen: Ops.Partners, roles: ['ops_controller', 'compliance', 'finance', 'executive'] },
  { id: 'A13', path: '/boxes', screen: Assets.Boxes, roles: IOT },
  { id: 'A14', path: '/boxes/:id', screen: Assets.BoxDetail, roles: [...IOT, 'quality'] },
  { id: 'A15', path: '/devices', screen: Assets.Devices, roles: ['iot_engineer', 'ops_controller'] },
  { id: 'A16', path: '/devices/:id', screen: Assets.DeviceDetail, roles: ['iot_engineer', 'ops_controller', 'quality'] },
  { id: 'A17', path: '/gateway', screen: Assets.Gateway, roles: ['iot_engineer'] },
  { id: 'A18', path: '/device-commands', screen: Assets.Commands, roles: ['iot_engineer'] },
  { id: 'A19', path: '/excursions', screen: Q.Excursions, roles: QUAL },
  { id: 'A20', path: '/profiles', screen: Q.Profiles, roles: ['quality'] },
  { id: 'A21', path: '/incidents', screen: Q.Incidents, roles: QUAL },
  { id: 'A21', path: '/incidents/:id', screen: Q.IncidentDetail, roles: QUAL },
  { id: 'A22', path: '/capa', screen: Q.Capa, roles: [...QUAL, 'iot_engineer'] },
  { id: 'A23', path: '/claims', screen: Q.Claims, roles: ['quality', 'finance', 'finance_approver', 'customer_service'] },
  { id: 'A24', path: '/lost', screen: Q.Lost, roles: QUAL },
  { id: 'A25', path: '/returns', screen: Q.Returns, roles: ['ops_controller', 'customer_service'] },
  { id: 'A26', path: '/warehouse', screen: W.Inventory, roles: WH },
  { id: 'A27', path: '/warehouse/cleaning', screen: W.Cleaning, roles: WH },
  { id: 'A28', path: '/warehouse/partner-custody', screen: W.PartnerCustody, roles: WH },
  { id: 'A29', path: '/warehouse/consumables', screen: W.Consumables, roles: WH },
  { id: 'A30', path: '/customers', screen: C.Customers, roles: ['ops_controller', 'customer_service', 'finance', 'executive'] },
  { id: 'A31', path: '/customers/:id', screen: C.CustomerDetail, roles: ['ops_controller', 'customer_service', 'finance', 'executive'] },
  { id: 'A32', path: '/contracts', screen: C.Contracts, roles: FIN },
  { id: 'A33', path: '/rate-plans', screen: C.RatePlans, roles: FIN },
  { id: 'A34', path: '/simulations', screen: C.Simulations, roles: FIN },
  { id: 'A35', path: '/quotes', screen: C.Quotes, roles: [...FIN, 'customer_service'] },
  { id: 'A36', path: '/invoices', screen: F.Invoices, roles: FIN },
  { id: 'A36', path: '/invoices/:id', screen: F.InvoiceDetail, roles: FIN },
  { id: 'A37', path: '/credit-notes', screen: F.CreditNotes, roles: FIN },
  { id: 'A38', path: '/payments', screen: F.Payments, roles: FIN },
  { id: 'A39', path: '/accounts', screen: F.Accounts, roles: FIN },
  { id: 'A40', path: '/journals', screen: F.Journals, roles: FIN },
  { id: 'A41', path: '/aging', screen: F.Aging, roles: FIN },
  { id: 'A42', path: '/costs', screen: F.Costs, roles: FIN },
  { id: 'A43', path: '/settlements', screen: F.Settlements, roles: FIN },
  { id: 'A44', path: '/compliance/requirements', screen: Cmp.Requirements, roles: CMP },
  { id: 'A45', path: '/compliance/licenses', screen: Cmp.Licenses, roles: [...CMP, 'ops_controller'] },
  { id: 'A46', path: '/compliance/blocks', screen: Cmp.Blocks, roles: [...CMP, 'ops_controller'] },
  { id: 'A47', path: '/compliance/retention', screen: Cmp.Retention, roles: CMP },
  { id: 'A48', path: '/compliance/legal-holds', screen: Cmp.LegalHolds, roles: CMP },
  { id: 'A49', path: '/reports/operations', screen: R.ReportsOps, roles: ['ops_controller', 'executive', 'quality'] },
  { id: 'A50', path: '/reports/finance', screen: R.ReportsFin, roles: FIN },
  { id: 'A51', path: '/delays', screen: R.Delays, roles: ['ops_controller', 'executive'] },
  { id: 'A52', path: '/system/notifications', screen: S.Notifications, roles: ['super_admin'] },
  { id: 'A53', path: '/system/integrations', screen: S.Integrations, roles: ['super_admin', 'iot_engineer'] },
  { id: 'A54', path: '/system/settings', screen: S.Settings, roles: ['super_admin'] },
  { id: 'A55', path: '/approvals', screen: S.Approvals },
  { id: 'A56', path: '/system/users', screen: S.Users, roles: ['super_admin'] },
  { id: 'A57', path: '/system/audit', screen: S.Audit, roles: ['super_admin', 'compliance', 'executive'] },
  { id: 'A58', path: '/system/security', screen: S.Security },
  { id: 'A59', path: '/system/health', screen: S.Health, roles: ['super_admin', 'iot_engineer', 'executive'] },
  { id: 'A60', path: '/profile', screen: S.Profile },
  { id: 'P01', path: '/partner', screen: S.PartnerPortal, roles: ['partner'] },
];

export const NAV: { id: string; label: L; items: { id: string; path: string; label: L; roles?: string[] }[] }[] = (() => {
  const r = (path: string) => ROUTES.find((x) => x.path === path)!;
  const it = (path: string, label: L) => ({ id: r(path).id, path, label, roles: r(path).roles });
  return [
    { id: 'partner', label: { ar: 'بوابة الشريك', en: 'Partner portal' }, items: [it('/partner', { ar: 'رحلاتي وتسوياتي', en: 'My legs & settlements' }), it('/profile', { ar: 'الملف الشخصي', en: 'Profile' })] },
    { id: 'ops', label: N.groups.ops, items: [it('/', N.controlTower), it('/map', N.map), it('/shipments', N.shipments), it('/shipments/new', N.newShipment), it('/dispatch', N.dispatch), it('/routes', N.routes), it('/legs', N.legs), it('/couriers', N.couriers), it('/vehicles', N.vehicles), it('/partners', N.partners)] },
    { id: 'assets', label: N.groups.assets, items: [it('/boxes', N.boxes), it('/devices', N.devices), it('/gateway', N.gateway), it('/device-commands', N.commands)] },
    { id: 'quality', label: N.groups.quality, items: [it('/excursions', N.excursions), it('/profiles', N.profiles), it('/incidents', N.incidents), it('/capa', N.capa), it('/claims', N.claims), it('/lost', N.lost), it('/returns', N.returns)] },
    { id: 'warehouse', label: N.groups.warehouse, items: [it('/warehouse', N.inventory), it('/warehouse/cleaning', N.cleaning), it('/warehouse/partner-custody', N.partnerCustody), it('/warehouse/consumables', N.consumables)] },
    { id: 'commercial', label: N.groups.commercial, items: [it('/customers', N.customers), it('/contracts', N.contracts), it('/rate-plans', N.ratePlans), it('/simulations', N.simulations), it('/quotes', N.quotes)] },
    { id: 'finance', label: N.groups.finance, items: [it('/invoices', N.invoices), it('/credit-notes', N.creditNotes), it('/payments', N.payments), it('/accounts', N.accounts), it('/journals', N.journals), it('/aging', N.arap), it('/costs', N.costs), it('/settlements', N.settlements)] },
    { id: 'compliance', label: N.groups.compliance, items: [it('/compliance/requirements', N.requirements), it('/compliance/licenses', N.licenses), it('/compliance/blocks', N.blocks), it('/compliance/retention', N.retention), it('/compliance/legal-holds', N.legalHolds)] },
    { id: 'reports', label: N.groups.reports, items: [it('/reports/operations', N.reportsOps), it('/reports/finance', N.reportsFin), it('/delays', N.delays)] },
    { id: 'system', label: N.groups.system, items: [it('/approvals', N.approvals), it('/system/notifications', N.notifications), it('/system/integrations', N.integrations), it('/system/settings', N.settings), it('/system/users', N.users), it('/system/audit', N.audit), it('/system/security', N.security), it('/system/health', N.health)] },
  ];
})();

export function match(path: string) {
  for (const route of ROUTES) {
    const a = route.path.split('/').filter(Boolean), b = path.split('/').filter(Boolean);
    if (a.length !== b.length) continue;
    const params: Record<string, string> = {}; let ok = true;
    a.forEach((seg, i) => { if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(b[i]); else if (seg !== b[i]) ok = false; });
    if (ok) return { route, params };
  }
  return null;
}
