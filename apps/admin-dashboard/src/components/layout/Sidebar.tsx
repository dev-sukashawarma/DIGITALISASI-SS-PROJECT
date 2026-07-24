'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '@suka/auth'
import { useRole } from './RoleContext'
import { accessibleGroups, isItemActive, resolvePortalUrl } from './navConfig'
import { useLeaveNotifications } from '@/hooks/useLeaveNotifications'

export const Sidebar = () => {
  const pathname = usePathname()
  const { role } = useRole()
  const { pendingCount } = useLeaveNotifications()
  const resolvedPortalUrl = resolvePortalUrl()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    window.location.href = resolvedPortalUrl
  }

  const groups = accessibleGroups(role)
  // Pintu yang sedang dibuka: default pintu yang memuat halaman aktif.
  const activeGroupTitle = groups.find((g) => g.items.some((i) => isItemActive(i.href, pathname)))?.title
  const [openDoor, setOpenDoor] = useState<string | null>(activeGroupTitle ?? groups[0]?.title ?? null)

  return (
    <aside className="hidden w-64 shrink-0 border-r border-suka-gray-200 bg-white md:flex md:flex-col print:hidden">
      <div className="p-5 border-b border-suka-gray-100">
        <div className="text-xl font-extrabold text-suka-brown tracking-tight">
          {role === 'LEADER' ? 'Leader' : role === 'AREA_MANAGER' ? 'AreaManager' : 'Admin'}
          <span className="text-suka-orange">Hub</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 text-sm">
        {groups.map((group) => {
          const DoorIcon = group.icon
          const isOpen = openDoor === group.title
          const doorActive = group.items.some((i) => isItemActive(i.href, pathname))

          return (
            <div key={group.title}>
              {group.items.length === 1 ? (
                <div className="mt-1">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = isItemActive(href, pathname)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold transition-colors ${
                          active
                            ? 'bg-suka-orange/10 text-suka-orange'
                            : 'text-gray-600 hover:bg-suka-gray-50 hover:text-suka-ink'
                        }`}
                      >
                        <Icon size={18} className={active ? 'text-suka-orange' : 'text-suka-gray-400'} />
                        <span className="flex-1">{label}</span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <>
                  {/* Kepala pintu — klik untuk buka/tutup */}
                  <button
                    type="button"
                    onClick={() => setOpenDoor(isOpen ? null : group.title)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold transition-colors ${
                      doorActive ? 'text-suka-brown' : 'text-suka-ink'
                    } hover:bg-suka-gray-50`}
                  >
                    <DoorIcon size={18} className={doorActive ? 'text-suka-orange' : 'text-suka-gray-400'} />
                    <span className="flex-1 text-left">{group.title}</span>
                    <ChevronDown size={16} className={`text-suka-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Items */}
                  {isOpen && (
                    <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-suka-gray-100 space-y-0.5">
                      {group.items.map(({ href, label, icon: Icon }) => {
                        const active = isItemActive(href, pathname)
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition-colors ${
                              active
                                ? 'bg-suka-orange/10 text-suka-orange'
                                : 'text-gray-600 hover:bg-suka-gray-50 hover:text-suka-ink'
                            }`}
                          >
                            <Icon size={16} className={active ? 'text-suka-orange' : 'text-gray-400'} />
                            <span className="flex-1">{label}</span>
                            {href === '/dashboard/hr/leave' && pendingCount > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {pendingCount}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="p-4 border-t border-suka-gray-100 space-y-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-[13px] text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all active:scale-95 shadow-sm"
        >
          <LogOut size={16} className="text-red-500" />
          Logout
        </button>
      </div>
    </aside>
  )
}
