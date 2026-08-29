'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '@suka/auth'
import { NAV_GROUPS, isItemActive, resolvePortalUrl } from './navConfig'
import { useLeaveNotifications } from '@/hooks/useLeaveNotifications'
import { ConfirmLogoutDialog } from './ConfirmLogoutDialog'

export const Sidebar = () => {
  const pathname = usePathname()
  const { pendingCount } = useLeaveNotifications()
  const resolvedPortalUrl = resolvePortalUrl()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    window.location.href = resolvedPortalUrl
  }

  const activeGroupTitle = NAV_GROUPS.find((g) => g.items.some((i) => isItemActive(i.href, pathname)))?.title
  const [openDoor, setOpenDoor] = useState<string | null>(activeGroupTitle ?? NAV_GROUPS[0]?.title ?? null)
  const [isLogoutOpen, setIsLogoutOpen] = useState(false)

  useEffect(() => {
    if (activeGroupTitle) {
      setOpenDoor(activeGroupTitle)
    }
  }, [activeGroupTitle])

  return (
    <aside className="hidden w-[260px] shrink-0 bg-transparent text-white lg:flex lg:flex-col print:hidden z-40 relative">
      <div className="p-6 pb-2 text-center flex flex-col items-center justify-center">
        <div className="w-14 h-14 mb-2 rounded-full overflow-hidden flex items-center justify-center bg-white/5 shadow-inner border border-white/10">
          <img src="/logo.png" alt="Suka Shawarma Logo" className="w-full h-full object-cover" />
        </div>
        <div className="text-lg font-extrabold text-white tracking-tight leading-tight">
          Suka<span className="text-suka-orange">HR</span>
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-suka-orange/80 mt-1">
          People & Operations Hub
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 text-sm">
        {NAV_GROUPS.map((group) => {
          const DoorIcon = group.icon
          const isOpen = openDoor === group.title
          const doorActive = group.items.some((i) => isItemActive(i.href, pathname))

          return (
            <div key={group.title}>
              {/* Group Header */}
              <button
                type="button"
                onClick={() => setOpenDoor(isOpen ? null : group.title)}
                className={`w-full flex items-center justify-between px-4 py-2.5 mt-2 mb-1 transition-all active:scale-95 group hover:bg-white/5 rounded-xl ${
                  doorActive ? 'bg-white/5' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <DoorIcon size={16} className="text-suka-orange/70 group-hover:text-suka-orange transition-colors" />
                  <span className="text-xs font-bold uppercase tracking-wider text-suka-orange/80 group-hover:text-suka-orange transition-colors">
                    {group.title}
                  </span>
                </div>
                <ChevronDown size={14} className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Group Items */}
              {isOpen && (
                <div className="space-y-0.5 ml-2">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = isItemActive(href, pathname)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`group flex items-center gap-3 rounded-xl mx-2 px-3 py-2 font-semibold transition-all active:scale-95 ${
                          active
                            ? 'bg-white text-[#4A1713] shadow-md'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon size={16} className={active ? 'text-[#4A1713]' : 'text-white/50 group-hover:text-white/80'} />
                        <span className="flex-1 text-[13px]">{label}</span>
                        {href === '/leave' && pendingCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                            {pendingCount}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="p-4 space-y-2 relative z-10">
        <button
          onClick={() => setIsLogoutOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-[13px] text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      <ConfirmLogoutDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </aside>
  )
}
