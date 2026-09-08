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
    },
    {
      name: 'Data Outlets',
      href: '/dashboard/outlets',
      icon: Store,
    },
    {
      name: 'Data KOL',
      href: '/dashboard/kols',
      icon: Users,
    },
    {
      name: 'Endorsements',
      href: '/dashboard/endorsements',
      icon: Video,
    },
    {
      name: 'Ads Mitra',
      href: '/dashboard/ads',
      icon: Megaphone,
    },
  ]

  if (user.role === 'ADMIN') {
    navItems.push({
      name: 'Manajemen User',
      href: '/dashboard/users',
      icon: ShieldCheck,
    })
  }

  const closeMobile = () => setIsOpen(false)

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold text-sm">
            SS
          </div>
          <span className="font-bold text-gray-900 text-base">Marcom System</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {isOpen && (
        <div
          onClick={closeMobile}
          className="lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 space-x-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center text-white font-black text-base shadow-sm">
            SS
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white leading-tight">
              Suka Shawarma
            </h1>
            <p className="text-xs text-slate-400 font-medium">Marcom Ops System</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Info & Sign Out Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
              {user.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user.name || user.email}
              </p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-wider uppercase ${
                    user.role === 'ADMIN'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {user.role}
                </span>
                <span className="text-[11px] text-slate-400 truncate">{user.email}</span>
              </div>
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/10 border border-red-500/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar (Logout)</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
