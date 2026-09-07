'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { useQuery } from '@tanstack/react-query'
import { fetchPendingWasteReports } from '@/app/actions/waste'
import { AppLayout } from '@/components/layout/AppLayout'
import { OutletSwitcher } from '@/components/common/OutletSwitcher'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'
import { History, ClipboardCheck } from 'lucide-react'

export default function WasteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { outletStaff } = useAuth()
  const role = outletStaff?.role

  const canApproveWaste = [
    'area_manager',
    'regional_manager',
    'admin',
    'kitchen',
    'developer',
  ].includes(role ?? '')

  const { data: pendingReports = [] } = useQuery<any[]>({
    queryKey: ['waste-layout-pending-count'],
    queryFn: () => fetchPendingWasteReports(),
    enabled: canApproveWaste,
    staleTime: 25000,
  })

  const pendingCount = pendingReports.length

  const tabs = [
    ...(canApproveWaste
      ? [
          {
            href: '/stok/waste/approval',
            label: 'Persetujuan Waste',
            icon: ClipboardCheck,
            badge: pendingCount,
          },
        ]
      : []),
    {
      href: '/stok/waste/history',
      label: 'Riwayat Waste',
      icon: History,
    },
  ]

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#faf2e9]/30 text-suka-brown flex flex-col pb-16">
        {/* Top Header Banner */}
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-20 shadow-2xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🗑️</span>
                <h1 className="text-xl sm:text-2xl font-black text-[#701604] tracking-tight">
                  Pengelolaan Waste
                </h1>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-suka-brown/70 mt-0.5">
                Pengawasan bahan rusak/basi, verifikasi bukti fisik, dan audit histori limbah
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <OutletSwitcher />
              <UserAvatarDropdown />
            </div>
          </div>

          {/* Navigation Tab Switcher */}
          <div className="max-w-7xl mx-auto mt-4 pt-1 flex items-center gap-2 border-t border-suka-brown/10">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href)
              const Icon = tab.icon

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#701604] text-white shadow-xs'
                      : 'bg-white text-suka-brown/70 hover:bg-[#faf2e9] hover:text-[#701604] border border-[#d9c2b2]/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-suka-brown/60'}`} />
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                        active ? 'bg-white text-[#701604]' : 'bg-red-500 text-white'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </AppLayout>
  )
}
