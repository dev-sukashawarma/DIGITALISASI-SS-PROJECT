'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, ArrowLeft } from 'lucide-react'
import { useRole } from './RoleContext'
import { NAV_GROUPS, accessibleItems, isItemActive, resolvePortalUrl } from './navConfig'
import { useLeaveNotifications } from '@/hooks/useLeaveNotifications'

export const BottomNav = () => {
  const pathname = usePathname()
  const { role } = useRole()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { pendingCount } = useLeaveNotifications()

  const items = accessibleItems(role)
  // Show up to 4 primary items inline; the rest live in the "Menu" sheet.
  const inline = items.slice(0, 4)
  const resolvedPortalUrl = resolvePortalUrl()

  return (
    <>
      {/* Bottom Tab Bar (mobile only) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-suka-gray-200 shadow-[0_-4px_24px_-8px_rgba(112,22,4,0.18)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch h-16 px-1">
          {inline.map(({ href, label, shortLabel, icon: Icon }) => {
            const isActive = isItemActive(href, pathname)
            return (
              <Link
                key={href}
                href={href}
                className="relative flex-1 flex flex-col items-center justify-center gap-1 min-w-0 px-0.5"
              >
                {isActive && (
                  <span className="absolute top-0 h-1 w-8 rounded-full bg-suka-orange" />
                )}
                <span
                  className={`relative flex items-center justify-center rounded-xl transition-all ${
                    isActive ? 'bg-suka-orange/10 px-3 py-1' : 'px-3 py-1'
                  }`}
                >
                  <Icon
                    size={20}
                    className={`shrink-0 transition-colors ${isActive ? 'text-suka-orange' : 'text-suka-gray-400'}`}
                  />
                  {href === '/dashboard/hr/leave' && pendingCount > 0 && (
                    <span className="absolute top-0 right-1 translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                      {pendingCount}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] font-bold leading-none truncate max-w-full transition-colors ${
                    isActive ? 'text-suka-orange' : 'text-suka-gray-500'
                  }`}
                >
                  {shortLabel ?? label}
                </span>
              </Link>
            )
          })}

          {/* Menu trigger (always present) */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 px-0.5"
          >
            <span className={`flex items-center justify-center rounded-xl px-3 py-1 transition-all ${sheetOpen ? 'bg-suka-orange/10' : ''}`}>
              <Menu size={20} className={`shrink-0 ${sheetOpen ? 'text-suka-orange' : 'text-suka-gray-400'}`} />
            </span>
            <span className={`text-[10px] font-bold leading-none ${sheetOpen ? 'text-suka-orange' : 'text-suka-gray-500'}`}>
              Menu
            </span>
          </button>
        </div>
      </nav>

      {/* Full-nav bottom sheet */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-suka-brown/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-suka-cream rounded-t-3xl border-t border-suka-gray-200 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-suka-cream/95 backdrop-blur px-5 pt-4 pb-3 flex items-center justify-between border-b border-suka-brown/5">
              <div className="text-lg font-extrabold text-suka-brown tracking-tight">
                Admin<span className="text-suka-orange">Hub</span>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-9 h-9 rounded-full bg-white border border-suka-gray-200 flex items-center justify-center text-suka-brown active:scale-95 transition-transform"
                aria-label="Tutup menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4 space-y-5">
              {NAV_GROUPS.map((group) => {
                if (!group.roles.includes(role)) return null
                return (
                  <div key={group.title}>
                    <h3 className="px-2 mb-2 text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider">
                      {group.title}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map(({ href, label, icon: Icon, roles }) => {
                        if (!roles.includes(role)) return null
                        const isActive = isItemActive(href, pathname)
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setSheetOpen(false)}
                            className={`flex items-center gap-3 rounded-2xl px-3 py-3 font-bold text-sm transition-all active:scale-95 ${
                              isActive
                                ? 'bg-suka-orange text-white shadow-sm shadow-suka-orange/20'
                                : 'bg-white text-suka-ink border border-suka-gray-200'
                            }`}
                          >
                            <Icon size={18} className={isActive ? 'text-white' : 'text-suka-orange'} />
                            <span className="truncate flex-1">{label}</span>
                            {href === '/dashboard/hr/leave' && pendingCount > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                {pendingCount}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <a
                href={resolvedPortalUrl}
                className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-sm text-suka-brown/80 bg-white border border-suka-gray-200 active:scale-95 transition-transform"
              >
                <ArrowLeft size={16} className="text-suka-brown/60" />
                Kembali ke Portal
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
