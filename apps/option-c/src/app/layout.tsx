import '@medlog/tokens/tokens.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'أطلس لينك — الخيار C: Emerald Health', description: process.env.NEXT_PUBLIC_MEDLOG_MODE === 'production' ? 'أطلس لينك للشحن الطبي' : 'نموذج أولي تفاعلي — بيانات عرض ومحاكاة' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+Arabic:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
