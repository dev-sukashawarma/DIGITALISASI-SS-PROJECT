'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Sandwich, LogOut, Bell, BarChart3, Menu, X, Monitor, Image as ImageIcon, BookOpen, ChevronLeft, ChevronRight, ArrowLeft, PackageSearch, Tag, Loader2, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fastLogout } from '@/lib/fast-logout'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { useStockAlerts } from '@/lib/useStockAlerts'
import { getStokUrl } from '@/lib/stokUrl'
import { useEffect } from 'react'
import { useBrand } from '@/components/BrandContext'

const links = [
  { href: '/kasir',            label: 'Order',         icon: Bell },
  { href: '/kasir/menu',       label: 'Manajemen Menu',icon: Sandwich },
  { href: '/kasir/shift',      label: 'Petty Cash',   icon: Wallet },
  { href: '/kasir/histori',    label: 'Histori',       icon: ClipboardList },
  { href: '/kasir/kiosk',      label: 'Kontrol Device Pelanggan', icon: Monitor },
  { href: '/kasir/reports',    label: 'Laporan',       icon: BarChart3 },
  { href: '/kasir/settings',   label: 'Tampilan Layar',icon: ImageIcon },
  { href: '/panduan',          label: 'Panduan',       icon: BookOpen },
]

export default function KasirNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { outletId } = useMyOutlet()

  let resolvedPortalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }
  const { items: lowStockItems } = useStockAlerts(outletId)
  const [outletName, setOutletName] = useState('Kasir Outlet')
  const [cashierName, setCashierName] = useState('')
  const { brandName, brandLogo } = useBrand()

  const [isCollapsed, setIsCollapsed] = useState(true)


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
    setLoggingOut(true)
    // Hard redirect di fastLogout otomatis membuang cache React Query.
    await fastLogout(resolvedPortalUrl)
  }

  return (
    <>
      {/* Top bar mobile */}
      <header className="print:hidden lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-[#fff8f1] border-b border-[#d9c2b2] shadow-sm">
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
          </div>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-[#544437] hover:bg-[#e9e1d8] hover:text-[#1e1b15] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`print:hidden fixed lg:sticky top-0 left-0 z-50 lg:z-auto
          h-[100dvh] shrink-0 self-start
          bg-[#f5ede3] border-r border-[#d9c2b2]
          flex flex-col
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Collapse toggle button for desktop */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-3.5 z-[60] w-7 h-7 bg-[#f29744] hover:bg-[#e08632] text-white rounded-full border border-[#d9c2b2] shadow-sm items-center justify-center cursor-pointer transition-transform duration-200 active:scale-95"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className={`flex items-center justify-between h-[5.5rem] border-b border-[#d9c2b2] shrink-0 ${isCollapsed ? 'px-4 justify-center' : 'px-6'}`}>
          <Link href="/kasir" className={`flex items-center min-w-0 ${isCollapsed ? 'gap-0 justify-center' : 'gap-3'}`} onClick={() => setOpen(false)}>
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" className="w-10 h-10 object-contain rounded-2xl shrink-0" />
            ) : (
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-2xl shrink-0" />
            )}
            {!isCollapsed && (
              <div className="min-w-0 flex flex-col justify-center animate-fade-in">
                <p className="text-[#1e1b15] font-bold text-[15px] tracking-tight leading-none truncate mb-1">
                  {cashierName ? `Hai, ${cashierName}` : brandName}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[#904d00] text-[11px] font-bold uppercase tracking-widest leading-none truncate">
                    {outletName}
                  </p>
                </div>
              </div>
            )}
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[#877365] hover:bg-[#e9e1d8]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto py-6 space-y-2 ${isCollapsed ? 'px-2.5' : 'px-4'}`}>
          {links.map(({ href, label, icon: Icon }) => {
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
                title={isCollapsed ? label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#904d00]' : 'text-[#877365]'}`} strokeWidth={active ? 2.5 : 2} />
                {!isCollapsed && <span className="animate-fade-in truncate">{label}</span>}
              </Link>
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
      </aside>
    </>
  )
}
