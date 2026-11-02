'use client';
import dynamic from 'next/dynamic';
const PortalRoot = dynamic(() => import('@/portal/PortalApp'), { ssr: false });
export default function Page() { return <PortalRoot />; }
