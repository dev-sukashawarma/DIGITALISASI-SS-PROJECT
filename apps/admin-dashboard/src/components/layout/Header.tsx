'use client'

import { Button } from '@suka/design-system'
import { useAuth } from '@suka/auth'
import { LogOut, User, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { labelForPath } from './navConfig'

export const Header = () => {
  const { outletStaff, signOut } = useAuth()
  const pathname = usePathname()

  const title = labelForPath(pathname)

  const handleLogout = async () => {
    await signOut()
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
    let url = portalUrl
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      url = 'http://localhost:3010'
    }
    window.location.href = url
  }

  return (
    <header className="bg-white border-b border-suka-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-3 shadow-sm flex-shrink-0 print:hidden">
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-extrabold text-suka-brown tracking-tight truncate">{title}</h1>
        {outletStaff && (
          <p className="text-[10px] sm:text-xs font-bold text-suka-orange mt-0.5 uppercase tracking-wider truncate">
            User: {outletStaff.name}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Command Menu Trigger */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
            document.dispatchEvent(event)
          }}
          className="hidden md:flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 transition-colors text-xs font-medium"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Cari...</span>
          <kbd className="bg-white px-1.5 py-0.5 rounded shadow-sm text-[10px] font-bold border border-gray-200 text-gray-400">⌘K</kbd>
        </button>

        {/* User profile capsule */}
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
          onClick={handleLogout}
          className="flex items-center gap-1.5 !px-3 !py-1.5 !rounded-full border border-suka-brown/20 hover:border-suka-brown text-suka-brown font-bold text-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          Keluar
        </Button>
      </div>
    </header>
  )
}
