'use client';
// Phase 17.1 — طبقة النوافذ العلوية (P0): كل نافذة حوار ودرج وقائمة منبثقة تُرسم عبر بوابة (portal) في طبقة واحدة
// خارج شجرة الصفحة، فلا تحبسها سياقات التكديس (transform/animation/backdrop-filter/sticky) داخل الأقسام والجداول.
// الطبقة: body > #al-layer لوحة الإدارة والبوابة، و .phone > .al-layer لمعاينة الجوال (الإطار له transform فهو حاوية fixed).
// عند فتح نافذة: الخلفية inert (لا نقر ولا تركيز ولا قارئ شاشة) ولا تتمرر — بعدّاد مرجعي للنوافذ المتداخلة.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function layerRoot(): HTMLElement {
  const phone = document.querySelector<HTMLElement>('.phone');
  const host = phone ?? document.body;
  let el = host.querySelector<HTMLElement>(':scope > .al-layer');
  if (!el) { el = document.createElement('div'); el.className = 'al-layer'; if (!phone) el.id = 'al-layer'; host.appendChild(el); }
  return el;
}

let locks = 0; let restore: (() => void) | null = null;
/** يقفل الخلفية: inert لكل أشقاء الطبقة، ومنع تمرير الصفحة مع تعويض عرض شريط التمرير لتجنب القفز */
export function lockBackground(): () => void {
  if (locks++ === 0) {
    const layer = layerRoot(); const host = layer.parentElement!;
    const marked: Element[] = [];
    for (const c of Array.from(host.children)) {
      if (c === layer || ['SCRIPT', 'STYLE', 'LINK', 'NEXT-ROUTE-ANNOUNCER', 'TEMPLATE'].includes(c.tagName) || c.hasAttribute('inert')) continue;
      c.setAttribute('inert', ''); marked.push(c);
    }
    const html = document.documentElement; const body = document.body;
    const sw = window.innerWidth - html.clientWidth;
    const prev = { h: html.style.overflow, b: body.style.overflow, p: body.style.paddingInlineEnd };
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; if (sw > 0) body.style.paddingInlineEnd = sw + 'px';
    restore = () => { for (const c of marked) c.removeAttribute('inert'); html.style.overflow = prev.h; body.style.overflow = prev.b; body.style.paddingInlineEnd = prev.p; };
  }
  let done = false;
  return () => { if (done) return; done = true; if (--locks === 0) { restore?.(); restore = null; } };
}

export function useBackgroundLock(active: boolean) {
  useEffect(() => (active ? lockBackground() : undefined), [active]);
}

/** يرسم الأبناء في الطبقة العلوية (بعد التركيب فقط، لتوافق التصدير الثابت) */
export function Layer({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(layerRoot()); }, []);
  return host ? createPortal(children, host) : null;
}
