'use client';
// تبديل المظهر (فاتح/داكن) مع تذكّر الاختيار لكل مستخدم
import React, { useEffect, useState } from 'react';
import { useApp } from './store';
import { Btn } from './ui';
const Ico = ({ d, size = 22 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
function useTheme() {
  const [th, setTh] = useState<string | null>(() => { try { return localStorage.getItem('al-b-theme'); } catch { return null; } });
  useEffect(() => { if (th) document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme; try { th ? localStorage.setItem('al-b-theme', th) : localStorage.removeItem('al-b-theme'); } catch { /* */ } }, [th]);
  return { th, toggle: () => { const dark = th ? th === 'dark' : !window.matchMedia('(prefers-color-scheme: light)').matches; setTh(dark ? 'light' : 'dark'); } };
}
export function ThemeBtn() {
  const { lang } = useApp(); const { th, toggle } = useTheme();
  return <Btn kind="ghost" className="iconbtn" onClick={toggle} aria-label={lang === 'ar' ? 'تبديل المظهر' : 'Toggle theme'} title={th ?? 'auto'}><Ico size={18} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Btn>;
}
