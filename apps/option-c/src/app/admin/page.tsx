'use client';
import dynamic from 'next/dynamic';
const AdminRoot = dynamic(() => import('@/admin/AdminApp'), { ssr: false });
export default function Page() { return <AdminRoot />; }
