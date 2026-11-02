'use client';
// أدوات مشتركة لشاشات الإدارة: جداول البحث (أسماء العملاء والمدن والمستخدمين) وروابط موحّدة
import React, { useMemo, useState } from 'react';
import { useApp, useList } from '@/lib/store';
import { FormModal, type FieldDef } from '@/lib/ui';

export function useLookups() {
  const orgs = useList('organizations'); const cities = useList('cities'); const users = useList('users'); const partners = useList('partners'); const couriers = useList('couriers'); const branches = useList('branches'); const addresses = useList('addresses'); const boxes = useList('boxes');
  const { x } = useApp();
  return useMemo(() => {
    const m = (l: any) => new Map<string, any>((l.data?.items ?? []).map((i: any) => [i.id ?? i.code, i]));
    const O = m(orgs), Ci = m(cities), U = m(users), P = m(partners), Co = m(couriers), B = m(branches), A = m(addresses), Bx = m(boxes);
    return {
      ready: !!orgs.data && !!cities.data,
      org: (id?: string | null) => (id ? x(O.get(id)?.legalName) || id : '—'), orgs: [...O.values()],
      city: (c?: string | null) => (c ? x(Ci.get(c)?.name) || c : '—'), cities: [...Ci.values()],
      user: (id?: string | null) => (id ? x(U.get(id)?.name) || id : '—'), users: [...U.values()],
      partner: (id?: string | null) => (id ? x(P.get(id)?.name) || id : '—'), partners: [...P.values()],
      courier: (id?: string | null) => (id ? x(Co.get(id)?.name) || id : '—'), couriers: [...Co.values()],
      branch: (id?: string | null) => (id ? x(B.get(id)?.name) || id : '—'), branches: [...B.values()],
      addr: (id?: string | null) => (id ? A.get(id) : null), addresses: [...A.values()],
      box: (id?: string | null) => (id ? Bx.get(id)?.code ?? id : '—'),
    };
  }, [orgs.data, cities.data, users.data, partners.data, couriers.data, branches.data, addresses.data, boxes.data, x]);
}
export const ShipLink = ({ id, no }: { id: string; no?: string }) => <a href={'#/shipments/' + id} className="mono" onClick={(e) => e.stopPropagation()}>{no ?? id}</a>;

/** زر يفتح نموذجاً وينفّذ أمراً — يُستخدم لكل إجراءات الصفوف والإنشاء */
export function ActionForm({ label, title, fields, initial, cmd, map, kind = 'default', success, disabled, intro, danger }: { label: React.ReactNode; title: string; fields: FieldDef[]; initial?: Record<string, any>; cmd: string; map?(v: Record<string, any>): unknown; kind?: 'default' | 'primary' | 'danger' | 'ghost'; success?: string; disabled?: boolean; intro?: React.ReactNode; danger?: boolean }) {
  const { run } = useApp(); const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={'btn ' + kind} disabled={disabled} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{label}</button>
    {open && <FormModal title={title} fields={fields} initial={initial} intro={intro} danger={danger} onClose={() => setOpen(false)} onSubmit={(v) => run(cmd, map ? map(v) : v, { success })} />}
  </>;
}
export const opts = (lang: 'ar' | 'en', arr: { value: string; ar: string; en: string }[]) => arr.map((o) => ({ value: o.value, label: o[lang] }));
export const localNow = (plusH = 0) => { const d = new Date(Date.now() + plusH * 3600_000); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const localDate = (plusDays = 0) => new Date(Date.now() + plusDays * 864e5).toISOString().slice(0, 10);
