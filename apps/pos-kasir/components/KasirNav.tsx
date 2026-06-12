'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ClipboardList, Sandwich, LogOut, Bell, BarChart3, Menu, X, Monitor, Image as ImageIcon, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { useEffect } from 'react'
import { useBrand } from '@/components/BrandContext'

const links = [
  { href: '/kasir',            label: 'Order',         icon: Bell },
  { href: '/kasir/menu',       label: 'Manajemen Menu',icon: Sandwich },
  { href: '/kasir/histori',    label: 'Histori',       icon: ClipboardList },
  { href: '/kasir/kiosk',      label: 'Kontrol Device Pelanggan', icon: Monitor },
  { href: '/kasir/reports',    label: 'Laporan',       icon: BarChart3 },
  { href: '/kasir/settings',   label: 'Tampilan Layar',icon: ImageIcon },
  { href: '/panduan',          label: 'Panduan',       icon: BookOpen },
]

export default function KasirNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { outletId } = useMyOutlet()
  const [outletName, setOutletName] = useState('Kasir Outlet')
  const [cashierName, setCashierName] = useState('')
  const { brandName, brandLogo } = useBrand()

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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Top bar mobile */}
      <header className="print:hidden lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/kasir" className="flex items-center gap-2.5">
          {brandLogo ? (
            <img src={brandLogo} alt="Logo" className="w-8 h-8 object-cover rounded-xl" />
          ) : (
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
              <Sandwich className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          )}
          <div className="min-w-0 flex flex-col justify-center">
            <p className="text-gray-900 font-bold text-sm tracking-tight truncate max-w-[120px]">
              {cashierName ? cashierName : brandName}
            </p>
          </div>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`print:hidden fixed lg:sticky top-0 left-0 z-50 lg:z-auto
          h-screen w-64 shrink-0
          bg-white border-r border-gray-100
          flex flex-col
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="flex items-center justify-between h-[5.5rem] px-6 border-b border-gray-100 shrink-0">
          <Link href="/kasir" className="flex items-center gap-3 min-w-0" onClick={() => setOpen(false)}>
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" className="w-10 h-10 object-cover rounded-2xl shrink-0" />
            ) : (
              <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                <Sandwich className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
            )}
            <div className="min-w-0 flex flex-col justify-center">
              <p className="text-gray-900 font-bold text-[15px] tracking-tight leading-none truncate mb-1">
                {cashierName ? `Hai, ${cashierName}` : brandName}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-amber-500 text-[11px] font-bold uppercase tracking-widest leading-none truncate">
                  {outletName}
                </p>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/kasir' ? pathname === '/kasir' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold transition-all
                  ${active ? 'bg-amber-50 text-amber-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-amber-500' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-6 border-t border-gray-100 space-y-2 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold text-red-500 hover:bg-red-50"
          >
            <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} />
            Keluar
          </button>
        </div>
      </aside>
    </>
  )
}
