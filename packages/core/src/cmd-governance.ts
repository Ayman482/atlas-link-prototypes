// الاعتمادات والامتثال والاحتفاظ والإعدادات والمستخدمون والإشعارات والتكاملات — M06/M08/M11/M12/M13
import type * as T from './types';
import { defineCommand, must, type Ctx } from './engine';
import { branchGrants, customerOrgIds, has, isStaff } from './access';
import { applyCreditNote, approveSettlement, postJournal } from './cmd-finance';
import { ACTIVE } from './domain';
import { DAY, HOUR, MIN, iso } from './util';

const L = (ar: string, en: string) => ({ ar, en });

// ---------------- صندوق الاعتمادات الموحّد ----------------
defineCommand<{ id: string; decision: 'approve' | 'reject'; note?: string }, T.ApprovalRequest>({
  name: 'approval.decide', guard: 'staff', desc: L('البت في طلب اعتماد مع فصل المهام', 'Decide approval with segregation of duties'),
  run(ctx, { id, decision, note }) {
    const a = must(ctx, ctx.db.approvalRequests.find((x) => x.id === id), 'approval');
    if (a.status !== 'pending') ctx.fail('ALREADY_DECIDED', 'تم البت مسبقاً', 'Already decided', 409);
    const rolesOk = a.kind === 'lost_declaration' ? has(ctx.actor, 'quality', 'ops_controller') : has(ctx.actor, a.requiredRole);
    if (!rolesOk) ctx.fail('FORBIDDEN', 'هذا الاعتماد يتطلب دوراً آخر', 'This approval requires another role', 403);
    if (a.requestedBy === ctx.actor.user.id && a.kind !== 'lost_declaration') ctx.fail('SEGREGATION_OF_DUTIES', 'لا يجوز اعتماد طلب قدمته بنفسك', 'You cannot approve your own request', 403);
    if (decision === 'reject' && !note?.trim()) ctx.fail('VALIDATION', 'سبب الرفض مطلوب', 'Rejection reason required', 422, 'note');
    if (a.kind === 'lost_declaration') { ctx.exec('lost.approve', { shipment: a.subjectId, decision, note }); return a; }
    a.status = decision === 'approve' ? 'approved' : 'rejected'; a.decidedBy = ctx.actor.user.id; a.decidedAt = ctx.nowIso; a.note = note ?? a.note;
    const ok = decision === 'approve';
    switch (a.kind) {
      case 'credit_note': { const cn = must(ctx, ctx.db.creditNotes.find((c) => c.id === a.subjectId), 'credit note'); if (ok) applyCreditNote(ctx, cn); else cn.status = 'rejected'; break; }
      case 'settlement': { const s = must(ctx, ctx.db.settlements.find((x) => x.id === a.subjectId), 'settlement'); if (ok) approveSettlement(ctx, s); else s.status = 'disputed'; break; }
      case 'rate_plan': { const p = must(ctx, ctx.db.ratePlans.find((x) => x.id === a.subjectId), 'rate plan'); if (ok) { p.status = 'approved'; p.approvedBy = ctx.actor.user.id; } else p.status = 'draft'; break; }
      case 'config': {
        const c = must(ctx, ctx.db.configVersions.find((x) => x.id === a.subjectId), 'config');
        if (ok) { ctx.db.configVersions.filter((x) => x.key === c.key && x.status === 'active').forEach((x) => (x.status = 'superseded')); c.status = 'active'; c.approvedBy = ctx.actor.user.id; if (Date.parse(c.effectiveAt) > ctx.now) c.effectiveAt = ctx.nowIso; }
        else c.status = 'rejected';
        break;
      }
      case 'device_command': { const c = must(ctx, ctx.db.deviceCommands.find((x) => x.id === a.subjectId), 'command'); c.status = ok ? 'approved' : 'rejected'; c.approvedBy = ok ? ctx.actor.user.id : null; break; }
      case 'cost_override': { if (ok) { const [allocId, amt] = a.subjectId.split(':'); const al = must(ctx, ctx.db.costAllocations.find((x) => x.id === allocId), 'allocation'); al.amount = Number(amt); al.overrideApprovalId = a.id; } break; }
      case 'claim_resolution': {
        const c = must(ctx, ctx.db.claims.find((x) => x.id === a.subjectId), 'claim');
        c.status = ok ? 'approved' : 'rejected';
        if (ok && (c.approvedAmount ?? 0) > 0) postJournal(ctx, `قرار المطالبة ${c.code}`, 'claim', c.id, [{ accountId: 'gl_5600', debit: c.approvedAmount!, credit: 0, memo: '' }, { accountId: 'gl_2300', debit: 0, credit: c.approvedAmount!, memo: c.code }]);
        ctx.emit('claim.resolution_approved', 'claim', c.id, c.organizationId, { decision });
        ctx.notify({ audience: 'customer', organizationId: c.organizationId, title: L(`قرار المطالبة ${c.code}`, `Claim decision ${c.code}`), body: L(ok ? `تمت الموافقة على ${((c.approvedAmount ?? 0) / 100).toFixed(2)} ر.س` : 'تم رفض المطالبة', ok ? `Approved SAR ${((c.approvedAmount ?? 0) / 100).toFixed(2)}` : 'Claim rejected'), link: `/claims/${c.id}` });
        break;
      }
      case 'device_exception': break;
    }
    ctx.audit('approval.decide', a.kind, a.subjectId, `${decision}: ${a.title.ar}${note ? ' — ' + note : ''}`);
    const requester = ctx.db.users.find((u) => u.id === a.requestedBy);
    if (requester) ctx.notify({ audience: 'staff', userId: requester.id, title: L(ok ? 'تم اعتماد طلبك' : 'تم رفض طلبك', ok ? 'Your request was approved' : 'Your request was rejected'), body: a.title, link: '/approvals' });
    return a;
  },
});

// ---------------- الامتثال (CMP-001..016 / UAT-013) ----------------
defineCommand<{ holderType: T.License['holderType']; holderId: string; requirementId: string; licenseNo: string; validFrom: string; validTo: string }, T.License>({
  name: 'license.add', guard: ['compliance'], desc: L('إضافة ترخيص/مؤهل', 'Add license/qualification'),
  run(ctx, i) {
    if (!i.licenseNo?.trim()) ctx.fail('VALIDATION', 'رقم الترخيص مطلوب', 'License number required', 422, 'licenseNo');
    if (!(Date.parse(i.validTo) > Date.parse(i.validFrom))) ctx.fail('VALIDATION', 'تاريخ الانتهاء بعد البداية', 'End after start', 422, 'validTo');
    const l: T.License = { id: ctx.id('lic'), holderType: i.holderType, holderId: i.holderId, requirementId: i.requirementId, licenseNo: i.licenseNo, validFrom: iso(Date.parse(i.validFrom)), validTo: iso(Date.parse(i.validTo)), status: 'pending_verification', verifiedBy: null };
    ctx.db.licenses.push(l); ctx.audit('license.add', 'license', l.id, l.licenseNo); return l;
  },
});
defineCommand<{ id: string }, T.License>({
  name: 'license.verify', guard: ['compliance'], desc: L('التحقق من الترخيص', 'Verify license'),
  run(ctx, { id }) {
    const l = must(ctx, ctx.db.licenses.find((x) => x.id === id), 'license');
    l.verifiedBy = ctx.actor.user.id; l.status = Date.parse(l.validTo) < ctx.now ? 'expired' : Date.parse(l.validTo) - ctx.now < 30 * DAY ? 'expiring' : 'valid';
    if (l.status === 'valid' || l.status === 'expiring') resolveBlocksFor(ctx, l);
    ctx.audit('license.verify', 'license', l.id, l.status); return l;
  },
});
defineCommand<{ id: string; newValidTo: string; licenseNo?: string }, T.License>({
  name: 'license.renew', guard: ['compliance'], desc: L('تجديد ترخيص', 'Renew license'),
  run(ctx, { id, newValidTo, licenseNo }) {
    const l = must(ctx, ctx.db.licenses.find((x) => x.id === id), 'license');
    if (!(Date.parse(newValidTo) > ctx.now)) ctx.fail('VALIDATION', 'تاريخ التجديد يجب أن يكون مستقبلاً', 'Renewal date must be in the future', 422, 'newValidTo');
    l.validTo = iso(Date.parse(newValidTo)); if (licenseNo) l.licenseNo = licenseNo; l.status = 'pending_verification'; l.verifiedBy = null;
    ctx.audit('license.renew', 'license', l.id, `حتى ${l.validTo}`); return l;
  },
});
function resolveBlocksFor(ctx: Ctx, l: T.License) {
  const blocks = ctx.db.blocks.filter((b) => !b.resolvedAt && (b.licenseId === l.id || (b.scopeId === l.holderId)));
  blocks.forEach((b) => { b.resolvedAt = ctx.nowIso; });
  if (l.holderType === 'partner') { const p = ctx.db.partners.find((x) => x.id === l.holderId); if (p && p.status === 'blocked') p.status = 'active'; ctx.emit('compliance.eligibility_changed', 'partner', l.holderId, null, { eligible: true }); }
  if (l.holderType === 'vehicle') { const v = ctx.db.vehicles.find((x) => x.id === l.holderId); if (v) { v.qualificationStatus = 'qualified'; v.qualificationExpiry = l.validTo; } }
  if (l.holderType === 'courier') { const c = ctx.db.couriers.find((x) => x.id === l.holderId); if (c) { c.qualified = true; c.qualificationExpiry = l.validTo; } }
}
/** مهمة دورية: حظر الإسنادات الجديدة للمنتهي، وتصعيد الشحنات النشطة بأمان (E9) */
defineCommand<Record<string, never>, { newBlocks: number; escalated: number; expiring: number }>({
  name: 'compliance.runExpiryCheck', guard: ['compliance', 'super_admin'], desc: L('فحص انتهاء التراخيص وتطبيق الحظر', 'Check expiries and apply blocks'),
  run(ctx) {
    let newBlocks = 0, escalated = 0, expiring = 0;
    for (const l of ctx.db.licenses) {
      const left = Date.parse(l.validTo) - ctx.now;
      if (left < 0 && l.status !== 'expired') l.status = 'expired';
      else if (left >= 0 && left < 30 * DAY && l.status === 'valid') { l.status = 'expiring'; expiring++; ctx.notify({ audience: 'staff', title: L(`ترخيص ينتهي قريباً ${l.licenseNo}`, `License expiring ${l.licenseNo}`), body: L(`خلال ${Math.ceil(left / DAY)} يوماً`, `In ${Math.ceil(left / DAY)} days`), link: '/compliance/licenses' }); }
      if (l.status !== 'expired' || l.holderType === 'company') continue;
      const scope = l.holderType as T.OperationalBlock['scopeType'];
      if (ctx.db.blocks.some((b) => b.scopeType === scope && b.scopeId === l.holderId && !b.resolvedAt)) continue;
      ctx.db.blocks.push({ id: ctx.id('blk'), scopeType: scope, scopeId: l.holderId, reason: `انتهاء ${l.licenseNo}`, activeFrom: ctx.nowIso, resolvedAt: null, licenseId: l.id }); newBlocks++;
      if (scope === 'partner') { const p = ctx.db.partners.find((x) => x.id === l.holderId); if (p) p.status = 'blocked'; }
      if (scope === 'vehicle') { const v = ctx.db.vehicles.find((x) => x.id === l.holderId); if (v) v.qualificationStatus = 'expired'; }
      if (scope === 'courier') { const c = ctx.db.couriers.find((x) => x.id === l.holderId); if (c) c.qualified = false; }
      ctx.emit('compliance.eligibility_changed', scope, l.holderId, null, { eligible: false });
      // الشحنات النشطة لا تُترك: تُصعَّد للعمليات
      const affected = ctx.db.shipments.filter((s) => ACTIVE.includes(s.status) && ctx.db.shipmentLegs.some((x) => x.shipmentId === s.id && ctx.db.legs.some((g) => g.id === x.legId && g.status !== 'arrived' && (g.partnerId === l.holderId || g.courierId === l.holderId || g.vehicleId === l.holderId))));
      for (const s of affected) {
        if (!ctx.db.delayAlerts.some((d) => d.shipmentId === s.id && !d.resolvedAt && d.ruleVersion === 'CMP-ESC')) { ctx.db.delayAlerts.push({ id: ctx.id('dla'), shipmentId: s.id, ruleVersion: 'CMP-ESC', risk: 'high', reason: L(`طرف غير مؤهل في مرحلة نقل نشطة (${l.licenseNo}) — تصعيد آمن`, `Unqualified party on active leg (${l.licenseNo}) — safe escalation`), raisedAt: ctx.nowIso, resolvedAt: null, escalated: true }); escalated++; }
      }
      ctx.notify({ audience: 'staff', critical: true, title: L(`حظر تشغيلي: ${l.licenseNo}`, `Operational block: ${l.licenseNo}`), body: L(`${affected.length} شحنات نشطة صُعّدت`, `${affected.length} active shipments escalated`), link: '/compliance/blocks' });
    }
    ctx.audit('compliance.expiry_check', 'compliance', null, `حظر جديد ${newBlocks}، تصعيد ${escalated}`);
    return { newBlocks, escalated, expiring };
  },
});
defineCommand<{ id: string; note: string }, T.OperationalBlock>({
  name: 'block.resolve', guard: ['compliance'], desc: L('رفع حظر بعد تصحيح السبب', 'Lift block after remediation'),
  run(ctx, { id, note }) {
    const b = must(ctx, ctx.db.blocks.find((x) => x.id === id), 'block');
    const lic = b.licenseId ? ctx.db.licenses.find((l) => l.id === b.licenseId) : ctx.db.licenses.find((l) => l.holderId === b.scopeId);
    if (lic && Date.parse(lic.validTo) < ctx.now) ctx.fail('BLOCK_CAUSE_ACTIVE', 'الترخيص ما زال منتهياً؛ جدّده وتحقق منه أولاً', 'License is still expired; renew and verify first', 422);
    b.resolvedAt = ctx.nowIso; if (b.scopeType === 'partner') { const p = ctx.db.partners.find((x) => x.id === b.scopeId); if (p) p.status = 'active'; }
    ctx.audit('block.resolve', 'block', b.id, note); return b;
  },
});
defineCommand<{ id: string; applicability: T.Requirement['applicability'] }, T.Requirement>({
  name: 'requirement.setApplicability', guard: ['compliance'], desc: L('تحديث سجل الانطباق', 'Update applicability register'),
  run(ctx, { id, applicability }) { const r = must(ctx, ctx.db.requirements.find((x) => x.id === id), 'requirement'); r.applicability = applicability; r.reviewedAt = ctx.nowIso; ctx.audit('requirement.applicability', 'requirement', r.id, applicability); return r; },
});

// ---------------- الاحتفاظ والتحفظ القانوني (RETN / UAT-015) ----------------
defineCommand<{ subjectType: string; subjectId: string; reason: string }, T.LegalHold>({
  name: 'legalHold.apply', guard: ['compliance'], desc: L('فرض حجز قانوني', 'Apply legal hold'),
  run(ctx, i) {
    if (!i.reason?.trim()) ctx.fail('VALIDATION', 'السبب مطلوب', 'Reason required', 422, 'reason');
    if (ctx.db.legalHolds.some((h) => h.subjectId === i.subjectId && !h.releasedAt)) ctx.fail('HOLD_EXISTS', 'يوجد حجز نشط', 'Active hold exists', 409);
    const h: T.LegalHold = { id: ctx.id('lh'), subjectType: i.subjectType, subjectId: i.subjectId, reason: i.reason, openedAt: ctx.nowIso, releasedAt: null, authorizedBy: ctx.actor.user.id };
    ctx.db.legalHolds.push(h); ctx.emit('retention.legal_hold_applied', i.subjectType, i.subjectId, null); ctx.audit('legal_hold.apply', i.subjectType, i.subjectId, i.reason); return h;
  },
});
defineCommand<{ id: string; reason: string }, T.LegalHold>({
  name: 'legalHold.release', guard: ['compliance'], desc: L('رفع التحفظ القانوني', 'Release legal hold'),
  run(ctx, { id, reason }) { const h = must(ctx, ctx.db.legalHolds.find((x) => x.id === id), 'hold'); if (h.releasedAt) ctx.fail('ALREADY_RELEASED', 'مرفوع مسبقاً', 'Already released', 409); h.releasedAt = ctx.nowIso; ctx.audit('legal_hold.release', h.subjectType, h.subjectId, reason); return h; },
});
/** مهمة الأرشفة: تتخطى أي عنصر تحت حجز قانوني (DB-AT-008) — لا يُحذف شيء فعلياً في المحاكاة */
defineCommand<{ category: string }, T.ArchiveRun & { heldSubjects: string[] }>({
  name: 'retention.runArchive', guard: ['compliance', 'super_admin'], desc: L('تشغيل الأرشفة مع احترام الحجز', 'Run archive respecting holds'),
  run(ctx, { category }) {
    const pol = must(ctx, ctx.db.retentionPolicies.find((p) => p.category === category), 'policy');
    if (pol.status !== 'approved') ctx.fail('POLICY_NOT_APPROVED', 'السياسة بانتظار المراجعة القانونية؛ لا يُنفّذ حذف أو أرشفة (OD-009)', 'Policy pending legal review; no archive/delete executed (OD-009)', 422);
    const cutoff = ctx.now - pol.activeDays * DAY;
    const held = new Set(ctx.db.legalHolds.filter((h) => !h.releasedAt).map((h) => h.subjectId));
    const candidates = category === 'audit_events' ? ctx.db.audit.filter((a) => Date.parse(a.occurredAt) < cutoff).map((a) => a.entityId ?? a.id) : ctx.db.shipments.filter((s) => Date.parse(s.createdAt) < cutoff).map((s) => s.id);
    const skipped = candidates.filter((c) => held.has(c));
    const run = { id: ctx.id('arc'), ranAt: ctx.nowIso, examined: candidates.length, archived: candidates.length - skipped.length, skippedForHold: skipped.length, by: ctx.actor.user.id };
    ctx.db.archiveRuns.push(run); ctx.audit('retention.archive', 'retention', pol.id, `${category}: ${run.archived} مؤرشف، ${run.skippedForHold} محجوز`);
    return { ...run, heldSubjects: [...held] };
  },
});
defineCommand<{ id: string; activeDays: number; archiveDays: number }, T.RetentionPolicy>({
  name: 'retention.updatePolicy', guard: ['compliance'], desc: L('تعديل سياسة احتفاظ (تعود للمراجعة)', 'Edit retention policy (returns to review)'),
  run(ctx, { id, activeDays, archiveDays }) { const p = must(ctx, ctx.db.retentionPolicies.find((x) => x.id === id), 'policy'); if (!(activeDays > 0 && archiveDays >= activeDays)) ctx.fail('VALIDATION', 'مدة الأرشيف ≥ المدة النشطة', 'Archive days must be ≥ active days', 422); Object.assign(p, { activeDays, archiveDays, status: 'pending_legal_review' }); ctx.audit('retention.policy', 'retention', p.id, `${activeDays}/${archiveDays}`); return p; },
});

// ---------------- الإعدادات بإصدارات (ADM-001/002) ----------------
defineCommand<{ key: string; value: unknown; effectiveAt: string }, T.ConfigVersion>({
  name: 'config.propose', guard: ['super_admin'], desc: L('اقتراح تغيير إعداد (يتطلب اعتماداً)', 'Propose config change (needs approval)'),
  run(ctx, { key, value, effectiveAt }) {
    const prev = ctx.db.configVersions.filter((c) => c.key === key);
    if (!prev.length) ctx.fail('UNKNOWN_KEY', 'مفتاح إعداد غير معروف', 'Unknown config key', 422, 'key');
    if (prev.some((c) => c.status === 'pending_approval')) ctx.fail('PENDING_EXISTS', 'يوجد تغيير معلّق لهذا المفتاح', 'A pending change exists for this key', 409);
    const c: T.ConfigVersion = { id: ctx.id('cfg'), key, version: Math.max(...prev.map((x) => x.version)) + 1, value, status: 'pending_approval', effectiveAt: iso(Date.parse(effectiveAt) || ctx.now), requestedBy: ctx.actor.user.id, approvedBy: null, createdAt: ctx.nowIso };
    ctx.db.configVersions.push(c);
    ctx.db.approvalRequests.push({ id: ctx.id('apr'), kind: 'config', subjectId: c.id, title: L(`تغيير ${key} إلى ${JSON.stringify(value)}`, `Change ${key} to ${JSON.stringify(value)}`), requestedBy: ctx.actor.user.id, requiredRole: 'super_admin', status: 'pending', decidedBy: null, decidedAt: null, note: '', createdAt: ctx.nowIso });
    ctx.audit('config.propose', 'config', c.id, `${key} v${c.version}`); return c;
  },
});
defineCommand<{ code: string; active: boolean }, T.City>({
  name: 'city.setActive', guard: ['super_admin'], desc: L('تفعيل مدينة تدريجياً', 'Gradually activate city'),
  run(ctx, { code, active }) { const c = must(ctx, ctx.db.cities.find((x) => x.code === code), 'city'); c.active = active; ctx.audit('city.active', 'city', code, String(active)); return c; },
});

// ---------------- المستخدمون والعضويات (M06/M12) ----------------
defineCommand<{ email: string; nameAr: string; nameEn: string; role: T.RoleCode; organizationId?: string | null; branchId?: string | null }, T.User>({
  name: 'user.invite', guard: 'any', desc: L('دعوة مستخدم بدور ونطاق', 'Invite user with role and scope'),
  run(ctx, i) {
    const email = i.email?.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? '')) ctx.fail('VALIDATION', 'بريد إلكتروني غير صالح', 'Invalid email', 422, 'email');
    if (!i.nameAr?.trim()) ctx.fail('VALIDATION', 'الاسم مطلوب', 'Name required', 422, 'nameAr');
    const staffRole = !['corp_admin', 'branch_manager', 'branch_operator', 'branch_viewer', 'corp_finance', 'individual', 'receiving_lab'].includes(i.role);
    if (staffRole) ctx.require('super_admin');
    else if (!isStaff(ctx.actor)) {
      // مدير المؤسسة يمنح فقط ضمن نطاقه المفوّض
      if (!i.organizationId || !ctx.actor.memberships.some((m) => m.role === 'corp_admin' && m.organizationId === i.organizationId)) ctx.fail('FORBIDDEN', 'يمكنك الدعوة ضمن مؤسستك فقط', 'You can invite within your organization only', 403);
      if (['corp_admin'].includes(i.role)) ctx.fail('FORBIDDEN', 'لا يمكن منح صلاحية مدير مؤسسة', 'Cannot grant corporate admin', 403);
    }
    if (i.branchId && !ctx.db.branches.some((b) => b.id === i.branchId && b.organizationId === i.organizationId)) ctx.fail('VALIDATION', 'الفرع لا يتبع المؤسسة', 'Branch not in organization', 422, 'branchId');
    let u = ctx.db.users.find((x) => x.email === email);
    if (!u) { u = { id: ctx.id('usr'), email: email!, phone: '', name: L(i.nameAr, i.nameEn || i.nameAr), status: 'invited', mfaEnabled: staffRole, lang: 'ar', createdAt: ctx.nowIso }; ctx.db.users.push(u); }
    if (ctx.db.memberships.some((m) => m.userId === u!.id && m.role === i.role && m.branchId === (i.branchId ?? null) && m.organizationId === (i.organizationId ?? null) && m.status === 'active')) ctx.fail('DUPLICATE', 'العضوية موجودة', 'Membership exists', 409);
    ctx.db.memberships.push({ id: ctx.id('mbr'), userId: u.id, role: i.role, organizationId: i.organizationId ?? null, branchId: i.branchId ?? null, status: 'active', createdAt: ctx.nowIso });
    ctx.audit('user.invite', 'user', u.id, `${email} → ${i.role}${i.branchId ? ' @' + i.branchId : ''}`, i.organizationId ?? null);
    return u;
  },
});
defineCommand<{ membershipId: string }, T.Membership>({
  name: 'membership.revoke', guard: 'any', desc: L('إلغاء عضوية فوراً', 'Revoke membership promptly'),
  run(ctx, { membershipId }) {
    const m = must(ctx, ctx.db.memberships.find((x) => x.id === membershipId), 'membership');
    if (!has(ctx.actor, 'super_admin') && !(m.organizationId && ctx.actor.memberships.some((x) => x.role === 'corp_admin' && x.organizationId === m.organizationId))) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403);
    if (m.userId === ctx.actor.user.id) ctx.fail('FORBIDDEN', 'لا يمكنك إلغاء عضويتك', 'You cannot revoke your own membership', 403);
    m.status = 'revoked';
    ctx.db.sessions.filter((s) => s.userId === m.userId && !s.revokedAt).forEach((s) => (s.revokedAt = ctx.nowIso));
    ctx.audit('membership.revoke', 'membership', m.id, `${m.role}`, m.organizationId); return m;
  },
});
defineCommand<{ userId: string; status: 'active' | 'disabled' }, T.User>({
  name: 'user.setStatus', guard: ['super_admin'], desc: L('تفعيل/تعطيل مستخدم', 'Enable/disable user'),
  run(ctx, { userId, status }) { const u = must(ctx, ctx.db.users.find((x) => x.id === userId), 'user'); if (u.id === ctx.actor.user.id) ctx.fail('FORBIDDEN', 'لا يمكنك تعطيل نفسك', 'Cannot disable yourself', 403); u.status = status; if (status === 'disabled') ctx.db.sessions.filter((s) => s.userId === u.id).forEach((s) => (s.revokedAt = s.revokedAt ?? ctx.nowIso)); ctx.audit('user.status', 'user', u.id, status); return u; },
});
defineCommand<{ enabled: boolean }, T.User>({
  name: 'me.setMfa', guard: 'any', desc: L('تفعيل/إيقاف التحقق بخطوتين', 'Toggle MFA'),
  run(ctx, { enabled }) { if (!enabled && (isStaff(ctx.actor) || ctx.actor.roles.some((r) => ['corp_admin', 'corp_finance', 'receiving_lab'].includes(r)))) ctx.fail('MFA_REQUIRED', 'التحقق بخطوتين إلزامي لدورك (SEC-001)', 'MFA is mandatory for your role (SEC-001)', 422); ctx.actor.user.mfaEnabled = enabled; ctx.audit('user.mfa', 'user', ctx.actor.user.id, String(enabled)); return ctx.actor.user; },
});
defineCommand<{ lang: T.Lang }, T.User>({ name: 'me.setLang', guard: 'any', desc: L('لغة الواجهة', 'UI language'), run(ctx, { lang }) { ctx.actor.user.lang = lang === 'en' ? 'en' : 'ar'; return ctx.actor.user; } });
defineCommand<{ sessionId: string }, T.Session>({
  name: 'session.revoke', guard: 'any', desc: L('إلغاء جلسة', 'Revoke session'),
  run(ctx, { sessionId }) { const s = must(ctx, ctx.db.sessions.find((x) => x.id === sessionId), 'session'); if (s.userId !== ctx.actor.user.id && !has(ctx.actor, 'super_admin')) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403); s.revokedAt = ctx.nowIso; ctx.audit('session.revoke', 'session', s.id, s.device); return s; },
});

// ---------------- المؤسسات والفروع والعناوين (CUST-001..003) ----------------
const orgAdmin = (ctx: Ctx, orgId: string) => { if (!(has(ctx.actor, 'ops_controller', 'customer_service') || ctx.actor.memberships.some((m) => m.role === 'corp_admin' && m.organizationId === orgId))) ctx.fail('FORBIDDEN', 'لا صلاحية على هذه المؤسسة', 'No permission on this organization', 403); };
defineCommand<{ legalNameAr: string; legalNameEn: string; customerType: T.Organization['customerType']; cityCode: string; taxId?: string }, T.Organization>({
  name: 'org.create', guard: ['ops_controller', 'customer_service', 'finance'], desc: L('إنشاء عميل (مؤسسة أو فرد)', 'Create customer (organization or individual)'),
  run(ctx, i) {
    if (!i.legalNameAr?.trim()) ctx.fail('VALIDATION', 'الاسم القانوني مطلوب', 'Legal name required', 422, 'legalNameAr');
    if (i.taxId && !/^3\d{13}3$/.test(i.taxId)) ctx.fail('VALIDATION', 'الرقم الضريبي 15 رقماً يبدأ وينتهي بـ 3', 'VAT number is 15 digits starting and ending with 3', 422, 'taxId');
    const o: T.Organization = { id: ctx.id('org'), code: `C${ctx.seq('org', 3)}`, legalName: L(i.legalNameAr, i.legalNameEn || i.legalNameAr), customerType: i.customerType, status: 'active', taxId: i.taxId ?? null, cityCode: i.cityCode, isReceivingInstitution: false, createdAt: ctx.nowIso };
    ctx.db.organizations.push(o); ctx.audit('org.create', 'organization', o.id, o.legalName.ar, o.id); return o;
  },
});
defineCommand<{ organizationId: string; nameAr: string; nameEn: string; code: string; cityCode: string; lat?: number; lng?: number; contactName: string; contactPhone: string }, T.Branch>({
  name: 'branch.create', guard: 'any', desc: L('إضافة فرع', 'Add branch'),
  run(ctx, i) {
    orgAdmin(ctx, i.organizationId);
    if (!/^[A-Z0-9]{2,6}$/.test(i.code ?? '')) ctx.fail('VALIDATION', 'رمز الفرع 2–6 أحرف لاتينية كبيرة/أرقام', 'Branch code 2–6 uppercase letters/digits', 422, 'code');
    if (ctx.db.branches.some((b) => b.organizationId === i.organizationId && b.code === i.code)) ctx.fail('DUPLICATE', 'رمز الفرع مستخدم', 'Branch code in use', 409, 'code');
    if (!/^\+9665\d{8}$/.test(i.contactPhone ?? '')) ctx.fail('VALIDATION', 'رقم الجوال بصيغة ‎+9665XXXXXXXX', 'Mobile format +9665XXXXXXXX', 422, 'contactPhone');
    const c = must(ctx, ctx.db.cities.find((x) => x.code === i.cityCode), 'city');
    const b: T.Branch = { id: ctx.id('br'), organizationId: i.organizationId, code: i.code, name: L(i.nameAr, i.nameEn || i.nameAr), cityCode: i.cityCode, status: 'active', createdAt: ctx.nowIso };
    ctx.db.branches.push(b);
    ctx.db.addresses.push({ id: ctx.id('adr'), organizationId: i.organizationId, branchId: b.id, label: L(`${i.nameAr} — استلام العينات`, `${i.nameEn || i.nameAr} — Sample desk`), cityCode: i.cityCode, district: b.name, lat: i.lat ?? c.lat, lng: i.lng ?? c.lng, contactName: i.contactName, contactPhone: i.contactPhone, authorized: true });
    ctx.audit('branch.create', 'branch', b.id, b.name.ar, i.organizationId); return b;
  },
});
defineCommand<{ id: string; status: T.Branch['status'] }, T.Branch>({
  name: 'branch.setStatus', guard: 'any', desc: L('تفعيل/إيقاف فرع', 'Activate/deactivate branch'),
  run(ctx, { id, status }) { const b = must(ctx, ctx.db.branches.find((x) => x.id === id), 'branch'); orgAdmin(ctx, b.organizationId); b.status = status; ctx.audit('branch.status', 'branch', b.id, status, b.organizationId); return b; },
});
defineCommand<{ organizationId: string; branchId?: string | null; labelAr: string; labelEn?: string; cityCode: string; districtAr: string; lat?: number; lng?: number; contactName: string; contactPhone: string }, T.Address>({
  name: 'address.create', guard: 'any', desc: L('إضافة عنوان معتمد', 'Add authorized address'),
  run(ctx, i) {
    const isOwn = customerOrgIds(ctx.actor).includes(i.organizationId);
    if (!isOwn) orgAdmin(ctx, i.organizationId);
    if (isOwn && !isStaff(ctx.actor)) { const g = branchGrants(ctx.actor, i.organizationId); if (!g.all && !(i.branchId && g.write.has(i.branchId))) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403); }
    if (!i.labelAr?.trim()) ctx.fail('VALIDATION', 'الوصف مطلوب', 'Label required', 422, 'labelAr');
    if (!/^\+9665\d{8}$/.test(i.contactPhone ?? '')) ctx.fail('VALIDATION', 'رقم الجوال بصيغة ‎+9665XXXXXXXX', 'Mobile format +9665XXXXXXXX', 422, 'contactPhone');
    const c = must(ctx, ctx.db.cities.find((x) => x.code === i.cityCode), 'city');
    const a: T.Address = { id: ctx.id('adr'), organizationId: i.organizationId, branchId: i.branchId ?? null, label: L(i.labelAr, i.labelEn || i.labelAr), cityCode: i.cityCode, district: L(i.districtAr || '—', i.districtAr || '—'), lat: i.lat ?? c.lat + (Math.random() - 0.5) * 0.05, lng: i.lng ?? c.lng + (Math.random() - 0.5) * 0.05, contactName: i.contactName, contactPhone: i.contactPhone, authorized: true };
    ctx.db.addresses.push(a); ctx.audit('address.create', 'address', a.id, a.label.ar, i.organizationId); return a;
  },
});

// ---------------- الإشعارات والقوالب (INT-001) ----------------
defineCommand<{ id: string }, T.Notification>({ name: 'notification.markRead', guard: 'any', desc: L('تعليم كمقروء', 'Mark read'), run(ctx, { id }) { const n = must(ctx, ctx.db.notifications.find((x) => x.id === id), 'notification'); n.readAt = n.readAt ?? ctx.nowIso; return n; } });
defineCommand<{ ids: string[] }, { count: number }>({ name: 'notification.markAllRead', guard: 'any', desc: L('تعليم الكل كمقروء', 'Mark all read'), run(ctx, { ids }) { let count = 0; for (const n of ctx.db.notifications) if (ids.includes(n.id) && !n.readAt) { n.readAt = ctx.nowIso; count++; } return { count }; } });
defineCommand<{ channel: T.Notification['channel']; enabled: boolean }, T.NotificationPref>({
  name: 'notification.setPref', guard: 'any', desc: L('تفضيلات القنوات', 'Channel preferences'),
  run(ctx, { channel, enabled }) {
    if (channel === 'in_app' && !enabled) ctx.fail('VALIDATION', 'إشعارات التطبيق لا يمكن إيقافها (التنبيهات الحرجة)', 'In-app notices cannot be disabled (critical alerts)', 422);
    let p = ctx.db.notificationPrefs.find((x) => x.userId === ctx.actor.user.id && x.channel === channel);
    if (!p) { p = { id: ctx.id('npf'), userId: ctx.actor.user.id, channel, enabled }; ctx.db.notificationPrefs.push(p); } else p.enabled = enabled;
    return p;
  },
});
defineCommand<{ id: string; subjectAr: string; subjectEn: string; bodyAr: string; bodyEn: string; active: boolean }, T.Template>({
  name: 'template.update', guard: ['super_admin'], desc: L('تعديل قالب إشعار', 'Edit notification template'),
  run(ctx, i) { const t = must(ctx, ctx.db.templates.find((x) => x.id === i.id), 'template'); if (!i.bodyAr?.trim() || !i.bodyEn?.trim()) ctx.fail('VALIDATION', 'النص بالعربية والإنجليزية مطلوب', 'Arabic and English body required', 422); Object.assign(t, { subject: L(i.subjectAr, i.subjectEn), body: L(i.bodyAr, i.bodyEn), active: i.active }); ctx.audit('template.update', 'template', t.id, t.code); return t; },
});
defineCommand<{ id: string }, T.Notification>({
  name: 'template.testSend', guard: ['super_admin'], desc: L('إرسال تجريبي (محاكاة)', 'Test send (simulated)'),
  run(ctx, { id }) { const t = must(ctx, ctx.db.templates.find((x) => x.id === id), 'template'); ctx.notify({ audience: 'staff', userId: ctx.actor.user.id, channel: t.channel, templateCode: t.code, title: t.subject, body: t.body }); return ctx.db.notifications[ctx.db.notifications.length - 1]; },
});

// ---------------- Webhooks وعملاء API (INT-002) ----------------
defineCommand<{ organizationId: string | null; url: string; events: string[] }, T.Webhook>({
  name: 'webhook.create', guard: 'any', desc: L('اشتراك Webhook (محاكاة)', 'Webhook subscription (simulated)'),
  run(ctx, i) {
    if (i.organizationId) orgAdmin(ctx, i.organizationId); else ctx.require('super_admin');
    if (!/^https:\/\/[^\s]+$/.test(i.url ?? '')) ctx.fail('VALIDATION', 'يجب أن يكون الرابط HTTPS', 'URL must be HTTPS', 422, 'url');
    if (!i.events?.length) ctx.fail('VALIDATION', 'اختر حدثاً واحداً على الأقل', 'Pick at least one event', 422, 'events');
    const w: T.Webhook = { id: ctx.id('whk'), organizationId: i.organizationId, url: i.url, events: i.events, secretMasked: `whsec_••••${ctx.now.toString(16).slice(-4)}`, status: 'active', lastDeliveryAt: null, failures: 0, simulated: true };
    ctx.db.webhooks.push(w); ctx.audit('webhook.create', 'webhook', w.id, i.url, i.organizationId); return w;
  },
});
defineCommand<{ id: string; action: 'pause' | 'resume' | 'rotate' | 'test' }, T.Webhook>({
  name: 'webhook.action', guard: 'any', desc: L('إيقاف/استئناف/تدوير/اختبار', 'Pause/resume/rotate/test'),
  run(ctx, { id, action }) {
    const w = must(ctx, ctx.db.webhooks.find((x) => x.id === id), 'webhook'); if (w.organizationId) orgAdmin(ctx, w.organizationId); else ctx.require('super_admin');
    if (action === 'pause') w.status = 'paused'; if (action === 'resume') w.status = 'active';
    if (action === 'rotate') w.secretMasked = `whsec_••••${ctx.now.toString(16).slice(-4)}`;
    if (action === 'test') { if (w.status !== 'active') ctx.fail('WEBHOOK_PAUSED', 'الاشتراك موقوف', 'Subscription paused', 422); w.lastDeliveryAt = ctx.nowIso; }
    ctx.audit('webhook.' + action, 'webhook', w.id, w.url); return w;
  },
});
defineCommand<{ organizationId: string | null; name: string; scopes: string[] }, T.ApiClient & { secretOnce: string }>({
  name: 'apiClient.create', guard: 'any', desc: L('إنشاء مفتاح API (يُعرض مرة واحدة)', 'Create API key (shown once)'),
  run(ctx, i) {
    if (i.organizationId) orgAdmin(ctx, i.organizationId); else ctx.require('super_admin');
    if (!i.name?.trim()) ctx.fail('VALIDATION', 'الاسم مطلوب', 'Name required', 422, 'name');
    const secret = `mlk_demo_${ctx.now.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const c: T.ApiClient = { id: ctx.id('api'), organizationId: i.organizationId, partnerId: null, name: i.name, keyPrefix: secret.slice(0, 12), scopes: i.scopes ?? [], status: 'active', createdAt: ctx.nowIso };
    ctx.db.apiClients.push(c); ctx.audit('api_client.create', 'api_client', c.id, i.name, i.organizationId); return { ...c, secretOnce: secret };
  },
});
defineCommand<{ id: string }, T.ApiClient>({
  name: 'apiClient.revoke', guard: 'any', desc: L('إلغاء مفتاح API', 'Revoke API key'),
  run(ctx, { id }) { const c = must(ctx, ctx.db.apiClients.find((x) => x.id === id), 'api client'); if (c.organizationId) orgAdmin(ctx, c.organizationId); else ctx.require('super_admin'); c.status = 'revoked'; ctx.audit('api_client.revoke', 'api_client', c.id, c.name); return c; },
});

// ---------------- تنبيهات التأخير بالقواعد (PDA-001..015) ----------------
defineCommand<Record<string, never>, { raised: number }>({
  name: 'delay.runRules', guard: ['ops_controller'], desc: L('تشغيل قواعد التنبؤ بالتأخير', 'Run delay-prediction rules'),
  run(ctx) {
    let raised = 0;
    for (const s of ctx.db.shipments.filter((x) => ['pickup_scheduled', 'collected', 'in_transit', 'at_handover'].includes(x.status))) {
      if (ctx.db.delayAlerts.some((d) => d.shipmentId === s.id && !d.resolvedAt)) continue;
      const late = Date.parse(s.deliverBy) - ctx.now;
      const box = ctx.db.packings.find((p) => p.shipmentId === s.id && !p.unpackedAt)?.boxId;
      const dev = box ? ctx.db.devices.find((d) => ctx.db.pairings.some((p) => p.boxId === box && !p.unpairedAt && p.deviceId === d.id)) : null;
      const silentMin = dev?.lastSeenAt ? (ctx.now - Date.parse(dev.lastSeenAt)) / MIN : 0;
      let reason: T.L | null = null; let risk: T.DelayAlert['risk'] = 'medium';
      if (late < 0) { reason = L(`تجاوز موعد التسليم بـ ${Math.round(-late / MIN)} دقيقة`, `Past delivery deadline by ${Math.round(-late / MIN)} min`); risk = 'high'; }
      else if (late < 45 * MIN && s.status !== 'at_handover') reason = L('أقل من 45 دقيقة على الموعد والشحنة لم تصل نقطة التسليم', 'Under 45 min to deadline and not at handover');
      else if (s.status === 'pickup_scheduled' && Date.parse(s.pickupWindowEnd) < ctx.now) { reason = L('انتهت فترة الاستلام دون استلام', 'Pickup window ended without collection'); risk = 'high'; }
      else if (silentMin > 45 && s.status === 'in_transit' && !ctx.db.shipmentLegs.some((x) => x.shipmentId === s.id && ctx.db.legs.some((l) => l.id === x.legId && l.mode === 'air' && l.status === 'departed'))) reason = L(`لا قراءات منذ ${Math.round(silentMin)} دقيقة`, `No readings for ${Math.round(silentMin)} min`);
      if (reason) { ctx.db.delayAlerts.push({ id: ctx.id('dla'), shipmentId: s.id, ruleVersion: 'PDA-R1.2', risk, reason, raisedAt: ctx.nowIso, resolvedAt: null, escalated: false }); ctx.emit('sla.delay_risk_detected', 'shipment', s.id, s.organizationId, { risk }); raised++; }
    }
    return { raised };
  },
});
defineCommand<{ id: string; action: 'escalate' | 'resolve'; note?: string }, T.DelayAlert>({
  name: 'delay.action', guard: ['ops_controller'], desc: L('تصعيد أو إغلاق تنبيه تأخير', 'Escalate or resolve delay alert'),
  run(ctx, { id, action, note }) {
    const d = must(ctx, ctx.db.delayAlerts.find((x) => x.id === id), 'alert');
    if (action === 'escalate') { d.escalated = true; ctx.notify({ audience: 'staff', critical: true, title: L('تصعيد تأخير', 'Delay escalated'), body: d.reason, link: `/shipments/${d.shipmentId}` }); } else d.resolvedAt = ctx.nowIso;
    ctx.audit('delay.' + action, 'shipment', d.shipmentId, note ?? ''); return d;
  },
});

// ---------------- النسخ الاحتياطي والاستعادة (SEC-004 / NFR-005) — محاكاة ----------------
defineCommand<{ kind: 'snapshot' | 'restore_drill' }, T.BackupRun>({
  name: 'backup.run', guard: ['super_admin'], desc: L('تشغيل نسخة أو تمرين استعادة (محاكاة)', 'Run backup or restore drill (simulated)'),
  run(ctx, { kind }) {
    const b: T.BackupRun = { id: ctx.id('bkp'), kind, at: ctx.nowIso, status: 'success', durationMin: kind === 'snapshot' ? 9 : 88, rpoMin: kind === 'restore_drill' ? 11 : null, rtoMin: kind === 'restore_drill' ? 88 : null, simulated: true };
    ctx.db.backups.push(b); ctx.audit('backup.' + kind, 'backup', b.id, 'محاكاة'); return b;
  },
});

// ---------------- المندوبون والمركبات (RTE-001) ----------------
defineCommand<{ courierId: string; status: T.Courier['status'] }, T.Courier>({
  name: 'courier.setStatus', guard: ['ops_controller', 'courier'], desc: L('حالة المناوبة', 'Shift status'),
  run(ctx, { courierId, status }) {
    const c = must(ctx, ctx.db.couriers.find((x) => x.id === courierId), 'courier');
    if (!isStaff(ctx.actor) && c.userId !== ctx.actor.user.id) ctx.fail('FORBIDDEN', 'لا صلاحية', 'Forbidden', 403);
    if (status === 'off_shift' && ctx.db.boxes.some((b) => b.custodianType === 'courier' && b.custodianId === c.id && b.status === 'in_use')) ctx.fail('CUSTODY_OPEN', 'لا يمكن إنهاء المناوبة وبعهدتك صناديق نشطة', 'Cannot end shift with active boxes in custody', 422);
    c.status = status; ctx.audit('courier.status', 'courier', c.id, status); return c;
  },
});
defineCommand<{ nameAr: string; nameEn: string; cityCode: string; partnerId?: string | null; phone: string; vehicleId?: string | null }, T.Courier>({
  name: 'courier.create', guard: ['ops_controller'], desc: L('إضافة مندوب', 'Add courier'),
  run(ctx, i) {
    if (!i.nameAr?.trim()) ctx.fail('VALIDATION', 'الاسم مطلوب', 'Name required', 422, 'nameAr');
    if (!/^\+9665\d{8}$/.test(i.phone ?? '')) ctx.fail('VALIDATION', 'رقم الجوال بصيغة ‎+9665XXXXXXXX', 'Mobile format +9665XXXXXXXX', 422, 'phone');
    const c: T.Courier = { id: ctx.id('cou'), userId: null, partnerId: i.partnerId ?? null, name: L(i.nameAr, i.nameEn || i.nameAr), employmentType: i.partnerId ? 'partner' : 'employee', status: 'off_shift', cityCode: i.cityCode, qualified: false, qualificationExpiry: ctx.nowIso, vehicleId: i.vehicleId ?? null, phone: i.phone, lastPosition: null };
    ctx.db.couriers.push(c); ctx.audit('courier.create', 'courier', c.id, c.name.ar); return c;
  },
});
void HOUR;
