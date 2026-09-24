'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertTriangle, Store } from 'lucide-react'
import { periksaKesiapanOutlet, PERINGATAN_NOL_MENU, type OutletApp } from '@/lib/appRetail/kesiapanOutlet'
import { statusOutlet, pesanStatus } from '@/lib/appRetail/jamBuka'
import { toggleOutletApp } from '../actions'
import { bukaSekarang } from '../pengamanActions'
import DialogTutupSementara from './DialogTutupSementara'
import DialogJam from './DialogJam'
import DialogMenuHabis from './DialogMenuHabis'

type TutupAktif = { id: string; outlet_id: string | null; sampai: string; alasan: string | null }
type MenuRingkas = { id: string; name: string }

export default function OutletAppView({
  outlets,
  jumlahMenuTayang,
  tutupAktif,
  menuAplikasi,
  daftarHabis,
  menitPesanTerakhir,
}: {
  outlets: OutletApp[]
  /** `null` = jumlahnya tidak diketahui (kueri gagal), bukan nol. */
  jumlahMenuTayang: number | null
  tutupAktif: TutupAktif[]
  menuAplikasi: MenuRingkas[]
  daftarHabis: Record<string, string[]>
  menitPesanTerakhir: number
}) {
  const [galat, setGalat] = useState('')
  const [konfirmasi, setKonfirmasi] = useState<OutletApp | null>(null)
  const [dialog, setDialog] = useState<{ jenis: 'jam' | 'tutup' | 'habis' | 'tutup_semua'; outlet: OutletApp | null } | null>(null)
  const [bekerja, mulai] = useTransition()
  // `new Date()` di dalam render bisa beda antara render server & hydrate
  // client (hydration mismatch). Status "Bisa pesan/Tutup" hanya dihitung
  // setelah mount; sebelum itu tampilkan placeholder netral.
  const [sekarang, setSekarang] = useState<Date | null>(null)
  useEffect(() => { setSekarang(new Date()) }, [])

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

  function jalankanBuka(id: string) {
    setGalat('')
    mulai(async () => {
      try {
        await bukaSekarang(id)
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal membuka outlet')
      }
    })
  }

  const tutupSemuaAktif = tutupAktif.find((t) => t.outlet_id === null)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Outlet Aplikasi</h1>
          <p className="text-sm text-slate-500">
            Menyalakan outlet membuat pelanggan bisa langsung memesan ke sana.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ jenis: 'tutup_semua', outlet: null })}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-700 cursor-pointer shrink-0"
        >
          Tutup semua outlet
        </button>
      </div>

      {tutupSemuaAktif && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>
            Semua outlet ditutup s/d {new Date(tutupSemuaAktif.sampai).toLocaleString('id-ID')}
            {tutupSemuaAktif.alasan ? ` (${tutupSemuaAktif.alasan})` : ''}
          </span>
          <button
            type="button"
            disabled={bekerja}
            onClick={() => jalankanBuka(tutupSemuaAktif.id)}
            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-600 text-white cursor-pointer disabled:opacity-60 shrink-0"
          >
            Buka sekarang
          </button>
        </div>
      )}

      {galat && <p className="text-sm text-red-600">{galat}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="text-left py-3 px-4 font-semibold text-slate-500">Outlet</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500 hidden sm:table-cell">Jenis</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-500">Aktif</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-500">Menu umum terbit</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-500">Melayani aplikasi</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500">Status sekarang</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => {
              const kesiapan = periksaKesiapanOutlet(o, jumlahMenuTayang ?? 0)
              // Jumlah tidak diketahui bukan alasan menuduh katalog kosong.
              const peringatan =
                jumlahMenuTayang === null
                  ? kesiapan.peringatan.filter((p) => p !== PERINGATAN_NOL_MENU)
                  : kesiapan.peringatan
              const tutupOutlet = tutupAktif.filter((t) => t.outlet_id === o.id || t.outlet_id === null)
              const s = sekarang
                ? statusOutlet({
                    sekarang,
                    openHour: o.open_hour ?? null,
                    closeHour: o.close_hour ?? null,
                    isActive: o.is_active,
                    menitPesanTerakhir,
                    tutupSementara: tutupOutlet.map((t) => ({ sampai: new Date(t.sampai), alasan: t.alasan })),
                  })
                : null
              return (
                <tr key={o.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{o.name}</p>
                    {peringatan.map((p) => (
                      <p key={p} className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {p}
                      </p>
                    ))}
                  </td>
                  <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{o.type ?? '—'}</td>
                  <td className="py-3 px-4 text-center text-slate-500">{o.is_active ? 'Ya' : 'Tidak'}</td>
                  <td className="py-3 px-4 text-right text-slate-500">{kesiapan.melayani ? (jumlahMenuTayang ?? '—') : '—'}</td>
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
                  <td className="py-3 px-4">
                    {s ? (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.bisaPesan ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {s.bisaPesan ? 'Bisa pesan' : pesanStatus(s)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">…</span>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Jam {o.open_hour?.slice(0, 5) ?? '—'}–{o.close_hour?.slice(0, 5) ?? '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap space-x-1">
                    <button type="button" onClick={() => setDialog({ jenis: 'jam', outlet: o })} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 cursor-pointer">Jam</button>
                    {tutupOutlet.some((t) => t.outlet_id === o.id)
                      ? <button type="button" onClick={() => jalankanBuka(tutupOutlet.find((t) => t.outlet_id === o.id)!.id)} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-600 text-white cursor-pointer">Buka sekarang</button>
                      : <button type="button" onClick={() => setDialog({ jenis: 'tutup', outlet: o })} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-red-200 text-red-700 cursor-pointer">Tutup sementara</button>}
                    <button type="button" onClick={() => setDialog({ jenis: 'habis', outlet: o })} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 cursor-pointer">Menu habis ({(daftarHabis[o.id] ?? []).filter((id) => menuAplikasi.some((m) => m.id === id)).length})</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {dialog?.jenis === 'jam' && dialog.outlet && (
        <DialogJam outlet={dialog.outlet} onTutup={() => setDialog(null)} />
      )}
      {dialog?.jenis === 'tutup' && dialog.outlet && (
        <DialogTutupSementara outlet={dialog.outlet} onTutup={() => setDialog(null)} />
      )}
      {dialog?.jenis === 'tutup_semua' && (
        <DialogTutupSementara outlet={null} onTutup={() => setDialog(null)} />
      )}
      {dialog?.jenis === 'habis' && dialog.outlet && (
        <DialogMenuHabis
          outlet={dialog.outlet}
          menuAplikasi={menuAplikasi}
          habisSekarang={daftarHabis[dialog.outlet.id] ?? []}
          onTutup={() => setDialog(null)}
        />
      )}

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
