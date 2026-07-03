import React from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'
import { SwipeableLayout } from '@/components/layout/SwipeableLayout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-suka-cream">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <SwipeableLayout>
          <main className="flex-1 overflow-y-auto w-full">
            {/* Bottom padding on mobile keeps content clear of the fixed BottomNav. */}
            <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 pb-24 md:pb-8">{children}</div>
          </main>
        </SwipeableLayout>
      </div>
      <BottomNav />
    </div>
  )
}
