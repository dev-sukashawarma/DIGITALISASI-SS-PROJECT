'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@suka/auth'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  Wallet,
  Banknote,
  LogOut,
  Coins,
  Loader2,
  Receipt,
  Menu,
  X,
  ClipboardCheck,
  TrendingUp,
  Package,
  ShoppingCart,
  FileText,
  ClipboardList,
  PieChart,
  Target,
  UserCheck,
  TrendingDown,
  Table2,
  Building2,
  Truck,
  ExternalLink,
  BellRing,
  FileCheck,
  ChevronDown,
  BarChart3,
  ArrowLeft,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { usePettyCashCount } from '@/hooks/usePettyCash'
import { usePendingPoCount } from '@/hooks/usePoApproval'
import { usePendingPrCount } from '@/hooks/usePurchaseRequest'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  isExternal?: boolean
  aliases?: string[]
}

type NavGroup = {
  title: string
  icon: LucideIcon
  defaultOpen?: boolean
  items: NavItem[]
}

const FINANCE_NAV_GROUPS: NavGroup[] = [
  {
    title: 'KAS & TREASURY',
    icon: Landmark,
    defaultOpen: true,
    items: [
      { href: '/', label: 'Dashboard Kas', icon: LayoutDashboard },
      { href: '/lokasi', label: 'Rekening & Kas', icon: Landmark },
      { href: '/setoran', label: 'Setoran Tunai', icon: Banknote, aliases: ['/setoran/history'] },
      { href: '/transaksi', label: 'Transaksi Manual', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'PEMBAYARAN & BIAYA',
    icon: Wallet,
    defaultOpen: true,
    items: [
      { href: '/petty-cash', label: 'Pencairan Petty Cash', icon: Coins },
      { href: '/pengeluaran/kantor', label: 'Pengajuan Dana Kantor', icon: Building2 },
      { href: '/supplier', label: 'Pelunasan Supplier', icon: Truck },
      { href: '/payroll', label: 'Pencairan Gaji', icon: Wallet },
      { href: '/laporan/buku-kas', label: 'Buku Kas (OPEX)', icon: Receipt, aliases: ['/pengeluaran'] },
    ],
  },
  {
    title: 'PURCHASING & PO',
    icon: ShoppingCart,
    defaultOpen: false,
    items: [
      { href: '/po-approval', label: 'Approval PO', icon: ClipboardCheck },
      { href: '/pembelian/dashboard', label: 'Dashboard Purchasing', icon: LayoutDashboard },
      { href: '/pembelian/perlu-dibeli', label: 'Perlu Dibeli', icon: BellRing },
      { href: '/pembelian/permintaan', label: 'Permintaan (PR)', icon: ClipboardList },
      { href: '/pembelian', label: 'Purchase Order (PO)', icon: ShoppingCart },
      { href: '/pembelian/penerimaan', label: 'Penerimaan Barang', icon: Package },
      { href: '/pembelian/invoice', label: 'Invoice Pembelian', icon: Receipt },
      { href: '/pembelian/harga', label: 'Fluktuasi Harga', icon: TrendingUp },
      { href: '/pembelian/laporan', label: 'Laporan Realisasi PO', icon: FileText },
    ],
  },
  {
    title: 'PUSAT LAPORAN',
    icon: PieChart,
    defaultOpen: false,
    items: [
      { href: '/laporan/penjualan', label: 'Rangkuman Penjualan', icon: PieChart },
      { href: '/laporan/rekap-bulanan', label: 'Rekap Bulanan', icon: Table2 },
      { href: '/laporan/target-harian', label: 'Target Harian', icon: Target },
      { href: '/laporan/bonus-crew', label: 'Bonus Crew', icon: UserCheck },
      { href: '/laporan/waste', label: 'Kerugian Waste', icon: TrendingDown },
      { href: '/laporan/pembelian', label: 'Tren Pembelian Bahan', icon: BarChart3 },
      { href: '/eom-closing', label: 'EOM Closing Satelit', icon: FileCheck },
    ],
  },
]

function buildPurchasingNavGroups(resolvedAdminUrl: string): NavGroup[] {
  return [
    {
      title: 'OPERASIONAL PURCHASING',
      icon: ShoppingCart,
      defaultOpen: true,
      items: [
        { href: '/pembelian/dashboard', label: 'Dashboard Purchasing', icon: LayoutDashboard },
        { href: '/pembelian/perlu-dibeli', label: 'Perlu Dibeli (Usulan)', icon: BellRing },
        { href: '/pembelian/permintaan', label: 'Permintaan Cabang (PR)', icon: ClipboardList },
        { href: '/pembelian', label: 'Purchase Order (PO)', icon: ShoppingCart },
        { href: '/po-approval', label: 'Status Approval PO', icon: ClipboardCheck },
        { href: '/pembelian/penerimaan', label: 'Penerimaan Barang', icon: Package },
        { href: '/pembelian/invoice', label: 'Invoice & Tagihan', icon: Receipt },
      ],
    },
    {
      title: 'ANALISIS & MASTER DATA',
      icon: BarChart3,
      defaultOpen: true,
      items: [
        { href: '/pembelian/harga', label: 'Fluktuasi Harga Bahan', icon: TrendingUp },
        { href: '/pembelian/laporan', label: 'Laporan Realisasi PO', icon: FileText },
        { href: '/laporan/pembelian', label: 'Tren Pembelian Bulanan', icon: BarChart3 },
        {
          href: `${resolvedAdminUrl}/dashboard/pembelian/supplier`,
          label: 'Master Supplier',
          icon: Truck,
          isExternal: true,
        },
        {
          href: `${resolvedAdminUrl}/dashboard/bahan-baku`,
          label: 'Master Bahan Baku',
          icon: Tags,
          isExternal: true,
        },
      ],
    },
  ]
}

// Flattened for easy lookup of active path
const ALL_LINKS = FINANCE_NAV_GROUPS.flatMap(g => g.items)

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
  const { outletStaff, signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeItemRef = useRef<HTMLAnchorElement>(null)

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  const adminUrl = process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD || 'https://admin.sukashawarma.com'
  let resolvedAdminUrl = adminUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedAdminUrl = 'http://localhost:3005'
  }

  const isPurchasingRole = Boolean(
    outletStaff && ((outletStaff.role as string) === 'purchasing' || (outletStaff.role as string) === 'purchase')
  )
  const isDeveloper = outletStaff?.role?.toLowerCase() === 'developer'

  // Badge cukup jumlah → query count-only, bukan daftar lengkap + join.
  const { data: pettyPendingCount = 0 } = usePettyCashCount('forwarded_to_finance')
  const { data: poPendingCount = 0 } = usePendingPoCount()
  const { data: prPendingCount = 0 } = usePendingPrCount()
  
  const prevPendingRef = useRef(0)

  useEffect(() => {
    const totalPending = isPurchasingRole
      ? prPendingCount
      : pettyPendingCount + poPendingCount
    const appTitle = isPurchasingRole ? 'Suka Purchasing' : 'Suka Finance'
    if (totalPending > 0) {
      document.title = `(${totalPending}) ${appTitle}`
    } else {
      document.title = appTitle
    }

    // Play sound if the number of tasks increased
    if (totalPending > prevPendingRef.current && prevPendingRef.current !== 0) {
      playNotificationSound()
    }
    // Update ref for next comparison
    prevPendingRef.current = totalPending
  }, [isPurchasingRole, prPendingCount, pettyPendingCount, poPendingCount])

  const baseNavGroups: NavGroup[] = isPurchasingRole
    ? buildPurchasingNavGroups(resolvedAdminUrl)
    : FINANCE_NAV_GROUPS

  const visibleNavGroups = baseNavGroups.map(g => ({
    ...g,
    items: g.items.filter(item => {
      if (item.href === '/eom-closing' && !isDeveloper) {
        return false
      }
      return true
    }),
  }))

  const visibleInternalLinks = visibleNavGroups
    .flatMap(g => g.items)
    .filter(item => !item.isExternal)

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
        { href: '/laporan/buku-kas', label: 'Buku Kas', icon: Receipt },
      ]

  // Active path resolution
  let currentNavPath = '/'
  if (pathname === '/') {
    currentNavPath = '/'
  } else {
    // 1. Check exact match or exact alias match first
    const exact = ALL_LINKS.find(
      l => l.href === pathname || l.aliases?.includes(pathname)
    )
    if (exact) {
      currentNavPath = exact.href
    } else {
      // 2. Otherwise find the most specific (longest) matching href for nested routes like /pembelian/[id]
      const matching = ALL_LINKS
        .filter(l => l.href !== '/' && pathname.startsWith(l.href))
        .sort((a, b) => b.href.length - a.href.length)
      currentNavPath = matching[0]?.href ?? '/'
    }
  }
  const currentLink =
    visibleInternalLinks.find(l => l.href === currentNavPath) ??
    ALL_LINKS.find(l => l.href === currentNavPath)
  const activeGroupTitle = visibleNavGroups.find(g =>
    g.items.some(item => item.href === currentNavPath)
  )?.title

  // State buka/tutup grup di sidebar
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      'OPERASIONAL PURCHASING': true,
      'ANALISIS & MASTER DATA': true,
    }
    FINANCE_NAV_GROUPS.forEach(g => {
      initial[g.title] = Boolean(g.defaultOpen)
    })
    return initial
  })

  // Pastikan grup yang sedang aktif otomatis terbuka saat pindah halaman
  useEffect(() => {
    if (activeGroupTitle) {
      setOpenGroups(prev => (prev[activeGroupTitle] ? prev : { ...prev, [activeGroupTitle]: true }))
    }
  }, [activeGroupTitle])

  // Auto-scroll item aktif ke area pandang sidebar
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [pathname, openGroups])

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }))
  }

  const getItemBadge = (href: string): number | undefined => {
    if (href === '/petty-cash') return pettyPendingCount
    if (href === '/po-approval') return poPendingCount
    if (href === '/pembelian/permintaan') return prPendingCount
    return undefined
  }

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

  // Prevent purchasing role from accessing finance-only routes
  if (
    isPurchasingRole &&
    pathname &&
    pathname !== '/' &&
    !pathname.startsWith('/pembelian') &&
    pathname !== '/po-approval' &&
    pathname !== '/laporan/pembelian'
  ) {
    if (typeof window !== 'undefined') {
      window.location.href = '/pembelian/dashboard'
    }
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-suka-brown font-sans md:p-1.5 xl:p-2">
      {/* Sidebar */}
      <aside className="hidden w-56 xl:w-60 shrink-0 text-white md:flex md:flex-col print:hidden z-20 relative overflow-hidden select-none">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-suka-orange/10 rounded-tr-full pointer-events-none"></div>

        {/* Brand Header */}
        <div className="px-4 py-3 flex items-center gap-3 relative z-10 border-b border-white/10 shrink-0">
          <Link href={isPurchasingRole ? "/pembelian/dashboard" : "/"} className="flex items-center gap-2.5 group w-full">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center p-1.5 shrink-0 group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="Suka Shawarma" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg tracking-wide leading-none text-white truncate">
                Suka<span className="text-suka-orange">{isPurchasingRole ? 'Purchasing' : 'Finance'}</span>
              </div>
              <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-0.5 truncate">
                {isPurchasingRole ? 'Procurement Hub' : 'Treasury Hub'}
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Groups */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto py-2.5 px-2.5 space-y-1.5 relative z-10 scrollbar-hide"
        >
          {visibleNavGroups.map((group) => {
            const GroupIcon = group.icon
            const isOpen = Boolean(openGroups[group.title])
            const hasActiveItem = group.items.some(item => item.href === currentNavPath)
            const groupBadgeTotal = group.items.reduce(
              (sum, item) => sum + (getItemBadge(item.href) || 0),
              0
            )

            return (
              <div key={group.title} className="rounded-xl">
                {/* Kepala Grup (Collapsible Trigger) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer group ${
                    hasActiveItem && !isOpen
                      ? 'bg-white/10 text-white'
                      : 'hover:bg-white/5 text-suka-orange/90'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GroupIcon className="w-3.5 h-3.5 text-suka-orange/80 group-hover:text-suka-orange shrink-0 transition-colors" />
                    <span className="text-[10px] font-black tracking-wider uppercase truncate text-suka-orange/90 group-hover:text-suka-orange">
                      {group.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isOpen && groupBadgeTotal > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white shadow-sm">
                        {groupBadgeTotal}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Daftar Item dalam Grup */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-0.5 space-y-0.5 pl-2 border-l border-white/10 ml-3">
                        {group.items.map(({ href, label, icon: Icon, isExternal }) => {
                          const active = currentNavPath === href
                          const badgeCount = getItemBadge(href)

                          if (isExternal) {
                            return (
                              <a
                                key={href}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-semibold text-xs transition-colors relative z-10 text-white/70 hover:text-white hover:bg-white/5 group"
                              >
                                <Icon className="w-3.5 h-3.5 text-white/50 group-hover:text-suka-orange transition-colors shrink-0" />
                                <span className="flex-1 truncate">{label}</span>
                                <ExternalLink className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors shrink-0" />
                              </a>
                            )
                          }

                          return (
                            <Link
                              key={href}
                              ref={active ? activeItemRef : undefined}
                              href={href}
                              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-semibold text-xs transition-colors relative z-10 ${
                                active
                                  ? 'text-suka-brown font-bold'
                                  : 'text-white/70 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {active && (
                                <motion.div
                                  layoutId="sidebarActive"
                                  className="absolute inset-0 bg-suka-cream rounded-lg -z-10 shadow-sm"
                                  transition={{ type: 'spring', stiffness: 250, damping: 22 }}
                                />
                              )}
                              <Icon
                                className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                  active ? 'text-suka-orange' : 'text-white/50'
                                }`}
                              />
                              <span className="flex-1 truncate">{label}</span>
                              {badgeCount !== undefined && badgeCount > 0 && (
                                <span
                                  className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold transition-colors ${
                                    active
                                      ? 'bg-suka-orange text-white'
                                      : 'bg-red-500 text-white shadow-sm'
                                  }`}
                                >
                                  {badgeCount}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Sidebar Footer Quick Actions */}
        <div className="p-2.5 border-t border-white/10 relative z-10 shrink-0">
          <a
            href={resolvedPortalUrl}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-suka-orange shrink-0" />
            <span className="truncate">Portal Operasional</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-suka-cream md:rounded-[1.5rem] xl:rounded-[2rem] shadow-2xl shadow-black/20 border-l md:border border-white/10 md:border-suka-brown/10">
        {/* Compact Header */}
        <header className="bg-suka-cream/85 backdrop-blur-2xl px-4 sm:px-5 py-2.5 flex justify-between items-center gap-3 z-30 shrink-0 print:hidden sticky top-0 border-b border-suka-brown/5 md:rounded-t-[1.5rem] xl:rounded-t-[2rem]">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-suka-brown tracking-tight truncate">
              {currentLink?.label ?? 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 bg-white p-1 pr-2.5 rounded-xl border border-suka-brown/5 shadow-2xs hover:border-suka-orange/30 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-suka-orange/20 text-suka-orange flex items-center justify-center text-xs font-bold">
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
          <div className="w-full max-w-full p-3.5 sm:p-4 lg:p-5 pb-24 md:pb-6">
            {children}
          </div>
        </main>

        {/* Playful Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-suka-brown text-white backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-suka-brown/20 flex items-center justify-around px-2 py-2 print:hidden">
          {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = currentNavPath === href
            const badgeCount = getItemBadge(href)
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
                        {group.items.map(({ href, label, icon: Icon, isExternal }) => {
                          const active = currentNavPath === href
                          const badgeCount = getItemBadge(href)

                          if (isExternal) {
                            return (
                              <a
                                key={href}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex flex-col items-center gap-2"
                              >
                                <div className="w-14 h-14 flex items-center justify-center rounded-[1.25rem] shadow-sm bg-white text-suka-brown hover:bg-suka-orange/10">
                                  <Icon size={24} />
                                </div>
                                <span className="text-[10px] font-bold text-center text-suka-brown leading-tight flex items-center gap-1">
                                  {label} <ExternalLink size={10} className="text-suka-brown/40" />
                                </span>
                              </a>
                            )
                          }

                          return (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => setIsMenuOpen(false)}
                              className="flex flex-col items-center gap-2"
                            >
                              <div className={`w-14 h-14 flex items-center justify-center rounded-[1.25rem] shadow-sm relative ${
                                active ? 'bg-suka-orange text-white' : 'bg-white text-suka-brown hover:bg-suka-orange/10'
                              }`}>
                                <Icon size={24} />
                                {badgeCount !== undefined && badgeCount > 0 && (
                                  <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-white px-1 text-[10px] font-black shadow-sm">
                                    {badgeCount}
                                  </span>
                                )}
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

