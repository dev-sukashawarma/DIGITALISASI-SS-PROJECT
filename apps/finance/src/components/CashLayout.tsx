'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { LayoutDashboard, ArrowLeftRight, Landmark, Repeat, Wallet, Truck, Banknote, LogOut, Coins, Loader2, Receipt, Menu, X, ClipboardCheck, TrendingUp, Store, Package, ShoppingCart, FileText, ClipboardList } from 'lucide-react'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { usePettyCashRequests } from '@/hooks/usePettyCash'
import { usePendingPos } from '@/hooks/usePoApproval'

type NavItem = { href: string; label: string; icon: any; isSub?: boolean }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'UTAMA',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/?tab=omzet', label: 'Omzet Outlet', icon: TrendingUp, isSub: true },
      { href: '/?tab=petty-cash', label: 'Petty Cash Outlet', icon: Store, isSub: true },
      { href: '/?tab=stok', label: 'Stok & Persediaan', icon: Package, isSub: true },
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
    title: 'PURCHASING',
    items: [
      { href: '/pembelian/dashboard', label: 'Dashboard Utama', icon: LayoutDashboard },
      { href: '/pembelian/supplier', label: 'Database Supplier', icon: Truck },
      { href: '/pembelian/permintaan', label: 'Permintaan (PR)', icon: ClipboardList },
      { href: '/pembelian', label: 'Purchase Order (PO)', icon: ShoppingCart },
      { href: '/po-approval', label: 'Approval PO', icon: ClipboardCheck },
      { href: '/pembelian/penerimaan', label: 'Penerimaan Barang', icon: Package },
      { href: '/pembelian/invoice', label: 'Invoice Pembelian', icon: Receipt },
      { href: '/pembelian/laporan', label: 'Laporan Pembelian', icon: FileText },
    ],
  },
  {
    title: 'PEMBAYARAN',
    items: [
      { href: '/supplier', label: 'Pelunasan Supplier', icon: Banknote },
      { href: '/payroll', label: 'Gaji', icon: Wallet },
      { href: '/petty-cash', label: 'Petty Cash', icon: Coins },
      { href: '/pengeluaran', label: 'Pengeluaran', icon: Receipt },
    ],
  },
]

// Flattened for easy lookup of active path
const ALL_LINKS = NAV_GROUPS.flatMap(g => g.items)

// Web Audio API simple "ding" sound
function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Ignore audio errors (e.g., autoplay blocked)
  }
}

export function CashLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { outletStaff, signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  const { data: pettyCashRequests } = usePettyCashRequests('forwarded_to_finance')
  const { data: pendingPos } = usePendingPos()
  const pettyPendingCount = pettyCashRequests?.length || 0
  const poPendingCount = pendingPos?.length || 0
  
  const prevPendingRef = useRef(0)

  useEffect(() => {
    const totalPending = pettyPendingCount + poPendingCount
    if (totalPending > 0) {
      document.title = `(${totalPending}) Suka Finance`
    } else {
      document.title = 'Suka Finance'
    }

    // Play sound if the number of tasks increased
    if (totalPending > prevPendingRef.current && prevPendingRef.current !== 0) {
      playNotificationSound()
    }
    // Update ref for next comparison
    // We only update if it actually loaded (prevent sound on first load if > 0)
    prevPendingRef.current = totalPending
  }, [pettyPendingCount, poPendingCount])

  const isPurchasingRole = outletStaff && ((outletStaff.role as string) === 'purchasing' || (outletStaff.role as string) === 'purchase')

  const visibleNavGroups = isPurchasingRole
    ? NAV_GROUPS.filter(g => g.title === 'PURCHASING')
    : NAV_GROUPS

  const BOTTOM_NAV_ITEMS = isPurchasingRole
    ? [
        { href: '/pembelian/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/pembelian', label: 'Purchase Order', icon: ShoppingCart },
        { href: '/pembelian/penerimaan', label: 'Penerimaan', icon: Package },
        { href: '/pembelian/invoice', label: 'Invoice', icon: Receipt },
      ]
    : [
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

  // Active logic that respects ?tab= and specific sub-routes
  const currentTab = searchParams.get('tab')
  let currentNavPath = '/'
  if (pathname === '/') {
    if (currentTab === 'omzet') currentNavPath = '/?tab=omzet'
    else if (currentTab === 'petty-cash') currentNavPath = '/?tab=petty-cash'
    else if (currentTab === 'stok') currentNavPath = '/?tab=stok'
    else currentNavPath = '/'
  } else {
    // 1. Check exact match first (e.g. /pembelian/penerimaan, /pembelian/invoice, /pembelian/laporan)
    const exact = ALL_LINKS.find(l => l.href === pathname)
    if (exact) {
      currentNavPath = exact.href
    } else {
      // 2. Otherwise find the most specific (longest) matching href for nested routes like /pembelian/[id]
      const matching = ALL_LINKS
        .filter(l => l.href !== '/' && !l.href.includes('?') && pathname.startsWith(l.href))
        .sort((a, b) => b.href.length - a.href.length)
      currentNavPath = matching[0]?.href ?? '/'
    }
  }
  const currentLink = ALL_LINKS.find(l => l.href === currentNavPath)

  return (
    <div className="flex h-screen overflow-hidden bg-suka-brown font-sans md:p-2">
      {/* Sidebar - Playful Variant */}
      <aside className="hidden w-64 shrink-0 text-white md:flex md:flex-col print:hidden z-20 relative overflow-hidden">
        {/* Playful Background Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-suka-orange/10 rounded-tr-full pointer-events-none"></div>

        <div className="p-6 flex flex-col items-center gap-3 relative z-10 border-b border-white/10">
          <Link href={isPurchasingRole ? "/pembelian/dashboard" : "/"} className="flex flex-col items-center gap-3 group">
            <img src="/logo.png" alt="Suka Shawarma" className="w-12 h-12 object-contain group-hover:scale-105 transition-transform" />
            <div className="text-center">
              <div className="font-display text-2xl tracking-wide leading-none text-white">
                Suka<span className="text-suka-orange">Finance</span>
              </div>
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Treasury Hub</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 relative z-10 scrollbar-hide">
          {visibleNavGroups.map((group) => (
            <div key={group.title}>
              <h3 className="px-4 mb-2.5 text-[10px] font-bold tracking-widest text-suka-orange/90 uppercase">
                {group.title}
              </h3>
              <div className="space-y-1 relative">
                {group.items.map(({ href, label, icon: Icon, isSub }) => {
                  const active = currentNavPath === href
                  const badgeCount = href === '/petty-cash' ? pettyPendingCount : href === '/po-approval' ? poPendingCount : undefined
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 font-semibold text-xs sm:text-sm transition-colors relative z-10 ${
                        isSub ? 'ml-6 py-2 opacity-90' : ''
                      } ${
                        active ? 'text-suka-brown font-bold' : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="sidebarActive"
                          className="absolute inset-0 bg-suka-cream rounded-2xl -z-10 shadow-sm"
                          transition={{ type: 'spring', stiffness: 250, damping: 20 }}
                        />
                      )}
                      <Icon className={`${isSub ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5'} transition-colors ${active ? 'text-suka-orange' : 'text-white/50'}`} />
                      <span className={`flex-1 truncate ${isSub ? 'text-xs' : ''}`}>{label}</span>
                      {badgeCount !== undefined && badgeCount > 0 && (
                        <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold transition-colors ${
                          active ? 'bg-suka-orange text-white' : 'bg-red-500 text-white shadow-sm'
                        }`}>
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-suka-cream md:rounded-[2rem] shadow-2xl shadow-black/20 border-l md:border border-white/10 md:border-suka-brown/10">
        {/* Playful Header */}
        <header className="bg-suka-cream/80 backdrop-blur-2xl px-4 sm:px-6 py-3.5 flex justify-between items-center gap-3 z-30 shrink-0 print:hidden sticky top-0 border-b border-suka-brown/5 md:rounded-t-[2rem]">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-suka-brown tracking-tight truncate">
              {currentLink?.label ?? 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 bg-white p-1.5 pr-3 rounded-2xl border border-suka-brown/5 shadow-sm hover:border-suka-orange/30 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-suka-orange/20 text-suka-orange flex items-center justify-center text-xs font-bold">
                {outletStaff ? outletStaff.name.charAt(0).toUpperCase() : 'U'}
              </div>
              {outletStaff && (
                <div className="hidden sm:flex flex-col items-start justify-center gap-0.5">
                  <span className="text-xs font-bold text-suka-brown leading-none">{outletStaff.name}</span>
                  <span className="text-[9px] text-suka-brown/60 font-semibold uppercase tracking-wider leading-none">{outletStaff.role}</span>
                </div>
              )}
            </button>
            
            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-suka-brown/10 overflow-hidden z-50 flex flex-col"
                  >
                    <a 
                      href={resolvedPortalUrl}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-suka-brown hover:bg-suka-orange/5 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Kembali ke Portal
                    </a>
                    <div className="h-px bg-suka-brown/5 w-full"></div>
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
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 text-left w-full"
                    >
                      {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                      Keluar
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto w-full scrollbar-hide">
          <div className="w-full max-w-full p-4 sm:p-5 lg:p-6 pb-24 md:pb-8">
            {children}
          </div>
        </main>

        {/* Playful Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-suka-brown text-white backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-suka-brown/20 flex items-center justify-around px-2 py-2 print:hidden">
          {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = currentNavPath === href
            const badgeCount = href === '/petty-cash' ? pettyPendingCount : href === '/po-approval' ? poPendingCount : undefined
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMenuOpen(false)}
                className={`flex flex-col items-center justify-center w-full py-1.5 gap-1 transition-all relative ${
                  active ? 'text-suka-brown' : 'text-white/60 hover:text-white'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="mobileNavActive"
                    className="absolute inset-0 bg-suka-cream rounded-[1.5rem] -z-10"
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
                <div className={`p-1 transition-all relative ${active ? 'text-suka-orange' : ''}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  {badgeCount !== undefined && badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-white px-1 text-[9px] font-black">
                      {badgeCount}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] ${active ? 'font-black' : 'font-semibold'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
          
          {/* Menu Lainnya Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex flex-col items-center justify-center w-full py-1.5 gap-1 transition-all relative ${
              isMenuOpen ? 'text-suka-brown' : 'text-white/60 hover:text-white'
            }`}
          >
            {isMenuOpen && (
                  <motion.div
                    layoutId="mobileNavActive"
                    className="absolute inset-0 bg-suka-cream rounded-[1.5rem] -z-10"
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
            <div className={`p-1 transition-all ${isMenuOpen ? 'text-suka-orange' : ''}`}>
              <Menu size={20} strokeWidth={isMenuOpen ? 2.5 : 2} />
            </div>
            <span className={`text-[9px] ${isMenuOpen ? 'font-black' : 'font-semibold'}`}>
              Lainnya
            </span>
          </button>
        </nav>
        
        {/* Mobile Drawer Overlay for "Lainnya" */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-30 bg-suka-ink/40 backdrop-blur-sm flex items-end justify-center" 
              onClick={() => setIsMenuOpen(false)}
            >
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full bg-suka-cream rounded-t-[2.5rem] shadow-2xl p-6 pb-28" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-display text-2xl text-suka-brown">Menu Lainnya</h2>
                  <button onClick={() => setIsMenuOpen(false)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-suka-brown shadow-sm border border-suka-brown/5">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto space-y-8 scrollbar-hide">
                  {visibleNavGroups.map((group) => (
                    <div key={group.title}>
                      <h3 className="mb-4 text-[10px] font-black tracking-widest text-suka-orange uppercase">
                        {group.title}
                      </h3>
                      <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                        {group.items.map(({ href, label, icon: Icon }) => {
                          const active = currentNavPath === href
                          return (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => setIsMenuOpen(false)}
                              className="flex flex-col items-center gap-2"
                            >
                              <div className={`w-14 h-14 flex items-center justify-center rounded-[1.25rem] shadow-sm ${
                                active ? 'bg-suka-orange text-white' : 'bg-white text-suka-brown hover:bg-suka-orange/10'
                              }`}>
                                <Icon size={24} />
                              </div>
                              <span className="text-[10px] font-bold text-center text-suka-brown leading-tight">
                                {label}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

