import Link from 'next/link'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { Smartphone, Store, ShoppingCart } from 'lucide-react'
import { bacaJumlah } from '@/lib/appRetail/jumlahKueri'

export const dynamic = 'force-dynamic'

/** Awal hari ini dalam WIB, dikembalikan sebagai ISO UTC untuk dibandingkan dengan created_at. */
function awalHariWib(): string {
  const sekarang = new Date()
  const wib = new Date(sekarang.getTime() + 7 * 60 * 60 * 1000)
  wib.setUTCHours(0, 0, 0, 0)
  return new Date(wib.getTime() - 7 * 60 * 60 * 1000).toISOString()
}

export default async function AppRetailPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [menuRes, outletRes, orderRes] = await Promise.all([
    supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('tampil_di_app', true),
    // Definisi "melayani aplikasi" harus sama dengan GET /api/v1/outlets:
    // app_enabled DAN bukan marketplace. Tanpa .neq, kartu ini menghitung
    // outlet virtual yang tidak pernah dilihat pelanggan.
    supabase.from('outlets').select('id', { count: 'exact', head: true })
      .eq('app_enabled', true).neq('type', 'marketplace'),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('source', 'app').gte('created_at', awalHariWib()),
  ])

  const kartu = [
    { label: 'Menu tayang di aplikasi', nilai: bacaJumlah(menuRes), ikon: Smartphone, href: '/dashboard/app-retail/menu' },
    { label: 'Outlet melayani aplikasi', nilai: bacaJumlah(outletRes), ikon: Store, href: '/dashboard/app-retail/outlet' },
    { label: 'Pesanan aplikasi hari ini', nilai: bacaJumlah(orderRes), ikon: ShoppingCart, href: null },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">App Retail</h1>
        <p className="text-sm text-slate-500">Pengaturan kanal SukaShawarma APP.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kartu.map((k) => {
          const isi = (
            <div className="p-4 rounded-xl border border-slate-200 bg-white h-full">
              <div className="flex items-center gap-2 text-slate-500">
                <k.ikon className="w-4 h-4" />
                <span className="text-xs font-semibold">{k.label}</span>
              </div>
              <div className="mt-2">
                {k.nilai === null ? (
                  <div>
                    <p className="text-3xl font-bold text-slate-400">—</p>
                    <p className="text-xs text-slate-400">Gagal dibaca</p>
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-slate-900">{k.nilai}</p>
                )}
              </div>
            </div>
          )
          return k.href
            ? <Link key={k.label} href={k.href} className="block hover:opacity-90 transition-opacity">{isi}</Link>
            : <div key={k.label}>{isi}</div>
        })}
      </div>

      {/*
        Draft `menunggu_bayar` SENGAJA tidak ditampilkan. `retail.order_drafts`
        di-GRANT hanya untuk service_role; membacanya dari sini berarti menambah
        jalur service-role baru di admin-dashboard — pola yang di repo ini pernah
        menjadi lubang otorisasi (CLAUDE.md, Session 2026-07-20). Kalau angka itu
        dibutuhkan, lewat endpoint gateway yang sudah punya haknya.
      */}
    </div>
  )
}
