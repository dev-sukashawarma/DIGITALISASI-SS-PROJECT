'use client'

import { useAuth } from '@suka/auth'
import { LayoutDashboard, LogOut, Search, ChevronDown, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { labelForPath, resolvePortalUrl } from './navConfig'
import { ConfirmLogoutDialog } from './ConfirmLogoutDialog'

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
  const [isLogoutOpen, setIsLogoutOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const title = labelForPath(pathname)
  const portalUrl = resolvePortalUrl()

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

  const handleLogout = async () => {
    await signOut()
    window.location.href = portalUrl
  }

  const roleLabel = outletStaff?.role ? formatRoleName(outletStaff.role) : 'Owner'

  return (
    <header className="bg-[#FDF9F3] px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center gap-3 flex-shrink-0 print:hidden font-sans sticky top-0 z-50 border-b border-suka-brown/5">
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
          className="hidden md:flex items-center gap-2 bg-white hover:bg-gray-50 hover:scale-105 active:scale-95 px-4 py-2 rounded-full text-suka-brown/60 transition-all text-xs font-bold shadow-xs border border-suka-brown/5 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Cari...</span>
          <kbd className="bg-suka-cream px-1.5 py-0.5 rounded-md text-[9px] font-black border border-suka-brown/5 text-suka-brown/50 uppercase">⌘K</kbd>
        </button>

        {/* User Avatar Dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white hover:bg-orange-50/50 border border-suka-brown/10 shadow-xs transition-all active:scale-95 cursor-pointer"
            aria-label="User Menu"
          >
            <div className="w-6 h-6 rounded-full bg-suka-orange/15 border border-suka-orange/25 flex items-center justify-center text-suka-orange shrink-0">
              <User size={13} className="text-suka-orange" />
            </div>
            <span className="text-xs font-bold text-suka-brown">
              {roleLabel}
            </span>
            <ChevronDown size={13} className={`text-suka-brown/40 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isUserMenuOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setIsUserMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-[0_10px_40px_rgba(44,24,16,0.12)] border border-suka-brown/10 py-1.5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {outletStaff && (
                  <div className="px-4 py-3 border-b border-suka-brown/5 bg-suka-cream/30">
                    <p className="text-sm font-bold text-suka-brown truncate">{outletStaff.name}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-suka-orange/10 text-suka-orange rounded-md text-[10px] font-black uppercase tracking-wider">
                      {formatRoleName(outletStaff.role)}
                    </span>
                  </div>
                )}

                <div className="py-1">
                  <Link
                    href={portalUrl}
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-orange/10 hover:text-suka-orange transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-suka-orange" />
                    <span>Portal Aplikasi</span>
                  </Link>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      setIsLogoutOpen(true)
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmLogoutDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </header>
  )
}
