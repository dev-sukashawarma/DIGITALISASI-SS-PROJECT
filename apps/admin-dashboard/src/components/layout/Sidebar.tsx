'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Store } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/outlets', label: 'Outlet', icon: Store },
  { href: '/dashboard/staff', label: 'Staff', icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden w-56 shrink-0 border-r border-suka-gray-200 bg-white md:block">
      <div className="p-4 text-lg font-extrabold text-suka-brown">Admin</div>
      <nav className="space-y-1 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-suka-orange/10 text-suka-orange' : 'text-gray-600 hover:bg-suka-gray-50'}`}>
              <Icon size={18} /> {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
