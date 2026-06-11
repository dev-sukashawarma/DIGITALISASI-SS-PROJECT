'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Opname Stok', href: '/stok/opname' },
  { label: 'Ledger', href: '/stok/ledger' },
  { label: 'Monitoring', href: '/stok/monitoring' },
  { label: 'Live Monitoring', href: '/stok/monitoring-live' },
]

export const Sidebar = () => {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-suka-cream border-r border-suka-gray-200 p-6">
      <nav className="space-y-2">
        {MENU_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2 rounded-md transition-colors ${
              pathname === item.href
                ? 'bg-suka-orange text-white'
                : 'text-suka-brown hover:bg-white'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
