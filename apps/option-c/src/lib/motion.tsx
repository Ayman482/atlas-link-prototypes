'use client';
// نظام الحركة للخيار C (Motion for React). المدد والمنحنيات من packages/tokens/tokens.json.
// القاعدة: 150–300ms للتفاعلات الصغيرة، 420ms للتأكيدات فقط. MotionConfig reducedMotion="user" يعطّل الحركة الانتقالية تلقائياً
// لمن فعّل «تقليل الحركة» في نظامه، ويُبقي تغيّر الشفافية فقط.
import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from 'motion/react';

export const DUR = { instant: 0.12, fast: 0.16, base: 0.22, slow: 0.3, emphasis: 0.42 } as const;
type Bez = [number, number, number, number];
export const EASE: Record<'standard' | 'decelerate' | 'accelerate' | 'emphasized', Bez> = { standard: [0.2, 0, 0, 1], decelerate: [0, 0, 0, 1], accelerate: [0.3, 0, 1, 1], emphasized: [0.2, 0.9, 0.3, 1] };
export const STAGGER = 0.04;

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: DUR.base, ease: EASE.standard }}>{children}</MotionConfig>;
}
export { AnimatePresence, motion, useReducedMotion };

/** حاوية تُظهر أبناءها تباعاً (40ms) — لا تؤخّر أي محتوى أكثر من 240ms */
export const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: STAGGER, delayChildren: 0.02 } } };
export const fadeUp: Variants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.decelerate } } };
export const fadeIn: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: DUR.fast } } };

/** انتقال الصفحات: تلاشٍ + انزلاق 8px خلال 220ms */
export function PageTransition({ id, children }: { id: string; children: React.ReactNode }) {
  return <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.base, ease: EASE.decelerate }}>{children}</motion.div>;
}

/** علامة نجاح تُرسم (للتأكيدات) — 420ms */
export function SuccessMark({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="successmark">
    <motion.circle cx="12" cy="12" r="10" fill="var(--success)" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }} />
    <motion.path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: DUR.slow, delay: 0.12, ease: EASE.decelerate }} />
  </svg>;
}

/** تلميح سياقي يُفتح بالمرور أو التركيز ويُغلق بـ Esc — مربوط بـ aria-describedby */
export function Tip({ text, children }: { text: React.ReactNode; children: React.ReactElement }) {
  const [open, setOpen] = useState(false); const id = useId();
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  return <span className="tipwrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
    {React.cloneElement(children, { 'aria-describedby': id, tabIndex: children.props.tabIndex ?? 0 })}
    <AnimatePresence>{open && <motion.span role="tooltip" id={id} className="tip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: DUR.fast }}>{text}</motion.span>}</AnimatePresence>
  </span>;
}

/** درج جانبي: ينزلق من جهة البداية أو النهاية حسب الاتجاه، يحبس التركيز، Esc للإغلاق، ويعيد التركيز لزر الفتح */
export function Drawer({ open, onClose, title, side = 'end', children, width = 420 }: { open: boolean; onClose(): void; title: React.ReactNode; side?: 'start' | 'end'; children: React.ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null); const back = useRef<Element | null>(null);
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const fromRight = (side === 'end') !== rtl;
  useEffect(() => {
    if (!open) return;
    back.current = document.activeElement; setTimeout(() => ref.current?.querySelector<HTMLElement>('button, a, input, select, [tabindex]')?.focus(), 30);
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) { const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]; if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    };
    window.addEventListener('keydown', k); return () => { window.removeEventListener('keydown', k); (back.current as HTMLElement | null)?.focus?.(); };
  }, [open, onClose]);
  return <AnimatePresence>{open && <>
    <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.fast }} />
    <motion.aside ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className="drawer" style={{ width: `min(${width}px, 100vw)`, [fromRight ? 'right' : 'left']: 0 }}
      initial={{ x: fromRight ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: fromRight ? '100%' : '-100%' }} transition={{ duration: DUR.slow, ease: EASE.emphasized }}>
      <header><h2>{title}</h2><button className="x" onClick={onClose} aria-label="close">×</button></header>
      <div className="drawerbody">{children}</div>
    </motion.aside>
  </>}</AnimatePresence>;
}

/** قسم قابل للطي بارتفاع متحرك */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: DUR.base, ease: EASE.standard }} style={{ overflow: 'hidden' }}>{children}</motion.div>}</AnimatePresence>;
}
