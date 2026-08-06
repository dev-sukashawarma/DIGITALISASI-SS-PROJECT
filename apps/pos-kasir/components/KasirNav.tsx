'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Sandwich, LogOut, Bell, BarChart3, Menu, X, Monitor, Image as ImageIcon, BookOpen, ChevronLeft, ChevronRight, ArrowLeft, PackageSearch, Tag, Loader2, Wallet, ChefHat, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fastLogout } from '@/lib/fast-logout'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { useStockAlerts } from '@/lib/useStockAlerts'
import { getStokUrl } from '@/lib/stokUrl'
import { useBrand } from '@/components/BrandContext'
import { useNetworkStatus } from '@/lib/useNetworkStatus'
import { usePrinterStore } from '@/lib/printerStore'
import { connectBluetoothPrinter, autoConnectBluetoothPrinter } from '@/lib/bluetooth-printer'
import { Printer } from 'lucide-react'
import { useDialogStore } from '@/lib/dialogStore'

const links = [
  { 
    label: 'Order', 
    icon: Bell,
    subItems: [
      { href: '/kasir', label: 'Pesanan Kasir' },
      { href: '/kasir/info-porsi', label: 'Info Porsi & Stok' }
    ]
  },
  { href: '/kasir/menu',       label: 'Manajemen Menu',icon: Sandwich },
  { 
    label: 'Shift', 
    icon: Wallet,
    subItems: [
      { href: '/kasir/shift', label: 'Petty Cash' },
      { href: '/kasir/shift/close', label: 'Tutup Shift' }
    ]
  },
  { href: '/kasir/histori',    label: 'Histori & Bonus',       icon: ClipboardList },
  { href: '/kasir/kiosk',      label: 'Kontrol Device Pelanggan', icon: Monitor },
  { href: '/kasir/reports',    label: 'Laporan',       icon: BarChart3 },
  { href: '/kasir/settings',   label: 'Tampilan Layar',icon: ImageIcon },
  { href: '/panduan',          label: 'Panduan',       icon: BookOpen },
]

export default function KasirNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { outletId } = useMyOutlet()
  const { showAlert } = useDialogStore()

  let resolvedPortalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    resolvedPortalUrl = 'http://localhost:3010'
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }
  const { items: lowStockItems } = useStockAlerts(outletId)
  const [outletName, setOutletName] = useState('Kasir Outlet')
  const [cashierName, setCashierName] = useState('')
  const { brandName, brandLogo } = useBrand()
  const isOnline = useNetworkStatus()
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)

  const [isCollapsedState, setIsCollapsed] = useState(true)
  const isCollapsed = isCollapsedState && !open;
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const { device, isConnecting, disconnect } = usePrinterStore()

  // When expanding sidebar, ensure dropdown is closed initially
  useEffect(() => {
    if (isCollapsed) {
      setOpenDropdown(null)
    }
  }, [isCollapsed])

  useEffect(() => {
    // Polling for offline queue count
    const fetchQueueCount = async () => {
      try {
        const { db } = await import('@/lib/db')
        const count = await db.sync_queue_orders.where('status').equals('pending').count()
        setOfflineQueueCount(count)
      } catch (e) {
        console.error('Error fetching offline queue count', e)
      }
    }
    fetchQueueCount()
    const interval = setInterval(fetchQueueCount, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('kasir_sidebar_collapsed')
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    } else {
      setIsCollapsed(true)
    }
  }, [])

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newVal = !prev
      localStorage.setItem('kasir_sidebar_collapsed', String(newVal))
      return newVal
    })
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCashier = sessionStorage.getItem('attendance_cashier_name')
      const storedBranch = sessionStorage.getItem('attendance_branch_name')
      if (storedCashier) setCashierName(storedCashier)
      if (storedBranch) setOutletName(storedBranch)
    }

    if (!outletId) return
    const fetchOutlet = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('outlets').select('name').eq('id', outletId).single()
      if (data && !sessionStorage.getItem('attendance_branch_name')) {
        setOutletName(`Cabang ${data.name}`)
      }
    }
    fetchOutlet()
  }, [outletId])

  const [loggingOut, setLoggingOut] = useState(false)
  async function handleLogout() {
    try {
      const { db } = await import('@/lib/db')
      const pendingOrders = await db.sync_queue_orders.where('status').equals('pending').count()
      if (pendingOrders > 0) {
        await showAlert(`Peringatan: Ada ${pendingOrders} pesanan offline yang belum dikirim ke server.\n\nHarap tunggu hingga koneksi internet kembali dan pesanan tersinkronisasi sebelum keluar.`, 'Perhatian')
        return
      }
    } catch (e) {
      console.error('Error checking sync queue', e)
    }

    setLoggingOut(true)
    await fastLogout(resolvedPortalUrl)
  }

  return (
    <>
      {/* Top bar mobile */}
      <header className="print:hidden md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-[#fff8f1] border-b border-[#d9c2b2] shadow-sm">
        <Link href="/kasir" className="flex items-center gap-2.5">
          {brandLogo ? (
            <img src={brandLogo} alt="Logo" className="w-8 h-8 object-contain rounded-xl" />
          ) : (
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain rounded-xl" />
          )}
          <div className="min-w-0 flex flex-col justify-center">
            <p className="text-[#1e1b15] font-bold text-sm tracking-tight truncate max-w-[120px]">
              {cashierName ? cashierName : brandName}
            </p>
            <p className="text-[#904d00] text-[10px] font-bold uppercase tracking-widest leading-none truncate max-w-[120px]">
              {outletName}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-700 text-xs font-bold">OFFLINE {offlineQueueCount > 0 && `(${offlineQueueCount})`}</span>
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-[#544437] hover:bg-[#e9e1d8] hover:text-[#1e1b15] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`print:hidden fixed md:sticky top-0 left-0 z-50 md:z-[100]
          h-[100dvh] shrink-0 self-start
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'md:w-20' : 'md:w-64'} w-64
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Collapse toggle button for desktop */}
        <button
          onClick={toggleCollapse}
          className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3.5 z-[150] w-7 h-7 bg-[#f29744] hover:bg-[#e08632] text-white rounded-full border border-[#d9c2b2] shadow-sm items-center justify-center cursor-pointer transition-transform duration-200 active:scale-95"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className={`absolute inset-y-0 left-0 ${isCollapsed ? 'md:w-[300px] w-64' : 'w-64'} overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden pointer-events-none`}>
          <div className={`relative flex flex-col min-h-full bg-[#f5ede3] border-r border-[#d9c2b2] pointer-events-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'md:w-20 w-64' : 'w-64'}`}>

        <div className={`flex flex-col relative justify-center border-b border-[#d9c2b2] shrink-0 ${isCollapsed ? 'h-[5.5rem] px-4 items-center' : 'py-6 px-6 items-center'}`}>
          <Link href="/kasir" className={`flex min-w-0 ${isCollapsed ? 'flex-col gap-0 justify-center items-center' : 'flex-col gap-3 items-center text-center'}`} onClick={() => setOpen(false)}>
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" className="w-12 h-12 object-contain rounded-2xl shrink-0 shadow-sm" />
            ) : (
              <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain rounded-2xl shrink-0 shadow-sm" />
            )}
            {!isCollapsed && (
              <div className="min-w-0 flex flex-col items-center justify-center animate-fade-in">
                <p className="text-[#1e1b15] font-bold text-[15px] tracking-tight leading-snug text-center mb-1 break-words max-w-full">
                  {cashierName ? `Hai, ${cashierName}` : brandName}
                </p>
                <div className="flex flex-col items-center justify-center gap-1 bg-[#e9e1d8] px-2.5 py-1.5 rounded-2xl shadow-inner w-full max-w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-green-500' : 'bg-red-500'} animate-pulse shadow-sm`} />
                    <span className="text-[#904d00] text-[9px] font-bold uppercase tracking-widest">
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="text-[#904d00] text-[10px] font-bold uppercase tracking-widest leading-tight text-center break-words w-full">
                    {isOnline ? outletName : (offlineQueueCount > 0 ? `Antrean: ${offlineQueueCount}` : 'Tidak ada antrean')}
                  </p>
                </div>
              </div>
            )}
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-[#877365] hover:bg-[#e9e1d8]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className={`flex-1 py-6 space-y-2 ${isCollapsed ? 'px-2.5' : 'px-4'}`}>
          {links.map((link) => {
            const hasSubItems = !!link.subItems && link.subItems.length > 0;
            const Icon = link.icon;

            if (!hasSubItems) {
              const href = link.href!;
              const active = href === '/kasir' ? pathname === '/kasir' : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center rounded-2xl text-[15px] font-bold transition-all
                    ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3'}
                    ${active 
                      ? 'bg-[#f29744] text-[#643400] border-l-4 border-[#904d00] shadow-sm' 
                      : 'text-[#544437] hover:text-[#1e1b15] hover:bg-[#e9e1d8]'}`}
                  title={isCollapsed ? link.label : undefined}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#904d00]' : 'text-[#877365]'}`} strokeWidth={active ? 2.5 : 2} />
                  {!isCollapsed && <span className="animate-fade-in truncate">{link.label}</span>}
                </Link>
              )
            }

            // Dropdown logic for subItems
            const bestMatchSub = link.subItems!.reduce((best: any, current) => {
              const matches = current.href === '/kasir' ? pathname === '/kasir' : (pathname === current.href || pathname.startsWith(current.href + '/'));
              if (matches) {
                if (!best || current.href.length > best.href.length) return current;
              }
              return best;
            }, null);

            const anySubActive = !!bestMatchSub;
            const isThisDropdownOpen = openDropdown === link.label;

            return (
              <div key={link.label} className="relative group">
                {/* Main Button */}
                <button
                  onClick={() => {
                    setOpenDropdown(isThisDropdownOpen ? null : link.label)
                  }}
                  className={`flex items-center justify-between w-full rounded-2xl text-[15px] font-bold transition-all
                    ${isCollapsed ? 'justify-center p-3.5' : 'px-4 py-3'}
                    ${anySubActive && !isThisDropdownOpen && isCollapsed
                      ? 'bg-[#f29744] text-[#643400] border-l-4 border-[#904d00] shadow-sm' 
                      : 'text-[#544437] hover:text-[#1e1b15] hover:bg-[#e9e1d8]'}`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <Icon className={`w-5 h-5 shrink-0 ${anySubActive && isCollapsed ? 'text-[#904d00]' : 'text-[#877365]'}`} strokeWidth={anySubActive && isCollapsed ? 2.5 : 2} />
                    {!isCollapsed && <span className="animate-fade-in truncate">{link.label}</span>}
                  </div>
                  {!isCollapsed && <ChevronDown className={`w-4 h-4 text-[#877365] transition-transform ${isThisDropdownOpen ? 'rotate-180' : ''}`} />}
                </button>

                {/* Accordion for Expanded Sidebar */}
                {!isCollapsed && isThisDropdownOpen && (
                  <div className="mt-1 flex flex-col space-y-1 pl-11 pr-2 animate-fade-in">
                    {link.subItems!.map(sub => {
                      const subActive = bestMatchSub?.href === sub.href;
                      return (
                        <Link 
                          key={sub.href} 
                          href={sub.href} 
                          onClick={() => {
                            setOpen(false)
                            setOpenDropdown(null)
                          }} 
                          className={`block px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${subActive ? 'bg-[#f29744] text-white shadow-sm' : 'text-[#544437] hover:bg-[#e9e1d8] hover:text-[#1e1b15]'}`}
                        >
                          {sub.label}
                        </Link>
                      )
                    })}
                  </div>
                )}

                {/* Popover for Collapsed Sidebar (desktop hover/click) */}
                {isCollapsed && (
                  <div className={`absolute left-full top-0 ml-3 w-48 bg-[#fff8f1] border border-[#d9c2b2] shadow-xl rounded-2xl p-2 z-[100] animate-fade-in before:content-[''] before:absolute before:top-4 before:-left-2 before:border-t-8 before:border-t-transparent before:border-b-8 before:border-b-transparent before:border-r-8 before:border-r-[#fff8f1] ${isThisDropdownOpen ? 'block' : 'hidden md:group-hover:block'}`}>
                    <div className="text-xs font-bold text-[#a48e7f] mb-2 px-3 uppercase tracking-wider">{link.label}</div>
                    <div className="flex flex-col gap-1">
                      {link.subItems!.map(sub => {
                        const subActive = bestMatchSub?.href === sub.href;
                        return (
                          <Link 
                            key={sub.href} 
                            href={sub.href} 
                            onClick={() => {
                              setOpen(false)
                              setOpenDropdown(null)
                            }} 
                            className={`block px-3 py-2 rounded-xl text-sm font-bold transition-colors ${subActive ? 'bg-[#f29744] text-white shadow-sm' : 'text-[#544437] hover:bg-[#e9e1d8] hover:text-[#1e1b15]'}`}
                          >
                            {sub.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <a
            href={`${getStokUrl()}/dashboard`}
            target="_blank"
            rel="noopener noreferrer"
            className={`relative flex items-center rounded-2xl text-[15px] font-bold transition-all text-[#544437] hover:text-[#1e1b15] hover:bg-[#e9e1d8]
              ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3'}`}
            title={isCollapsed ? 'Stok Outlet' : undefined}
          >
            <PackageSearch className="w-5 h-5 shrink-0 text-[#877365]" strokeWidth={2} />
            {!isCollapsed && <span className="animate-fade-in truncate">Stok Outlet</span>}
            {lowStockItems.length > 0 && (
              <span className={`absolute bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[#f5ede3] flex items-center justify-center
                ${isCollapsed ? 'top-1 right-1 w-4 h-4' : 'top-2 right-3 min-w-[18px] h-[18px] px-1'}`}>
                {lowStockItems.length}
              </span>
            )}
          </a>
        </nav>

        <div className={`py-6 border-t border-[#d9c2b2] space-y-2 shrink-0 ${isCollapsed ? 'px-2.5' : 'px-4'}`}>
          <a
            href={resolvedPortalUrl}
            className={`w-full flex items-center rounded-2xl text-[15px] font-bold text-[#544437] hover:text-[#1e1b15] hover:bg-[#e9e1d8] transition-colors
              ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3'}`}
            title={isCollapsed ? "Kembali ke Portal" : undefined}
          >
            <ArrowLeft className="w-5 h-5 shrink-0 text-[#877365]" strokeWidth={2} />
            {!isCollapsed && <span className="animate-fade-in">Portal</span>}
          </a>
          
          <button
            onClick={() => {
              if (device) disconnect();
              else connectBluetoothPrinter();
            }}
            disabled={isConnecting}
            className={`w-full flex items-center rounded-2xl text-[15px] font-bold transition-colors disabled:opacity-60 disabled:cursor-wait
              ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3'}
              ${device ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'text-[#544437] hover:text-[#1e1b15] hover:bg-[#e9e1d8]'}`}
            title={isCollapsed ? (device ? `Printer: ${device.name || 'Terhubung'}` : "Hubungkan Printer") : undefined}
          >
            {isConnecting ? (
              <Loader2 className="w-5 h-5 shrink-0 animate-spin" strokeWidth={2} />
            ) : (
              <Printer className={`w-5 h-5 shrink-0 ${device ? 'text-indigo-600' : 'text-[#877365]'}`} strokeWidth={2} />
            )}
            {!isCollapsed && (
              <span className="animate-fade-in truncate">
                {isConnecting ? 'Menghubungkan...' : device ? (device.name || 'Printer Aktif') : 'Koneksi Printer'}
              </span>
            )}
          </button>
          
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={`w-full flex items-center rounded-2xl text-[15px] font-bold text-[#a43c26] hover:bg-[#e9e1d8]/50 transition-colors disabled:opacity-60 disabled:cursor-wait
              ${isCollapsed ? 'justify-center p-3.5' : 'gap-3 px-4 py-3'}`}
            title={isCollapsed ? "Keluar" : undefined}
          >
            {loggingOut ? (
              <Loader2 className="w-5 h-5 shrink-0 animate-spin" strokeWidth={2} />
            ) : (
              <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} />
            )}
            {!isCollapsed && <span className="animate-fade-in">{loggingOut ? 'Keluar…' : 'Keluar'}</span>}
          </button>
        </div>
        </div>
        </div>
      </aside>
    </>
  )
}
