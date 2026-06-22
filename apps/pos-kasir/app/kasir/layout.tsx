'use client'

import { usePathname } from 'next/navigation'
import KasirNav from '@/components/KasirNav'
import OnlineOrderSync from '@/components/OnlineOrderSync'

export default function KasirLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDashboard = pathname === '/kasir'

  return (
    <div className="min-h-screen bg-[#fff8f1] lg:flex print:block">
      <OnlineOrderSync />
      <KasirNav />
      <main className="flex-1 min-w-0 print:w-full print:max-w-none">
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
