// الانحرافات والحوادث و CAPA والمطالبات — M03/M09
import type * as T from './types';
import { defineCommand, must, type Ctx } from './engine';
import { canReadShipment, customerOrgIds, isStaff } from './access';
import { DAY, iso, sar } from './util';

const L = (ar: string, en: string) => ({ ar, en });
const exc = (ctx: Ctx, id: string) => must(ctx, ctx.db.excursions.find((e) => e.id === id), 'excursion');
const inc = (ctx: Ctx, id: string) => must(ctx, ctx.db.incidents.find((e) => e.id === id || e.code === id), 'incident');

defineCommand<{ id: string; note?: string }, T.Excursion>({
  name: 'excursion.acknowledge', guard: ['ops_controller', 'quality'], desc: L('إقرار العمليات بالانحراف (TEMP-004)', 'Operations acknowledgment (TEMP-004)'),
  run(ctx, { id, note }) {
    const e = exc(ctx, id); if (e.status !== 'open') ctx.fail('ALREADY_ACKNOWLEDGED', 'تم الإقرار مسبقاً', 'Already acknowledged', 409);
    e.status = 'acknowledged'; e.acknowledgedBy = ctx.actor.user.id;
    ctx.audit('excursion.acknowledge', 'excursion', e.id, note ?? 'إقرار'); return e;
  },
});

defineCommand<{ id: string; decision: string; openIncident: boolean; severity?: T.Incident['severity'] }, T.Excursion>({
  name: 'excursion.qualityReview', guard: ['quality'], desc: L('مراجعة الجودة — قرار نقل لا قرار سريري', 'Quality review — transport decision, not clinical'),
  run(ctx, { id, decision, openIncident, severity }) {
    const e = exc(ctx, id);
    if (e.status === 'open') ctx.fail('NOT_ACKNOWLEDGED', 'يجب إقرار العمليات أولاً', 'Operations must acknowledge first', 422);
    if (!decision?.trim()) ctx.fail('VALIDATION', 'نص القرار مطلوب', 'Decision text required', 422, 'decision');
    if (/صالح(ة)? سريري|clinically (fit|acceptable)/i.test(decision)) ctx.fail('CLINICAL_DECISION_FORBIDDEN', 'لا يجوز للمشغّل إصدار حكم سريري؛ القرار للمؤسسة المستلمة (TEMP-006)', 'Operator cannot issue a clinical verdict; it belongs to the receiving institution (TEMP-006)', 422, 'decision');
    e.reviewDecision = decision; e.status = openIncident ? 'under_review' : 'closed';
    const sh = ctx.db.shipments.find((s) => s.id === e.shipmentId)!;
    if (openIncident) {
      const i: T.Incident = { id: ctx.id('inc'), code: `QI-2026-${ctx.seq('qi', 4)}`, shipmentId: sh.id, incidentType: 'temperature', severity: severity ?? (e.severity === 'critical' ? 'critical' : e.severity === 'major' ? 'high' : 'medium'), status: 'investigating', title: L(`انحراف حراري ${sh.trackingNo} — ذروة ${e.peakC} °م`, `Temperature excursion ${sh.trackingNo} — peak ${e.peakC} °C`), findings: decision, openedAt: ctx.nowIso, closedAt: null, ownerId: ctx.actor.user.id };
      ctx.db.incidents.push(i); e.incidentId = i.id;
      ctx.emit('quality.incident_opened', 'incident', i.id, sh.organizationId);
    }
    ctx.audit('excursion.quality_review', 'excursion', e.id, decision); return e;
  },
});

defineCommand<{ shipmentId?: string | null; incidentType: T.Incident['incidentType']; severity: T.Incident['severity']; titleAr: string; titleEn?: string; findings?: string }, T.Incident>({
  name: 'incident.open', guard: ['quality', 'ops_controller', 'courier'], desc: L('فتح حادثة جودة (QMS-001)', 'Open quality incident (QMS-001)'),
  run(ctx, i) {
    if (!i.titleAr?.trim()) ctx.fail('VALIDATION', 'العنوان مطلوب', 'Title required', 422, 'titleAr');
    if (i.shipmentId) { const sh = must(ctx, ctx.db.shipments.find((s) => s.id === i.shipmentId), 'shipment'); if (!canReadShipment(ctx.db, ctx.actor, sh)) ctx.fail('NOT_FOUND', 'الشحنة غير موجودة', 'Not found', 404); }
    const x: T.Incident = { id: ctx.id('inc'), code: `QI-2026-${ctx.seq('qi', 4)}`, shipmentId: i.shipmentId ?? null, incidentType: i.incidentType, severity: i.severity, status: 'open', title: L(i.titleAr, i.titleEn || i.titleAr), findings: i.findings ?? '', openedAt: ctx.nowIso, closedAt: null, ownerId: ctx.actor.user.id };
    ctx.db.incidents.push(x);
    ctx.emit('quality.incident_opened', 'incident', x.id, null);
    ctx.notify({ audience: 'staff', critical: ['high', 'critical'].includes(x.severity), title: L(`حادثة جديدة ${x.code}`, `New incident ${x.code}`), body: x.title, link: `/quality/incidents/${x.id}` });
    return x;
  },
});

defineCommand<{ id: string; findings: string; next: 'investigating' | 'decision' | 'closed' }, T.Incident>({
  name: 'incident.update', guard: ['quality'], desc: L('تحديث التحقيق والقرار', 'Update investigation and decision'),
  run(ctx, { id, findings, next }) {
    const x = inc(ctx, id);
    const order = ['open', 'investigating', 'decision', 'closed'];
    if (order.indexOf(next) <= order.indexOf(x.status)) ctx.fail('INVALID_STATE', 'لا يمكن الرجوع في حالة الحادث', 'Incident status cannot go backwards', 422);
    if (next === 'closed' && x.severity !== 'low' && !ctx.db.capas.some((c) => c.incidentId === x.id)) ctx.fail('CAPA_REQUIRED', 'أضف إجراء CAPA واحداً على الأقل قبل الإغلاق', 'Add at least one CAPA action before closing', 422);
    if (next === 'closed' && x.incidentType === 'suspected_lost' && !['declared', 'recovered', 'none'].includes(ctx.db.shipments.find((s) => s.id === x.shipmentId)?.lostState ?? 'none')) ctx.fail('LOSS_UNRESOLVED', 'لا يُغلق حادث الفقدان قبل القرار المشترك أو الاسترداد', 'Cannot close loss incident before joint decision or recovery', 422);
    x.findings = findings || x.findings; x.status = next; if (next === 'closed') { x.closedAt = ctx.nowIso; ctx.emit('quality.incident_closed', 'incident', x.id, null); }
    ctx.audit('incident.update', 'incident', x.id, `${next}: ${findings}`); return x;
  },
});

defineCommand<{ incidentId: string; actionType: T.Capa['actionType']; description: string; ownerId: string; dueAt: string }, T.Capa>({
  name: 'capa.create', guard: ['quality'], desc: L('إضافة إجراء تصحيحي/وقائي', 'Add corrective/preventive action'),
  run(ctx, i) {
    inc(ctx, i.incidentId);
    if (!i.description?.trim()) ctx.fail('VALIDATION', 'الوصف مطلوب', 'Description required', 422, 'description');
    if (!ctx.db.users.some((u) => u.id === i.ownerId)) ctx.fail('VALIDATION', 'المالك غير معروف', 'Unknown owner', 422, 'ownerId');
    if (!(Date.parse(i.dueAt) > ctx.now)) ctx.fail('VALIDATION', 'الموعد يجب أن يكون مستقبلاً', 'Due date must be in the future', 422, 'dueAt');
    const c: T.Capa = { id: ctx.id('capa'), incidentId: i.incidentId, actionType: i.actionType, description: i.description, ownerId: i.ownerId, dueAt: iso(Date.parse(i.dueAt)), completedAt: null, status: 'open' };
    ctx.db.capas.push(c); ctx.audit('capa.create', 'capa', c.id, i.description); return c;
  },
});
defineCommand<{ id: string; note: string }, T.Capa>({
  name: 'capa.complete', guard: ['quality', 'ops_controller', 'iot_engineer', 'super_admin'], desc: L('إكمال إجراء تصحيحي ووقائي (CAPA)', 'Complete CAPA action'),
  run(ctx, { id, note }) { const c = must(ctx, ctx.db.capas.find((x) => x.id === id), 'capa'); if (c.status === 'done') ctx.fail('ALREADY_DONE', 'مكتمل مسبقاً', 'Already completed', 409); c.status = 'done'; c.completedAt = ctx.nowIso; ctx.audit('capa.complete', 'capa', c.id, note); return c; },
});

// ---------------- المطالبات (CLM-001..015) ----------------
defineCommand<{ shipment: string; claimType: T.Claim['claimType']; amountSar: number; description: string; evidence?: string[] }, T.Claim>({
  name: 'claim.submit', guard: 'any', desc: L('تقديم مطالبة', 'Submit claim'),
  run(ctx, i) {
    const sh = must(ctx, ctx.db.shipments.find((s) => s.id === i.shipment || s.trackingNo === i.shipment), 'shipment');
    if (!canReadShipment(ctx.db, ctx.actor, sh)) ctx.fail('NOT_FOUND', 'الشحنة غير موجودة', 'Shipment not found', 404);
    if (!isStaff(ctx.actor) && !customerOrgIds(ctx.actor).includes(sh.organizationId)) ctx.fail('FORBIDDEN', 'المطالبة لصاحب الشحنة فقط', 'Only the shipment owner may claim', 403);
    if (!(Number(i.amountSar) > 0)) ctx.fail('VALIDATION', 'المبلغ يجب أن يكون أكبر من صفر', 'Amount must be greater than zero', 422, 'amountSar');
    if (!i.description?.trim() || i.description.trim().length < 10) ctx.fail('VALIDATION', 'صف المطالبة (10 أحرف على الأقل)', 'Describe the claim (min 10 chars)', 422, 'description');
    if (Date.parse(sh.createdAt) < ctx.now - 90 * DAY) ctx.fail('CLAIM_WINDOW_PASSED', 'انقضت مهلة تقديم المطالبة (90 يوماً)', 'Claim window (90 days) has passed', 422);
    const c: T.Claim = { id: ctx.id('clm'), code: `CL-2026-${ctx.seq('claim', 4)}`, shipmentId: sh.id, incidentId: ctx.db.incidents.find((x) => x.shipmentId === sh.id)?.id ?? null, organizationId: sh.organizationId, claimType: i.claimType, status: 'submitted', claimedAmount: sar(Number(i.amountSar)), approvedAmount: null, liability: null, description: i.description, createdAt: ctx.nowIso, evidence: i.evidence ?? [] };
    ctx.db.claims.push(c);
    ctx.notify({ audience: 'staff', title: L(`مطالبة جديدة ${c.code}`, `New claim ${c.code}`), body: L(sh.trackingNo, sh.trackingNo), link: `/quality/claims/${c.id}` });
    ctx.audit('claim.submit', 'claim', c.id, `${c.code} — ${i.amountSar} ر.س`, isStaff(ctx.actor) ? sh.organizationId : null); return c;
  },
});
defineCommand<{ id: string; liability: NonNullable<T.Claim['liability']>; recommendedSar: number; note: string }, T.Claim>({
  name: 'claim.assess', guard: ['quality'], desc: L('تقييم المسؤولية التعاقدية', 'Assess contractual liability'),
  run(ctx, { id, liability, recommendedSar, note }) {
    const c = must(ctx, ctx.db.claims.find((x) => x.id === id), 'claim');
    if (!['submitted', 'investigating'].includes(c.status)) ctx.fail('INVALID_STATE', 'المطالبة مقيّمة مسبقاً', 'Claim already assessed', 422);
    if (recommendedSar < 0 || sar(recommendedSar) > c.claimedAmount) ctx.fail('VALIDATION', 'المبلغ الموصى به بين صفر والمبلغ المطالب', 'Recommended amount must be between 0 and claimed', 422, 'recommendedSar');
    c.liability = liability; c.approvedAmount = sar(recommendedSar); c.status = 'assessed';
    if (!ctx.db.approvalRequests.some((a) => a.kind === 'claim_resolution' && a.subjectId === c.id && a.status === 'pending'))
      ctx.db.approvalRequests.push({ id: ctx.id('apr'), kind: 'claim_resolution', subjectId: c.id, title: L(`قرار المطالبة ${c.code} — ${recommendedSar} ر.س`, `Resolve claim ${c.code} — SAR ${recommendedSar}`), requestedBy: ctx.actor.user.id, requiredRole: 'finance_approver', status: 'pending', decidedBy: null, decidedAt: null, note, createdAt: ctx.nowIso });
    ctx.audit('claim.assess', 'claim', c.id, `${liability}: ${recommendedSar} — ${note}`); return c;
  },
});
defineCommand<{ id: string; note: string }, T.Claim>({
  name: 'claim.investigate', guard: ['quality'], desc: L('بدء التحقيق في المطالبة', 'Start claim investigation'),
  run(ctx, { id, note }) { const c = must(ctx, ctx.db.claims.find((x) => x.id === id), 'claim'); if (c.status !== 'submitted') ctx.fail('INVALID_STATE', 'الحالة غير مناسبة', 'Invalid state', 422); c.status = 'investigating'; ctx.audit('claim.investigate', 'claim', c.id, note); return c; },
});
defineCommand<{ id: string; note: string }, T.Claim>({
  name: 'claim.close', guard: ['quality', 'finance'], desc: L('إغلاق المطالبة', 'Close claim'),
  run(ctx, { id, note }) { const c = must(ctx, ctx.db.claims.find((x) => x.id === id), 'claim'); if (!['approved', 'rejected'].includes(c.status)) ctx.fail('INVALID_STATE', 'يجب البت في المطالبة قبل الإغلاق', 'Claim must be decided before closing', 422); c.status = 'closed'; ctx.audit('claim.close', 'claim', c.id, note); return c; },
});

// ---------------- Phase 17.1 — ملفات حرارية معتمدة حسب نوع العينة واتفاقية الخدمة (TEMP-001، ADM-002) ----------------
// الجودة تقترح، والامتثال يعتمد (فصل مهام). لا يسري الملف على أي شحنة قبل الاعتماد، ولا يُعدَّل ملف معتمد بل يُستبدل بإصدار جديد.
const sameScope = (a: T.ServiceProfile, b: { thermalClass: T.ThermalClass; scope?: T.ServiceProfile['scope'] }) =>
  a.thermalClass === b.thermalClass && (a.scope?.contractId ?? null) === (b.scope?.contractId ?? null) && [...(a.scope?.sampleTypes ?? [])].sort().join(',') === [...(b.scope?.sampleTypes ?? [])].sort().join(',');
defineCommand<{ thermalClass: T.ThermalClass; nameAr: string; nameEn: string; minC: number; maxC: number; toleranceMinutes: number; sampleTypes?: string[]; contractId?: string | null; effectiveFrom: string; basis: string }, T.ServiceProfile>({
  name: 'profile.propose', guard: ['quality'], desc: L('اقتراح ملف حراري (يتطلب اعتماد الامتثال)', 'Propose a temperature profile (requires compliance approval)'),
  run(ctx, i) {
    if (!['chilled', 'frozen', 'ambient'].includes(i.thermalClass)) ctx.fail('VALIDATION', 'فئة حرارية غير صالحة', 'Invalid thermal class', 422, 'thermalClass');
    if (!(Number(i.minC) < Number(i.maxC))) ctx.fail('VALIDATION', 'الحد الأدنى يجب أن يكون أقل من الحد الأعلى', 'Minimum must be below maximum', 422, 'minC');
    if (!(Number(i.toleranceMinutes) >= 0 && Number(i.toleranceMinutes) <= 120)) ctx.fail('VALIDATION', 'مهلة السماح بين 0 و120 دقيقة', 'Tolerance must be 0–120 minutes', 422, 'toleranceMinutes');
    if (!i.basis?.trim()) ctx.fail('VALIDATION', 'المرجع المعتمد مطلوب (متطلب العميل أو قرار الجودة)', 'Approved basis required (customer requirement or quality decision)', 422, 'basis');
    if (i.contractId && !ctx.db.contracts.some((c) => c.id === i.contractId)) ctx.fail('VALIDATION', 'العقد غير موجود', 'Unknown contract', 422, 'contractId');
    const scope = { sampleTypes: (i.sampleTypes ?? []).filter(Boolean), contractId: i.contractId || null };
    const prev = ctx.db.serviceProfiles.filter((p) => sameScope(p, { thermalClass: i.thermalClass, scope }));
    if (prev.some((p) => p.status === 'pending_approval')) ctx.fail('PENDING_EXISTS', 'يوجد اقتراح بانتظار الاعتماد لنفس النطاق', 'A proposal for the same scope is already pending', 409);
    const code = i.thermalClass.toUpperCase() + (scope.contractId ? '-' + scope.contractId.toUpperCase() : '') + (scope.sampleTypes.length ? '-' + scope.sampleTypes.join('+') : '');
    const p: T.ServiceProfile = { id: ctx.id('svc'), code, thermalClass: i.thermalClass, name: L(i.nameAr, i.nameEn), minC: Number(i.minC), maxC: Number(i.maxC), toleranceSeconds: Number(i.toleranceMinutes) * 60, version: Math.max(0, ...prev.map((x) => x.version)) + 1, effectiveFrom: iso(Date.parse(i.effectiveFrom)), effectiveTo: null, approved: false, status: 'pending_approval', scope, proposedBy: ctx.actor.user.id, approvedBy: null, basis: i.basis };
    ctx.db.serviceProfiles.push(p);
    ctx.db.approvalRequests.push({ id: ctx.id('apr'), kind: 'service_profile', subjectId: p.id, title: L(`اعتماد ملف حراري: ${i.nameAr} (${p.minC} إلى ${p.maxC} °م)`, `Approve temperature profile: ${i.nameEn} (${p.minC} to ${p.maxC} °C)`), requestedBy: ctx.actor.user.id, requiredRole: 'compliance', status: 'pending', decidedBy: null, decidedAt: null, note: i.basis, createdAt: ctx.nowIso });
    ctx.audit('profile.propose', 'serviceProfile', p.id, `${p.code} v${p.version} ${p.minC}..${p.maxC}`);
    return p;
  },
});
/** يُستدعى من approval.decide عند اعتماد/رفض ملف حراري */
export function decideProfile(ctx: Ctx, id: string, ok: boolean) {
  const p = must(ctx, ctx.db.serviceProfiles.find((x) => x.id === id), 'service profile');
  if (!ok) { p.status = 'rejected'; ctx.audit('profile.reject', 'serviceProfile', p.id, p.code); return; }
  for (const o of ctx.db.serviceProfiles.filter((x) => x.id !== p.id && x.status === 'active' && sameScope(x, p))) { o.status = 'retired'; o.effectiveTo = p.effectiveFrom; }
  p.status = 'active'; p.approved = true; p.approvedBy = ctx.actor.user.id;
  ctx.audit('profile.approve', 'serviceProfile', p.id, `${p.code} v${p.version} ${p.minC}..${p.maxC}`);
}
