'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Absensi', href: '/absensi' },
]

const DISTRIBUSI_ITEMS = [
  { label: 'Surat Jalan', href: '/distribusi/surat-jalan' },
  { label: 'Penerimaan Barang', href: '/distribusi/terima' },
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

      {/* Distribusi Section */}
      <div className="mt-4 pt-4 border-t border-suka-gray-200">
        <p className="text-xs font-semibold text-suka-gray-400 uppercase px-4 mb-2">Distribusi</p>
        <nav className="space-y-1">
          {DISTRIBUSI_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 rounded-md transition-colors text-sm ${
                pathname === item.href
                  ? 'bg-suka-orange text-white'
                  : 'text-suka-brown hover:bg-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  )
}
