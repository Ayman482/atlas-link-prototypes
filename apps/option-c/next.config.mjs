// تصدير ثابت لاستضافته على GitHub Pages؛ BASE_PATH يُضبط في سير النشر
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.BASE_PATH || '',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@medlog/core', '@medlog/client', '@medlog/i18n'],
  reactStrictMode: true,
  env: { NEXT_PUBLIC_MEDLOG_API: process.env.NEXT_PUBLIC_MEDLOG_API || '', NEXT_PUBLIC_MEDLOG_MODE: process.env.NEXT_PUBLIC_MEDLOG_MODE || 'demo' },
};
export default nextConfig;
