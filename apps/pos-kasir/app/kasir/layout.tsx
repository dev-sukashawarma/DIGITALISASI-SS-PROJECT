'use client'

import { usePathname } from 'next/navigation'
import KasirNav from '@/components/KasirNav'
import OnlineOrderSync from '@/components/OnlineOrderSync'
import TargetProgressBar from '@/components/TargetProgressBar'
import OwnerMessageBanner from '@/components/OwnerMessageBanner'
import StockAlertBanner from '@/components/StockAlertBanner'

export default function KasirLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDashboard = pathname === '/kasir'

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#fff8f1] flex flex-col lg:flex-row print:block print:h-auto print:overflow-visible">
      <OnlineOrderSync />
      <KasirNav />
      <main className="flex-1 min-w-0 overflow-y-auto print:overflow-visible print:w-full print:max-w-none">
        {/* Indikator target harian realtime — selalu terlihat di atas konten */}
        <TargetProgressBar />
        <OwnerMessageBanner />
        <StockAlertBanner />
        <div className={isDashboard
          ? "w-full px-6 py-6 print:p-0"
          : "max-w-6xl mx-auto px-4 sm:px-5 lg:px-8 py-6 lg:py-8 print:p-0 print:max-w-none"
        }>
          {children}
        </div>
      </main>
    </div>
  )
}
