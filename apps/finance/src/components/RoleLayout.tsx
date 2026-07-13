'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { Button } from '@suka/design-system'
import { LogOut, User, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'

export type NavItem = { href: string; label: string; icon: any }
export type NavGroup = { title: string; items: NavItem[] }

interface RoleLayoutProps {
  /** Static brand prefix, e.g. "Suka" */
  brand: string
  /** Accent word after the brand prefix, e.g. "Leader" / "Korlap" */
  brandAccent: string
  navGroups: NavGroup[]
  /** Path treated as the section root (never matched as a sub-route) */
  homePath: string
  /** Header title shown when no nav item matches the current path */
  defaultTitle: string
  children: ReactNode
}

export function RoleLayout({ brand, brandAccent, navGroups, homePath, defaultTitle, children }: RoleLayoutProps) {
  const pathname = usePathname()
  const { outletStaff, signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const allLinks = navGroups.flatMap(g => g.items)

  // Find exact match or fallback to homePath
  const currentNavPath = allLinks.find(l => l.href !== homePath && pathname.startsWith(l.href))?.href ?? homePath
  const currentLink = allLinks.find(l => l.href === currentNavPath)

  return (
    <div className="flex h-screen overflow-hidden bg-suka-cream">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-suka-gray-200 bg-white md:flex md:flex-col print:hidden">
        <div className="p-5 border-b border-suka-gray-100">
          <div className="text-xl font-extrabold text-suka-brown tracking-tight">{brand}<span className="text-suka-orange">{brandAccent}</span></div>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 text-sm">
          {navGroups.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 mb-2 text-xs font-black tracking-widest text-suka-gray-400/80 uppercase">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = currentNavPath === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold transition-colors ${
                        active
                          ? 'bg-suka-orange/10 text-suka-orange'
                          : 'text-gray-500 hover:bg-suka-gray-50 hover:text-suka-ink'
                      }`}
                    >
                      <Icon size={18} className={active ? 'text-suka-orange' : 'text-suka-gray-400'} />
                      <span className="flex-1">{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-suka-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-3 shadow-sm flex-shrink-0 print:hidden">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-extrabold text-suka-brown tracking-tight truncate">
              {currentLink?.label ?? defaultTitle}
            </h1>
            {outletStaff && (
              <p className="text-[10px] sm:text-xs font-bold text-suka-orange mt-0.5 uppercase tracking-wider truncate">
                User: {outletStaff.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
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
              disabled={isLoggingOut}
              onClick={async () => {
                setIsLoggingOut(true)
                try {
                  await signOut()
                } finally {
                  setIsLoggingOut(false)
                }
              }}
              className="flex items-center gap-1.5 !px-3 !py-1.5 !rounded-full border border-suka-brown/20 hover:border-suka-brown text-suka-brown font-bold text-xs cursor-pointer"
            >
              {isLoggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              {isLoggingOut ? 'Keluar...' : 'Keluar'}
            </Button>
          </div>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 pb-24 md:pb-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden flex-shrink-0 border-t border-suka-gray-200 bg-white flex items-center justify-around px-2 py-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] print:hidden z-40 relative">
          {allLinks.map(({ href, label, icon: Icon }) => {
            const active = currentNavPath === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center w-full py-1 gap-1 transition-colors ${
                  active ? 'text-suka-orange' : 'text-suka-gray-400 hover:text-suka-gray-600'
                }`}
              >
                <div className={`p-1.5 rounded-full ${active ? 'bg-suka-orange/10' : 'bg-transparent'}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] ${active ? 'font-extrabold text-suka-orange' : 'font-medium'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
