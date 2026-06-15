'use client'
import Link from 'next/link'
import { useAuth, createSupabaseBrowserClient } from '@suka/auth'
import type { Role } from '@suka/auth'
import { Avatar, Button } from '@suka/design-system'
import { LogOut } from 'lucide-react'

// Kartu fitur stok + role yang boleh mengakses
interface NavItem {
  href: string
  label: string
  desc: string
  roles: Role[]
}

const NAV: NavItem[] = [
  {
    href: '/stok/permintaan',
    label: 'Permintaan Bahan Baku',
    desc: 'Ajukan & kelola permintaan stok bahan baku per outlet',
    roles: ['crew', 'kasir', 'kepala_outlet', 'spv', 'admin', 'owner'],
  },
  {
    href: '/stok/monitoring',
    label: 'Monitoring Stok',
    desc: 'Status stok seluruh outlet — kritis, menipis, aman',
    roles: ['kepala_outlet', 'spv', 'admin', 'owner'],
  },
  {
    href: '/stok/monitoring-live',
    label: 'Papan Monitoring Live',
    desc: 'Papan TV real-time status stok 19 outlet',
    roles: ['spv', 'admin', 'owner'],
  },
  {
    href: '/stok/opname',
    label: 'Opname Stok',
    desc: 'Hitung fisik & rekonsiliasi saldo stok',
    roles: ['crew', 'kepala_outlet', 'spv', 'admin'],
  },
  {
    href: '/stok/ledger',
    label: 'Ledger Stok',
    desc: 'Riwayat pergerakan stok (masuk, pakai, waste, transfer)',
    roles: ['crew', 'kepala_outlet', 'spv', 'admin'],
  },
]

export default function DashboardPage() {
  const { outletStaff, loading } = useAuth()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-suka-gray-500">Memuat…</p>
      </div>
    )
  }

  if (!outletStaff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-4 text-center">
        <p className="text-suka-gray-600">Akun belum terhubung data staff. Silakan login ulang.</p>
        <Button onClick={handleLogout} className="bg-suka-orange hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider">
          Login Ulang
        </Button>
      </div>
    )
  }

  const items = NAV.filter((n) => n.roles.includes(outletStaff.role))

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
      {/* Compact Header Card */}
      <header className="bg-white border border-suka-orange/15 rounded-2xl p-4 shadow-sm shadow-suka-brown/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <Avatar name={outletStaff.name} size={44} className="shadow shadow-suka-brown/5 border border-suka-cream flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-suka-brown truncate">
              Halo, {outletStaff.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="bg-suka-orange/10 text-suka-orange px-2 py-0.5 text-[10px] font-bold rounded-full capitalize truncate">
                {outletStaff.role.replace('_', ' ')}
              </span>
              <span className="text-[10px] text-suka-gray-400 font-semibold flex-shrink-0">•</span>
              <span className="text-[10px] text-suka-gray-500 font-bold truncate">
                {outletStaff.outlets?.name ?? 'Semua Outlet'}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLogout}
          className="flex-shrink-0 flex items-center gap-1.5 active:scale-[0.98]"
        >
          <LogOut size={14} />
          <span>Keluar</span>
        </Button>
      </header>

      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-suka-brown via-suka-ink to-suka-brown p-5 md:p-6 text-white shadow-md shadow-suka-brown/5">
        <div className="absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 bg-suka-orange/15 rounded-full blur-xl"></div>
        <div className="relative z-10 space-y-1">
          <h2 className="text-md font-extrabold tracking-wider text-suka-cream uppercase">
            MODUL STOK BAHAN BAKU
          </h2>
          <p className="text-[11px] text-suka-cream/80 font-medium leading-relaxed max-w-lg">
            Monitoring, opname, ledger & permintaan stok bahan baku 19 outlet.
          </p>
        </div>
      </div>

      {/* Module cards */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-suka-orange">
          Modul Anda
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="group p-4 bg-white border border-suka-orange/15 rounded-2xl shadow-sm shadow-suka-brown/5 hover:border-suka-orange/50 hover:shadow transition"
            >
              <h3 className="font-bold text-suka-ink text-sm mb-1 group-hover:text-suka-brown">
                {n.label}
              </h3>
              <p className="text-[11px] text-suka-gray-500 leading-relaxed">{n.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-4 border-t border-suka-orange/10 flex flex-wrap justify-between items-center text-[10px] text-suka-gray-400 font-semibold gap-2">
        <p>© {new Date().getFullYear()} Suka Shawarma. Hak Cipta Dilindungi.</p>
        <p>Modul Stok v2.6.0</p>
      </footer>
    </main>
  )
}
