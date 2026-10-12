'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { pilihMitraPratinjau } from '@/app/actions/mitraPratinjau'

const HALAMAN = [
  { href: '/dashboard/mitra', label: 'Dashboard' },
  { href: '/dashboard/mitra/transfer', label: 'Transfer Bagi Hasil' },
  { href: '/dashboard/mitra/tim', label: 'Tim Outlet' },
  { href: '/dashboard/mitra/saran', label: 'Saran & Kritik' },
]

/**
 * Bilah mode pratinjau — hanya dirender layout untuk admin/owner/developer yang
 * tidak punya profil mitra sendiri. Akun mitra tidak pernah melihatnya.
 */
export function MitraPratinjauBar({
  daftarMitra,
  terpilihId,
}: {
  daftarMitra: { id: string; nama: string; jumlahOutlet: number }[]
  terpilihId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [galat, setGalat] = useState<string | null>(null)

  const gantiMitra = (id: string) => {
    setGalat(null)
    startTransition(async () => {
      const hasil = await pilihMitraPratinjau(id)
      if (!hasil.ok) {
        setGalat(hasil.pesan || 'Gagal mengganti mitra.')
        return
      }
      // Pilihan outlet milik mitra sebelumnya tidak berlaku untuk mitra yang baru.
      const params = new URLSearchParams(searchParams.toString())
      params.delete('outletId')
      params.delete('mitraId')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
      router.refresh()
    })
  }

  return (
    <div className="bg-amber-50 border-b border-amber-300/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-amber-950 text-sm">Mode Pratinjau: tampilan yang dilihat mitra</h4>
            <p className="text-xs text-amber-800/80">
              Bilah ini hanya terlihat oleh admin, owner, dan developer.
              {galat && <span className="ml-2 font-semibold text-red-700">{galat}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {HALAMAN.map(h => (
            <a
              key={h.href}
              href={h.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                pathname === h.href
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {h.label}
            </a>
          ))}

          {daftarMitra.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <span className="shrink-0">Lihat sebagai:</span>
              <select
                value={terpilihId}
                disabled={isPending}
                onChange={e => gantiMitra(e.target.value)}
                className="bg-white border border-amber-300 text-xs font-bold text-amber-950 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer disabled:opacity-60"
              >
                {daftarMitra.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nama} ({m.jumlahOutlet} outlet)
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
