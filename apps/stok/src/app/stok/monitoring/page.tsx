'use client';

import Link from 'next/link';
import { MonitoringPage } from '@/components/monitoring/MonitoringPage';

export default function Page() {
  return (
    <div className="min-h-screen bg-[#fff8f1]">
      <div className="px-6 py-3 bg-white border-b border-[#701604]/10 shadow-sm">
        <Link href="/dashboard" className="text-xs font-bold text-[#701604]/50 hover:text-[#701604] transition-colors">
          ← Kembali ke Dashboard
        </Link>
      </div>
      <MonitoringPage />
    </div>
  );
}
