'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, LogOut } from 'lucide-react'
import { useAuth } from '@suka/auth'
import { NAV_GROUPS, ALL_NAV_ITEMS, isItemActive, resolvePortalUrl } from './navConfig'
import { useLeaveNotifications } from '@/hooks/useLeaveNotifications'
import { ConfirmLogoutDialog } from './ConfirmLogoutDialog'

export const BottomNav = () => {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isLogoutOpen, setIsLogoutOpen] = useState(false)
  const { pendingCount } = useLeaveNotifications()

  // Primary 4 items on bottom bar
  const inline = ALL_NAV_ITEMS.slice(0, 4)
  const resolvedPortalUrl = resolvePortalUrl()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    window.location.href = resolvedPortalUrl
  }

  return (
    <>
      {/* Bottom Tab Bar (mobile only) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 w-full z-40 bg-white/95 backdrop-blur-2xl border-t border-suka-orange/10 rounded-t-[24px] shadow-[0_-8px_32px_rgba(112,22,4,0.05)] print:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div className="flex items-center justify-around h-[76px] px-2 pt-2">
          {inline.map(({ href, label, shortLabel, icon: Icon }) => {
            const isActive = isItemActive(href, pathname)
            return (
              <Link
                key={href}
                href={href}
                className="relative flex-1 flex flex-col items-center justify-center gap-1 min-w-0 px-0.5"
              >
                <span
                  className={`relative flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'w-10 h-10 rounded-full bg-gradient-to-br from-suka-orange to-suka-brown shadow-md shadow-suka-orange/30 scale-105' 
                      : 'w-10 h-10 rounded-full bg-transparent hover:bg-suka-gray-50'
                  }`}
                >
                  <Icon
                    size={20}
                    className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-suka-gray-400'}`}
                  />
                  {href === '/leave' && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] font-extrabold tracking-wide leading-tight truncate max-w-full transition-all duration-300 ${
                    isActive ? 'text-suka-brown scale-100' : 'text-suka-gray-400 scale-95'
                  }`}
                >
                  {shortLabel ?? label}
                </span>
              </Link>
            )
          })}

          {/* Menu trigger */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 px-0.5 cursor-pointer"
          >
            <span 
              className={`relative flex items-center justify-center transition-all duration-300 ${
                sheetOpen 
                  ? 'w-10 h-10 rounded-full bg-gradient-to-br from-suka-orange to-suka-brown shadow-md shadow-suka-orange/30 scale-105' 
                  : 'w-10 h-10 rounded-full bg-transparent hover:bg-suka-gray-50'
              }`}
            >
              <Menu size={20} className={`shrink-0 transition-colors ${sheetOpen ? 'text-white' : 'text-suka-gray-400'}`} />
            </span>
            <span 
              className={`text-[10px] font-extrabold tracking-wide leading-tight transition-all duration-300 ${
                sheetOpen ? 'text-suka-brown scale-100' : 'text-suka-gray-400 scale-95'
              }`}
            >
              Menu
            </span>
          </button>
        </div>
      </nav>

      {/* Full-nav bottom sheet */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-suka-brown/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSheetOpen(false)}
          />

          <div className="relative bg-white/95 backdrop-blur-3xl rounded-t-[32px] border-t border-white shadow-[0_-10px_40px_rgba(112,22,4,0.1)] max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl px-6 pt-5 pb-4 flex items-center justify-between border-b border-suka-brown/5 z-10">
              <div className="text-xl font-extrabold text-suka-brown tracking-tight">
                Suka<span className="text-suka-orange">HR</span> Menu
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-10 h-10 rounded-full bg-suka-gray-50 border border-suka-gray-100 flex items-center justify-center text-suka-gray-500 hover:bg-suka-gray-100 hover:text-suka-brown active:scale-95 transition-all cursor-pointer"
                aria-label="Tutup menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-6">
              {NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="px-2 mb-3 text-[11px] font-black text-suka-gray-400 uppercase tracking-widest">
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const isActive = isItemActive(href, pathname)
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setSheetOpen(false)}
                          className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-sm transition-all active:scale-95 ${
                            isActive
                              ? 'bg-gradient-to-br from-suka-orange to-suka-brown text-white shadow-md shadow-suka-orange/20 scale-[1.02]'
                              : 'bg-white/50 text-suka-ink border border-suka-gray-100 hover:bg-white hover:border-suka-gray-200 hover:shadow-sm'
                          }`}
                        >
                          <Icon size={18} className={isActive ? 'text-white' : 'text-suka-orange'} />
                          <span className="truncate flex-1">{label}</span>
                          {href === '/leave' && pendingCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm border border-white">
                              {pendingCount}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setIsLogoutOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 active:scale-95 transition-transform cursor-pointer"
              >
                <LogOut size={16} className="text-red-500" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmLogoutDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </>
  )
}
