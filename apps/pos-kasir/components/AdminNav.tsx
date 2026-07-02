'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Sandwich, LogOut, LayoutDashboard, Tag, Radio, BarChart3, Settings, Menu, X, Store, Users, BookOpen, ArrowLeft, Gauge, FolderTree, Loader2, ArrowDownToLine } from 'lucide-react'
import { fastLogout } from '@/lib/fast-logout'
import { useBrand } from '@/components/BrandContext'
import { usePendingPettyCash } from '@/lib/usePendingPettyCash'

const links = [
  { href: '/admin',            label: 'Overview',  icon: BarChart3 },
  { href: '/admin/reports',    label: 'Laporan',   icon: ClipboardList },
  { href: '/admin/menu',       label: 'Menu',      icon: LayoutDashboard },
  { href: '/admin/categories', label: 'Kategori',  icon: FolderTree },
  { href: '/admin/promo',      label: 'Promo',     icon: Tag },
  { href: '/admin/outlets',    label: 'Cabang',    icon: Store },
  { href: '/admin/petty-cash', label: 'Petty Cash',icon: ArrowDownToLine },
  { href: '/admin/users',      label: 'Pengguna',  icon: Users },
  { href: '/admin/guides',     label: 'Panduan',   icon: BookOpen },
  { href: '/admin/settings',   label: 'Pengaturan',icon: Settings },
]

export default function AdminNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { brandName, brandLogo } = useBrand()
  const pendingPettyCash = usePendingPettyCash()

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  // Deep-link balik ke Admin Dashboard (HR/Owner/System). Section /admin ini
  // sudah dibatasi middleware ke role 'admin', jadi link ini otomatis role-based.
  let adminDashboardUrl = process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD || 'https://admin.sukashawarma.com'
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    adminDashboardUrl = 'http://localhost:3005'
  }

  const [loggingOut, setLoggingOut] = useState(false)
  async function handleLogout() {
    setLoggingOut(true)
    await fastLogout(resolvedPortalUrl)
  }

  return (
    <>
      {/* ── Top bar mobile (< md) ── */}
      <header className="print:hidden md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/admin" className="flex items-center gap-2.5">
          {brandLogo ? (
            <img src={brandLogo} alt="Logo" className="w-8 h-8 object-cover rounded-xl" />
          ) : (
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
              <Sandwich className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          )}
          <p className="text-gray-900 font-bold text-sm tracking-tight truncate max-w-[120px]">{brandName}</p>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── Backdrop drawer (mobile) ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`print:hidden fixed md:sticky top-0 left-0 z-50 md:z-auto
          h-screen w-64 shrink-0
          bg-white border-r border-gray-100
          flex flex-col
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} md:translate-x-0`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100 shrink-0">
          <Link href="/admin" className="flex items-center gap-3 min-w-0" onClick={() => setOpen(false)}>
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" className="w-9 h-9 object-cover rounded-2xl shrink-0" />
            ) : (
              <div className="w-9 h-9 bg-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                <Sandwich className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-gray-900 font-bold text-[15px] tracking-tight leading-none truncate">{brandName}</p>
              <p className="text-amber-500 text-[10px] font-bold uppercase tracking-widest leading-none mt-1">
                Admin
              </p>
            </div>
          </Link>
          {/* Tombol tutup (mobile) */}
          <button
            onClick={() => setOpen(false)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            const badgeCount = href === '/admin/petty-cash' ? pendingPettyCash : 0
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold
                  transition-all duration-150
                  ${active
                    ? 'bg-amber-50 text-amber-600'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-amber-500' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 2} />
                {label}
                {badgeCount > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold">
                    {badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bawah: Logout */}
        <div className="px-4 py-6 border-t border-gray-100 space-y-2 shrink-0">
          <a
            href={adminDashboardUrl}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold
              text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Gauge className="w-5 h-5 shrink-0 text-amber-500" strokeWidth={2} />
            Admin Dashboard
          </a>
          <a
            href={resolvedPortalUrl}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold
              text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 shrink-0 text-gray-400" strokeWidth={2} />
            Portal
          </a>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold
              text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {loggingOut ? (
              <Loader2 className="w-5 h-5 shrink-0 animate-spin" strokeWidth={2} />
            ) : (
              <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} />
            )}
            {loggingOut ? 'Keluar…' : 'Keluar'}
          </button>
        </div>
      </aside>
    </>
  )
}
