'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useRole } from './RoleContext'
import { NAV_GROUPS, isItemActive, resolvePortalUrl } from './navConfig'

export const Sidebar = () => {
  const pathname = usePathname()
  const { role } = useRole()
  const resolvedPortalUrl = resolvePortalUrl()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-suka-gray-200 bg-white md:flex md:flex-col">
      <div className="p-5 border-b border-suka-gray-100">
        <div className="text-xl font-extrabold text-suka-brown tracking-tight">Admin<span className="text-suka-orange">Hub</span></div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 text-sm">
        {NAV_GROUPS.map((group) => {
          if (!group.roles.includes(role)) return null

          return (
            <div key={group.title}>
              <h3 className="px-3 mb-2 text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon, roles }) => {
                  if (!roles.includes(role)) return null
                  const isActive = isItemActive(href, pathname)

                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition-colors ${
                        isActive
                          ? 'bg-suka-orange/10 text-suka-orange'
                          : 'text-gray-600 hover:bg-suka-gray-50 hover:text-suka-ink'
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'text-suka-orange' : 'text-gray-400'} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 border-t border-suka-gray-100">
        <a
          href={resolvedPortalUrl}
          className="flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-xs text-suka-brown/70 hover:bg-suka-cream hover:text-suka-brown border border-suka-gray-200 hover:border-suka-brown/20 transition-all active:scale-95"
        >
          <ArrowLeft size={16} className="text-suka-brown/60" />
          Kembali ke Portal
        </a>
      </div>
    </aside>
  )
}
