import React from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'
import { SwipeableLayout } from '@/components/layout/SwipeableLayout'
import { RealtimeMount } from '@/components/RealtimeMount'
import { CommandMenu } from '@/components/layout/CommandMenu'
import { ScrollRestoration } from '@/components/layout/ScrollRestoration'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#FDF9F3] lg:bg-[#4A1713] relative">
      {/* Decorative Glow - Kept strictly inside by overflow-hidden */}
      <div className="absolute bottom-[-10rem] left-[-10rem] w-[30rem] h-[30rem] bg-suka-orange/20 blur-[120px] rounded-full pointer-events-none z-0" />
      <CommandMenu />
      <RealtimeMount />
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#FDF9F3] lg:rounded-l-[2.5rem] shadow-[-10px_0_30px_rgba(0,0,0,0.2)] relative z-10 transition-all">
        <Header />
        <SwipeableLayout>
          <main id="dashboard-main-scroll" className="flex-1 overflow-y-auto w-full">
            <ScrollRestoration selector="#dashboard-main-scroll" />
            {/* Bottom padding on mobile keeps content clear of the fixed BottomNav. */}
            <div className="w-full p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8">{children}</div>
          </main>
        </SwipeableLayout>
      </div>
      <BottomNav />
    </div>
  )
}
