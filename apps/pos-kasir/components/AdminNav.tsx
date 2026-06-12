'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ClipboardList, Sandwich, LogOut, LayoutDashboard, Tag, Radio, BarChart3, Settings, Menu, X, Store, Users, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/components/BrandContext'

const links = [
  { href: '/admin',            label: 'Overview',  icon: BarChart3 },
  { href: '/admin/reports',    label: 'Laporan',   icon: ClipboardList },
  { href: '/admin/menu',       label: 'Menu',      icon: LayoutDashboard },
  { href: '/admin/categories', label: 'Kategori',  icon: Tag },
  { href: '/admin/outlets',    label: 'Cabang',    icon: Store },
  { href: '/admin/users',      label: 'Pengguna',  icon: Users },
  { href: '/admin/guides',     label: 'Panduan',   icon: BookOpen },
  { href: '/admin/settings',   label: 'Pengaturan',icon: Settings },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { brandName, brandLogo } = useBrand()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
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
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold
                  transition-all duration-150
                  ${active
                    ? 'bg-amber-50 text-amber-600'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-amber-500' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bawah: Logout */}
        <div className="px-4 py-6 border-t border-gray-100 space-y-2 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-bold
              text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} />
            Keluar
          </button>
        </div>
      </aside>
    </>
  )
}
