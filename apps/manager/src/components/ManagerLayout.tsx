'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { Button } from '@suka/design-system'
import { LogOut, User, Loader2, LayoutDashboard, Receipt, CheckSquare, Users, BarChart3 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'

export type NavItem = { href: string; label: string; icon: any }
export type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Menu Utama',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/transactions', label: 'Transaksi', icon: Receipt },
      { href: '/approvals', label: 'Persetujuan', icon: CheckSquare },
      { href: '/reports', label: 'Laporan', icon: BarChart3 },
    ]
  },
  {
    title: 'Manajemen',
    items: [
      { href: '/team', label: 'Tim / Kru', icon: Users },
    ]
  }
];

interface ManagerLayoutProps {
  children: ReactNode
  headerRight?: ReactNode
}

export function ManagerLayout({ children, headerRight }: ManagerLayoutProps) {
  const pathname = usePathname()
  const { outletStaff, signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const brand = "SS"
  const brandAccent = "Manager"
  const homePath = "/"
  const defaultTitle = "Manager Dashboard"

  const allLinks = NAV_GROUPS.flatMap(g => g.items)

  const currentNavPath = allLinks.find(l => l.href !== homePath && pathname.startsWith(l.href))?.href ?? homePath
  const currentLink = allLinks.find(l => l.href === currentNavPath)

  return (
    <div className="flex h-screen overflow-hidden bg-suka-cream">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-suka-brown/10 bg-white/80 backdrop-blur-xl md:flex md:flex-col print:hidden shadow-[4px_0_24px_rgba(44,24,16,0.02)] z-20">
        <div className="p-5 border-b border-suka-brown/5 flex items-center gap-3">
          <div className="text-xl font-black text-suka-brown tracking-tight leading-none">{brand}<span className="text-suka-orange">{brandAccent}</span></div>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 text-sm">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 mb-2 text-xs font-black tracking-widest text-suka-gray-400/80 uppercase">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = currentNavPath === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold transition-all relative group ${
                        active
                          ? 'bg-suka-orange/10 text-suka-orange shadow-sm'
                          : 'text-suka-gray-500 hover:bg-suka-gray-50 hover:text-suka-brown'
                      }`}
                    >
                      <Icon className={`w-5 h-5 transition-colors ${active ? 'text-suka-orange' : 'text-suka-gray-400 group-hover:text-suka-brown'}`} />
                      <span className="flex-1 truncate">{label}</span>
                      {active && <div className="w-1.5 h-1.5 rounded-full bg-suka-orange animate-pulse" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/75 backdrop-blur-xl border-b border-suka-brown/10 px-4 sm:px-6 py-3.5 flex justify-between items-center gap-3 shadow-[0_2px_12px_rgba(44,24,16,0.02)] flex-shrink-0 print:hidden">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-suka-brown tracking-tight truncate">
              {currentLink?.label ?? defaultTitle}
            </h1>
            {outletStaff && (
              <p className="text-[10px] sm:text-xs font-bold text-suka-orange mt-0.5 uppercase tracking-wider truncate">
                User: {outletStaff.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {headerRight}
            {outletStaff && (
              <div className="hidden sm:flex items-center gap-2 bg-suka-cream px-3 py-1.5 rounded-full border border-suka-brown/5">
                <div className="w-5 h-5 rounded-full bg-suka-brown/10 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-suka-brown" />
                </div>
                <span className="text-xs font-bold text-suka-brown">{outletStaff.name}</span>
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={isLoggingOut}
              onClick={async () => {
                setIsLoggingOut(true)
                try {
                  await signOut()
                } finally {
                  setIsLoggingOut(false)
                }
              }}
              className="flex items-center gap-1.5 !px-3 !py-1.5 !rounded-full border border-suka-brown/20 hover:border-suka-brown text-suka-brown font-bold text-xs cursor-pointer"
            >
              {isLoggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              {isLoggingOut ? 'Keluar...' : 'Keluar'}
            </Button>
          </div>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 pb-28 md:pb-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/90 backdrop-blur-xl rounded-full border border-suka-brown/10 shadow-[0_8px_30px_rgba(44,24,16,0.12)] flex items-center justify-around px-2 py-2 print:hidden">
          {allLinks.map(({ href, label, icon: Icon }) => {
            const active = currentNavPath === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center min-h-[48px] min-w-[64px] gap-1 transition-all rounded-xl ${
                  active ? 'text-suka-orange' : 'text-suka-gray-400 hover:text-suka-brown'
                }`}
              >
                <div className={`p-1.5 rounded-full transition-all ${active ? 'bg-suka-orange/10 text-suka-orange' : 'bg-transparent'}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] ${active ? 'font-black text-suka-orange' : 'font-semibold'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
