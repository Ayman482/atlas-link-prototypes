import type { Halala } from './types';

export const HOUR = 3600_000;
export const MIN = 60_000;
export const DAY = 24 * HOUR;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const iso = (ms: number) => new Date(ms).toISOString();
export const pad = (n: number, w = 4) => String(n).padStart(w, '0');

/** يحسب نسبة مئوية على مبلغ بالهللة مع تقريب مصرفي إلى أقرب هللة */
export function pct(amount: Halala, percent: number): Halala {
  return Math.round((amount * percent) / 100);
}
export const sar = (riyals: number): Halala => Math.round(riyals * 100);

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** بصمة بسيطة غير تشفيرية لطلبات Idempotency وبصمات رسائل البوابة التجريبية */
export function fingerprint(v: unknown): string {
  const s = JSON.stringify(v ?? null);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function clone<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}
