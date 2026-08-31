'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { LogOut, User, Loader2, LayoutDashboard, Receipt, CheckSquare, Users, BarChart3, ClipboardCheck, BookOpen, Menu, X, ArrowLeft } from 'lucide-react'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useApprovals } from '../lib/ApprovalsContext'

export type NavItem = { 
  href: string; 
  label: string; 
  icon: any; 
  external?: boolean; 
  appKey?: 'inventori';
  allowedRoles?: string[];
  excludedRoles?: string[];
}
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
      { href: '/resep', label: 'Resep & HPP', icon: BookOpen, excludedRoles: ['area_manager'] },
      { href: '/approvals', label: 'Persetujuan', icon: CheckSquare },
      { href: '/team', label: 'Tim / Kru', icon: Users },
      { href: '/petty-cash', label: 'Petty Cash', icon: Receipt },
    ]
  }
];

// Primary 4 items shown on the mobile bottom bar
const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/approvals', label: 'Persetujuan', icon: CheckSquare },
  { href: '/petty-cash', label: 'Petty Cash', icon: Receipt },
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
  const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false)
  const [inventoriUrl, setInventoriUrl] = useState(
    process.env.NEXT_PUBLIC_APP_URL_INVENTORI || 'https://inventori.sukashawarma.com',
  )
  const { pendingRequests } = useApprovals()

  const brand = "SS"
  const brandAccent = "Manager"
  const homePath = "/"
  const defaultTitle = "Manager Dashboard"

  const isItemVisible = (item: NavItem) => {
    if (!outletStaff) return true
    if (item.excludedRoles && item.excludedRoles.includes(outletStaff.role)) return false
    if (item.allowedRoles && !item.allowedRoles.includes(outletStaff.role)) return false
    return true
  }

  const visibleGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(isItemVisible)
    }))
    .filter(group => group.items.length > 0)

  const allLinks = visibleGroups.flatMap(g => g.items)

  const currentNavPath = allLinks.find(l => !l.external && l.href !== homePath && pathname.startsWith(l.href))?.href ?? homePath
  const currentLink = allLinks.find(l => l.href === currentNavPath)

  const userMenuRef = useRef<HTMLDivElement>(null)

  const isMenuSubItemActive = !PRIMARY_NAV_ITEMS.some(item => item.href === currentNavPath)

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

  // Close sheet on route changes
  useEffect(() => {
    setIsMenuSheetOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-suka-cream">
      {/* Sidebar (Desktop) */}
      <aside className="hidden w-64 shrink-0 border-r border-suka-brown/10 bg-white/80 backdrop-blur-xl md:flex md:flex-col print:hidden shadow-[4px_0_24px_rgba(44,24,16,0.02)] z-20">
        <div className="p-5 border-b border-suka-brown/5 flex items-center gap-3">
          <div className="text-xl font-black text-suka-brown tracking-tight leading-none">{brand}<span className="text-suka-orange">{brandAccent}</span></div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {visibleGroups.map((group) => (
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
                aria-label="User menu"
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
                        onClick={handleLogout}
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

        {/* Mobile Bottom Navigation Bar */}
        <nav 
          className="md:hidden fixed bottom-0 left-0 w-full z-40 bg-white/95 backdrop-blur-2xl border-t border-suka-brown/10 rounded-t-[24px] shadow-[0_-8px_32px_rgba(44,24,16,0.08)] print:hidden"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
        >
          <div className="flex items-center justify-around h-[70px] px-2 pt-1.5">
            {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = currentNavPath === href
              const isApproval = href === '/approvals'
              const count = isApproval ? pendingRequests.length : 0

              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex-1 flex flex-col items-center justify-center gap-1 min-w-0 px-0.5"
                >
                  <span
                    className={`relative flex items-center justify-center transition-all duration-300 ${
                      active
                        ? 'w-10 h-10 rounded-full bg-suka-orange text-white shadow-md shadow-suka-orange/30 scale-105'
                        : 'w-10 h-10 rounded-full bg-transparent text-suka-gray-400 hover:bg-suka-gray-50'
                    }`}
                  >
                    <Icon size={20} className="shrink-0" />
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] tracking-tight leading-tight truncate max-w-full transition-all duration-300 ${
                      active ? 'font-black text-suka-orange scale-100' : 'font-semibold text-suka-gray-400 scale-95'
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              )
            })}

            {/* Menu Sheet Trigger */}
            <button
              type="button"
              onClick={() => setIsMenuSheetOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1 px-0.5 cursor-pointer"
            >
              <span
                className={`relative flex items-center justify-center transition-all duration-300 ${
                  isMenuSubItemActive || isMenuSheetOpen
                    ? 'w-10 h-10 rounded-full bg-suka-orange text-white shadow-md shadow-suka-orange/30 scale-105'
                    : 'w-10 h-10 rounded-full bg-transparent text-suka-gray-400 hover:bg-suka-gray-50'
                }`}
              >
                <Menu size={20} className="shrink-0" />
              </span>
              <span
                className={`text-[10px] tracking-tight leading-tight transition-all duration-300 ${
                  isMenuSubItemActive || isMenuSheetOpen
                    ? 'font-black text-suka-orange scale-100'
                    : 'font-semibold text-suka-gray-400 scale-95'
                }`}
              >
                Menu
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile Full-Nav Bottom Sheet Drawer */}
        {isMenuSheetOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-suka-brown/40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMenuSheetOpen(false)}
            />

            {/* Drawer Container */}
            <div 
              className="relative bg-white/95 backdrop-blur-3xl rounded-t-[32px] border-t border-suka-brown/10 shadow-[0_-10px_40px_rgba(44,24,16,0.15)] max-h-[85vh] overflow-y-auto"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
            >
              {/* Drawer Header */}
              <div className="sticky top-0 bg-white/90 backdrop-blur-xl px-6 pt-5 pb-4 flex items-center justify-between border-b border-suka-brown/5 z-10">
                <div>
                  <div className="text-lg font-black text-suka-brown tracking-tight">
                    {brand}<span className="text-suka-orange">{brandAccent}</span> Menu
                  </div>
                  {outletStaff && (
                    <p className="text-[11px] font-bold text-suka-orange uppercase tracking-wider mt-0.5">
                      {outletStaff.name} • {outletStaff.role.replace('_', ' ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuSheetOpen(false)}
                  className="w-9 h-9 rounded-full bg-suka-gray-50 border border-suka-gray-200/60 flex items-center justify-center text-suka-gray-500 hover:bg-suka-gray-100 hover:text-suka-brown active:scale-95 transition-all cursor-pointer"
                  aria-label="Tutup menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="px-5 py-5 space-y-6">
                {visibleGroups.map((group) => (
                  <div key={group.title}>
                    <h3 className="px-2 mb-3 text-[11px] font-black text-suka-gray-400 uppercase tracking-widest">
                      {group.title}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map(({ href, label, icon: Icon, appKey }) => {
                        const active = currentNavPath === href
                        const isApproval = href === '/approvals'
                        const count = isApproval ? pendingRequests.length : 0
                        const targetHref = appKey === 'inventori' ? inventoriUrl : href

                        return (
                          <Link
                            key={href}
                            href={targetHref}
                            onClick={() => setIsMenuSheetOpen(false)}
                            className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-xs sm:text-sm transition-all active:scale-95 ${
                              active
                                ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/20 scale-[1.02]'
                                : 'bg-white text-suka-brown border border-suka-brown/10 hover:bg-suka-orange/5 hover:border-suka-orange/20'
                            }`}
                          >
                            <Icon size={18} className={active ? 'text-white' : 'text-suka-orange'} />
                            <span className="truncate flex-1">{label}</span>
                            {count > 0 && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-sm border ${
                                active ? 'bg-white text-suka-orange border-white' : 'bg-red-500 text-white border-white'
                              }`}>
                                {count > 9 ? '9+' : count}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Quick Portal & Logout Actions */}
                <div className="pt-2 border-t border-suka-brown/5 space-y-2">
                  <Link
                    href={process.env.NEXT_PUBLIC_PORTAL_URL || "https://app.sukashawarma.com"}
                    onClick={() => setIsMenuSheetOpen(false)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-xs text-suka-brown bg-suka-cream/80 hover:bg-suka-cream border border-suka-brown/10 active:scale-95 transition-all"
                  >
                    <LayoutDashboard size={16} className="text-suka-orange" />
                    Kembali ke Portal
                  </Link>

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 active:scale-95 transition-transform cursor-pointer"
                  >
                    {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} className="text-red-500" />}
                    {isLoggingOut ? 'Keluar...' : 'Logout'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

