'use client'

import React from 'react'
import { AppSidebar } from './AppSidebar'
import { BottomNav } from '@/components/common/BottomNav'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#fffdfa] text-suka-brown flex flex-col lg:flex-row">
      {/* ── Desktop Left Sidebar (>= lg) ── */}
      <div className="hidden lg:flex h-screen sticky top-0 shrink-0 z-30">
        <AppSidebar />
      </div>

      {/* ── Main Scrollable Content Area ── */}
      <main className="flex-1 min-w-0 overflow-y-auto pb-24 lg:pb-6">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation Bar (< lg) ── */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
