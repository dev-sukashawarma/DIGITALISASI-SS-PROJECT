'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { LayoutDashboard, ArrowLeftRight, Landmark, Repeat, LogOut } from 'lucide-react'

const LINKS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transaksi', label: 'Transaksi', icon: ArrowLeftRight },
  { href: '/transfer', label: 'Transfer', icon: Repeat },
  { href: '/lokasi', label: 'Rekening & Kas', icon: Landmark },
]

export function CashNav() {
  const pathname = usePathname()
  const { outletStaff, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-30 border-b border-suka-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-2">
        <span className="mr-4 font-bold text-suka-brown">Suka Finance</span>
        <nav className="flex flex-1 items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-suka-brown text-white'
                    : 'text-suka-gray-600 hover:bg-suka-cream'
                }`}
              >
                <Icon size={16} /> {label}
              </Link>
            )
          })}
        </nav>
        <span className="hidden text-sm text-suka-gray-500 sm:inline">
          {outletStaff?.name} · {outletStaff?.role}
        </span>
        <button
          onClick={() => signOut()}
          className="ml-2 flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-suka-gray-600 hover:bg-suka-cream"
        >
          <LogOut size={16} /> Keluar
        </button>
      </div>
    </header>
  )
}
