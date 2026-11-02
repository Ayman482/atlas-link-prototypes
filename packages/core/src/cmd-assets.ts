// الصناديق والأجهزة والقياس عن بُعد والبوابة والمستودع — M02/M03/M08/M10
import type * as T from './types';
import { defineCommand, must, type Ctx } from './engine';
import { activePackings, activePairing, boxReadiness, deviceOfBox, evaluateReading } from './domain';
import { DAY, MIN, fingerprint, iso } from './util';

const L = (ar: string, en: string) => ({ ar, en });
const box = (ctx: Ctx, ref: string) => must(ctx, ctx.db.boxes.find((b) => b.id === ref || b.code === ref), 'box');
const device = (ctx: Ctx, ref: string) => must(ctx, ctx.db.devices.find((d) => d.id === ref || d.imei === ref), 'device');
const move = (ctx: Ctx, b: T.Box, kind: T.BoxMovement['kind'], to: string) => ctx.db.boxMovements.push({ id: ctx.id('bmv'), boxId: b.id, fromLocation: b.locationCity, toLocation: to, custodian: ctx.actor.user.name.ar, eventAt: ctx.nowIso, kind });

defineCommand<{ code: string; size: T.BoxSize; thermalClass: T.ThermalClass }, T.Box>({
  name: 'box.register', guard: ['warehouse', 'iot_engineer'], desc: L('تسجيل صندوق جديد', 'Register new box'),
  run(ctx, i) {
    const code = i.code?.trim().toUpperCase();
    if (!/^BX-[A-Z]{2}-\d{3}$/.test(code ?? '')) ctx.fail('VALIDATION', 'الرمز بصيغة BX-CS-031', 'Code format BX-CS-031', 422, 'code');
    if (ctx.db.boxes.some((b) => b.code === code)) ctx.fail('DUPLICATE', 'رمز الصندوق مستخدم', 'Box code already exists', 409, 'code');
    const b: T.Box = { id: ctx.id('box'), code, size: i.size, thermalClass: i.thermalClass, capacity: { S: 2, M: 4, L: 8 }[i.size], qualificationStatus: 'failed', qualificationExpiry: ctx.nowIso, condition: 'good', status: 'inspection', custodianType: 'warehouse', custodianId: 'wh_ruh', locationCity: 'RUH', createdAt: ctx.nowIso };
    ctx.db.boxes.push(b); ctx.audit('box.register', 'box', b.id, code); return b;
  },
});

defineCommand<{ box: string; thermal?: T.ThermalClass }, ReturnType<typeof boxReadiness>>({
  name: 'box.readinessCheck', guard: 'staff', desc: L('فحص جاهزية الصندوق والجهاز', 'Box and tracker readiness check'),
  run(ctx, { box: ref, thermal }) { const b = box(ctx, ref); const r = boxReadiness(ctx.db, b, ctx.now, thermal); ctx.audit('box.readiness_check', 'box', b.id, r.ready ? 'جاهز' : r.reasons.map((x) => x.ar).join('، ')); return r; },
});

defineCommand<{ box: string; signedBy: string }, T.Box>({
  name: 'box.receiveReturn', guard: ['warehouse'], desc: L('استلام صندوق عائد إلى المستودع', 'Receive box back at warehouse'),
  run(ctx, { box: ref, signedBy }) {
    const b = box(ctx, ref);
    if (activePackings(ctx.db, b.id).length) ctx.fail('BOX_HAS_SHIPMENTS', 'الصندوق يحتوي شحنات نشطة', 'Box still contains active shipments', 422);
    if (!['returning', 'in_use', 'assigned', 'partner_custody'].includes(b.status)) ctx.fail('INVALID_STATE', 'الصندوق ليس في طريق العودة', 'Box is not returning', 422);
    if (!signedBy?.trim()) ctx.fail('VALIDATION', 'اسم المسلّم مطلوب', 'Handed-over-by is required', 422, 'signedBy');
    Object.assign(b, { status: 'cleaning', custodianType: 'warehouse', custodianId: 'wh_ruh', locationCity: 'RUH' });
    move(ctx, b, 'return', 'WH-RUH-01'); ctx.emit('box.returned', 'box', b.id, null); ctx.audit('box.receive', 'box', b.id, `استلام ${b.code} من ${signedBy}`);
    const dev = deviceOfBox(ctx.db, b.id); if (dev && dev.state === 'assigned') dev.state = 'ready';
    return b;
  },
});

defineCommand<{ box: string; checklist: Record<string, boolean>; result: 'pass' | 'fail'; note?: string }, T.Box>({
  name: 'box.cleanInspect', guard: ['warehouse', 'quality'], desc: L('تنظيف وفحص وإعادة تأهيل (BOX-005)', 'Clean, inspect, requalify (BOX-005)'),
  run(ctx, { box: ref, checklist, result, note }) {
    const b = box(ctx, ref);
    if (!['cleaning', 'inspection', 'maintenance'].includes(b.status)) ctx.fail('INVALID_STATE', 'الصندوق ليس في مرحلة التنظيف/الفحص', 'Box is not in cleaning/inspection', 422);
    const required = ['cleaned', 'disinfected', 'sealIntact', 'trackerPaired', 'trackerBattery', 'probeCheck'];
    const missing = required.filter((k) => !checklist?.[k]);
    if (result === 'pass' && missing.length) ctx.fail('CHECKLIST_INCOMPLETE', `بنود ناقصة: ${missing.join('، ')}`, `Missing items: ${missing.join(', ')}`, 422, 'checklist');
    ctx.db.boxQualifications.push({ id: ctx.id('bq'), boxId: b.id, qualificationType: b.status === 'cleaning' ? 'cleaning' : 'inspection', result, effectiveAt: ctx.nowIso, expiresAt: null, by: ctx.actor.user.id });
    if (result === 'pass') {
      if (b.status === 'cleaning') { b.status = 'inspection'; move(ctx, b, 'cleaning', 'WH-RUH-01'); }
      else {
        b.status = 'available'; move(ctx, b, 'inspection', 'WH-RUH-01');
        if (b.qualificationStatus !== 'qualified' || Date.parse(b.qualificationExpiry) < ctx.now) { b.qualificationStatus = 'qualified'; b.qualificationExpiry = iso(ctx.now + 180 * DAY); ctx.db.boxQualifications.push({ id: ctx.id('bq'), boxId: b.id, qualificationType: 'thermal_mapping', result: 'pass', effectiveAt: ctx.nowIso, expiresAt: b.qualificationExpiry, by: ctx.actor.user.id }); }
      }
    } else { b.status = 'maintenance'; b.condition = 'damaged'; }
    ctx.audit('box.clean_inspect', 'box', b.id, `${b.code}: ${result}${note ? ' — ' + note : ''}`);
    return b;
  },
});

defineCommand<{ box: string; reason: string }, T.Box>({
  name: 'box.retire', guard: ['warehouse', 'quality'], desc: L('إيقاف صندوق نهائياً', 'Retire box'),
  run(ctx, { box: ref, reason }) {
    const b = box(ctx, ref); if (activePackings(ctx.db, b.id).length) ctx.fail('BOX_HAS_SHIPMENTS', 'الصندوق يحتوي شحنات', 'Box contains shipments', 422);
    b.status = 'retired'; const p = activePairing(ctx.db, b.id);
    if (p) { p.unpairedAt = ctx.nowIso; const d = ctx.db.devices.find((x) => x.id === p.deviceId)!; d.state = 'ready'; }
    ctx.audit('box.retire', 'box', b.id, reason); return b;
  },
});

defineCommand<{ box: string; partnerId: string; warehouseId: string; signedBy: string; returnDueAt: string }, T.PartnerCustody>({
  name: 'box.partnerHandover', guard: ['warehouse', 'ops_controller'], desc: L('حيازة مؤقتة لدى شريك مؤهل (WH-002)', 'Temporary custody with qualified partner (WH-002)'),
  run(ctx, i) {
    const b = box(ctx, i.box); const p = must(ctx, ctx.db.partners.find((x) => x.id === i.partnerId), 'partner');
    if (p.status !== 'active') ctx.fail('ELIGIBILITY_BLOCKED', 'الشريك غير مؤهل', 'Partner not qualified', 422);
    if (!i.signedBy?.trim()) ctx.fail('VALIDATION', 'توقيع الشريك مطلوب', 'Partner signature required', 422, 'signedBy');
    if (!['available', 'returning'].includes(b.status)) ctx.fail('INVALID_STATE', 'الصندوق غير متاح للتسليم', 'Box not available for handover', 422);
    const pc: T.PartnerCustody = { id: ctx.id('pcu'), boxId: b.id, partnerId: p.id, warehouseId: i.warehouseId, handedAt: ctx.nowIso, returnDueAt: i.returnDueAt, returnedAt: null, signedBy: i.signedBy, status: 'active' };
    ctx.db.partnerCustody.push(pc);
    Object.assign(b, { status: 'partner_custody', custodianType: 'partner', custodianId: p.id, locationCity: ctx.db.warehouses.find((w) => w.id === i.warehouseId)?.cityCode ?? b.locationCity });
    move(ctx, b, 'partner_handover', i.warehouseId); ctx.audit('box.partner_handover', 'box', b.id, `${b.code} → ${p.name.ar}`); return pc;
  },
});
defineCommand<{ id: string; signedBy: string }, T.PartnerCustody>({
  name: 'box.partnerReturn', guard: ['warehouse', 'ops_controller'], desc: L('إرجاع صندوق من الشريك', 'Return box from partner'),
  run(ctx, { id, signedBy }) {
    const pc = must(ctx, ctx.db.partnerCustody.find((x) => x.id === id), 'custody');
    if (pc.status === 'returned') ctx.fail('ALREADY_RETURNED', 'تم الإرجاع مسبقاً', 'Already returned', 409);
    pc.returnedAt = ctx.nowIso; pc.status = 'returned'; const b = box(ctx, pc.boxId);
    Object.assign(b, { status: 'cleaning', custodianType: 'warehouse', custodianId: 'wh_ruh' });
    move(ctx, b, 'partner_return', 'WH-RUH-01'); ctx.audit('box.partner_return', 'box', b.id, `${b.code} من ${signedBy}`); return pc;
  },
});

// ---------------- الأجهزة (BOX-002/003, BR-002, E1) ----------------
defineCommand<{ imei: string; firmware: string; simIccidLast4: string }, T.Device>({
  name: 'device.register', guard: ['iot_engineer'], desc: L('تسجيل جهاز GPT45-M بالـ IMEI', 'Register GPT45-M by IMEI'),
  run(ctx, i) {
    if (!/^\d{15}$/.test(i.imei ?? '')) ctx.fail('VALIDATION', 'IMEI يتكون من 15 رقماً', 'IMEI must be 15 digits', 422, 'imei');
    if (ctx.db.devices.some((d) => d.imei === i.imei)) ctx.fail('DUPLICATE', 'IMEI مسجّل مسبقاً', 'IMEI already registered', 409, 'imei');
    const d: T.Device = { id: ctx.id('dev'), imei: i.imei, model: 'GPT45-M', firmware: i.firmware || 'غير متحقق', simIccidMasked: `8996601••••••${(i.simIccidLast4 ?? '0000').slice(-4)}`, state: 'ready', lastSeenAt: null, batteryPct: null, lastTempC: null, lastFix: null, createdAt: ctx.nowIso };
    ctx.db.devices.push(d); ctx.audit('device.register', 'device', d.id, `IMEI ${i.imei}`);
    // تحرير الرسائل المعزولة لهذا الـ IMEI لإعادة التشغيل
    ctx.db.gatewayMessages.filter((m) => m.imei === i.imei && m.parseStatus === 'quarantined').forEach((m) => (m.reason = `${m.reason} — الجهاز مسجّل الآن؛ قابل لإعادة التشغيل`));
    return d;
  },
});

defineCommand<{ device: string; box: string; reason: string }, T.DevicePairing>({
  name: 'device.pair', guard: ['iot_engineer'], desc: L('اقتران جهاز بصندوق (اقتران نشط واحد)', 'Pair tracker with box (single active pairing)'),
  run(ctx, i) {
    const d = device(ctx, i.device), b = box(ctx, i.box);
    if (ctx.db.pairings.some((p) => p.deviceId === d.id && !p.unpairedAt)) ctx.fail('PAIRING_CONFLICT', 'الجهاز مقترن بصندوق آخر (uq_active_pairing_device)', 'Device already paired (uq_active_pairing_device)', 409, 'device');
    if (activePairing(ctx.db, b.id)) ctx.fail('PAIRING_CONFLICT', 'الصندوق لديه جهاز مقترن؛ استخدم الاستبدال', 'Box already has a tracker; use replacement', 409, 'box');
    if (['faulty', 'retired', 'suspended'].includes(d.state)) ctx.fail('DEVICE_UNFIT', 'الجهاز غير صالح للاقتران', 'Device unfit for pairing', 422);
    const p: T.DevicePairing = { id: ctx.id('pair'), boxId: b.id, deviceId: d.id, pairedAt: ctx.nowIso, unpairedAt: null, approvedBy: ctx.actor.user.id, reason: i.reason || 'اقتران' };
    ctx.db.pairings.push(p); d.state = activePackings(ctx.db, b.id).length ? 'assigned' : 'ready';
    ctx.emit('device.paired', 'device', d.id, null, { boxId: b.id }); ctx.audit('device.pair', 'device', d.id, `${d.imei} ↔ ${b.code}`); return p;
  },
});

defineCommand<{ box: string; newDevice: string; reason: string }, T.DevicePairing>({
  name: 'device.replace', guard: ['iot_engineer'], desc: L('استبدال جهاز مع حفظ التاريخ', 'Replace tracker preserving history'),
  run(ctx, { box: ref, newDevice, reason }) {
    const b = box(ctx, ref); const old = activePairing(ctx.db, b.id);
    if (!reason?.trim()) ctx.fail('VALIDATION', 'سبب الاستبدال مطلوب', 'Replacement reason required', 422, 'reason');
    if (old) { old.unpairedAt = ctx.nowIso; const od = ctx.db.devices.find((x) => x.id === old.deviceId)!; od.state = 'maintenance'; }
    return ctx.exec<T.DevicePairing>('device.pair', { device: newDevice, box: b.id, reason: `استبدال: ${reason}` });
  },
});

defineCommand<{ device: string; state: T.DeviceState; reason: string }, T.Device>({
  name: 'device.setState', guard: ['iot_engineer'], desc: L('تغيير حالة الجاهزية', 'Change readiness state'),
  run(ctx, { device: ref, state, reason }) {
    const d = device(ctx, ref); const prev = d.state; d.state = state;
    ctx.db.deviceHealth.push({ id: ctx.id('dhe'), deviceId: d.id, eventType: state === 'offline' ? 'offline' : state === 'faulty' ? 'sensor_fault' : 'online', severity: ['faulty', 'offline'].includes(state) ? 'warning' : 'info', observedAt: ctx.nowIso });
    ctx.emit('device.health_changed', 'device', d.id, null, { from: prev, to: state }); ctx.audit('device.state', 'device', d.id, `${prev} → ${state}: ${reason}`); return d;
  },
});

defineCommand<{ device: string; commandType: T.DeviceCommand['commandType']; params?: string }, T.DeviceCommand>({
  name: 'device.requestCommand', guard: ['iot_engineer'], desc: L('طلب أمر جهاز (يتطلب اعتماداً)', 'Request device command (needs approval)'),
  run(ctx, i) {
    const d = device(ctx, i.device);
    const c: T.DeviceCommand = { id: ctx.id('cmd'), deviceId: d.id, commandType: i.commandType, params: i.params ?? '', requestedBy: ctx.actor.user.id, approvedBy: null, status: 'pending_approval', requestedAt: ctx.nowIso, ackAt: null, simulated: true };
    ctx.db.deviceCommands.push(c);
    ctx.db.approvalRequests.push({ id: ctx.id('apr'), kind: 'device_command', subjectId: c.id, title: L(`أمر ${i.commandType} للجهاز ${d.imei}`, `Command ${i.commandType} for ${d.imei}`), requestedBy: ctx.actor.user.id, requiredRole: 'super_admin', status: 'pending', decidedBy: null, decidedAt: null, note: '', createdAt: ctx.nowIso });
    ctx.audit('device.command_requested', 'device', d.id, i.commandType); return c;
  },
});

/** محاكاة: يرسل الأمر المعتمد ويستقبل ACK تجريبياً — لا اتصال حقيقي بأي جهاز */
defineCommand<{ id: string }, T.DeviceCommand>({
  name: 'device.sendCommand', guard: ['iot_engineer'], desc: L('إرسال أمر معتمد (محاكاة ACK)', 'Send approved command (simulated ACK)'),
  run(ctx, { id }) {
    const c = must(ctx, ctx.db.deviceCommands.find((x) => x.id === id), 'command');
    if (c.status !== 'approved') ctx.fail('NOT_APPROVED', 'الأمر غير معتمد', 'Command not approved', 422);
    const d = ctx.db.devices.find((x) => x.id === c.deviceId)!;
    if (d.state === 'offline' || (d.lastSeenAt && ctx.now - Date.parse(d.lastSeenAt) > 30 * MIN)) { c.status = 'sent'; ctx.audit('device.command_sent', 'device', d.id, `${c.commandType} — بانتظار اتصال الجهاز`); return c; }
    c.status = 'acked'; c.ackAt = ctx.nowIso; ctx.audit('device.command_acked', 'device', d.id, `${c.commandType} ACK (محاكاة)`); return c;
  },
});

// ---------------- القياس عن بُعد (محاكاة مُعلَّمة) ----------------
/** يحقن قراءة تجريبية كما لو وصلت عبر البوابة — للعرض والاختبار فقط، مُعلَّمة demo */
defineCommand<{ device: string; tempC: number | null; deviceTime?: string; lat?: number | null; lng?: number | null; batteryPct?: number | null; late?: boolean }, { reading: T.Reading | null; message: T.GatewayMessage }>({
  name: 'telemetry.injectDemo', guard: ['iot_engineer', 'quality', 'ops_controller'], desc: L('حقن قراءة تجريبية عبر البوابة المحاكاة', 'Inject demo reading via simulated gateway'),
  run(ctx, i) {
    const d = device(ctx, i.device);
    const deviceTime = i.deviceTime ?? ctx.nowIso;
    if (Date.parse(deviceTime) > ctx.now + 5 * MIN) ctx.fail('VALIDATION', 'وقت الجهاز في المستقبل — رُفضت القراءة من القرارات الحية', 'Device time in the future — rejected from live decisions', 422, 'deviceTime');
    const pairing = ctx.db.pairings.find((p) => p.deviceId === d.id && p.pairedAt <= deviceTime && (!p.unpairedAt || p.unpairedAt >= deviceTime));
    const msg: T.GatewayMessage = { id: ctx.id('gwm'), deviceId: d.id, imei: d.imei, receivedAt: ctx.nowIso, transport: 'tcp', sha256: fingerprint([d.id, deviceTime, i.tempC]) + fingerprint([deviceTime]), parseStatus: 'parsed', reason: null, replayed: false, simulated: true };
    // DB-AT-004: نفس البصمة مرتين = لا أثر تجاري مكرر
    if (ctx.db.gatewayMessages.some((m) => m.sha256 === msg.sha256 && m.parseStatus === 'parsed')) { msg.parseStatus = 'duplicate'; msg.reason = 'رسالة مكررة'; ctx.db.gatewayMessages.push(msg); return { reading: ctx.db.readings.find((r) => r.deviceId === d.id && r.deviceTime === deviceTime) ?? null, message: msg }; }
    ctx.db.gatewayMessages.push(msg);
    if (i.tempC !== null && (i.tempC < -80 || i.tempC > 80)) { msg.parseStatus = 'dead_letter'; msg.reason = `قيمة مستحيلة ${i.tempC} °م — حُفظت كدليل خام واستُبعدت من القرارات الحية`; ctx.emit('iot.telemetry_rejected', 'device', d.id, null, { reason: 'impossible_value' }); return { reading: null, message: msg }; }
    const r: T.Reading = { id: ctx.id('rd'), deviceId: d.id, boxId: pairing?.boxId ?? null, deviceTime, receivedAt: ctx.nowIso, tempC: i.tempC, batteryPct: i.batteryPct ?? d.batteryPct, lat: i.lat ?? null, lng: i.lng ?? null, fixValid: i.lat != null && i.lng != null, backfilled: !!i.late || ctx.now - Date.parse(deviceTime) > 10 * MIN, demo: true };
    ctx.db.readings.push(r);
    if (!d.lastSeenAt || deviceTime > (d.lastFix?.at ?? '')) { d.lastTempC = r.tempC; if (r.fixValid) d.lastFix = { lat: r.lat!, lng: r.lng!, at: deviceTime }; }
    d.lastSeenAt = ctx.nowIso; if (r.batteryPct !== null) d.batteryPct = r.batteryPct;
    if (d.state === 'offline') d.state = activePackings(ctx.db, r.boxId ?? '').length ? 'assigned' : 'ready';
    if (d.batteryPct !== null && d.batteryPct < 20 && d.state === 'ready') d.state = 'low_battery';
    ctx.emit('iot.telemetry_accepted', 'device', d.id, null, { readingId: r.id, backfilled: r.backfilled });
    evaluateReading(ctx, r);
    if (r.fixValid) for (const p of ctx.db.packings.filter((x) => x.boxId === r.boxId && !x.unpackedAt)) { const sh = ctx.db.shipments.find((s) => s.id === p.shipmentId)!; if (!sh.lastPosition || sh.lastPosition.at < deviceTime) sh.lastPosition = { lat: r.lat!, lng: r.lng!, at: deviceTime, source: 'device' }; }
    return { reading: r, message: msg };
  },
});

/** نبضة محاكاة: تولّد قراءة لكل صندوق نشط متصل حتى الآن — بيانات عرض فقط */
defineCommand<Record<string, never>, { generated: number }>({
  name: 'telemetry.simulateTick', guard: ['iot_engineer', 'ops_controller', 'super_admin'], desc: L('توليد نبضة قراءات تجريبية', 'Generate a tick of demo readings'),
  run(ctx) {
    let n = 0;
    const boxes = ctx.db.boxes.filter((b) => b.status === 'in_use');
    for (const b of boxes) {
      const d = deviceOfBox(ctx.db, b.id); if (!d || ['offline', 'faulty'].includes(d.state)) continue;
      const inAir = activePackings(ctx.db, b.id).some((p) => ctx.db.shipmentLegs.some((x) => x.shipmentId === p.shipmentId && ctx.db.legs.find((l) => l.id === x.legId && l.mode === 'air' && l.status === 'departed')));
      if (inAir) continue; // لا قراءات أثناء الطيران ما لم يثبت دعم التخزين المؤقت
      const prof = ctx.db.serviceProfiles.find((p) => p.thermalClass === b.thermalClass && p.status === 'active')!;
      const last = ctx.db.readings.filter((r) => r.deviceId === d.id).sort((a, z) => z.deviceTime.localeCompare(a.deviceTime))[0];
      const base = last?.tempC ?? (prof.minC + prof.maxC) / 2;
      const target = (prof.minC + prof.maxC) / 2;
      const temp = Math.round((base + (target - base) * 0.3 + (Math.sin(ctx.now / 7e5 + n) * 0.3)) * 10) / 10;
      const pos = d.lastFix ?? null;
      ctx.exec('telemetry.injectDemo', { device: d.id, tempC: temp, lat: pos ? pos.lat + 0.002 : null, lng: pos ? pos.lng + 0.002 : null });
      n++;
    }
    return { generated: n };
  },
});

// ---------------- كونسول البوابة (IOT-DIR / SEC-005) ----------------
defineCommand<{ id: string; reason: string }, T.GatewayMessage>({
  name: 'gateway.replay', guard: ['iot_engineer'], desc: L('إعادة تشغيل رسالة من الدليل الخام (dead-letter)', 'Replay message from raw evidence (dead-letter)'),
  run(ctx, { id, reason }) {
    const m = must(ctx, ctx.db.gatewayMessages.find((x) => x.id === id), 'message');
    if (!reason?.trim()) ctx.fail('VALIDATION', 'سبب إعادة التشغيل مطلوب (تدقيق)', 'Replay reason required (audit)', 422, 'reason');
    if (m.parseStatus === 'parsed' || m.replayed) ctx.fail('NOT_REPLAYABLE', 'الرسالة معالجة مسبقاً', 'Message already processed', 409);
    if (m.parseStatus === 'quarantined' && !ctx.db.devices.some((d) => d.imei === m.imei)) ctx.fail('UNKNOWN_DEVICE', 'الجهاز غير مسجّل — سجّله أولاً', 'Device not registered — register first', 422);
    m.replayed = true; m.parseStatus = m.reason?.includes('مجموع') ? 'dead_letter' : 'parsed';
    m.reason = m.parseStatus === 'parsed' ? `أعيد تشغيلها: ${reason}` : `فشلت إعادة التشغيل (محاكاة): المجموع الاختباري ما زال غير صالح`;
    ctx.audit('gateway.replay', 'gateway_message', m.id, `${reason} → ${m.parseStatus}`); return m;
  },
});
defineCommand<{ imei: string; transport: 'tcp' | 'udp' }, T.GatewayMessage>({
  name: 'gateway.simulateUnknown', guard: ['iot_engineer'], desc: L('محاكاة اتصال جهاز غير مسجّل', 'Simulate unregistered device connection'),
  run(ctx, { imei, transport }) {
    const known = ctx.db.devices.find((d) => d.imei === imei);
    const m: T.GatewayMessage = { id: ctx.id('gwm'), deviceId: known?.id ?? null, imei, receivedAt: ctx.nowIso, transport, sha256: fingerprint([imei, ctx.now]) + fingerprint(imei), parseStatus: known ? 'parsed' : 'quarantined', reason: known ? null : 'IMEI غير مسجّل — عزل (IOT-AC-02)', replayed: false, simulated: true };
    ctx.db.gatewayMessages.push(m); if (!known) ctx.emit('iot.telemetry_rejected', 'device', imei, null, { reason: 'unknown_device' }); return m;
  },
});

// ---------------- المستهلكات (WH-003) ----------------
defineCommand<{ consumableId: string; qty: number; kind: T.ConsumableMovement['kind']; ref: string }, T.Consumable>({
  name: 'consumable.move', guard: ['warehouse'], desc: L('حركة مخزون مستهلكات', 'Consumable stock movement'),
  run(ctx, { consumableId, qty, kind, ref }) {
    const c = must(ctx, ctx.db.consumables.find((x) => x.id === consumableId), 'consumable');
    const q = Math.trunc(Number(qty));
    if (!q) ctx.fail('VALIDATION', 'الكمية مطلوبة', 'Quantity required', 422, 'qty');
    const signed = kind === 'issue' ? -Math.abs(q) : kind === 'receipt' ? Math.abs(q) : q;
    if (c.onHand + signed < 0) ctx.fail('INSUFFICIENT_STOCK', 'الرصيد غير كافٍ', 'Insufficient stock', 422, 'qty');
    c.onHand += signed;
    ctx.db.consumableMovements.push({ id: ctx.id('cmv'), consumableId: c.id, qty: signed, kind, at: ctx.nowIso, by: ctx.actor.user.id, ref: ref || '—' });
    if (c.onHand < c.reorderLevel) ctx.notify({ audience: 'staff', title: L(`مخزون منخفض: ${c.name.ar}`, `Low stock: ${c.name.en}`), body: L(`الرصيد ${c.onHand} أقل من حد إعادة الطلب ${c.reorderLevel}`, `On hand ${c.onHand} below reorder level ${c.reorderLevel}`), link: '/warehouse/consumables' });
    ctx.audit('consumable.move', 'consumable', c.id, `${kind} ${signed}`); return c;
  },
});
