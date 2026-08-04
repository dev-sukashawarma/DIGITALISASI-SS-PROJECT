'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { Button } from '@suka/design-system'
import { LogOut, User, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'

export type NavItem = { href: string; label: string; icon: any; badge?: number }
export type NavGroup = { title: string; items: NavItem[] }

interface RoleLayoutProps {
  /** Static brand prefix, e.g. "Suka" */
  brand: string
  /** Accent word after the brand prefix, e.g. "Leader" / "Area Manager" */
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
      <aside className="hidden w-64 shrink-0 border-r border-suka-brown/10 bg-white/80 backdrop-blur-xl md:flex md:flex-col print:hidden shadow-[4px_0_24px_rgba(44,24,16,0.02)] z-20">
        <div className="p-5 border-b border-suka-brown/5 flex items-center gap-3">
          <div className="text-xl font-black text-suka-brown tracking-tight leading-none">{brand}<span className="text-suka-orange">{brandAccent}</span></div>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 text-sm">
          {navGroups.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 mb-2 text-xs font-black tracking-widest text-suka-gray-400/80 uppercase">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon, badge }) => {
                  const active = currentNavPath === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold transition-all relative group ${
                        active
                          ? 'bg-suka-orange/10 text-suka-orange shadow-sm'
                          : 'text-suka-gray-500 hover:bg-suka-gray-50 hover:text-suka-brown'
                      }`}
                    >
                      <Icon className={`w-5 h-5 transition-colors ${active ? 'text-suka-orange' : 'text-suka-gray-400 group-hover:text-suka-brown'}`} />
                      <span className="flex-1 truncate">{label}</span>
                      {badge && badge > 0 && (
                        <div className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full min-w-[20px] h-5 px-1.5 shadow-sm">
                          {badge}
                        </div>
                      )}
                      {active && (!badge || badge <= 0) && <div className="w-1.5 h-1.5 rounded-full bg-suka-orange animate-pulse" />}
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
        <header className="bg-white/75 backdrop-blur-xl border-b border-suka-brown/10 px-4 sm:px-6 py-3.5 flex justify-between items-center gap-3 shadow-[0_2px_12px_rgba(44,24,16,0.02)] flex-shrink-0 print:hidden">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-suka-brown tracking-tight truncate">
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
        <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/90 backdrop-blur-xl rounded-full border border-suka-brown/10 shadow-[0_8px_30px_rgba(44,24,16,0.12)] flex items-center justify-around px-2 py-1.5 print:hidden">
          {allLinks.map(({ href, label, icon: Icon, badge }) => {
            const active = currentNavPath === href
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center w-full py-1 gap-1 transition-all ${
                  active ? 'text-suka-orange' : 'text-suka-gray-400 hover:text-suka-brown'
                }`}
              >
                {badge && badge > 0 && (
                  <div className="absolute top-0 right-1/4 translate-x-1/2 -translate-y-1 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border-2 border-white z-10 shadow-sm">
                    {badge}
                  </div>
                )}
                <div className={`p-1.5 rounded-full transition-all ${active ? 'bg-suka-orange/10 text-suka-orange' : 'bg-transparent'}`}>
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[9px] ${active ? 'font-black text-suka-orange' : 'font-semibold'}`}>
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
