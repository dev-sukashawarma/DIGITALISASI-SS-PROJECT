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
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Flame,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'

interface SidebarProps {
  user: {
    email: string
    name: string | null
    role: string
  }
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      name: 'Cabang Outlet',
      href: '/dashboard/outlets',
      icon: Store,
      badge: null,
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
      badge: 'Live',
    },
    {
      name: 'Ads Mitra',
      href: '/dashboard/ads',
      icon: Megaphone,
      badge: null,
    },
  ]

  if (user.role === 'ADMIN') {
    navItems.push({
      name: 'Akses & Role',
      href: '/dashboard/users',
      icon: ShieldCheck,
      badge: 'Admin',
    })
  }

  const closeMobile = () => setIsOpen(false)

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden flex items-center justify-between bg-[#1C1917] text-stone-100 border-b border-stone-800 px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D9480F] to-[#B83808] flex items-center justify-center text-white font-black text-sm shadow-sm">
            <Flame className="w-4 h-4 text-amber-200 fill-amber-200" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight block leading-tight">
              Suka Shawarma
            </span>
            <span className="text-[10px] text-amber-400/80 font-medium">Marcom Ops</span>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800/80 transition-colors"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {isOpen && (
        <div
          onClick={closeMobile}
          className="lg:hidden fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#1C1917] text-stone-200 flex flex-col border-r border-stone-800/80 transition-transform duration-200 ease-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center px-5 border-b border-stone-800/80 space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E8590C] via-[#D9480F] to-[#9C3106] flex items-center justify-center text-white shadow-md shadow-orange-950/40 ring-1 ring-white/15 flex-shrink-0">
            <Flame className="w-5 h-5 text-amber-100 fill-amber-200" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm tracking-tight text-white leading-tight flex items-center gap-1.5">
              <span>Suka Shawarma</span>
            </h1>
            <p className="text-[11px] text-stone-400 font-medium tracking-wide">
              Marcom Operations Desk
            </p>
          </div>
        </div>

        {/* Section Label */}
        <div className="px-5 pt-5 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Navigasi Utama
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-[#D9480F] text-white shadow-sm shadow-orange-950/30'
                    : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-stone-400 group-hover:text-amber-400'
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                      isActive
                        ? 'bg-black/25 text-white'
                        : 'bg-stone-800 text-stone-300 border border-stone-700/50'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Card & Sign Out Footer */}
        <div className="p-3.5 border-t border-stone-800/80 bg-stone-900/40 m-2.5 rounded-2xl">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 flex items-center justify-center text-xs font-bold text-amber-200">
              {user.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-100 truncate">
                {user.name || user.email.split('@')[0]}
              </p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase ${
                    user.role === 'ADMIN'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                  }`}
                >
                  {user.role}
                </span>
                <span className="text-[10px] text-stone-400 truncate max-w-[90px]">
                  {user.email}
                </span>
              </div>
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Akun</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
