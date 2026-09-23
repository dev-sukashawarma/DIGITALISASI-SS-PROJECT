'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Store,
  Users,
  Video,
  Megaphone,
  Calendar,
  Clapperboard,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Flame,
  ChevronDown,
  DollarSign,
  ExternalLink,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'

export type SidebarMode = 'expanded' | 'collapsed' | 'hidden'

interface NavChild {
  name: string
  href: string
  icon?: any
  badge?: string | null
}

interface NavItem {
  name: string
  href: string
  icon: any
  badge?: string | null
  children?: NavChild[]
}

interface SidebarProps {
  user: {
    email: string
    name: string | null
    role: string
  }
  mode: SidebarMode
  onModeChange: (mode: SidebarMode) => void
  isMobileOpen: boolean
  onMobileToggle: (open: boolean) => void
}

export default function Sidebar({
  user,
  mode,
  onModeChange,
  isMobileOpen,
  onMobileToggle,
}: SidebarProps) {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    '/dashboard/content-planner': true,
    '/dashboard/budget': true,
  })

  const toggleMenu = (href: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedMenus((prev) => ({
      ...prev,
      [href]: !prev[href],
    }))
  }

  const navItems: NavItem[] = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      name: 'Kalender Marcom',
      href: '/dashboard/calendar',
      icon: Calendar,
      badge: null,
    },
    {
      name: 'Cabang Outlet',
      href: '/dashboard/outlets',
      icon: Store,
      badge: null,
    },
    {
      name: 'Budget & OPEX',
      href: '/dashboard/budget',
      icon: DollarSign,
      badge: null,
      children: [
        {
          name: 'Matriks Budget Outlet',
          href: '/dashboard/budget',
          badge: null,
        },
        {
          name: 'OPEX & Pengeluaran',
          href: '/dashboard/budget/opex',
          badge: null,
        },
      ],
    },
    {
      name: 'Database KOL',
      href: '/dashboard/kols',
      icon: Users,
      badge: null,
    },
    {
      name: 'Endorsements',
      href: '/dashboard/endorsements',
      icon: Video,
      badge: null,
    },
    {
      name: 'Ads & Paid Traffic',
      href: '/dashboard/ads',
      icon: Megaphone,
      badge: null,
    },
    {
      name: 'Konten Planner',
      href: '/dashboard/content-planner',
      icon: Clapperboard,
      badge: null,
      children: [
        {
          name: 'Rencana Konten',
          href: '/dashboard/content-planner',
          badge: null,
        },
        {
          name: 'Metrik Data',
          href: '/dashboard/content-planner/metrik-data',
          badge: null,
        },
        {
          name: 'Referensi Data',
          href: '/dashboard/content-planner/referensi-data',
          badge: null,
        },
        {
          name: 'Pengaturan Konten',
          href: '/dashboard/content-planner/pengaturan',
          badge: null,
        },
      ],
    },
  ]

  if (user.role === 'ADMIN') {
    navItems.push({
      name: 'Akses & Role',
      href: '/dashboard/users',
      icon: ShieldCheck,
      badge: null,
    })
  }

  const closeMobile = () => onMobileToggle(false)

  const portalUrl =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
      ? 'http://localhost:3010'
      : (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')

  return (
    <>
      {/* Mobile Topbar (< lg) */}
      <div className="lg:hidden flex items-center justify-between bg-[#1C1917] text-stone-100 border-b border-stone-800 px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-center p-0.5 shadow-sm overflow-hidden shrink-0">
            <img src="/logo.png" alt="MARCOM SS" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight block leading-tight">
              MARCOM SS
            </span>
            <span className="text-xs text-amber-400/80 font-medium">Suka Shawarma</span>
          </div>
        </div>
        <button
          onClick={() => onMobileToggle(!isMobileOpen)}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="lg:hidden fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-40 transition-opacity cursor-pointer"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#1C1917] text-stone-200 flex flex-col border-r border-stone-800/80 transition-all duration-300 ease-in-out ${
          // Mobile state
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'
        } ${
          // Desktop state
          mode === 'expanded'
            ? 'lg:translate-x-0 lg:w-64 lg:visible lg:opacity-100'
            : mode === 'collapsed'
            ? 'lg:translate-x-0 lg:w-[72px] lg:visible lg:opacity-100'
            : 'lg:-translate-x-full lg:w-64 lg:invisible lg:opacity-0 pointer-events-none'
        }`}
      >
        {/* ========================================================= */}
        {/* EXPANDED VIEW (Desktop Expanded or Mobile Drawer)        */}
        {/* ========================================================= */}
        <div
          className={`flex flex-col h-full ${
            mode === 'collapsed' ? 'lg:hidden' : mode === 'hidden' ? 'lg:hidden' : 'flex'
          }`}
        >
          {/* Brand Header */}
          <div className="h-20 flex items-center justify-between px-4 border-b border-stone-800/80">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center p-1 shadow-md shadow-orange-950/20 ring-1 ring-white/10 shrink-0 overflow-hidden">
                <img src="/logo.png" alt="MARCOM SS" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="font-extrabold text-sm tracking-tight text-white leading-tight flex items-center gap-1.5">
                  <span>MARCOM SS</span>
                </h1>
                <p className="text-xs text-stone-400 font-medium tracking-wide truncate">
                  Suka Shawarma Marcom Desk
                </p>
              </div>
            </div>

            {/* Desktop Close & Collapse Action Buttons */}
            <div className="hidden lg:flex items-center space-x-1">
              <button
                type="button"
                onClick={() => onModeChange('collapsed')}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
                title="Perkecil ke Icon Rail (Mini)"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onModeChange('hidden')}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
                title="Tutup Sidebar Penuh (Ctrl+B)"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={closeMobile}
              className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title="Tutup menu navigasi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section Label */}
          <div className="px-5 pt-5 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Navigasi Utama
            </span>
          </div>

          {/* Navigation Items (Expanded) */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const hasChildren = item.children && item.children.length > 0
              const isParentActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)
              const isExpanded = hasChildren && (expandedMenus[item.href] ?? isParentActive)

              return (
                <div key={item.href} className="space-y-1">
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      isParentActive && !hasChildren
                        ? 'bg-[#D9480F] text-white shadow-sm shadow-orange-950/30'
                        : isParentActive && hasChildren
                        ? 'bg-stone-800/90 text-white border border-stone-700/50'
                        : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isParentActive ? 'text-amber-400' : 'text-stone-400 group-hover:text-amber-400'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                            isParentActive && !hasChildren
                              ? 'bg-black/25 text-white'
                              : 'bg-stone-800 text-stone-300 border border-stone-700/50'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {hasChildren && (
                        <button
                          type="button"
                          onClick={(e) => toggleMenu(item.href, e)}
                          className="p-1 -mr-1 rounded-md hover:bg-stone-700/50 transition-colors cursor-pointer"
                          title={isExpanded ? 'Tutup sub-menu' : 'Buka sub-menu'}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                              isExpanded ? 'rotate-0 text-amber-400' : '-rotate-90 text-stone-500'
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </Link>

                  {/* Sub-menu / Children */}
                  {hasChildren && isExpanded && (
                    <div className="ml-3 pl-3 border-l-2 border-stone-800 space-y-1 py-1 animate-in fade-in duration-150">
                      {item.children!.map((child) => {
                        const isChildActive =
                          child.href === '/dashboard/content-planner' || child.href === '/dashboard/budget'
                            ? pathname === child.href
                            : pathname === child.href || pathname.startsWith(child.href)

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={closeMobile}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                              isChildActive
                                ? 'bg-[#D9480F] text-white shadow-xs font-bold'
                                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/50'
                            }`}
                          >
                            <span className="truncate">{child.name}</span>

                            {child.badge && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  isChildActive
                                    ? 'bg-black/25 text-white'
                                    : 'bg-stone-800 text-stone-400 border border-stone-700/40'
                                }`}
                              >
                                {child.badge}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User Card & Sign Out Footer */}
          <div className="p-3.5 border-t border-stone-800/80 bg-stone-900/40 m-2.5 rounded-2xl">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 flex items-center justify-center text-xs font-bold text-amber-200 shrink-0">
                {user.email.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-100 truncate">
                  {user.name || user.email.split('@')[0]}
                </p>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-extrabold tracking-wider uppercase ${
                      user.role === 'ADMIN'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                    }`}
                  >
                    {user.role}
                  </span>
                  <span className="text-xs text-stone-400 truncate max-w-[90px]">
                    {user.email}
                  </span>
                </div>
              </div>
            </div>

            <a
              href={portalUrl}
              className="w-full flex items-center justify-between px-3 py-1.5 mb-1.5 rounded-lg text-xs font-medium text-amber-200/90 hover:text-amber-100 hover:bg-amber-500/10 transition-colors border border-amber-500/20"
            >
              <div className="flex items-center space-x-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Portal Aplikasi</span>
              </div>
              <ExternalLink className="w-3 h-3 text-amber-400/70" />
            </a>

            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Akun</span>
              </button>
            </form>
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLLAPSED VIEW (Desktop Mini Icon Rail, 72px)            */}
        {/* ========================================================= */}
        <div
          className={`hidden flex-col h-full ${
            mode === 'collapsed' ? 'lg:flex' : 'hidden'
          }`}
        >
          {/* Header Mini */}
          <div className="h-20 flex flex-col items-center justify-center border-b border-stone-800/80 p-2 relative">
            <div className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-center p-0.5 shadow-sm overflow-hidden shrink-0">
              <img src="/logo.png" alt="MARCOM SS" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center space-x-1 mt-1.5">
              <button
                type="button"
                onClick={() => onModeChange('expanded')}
                className="p-1 rounded-md text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Buka Sidebar Penuh (Ctrl+B)"
              >
                <PanelLeftOpen className="w-3.5 h-3.5 text-amber-400" />
              </button>
              <button
                type="button"
                onClick={() => onModeChange('hidden')}
                className="p-1 rounded-md text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Tutup Sidebar Penuh"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Navigation Items (Mini) */}
          <nav className="flex-1 py-3 px-2 space-y-2 overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon
              const hasChildren = item.children && item.children.length > 0
              const isParentActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)

              return (
                <div key={item.href} className="relative group flex justify-center">
                  <Link
                    href={item.href}
                    className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-150 ${
                      isParentActive
                        ? 'bg-[#D9480F] text-white shadow-md shadow-orange-950/40'
                        : 'text-stone-400 hover:text-white hover:bg-stone-800/80'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                  </Link>

                  {/* Floating Popover / Tooltip */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:flex flex-col bg-[#1C1917] border border-stone-700/90 rounded-xl shadow-2xl z-50 min-w-[190px] p-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1 flex items-center justify-between gap-2 border-b border-stone-800/80 pb-1.5 mb-1">
                      <span className="text-xs font-bold text-white whitespace-nowrap">
                        {item.name}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {hasChildren && (
                      <div className="space-y-0.5">
                        {item.children!.map((child) => {
                          const isChildActive =
                            child.href === '/dashboard/content-planner' || child.href === '/dashboard/budget'
                              ? pathname === child.href
                              : pathname === child.href || pathname.startsWith(child.href)

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`block px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isChildActive
                                  ? 'bg-[#D9480F] text-white font-bold'
                                  : 'text-stone-400 hover:text-white hover:bg-stone-800/80'
                              }`}
                            >
                              <span className="truncate">{child.name}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </nav>

          {/* User Mini Footer */}
          <div className="p-2 border-t border-stone-800/80 flex flex-col items-center space-y-2 mb-2">
            <div className="relative group">
              <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-xs font-bold text-amber-200 cursor-default">
                {user.email.slice(0, 2).toUpperCase()}
              </div>
              <div className="absolute left-full bottom-0 ml-2.5 hidden group-hover:flex flex-col bg-[#1C1917] border border-stone-700/90 rounded-xl shadow-2xl z-50 min-w-[180px] p-2.5 animate-in fade-in zoom-in-95 duration-100">
                <p className="text-xs font-bold text-white truncate">
                  {user.name || user.email.split('@')[0]}
                </p>
                <p className="text-[11px] text-stone-400 truncate">{user.email}</p>
                <span className="inline-block mt-1 self-start px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {user.role}
                </span>
              </div>
            </div>

            <div className="relative group">
              <a
                href={portalUrl}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-colors"
              >
                <Flame className="w-4 h-4" />
              </a>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:block bg-[#1C1917] border border-stone-700/90 rounded-lg shadow-2xl z-50 px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                Portal Aplikasi
              </div>
            </div>

            <div className="relative group">
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-300 hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:block bg-[#1C1917] border border-stone-700/90 rounded-lg shadow-2xl z-50 px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                Keluar Akun
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
