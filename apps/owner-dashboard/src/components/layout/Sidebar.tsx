'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wallet, BarChart3, ArrowLeft, Target } from 'lucide-react'

const MENU_ITEMS = [
  { label: 'Analisis Penjualan', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Laporan Pengeluaran', href: '/dashboard/expenses', icon: Wallet },
  { label: 'Laba Rugi', href: '/dashboard/profit', icon: BarChart3 },
  { label: 'Target & Pesan', href: '/dashboard/targets', icon: Target },
]

export const Sidebar = () => {
  const pathname = usePathname()
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (process.env.NODE_ENV === 'development') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  return (
    <aside className="w-64 bg-white border-r border-suka-gray-200 p-6 flex flex-col justify-between h-full shadow-sm flex-shrink-0">
      <div className="space-y-6">
        {/* Brand Logo / Header */}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-suka-orange flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
            SS
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-suka-brown text-sm tracking-tight">SUKA SHAWARMA</span>
            <span className="text-[10px] font-bold text-suka-orange tracking-widest uppercase">Owner Hub</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/20 scale-[1.02]'
                    : 'text-suka-ink hover:bg-suka-cream hover:text-suka-brown'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-suka-brown/60'}`} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer link to Portal */}
      <a
        href={resolvedPortalUrl}
        className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-suka-brown/70 hover:bg-suka-cream hover:text-suka-brown border border-suka-gray-200 hover:border-suka-brown/20 transition-all active:scale-95"
      >
        <ArrowLeft className="w-5 h-5 text-suka-brown/60" />
        Portal Operasional
      </a>
    </aside>
  )
}
