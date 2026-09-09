'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Search, Smartphone, AlertTriangle } from 'lucide-react'
import { namaKategori, hargaAplikasiTampil, type MenuApp } from '@/lib/appRetail/tampilanMenu'

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`

type Saring = 'tayang' | 'belum' | 'semua'

export default function MenuAppView({
  items,
  outletMelayani,
}: {
  items: MenuApp[]
  outletMelayani: string[]
}) {
  const [saring, setSaring] = useState<Saring>('tayang')
  const [cari, setCari] = useState('')
  const [bukaOutlet, setBukaOutlet] = useState(false)

  const terlihat = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return items.filter((it) => {
      if (saring === 'tayang' && !it.tampil_di_app) return false
      if (saring === 'belum' && it.tampil_di_app) return false
      return !q || it.name.toLowerCase().includes(q)
    })
  }, [items, saring, cari])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pengaturan Menu Aplikasi</h1>
        <p className="text-sm text-slate-500">
          Menu dibuat dan dihapus di POS. Di sini hanya ditentukan yang tayang di aplikasi dan tampilannya.
        </p>
      </div>

      {/* Cakupan perubahan — hari ini tidak ada tempat lain yang memberi tahu ini. */}
      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-900 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            Perubahan berlaku <strong>serentak di {outletMelayani.length} outlet</strong> yang melayani aplikasi.
            {outletMelayani.length > 0 && (
              <button
                type="button"
                onClick={() => setBukaOutlet((v) => !v)}
                className="ml-1 underline font-semibold cursor-pointer"
              >
                {bukaOutlet ? 'sembunyikan' : 'lihat daftarnya'}
              </button>
            )}
            {bukaOutlet && <p className="mt-1 font-medium">{outletMelayani.join(' · ')}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          {([['tayang', 'Tayang'], ['belum', 'Belum tayang'], ['semua', 'Semua']] as [Saring, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSaring(key)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  saring === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama menu"
            className="input w-full pl-9 py-2 text-sm bg-white border border-slate-200 rounded-xl"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="text-left py-3 px-4 font-semibold text-slate-500 w-16">Foto</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500">Nama</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500 hidden sm:table-cell">Kategori</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-500">Harga kasir</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-500">Harga aplikasi</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {terlihat.map((it) => {
              const hargaApp = hargaAplikasiTampil(it.channel_prices)
              const foto = it.foto_app ?? it.image_url
              return (
                <tr key={it.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-4">
                    {foto ? (
                      <Image src={foto} alt="" width={40} height={40} className="w-10 h-10 rounded-lg object-cover" unoptimized />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100" />
                    )}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{it.name}</td>
                  <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{namaKategori(it.categories)}</td>
                  <td className="py-3 px-4 text-right text-slate-500">{rupiah(it.price)}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {hargaApp === null ? <span className="text-slate-400 font-medium">ikut kasir</span> : rupiah(hargaApp)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        it.tampil_di_app ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {it.tampil_di_app ? 'Tayang' : 'Tidak tayang'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {terlihat.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  <Smartphone className="w-6 h-6 mx-auto mb-2" />
                  Tidak ada menu yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
