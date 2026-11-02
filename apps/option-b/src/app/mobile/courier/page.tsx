'use client';
import dynamic from 'next/dynamic';
const Root = dynamic(() => import('@/mobile/CourierMobile'), { ssr: false });
export default function Page() { return <Root />; }
