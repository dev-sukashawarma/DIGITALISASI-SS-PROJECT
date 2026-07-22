'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { LayoutDashboard, ArrowLeftRight, Landmark, Repeat, Wallet, Truck, Banknote, LogOut, User, Coins, Loader2, Receipt, Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'

type NavItem = { href: string; label: string; icon: any }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'UTAMA',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/lokasi', label: 'Rekening & Kas', icon: Landmark },
    ],
  },
  {
    title: 'ARUS KAS',
    items: [
      { href: '/setoran', label: 'Setoran', icon: Banknote },
      { href: '/transfer', label: 'Transfer', icon: Repeat },
      { href: '/transaksi', label: 'Transaksi Manual', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'PEMBAYARAN',
    items: [
      { href: '/supplier', label: 'Supplier', icon: Truck },
      { href: '/payroll', label: 'Gaji', icon: Wallet },
      { href: '/petty-cash', label: 'Petty Cash', icon: Coins },
      { href: '/pengeluaran', label: 'Pengeluaran', icon: Receipt },
    ],
  },
]

// Flattened for easy lookup of active path
const ALL_LINKS = NAV_GROUPS.flatMap(g => g.items)

export function CashLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { outletStaff, signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const BOTTOM_NAV_ITEMS = [
    { href: '/', label: 'Beranda', icon: LayoutDashboard },
    { href: '/petty-cash', label: 'Petty Cash', icon: Coins },
    { href: '/setoran', label: 'Setoran', icon: Banknote },
    { href: '/pengeluaran', label: 'Pengeluaran', icon: Receipt },
  ]

  if (pathname?.startsWith('/leader') || pathname?.startsWith('/area-manager')) {
    return <>{children}</>
  }

  // Prevent leader/area-manager from seeing the finance dashboard if they manually navigate to /setoran etc.
  if (outletStaff && ((outletStaff.role as string) === 'leader' || (outletStaff.role as string) === 'area_manager' || (outletStaff.role as string) === 'korlap') && pathname !== '/') {
    if (typeof window !== 'undefined') {
      window.location.href = `/${(outletStaff.role as string) === 'korlap' ? 'area-manager' : outletStaff.role}`
    }
    return null
  }

  const currentNavPath = ALL_LINKS.find(l => l.href !== '/' && pathname.startsWith(l.href))?.href ?? '/'
  const currentLink = ALL_LINKS.find(l => l.href === currentNavPath)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col print:hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
            F
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 tracking-tight leading-none">Suka<span className="text-indigo-600">Finance</span></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Treasury Hub</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 text-sm">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 mb-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = currentNavPath === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold transition-all ${
                        active
                          ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={18} className={active ? 'text-indigo-600' : 'text-slate-400'} />
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
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-3 shadow-xs flex-shrink-0 print:hidden">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              {currentLink?.label ?? 'Dashboard'}
            </h1>
            {outletStaff && (
              <p className="text-[10px] sm:text-xs font-bold text-indigo-600 mt-0.5 uppercase tracking-wider truncate">
                Staff: {outletStaff.name} ({outletStaff.role})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {outletStaff && (
              <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-slate-600" />
                </div>
                <span className="text-xs font-bold text-slate-800">{outletStaff.name}</span>
              </div>
            )}
            <button
              disabled={isLoggingOut}
              onClick={async () => {
                setIsLoggingOut(true)
                try {
                  await signOut()
                } finally {
                  setIsLoggingOut(false)
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              {isLoggingOut ? 'Keluar...' : 'Keluar'}
            </button>
          </div>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden flex-shrink-0 border-t border-slate-200 bg-white flex items-center justify-around px-2 py-2 pb-safe shadow-sm print:hidden z-40 relative">
          {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = currentNavPath === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMenuOpen(false)}
                className={`flex flex-col items-center justify-center w-full py-1 gap-1 transition-colors ${
                  active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`p-1.5 rounded-full ${active ? 'bg-indigo-50' : 'bg-transparent'}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] ${active ? 'font-extrabold text-indigo-600' : 'font-medium'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
          
          {/* Menu Lainnya Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex flex-col items-center justify-center w-full py-1 gap-1 transition-colors ${
              isMenuOpen ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-full ${isMenuOpen ? 'bg-indigo-50' : 'bg-transparent'}`}>
              <Menu size={20} strokeWidth={isMenuOpen ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] ${isMenuOpen ? 'font-extrabold text-indigo-600' : 'font-medium'}`}>
              Lainnya
            </span>
          </button>
        </nav>
        
        {/* Mobile Drawer Overlay for "Lainnya" */}
        {isMenuOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}>
            <div 
              className="absolute bottom-16 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-5 pb-8 border-t border-slate-200" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h2 className="font-extrabold text-slate-900">Menu Lainnya</h2>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto space-y-6">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title}>
                    <h3 className="mb-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      {group.title}
                    </h3>
                    <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                      {group.items.map(({ href, label, icon: Icon }) => {
                        const active = currentNavPath === href
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex flex-col items-center gap-1"
                          >
                            <div className={`w-12 h-12 flex items-center justify-center rounded-2xl ${
                              active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}>
                              <Icon size={20} />
                            </div>
                            <span className="text-[10px] font-medium text-center text-slate-700 leading-tight">
                              {label}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
