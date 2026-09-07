// @ts-nocheck
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '@suka/auth'
import { useRole } from './RoleContext'
import { accessibleGroups, isItemActive, resolvePortalUrl } from './navConfig'
import { useLeaveNotifications } from '@/hooks/useLeaveNotifications'
import { ConfirmLogoutDialog } from './ConfirmLogoutDialog'

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
  /** Apakah item ini — atau salah satu sub-menunya — sedang dibuka. */
  const itemOrChildActive = (item: (typeof groups)[number]['items'][number]) =>
    isItemActive(item.href, pathname) ||
    (item.children ?? []).some((c) => isItemActive(c.href, pathname))
  // Pintu yang sedang dibuka: default pintu yang memuat halaman aktif.
  const activeGroupTitle = groups.find((g) => g.items.some(itemOrChildActive))?.title
  const [openDoor, setOpenDoor] = useState<string | null>(activeGroupTitle ?? groups[0]?.title ?? null)
  const [isLogoutOpen, setIsLogoutOpen] = useState(false)

  // Sub-menu yang sedang terbuka. Terbuka sendiri begitu halaman induknya
  // ATAU salah satu anaknya dibuka — membuka induk berarti ingin melihat
  // pilihannya, bukan cuma halamannya.
  const activeParentHref = groups
    .flatMap((g) => g.items)
    .find((i) => i.children?.length && itemOrChildActive(i))?.href
  const [openSub, setOpenSub] = useState<string | null>(activeParentHref ?? null)

  useEffect(() => {
    if (activeParentHref) setOpenSub(activeParentHref)
  }, [activeParentHref])

  // Sync openDoor when pathname changes so it naturally reflects the active item
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
          Suka<span className="text-suka-orange">Admin</span>
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-suka-orange/80 mt-1">
          Digital Hub
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 text-sm">
        {groups.map((group) => {
          const DoorIcon = group.icon
          const isOpen = openDoor === group.title
          const doorActive = group.items.some(itemOrChildActive)

          return (
            <div key={group.title}>
                <>
                  {/* Kepala pintu — klik untuk buka/tutup */}
                  <button
                    type="button"
                    onClick={() => setOpenDoor(isOpen ? null : group.title)}
                    className="w-full flex items-center justify-between px-4 py-2.5 mt-2 mb-1 transition-all active:scale-95 group hover:bg-white/5 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <DoorIcon size={16} className="text-suka-orange/70 group-hover:text-suka-orange transition-colors" />
                      <span className="text-xs font-bold uppercase tracking-wider text-suka-orange/80 group-hover:text-suka-orange transition-colors">
                        {group.title}
                      </span>
                    </div>
                    <ChevronDown size={14} className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Items */}
                  {isOpen && (
                    <div className="space-y-0.5 ml-2">
                      {group.items.map((item) => {
                        const { href, label, icon: Icon, children } = item
                        const active = isItemActive(href, pathname)
                        const hasChildren = Boolean(children?.length)
                        const subOpen = hasChildren && openSub === href

                        return (
                          <div key={href}>
                            <div className="flex items-center">
                              <Link
                                href={href}
                                onClick={() => hasChildren && setOpenSub(href)}
                                className={`group flex flex-1 items-center gap-3 rounded-xl ml-2 ${hasChildren ? 'mr-0' : 'mr-2'} px-3 py-2 font-semibold transition-all active:scale-95 ${
                                  active
                                    ? 'bg-white text-[#4A1713] shadow-md'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <Icon size={16} className={active ? 'text-[#4A1713]' : 'text-white/50 group-hover:text-white/80'} />
                                <span className="flex-1 text-[13px]">{label}</span>
                                {href === '/dashboard/hr/leave' && pendingCount > 0 && (
                                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {pendingCount}
                                  </span>
                                )}
                              </Link>

                              {hasChildren && (
                                <button
                                  type="button"
                                  onClick={() => setOpenSub(subOpen ? null : href)}
                                  aria-expanded={subOpen}
                                  aria-label={subOpen ? `Tutup sub-menu ${label}` : `Buka sub-menu ${label}`}
                                  className="mr-2 shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                                >
                                  <ChevronDown size={13} className={`transition-transform ${subOpen ? 'rotate-180' : ''}`} />
                                </button>
                              )}
                            </div>

                            {hasChildren && subOpen && (
                              <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                                {children!.map(({ href: subHref, label: subLabel, icon: SubIcon }) => {
                                  const subActive = isItemActive(subHref, pathname)
                                  return (
                                    <Link
                                      key={subHref}
                                      href={subHref}
                                      className={`group flex items-center gap-2.5 rounded-lg mx-1 px-2.5 py-1.5 font-semibold transition-all active:scale-95 ${
                                        subActive
                                          ? 'bg-white text-[#4A1713] shadow-md'
                                          : 'text-white/60 hover:bg-white/10 hover:text-white'
                                      }`}
                                    >
                                      <SubIcon size={14} className={subActive ? 'text-[#4A1713]' : 'text-white/40 group-hover:text-white/70'} />
                                      <span className="flex-1 text-[12px]">{subLabel}</span>
                                    </Link>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
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

