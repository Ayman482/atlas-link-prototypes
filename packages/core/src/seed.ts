// بيانات العرض التجريبية — مترابطة، وهمية بالكامل، وحتمية (نفس البذرة = نفس البيانات)
// كل القراءات الحرارية ومواقع GPS هنا بيانات عرض (demo: true) وليست قراءات حية من أجهزة.
import type * as T from './types';
import { DAY, HOUR, MIN, iso, mulberry32, pad, sar, pct, fingerprint, haversineKm } from './util';
import { defaultRules, price, VAT_PCT } from './pricing';

export const DEMO_PASSWORD = 'Demo@2026';
export const DEMO_MFA = '123456';

export function emptyDb(seedNo: number, seededAt: string): T.Db {
  return {
    meta: { schemaVersion: 1, seededAt, seed: seedNo, idempotency: {}, counters: {} },
    cities: [], users: [], memberships: [], sessions: [], organizations: [], branches: [], addresses: [], serviceProfiles: [],
    shipments: [], shipmentItems: [], statusEvents: [], packings: [], recurrings: [], pods: [], deliveryAttempts: [], returns: [],
    partners: [], couriers: [], vehicles: [], routes: [], routeStops: [], legs: [], shipmentLegs: [], custody: [], carrierEvents: [],
    boxes: [], boxQualifications: [], boxMovements: [], devices: [], pairings: [], readings: [], deviceHealth: [], deviceCommands: [], gatewayMessages: [],
    excursions: [], incidents: [], capas: [], approvals: [], claims: [], dispositions: [],
    warehouses: [], consumables: [], consumableMovements: [], partnerCustody: [],
    contracts: [], ratePlans: [], quotes: [], simulations: [], invoices: [], invoiceLines: [], creditNotes: [], payments: [], paymentAllocations: [], glAccounts: [], journals: [], costRecords: [], allocationRules: [], costAllocations: [], settlements: [],
    requirements: [], licenses: [], blocks: [], retentionPolicies: [], legalHolds: [], archiveRuns: [], configVersions: [], approvalRequests: [],
    notifications: [], templates: [], notificationPrefs: [], webhooks: [], apiClients: [], integrations: [], audit: [], outbox: [], delayAlerts: [], scorecards: [], backups: [], offlineConflicts: [],
  };
}

const L = (ar: string, en: string): T.L => ({ ar, en });

export function seed(nowMs = Date.now(), seedNo = 2026): T.Db {
  const now = Math.floor(nowMs / MIN) * MIN;
  const rnd = mulberry32(seedNo);
  const pick = <X>(arr: X[]): X => arr[Math.floor(rnd() * arr.length)];
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const t = (hours: number) => iso(now + hours * HOUR);
  const db = emptyDb(seedNo, iso(now));
  const counters = db.meta.counters;
  const next = (k: string) => (counters[k] = (counters[k] ?? 0) + 1);
  const id = (p: string) => `${p}_${pad(next('id:' + p))}`;

  // ---------------- المدن ----------------
  db.cities.push(
    { code: 'RUH', name: L('الرياض', 'Riyadh'), lat: 24.7136, lng: 46.6753, active: true, hasAirport: true },
    { code: 'JED', name: L('جدة', 'Jeddah'), lat: 21.4858, lng: 39.1925, active: true, hasAirport: true },
    { code: 'DMM', name: L('الدمام', 'Dammam'), lat: 26.4207, lng: 50.0888, active: true, hasAirport: true },
    { code: 'MKK', name: L('مكة المكرمة', 'Makkah'), lat: 21.3891, lng: 39.8579, active: true, hasAirport: false },
    { code: 'MED', name: L('المدينة المنورة', 'Madinah'), lat: 24.5247, lng: 39.5692, active: true, hasAirport: true },
    { code: 'AHB', name: L('أبها', 'Abha'), lat: 18.2465, lng: 42.5117, active: true, hasAirport: true },
    { code: 'TIF', name: L('الطائف', 'Taif'), lat: 21.2703, lng: 40.4158, active: false, hasAirport: true },
  );
  const city = (c: string) => db.cities.find((x) => x.code === c)!;

  // ---------------- ملفات الخدمة الحرارية (TEMP-001) — قيم تجريبية غير معتمدة (OD-011) ----------------
  db.serviceProfiles.push(
    { id: 'svc_chilled_v1', code: 'CHILLED', thermalClass: 'chilled', name: L('مبرّد ‎+2 إلى ‎+8 °م', 'Chilled +2 to +8 °C'), minC: 2, maxC: 8, toleranceSeconds: 900, version: 1, effectiveFrom: t(-24 * 120), effectiveTo: t(-24 * 30), approved: true, status: 'retired' },
    { id: 'svc_chilled_v2', code: 'CHILLED', thermalClass: 'chilled', name: L('مبرّد ‎+4 إلى ‎+8 °م', 'Chilled +4 to +8 °C'), minC: 4, maxC: 8, toleranceSeconds: 600, version: 2, effectiveFrom: t(-24 * 30), effectiveTo: null, approved: true, status: 'active' },
    { id: 'svc_frozen_v1', code: 'FROZEN', thermalClass: 'frozen', name: L('مجمّد ‎−25 إلى ‎−15 °م', 'Frozen −25 to −15 °C'), minC: -25, maxC: -15, toleranceSeconds: 600, version: 1, effectiveFrom: t(-24 * 120), effectiveTo: null, approved: true, status: 'active' },
    { id: 'svc_ambient_v1', code: 'AMBIENT', thermalClass: 'ambient', name: L('محيط ‎+15 إلى ‎+25 °م', 'Ambient +15 to +25 °C'), minC: 15, maxC: 25, toleranceSeconds: 1800, version: 1, effectiveFrom: t(-24 * 120), effectiveTo: null, approved: true, status: 'active' },
  );
  const profileFor = (tc: T.ThermalClass) => db.serviceProfiles.find((p) => p.thermalClass === tc && p.status === 'active')!;

  // ---------------- المؤسسات والفروع والعناوين ----------------
  const orgDefs: Array<{ code: string; name: T.L; type: T.Organization['customerType']; city: string; recv: boolean; branches: Array<[string, T.L, string, number, number]> }> = [
    { code: 'NKH', name: L('مستشفى النخبة التخصصي', 'Al-Nukhba Specialist Hospital'), type: 'hospital', city: 'RUH', recv: false, branches: [
      ['OLY', L('فرع العليا', 'Olaya Branch'), 'RUH', 24.6995, 46.6849], ['MLQ', L('فرع الملقا', 'Al-Malqa Branch'), 'RUH', 24.8132, 46.6187], ['RWD', L('فرع جدة — الروضة', 'Jeddah — Al-Rawdah Branch'), 'JED', 21.5622, 39.1564]] },
    { code: 'DQA', name: L('مختبرات الدقة الطبية', 'Al-Diqqa Medical Laboratories'), type: 'laboratory', city: 'RUH', recv: false, branches: [
      ['CEN', L('المختبر المركزي — الرياض', 'Central Lab — Riyadh'), 'RUH', 24.6748, 46.7238], ['DMM', L('فرع الدمام', 'Dammam Branch'), 'DMM', 26.4344, 50.1033], ['KHB', L('فرع الخبر', 'Al-Khobar Branch'), 'DMM', 26.2794, 50.2083]] },
    { code: 'RAF', name: L('مجموعة عيادات الرعاية الأولى', 'Primary Care Clinics Group'), type: 'clinic_group', city: 'JED', recv: false, branches: [
      ['HMR', L('عيادة الحمراء', 'Al-Hamra Clinic'), 'JED', 21.5137, 39.1637], ['SFA', L('عيادة الصفا', 'Al-Safa Clinic'), 'JED', 21.5862, 39.2186], ['AZZ', L('عيادة العزيزية — مكة', 'Al-Aziziyah Clinic — Makkah'), 'MKK', 21.4005, 39.8732]] },
    { code: 'NRL', name: L('المختبر المرجعي الوطني', 'National Reference Laboratory'), type: 'laboratory', city: 'RUH', recv: true, branches: [
      ['MAIN', L('المختبر الرئيسي — حي الصحافة', 'Main Lab — Al-Sahafa'), 'RUH', 24.8053, 46.6421]] },
    { code: 'SHL', name: L('مستشفى الساحل التخصصي', 'Al-Sahil Specialist Hospital'), type: 'hospital', city: 'DMM', recv: false, branches: [
      ['DMM', L('المستشفى الرئيسي — الدمام', 'Main Hospital — Dammam'), 'DMM', 26.3927, 50.1937], ['JBL', L('فرع الجبيل', 'Jubail Branch'), 'DMM', 27.0046, 49.6460]] },
    { code: 'GNM', name: L('مركز أبحاث الجينوم الطبي', 'Medical Genomics Research Centre'), type: 'laboratory', city: 'JED', recv: true, branches: [
      ['LAB', L('مختبر التسلسل — جدة', 'Sequencing Lab — Jeddah'), 'JED', 21.6066, 39.1059]] },
  ];
  const orgByCode: Record<string, T.Organization> = {};
  const branchesOf: Record<string, T.Branch[]> = {};
  const addrOfBranch: Record<string, T.Address> = {};
  for (const o of orgDefs) {
    const org: T.Organization = { id: `org_${o.code.toLowerCase()}`, code: o.code, legalName: o.name, customerType: o.type, status: 'active', taxId: `3${pad(Math.floor(rnd() * 1e8), 8)}00003`, cityCode: o.city, isReceivingInstitution: o.recv, createdAt: t(-24 * 200) };
    db.organizations.push(org); orgByCode[o.code] = org; branchesOf[org.id] = [];
    for (const [bc, bn, bcity, lat, lng] of o.branches) {
      const br: T.Branch = { id: `br_${o.code.toLowerCase()}_${bc.toLowerCase()}`, organizationId: org.id, code: bc, name: bn, cityCode: bcity, status: 'active', createdAt: t(-24 * 190) };
      db.branches.push(br); branchesOf[org.id].push(br);
      const ad: T.Address = { id: id('adr'), organizationId: org.id, branchId: br.id, label: L(`${bn.ar} — استلام العينات`, `${bn.en} — Sample desk`), cityCode: bcity, district: bn, lat, lng, contactName: pick(['م. سارة العتيبي', 'أ. خالد الحربي', 'د. نورة القحطاني', 'أ. فهد الدوسري', 'أ. ريم الشمري']), contactPhone: `+9665${pad(Math.floor(rnd() * 1e8), 8)}`, authorized: true };
      db.addresses.push(ad); addrOfBranch[br.id] = ad;
    }
  }
  const indivNames: T.L[] = [L('عبدالله المطيري', 'Abdullah Al-Mutairi'), L('هيا السبيعي', 'Haya Al-Subaie'), L('ماجد الغامدي', 'Majed Al-Ghamdi'), L('لمى الزهراني', 'Lama Al-Zahrani'), L('تركي العنزي', 'Turki Al-Anazi'), L('أمل البقمي', 'Amal Al-Buqami'), L('سلطان الشهري', 'Sultan Al-Shehri'), L('جود الحربي', 'Joud Al-Harbi')];
  const indivCities = ['RUH', 'RUH', 'JED', 'DMM', 'RUH', 'JED', 'AHB', 'MED'];
  const individuals: T.Organization[] = indivNames.map((n, i) => {
    const o: T.Organization = { id: `org_ind_${pad(i + 1, 2)}`, code: `IND${pad(i + 1, 2)}`, legalName: n, customerType: 'individual', status: 'active', taxId: null, cityCode: indivCities[i], isReceivingInstitution: false, createdAt: t(-24 * (60 - i * 5)) };
    db.organizations.push(o); branchesOf[o.id] = [];
    const c = city(indivCities[i]);
    db.addresses.push({ id: id('adr'), organizationId: o.id, branchId: null, label: L('المنزل', 'Home'), cityCode: c.code, district: L('حي سكني (تجريبي)', 'Residential district (demo)'), lat: c.lat + between(-0.05, 0.05), lng: c.lng + between(-0.05, 0.05), contactName: n.ar, contactPhone: `+9665${pad(Math.floor(rnd() * 1e8), 8)}`, authorized: true });
    return o;
  });
  const homeAddr = (orgId: string) => db.addresses.find((a) => a.organizationId === orgId)!;
  // مختبرات استقبال مستقلة (عناوين وجهة)
  const nrlAddr = addrOfBranch['br_nrl_main'];
  const gnmAddr = addrOfBranch['br_gnm_lab'];

  // ---------------- المستخدمون والعضويات ----------------
  const mkUser = (key: string, email: string, name: T.L, mfa: boolean) => {
    const u: T.User = { id: `usr_${key}`, email, phone: `+9665${pad(Math.floor(rnd() * 1e8), 8)}`, name, status: 'active', mfaEnabled: mfa, lang: 'ar', createdAt: t(-24 * 180) };
    db.users.push(u); return u;
  };
  const mem = (u: T.User, role: T.RoleCode, organizationId: string | null = null, branchId: string | null = null, partnerId: string | null = null) =>
    db.memberships.push({ id: id('mbr'), userId: u.id, role, organizationId, branchId, partnerId, status: 'active', createdAt: t(-24 * 170) });

  const U = {
    admin: mkUser('admin', 'admin@medlog.demo', L('م. ياسر القرني', 'Eng. Yasser Al-Qarni'), true),
    ops: mkUser('ops', 'ops@medlog.demo', L('أ. منى الرشيد', 'Mona Al-Rashid'), true),
    ops2: mkUser('ops2', 'ops2@medlog.demo', L('أ. بدر الخالدي', 'Badr Al-Khalidi'), true),
    warehouse: mkUser('warehouse', 'warehouse@medlog.demo', L('أ. عمر الجهني', 'Omar Al-Juhani'), false),
    quality: mkUser('quality', 'quality@medlog.demo', L('د. هند الفيصل', 'Dr. Hind Al-Faisal'), true),
    finance: mkUser('finance', 'finance@medlog.demo', L('أ. فيصل البلوي', 'Faisal Al-Balawi'), true),
    approver: mkUser('approver', 'approver@medlog.demo', L('أ. نوف العمري', 'Nouf Al-Omari'), true),
    compliance: mkUser('compliance', 'compliance@medlog.demo', L('أ. رائد السهلي', 'Raed Al-Sahli'), true),
    iot: mkUser('iot', 'iot@medlog.demo', L('م. عبير الحازمي', 'Eng. Abeer Al-Hazmi'), true),
    support: mkUser('support', 'support@medlog.demo', L('أ. شهد المالكي', 'Shahad Al-Malki'), false),
    exec: mkUser('exec', 'exec@medlog.demo', L('أ. سعود الراجحي', 'Saud Al-Rajhi'), true),
    partner: mkUser('partner', 'partner@medlog.demo', L('أ. حمد الصحراء', 'Hamad (Sahra Logistics)'), true),
    corpAdmin: mkUser('corp_admin', 'corp.admin@medlog.demo', L('د. أحمد الزامل', 'Dr. Ahmed Al-Zamil'), true),
    branchOp: mkUser('branch_op', 'branch.op@medlog.demo', L('أ. سارة العتيبي', 'Sara Al-Otaibi'), false),
    corpFinance: mkUser('corp_finance', 'corp.finance@medlog.demo', L('أ. وليد التميمي', 'Waleed Al-Tamimi'), true),
    individual: mkUser('individual', 'individual@medlog.demo', indivNames[0], false),
    lab: mkUser('lab', 'lab@medlog.demo', L('د. ليلى الحمدان', 'Dr. Layla Al-Hamdan'), true),
    courier1: mkUser('courier1', 'courier1@medlog.demo', L('محمد الدوسري', 'Mohammed Al-Dosari'), false),
    courier2: mkUser('courier2', 'courier2@medlog.demo', L('ناصر اليامي', 'Nasser Al-Yami'), false),
  };
  mem(U.admin, 'super_admin'); mem(U.ops, 'ops_controller'); mem(U.ops2, 'ops_controller'); mem(U.warehouse, 'warehouse'); mem(U.quality, 'quality');
  mem(U.finance, 'finance'); mem(U.approver, 'finance_approver'); mem(U.compliance, 'compliance'); mem(U.iot, 'iot_engineer');
  mem(U.support, 'customer_service'); mem(U.exec, 'executive');
  const NKH = orgByCode.NKH;
  mem(U.corpAdmin, 'corp_admin', NKH.id);
  // MBR: مستخدم بأدوار مختلفة في فرعين — مشغّل في العليا ومشاهد فقط في جدة، ولا صلاحية على الملقا
  mem(U.branchOp, 'branch_operator', NKH.id, 'br_nkh_oly');
  mem(U.branchOp, 'branch_viewer', NKH.id, 'br_nkh_rwd');
  mem(U.corpFinance, 'corp_finance', NKH.id);
  mem(U.individual, 'individual', individuals[0].id);
  mem(U.lab, 'receiving_lab', orgByCode.NRL.id, 'br_nrl_main');

  // ---------------- الشركاء والناقلون ----------------
  const P = {
    sahra: { id: 'ptr_sahra', code: 'SAHRA', name: L('الصحراء للخدمات اللوجستية', 'Sahra Logistics Services'), partnerType: 'road', status: 'active', settlementCycle: 'monthly', cities: ['RUH', 'DMM'], score: 91, contact: 'ops@sahra.demo' } as T.Partner,
    ufuq: { id: 'ptr_ufuq', code: 'UFUQ', name: L('الأفق للشحن الجوي', 'Al-Ufuq Air Cargo'), partnerType: 'air', status: 'active', settlementCycle: 'weekly', cities: ['RUH', 'JED', 'DMM', 'MED', 'AHB'], score: 87, contact: 'cargo@ufuq.demo' } as T.Partner,
    sahil: { id: 'ptr_sahil', code: 'SAHIL', name: L('خطوط الساحل البرية', 'Sahil Road Lines'), partnerType: 'road', status: 'blocked', settlementCycle: 'monthly', cities: ['JED', 'MKK', 'MED'], score: 72, contact: 'dispatch@sahil.demo' } as T.Partner,
    hejaz: { id: 'ptr_hejaz', code: 'HEJAZ', name: L('مستودعات الحجاز المؤهلة', 'Hejaz Qualified Warehousing'), partnerType: 'warehouse', status: 'active', settlementCycle: 'monthly', cities: ['JED'], score: 89, contact: 'wh@hejaz.demo' } as T.Partner,
  };
  db.partners.push(P.sahra, P.ufuq, P.sahil, P.hejaz);
  mem(U.partner, 'partner', null, null, P.sahra.id);
  mem(U.courier1, 'courier'); mem(U.courier2, 'courier', null, null, P.sahra.id);

  // ---------------- المستودعات والمركبات والمندوبون ----------------
  db.warehouses.push(
    { id: 'wh_ruh', code: 'WH-RUH-01', name: L('المستودع الرئيسي — الرياض (السلي)', 'Main Warehouse — Riyadh (Al-Sulay)'), cityCode: 'RUH', kind: 'company', partnerId: null, status: 'active' },
    { id: 'wh_jed', code: 'WH-JED-P1', name: L('حيازة مؤقتة — مستودعات الحجاز، جدة', 'Temporary custody — Hejaz, Jeddah'), cityCode: 'JED', kind: 'partner', partnerId: P.hejaz.id, status: 'active' },
    { id: 'wh_dmm', code: 'WH-DMM-P1', name: L('نقطة تسليم — الصحراء، الدمام', 'Handover point — Sahra, Dammam'), cityCode: 'DMM', kind: 'partner', partnerId: P.sahra.id, status: 'active' },
  );
  const vehDefs: Array<[string, string, string | null, boolean, number]> = [
    ['أ ب ج 1234', 'RUH', null, true, 200], ['د هـ و 2345', 'RUH', null, true, 150], ['ر س ص 3456', 'RUH', null, false, 90], ['ط ع ق 4567', 'JED', null, true, 120],
    ['ك ل م 5678', 'JED', P.sahil.id, true, -10], ['ن هـ و 6789', 'DMM', P.sahra.id, true, 60], ['ي ب ح 7890', 'DMM', null, true, 25], ['س ع د 8901', 'MED', null, false, 300]];
  vehDefs.forEach(([reg, c, pid, refr, days], i) => db.vehicles.push({ id: `veh_${pad(i + 1, 2)}`, partnerId: pid, registration: reg, type: refr ? L('فان مبرّد', 'Refrigerated van') : L('سيارة توصيل', 'Delivery car'), refrigerated: refr, qualificationStatus: days < 0 ? 'expired' : 'qualified', qualificationExpiry: t(24 * days), cityCode: c }));
  const courierDefs: Array<[string | null, T.L, string, string | null, string | null]> = [
    [U.courier1.id, U.courier1.name, 'RUH', null, 'veh_01'],
    [null, L('فهد العسيري', 'Fahad Al-Asiri'), 'RUH', null, 'veh_02'],
    [null, L('ياسر المحمادي', 'Yasser Al-Mohammadi'), 'RUH', null, 'veh_03'],
    [null, L('إبراهيم الثبيتي', 'Ibrahim Al-Thubaiti'), 'JED', null, 'veh_04'],
    [null, L('عادل الصاعدي', 'Adel Al-Saedi'), 'JED', null, null],
    [null, L('خالد البارقي', 'Khalid Al-Bariqi'), 'DMM', null, 'veh_07'],
    [null, L('مشعل الرويلي', 'Mishal Al-Ruwaili'), 'MED', null, 'veh_08'],
    [U.courier2.id, U.courier2.name, 'DMM', P.sahra.id, 'veh_06'],
    [null, L('سامي الحارثي', 'Sami Al-Harthi'), 'JED', P.sahil.id, 'veh_05'],
    [null, L('حسن القحطاني', 'Hassan Al-Qahtani'), 'AHB', null, null],
  ];
  courierDefs.forEach(([uid, name, c, pid, veh], i) => {
    const cc = city(c);
    db.couriers.push({ id: `cou_${pad(i + 1, 2)}`, userId: uid, partnerId: pid, name, employmentType: pid ? 'partner' : 'employee', status: i === 4 ? 'off_shift' : 'available', cityCode: c, qualified: pid !== P.sahil.id, qualificationExpiry: t(24 * (pid === P.sahil.id ? -10 : 120 + i * 7)), vehicleId: veh, phone: `+9665${pad(Math.floor(rnd() * 1e8), 8)}`, lastPosition: { lat: cc.lat + between(-0.04, 0.04), lng: cc.lng + between(-0.04, 0.04), at: t(-between(0.05, 0.4)) } });
  });
  const COURIER_CITY: Record<string, string> = { MKK: 'JED', TIF: 'JED' };
  const courierIn = (c0: string, employeeFirst = true) => { const c = COURIER_CITY[c0] ?? c0; return db.couriers.filter((x) => x.cityCode === c && x.qualified && x.status !== 'off_shift' && (!employeeFirst || x.employmentType === 'employee'))[0] ?? db.couriers.find((x) => x.cityCode === c && x.qualified)!; };

  // ---------------- الصناديق والأجهزة (BOX/DHC/BR-002) ----------------
  const boxPlan: Array<[T.ThermalClass, T.BoxSize]> = [];
  for (let i = 0; i < 16; i++) boxPlan.push(['chilled', (['S', 'M', 'L'] as T.BoxSize[])[i % 3]]);
  for (let i = 0; i < 8; i++) boxPlan.push(['frozen', (['M', 'L', 'S'] as T.BoxSize[])[i % 3]]);
  for (let i = 0; i < 6; i++) boxPlan.push(['ambient', (['S', 'M'] as T.BoxSize[])[i % 2]]);
  const capOf: Record<T.BoxSize, number> = { S: 2, M: 4, L: 8 };
  boxPlan.forEach(([tc, size], i) => {
    const n = i + 1;
    const box: T.Box = { id: `box_${pad(n, 3)}`, code: `BX-${tc === 'chilled' ? 'C' : tc === 'frozen' ? 'F' : 'A'}${size}-${pad(n, 3)}`, size, thermalClass: tc, capacity: capOf[size], qualificationStatus: 'qualified', qualificationExpiry: t(24 * (40 + ((n * 37) % 160))), condition: n % 9 === 0 ? 'worn' : 'good', status: 'available', custodianType: 'warehouse', custodianId: 'wh_ruh', locationCity: 'RUH', createdAt: t(-24 * 300) };
    db.boxes.push(box);
    db.boxQualifications.push({ id: id('bq'), boxId: box.id, qualificationType: 'thermal_mapping', result: 'pass', effectiveAt: t(-24 * 140), expiresAt: box.qualificationExpiry, by: U.quality.id });
    db.boxQualifications.push({ id: id('bq'), boxId: box.id, qualificationType: 'cleaning', result: 'pass', effectiveAt: t(-24 * (2 + (n % 6))), expiresAt: null, by: U.warehouse.id });
    const dev: T.Device = { id: `dev_${pad(n, 3)}`, imei: `86${pad(Math.floor(rnd() * 1e9), 9)}${pad(n, 4)}`, model: 'GPT45-M', firmware: n % 4 === 0 ? 'GPT45M_V2.1.6 (تجريبي)' : 'GPT45M_V2.1.8 (تجريبي)', simIccidMasked: `8996601••••••${pad(n, 4)}`, state: 'ready', lastSeenAt: t(-between(0.02, 0.2)), batteryPct: Math.round(between(55, 98)), lastTempC: null, lastFix: { lat: 24.5714 + between(-0.01, 0.01), lng: 46.8325 + between(-0.01, 0.01), at: t(-0.2) }, createdAt: t(-24 * 300) };
    db.devices.push(dev);
    // سجل اقتران: اقتران سابق منتهي لبعض الصناديق لإظهار التاريخ غير القابل للتعديل
    if (n === 3) {
      db.pairings.push({ id: id('pair'), boxId: box.id, deviceId: 'dev_031', pairedAt: t(-24 * 280), unpairedAt: t(-24 * 45), approvedBy: U.iot.id, reason: 'استبدال جهاز بعد عطل في المستشعر' });
    }
    db.pairings.push({ id: id('pair'), boxId: box.id, deviceId: dev.id, pairedAt: n === 3 ? t(-24 * 45) : t(-24 * 280), unpairedAt: null, approvedBy: U.iot.id, reason: n === 3 ? 'جهاز بديل' : 'اقتران أولي' });
  });
  // أجهزة احتياطية غير مقترنة + جهاز متقاعد
  db.devices.push(
    { id: 'dev_031', imei: '861234567890031', model: 'GPT45-M', firmware: 'GPT45M_V2.1.2 (تجريبي)', simIccidMasked: '8996601••••••0031', state: 'retired', lastSeenAt: t(-24 * 45), batteryPct: null, lastTempC: null, lastFix: null, createdAt: t(-24 * 300) },
    { id: 'dev_032', imei: '861234567890032', model: 'GPT45-M', firmware: 'GPT45M_V2.1.8 (تجريبي)', simIccidMasked: '8996601••••••0032', state: 'ready', lastSeenAt: t(-0.1), batteryPct: 100, lastTempC: 22.1, lastFix: null, createdAt: t(-24 * 20) },
    { id: 'dev_033', imei: '861234567890033', model: 'GPT45-M', firmware: 'GPT45M_V2.1.8 (تجريبي)', simIccidMasked: '8996601••••••0033', state: 'ready', lastSeenAt: t(-0.1), batteryPct: 97, lastTempC: 21.8, lastFix: null, createdAt: t(-24 * 20) },
  );
  const devOfBox = (boxId: string) => db.devices.find((d) => d.id === db.pairings.find((p) => p.boxId === boxId && !p.unpairedAt)!.deviceId)!;
  const boxById = (bid: string) => db.boxes.find((b) => b.id === bid)!;

  // ---------------- خطة الأسعار والعقود ----------------
  const plan3: T.RatePlan = { id: 'rp_std_v3', code: 'STD-2026', name: L('التعرفة القياسية 2026', 'Standard Tariff 2026'), version: 3, status: 'published', effectiveFrom: t(-24 * 60), rules: defaultRules(), approvedBy: U.approver.id, createdAt: t(-24 * 70) };
  const plan2: T.RatePlan = { ...plan3, id: 'rp_std_v2', version: 2, status: 'superseded', effectiveFrom: t(-24 * 200), rules: defaultRules().map((r) => ({ ...r, sameCity: pct(r.sameCity, 92), intercityRoad: pct(r.intercityRoad, 92), air: pct(r.air, 92) })), createdAt: t(-24 * 210) };
  const plan4: T.RatePlan = { ...plan3, id: 'rp_std_v4', version: 4, status: 'pending_approval', effectiveFrom: t(24 * 29), rules: defaultRules().map((r) => ({ ...r, air: pct(r.air, 106) })), approvedBy: null, createdAt: t(-24 * 3) };
  db.ratePlans.push(plan2, plan3, plan4);
  const contractOrgs = ['NKH', 'DQA', 'RAF', 'NRL', 'SHL', 'GNM'];
  contractOrgs.forEach((code, i) => {
    const org = orgByCode[code];
    db.contracts.push({ id: `con_${code.toLowerCase()}_old`, contractNo: `CT-2025-${pad(i + 1, 3)}`, organizationId: org.id, billingCycle: 'annual', validFrom: t(-24 * 400), validTo: t(-24 * 35), status: 'expired', ratePlanId: plan2.id, includedShipments: 0, usedShipments: 0, monthlyFee: 0 });
    db.contracts.push({ id: `con_${code.toLowerCase()}`, contractNo: `CT-2026-${pad(i + 1, 3)}`, organizationId: org.id, billingCycle: i % 3 === 0 ? 'monthly' : i % 3 === 1 ? 'annual' : 'weekly', validFrom: t(-24 * 34), validTo: t(24 * (i === 2 ? 20 : 330)), status: code === 'GNM' ? 'draft' : 'active', ratePlanId: plan3.id, includedShipments: [120, 80, 60, 40, 50, 30][i], usedShipments: 0, monthlyFee: sar([18000, 12000, 8500, 6000, 7500, 4500][i]) });
  });
  const activeContract = (orgId: string) => db.contracts.find((c) => c.organizationId === orgId && c.status === 'active') ?? null;

  // ---------------- مولّد الشحنات ----------------
  const ORDER: T.ShipmentStatus[] = ['draft', 'confirmed', 'pickup_scheduled', 'collected', 'in_transit', 'at_handover', 'delivered'];
  // إشغال الصناديق بفترات زمنية حتى لا يُحمَّل صندوق واحد بشحنتين متداخلتين إلا عند التعبئة المشتركة المقصودة
  const RESERVED = new Set(['box_002', 'box_004', 'box_007', 'box_010', 'box_011', 'box_012', 'box_013', 'box_014', 'box_018', 'box_020', 'box_021', 'box_026', 'box_030']);
  const busy = new Map<string, Array<[number, number]>>();
  const markBusy = (bid: string, a: number, b: number) => { const arr = busy.get(bid) ?? []; arr.push([a, b]); busy.set(bid, arr); };
  const isFree = (bid: string, a: number, b: number) => !(busy.get(bid) ?? []).some(([x, y]) => a < y && b > x);
  const freeBox = (tc: T.ThermalClass, a: number, b: number) => db.boxes.find((x) => x.thermalClass === tc && !RESERVED.has(x.id) && isFree(x.id, a, b)) ?? null;
  const airport: Record<string, { lat: number; lng: number }> = { RUH: { lat: 24.9576, lng: 46.6988 }, JED: { lat: 21.6796, lng: 39.1565 }, DMM: { lat: 26.4712, lng: 49.7979 }, MED: { lat: 24.5534, lng: 39.7051 }, AHB: { lat: 18.2404, lng: 42.6566 } };

  interface Spec { org: T.Organization; branch: T.Branch | null; from: T.Address; to: T.Address; receiverOrg: T.Organization | null; tc: T.ThermalClass; level: T.ServiceLevel; status: T.ShipmentStatus; pickupAt: number; mode?: 'road' | 'road_air'; dedicated?: boolean; boxId?: string; sub?: string; createdBy?: string; requestType?: T.RequestType; weight?: number; tag?: string }
  const tagged: Record<string, T.Shipment> = {};

  const makeShipment = (s: Spec): T.Shipment => {
    const n = next('trk');
    const sameCity = s.from.cityCode === s.to.cityCode;
    const mode = s.mode ?? (sameCity ? 'road' : (haversineKm(city(s.from.cityCode), city(s.to.cityCode)) > 600 && city(s.to.cityCode).hasAirport && city(s.from.cityCode).hasAirport ? 'road_air' : 'road'));
    const contract = activeContract(s.org.id);
    const covered = !!contract && contract.usedShipments < contract.includedShipments && s.status !== 'draft' && s.status !== 'cancelled';
    if (covered && contract) contract.usedShipments++;
    const weight = s.weight ?? Math.round(between(0.5, 4.5) * 10) / 10;
    const pb = price(plan3, { thermalClass: s.tc, serviceLevel: s.level, originCity: s.from.cityCode, destCity: s.to.cityCode, mode, weightKg: weight, dedicatedBox: !!s.dedicated }, { coveredByContract: covered });
    const dist = haversineKm(s.from, s.to);
    const transitH = mode === 'road_air' ? 7 : sameCity ? 1.5 : dist / 75 + 1;
    const created = s.pickupAt - between(2, 30) * HOUR;
    const sh: T.Shipment = {
      id: `shp_${pad(n)}`, trackingNo: `ML-2026-${pad(n, 6)}`, qrToken: `qr_${fingerprint([n, seedNo]).slice(0, 12)}`, organizationId: s.org.id, branchId: s.branch?.id ?? null,
      serviceProfileId: profileFor(s.tc).id, thermalClass: s.tc, serviceLevel: s.level, requestType: s.requestType ?? (rnd() < 0.7 ? 'scheduled' : 'on_demand'), recurringId: null,
      senderAddressId: s.from.id, receiverAddressId: s.to.id, receiverOrgId: s.receiverOrg?.id ?? null, originCity: s.from.cityCode, destCity: s.to.cityCode,
      pickupWindowStart: iso(s.pickupAt), pickupWindowEnd: iso(s.pickupAt + 2 * HOUR), deliverBy: iso(s.pickupAt + (transitH + (s.level === 'stat' ? 0.5 : 3)) * HOUR),
      status: s.status, subStatus: s.sub ?? null, dedicatedBox: !!s.dedicated, mode, quoteId: null, contractId: covered ? contract!.id : null,
      priceTotal: pb.total, createdBy: s.createdBy ?? (s.org.customerType === 'individual' ? U.individual.id : U.corpAdmin.id), createdOnBehalf: false,
      createdAt: iso(created), updatedAt: iso(created), version: 1, lastPosition: null, eta: null, lostState: 'none',
    };
    db.shipments.push(sh);
    db.shipmentItems.push({ id: id('itm'), shipmentId: sh.id, descriptionCode: pick(['BLOOD_TUBES', 'TISSUE_BIOPSY', 'SWAB_PCR', 'URINE_CULTURE', 'CSF_SAMPLE', 'SERUM_ALIQUOT']), quantity: 1 + Math.floor(rnd() * 6), weightKg: weight, handlingClass: rnd() < 0.8 ? 'biohazard_cat_b' : 'exempt' });
    const q: T.Quote = { id: id('quo'), quoteNo: `QT-${pad(n, 6)}`, organizationId: sh.organizationId, shipmentId: sh.id, snapshot: pb, total: pb.total, expiresAt: iso(created + DAY), status: s.status === 'draft' ? 'open' : 'converted', createdAt: iso(created - 5 * MIN) };
    db.quotes.push(q); sh.quoteId = q.id;
    if (s.tag) tagged[s.tag] = sh;
    buildJourney(sh, s, transitH);
    return sh;
  };

  const statusEvt = (sh: T.Shipment, from: T.ShipmentStatus | null, to: T.ShipmentStatus, at: number, actor: string | null, reason = '', source = 'system') =>
    db.statusEvents.push({ id: id('sev'), shipmentId: sh.id, fromStatus: from, toStatus: to, reason, occurredAt: iso(at), actorId: actor, source });

  function buildJourney(sh: T.Shipment, s: Spec, transitH: number) {
    const created = Date.parse(sh.createdAt);
    const pick0 = Date.parse(sh.pickupWindowStart);
    const tCollect = pick0 + between(10, 50) * MIN;
    const tDepart = tCollect + between(15, 35) * MIN;
    const tArrive = tDepart + transitH * HOUR;
    const tDeliver = tArrive + between(10, 40) * MIN;
    const target = s.status;
    const reach = (st: T.ShipmentStatus) => {
      const idx = ORDER.indexOf(st);
      if (['failed', 'return_pending', 'returned', 'exception'].includes(target)) return idx <= ORDER.indexOf('in_transit');
      if (target === 'cancelled') return idx <= 1;
      return idx >= 0 && idx <= ORDER.indexOf(target);
    };
    const times: Record<string, number> = { draft: created, confirmed: created + 3 * MIN, pickup_scheduled: created + between(10, 60) * MIN, collected: tCollect, in_transit: tDepart, at_handover: tArrive, delivered: tDeliver };
    let prev: T.ShipmentStatus | null = null;
    for (const st of ORDER) {
      if (!reach(st)) break;
      if (times[st] > now) break;
      statusEvt(sh, prev, st, times[st], st === 'draft' || st === 'confirmed' ? sh.createdBy : st === 'pickup_scheduled' ? U.ops.id : null, st === 'pickup_scheduled' ? 'إسناد مندوب وصندوق' : '', st === 'collected' || st === 'delivered' ? 'courier_app' : 'system');
      prev = st;
    }
    sh.status = prev ?? 'draft';
    const courier = courierIn(sh.originCity);
    const destCourier = courierIn(sh.destCity);
    const reached = (st: T.ShipmentStatus) => db.statusEvents.some((e) => e.shipmentId === sh.id && e.toStatus === st);

    // المسار والأرجل (RTE/MMT)
    if (reached('pickup_scheduled')) {
      const rDate = new Date(pick0); const rc = `RT-${sh.originCity}-${pad(rDate.getUTCMonth() + 1, 2)}${pad(rDate.getUTCDate(), 2)}-${courier.id.slice(-2)}`;
      let route = db.routes.find((r) => r.code === rc);
      if (!route) {
        route = { id: id('rte'), code: rc, serviceDate: iso(Date.UTC(rDate.getUTCFullYear(), rDate.getUTCMonth(), rDate.getUTCDate())), originCity: sh.originCity, destCity: sh.originCity, status: 'planned', courierId: courier.id, vehicleId: courier.vehicleId, plannedDistanceKm: 0, createdAt: iso(created + 30 * MIN) };
        db.routes.push(route);
      }
      const from = db.addresses.find((a) => a.id === sh.senderAddressId)!;
      const to = db.addresses.find((a) => a.id === sh.receiverAddressId)!;
      const seq = db.routeStops.filter((x) => x.routeId === route!.id).length;
      db.routeStops.push({ id: id('stp'), routeId: route.id, seq: seq + 1, addressId: from.id, stopType: 'pickup', shipmentIds: [sh.id], plannedAt: sh.pickupWindowStart, actualAt: reached('collected') ? iso(tCollect) : null, status: reached('collected') ? 'done' : 'pending' });
      route.plannedDistanceKm = Math.round(route.plannedDistanceKm + (sh.originCity === sh.destCity ? haversineKm(from, to) : 25));
      if (sh.originCity === sh.destCity) db.routeStops.push({ id: id('stp'), routeId: route.id, seq: seq + 2, addressId: to.id, stopType: 'delivery', shipmentIds: [sh.id], plannedAt: sh.deliverBy, actualAt: reached('delivered') ? iso(tDeliver) : null, status: reached('delivered') ? 'done' : 'pending' });
      if (reached('collected')) route.status = reached('delivered') && Date.parse(route.serviceDate) < now - DAY ? 'completed' : 'in_progress';
      else if (route.status === 'planned') route.status = 'dispatched';

      const legs: T.TransportLeg[] = [];
      const mkLeg = (l: Omit<T.TransportLeg, 'id'>) => { const x = { id: id('leg'), ...l }; db.legs.push(x); legs.push(x); return x; };
      if (sh.mode === 'road_air') {
        const flight = `${pick(['XY', 'SV', 'F3'])}${100 + Math.floor(rnd() * 800)} (تجريبي)`;
        mkLeg({ routeId: route.id, mode: 'road', partnerId: null, courierId: courier.id, vehicleId: courier.vehicleId, originCity: sh.originCity, destCity: sh.originCity, flightNo: null, scheduledDeparture: iso(tCollect), scheduledArrival: iso(tDepart), actualDeparture: reached('collected') ? iso(tCollect) : null, actualArrival: reached('in_transit') ? iso(tDepart + 40 * MIN) : null, status: reached('in_transit') ? 'arrived' : reached('collected') ? 'departed' : 'planned' });
        const airDep = tDepart + 100 * MIN, airArr = airDep + 110 * MIN;
        mkLeg({ routeId: null, mode: 'air', partnerId: P.ufuq.id, courierId: null, vehicleId: null, originCity: sh.originCity, destCity: sh.destCity, flightNo: flight, scheduledDeparture: iso(airDep), scheduledArrival: iso(airArr), actualDeparture: airDep < now && reached('in_transit') ? iso(airDep + 8 * MIN) : null, actualArrival: airArr < now && reached('in_transit') ? iso(airArr + 5 * MIN) : null, status: airArr < now && reached('in_transit') ? 'arrived' : airDep < now && reached('in_transit') ? 'departed' : 'planned' });
        mkLeg({ routeId: null, mode: 'road', partnerId: null, courierId: destCourier.id, vehicleId: destCourier.vehicleId, originCity: sh.destCity, destCity: sh.destCity, flightNo: null, scheduledDeparture: iso(airArr + 30 * MIN), scheduledArrival: iso(tDeliver), actualDeparture: reached('at_handover') ? iso(airArr + 35 * MIN) : null, actualArrival: reached('delivered') ? iso(tDeliver) : null, status: reached('delivered') ? 'arrived' : reached('at_handover') ? 'departed' : 'planned' });
      } else if (sh.originCity !== sh.destCity) {
        mkLeg({ routeId: route.id, mode: 'road', partnerId: P.sahra.id, courierId: courier.id, vehicleId: courier.vehicleId, originCity: sh.originCity, destCity: sh.destCity, flightNo: null, scheduledDeparture: iso(tDepart), scheduledArrival: iso(tArrive), actualDeparture: reached('in_transit') ? iso(tDepart) : null, actualArrival: reached('at_handover') ? iso(tArrive) : null, status: reached('at_handover') ? 'arrived' : reached('in_transit') ? 'departed' : 'planned' });
      } else {
        mkLeg({ routeId: route.id, mode: 'road', partnerId: null, courierId: courier.id, vehicleId: courier.vehicleId, originCity: sh.originCity, destCity: sh.destCity, flightNo: null, scheduledDeparture: iso(tDepart), scheduledArrival: iso(tArrive), actualDeparture: reached('in_transit') ? iso(tDepart) : null, actualArrival: reached('at_handover') || reached('delivered') ? iso(tArrive) : null, status: reached('delivered') ? 'arrived' : reached('in_transit') ? 'departed' : 'planned' });
      }
      legs.forEach((l, i) => db.shipmentLegs.push({ id: id('shl'), shipmentId: sh.id, legId: l.id, seq: i + 1, loadedAt: l.actualDeparture, unloadedAt: l.actualArrival }));
      // أحداث الناقل الجوي (محاكاة) — RTE-004
      const air = legs.find((l) => l.mode === 'air');
      if (air) {
        const ev = (type: T.CarrierEvent['eventType'], at: number) => { if (at < now) db.carrierEvents.push({ id: id('cev'), partnerId: P.ufuq.id, legId: air.id, externalEventId: `UFQ-${fingerprint([air.id, type]).slice(0, 8)}`, eventType: type, occurredAt: iso(at), receivedAt: iso(at + between(1, 6) * MIN), simulated: true }); };
        if (reached('in_transit')) { ev('accepted', tDepart + 45 * MIN); ev('loaded', Date.parse(air.scheduledDeparture) - 20 * MIN); if (air.actualDeparture) ev('departed', Date.parse(air.actualDeparture)); if (air.actualArrival) { ev('arrived', Date.parse(air.actualArrival)); ev('unloaded', Date.parse(air.actualArrival) + 15 * MIN); ev('released', Date.parse(air.actualArrival) + 25 * MIN); } }
      }

      // الصندوق والتعبئة (SHP-003, BOX-004)
      if (reached('collected')) {
        const done = reached('delivered') || target === 'returned';
        const occA = tCollect - HOUR, occB = done ? tDeliver + 2 * HOUR : now + DAY;
        const box = s.boxId ? boxById(s.boxId) : freeBox(sh.thermalClass, occA, occB);
        if (box) {
          markBusy(box.id, occA, occB);
          db.packings.push({ id: id('pck'), shipmentId: sh.id, boxId: box.id, packedAt: iso(tCollect - 5 * MIN), unpackedAt: done ? iso(tDeliver) : null, packedBy: courier.userId ?? U.warehouse.id, dedicated: sh.dedicatedBox });
          if (!done) { box.status = 'in_use'; box.custodianType = 'courier'; box.custodianId = courier.id; box.locationCity = sh.originCity; }
          db.boxMovements.push({ id: id('bmv'), boxId: box.id, fromLocation: 'WH-RUH-01', toLocation: sh.originCity, custodian: courier.name.ar, eventAt: iso(tCollect - 60 * MIN), kind: 'issue' });
          // سلسلة الحيازة (BR-005)
          db.custody.push({ id: id('cus'), shipmentId: sh.id, boxId: box.id, fromType: 'customer', fromId: sh.organizationId, toType: 'courier', toId: courier.id, eventType: 'pickup', occurredAt: iso(tCollect), receivedAt: iso(tCollect + 20_000), evidence: { signedBy: from.contactName, method: 'signature' }, source: 'courier_app', actorId: courier.userId ?? U.ops.id, lat: from.lat, lng: from.lng });
          if (air && reached('in_transit') && Date.parse(air.scheduledDeparture) - 60 * MIN < now) db.custody.push({ id: id('cus'), shipmentId: sh.id, boxId: box.id, fromType: 'courier', fromId: courier.id, toType: 'air_carrier', toId: P.ufuq.id, eventType: 'handover', occurredAt: iso(tDepart + 45 * MIN), receivedAt: iso(tDepart + 46 * MIN), evidence: { signedBy: 'مكتب الشحن — الأفق', method: 'qr' }, source: 'courier_app', actorId: courier.userId ?? U.ops.id, lat: airport[sh.originCity]?.lat ?? null, lng: airport[sh.originCity]?.lng ?? null });
          if (air && reached('at_handover')) db.custody.push({ id: id('cus'), shipmentId: sh.id, boxId: box.id, fromType: 'air_carrier', fromId: P.ufuq.id, toType: 'courier', toId: destCourier.id, eventType: 'handover', occurredAt: iso(Date.parse(air.scheduledArrival) + 30 * MIN), receivedAt: iso(Date.parse(air.scheduledArrival) + 31 * MIN), evidence: { signedBy: destCourier.name.ar, method: 'qr' }, source: 'courier_app', actorId: destCourier.userId ?? U.ops.id, lat: airport[sh.destCity]?.lat ?? null, lng: airport[sh.destCity]?.lng ?? null });
          if (reached('delivered')) {
            const lastC = air ? destCourier : courier;
            db.custody.push({ id: id('cus'), shipmentId: sh.id, boxId: box.id, fromType: 'courier', fromId: lastC.id, toType: 'recipient', toId: sh.receiverOrgId ?? sh.receiverAddressId, eventType: 'delivery', occurredAt: iso(tDeliver), receivedAt: iso(tDeliver + 30_000), evidence: { signedBy: to.contactName, method: 'signature' }, source: 'courier_app', actorId: lastC.userId ?? U.ops.id, lat: to.lat, lng: to.lng });
            db.pods.push({ id: id('pod'), shipmentId: sh.id, recipientName: to.contactName, signature: `sig:${fingerprint([sh.id, 'sig']).slice(0, 10)}`, photoRef: rnd() < 0.6 ? `demo-photo-${sh.trackingNo}.jpg` : null, deliveredAt: iso(tDeliver), verifiedBy: lastC.userId ?? U.ops.id, notes: '' });
          }
          // القراءات التجريبية (TEMP-002) — للنشطة وللمسلّمة خلال آخر 36 ساعة
          const startR = tCollect - 5 * MIN;
          const endR = done ? tDeliver : now;
          if (endR > now - 36 * HOUR) genReadings(sh, box, startR, Math.min(endR, now), air ?? null, s);
          // الموقع الأخير المؤكد (MMT)
          const lastWithFix = [...db.readings].reverse().find((r) => r.boxId === box.id && r.fixValid && Date.parse(r.deviceTime) <= endR);
          if (lastWithFix) sh.lastPosition = { lat: lastWithFix.lat!, lng: lastWithFix.lng!, at: lastWithFix.deviceTime, source: 'device' };
        }
      }
    }
    if (['failed', 'return_pending', 'returned'].includes(target)) {
      const tf = Date.parse(sh.deliverBy) - 30 * MIN;
      statusEvt(sh, 'in_transit', 'failed', tf, courier.userId, 'المستلم غير متاح في نافذة التسليم', 'courier_app');
      db.deliveryAttempts.push({ id: id('att'), shipmentId: sh.id, attemptedAt: iso(tf), outcome: 'failed', reasonCode: 'RECIPIENT_UNAVAILABLE', notes: 'مكتب الاستلام مغلق — تم التواصل دون رد', courierId: courier.id });
      sh.status = 'failed';
      if (target !== 'failed') {
        statusEvt(sh, 'failed', 'return_pending', tf + 40 * MIN, U.ops.id, 'قرار إرجاع إلى المرسل');
        db.returns.push({ id: id('ret'), shipmentId: sh.id, reasonCode: 'RECIPIENT_UNAVAILABLE', decision: 'return_to_sender', responsibleParty: 'customer', requestedBy: U.ops.id, authorizedBy: U.ops.id, status: target === 'returned' ? 'completed' : 'in_progress', alternateAddressId: null, costHalala: sar(95), createdAt: iso(tf + 35 * MIN), completedAt: target === 'returned' ? iso(tf + 3 * HOUR) : null });
        sh.status = 'return_pending';
        if (target === 'returned') { statusEvt(sh, 'return_pending', 'returned', tf + 3 * HOUR, courier.userId, 'تم التسليم للمرسل مع توقيع', 'courier_app'); sh.status = 'returned'; }
      }
    }
    if (target === 'cancelled') { statusEvt(sh, sh.status, 'cancelled', created + 2 * HOUR, sh.createdBy, 'إلغاء من العميل قبل الاستلام'); sh.status = 'cancelled'; }
    if (target === 'exception') { statusEvt(sh, sh.status, 'exception', now - 50 * MIN, U.ops.id, s.sub === 'suspected_lost' ? 'انقطاع الحيازة والإشارة — اشتباه فقدان' : 'استثناء تشغيلي'); sh.status = 'exception'; }
    if (s.sub) sh.subStatus = s.sub;
    sh.updatedAt = db.statusEvents.filter((e) => e.shipmentId === sh.id).map((e) => e.occurredAt).sort().pop() ?? sh.createdAt;
    sh.version = db.statusEvents.filter((e) => e.shipmentId === sh.id).length;
    // ETA مُفسّر بالقواعد (PDA)
    if (['pickup_scheduled', 'collected', 'in_transit', 'at_handover'].includes(sh.status)) {
      const inAir = db.legs.some((l) => l.mode === 'air' && l.status === 'departed' && db.shipmentLegs.some((x) => x.legId === l.id && x.shipmentId === sh.id));
      sh.eta = inAir ? { at: null, confidence: 'unavailable', basis: 'الشحنة على متن رحلة؛ يُحدَّث التقدير بعد حدث وصول الناقل' } : { at: iso(Date.parse(sh.deliverBy) - between(-40, 50) * MIN), confidence: sh.status === 'at_handover' ? 'high' : 'medium', basis: 'قواعد المرحلة 1: زمن المسار المخطط + آخر حدث حيازة' };
    }
  }

  function genReadings(sh: T.Shipment, box: T.Box, start: number, end: number, air: T.TransportLeg | null, s: Spec) {
    const dev = devOfBox(box.id);
    const prof = profileFor(box.thermalClass);
    const mid = (prof.minC + prof.maxC) / 2;
    const from = db.addresses.find((a) => a.id === sh.senderAddressId)!;
    const to = db.addresses.find((a) => a.id === sh.receiverAddressId)!;
    const step = sh.status === 'delivered' ? 10 * MIN : 5 * MIN;
    const existing = new Set(db.readings.filter((r) => r.deviceId === dev.id).map((r) => r.deviceTime));
    for (let ts = start; ts <= end; ts += step) {
      const ti = iso(ts);
      if (existing.has(ti)) continue;
      const frac = (ts - start) / Math.max(1, Date.parse(sh.deliverBy) - start);
      let temp: number | null = Math.round((mid + Math.sin(ts / 1.7e6) * (prof.maxC - prof.minC) * 0.22 + between(-0.35, 0.35)) * 10) / 10;
      let lat: number | null = from.lat + (to.lat - from.lat) * Math.min(1, frac) + between(-0.003, 0.003);
      let lng: number | null = from.lng + (to.lng - from.lng) * Math.min(1, frac) + between(-0.003, 0.003);
      let fix = true;
      let received = ts + between(3, 20) * 1000;
      let backfilled = false;
      // ساق جوية: لا اتصال ولا موقع أثناء الرحلة — لا تُختلق قراءات (UAT-006)
      if (air) {
        const ad = Date.parse(air.scheduledDeparture) - 25 * MIN, aa = Date.parse(air.scheduledArrival) + 20 * MIN;
        if (ts >= ad && ts <= aa) continue;
        if (ts < ad) { const ap = airport[sh.originCity]; const f = Math.min(1, (ts - start) / Math.max(1, ad - start)); lat = from.lat + (ap.lat - from.lat) * f; lng = from.lng + (ap.lng - from.lng) * f; }
        else { const ap = airport[sh.destCity]; const f = Math.min(1, (ts - aa) / Math.max(1, Date.parse(sh.deliverBy) - aa)); lat = ap.lat + (to.lat - ap.lat) * f; lng = ap.lng + (to.lng - ap.lng) * f; }
      }
      // انحراف حراري (UAT-004)
      if (s.tag === 'excursion' && ts > now - 95 * MIN && ts < now - 50 * MIN) temp = Math.round((8.6 + Math.sin((ts - now) / 9e5) * 1.4 + 0.9) * 10) / 10;
      // جهاز انقطع ثم أرسل بيانات متأخرة (UAT-005)
      if (s.tag === 'backfill' && ts > now - 80 * MIN && ts < now - 35 * MIN) { received = now - 12 * MIN + between(0, 60) * 1000; backfilled = true; }
      // جهاز ما زال دون اتصال — آخر قراءة معروفة فقط
      if (s.tag === 'offline' && ts > now - 70 * MIN) continue;
      // انقطاع موقع داخل مبنى
      if (rnd() < 0.04) { fix = false; lat = null; lng = null; }
      db.readings.push({ id: id('rd'), deviceId: dev.id, boxId: box.id, deviceTime: ti, receivedAt: iso(received), tempC: temp, batteryPct: Math.max(5, Math.round((dev.batteryPct ?? 80) - (ts - start) / (3 * HOUR))), lat, lng, fixValid: fix, backfilled, demo: true });
    }
    const last = db.readings.filter((r) => r.deviceId === dev.id).sort((a, b) => a.deviceTime.localeCompare(b.deviceTime)).pop();
    if (last) { dev.lastSeenAt = last.receivedAt; dev.lastTempC = last.tempC; dev.batteryPct = last.batteryPct; if (last.fixValid) dev.lastFix = { lat: last.lat!, lng: last.lng!, at: last.deviceTime }; }
  }

  // ---------------- سيناريوهات العرض المسمّاة ----------------
  const br = (o: string, b: string) => db.branches.find((x) => x.id === `br_${o}_${b}`)!;
  const A = (o: string, b: string) => addrOfBranch[`br_${o}_${b}`];
  // S01 — شحنة مبرّدة جوية الرياض ← جدة، الآن على متن الرحلة
  makeShipment({ tag: 'air', org: NKH, branch: br('nkh', 'oly'), from: A('nkh', 'oly'), to: gnmAddr, receiverOrg: orgByCode.GNM, tc: 'chilled', level: 'express', status: 'in_transit', pickupAt: now - 4.1 * HOUR, mode: 'road_air' });
  // S02 — صندوق مشترك لعميلين مختلفين (BR-003)
  makeShipment({ tag: 'shared1', org: NKH, branch: br('nkh', 'mlq'), from: A('nkh', 'mlq'), to: nrlAddr, receiverOrg: orgByCode.NRL, tc: 'chilled', level: 'standard', status: 'in_transit', pickupAt: now - 1.6 * HOUR, boxId: 'box_002' });
  makeShipment({ tag: 'shared2', org: orgByCode.DQA, branch: br('dqa', 'cen'), from: A('dqa', 'cen'), to: nrlAddr, receiverOrg: orgByCode.NRL, tc: 'chilled', level: 'standard', status: 'in_transit', pickupAt: now - 1.4 * HOUR, boxId: 'box_002' });
  // S03 — انحراف حراري مفتوح
  makeShipment({ tag: 'excursion', org: orgByCode.DQA, branch: br('dqa', 'cen'), from: A('dqa', 'cen'), to: A('dqa', 'dmm'), receiverOrg: orgByCode.DQA, tc: 'chilled', level: 'standard', status: 'in_transit', pickupAt: now - 3.2 * HOUR, boxId: 'box_004' });
  // S04 — بيانات متأخرة بعد انقطاع، وجهاز ما زال دون اتصال
  makeShipment({ tag: 'backfill', org: orgByCode.SHL, branch: br('shl', 'dmm'), from: A('shl', 'dmm'), to: A('dqa', 'khb'), receiverOrg: orgByCode.DQA, tc: 'frozen', level: 'express', status: 'in_transit', pickupAt: now - 2.6 * HOUR, boxId: 'box_018' });
  makeShipment({ tag: 'offline', org: orgByCode.RAF, branch: br('raf', 'hmr'), from: A('raf', 'hmr'), to: gnmAddr, receiverOrg: orgByCode.GNM, tc: 'ambient', level: 'standard', status: 'in_transit', pickupAt: now - 2.4 * HOUR, boxId: 'box_026' });
  // S06 — تسليم فاشل بانتظار القرار
  makeShipment({ tag: 'failed', org: orgByCode.RAF, branch: br('raf', 'sfa'), from: A('raf', 'sfa'), to: A('raf', 'azz'), receiverOrg: orgByCode.RAF, tc: 'ambient', level: 'standard', status: 'failed', pickupAt: now - 7 * HOUR });
  // S07 — اشتباه فقدان
  makeShipment({ tag: 'lost', org: orgByCode.SHL, branch: br('shl', 'jbl'), from: A('shl', 'jbl'), to: A('shl', 'dmm'), receiverOrg: orgByCode.SHL, tc: 'chilled', level: 'standard', status: 'exception', sub: 'suspected_lost', pickupAt: now - 9 * HOUR, boxId: 'box_007' });
  // S12 — مهمة اليوم للمندوب courier1 (للتسليم في تطبيق المندوب)
  makeShipment({ tag: 'courier_pickup', org: NKH, branch: br('nkh', 'oly'), from: A('nkh', 'oly'), to: nrlAddr, receiverOrg: orgByCode.NRL, tc: 'chilled', level: 'stat', status: 'pickup_scheduled', pickupAt: now + 0.6 * HOUR });
  makeShipment({ tag: 'courier_deliver', org: NKH, branch: br('nkh', 'mlq'), from: A('nkh', 'mlq'), to: nrlAddr, receiverOrg: orgByCode.NRL, tc: 'frozen', level: 'express', status: 'at_handover', pickupAt: now - 1.5 * HOUR });
  makeShipment({ tag: 'individual_active', org: individuals[0], branch: null, from: homeAddr(individuals[0].id), to: nrlAddr, receiverOrg: orgByCode.NRL, tc: 'chilled', level: 'standard', status: 'confirmed', pickupAt: now + 3 * HOUR });
  makeShipment({ tag: 'mlq_private', org: NKH, branch: br('nkh', 'mlq'), from: A('nkh', 'mlq'), to: A('nkh', 'oly'), receiverOrg: NKH, tc: 'ambient', level: 'standard', status: 'pickup_scheduled', pickupAt: now + 1.5 * HOUR });

  // ---------------- شحنات عامة ----------------
  const corpOrgs = ['NKH', 'DQA', 'RAF', 'SHL', 'NRL'].map((c) => orgByCode[c]);
  const destinations = [nrlAddr, gnmAddr, A('dqa', 'cen'), A('dqa', 'dmm'), A('nkh', 'oly'), A('shl', 'dmm')];
  const plan: Array<[T.ShipmentStatus, number, number, number]> = [ // [status, count, minHoursAgo, maxHoursAgo] (سالب = مستقبلاً)
    ['delivered', 34, 3, 24 * 14], ['in_transit', 5, 0.6, 2.4], ['collected', 3, 0.3, 0.8], ['at_handover', 2, 1, 2], ['pickup_scheduled', 7, -6, -0.5],
    ['confirmed', 4, -26, -6], ['draft', 3, -48, -24], ['cancelled', 3, 24, 24 * 6], ['returned', 1, 30, 50], ['return_pending', 1, 10, 14],
  ];
  for (const [st, count, a, b] of plan) {
    for (let i = 0; i < count; i++) {
      const isInd = rnd() < 0.15;
      const org = isInd ? pick(individuals) : pick(corpOrgs);
      const branch = isInd ? null : pick(branchesOf[org.id]);
      const from = isInd ? homeAddr(org.id) : addrOfBranch[branch!.id];
      let to = pick(destinations.filter((d) => d.id !== from.id));
      if (['collected', 'at_handover'].includes(st)) to = destinations.find((d) => d.cityCode === from.cityCode && d.id !== from.id) ?? to;
      const tc: T.ThermalClass = pick(['chilled', 'chilled', 'chilled', 'frozen', 'ambient']);
      const receiver = db.organizations.find((o) => o.id === to.organizationId) ?? null;
      makeShipment({ org, branch, from, to, receiverOrg: receiver, tc, level: pick(['standard', 'standard', 'express', 'stat']), status: st, pickupAt: now - between(a, b) * HOUR, dedicated: rnd() < 0.08, requestType: rnd() < 0.15 ? 'recurring' : undefined });
    }
  }

  tagged.lost.lostState = 'suspected';
  for (const c of db.couriers) if (db.boxes.some((b) => b.status === 'in_use' && b.custodianType === 'courier' && b.custodianId === c.id)) c.status = 'on_route';
  // حالات الأجهزة (DHC) — قراءات للحالة الحالية
  for (const b of db.boxes) {
    const d = devOfBox(b.id);
    if (b.status === 'in_use') d.state = 'assigned';
  }
  const setBox = (bid: string, status: T.BoxStatus, devState?: T.DeviceState, extra: Partial<T.Box> = {}) => { const b = boxById(bid); if (b.status === 'in_use') return; Object.assign(b, { status }, extra); if (devState) devOfBox(bid).state = devState; };
  setBox('box_010', 'available', 'low_battery'); devOfBox('box_010').batteryPct = 14; // S05 — صندوق غير جاهز
  setBox('box_011', 'available', 'offline'); devOfBox('box_011').lastSeenAt = t(-19);
  setBox('box_013', 'maintenance', 'faulty', { condition: 'damaged' });
  setBox('box_012', 'cleaning'); setBox('box_020', 'inspection');
  setBox('box_021', 'partner_custody', undefined, { custodianType: 'partner', custodianId: P.hejaz.id, locationCity: 'JED' });
  setBox('box_014', 'available', undefined, { qualificationStatus: 'expired', qualificationExpiry: t(-24 * 3) });
  setBox('box_030', 'retired', 'retired');
  db.partnerCustody.push(
    { id: id('pcu'), boxId: 'box_021', partnerId: P.hejaz.id, warehouseId: 'wh_jed', handedAt: t(-30), returnDueAt: t(18), returnedAt: null, signedBy: 'أ. مازن (مستودعات الحجاز)', status: 'active' },
    { id: id('pcu'), boxId: 'box_019', partnerId: P.hejaz.id, warehouseId: 'wh_jed', handedAt: t(-24 * 9), returnDueAt: t(-24 * 6), returnedAt: t(-24 * 6.2), signedBy: 'أ. مازن (مستودعات الحجاز)', status: 'returned' },
  );
  db.deviceHealth.push(
    { id: id('dhe'), deviceId: devOfBox('box_010').id, eventType: 'low_battery', severity: 'warning', observedAt: t(-3) },
    { id: id('dhe'), deviceId: devOfBox('box_011').id, eventType: 'offline', severity: 'warning', observedAt: t(-19) },
    { id: id('dhe'), deviceId: devOfBox('box_013').id, eventType: 'sensor_fault', severity: 'critical', observedAt: t(-50) },
    { id: id('dhe'), deviceId: devOfBox('box_026').id, eventType: 'offline', severity: 'warning', observedAt: t(-70 / 60) },
    { id: id('dhe'), deviceId: devOfBox('box_018').id, eventType: 'missing_readings', severity: 'info', observedAt: t(-75 / 60) },
    { id: id('dhe'), deviceId: devOfBox('box_018').id, eventType: 'online', severity: 'info', observedAt: t(-12 / 60) },
  );

  // ---------------- الجودة: الانحراف والحوادث و CAPA والمطالبات ----------------
  const exc = tagged.excursion;
  db.excursions.push({ id: 'exc_0001', shipmentId: exc.id, boxId: 'box_004', deviceId: devOfBox('box_004').id, profileId: 'svc_chilled_v2', startedAt: t(-95 / 60), endedAt: t(-50 / 60), peakC: 10.7, severity: 'major', status: 'open', acknowledgedBy: null, reviewDecision: null, incidentId: null });
  const oldDelivered = db.shipments.filter((s) => s.status === 'delivered' && s.thermalClass === 'chilled').slice(0, 3);
  db.excursions.push({ id: 'exc_0002', shipmentId: oldDelivered[0].id, boxId: 'box_005', deviceId: devOfBox('box_005').id, profileId: 'svc_chilled_v2', startedAt: iso(Date.parse(oldDelivered[0].pickupWindowStart) + 70 * MIN), endedAt: iso(Date.parse(oldDelivered[0].pickupWindowStart) + 84 * MIN), peakC: 8.9, severity: 'minor', status: 'closed', acknowledgedBy: U.ops.id, reviewDecision: 'انحراف قصير ضمن زمن السماح بعد فتح الباب؛ لا أثر لوجستي. القرار السريري للمختبر المستلم.', incidentId: null });
  const incDefs: Array<[string | null, T.Incident['incidentType'], T.Incident['severity'], T.Incident['status'], T.L, number]> = [
    [oldDelivered[1]?.id ?? null, 'temperature', 'high', 'closed', L('ارتفاع حرارة صندوق مبرّد أثناء انتظار طويل', 'Chilled box temperature rise during long wait'), 24 * 9],
    [tagged.lost.id, 'suspected_lost', 'critical', 'investigating', L('اشتباه فقدان شحنة الجبيل — انقطاع الإشارة والحيازة', 'Suspected loss — Jubail shipment, signal and custody gap'), 1],
    [tagged.failed.id, 'delay', 'medium', 'open', L('تسليم فاشل — مكتب الاستلام مغلق', 'Failed delivery — receiving desk closed'), 0.4],
    [null, 'device', 'medium', 'decision', L('عطل مستشعر حرارة في جهاز صندوق BX-CS-013', 'Temperature sensor fault on BX-CS-013 tracker'), 50],
    [oldDelivered[2]?.id ?? null, 'damage', 'low', 'closed', L('تلف بسيط في غلاف خارجي — العينات سليمة', 'Minor outer packaging damage — samples intact'), 24 * 6],
    [null, 'custody_break', 'high', 'closed', L('توقيع ناقص عند تسليم للشريك الجوي', 'Missing signature at air-partner handover'), 24 * 12],
  ];
  incDefs.forEach(([sid, type, sev, st, title, hAgo], i) => db.incidents.push({ id: `inc_${pad(i + 1)}`, code: `QI-2026-${pad(140 + i, 4)}`, shipmentId: sid, incidentType: type, severity: sev, status: st, title, findings: st === 'closed' ? 'تمت مراجعة الأدلة وإغلاق الحادث مع إجراءات CAPA.' : '', openedAt: t(-hAgo), closedAt: st === 'closed' ? t(-hAgo + 30) : null, ownerId: U.quality.id }));
  db.capas.push(
    { id: id('capa'), incidentId: 'inc_0001', actionType: 'corrective', description: 'تدريب المندوبين على حد أقصى 10 دقائق لفتح الصندوق', ownerId: U.ops.id, dueAt: t(-24 * 2), completedAt: t(-24 * 3), status: 'done' },
    { id: id('capa'), incidentId: 'inc_0001', actionType: 'preventive', description: 'إضافة تنبيه انتظار في تطبيق المندوب بعد 15 دقيقة', ownerId: U.iot.id, dueAt: t(24 * 10), completedAt: null, status: 'open' },
    { id: id('capa'), incidentId: 'inc_0006', actionType: 'corrective', description: 'جعل التوقيع إلزامياً في شاشة نقل الحيازة للناقل الجوي', ownerId: U.admin.id, dueAt: t(-24 * 1), completedAt: null, status: 'overdue' },
    { id: id('capa'), incidentId: 'inc_0004', actionType: 'corrective', description: 'إرجاع الجهاز للمورد وفحص دفعة البرامج الثابتة V2.1.6', ownerId: U.iot.id, dueAt: t(24 * 5), completedAt: null, status: 'open' },
  );
  db.claims.push(
    { id: 'clm_0001', code: 'CL-2026-0031', shipmentId: oldDelivered[1]?.id ?? db.shipments[0].id, incidentId: 'inc_0001', organizationId: db.shipments.find((s) => s.id === oldDelivered[1]?.id)?.organizationId ?? NKH.id, claimType: 'temperature', status: 'approved', claimedAmount: sar(2400), approvedAmount: sar(1800), liability: 'company', description: 'طلب تعويض عن إعادة سحب العينات', createdAt: t(-24 * 8), evidence: ['temperature-report.pdf', 'incident-QI-2026-0140.pdf'] },
    { id: 'clm_0002', code: 'CL-2026-0034', shipmentId: oldDelivered[2]?.id ?? db.shipments[1].id, incidentId: 'inc_0005', organizationId: db.shipments.find((s) => s.id === oldDelivered[2]?.id)?.organizationId ?? NKH.id, claimType: 'damage', status: 'rejected', claimedAmount: sar(600), approvedAmount: 0, liability: 'none', description: 'تلف الغلاف الخارجي', createdAt: t(-24 * 5), evidence: ['photo-1.jpg'] },
    { id: 'clm_0003', code: 'CL-2026-0037', shipmentId: tagged.failed.id, incidentId: 'inc_0003', organizationId: tagged.failed.organizationId, claimType: 'delay', status: 'submitted', claimedAmount: sar(350), approvedAmount: null, liability: null, description: 'تأخر وصول عينات العيادة إلى مكة', createdAt: t(-0.2), evidence: [] },
    { id: 'clm_0004', code: 'CL-2026-0029', shipmentId: db.shipments.filter((s) => s.status === 'delivered')[5].id, incidentId: null, organizationId: db.shipments.filter((s) => s.status === 'delivered')[5].organizationId, claimType: 'delay', status: 'investigating', claimedAmount: sar(500), approvedAmount: null, liability: null, description: 'تجاوز SLA بأكثر من ساعتين', createdAt: t(-24 * 2), evidence: ['sla-report.csv'] },
  );
  db.dispositions.push({ id: id('dsp'), shipmentId: oldDelivered[0].id, institutionId: orgByCode.NRL.id, decision: 'accepted_with_note', decidedAt: iso(Date.parse(oldDelivered[0].deliverBy) + 2 * HOUR), authorizedContact: 'د. ليلى الحمدان — مدير الجودة المخبرية', note: 'قُبلت العينات بعد مراجعة تقرير الحرارة', enteredBy: U.lab.id, onBehalf: false });

  // ---------------- المخزون والمستهلكات ----------------
  const cons: Array<[string, T.L, T.L, number, number]> = [
    ['GEL-ICE-500', L('عبوات تبريد جل 500 مل', 'Gel ice packs 500 ml'), L('عبوة', 'pack'), 420, 150], ['DRY-ICE-KG', L('ثلج جاف', 'Dry ice'), L('كجم', 'kg'), 85, 100],
    ['UN3373-BAG', L('أكياس UN3373 ثلاثية الطبقات', 'UN3373 triple bags'), L('كيس', 'bag'), 960, 300], ['ABS-PAD', L('وسائد امتصاص', 'Absorbent pads'), L('قطعة', 'pc'), 1240, 400],
    ['SEAL-TAMP', L('أختام ضد العبث', 'Tamper seals'), L('ختم', 'seal'), 210, 250], ['LBL-QR', L('ملصقات QR للشحنات', 'Shipment QR labels'), L('ملصق', 'label'), 3100, 800],
  ];
  cons.forEach(([sku, n, u, on, re], i) => {
    const c: T.Consumable = { id: `cns_${pad(i + 1, 2)}`, sku, name: n, unit: u, onHand: on, reorderLevel: re, warehouseId: 'wh_ruh' };
    db.consumables.push(c);
    db.consumableMovements.push({ id: id('cmv'), consumableId: c.id, qty: on + 200, kind: 'receipt', at: t(-24 * 20), by: U.warehouse.id, ref: `GRN-2026-${pad(80 + i, 4)}` }, { id: id('cmv'), consumableId: c.id, qty: -200, kind: 'issue', at: t(-24 * 2), by: U.warehouse.id, ref: 'صرف للمسارات' });
  });

  // ---------------- المالية: دليل الحسابات والفواتير والقيود ----------------
  const acc: Array<[string, T.L, T.GlAccount['type'], string | null]> = [
    ['1000', L('الأصول', 'Assets'), 'asset', null], ['1100', L('النقد والبنوك', 'Cash and banks'), 'asset', '1000'], ['1200', L('الذمم المدينة — عملاء', 'Accounts receivable'), 'asset', '1000'], ['1300', L('ضريبة مدخلات', 'Input VAT'), 'asset', '1000'], ['1500', L('صناديق وأجهزة تتبع', 'Boxes and trackers'), 'asset', '1000'],
    ['2000', L('الالتزامات', 'Liabilities'), 'liability', null], ['2100', L('الذمم الدائنة — شركاء', 'Accounts payable — partners'), 'liability', '2000'], ['2200', L('ضريبة مخرجات مستحقة', 'Output VAT payable'), 'liability', '2000'], ['2300', L('مخصص مطالبات', 'Claims provision'), 'liability', '2000'],
    ['3000', L('حقوق الملكية', 'Equity'), 'equity', null], ['3100', L('رأس المال', 'Share capital'), 'equity', '3000'],
    ['4000', L('الإيرادات', 'Revenue'), 'revenue', null], ['4100', L('إيرادات نقل العينات', 'Sample transport revenue'), 'revenue', '4000'], ['4200', L('رسوم العقود', 'Contract fees'), 'revenue', '4000'], ['4900', L('مردودات ومسموحات مبيعات', 'Sales returns and allowances'), 'revenue', '4000'],
    ['5000', L('المصروفات', 'Expenses'), 'expense', null], ['5100', L('تكلفة المندوبين', 'Courier cost'), 'expense', '5000'], ['5200', L('تكلفة الشحن الجوي', 'Air cargo cost'), 'expense', '5000'], ['5300', L('تكلفة النقل البري للشركاء', 'Partner road cost'), 'expense', '5000'], ['5400', L('تكلفة إنترنت الأشياء', 'IoT cost'), 'expense', '5000'], ['5500', L('تكلفة المستودع', 'Warehouse cost'), 'expense', '5000'], ['5600', L('مصروف المطالبات', 'Claims expense'), 'expense', '5000'],
  ];
  acc.forEach(([code, n, type, parent]) => db.glAccounts.push({ id: `gl_${code}`, code, name: n, type, parentId: parent ? `gl_${parent}` : null, active: true }));
  const jr = (desc: string, at: number, source: string, sourceId: string | null, lines: T.JournalLine[], posted = true) => {
    const j: T.Journal = { id: id('jnl'), journalNo: `JV-2026-${pad(next('jv'), 5)}`, entryDate: iso(at), status: posted ? 'posted' : 'draft', sourceType: source, sourceId, description: desc, lines, postedAt: posted ? iso(at + 5 * MIN) : null, postedBy: posted ? U.finance.id : null, reversalOfId: null, reversedById: null, createdAt: iso(at) };
    db.journals.push(j); return j;
  };
  db.payments.length = 0;
  db.journals.push(); // —
  jr('رأس المال الافتتاحي', now - 300 * DAY, 'opening', null, [{ accountId: 'gl_1100', debit: sar(2_500_000), credit: 0, memo: '' }, { accountId: 'gl_3100', debit: 0, credit: sar(2_500_000), memo: '' }]);
  jr('شراء صناديق وأجهزة GPT45-M', now - 290 * DAY, 'asset', null, [{ accountId: 'gl_1500', debit: sar(390_000), credit: 0, memo: '30 صندوقاً + 33 جهازاً' }, { accountId: 'gl_1300', debit: sar(58_500), credit: 0, memo: '' }, { accountId: 'gl_1100', debit: 0, credit: sar(448_500), memo: '' }]);

  const months = [-3, -2, -1].map((m) => { const d = new Date(now); return { from: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1), to: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m + 1, 1) - 1 }; });
  const monthName = (ms: number) => { const d = new Date(ms); return { ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(), en: d.toLocaleString('en', { month: 'long', timeZone: 'UTC' }) + ' ' + d.getUTCFullYear() }; };
  const invoicedShipments = new Set<string>();
  const invoiceFor = (org: T.Organization, period: { from: number; to: number }, idx: number) => {
    const n = next('inv');
    const inv: T.Invoice = { id: `inv_${pad(n)}`, invoiceNo: `INV-2026-${pad(n, 5)}`, organizationId: org.id, branchId: null, issueDate: iso(period.to + 2 * DAY), dueDate: iso(period.to + 32 * DAY), periodFrom: iso(period.from), periodTo: iso(period.to), subtotal: 0, vat: 0, total: 0, paid: 0, status: 'issued', zatcaStatus: 'simulated_cleared', journalId: null, createdAt: iso(period.to + 2 * DAY) };
    const lines: T.InvoiceLine[] = [];
    const contract = db.contracts.find((c) => c.organizationId === org.id && Date.parse(c.validFrom) <= period.to && Date.parse(c.validTo) >= period.from && c.status !== 'draft');
    if (contract && contract.monthlyFee) { const v = pct(contract.monthlyFee, VAT_PCT); lines.push({ id: id('inl'), invoiceId: inv.id, shipmentId: null, description: L(`رسم العقد ${contract.contractNo} — ${monthName(period.from).ar}`, `Contract fee ${contract.contractNo} — ${monthName(period.from).en}`), qty: 1, unitPrice: contract.monthlyFee, vat: v, lineTotal: contract.monthlyFee + v }); }
    const ships = db.shipments.filter((s) => s.organizationId === org.id && s.status === 'delivered' && Date.parse(s.pickupWindowStart) >= period.from && Date.parse(s.pickupWindowStart) <= period.to);
    if (ships.length) ships.forEach((s) => { const q = db.quotes.find((x) => x.id === s.quoteId)!; if (q.snapshot.subtotal > 0) lines.push({ id: id('inl'), invoiceId: inv.id, shipmentId: s.id, description: L(`نقل عينات ${s.trackingNo}`, `Sample transport ${s.trackingNo}`), qty: 1, unitPrice: q.snapshot.subtotal, vat: q.snapshot.vat, lineTotal: q.snapshot.total }); invoicedShipments.add(s.id); });
    else { const cnt = 20 + Math.floor(rnd() * 40); const unit = sar(45 + Math.floor(rnd() * 30)); const sub = cnt * unit; lines.push({ id: id('inl'), invoiceId: inv.id, shipmentId: null, description: L(`رسوم إضافية لشحنات ${monthName(period.from).ar} (${cnt} شحنة)`, `Add-on charges ${monthName(period.from).en} (${cnt} shipments)`), qty: cnt, unitPrice: unit, vat: pct(sub, VAT_PCT), lineTotal: sub + pct(sub, VAT_PCT) }); }
    inv.subtotal = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0); inv.vat = lines.reduce((a, l) => a + l.vat, 0); inv.total = inv.subtotal + inv.vat;
    db.invoices.push(inv); db.invoiceLines.push(...lines);
    const ji = jr(`إصدار فاتورة ${inv.invoiceNo}`, Date.parse(inv.issueDate!), 'invoice', inv.id, [{ accountId: 'gl_1200', debit: inv.total, credit: 0, memo: org.legalName.ar }, { accountId: 'gl_4100', debit: 0, credit: inv.subtotal, memo: '' }, { accountId: 'gl_2200', debit: 0, credit: inv.vat, memo: '' }]);
    inv.journalId = ji.id;
    // الدفع: الأشهر الأقدم مدفوعة، الشهر الأخير بين مدفوع جزئياً وغير مدفوع ومتأخر
    const payPct = idx < 2 ? 100 : org.code === 'RAF' ? 0 : org.code === 'DQA' ? 50 : 0;
    if (idx < 2 && org.code === 'SHL' && idx === 1) { inv.status = 'overdue'; }
    else if (payPct > 0) {
      const amt = Math.round((inv.total * payPct) / 100);
      const p: T.Payment = { id: id('pay'), ref: `RCPT-2026-${pad(next('rcpt'), 5)}`, direction: 'in', counterpartyType: 'organization', counterpartyId: org.id, amount: amt, method: 'bank_transfer', status: 'reconciled', bankRef: `SNB-${pad(Math.floor(rnd() * 1e7), 7)}`, receivedAt: iso(Date.parse(inv.issueDate!) + between(5, 25) * DAY), journalId: null, allocated: amt };
      db.payments.push(p); db.paymentAllocations.push({ id: id('pal'), paymentId: p.id, invoiceId: inv.id, amount: amt });
      p.journalId = jr(`تحصيل ${p.ref}`, Date.parse(p.receivedAt), 'payment', p.id, [{ accountId: 'gl_1100', debit: amt, credit: 0, memo: '' }, { accountId: 'gl_1200', debit: 0, credit: amt, memo: inv.invoiceNo }]).id;
      inv.paid = amt; inv.status = payPct === 100 ? 'paid' : 'partially_paid';
    } else if (Date.parse(inv.dueDate!) < now) inv.status = 'overdue';
    return inv;
  };
  for (const org of [NKH, orgByCode.DQA, orgByCode.RAF, orgByCode.SHL, orgByCode.NRL]) months.forEach((m, i) => invoiceFor(org, m, i));
  // فواتير الأفراد لكل شحنة مسلّمة
  for (const s of db.shipments.filter((x) => x.status === 'delivered' && x.organizationId.startsWith('org_ind') && !invoicedShipments.has(x.id))) {
    const q = db.quotes.find((x) => x.id === s.quoteId)!; const n = next('inv');
    const inv: T.Invoice = { id: `inv_${pad(n)}`, invoiceNo: `INV-2026-${pad(n, 5)}`, organizationId: s.organizationId, branchId: null, issueDate: s.updatedAt, dueDate: s.updatedAt, periodFrom: s.pickupWindowStart, periodTo: s.updatedAt, subtotal: q.snapshot.subtotal, vat: q.snapshot.vat, total: q.snapshot.total, paid: q.snapshot.total, status: 'paid', zatcaStatus: 'simulated_cleared', journalId: null, createdAt: s.updatedAt };
    db.invoices.push(inv); db.invoiceLines.push({ id: id('inl'), invoiceId: inv.id, shipmentId: s.id, description: L(`نقل عينات ${s.trackingNo}`, `Sample transport ${s.trackingNo}`), qty: 1, unitPrice: q.snapshot.subtotal, vat: q.snapshot.vat, lineTotal: q.snapshot.total });
    invoicedShipments.add(s.id);
    inv.journalId = jr(`فاتورة فورية ${inv.invoiceNo}`, Date.parse(s.updatedAt), 'invoice', inv.id, [{ accountId: 'gl_1200', debit: inv.total, credit: 0, memo: '' }, { accountId: 'gl_4100', debit: 0, credit: inv.subtotal, memo: '' }, { accountId: 'gl_2200', debit: 0, credit: inv.vat, memo: '' }]).id;
    const p: T.Payment = { id: id('pay'), ref: `RCPT-2026-${pad(next('rcpt'), 5)}`, direction: 'in', counterpartyType: 'organization', counterpartyId: s.organizationId, amount: inv.total, method: 'card_simulated', status: 'reconciled', bankRef: null, receivedAt: s.updatedAt, journalId: null, allocated: inv.total };
    db.payments.push(p); db.paymentAllocations.push({ id: id('pal'), paymentId: p.id, invoiceId: inv.id, amount: inv.total });
    p.journalId = jr(`تحصيل بطاقة (محاكاة) ${p.ref}`, Date.parse(s.updatedAt), 'payment', p.id, [{ accountId: 'gl_1100', debit: inv.total, credit: 0, memo: '' }, { accountId: 'gl_1200', debit: 0, credit: inv.total, memo: inv.invoiceNo }]).id;
  }
  // دفعة غير مخصصة بانتظار المطابقة البنكية
  db.payments.push({ id: id('pay'), ref: `RCPT-2026-${pad(next('rcpt'), 5)}`, direction: 'in', counterpartyType: 'organization', counterpartyId: orgByCode.RAF.id, amount: sar(9_775), method: 'bank_transfer', status: 'received', bankRef: `RJH-${pad(Math.floor(rnd() * 1e7), 7)}`, receivedAt: t(-20), journalId: null, allocated: 0 });
  // إشعار دائن بانتظار الاعتماد + معتمد
  const nkhInv = db.invoices.find((i) => i.organizationId === NKH.id && i.status !== 'paid') ?? db.invoices.find((i) => i.organizationId === NKH.id)!;
  db.creditNotes.push(
    { id: 'cn_0001', creditNo: 'CN-2026-00012', invoiceId: db.invoices.find((i) => i.organizationId === db.claims[0].organizationId)?.id ?? nkhInv.id, reason: 'تعويض المطالبة CL-2026-0031', amount: sar(1800), status: 'approved', requestedBy: U.finance.id, approvedBy: U.approver.id, journalId: null, createdAt: t(-24 * 6) },
    { id: 'cn_0002', creditNo: 'CN-2026-00013', invoiceId: nkhInv.id, reason: 'تصحيح احتساب صندوق مخصص مكرر', amount: sar(172.5), status: 'pending_approval', requestedBy: U.finance.id, approvedBy: null, journalId: null, createdAt: t(-5) },
  );
  db.creditNotes[0].journalId = jr('إشعار دائن CN-2026-00012', now - 6 * DAY, 'credit_note', 'cn_0001', [{ accountId: 'gl_4900', debit: sar(1565.22), credit: 0, memo: '' }, { accountId: 'gl_2200', debit: sar(234.78), credit: 0, memo: '' }, { accountId: 'gl_1200', debit: 0, credit: sar(1800), memo: '' }]).id;

  // التكاليف وقواعد التوزيع (COST)
  db.allocationRules.push(
    { id: 'alr_courier', code: 'ALLOC-COURIER', name: L('توزيع تكلفة المندوب لكل شحنة في المسار', 'Courier cost per shipment on route'), basis: 'per_shipment', costType: 'courier', version: 2, status: 'active', approvedBy: U.approver.id },
    { id: 'alr_air', code: 'ALLOC-AIR', name: L('توزيع الشحن الجوي حسب الوزن', 'Air cargo cost by weight'), basis: 'per_kg', costType: 'air_cargo', version: 1, status: 'active', approvedBy: U.approver.id },
    { id: 'alr_box', code: 'ALLOC-BOX', name: L('توزيع تكلفة الصندوق والجهاز حسب ساعات الإشغال', 'Box & tracker cost by occupancy hours'), basis: 'per_box_hour', costType: 'iot', version: 1, status: 'active', approvedBy: U.approver.id },
  );
  for (const l of db.legs.filter((x) => x.actualArrival)) {
    const cost = l.mode === 'air' ? sar(between(240, 380)) : l.partnerId ? sar(between(160, 260)) : sar(between(35, 70));
    const cr: T.CostRecord = { id: id('cst'), costType: l.mode === 'air' ? 'air_cargo' : 'courier', sourceRef: l.id, estimated: cost, actual: rnd() < 0.8 ? cost + sar(between(-10, 15)) : null, incurredAt: l.actualArrival!, allocated: rnd() < 0.7 };
    db.costRecords.push(cr);
    if (cr.allocated) {
      const ships = db.shipmentLegs.filter((x) => x.legId === l.id).map((x) => x.shipmentId);
      const each = Math.floor((cr.actual ?? cr.estimated) / ships.length);
      ships.forEach((sid, i) => db.costAllocations.push({ id: id('cal'), costRecordId: cr.id, shipmentId: sid, ruleId: l.mode === 'air' ? 'alr_air' : 'alr_courier', amount: i === ships.length - 1 ? (cr.actual ?? cr.estimated) - each * (ships.length - 1) : each, overrideApprovalId: null, createdAt: iso(Date.parse(l.actualArrival!) + HOUR) }));
    }
  }
  db.costRecords.push({ id: id('cst'), costType: 'iot', sourceRef: 'باقات بيانات SIM — أكتوبر', estimated: sar(1650), actual: sar(1650), incurredAt: iso(months[2].to), allocated: false }, { id: id('cst'), costType: 'warehouse', sourceRef: 'تشغيل المستودع — أكتوبر', estimated: sar(42_000), actual: sar(41_380), incurredAt: iso(months[2].to), allocated: false });

  // تسويات الشركاء (PST)
  const partnerLegs = (pid: string) => db.legs.filter((l) => l.partnerId === pid && l.actualArrival);
  const mkSettlement = (p: T.Partner, from: number, to: number, status: T.Settlement['status']) => {
    const lines = partnerLegs(p.id).filter((l) => Date.parse(l.actualArrival!) >= from && Date.parse(l.actualArrival!) <= to).map((l) => ({ legId: l.id, amount: db.costRecords.find((c) => c.sourceRef === l.id)?.actual ?? sar(200), note: l.flightNo ?? `${l.originCity}→${l.destCity}` }));
    const calc = lines.length ? lines.reduce((a, l) => a + l.amount, 0) : sar(between(8000, 20000));
    const s: T.Settlement = { id: id('stl'), settlementNo: `ST-${p.code}-${pad(next('stl:' + p.code), 3)}`, partnerId: p.id, periodStart: iso(from), periodEnd: iso(to), status, calculated: calc, partnerInvoiced: status === 'draft' ? null : calc + (status === 'disputed' ? sar(640) : 0), approved: ['approved', 'paid'].includes(status) ? calc : null, approvedBy: ['approved', 'paid'].includes(status) ? U.approver.id : null, approvedAt: ['approved', 'paid'].includes(status) ? iso(to + 3 * DAY) : null, paymentId: null, lines };
    db.settlements.push(s);
    if (['approved', 'paid'].includes(status)) jr(`استحقاق تسوية ${s.settlementNo}`, to + 3 * DAY, 'settlement', s.id, [{ accountId: p.partnerType === 'air' ? 'gl_5200' : 'gl_5300', debit: calc, credit: 0, memo: '' }, { accountId: 'gl_2100', debit: 0, credit: calc, memo: p.name.ar }]);
    if (status === 'paid') {
      const pay: T.Payment = { id: id('pay'), ref: `PAY-2026-${pad(next('payout'), 5)}`, direction: 'out', counterpartyType: 'partner', counterpartyId: p.id, amount: calc, method: 'bank_transfer', status: 'reconciled', bankRef: `SNB-OUT-${pad(Math.floor(rnd() * 1e6), 6)}`, receivedAt: iso(to + 8 * DAY), journalId: null, allocated: calc };
      db.payments.push(pay); s.paymentId = pay.id;
      pay.journalId = jr(`سداد تسوية ${s.settlementNo}`, to + 8 * DAY, 'partner_payment', s.id, [{ accountId: 'gl_2100', debit: calc, credit: 0, memo: '' }, { accountId: 'gl_1100', debit: 0, credit: calc, memo: '' }]).id;
    }
  };
  mkSettlement(P.sahra, months[1].from, months[1].to, 'paid');
  mkSettlement(P.sahra, months[2].from, months[2].to, 'reconciled');
  mkSettlement(P.ufuq, now - 21 * DAY, now - 14 * DAY, 'paid');
  mkSettlement(P.ufuq, now - 14 * DAY, now - 7 * DAY, 'approved');
  mkSettlement(P.ufuq, now - 7 * DAY, now, 'draft');
  mkSettlement(P.sahil, months[2].from, months[2].to, 'disputed');
  mkSettlement(P.hejaz, months[2].from, months[2].to, 'draft');

  // محاكاة تسعير سابقة (SIM)
  db.simulations.push({ id: 'sim_0001', name: 'رفع أسعار الجوي 6% للربع الأول', createdBy: U.finance.id, createdAt: t(-24 * 4), ratePlanId: plan3.id, adjustments: [{ thermalClass: 'all', pct: 6 }], result: { currentRevenue: sar(184_300), proposedRevenue: sar(189_850), estimatedCost: sar(121_400), shipmentsAnalysed: 412 }, status: 'submitted', liveChangesApplied: false });

  // ---------------- الامتثال والحوكمة ----------------
  const reqs: Array<[string, T.L, T.Requirement['applicability']]> = [
    ['REQ-MOH-TRN', L('ترخيص نقل العينات الطبية (قيد المراجعة القانونية)', 'Medical sample transport license (under legal review)'), 'under_review'],
    ['REQ-TGA-ROAD', L('ترخيص نقل بري للبضائع', 'Road freight transport license'), 'applicable'],
    ['REQ-GACA-DG', L('اعتماد شحن جوي لمواد UN3373', 'Air cargo approval for UN3373'), 'applicable'],
    ['REQ-VEH-REEF', L('شهادة تأهيل مركبة مبرّدة', 'Refrigerated vehicle qualification'), 'applicable'],
    ['REQ-COUR-TRN', L('تدريب المندوب على المواد الحيوية', 'Courier biohazard training'), 'applicable'],
    ['REQ-PDPL', L('مراجعة انطباق نظام حماية البيانات الشخصية', 'PDPL applicability review'), 'under_review'],
  ];
  reqs.forEach(([code, d, a], i) => db.requirements.push({ id: `req_${pad(i + 1, 2)}`, code, description: d, applicability: a, reviewedAt: a === 'under_review' ? null : t(-24 * 40) }));
  const lic = (holderType: T.License['holderType'], holderId: string, req: string, no: string, toDays: number, status?: T.License['status']) => {
    const s: T.License['status'] = status ?? (toDays < 0 ? 'expired' : toDays < 30 ? 'expiring' : 'valid');
    db.licenses.push({ id: id('lic'), holderType, holderId, requirementId: req, licenseNo: no, validFrom: t(-24 * 300), validTo: t(24 * toDays), status: s, verifiedBy: s === 'pending_verification' ? null : U.compliance.id });
  };
  lic('company', 'company', 'req_01', 'MOH-TL-77812 (تجريبي)', 210); lic('company', 'company', 'req_02', 'TGA-55120 (تجريبي)', 180);
  lic('partner', P.sahra.id, 'req_02', 'TGA-33019 (تجريبي)', 95); lic('partner', P.ufuq.id, 'req_03', 'GACA-DG-4410 (تجريبي)', 18);
  lic('partner', P.sahil.id, 'req_02', 'TGA-29004 (تجريبي)', -10); lic('partner', P.hejaz.id, 'req_02', 'TGA-WH-1182 (تجريبي)', 140);
  db.vehicles.forEach((v) => lic('vehicle', v.id, 'req_04', `REEF-${v.id.slice(-2)}`, Math.round((Date.parse(v.qualificationExpiry) - now) / DAY)));
  db.couriers.forEach((c) => lic('courier', c.id, 'req_05', `BIO-TR-${c.id.slice(-2)}`, Math.round((Date.parse(c.qualificationExpiry) - now) / DAY)));
  lic('company', 'company', 'req_06', 'PDPL-REVIEW-01', 365, 'pending_verification');
  const sahilLic = db.licenses.find((l) => l.holderId === P.sahil.id)!;
  db.blocks.push({ id: id('blk'), scopeType: 'partner', scopeId: P.sahil.id, reason: 'انتهاء ترخيص النقل البري TGA-29004', activeFrom: t(-24 * 10), resolvedAt: null, licenseId: sahilLic.id });
  db.blocks.push({ id: id('blk'), scopeType: 'vehicle', scopeId: 'veh_05', reason: 'انتهاء تأهيل المركبة المبرّدة', activeFrom: t(-24 * 10), resolvedAt: null, licenseId: null });
  db.blocks.push({ id: id('blk'), scopeType: 'courier', scopeId: 'cou_09', reason: 'انتهاء تدريب المواد الحيوية + حظر الشريك', activeFrom: t(-24 * 10), resolvedAt: null, licenseId: null });
  db.retentionPolicies.push(
    { id: id('rtp'), category: 'telemetry_readings', activeDays: 90, archiveDays: 730, deletion: 'delete', status: 'pending_legal_review' },
    { id: id('rtp'), category: 'custody_events', activeDays: 365, archiveDays: 3650, deletion: 'retain', status: 'pending_legal_review' },
    { id: id('rtp'), category: 'financial_records', activeDays: 730, archiveDays: 3650, deletion: 'retain', status: 'approved' },
    { id: id('rtp'), category: 'pod_photos', activeDays: 180, archiveDays: 1095, deletion: 'delete', status: 'pending_legal_review' },
    { id: id('rtp'), category: 'audit_events', activeDays: 365, archiveDays: 3650, deletion: 'retain', status: 'approved' },
    { id: id('rtp'), category: 'gateway_raw_messages', activeDays: 30, archiveDays: 365, deletion: 'delete', status: 'pending_legal_review' },
  );
  db.legalHolds.push({ id: id('lh'), subjectType: 'shipment', subjectId: oldDelivered[1]?.id ?? db.shipments[0].id, reason: 'مطالبة CL-2026-0031 — حفظ الأدلة', openedAt: t(-24 * 8), releasedAt: null, authorizedBy: U.compliance.id });
  db.legalHolds.push({ id: id('lh'), subjectType: 'shipment', subjectId: tagged.lost.id, reason: 'تحقيق اشتباه فقدان QI-2026-0141', openedAt: t(-1), releasedAt: null, authorizedBy: U.compliance.id });
  db.archiveRuns.push({ id: id('arc'), ranAt: t(-24), examined: 18_420, archived: 17_960, skippedForHold: 460, by: U.admin.id });

  // الإعدادات بإصدارات (ADM-002)
  const cfg = (key: string, version: number, value: unknown, status: T.ConfigVersion['status'], at: number) => db.configVersions.push({ id: id('cfg'), key, version, value, status, effectiveAt: t(at), requestedBy: U.admin.id, approvedBy: status === 'active' || status === 'superseded' ? U.approver.id : null, createdAt: t(at - 48) });
  cfg('sla.pickup_window_minutes', 1, 120, 'active', -24 * 60);
  cfg('sla.stat_delivery_hours', 1, 3, 'superseded', -24 * 90); cfg('sla.stat_delivery_hours', 2, 2.5, 'active', -24 * 20);
  cfg('device.low_battery_pct', 1, 20, 'active', -24 * 60); cfg('device.offline_after_minutes', 1, 15, 'active', -24 * 60);
  cfg('approvals.credit_note_threshold_sar', 1, 1000, 'active', -24 * 60);
  cfg('device.low_battery_pct', 2, 25, 'pending_approval', 24 * 5);
  cfg('cities.active', 1, ['RUH', 'JED', 'DMM', 'MKK', 'MED', 'AHB'], 'active', -24 * 30);

  // صندوق الاعتمادات (موحّد)
  const ar = (kind: T.ApprovalRequest['kind'], subjectId: string, title: T.L, requestedBy: string, requiredRole: T.RoleCode, hoursAgo: number) => db.approvalRequests.push({ id: id('apr'), kind, subjectId, title, requestedBy, requiredRole, status: 'pending', decidedBy: null, decidedAt: null, note: '', createdAt: t(-hoursAgo) });
  ar('credit_note', 'cn_0002', L('اعتماد إشعار دائن CN-2026-00013', 'Approve credit note CN-2026-00013'), U.finance.id, 'finance_approver', 5);
  ar('rate_plan', 'rp_std_v4', L('اعتماد التعرفة القياسية — الإصدار 4', 'Approve Standard Tariff v4'), U.finance.id, 'finance_approver', 72);
  ar('config', db.configVersions.find((c) => c.status === 'pending_approval')!.id, L('تغيير حد البطارية المنخفضة إلى 25%', 'Change low-battery threshold to 25%'), U.admin.id, 'super_admin', 20);
  const stApproved = db.settlements.find((s) => s.status === 'reconciled')!;
  ar('settlement', stApproved.id, L(`اعتماد تسوية ${stApproved.settlementNo}`, `Approve settlement ${stApproved.settlementNo}`), U.finance.id, 'finance_approver', 30);
  ar('lost_declaration', tagged.lost.id, L(`إعلان فقدان ${tagged.lost.trackingNo} — يتطلب العمليات والجودة`, `Declare ${tagged.lost.trackingNo} lost — needs operations and quality`), U.ops.id, 'quality', 1);
  ar('claim_resolution', 'clm_0004', L('قرار المطالبة CL-2026-0029', 'Resolve claim CL-2026-0029'), U.quality.id, 'finance_approver', 10);

  // أوامر الأجهزة ورسائل البوابة (محاكاة)
  db.deviceCommands.push(
    { id: id('cmd'), deviceId: devOfBox('box_013').id, commandType: 'reboot', params: '', requestedBy: U.iot.id, approvedBy: U.admin.id, status: 'expired', requestedAt: t(-48), ackAt: null, simulated: true },
    { id: id('cmd'), deviceId: devOfBox('box_011').id, commandType: 'request_position', params: '', requestedBy: U.iot.id, approvedBy: null, status: 'pending_approval', requestedAt: t(-2), ackAt: null, simulated: true },
    { id: id('cmd'), deviceId: devOfBox('box_002').id, commandType: 'set_interval', params: 'interval=300s', requestedBy: U.iot.id, approvedBy: U.admin.id, status: 'acked', requestedAt: t(-30), ackAt: t(-29.9), simulated: true },
  );
  for (let i = 0; i < 40; i++) {
    const d = db.devices[i % 30];
    const status: T.GatewayMessage['parseStatus'] = i % 13 === 5 ? 'duplicate' : 'parsed';
    db.gatewayMessages.push({ id: id('gwm'), deviceId: d.id, imei: d.imei, receivedAt: t(-i * 0.05), transport: 'tcp', sha256: fingerprint([i, 'gw']) + fingerprint([i, 'x']), parseStatus: status, reason: status === 'duplicate' ? 'تكرار بنفس رقم التسلسل — لا أثر تجاري' : null, replayed: false, simulated: true });
  }
  db.gatewayMessages.push(
    { id: id('gwm'), deviceId: null, imei: '869999000000001', receivedAt: t(-0.7), transport: 'udp', sha256: fingerprint('unk1') + fingerprint('unk2'), parseStatus: 'quarantined', reason: 'IMEI غير مسجّل — عزل (SEC-005)', replayed: false, simulated: true },
    { id: id('gwm'), deviceId: 'dev_013', imei: db.devices[12].imei, receivedAt: t(-3), transport: 'tcp', sha256: fingerprint('dl1') + fingerprint('dl2'), parseStatus: 'dead_letter', reason: 'فشل التحقق من المجموع الاختباري بعد 5 محاولات', replayed: false, simulated: true },
    { id: id('gwm'), deviceId: 'dev_011', imei: db.devices[10].imei, receivedAt: t(-19.1), transport: 'tcp', sha256: fingerprint('dl3') + fingerprint('dl4'), parseStatus: 'dead_letter', reason: 'إطار مقطوع (طول غير صالح)', replayed: false, simulated: true },
  );

  // ---------------- الإشعارات والقوالب والتكاملات ----------------
  const tpl: Array<[string, T.Notification['channel'], T.L, T.L]> = [
    ['shipment.created', 'email', L('تم إنشاء الشحنة {tracking}', 'Shipment {tracking} created'), L('استلمنا طلبك وسيتم جدولة الاستلام.', 'We received your request and will schedule pickup.')],
    ['shipment.collected', 'sms', L('تم استلام {tracking}', '{tracking} collected'), L('استلم المندوب شحنتك.', 'The courier has collected your shipment.')],
    ['shipment.delivered', 'push', L('تم تسليم {tracking}', '{tracking} delivered'), L('تم التسليم مع إثبات التسليم.', 'Delivered with proof of delivery.')],
    ['cold_chain.excursion', 'sms', L('تنبيه حرارة {tracking}', 'Temperature alert {tracking}'), L('رُصد انحراف حراري ويجري التحقيق.', 'A temperature excursion was detected and is under review.')],
    ['invoice.issued', 'email', L('فاتورة جديدة {invoice}', 'New invoice {invoice}'), L('صدرت فاتورة جديدة على حسابكم.', 'A new invoice has been issued to your account.')],
    ['delivery.failed', 'sms', L('تعذّر تسليم {tracking}', 'Delivery failed {tracking}'), L('تعذّر التسليم؛ سنتواصل معكم لتحديد الإجراء.', 'Delivery failed; we will contact you about next steps.')],
  ];
  tpl.forEach(([code, ch, s, b], i) => db.templates.push({ id: `tpl_${pad(i + 1, 2)}`, code, channel: ch, subject: s, body: b, active: true }));
  const notify = (userId: string | null, organizationId: string | null, audience: T.Notification['audience'], title: T.L, body: T.L, link: string | null, critical: boolean, hoursAgo: number, read = false) =>
    db.notifications.push({ id: id('ntf'), userId, organizationId, audience, channel: 'in_app', templateCode: 'manual', title, body, link, critical, readAt: read ? t(-hoursAgo + 0.1) : null, createdAt: t(-hoursAgo), deliveryStatus: 'simulated_sent' });
  notify(null, null, 'staff', L(`انحراف حراري — ${exc.trackingNo}`, `Temperature excursion — ${exc.trackingNo}`), L('الصندوق BX-CS-004 تجاوز ‎+8 °م لمدة 45 دقيقة', 'Box BX-CS-004 exceeded +8 °C for 45 minutes'), `/shipments/${exc.id}`, true, 1.5);
  notify(null, null, 'staff', L(`اشتباه فقدان — ${tagged.lost.trackingNo}`, `Suspected loss — ${tagged.lost.trackingNo}`), L('يتطلب اعتماد العمليات والجودة', 'Requires operations and quality approval'), `/shipments/${tagged.lost.id}`, true, 0.8);
  notify(null, null, 'staff', L('ترخيص الأفق للشحن الجوي ينتهي خلال 18 يوماً', 'Al-Ufuq air license expires in 18 days'), L('GACA-DG-4410', 'GACA-DG-4410'), '/compliance/licenses', false, 6);
  notify(U.corpAdmin.id, NKH.id, 'customer', L(`شحنتك ${tagged.air.trackingNo} على متن الرحلة`, `${tagged.air.trackingNo} is on its flight`), L('آخر موقع مؤكد: مطار الملك خالد الدولي', 'Last confirmed position: King Khalid International Airport'), `/shipments/${tagged.air.id}`, false, 1.2);
  notify(U.corpFinance.id, NKH.id, 'customer', L('فاتورة جديدة صادرة', 'New invoice issued'), L(nkhInv.invoiceNo, nkhInv.invoiceNo), `/invoices/${nkhInv.id}`, false, 24 * 1.5, true);
  notify(U.individual.id, individuals[0].id, 'customer', L('تم تأكيد طلبك', 'Your request is confirmed'), L(tagged.individual_active.trackingNo, tagged.individual_active.trackingNo), `/shipments/${tagged.individual_active.id}`, false, 2);
  notify(U.courier1.id, null, 'courier', L('مهمة STAT جديدة', 'New STAT task'), L(`استلام ${tagged.courier_pickup.trackingNo} من فرع العليا`, `Pick up ${tagged.courier_pickup.trackingNo} at Olaya`), `/tasks/${tagged.courier_pickup.id}`, true, 0.3);
  notify(U.lab.id, orgByCode.NRL.id, 'customer', L('شحنة واردة قريباً', 'Inbound shipment arriving'), L(tagged.courier_deliver.trackingNo, tagged.courier_deliver.trackingNo), `/inbound/${tagged.courier_deliver.id}`, false, 0.5);
  db.users.forEach((u) => (['in_app', 'email', 'sms', 'push'] as const).forEach((ch) => db.notificationPrefs.push({ id: id('npf'), userId: u.id, channel: ch, enabled: ch !== 'sms' || u.mfaEnabled })));
  db.integrations.push(
    { id: 'int_pay', code: 'payment', name: L('بوابة الدفع', 'Payment gateway'), kind: 'payment', status: 'simulated', note: L('محاكاة — مزود الدفع غير محدد (OD-006)', 'Simulated — provider not selected (OD-006)') },
    { id: 'int_zatca', code: 'zatca', name: L('الفوترة الإلكترونية ZATCA', 'ZATCA e-invoicing'), kind: 'zatca', status: 'simulated', note: L('محاكاة — بانتظار مراجعة الانطباق (FIN-006)', 'Simulated — applicability review pending (FIN-006)') },
    { id: 'int_sms', code: 'sms', name: L('الرسائل النصية', 'SMS'), kind: 'sms', status: 'simulated', note: L('محاكاة — لا يتم إرسال رسائل فعلية', 'Simulated — no real messages sent') },
    { id: 'int_email', code: 'email', name: L('البريد الإلكتروني', 'Email'), kind: 'email', status: 'simulated', note: L('محاكاة', 'Simulated') },
    { id: 'int_push', code: 'push', name: L('إشعارات الجوال', 'Mobile push'), kind: 'push', status: 'simulated', note: L('محاكاة — يتطلب FCM/APNs عند الإنتاج', 'Simulated — FCM/APNs needed for production') },
    { id: 'int_ufuq', code: 'carrier_ufuq', name: L('واجهة الأفق للشحن الجوي', 'Al-Ufuq carrier API'), kind: 'carrier', status: 'simulated', note: L('أحداث الناقل مولّدة تجريبياً (OD-007)', 'Carrier events generated for demo (OD-007)') },
    { id: 'int_maps', code: 'maps', name: L('الخرائط', 'Maps'), kind: 'maps', status: 'not_configured', note: L('خريطة متجهية داخلية؛ لا مزود خرائط معتمد', 'Internal vector map; no approved map provider') },
    { id: 'int_fhir', code: 'fhir', name: L('محوّل HL7/FHIR', 'HL7/FHIR adapter'), kind: 'fhir', status: 'planned_phase_2', note: L('مرحلة لاحقة (INT-003)', 'Later phase (INT-003)') },
  );
  db.webhooks.push({ id: id('whk'), organizationId: NKH.id, url: 'https://lis.nukhba.demo/hooks/medlog', events: ['shipment.delivered', 'cold_chain.excursion_detected'], secretMasked: 'whsec_••••3f9a', status: 'active', lastDeliveryAt: t(-2), failures: 0, simulated: true });
  db.apiClients.push(
    { id: id('api'), organizationId: NKH.id, partnerId: null, name: 'نظام المختبر LIS — النخبة', keyPrefix: 'mlk_live_7Q2', scopes: ['shipments:read', 'shipments:write'], status: 'active', createdAt: t(-24 * 40) },
    { id: id('api'), organizationId: null, partnerId: P.ufuq.id, name: 'أحداث ناقل الأفق — Al-Ufuq events', keyPrefix: 'mlk_ptr_U8f', scopes: ['carrier-events:write'], status: 'active', createdAt: t(-24 * 90) },
  );

  // التقارير والتنبؤ بالتأخير وبطاقات الأداء والنسخ الاحتياطي
  for (const s of db.shipments.filter((x) => ['in_transit', 'pickup_scheduled'].includes(x.status)).slice(0, 4)) {
    db.delayAlerts.push({ id: id('dla'), shipmentId: s.id, ruleVersion: 'PDA-R1.2', risk: s.id === tagged.offline.id ? 'high' : 'medium', reason: s.id === tagged.offline.id ? L('لا توجد قراءات منذ 70 دقيقة والمسار متأخر عن الخطة 35 دقيقة', 'No readings for 70 min and route is 35 min behind plan') : L('ازدحام متوقع في نافذة الاستلام + مسافة المسار', 'Expected congestion in pickup window + route distance'), raisedAt: t(-0.5), resolvedAt: null, escalated: false });
  }
  for (const p of [P.sahra, P.ufuq, P.sahil, P.hejaz]) for (let w = 0; w < 6; w++) db.scorecards.push({ id: id('scr'), partnerId: p.id, periodStart: t(-24 * 7 * (w + 1)), periodEnd: t(-24 * 7 * w), ruleVersion: 'PPS-W2', score: Math.round(p.score + between(-4, 4)), onTimePct: Math.round(between(84, 98)), tempCompliancePct: Math.round(between(93, 100)), incidents: Math.floor(between(0, p.code === 'SAHIL' ? 4 : 2)), shipments: Math.floor(between(20, 90)) });
  for (let i = 0; i < 14; i++) db.backups.push({ id: id('bkp'), kind: i % 7 === 3 ? 'restore_drill' : 'snapshot', at: t(-24 * i - 3), status: i === 9 ? 'failed' : 'success', durationMin: Math.round(between(6, 22)), rpoMin: i % 7 === 3 ? 12 : null, rtoMin: i % 7 === 3 ? 96 : null, simulated: true });
  db.sessions.push({ id: id('ses'), userId: U.admin.id, device: 'Chrome / macOS', ip: '10.20.0.14', createdAt: t(-2), lastSeenAt: t(-0.1), revokedAt: null }, { id: id('ses'), userId: U.ops.id, device: 'Edge / Windows', ip: '10.20.0.31', createdAt: t(-6), lastSeenAt: t(-0.05), revokedAt: null }, { id: id('ses'), userId: U.finance.id, device: 'Safari / iPadOS', ip: '10.20.0.52', createdAt: t(-28), lastSeenAt: t(-20), revokedAt: null });
  db.recurrings.push({ id: 'rec_0001', organizationId: NKH.id, branchId: 'br_nkh_oly', template: { thermalClass: 'chilled', serviceLevel: 'standard', senderAddressId: A('nkh', 'oly').id, receiverAddressId: nrlAddr.id, receiverOrgId: orgByCode.NRL.id }, rrule: 'weekdays', time: '09:00', active: true, nextRunAt: t(20), createdBy: U.branchOp.id });

  // سجل تدقيق أولي
  // مزامنة عدّادات المعرّفات مع المعرّفات المكتوبة يدوياً حتى لا يتصادم المحرك معها لاحقاً
  for (const [k, v] of Object.entries(db)) if (k !== 'meta') for (const row of v as { id?: string }[]) { const m = /^([a-z]+)_(\d+)$/.exec(row.id ?? ''); if (m) counters['id:' + m[1]] = Math.max(counters['id:' + m[1]] ?? 0, Number(m[2])); }
  counters.contract = Math.max(counters.contract ?? 0, 6);
  db.audit.push({ id: id('aud'), actorId: U.admin.id, action: 'system.seeded', entityType: 'system', entityId: null, occurredAt: iso(now), requestId: 'seed', summary: 'تهيئة بيانات العرض التجريبية', onBehalfOrgId: null });
  return db;
}
