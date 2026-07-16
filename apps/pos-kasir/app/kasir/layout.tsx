'use client'

import { usePathname } from 'next/navigation'
import KasirNav from '@/components/KasirNav'
import OnlineOrderSync from '@/components/OnlineOrderSync'
import BriefingBanner from '@/components/BriefingBanner'
import NetworkIndicator from '@/components/NetworkIndicator'
import OfflineSyncManager from '@/components/OfflineSyncManager'
import OfflineWarmup from '@/components/OfflineWarmup'
import PettyCashNotification from '@/components/PettyCashNotification'
import PrinterBlockerMount from '@/components/PrinterBlockerMount'

export default function KasirLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDashboard = pathname === '/kasir'

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#fff8f1] flex flex-col lg:flex-row print:block print:h-auto print:overflow-visible">
      <NetworkIndicator />
      <OfflineSyncManager />
      <OfflineWarmup />
      <OnlineOrderSync />
      <PettyCashNotification />
      <PrinterBlockerMount />
      <KasirNav />
      <main className="flex-1 min-w-0 overflow-y-auto print:overflow-visible print:w-full print:max-w-none">
        {/* Briefing hari ini: target harian + pesan owner (satu kartu persisten) */}
        <BriefingBanner />

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
