'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { Button } from '@suka/design-system'
import { LogOut, User, Loader2, LayoutDashboard, Receipt, CheckSquare, Users, BarChart3, ClipboardCheck, BookOpen } from 'lucide-react'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useApprovals } from '../lib/ApprovalsContext'

export type NavItem = { href: string; label: string; icon: any; external?: boolean; appKey?: 'inventori' }
export type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Menu Utama',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/reports', label: 'Laporan', icon: BarChart3 },
      { href: '/inventori', label: 'Inventaris', icon: ClipboardCheck, external: true, appKey: 'inventori' },
    ]
  },
  {
    title: 'Manajemen',
    items: [
      { href: '/resep', label: 'Resep & HPP', icon: BookOpen },
      { href: '/approvals', label: 'Persetujuan', icon: CheckSquare },
      { href: '/team', label: 'Tim / Kru', icon: Users },
      { href: '/petty-cash', label: 'Petty Cash', icon: Receipt },
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [inventoriUrl, setInventoriUrl] = useState(
    process.env.NEXT_PUBLIC_APP_URL_INVENTORI || 'https://inventori.sukashawarma.com',
  )
  const { pendingRequests } = useApprovals()

  const brand = "SS"
  const brandAccent = "Manager"
  const homePath = "/"
  const defaultTitle = "Manager Dashboard"

  const allLinks = NAV_GROUPS.flatMap(g => g.items)

  const currentNavPath = allLinks.find(l => !l.external && l.href !== homePath && pathname.startsWith(l.href))?.href ?? homePath
  const currentLink = allLinks.find(l => l.href === currentNavPath)

  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isUserMenuOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [isUserMenuOpen])

  useEffect(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setInventoriUrl('http://localhost:3011')
    }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-suka-cream">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-suka-brown/10 bg-white/80 backdrop-blur-xl md:flex md:flex-col print:hidden shadow-[4px_0_24px_rgba(44,24,16,0.02)] z-20">
        <div className="p-5 border-b border-suka-brown/5 flex items-center gap-3">
          <div className="text-xl font-black text-suka-brown tracking-tight leading-none">{brand}<span className="text-suka-orange">{brandAccent}</span></div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 text-[10px] font-black uppercase tracking-wider text-suka-gray-400 mb-2">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, appKey }) => {
                  const active = currentNavPath === href
                  const isApproval = href === '/approvals'
                  const count = isApproval ? pendingRequests.length : 0
                  const targetHref = appKey === 'inventori' ? inventoriUrl : href

                  return (
                    <Link
                      key={href}
                      href={targetHref}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        active
                          ? 'bg-suka-orange text-white shadow-xs'
                          : 'text-suka-brown/70 hover:bg-suka-brown/5 hover:text-suka-brown'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-suka-gray-400'}`} />
                        <span>{label}</span>
                      </div>
                      {count > 0 && (
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                          active 
                            ? 'bg-white text-suka-orange' 
                            : 'bg-suka-orange text-white'
                        }`}>
                          {count}
                        </span>
                      )}
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
        <header className="relative z-30 bg-white/75 backdrop-blur-xl border-b border-suka-brown/10 px-4 sm:px-6 py-3.5 flex justify-between items-center gap-3 shadow-[0_2px_12px_rgba(44,24,16,0.02)] flex-shrink-0 print:hidden">
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
            <div ref={userMenuRef} className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-suka-gray-50 transition-colors border border-suka-brown/20 shadow-sm cursor-pointer"
              >
                <User className="w-4 h-4 text-suka-brown" />
              </button>
              
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-[0_10px_40px_rgba(44,24,16,0.15)] border border-suka-brown/10 py-1.5 z-50 overflow-hidden">
                    {outletStaff && (
                      <div className="px-4 py-3 border-b border-suka-brown/5 bg-suka-cream/30">
                        <p className="text-sm font-bold text-suka-brown truncate">{outletStaff.name}</p>
                        <p className="text-[11px] text-suka-gray-500 capitalize mt-0.5">{outletStaff.role.replace('_', ' ')}</p>
                      </div>
                    )}
                    <div className="py-1">
                      <Link 
                        href={process.env.NEXT_PUBLIC_PORTAL_URL || "https://app.sukashawarma.com"} 
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-orange/10 hover:text-suka-orange transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Kembali ke Portal
                      </Link>
                      <button 
                        onClick={async () => {
                          setIsLoggingOut(true)
                          try {
                            await signOut()
                          } finally {
                            setIsLoggingOut(false)
                          }
                        }}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left cursor-pointer"
                      >
                        {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 text-red-500" />}
                        {isLoggingOut ? 'Keluar...' : 'Logout'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto w-full">
          <div className={`${pathname.startsWith('/resep') ? 'w-full' : 'max-w-7xl mx-auto'} p-3 sm:p-6 lg:p-8 pb-28 md:pb-8`}>
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/90 backdrop-blur-xl rounded-full border border-suka-brown/10 shadow-[0_8px_30px_rgba(44,24,16,0.12)] flex items-center justify-around px-2 py-2 print:hidden">
          {allLinks.map(({ href, label, icon: Icon, appKey }) => {
            const active = currentNavPath === href
            const targetHref = appKey === 'inventori' ? inventoriUrl : href
            return (
              <Link
                key={href}
                href={targetHref}
                className={`flex flex-col items-center justify-center min-h-[48px] min-w-[64px] gap-1 transition-all rounded-xl relative ${
                  active ? 'text-suka-orange' : 'text-suka-gray-400 hover:text-suka-brown'
                }`}
              >
                <div className={`p-1.5 rounded-full transition-all ${active ? 'bg-suka-orange/10 text-suka-orange' : 'bg-transparent'}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] ${active ? 'font-black text-suka-orange' : 'font-semibold'}`}>
                  {label}
                </span>
                {href === '/approvals' && pendingRequests.length > 0 && (
                  <div className="absolute top-1 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">{pendingRequests.length > 9 ? '9+' : pendingRequests.length}</span>
                  </div>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
