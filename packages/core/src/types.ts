// نموذج المجال — مطابق لكيانات وثيقة ERD V1.0 (أسماء الحقول بصيغة camelCase)
// المبالغ المالية بالهللة (أعداد صحيحة) لتجنّب أخطاء الفاصلة العائمة — FIN-005
export type ID = string;
export type ISO = string; // UTC ISO-8601 — BR-011
export type Halala = number; // 1 SAR = 100 halala

export type Lang = 'ar' | 'en';
export type L = { ar: string; en: string };

// ---------- الهوية والعملاء (M06/M12) ----------
export type RoleCode =
  | 'super_admin' | 'ops_controller' | 'warehouse' | 'quality' | 'finance' | 'finance_approver'
  | 'compliance' | 'iot_engineer' | 'customer_service' | 'executive' | 'courier' | 'partner'
  | 'corp_admin' | 'branch_manager' | 'branch_operator' | 'branch_viewer' | 'corp_finance'
  | 'individual' | 'receiving_lab';

export const STAFF_ROLES: RoleCode[] = ['super_admin', 'ops_controller', 'warehouse', 'quality', 'finance', 'finance_approver', 'compliance', 'iot_engineer', 'customer_service', 'executive'];
export const CUSTOMER_ROLES: RoleCode[] = ['corp_admin', 'branch_manager', 'branch_operator', 'branch_viewer', 'corp_finance', 'individual', 'receiving_lab'];

export interface User { id: ID; email: string; phone: string; name: L; status: 'active' | 'invited' | 'disabled'; mfaEnabled: boolean; lang: Lang; createdAt: ISO }
export interface Membership { id: ID; userId: ID; role: RoleCode; organizationId: ID | null; branchId: ID | null; partnerId?: ID | null; status: 'active' | 'revoked'; createdAt: ISO }
export interface Session { id: ID; userId: ID; device: string; ip: string; createdAt: ISO; lastSeenAt: ISO; revokedAt: ISO | null }

export interface Organization { id: ID; code: string; legalName: L; customerType: 'hospital' | 'laboratory' | 'clinic_group' | 'individual'; status: 'active' | 'suspended'; taxId: string | null; cityCode: string; isReceivingInstitution: boolean; createdAt: ISO }
export interface Branch { id: ID; organizationId: ID; code: string; name: L; cityCode: string; status: 'active' | 'inactive'; createdAt: ISO }
export interface Address { id: ID; organizationId: ID | null; branchId: ID | null; label: L; cityCode: string; district: L; lat: number; lng: number; contactName: string; contactPhone: string; authorized: boolean }
export interface City { code: string; name: L; lat: number; lng: number; active: boolean; hasAirport: boolean }

// ---------- الخدمات وسلسلة التبريد (M03) ----------
export type ThermalClass = 'chilled' | 'frozen' | 'ambient';
export interface ServiceProfile { id: ID; code: string; thermalClass: ThermalClass; name: L; minC: number; maxC: number; toleranceSeconds: number; version: number; effectiveFrom: ISO; effectiveTo: ISO | null; approved: boolean; status: 'draft' | 'pending_approval' | 'active' | 'retired' }
export type ServiceLevel = 'standard' | 'express' | 'stat';

// ---------- الشحنات (M01) ----------
export type ShipmentStatus =
  | 'draft' | 'confirmed' | 'pickup_scheduled' | 'collected' | 'in_transit' | 'at_handover'
  | 'delivered' | 'failed' | 'return_pending' | 'returned' | 'cancelled' | 'exception';
export type RequestType = 'on_demand' | 'scheduled' | 'recurring';

export interface Shipment {
  id: ID; trackingNo: string; qrToken: string; organizationId: ID; branchId: ID | null;
  serviceProfileId: ID; thermalClass: ThermalClass; serviceLevel: ServiceLevel; requestType: RequestType; recurringId: ID | null;
  senderAddressId: ID; receiverAddressId: ID; receiverOrgId: ID | null; originCity: string; destCity: string;
  pickupWindowStart: ISO; pickupWindowEnd: ISO; deliverBy: ISO; status: ShipmentStatus; subStatus: string | null;
  dedicatedBox: boolean; mode: 'road' | 'road_air'; quoteId: ID | null; contractId: ID | null;
  priceTotal: Halala; createdBy: ID; createdOnBehalf: boolean; createdAt: ISO; updatedAt: ISO; version: number;
  lastPosition: { lat: number; lng: number; at: ISO; source: 'device' | 'courier' | 'carrier' | 'manual' } | null;
  eta: { at: ISO | null; confidence: 'high' | 'medium' | 'low' | 'unavailable'; basis: string } | null;
  lostState: 'none' | 'suspected' | 'declared' | 'recovered';
}
export interface ShipmentItem { id: ID; shipmentId: ID; descriptionCode: string; quantity: number; weightKg: number; handlingClass: 'standard' | 'biohazard_cat_b' | 'exempt' }
export interface ShipmentStatusEvent { id: ID; shipmentId: ID; fromStatus: ShipmentStatus | null; toStatus: ShipmentStatus; reason: string; occurredAt: ISO; actorId: ID | null; source: string }
export interface Packing { id: ID; shipmentId: ID; boxId: ID; packedAt: ISO; unpackedAt: ISO | null; packedBy: ID; dedicated: boolean }
export interface Recurring { id: ID; organizationId: ID; branchId: ID | null; template: Partial<Shipment>; rrule: 'daily' | 'weekdays' | 'weekly'; time: string; active: boolean; nextRunAt: ISO; createdBy: ID }
export interface Pod { id: ID; shipmentId: ID; recipientName: string; signature: string; photoRef: string | null; deliveredAt: ISO; verifiedBy: ID; notes: string }
export interface DeliveryAttempt { id: ID; shipmentId: ID; attemptedAt: ISO; outcome: 'failed' | 'success'; reasonCode: string; notes: string; courierId: ID | null }
export interface ReturnOrder { id: ID; shipmentId: ID; reasonCode: string; decision: 'retry' | 'alternate_destination' | 'qualified_hold' | 'return_to_sender' | null; responsibleParty: 'customer' | 'company' | 'partner' | null; requestedBy: ID; authorizedBy: ID | null; status: 'requested' | 'authorized' | 'in_progress' | 'completed' | 'rejected'; alternateAddressId: ID | null; costHalala: Halala; createdAt: ISO; completedAt: ISO | null }

// ---------- النقل (M04) ----------
export interface Partner { id: ID; code: string; name: L; partnerType: 'road' | 'air' | 'warehouse'; status: 'active' | 'blocked' | 'suspended'; settlementCycle: 'weekly' | 'monthly'; cities: string[]; score: number; contact: string }
export interface Courier { id: ID; userId: ID | null; partnerId: ID | null; name: L; employmentType: 'employee' | 'partner'; status: 'available' | 'on_route' | 'off_shift' | 'suspended'; cityCode: string; qualified: boolean; qualificationExpiry: ISO; vehicleId: ID | null; phone: string; lastPosition: { lat: number; lng: number; at: ISO } | null }
export interface Vehicle { id: ID; partnerId: ID | null; registration: string; type: L; refrigerated: boolean; qualificationStatus: 'qualified' | 'expired' | 'pending'; qualificationExpiry: ISO; cityCode: string }
export interface Route { id: ID; code: string; serviceDate: ISO; originCity: string; destCity: string; status: 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled'; courierId: ID | null; vehicleId: ID | null; plannedDistanceKm: number; createdAt: ISO }
export interface RouteStop { id: ID; routeId: ID; seq: number; addressId: ID; stopType: 'pickup' | 'delivery' | 'handover' | 'warehouse'; shipmentIds: ID[]; plannedAt: ISO; actualAt: ISO | null; status: 'pending' | 'done' | 'skipped' }
export interface TransportLeg { id: ID; routeId: ID | null; mode: 'road' | 'air'; partnerId: ID | null; courierId: ID | null; vehicleId: ID | null; originCity: string; destCity: string; flightNo: string | null; scheduledDeparture: ISO; scheduledArrival: ISO; actualDeparture: ISO | null; actualArrival: ISO | null; status: 'planned' | 'departed' | 'arrived' | 'cancelled' }
export interface ShipmentLeg { id: ID; shipmentId: ID; legId: ID; seq: number; loadedAt: ISO | null; unloadedAt: ISO | null }
export type CustodianType = 'customer' | 'courier' | 'warehouse' | 'partner' | 'air_carrier' | 'recipient';
export interface CustodyEvent { id: ID; shipmentId: ID; boxId: ID | null; fromType: CustodianType; fromId: ID; toType: CustodianType; toId: ID; eventType: 'pickup' | 'handover' | 'delivery' | 'return' | 'warehouse_in' | 'warehouse_out'; occurredAt: ISO; receivedAt: ISO; evidence: { signedBy: string; method: 'signature' | 'qr' | 'pin' }; source: 'courier_app' | 'admin' | 'carrier_api' | 'offline_sync'; actorId: ID; lat: number | null; lng: number | null }
export interface CarrierEvent { id: ID; partnerId: ID; legId: ID; externalEventId: string; eventType: 'accepted' | 'loaded' | 'departed' | 'arrived' | 'unloaded' | 'released'; occurredAt: ISO; receivedAt: ISO; simulated: true }

// ---------- الأصول و IoT (M02/M08) ----------
export type BoxSize = 'S' | 'M' | 'L';
export type BoxStatus = 'available' | 'assigned' | 'in_use' | 'returning' | 'cleaning' | 'inspection' | 'maintenance' | 'partner_custody' | 'retired';
export interface Box { id: ID; code: string; size: BoxSize; thermalClass: ThermalClass; capacity: number; qualificationStatus: 'qualified' | 'expired' | 'failed'; qualificationExpiry: ISO; condition: 'good' | 'worn' | 'damaged'; status: BoxStatus; custodianType: CustodianType; custodianId: ID; locationCity: string; createdAt: ISO }
export interface BoxQualification { id: ID; boxId: ID; qualificationType: 'thermal_mapping' | 'inspection' | 'cleaning'; result: 'pass' | 'fail'; effectiveAt: ISO; expiresAt: ISO | null; by: ID }
export interface BoxMovement { id: ID; boxId: ID; fromLocation: string; toLocation: string; custodian: string; eventAt: ISO; kind: 'issue' | 'return' | 'transfer' | 'cleaning' | 'inspection' | 'partner_handover' | 'partner_return' }
export type DeviceState = 'ready' | 'assigned' | 'low_battery' | 'offline' | 'maintenance' | 'faulty' | 'suspended' | 'retired';
export interface Device { id: ID; imei: string; model: 'GPT45-M'; firmware: string; simIccidMasked: string; state: DeviceState; lastSeenAt: ISO | null; batteryPct: number | null; lastTempC: number | null; lastFix: { lat: number; lng: number; at: ISO } | null; createdAt: ISO }
export interface DevicePairing { id: ID; boxId: ID; deviceId: ID; pairedAt: ISO; unpairedAt: ISO | null; approvedBy: ID; reason: string }
export interface Reading { id: ID; deviceId: ID; boxId: ID | null; deviceTime: ISO; receivedAt: ISO; tempC: number | null; batteryPct: number | null; lat: number | null; lng: number | null; fixValid: boolean; backfilled: boolean; demo: true }
export interface DeviceHealthEvent { id: ID; deviceId: ID; eventType: 'offline' | 'online' | 'low_battery' | 'sensor_fault' | 'missing_readings'; severity: 'info' | 'warning' | 'critical'; observedAt: ISO }
export interface DeviceCommand { id: ID; deviceId: ID; commandType: 'set_interval' | 'reboot' | 'request_position'; params: string; requestedBy: ID; approvedBy: ID | null; status: 'pending_approval' | 'approved' | 'sent' | 'acked' | 'expired' | 'rejected'; requestedAt: ISO; ackAt: ISO | null; simulated: true }
export interface GatewayMessage { id: ID; deviceId: ID | null; imei: string; receivedAt: ISO; transport: 'tcp' | 'udp'; sha256: string; parseStatus: 'parsed' | 'quarantined' | 'dead_letter' | 'duplicate'; reason: string | null; replayed: boolean; simulated: true }

// ---------- الجودة (M03/M09) ----------
export interface Excursion { id: ID; shipmentId: ID; boxId: ID; deviceId: ID; profileId: ID; startedAt: ISO; endedAt: ISO | null; peakC: number; severity: 'minor' | 'major' | 'critical'; status: 'open' | 'acknowledged' | 'under_review' | 'closed'; acknowledgedBy: ID | null; reviewDecision: string | null; incidentId: ID | null }
export interface Incident { id: ID; code: string; shipmentId: ID | null; incidentType: 'temperature' | 'custody_break' | 'damage' | 'suspected_lost' | 'delay' | 'device'; severity: 'low' | 'medium' | 'high' | 'critical'; status: 'open' | 'investigating' | 'decision' | 'closed'; title: L; findings: string; openedAt: ISO; closedAt: ISO | null; ownerId: ID }
export interface Capa { id: ID; incidentId: ID; actionType: 'corrective' | 'preventive'; description: string; ownerId: ID; dueAt: ISO; completedAt: ISO | null; status: 'open' | 'done' | 'overdue' }
export interface Approval { id: ID; subjectType: string; subjectId: ID; approvalRole: RoleCode; approverId: ID; decision: 'approve' | 'reject'; decidedAt: ISO; note: string }
export interface Claim { id: ID; code: string; shipmentId: ID; incidentId: ID | null; organizationId: ID; claimType: 'damage' | 'loss' | 'delay' | 'temperature'; status: 'submitted' | 'investigating' | 'assessed' | 'approved' | 'rejected' | 'closed'; claimedAmount: Halala; approvedAmount: Halala | null; liability: 'company' | 'partner' | 'customer' | 'none' | null; description: string; createdAt: ISO; evidence: string[] }
export interface ClinicalDisposition { id: ID; shipmentId: ID; institutionId: ID; decision: 'accepted' | 'rejected' | 'accepted_with_note'; decidedAt: ISO; authorizedContact: string; note: string; enteredBy: ID; onBehalf: boolean }

// ---------- المستودع (M10) ----------
export interface Warehouse { id: ID; code: string; name: L; cityCode: string; kind: 'company' | 'partner'; partnerId: ID | null; status: 'active' | 'inactive' }
export interface Consumable { id: ID; sku: string; name: L; unit: L; onHand: number; reorderLevel: number; warehouseId: ID }
export interface ConsumableMovement { id: ID; consumableId: ID; qty: number; kind: 'receipt' | 'issue' | 'adjustment'; at: ISO; by: ID; ref: string }
export interface PartnerCustody { id: ID; boxId: ID; partnerId: ID; warehouseId: ID; handedAt: ISO; returnDueAt: ISO; returnedAt: ISO | null; signedBy: string; status: 'active' | 'returned' | 'overdue' }

// ---------- التجاري والمالي (M05) ----------
export interface Contract { id: ID; contractNo: string; organizationId: ID; billingCycle: 'weekly' | 'monthly' | 'annual'; validFrom: ISO; validTo: ISO; status: 'draft' | 'active' | 'expired' | 'suspended'; ratePlanId: ID; includedShipments: number; usedShipments: number; monthlyFee: Halala }
export interface RateRule { thermalClass: ThermalClass; serviceLevel: ServiceLevel; sameCity: Halala; intercityRoad: Halala; air: Halala; perKg: Halala }
export interface RatePlan { id: ID; code: string; name: L; version: number; status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'superseded'; effectiveFrom: ISO; rules: RateRule[]; approvedBy: ID | null; createdAt: ISO }
export interface Quote { id: ID; quoteNo: string; organizationId: ID; shipmentId: ID | null; snapshot: PriceBreakdown; total: Halala; expiresAt: ISO; status: 'open' | 'accepted' | 'expired' | 'converted'; createdAt: ISO }
export interface PriceBreakdown { base: Halala; weight: Halala; levelSurcharge: Halala; dedicatedBox: Halala; subtotal: Halala; vat: Halala; total: Halala; ratePlanId: ID; ratePlanVersion: number; coveredByContract: boolean }
export interface Simulation { id: ID; name: string; createdBy: ID; createdAt: ISO; ratePlanId: ID; adjustments: { thermalClass: ThermalClass | 'all'; pct: number }[]; result: { currentRevenue: Halala; proposedRevenue: Halala; estimatedCost: Halala; shipmentsAnalysed: number }; status: 'draft' | 'submitted' | 'approved' | 'published'; liveChangesApplied: false }
export interface Invoice { id: ID; invoiceNo: string; organizationId: ID; branchId: ID | null; issueDate: ISO | null; dueDate: ISO | null; periodFrom: ISO; periodTo: ISO; subtotal: Halala; vat: Halala; total: Halala; paid: Halala; status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void'; zatcaStatus: 'not_submitted' | 'simulated_cleared' | 'simulated_rejected'; journalId: ID | null; createdAt: ISO }
export interface InvoiceLine { id: ID; invoiceId: ID; shipmentId: ID | null; description: L; qty: number; unitPrice: Halala; vat: Halala; lineTotal: Halala }
export interface CreditNote { id: ID; creditNo: string; invoiceId: ID; reason: string; amount: Halala; status: 'draft' | 'pending_approval' | 'approved' | 'rejected'; requestedBy: ID; approvedBy: ID | null; journalId: ID | null; createdAt: ISO }
export interface Payment { id: ID; ref: string; direction: 'in' | 'out'; counterpartyType: 'organization' | 'partner'; counterpartyId: ID; amount: Halala; method: 'bank_transfer' | 'card_simulated' | 'sadad_simulated'; status: 'pending' | 'received' | 'reconciled' | 'failed'; bankRef: string | null; receivedAt: ISO; journalId: ID | null; allocated: Halala }
export interface PaymentAllocation { id: ID; paymentId: ID; invoiceId: ID; amount: Halala }
export interface GlAccount { id: ID; code: string; name: L; type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'; parentId: ID | null; active: boolean }
export interface JournalLine { accountId: ID; debit: Halala; credit: Halala; memo: string }
export interface Journal { id: ID; journalNo: string; entryDate: ISO; status: 'draft' | 'posted'; sourceType: string; sourceId: ID | null; description: string; lines: JournalLine[]; postedAt: ISO | null; postedBy: ID | null; reversalOfId: ID | null; reversedById: ID | null; createdAt: ISO }
export interface CostRecord { id: ID; costType: 'courier' | 'vehicle' | 'air_cargo' | 'warehouse' | 'iot' | 'box'; sourceRef: string; estimated: Halala; actual: Halala | null; incurredAt: ISO; allocated: boolean }
export interface AllocationRule { id: ID; code: string; name: L; basis: 'per_shipment' | 'per_kg' | 'per_box_hour'; costType: CostRecord['costType']; version: number; status: 'active' | 'draft'; approvedBy: ID | null }
export interface CostAllocation { id: ID; costRecordId: ID; shipmentId: ID; ruleId: ID; amount: Halala; overrideApprovalId: ID | null; createdAt: ISO }
export interface Settlement { id: ID; settlementNo: string; partnerId: ID; periodStart: ISO; periodEnd: ISO; status: 'draft' | 'reconciled' | 'approved' | 'paid' | 'disputed'; calculated: Halala; partnerInvoiced: Halala | null; approved: Halala | null; approvedBy: ID | null; approvedAt: ISO | null; paymentId: ID | null; lines: { legId: ID; amount: Halala; note: string }[] }

// ---------- الامتثال والحوكمة (M12/M13) ----------
export interface Requirement { id: ID; code: string; description: L; applicability: 'applicable' | 'not_applicable' | 'under_review'; reviewedAt: ISO | null }
export interface License { id: ID; holderType: 'company' | 'partner' | 'vehicle' | 'courier'; holderId: ID; requirementId: ID; licenseNo: string; validFrom: ISO; validTo: ISO; status: 'valid' | 'expiring' | 'expired' | 'pending_verification'; verifiedBy: ID | null }
export interface OperationalBlock { id: ID; scopeType: 'partner' | 'vehicle' | 'courier' | 'route' | 'box' | 'device'; scopeId: ID; reason: string; activeFrom: ISO; resolvedAt: ISO | null; licenseId: ID | null }
export interface RetentionPolicy { id: ID; category: string; activeDays: number; archiveDays: number; deletion: 'delete' | 'anonymize' | 'retain'; status: 'approved' | 'pending_legal_review' }
export interface LegalHold { id: ID; subjectType: string; subjectId: ID; reason: string; openedAt: ISO; releasedAt: ISO | null; authorizedBy: ID }
export interface ArchiveRun { id: ID; ranAt: ISO; examined: number; archived: number; skippedForHold: number; by: ID }
export interface ConfigVersion { id: ID; key: string; version: number; value: unknown; status: 'draft' | 'pending_approval' | 'active' | 'superseded' | 'rejected'; effectiveAt: ISO; requestedBy: ID; approvedBy: ID | null; createdAt: ISO }
export interface ApprovalRequest { id: ID; kind: 'device_exception' | 'credit_note' | 'settlement' | 'rate_plan' | 'config' | 'cost_override' | 'device_command' | 'lost_declaration' | 'claim_resolution'; subjectId: ID; title: L; requestedBy: ID; requiredRole: RoleCode; status: 'pending' | 'approved' | 'rejected'; decidedBy: ID | null; decidedAt: ISO | null; note: string; createdAt: ISO }

// ---------- المنصة (M08/M11/M12/M14) ----------
export interface Notification { id: ID; userId: ID | null; organizationId: ID | null; audience: 'staff' | 'customer' | 'courier'; channel: 'in_app' | 'sms' | 'email' | 'push'; templateCode: string; title: L; body: L; link: string | null; critical: boolean; readAt: ISO | null; createdAt: ISO; deliveryStatus: 'simulated_sent' | 'simulated_failed' | 'queued' }
export interface Template { id: ID; code: string; channel: Notification['channel']; subject: L; body: L; active: boolean }
export interface NotificationPref { id: ID; userId: ID; channel: Notification['channel']; enabled: boolean }
export interface Webhook { id: ID; organizationId: ID | null; url: string; events: string[]; secretMasked: string; status: 'active' | 'paused'; lastDeliveryAt: ISO | null; failures: number; simulated: true }
export interface ApiClient { id: ID; organizationId: ID | null; partnerId: ID | null; name: string; keyPrefix: string; scopes: string[]; status: 'active' | 'revoked'; createdAt: ISO }
export interface Integration { id: ID; code: string; name: L; kind: 'payment' | 'sms' | 'email' | 'push' | 'zatca' | 'carrier' | 'maps' | 'fhir'; status: 'simulated' | 'not_configured' | 'planned_phase_2'; note: L }
export interface AuditEvent { id: ID; actorId: ID | null; action: string; entityType: string; entityId: ID | null; occurredAt: ISO; requestId: string; summary: string; onBehalfOrgId: ID | null }
export interface OutboxEvent { id: ID; eventType: string; aggregateType: string; aggregateId: ID; organizationId: ID | null; occurredAt: ISO; payload: Record<string, unknown>; publishedAt: ISO | null }
export interface DelayAlert { id: ID; shipmentId: ID; ruleVersion: string; risk: 'low' | 'medium' | 'high'; reason: L; raisedAt: ISO; resolvedAt: ISO | null; escalated: boolean }
export interface Scorecard { id: ID; partnerId: ID; periodStart: ISO; periodEnd: ISO; ruleVersion: string; score: number; onTimePct: number; tempCompliancePct: number; incidents: number; shipments: number }
export interface BackupRun { id: ID; kind: 'snapshot' | 'pitr' | 'restore_drill'; at: ISO; status: 'success' | 'failed'; durationMin: number; rpoMin: number | null; rtoMin: number | null; simulated: true }
export interface OfflineConflict { id: ID; clientActionId: string; courierId: ID; shipmentId: ID; action: string; reason: string; occurredAt: ISO; receivedAt: ISO; resolution: 'pending' | 'accepted' | 'rejected' }

export interface Meta { schemaVersion: number; seededAt: ISO; seed: number; idempotency: Record<string, { fingerprint: string; result: unknown; at: ISO }>; counters: Record<string, number> }

export interface Db {
  meta: Meta;
  cities: City[]; users: User[]; memberships: Membership[]; sessions: Session[];
  organizations: Organization[]; branches: Branch[]; addresses: Address[];
  serviceProfiles: ServiceProfile[];
  shipments: Shipment[]; shipmentItems: ShipmentItem[]; statusEvents: ShipmentStatusEvent[]; packings: Packing[]; recurrings: Recurring[];
  pods: Pod[]; deliveryAttempts: DeliveryAttempt[]; returns: ReturnOrder[];
  partners: Partner[]; couriers: Courier[]; vehicles: Vehicle[]; routes: Route[]; routeStops: RouteStop[]; legs: TransportLeg[]; shipmentLegs: ShipmentLeg[]; custody: CustodyEvent[]; carrierEvents: CarrierEvent[];
  boxes: Box[]; boxQualifications: BoxQualification[]; boxMovements: BoxMovement[]; devices: Device[]; pairings: DevicePairing[]; readings: Reading[]; deviceHealth: DeviceHealthEvent[]; deviceCommands: DeviceCommand[]; gatewayMessages: GatewayMessage[];
  excursions: Excursion[]; incidents: Incident[]; capas: Capa[]; approvals: Approval[]; claims: Claim[]; dispositions: ClinicalDisposition[];
  warehouses: Warehouse[]; consumables: Consumable[]; consumableMovements: ConsumableMovement[]; partnerCustody: PartnerCustody[];
  contracts: Contract[]; ratePlans: RatePlan[]; quotes: Quote[]; simulations: Simulation[]; invoices: Invoice[]; invoiceLines: InvoiceLine[]; creditNotes: CreditNote[]; payments: Payment[]; paymentAllocations: PaymentAllocation[]; glAccounts: GlAccount[]; journals: Journal[]; costRecords: CostRecord[]; allocationRules: AllocationRule[]; costAllocations: CostAllocation[]; settlements: Settlement[];
  requirements: Requirement[]; licenses: License[]; blocks: OperationalBlock[]; retentionPolicies: RetentionPolicy[]; legalHolds: LegalHold[]; archiveRuns: ArchiveRun[]; configVersions: ConfigVersion[]; approvalRequests: ApprovalRequest[];
  notifications: Notification[]; templates: Template[]; notificationPrefs: NotificationPref[]; webhooks: Webhook[]; apiClients: ApiClient[]; integrations: Integration[]; audit: AuditEvent[]; outbox: OutboxEvent[]; delayAlerts: DelayAlert[]; scorecards: Scorecard[]; backups: BackupRun[]; offlineConflicts: OfflineConflict[];
}
export type Collection = Exclude<keyof Db, 'meta'>;

// خطأ مجال بالشكل الموحّد في API §1.2
export class DomainError extends Error {
  constructor(public code: string, public status: number, public detail: L, public field?: string) { super(code); }
}
