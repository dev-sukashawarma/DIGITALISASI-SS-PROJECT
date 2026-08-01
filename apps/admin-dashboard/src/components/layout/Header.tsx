'use client'

import { useAuth } from '@suka/auth'
import { LogOut, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { labelForPath } from './navConfig'

function formatRoleName(role?: string) {
  if (!role) return 'Staff'
  const map: Record<string, string> = {
    leader: 'Leader',
    area_manager: 'Area Manager',
    admin_finance: 'Finance',
    admin_hr: 'HR Admin',
    staff_pusat: 'Staff Pusat',
    owner: 'Owner',
    spv: 'Supervisor',
    crew: 'Crew',
    admin: 'Admin',
    kitchen: 'Kitchen',
    mitra: 'Mitra',
  }
  return map[role] || role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

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
    <header className="bg-[#FDF9F3] px-6 sm:px-10 py-5 sm:py-7 flex justify-between items-center gap-3 flex-shrink-0 print:hidden font-sans sticky top-0 z-50">
      <div className="min-w-0 flex items-center gap-2">
        <div className="w-1.5 h-4 bg-suka-orange/80 rounded-full hidden sm:block"></div>
        <h1 className="text-xs sm:text-sm font-bold text-suka-brown/50 tracking-widest uppercase truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Command Menu Trigger */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
            document.dispatchEvent(event)
          }}
          className="hidden md:flex items-center gap-2 bg-white hover:bg-gray-50 hover:scale-105 active:scale-95 px-4 py-2 rounded-full text-suka-brown/60 transition-all text-xs font-bold shadow-sm"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Cari...</span>
          <kbd className="bg-suka-cream px-1.5 py-0.5 rounded-md text-[9px] font-black border border-suka-brown/5 text-suka-brown/50 uppercase">⌘K</kbd>
        </button>

        <div className="flex items-center bg-white rounded-full p-1 shadow-sm">
          {/* User profile capsule with Name & Role */}
          {outletStaff && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 pl-1.5">
              <div className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center text-suka-orange font-bold text-[10px]">
                {outletStaff.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-suka-brown pr-2">
                {outletStaff.name} <span className="text-[9px] text-suka-orange uppercase ml-1 tracking-wider">{formatRoleName(outletStaff.role)}</span>
              </span>
            </div>
          )}

          <div className="w-[1px] h-4 bg-gray-100 hidden sm:block mx-1"></div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full hover:bg-red-50 text-suka-brown hover:text-red-600 font-bold text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </div>
    </header>
  )
}
