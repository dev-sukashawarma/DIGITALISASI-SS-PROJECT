'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Store } from 'lucide-react'
import { periksaKesiapanOutlet, type OutletApp } from '@/lib/appRetail/kesiapanOutlet'
import { toggleOutletApp } from '../actions'

export default function OutletAppView({
  outlets,
  jumlahMenuTayang,
}: {
  outlets: OutletApp[]
  jumlahMenuTayang: number
}) {
  const [galat, setGalat] = useState('')
  const [konfirmasi, setKonfirmasi] = useState<OutletApp | null>(null)
  const [bekerja, mulai] = useTransition()

  function ubah(outlet: OutletApp) {
    // Menyalakan outlet membuatnya langsung bisa dipesan pelanggan — minta
    // konfirmasi yang menyebut namanya. Mematikan hanya menutup pintu:
    // pesanan berjalan tidak terpengaruh karena draft dan orders sudah
    // menyimpan outlet_id masing-masing.
    if (!outlet.app_enabled) { setKonfirmasi(outlet); return }
    jalankan(outlet)
  }

  function jalankan(outlet: OutletApp) {
    setGalat('')
    setKonfirmasi(null)
    mulai(async () => {
      try {
        await toggleOutletApp(outlet.id, outlet.app_enabled)
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal mengubah outlet')
      }
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Outlet Aplikasi</h1>
        <p className="text-sm text-slate-500">
          Menyalakan outlet membuat pelanggan bisa langsung memesan ke sana.
        </p>
      </div>

      {galat && <p className="text-sm text-red-600">{galat}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="text-left py-3 px-4 font-semibold text-slate-500">Outlet</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500 hidden sm:table-cell">Jenis</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-500">Aktif</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-500">Menu terbit</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-500">Melayani aplikasi</th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => {
              const kesiapan = periksaKesiapanOutlet(o, jumlahMenuTayang)
              return (
                <tr key={o.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{o.name}</p>
                    {kesiapan.peringatan.map((p) => (
                      <p key={p} className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {p}
                      </p>
                    ))}
                  </td>
                  <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{o.type ?? '—'}</td>
                  <td className="py-3 px-4 text-center text-slate-500">{o.is_active ? 'Ya' : 'Tidak'}</td>
                  <td className="py-3 px-4 text-right text-slate-500">{kesiapan.melayani ? jumlahMenuTayang : '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      disabled={bekerja}
                      onClick={() => ubah(o)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full disabled:opacity-60 cursor-pointer ${
                        o.app_enabled ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {o.app_enabled ? 'Melayani' : 'Mati'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {konfirmasi && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              <p className="font-bold text-slate-900">Nyalakan {konfirmasi.name}?</p>
            </div>
            <p className="text-sm text-slate-600">
              Pelanggan akan langsung bisa memesan ke outlet ini dari aplikasi.
              {jumlahMenuTayang === 0 && ' Saat ini nol menu tayang, jadi katalognya akan kosong.'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setKonfirmasi(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => jalankan(konfirmasi)}
                className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer"
              >
                Nyalakan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
