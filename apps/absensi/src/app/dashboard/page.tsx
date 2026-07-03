"use client";

import dynamic from 'next/dynamic';

const AttendanceKioskPanel = dynamic(
  () => import('@/features/clock/AttendanceKioskPanel').then(mod => mod.AttendanceKioskPanel),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-500">Menyiapkan Kamera & Peta...</p>
        </div>
      </div>
    )
  }
);

export default function DashboardPage() {
  return <AttendanceKioskPanel />;
}
