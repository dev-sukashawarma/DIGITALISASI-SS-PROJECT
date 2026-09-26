'use client'
import { useState, useTransition } from 'react'
import { MAKS_MENU_TERLARIS, geserMenu, periksaMenuTerlaris, tambahMenu } from '@/lib/appRetail/menuTerlaris'
import { simpanMenuTerlaris } from '../pengamanActions'

/**
 * Kurasi "Menu Terlaris" di Beranda aplikasi pelanggan. Urutan = urutan
 * tampil; Beranda menampilkan 2 teratas yang tersedia di outlet pelanggan,
 * sisanya jadi cadangan bila yang di atas habis.
 */
export default function SeksiMenuTerlaris({ awal, menu, gagalMuat }: {
  awal: string[]
  menu: { id: string; name: string }[]
  gagalMuat: boolean
}) {
  const [ids, setIds] = useState<string[]>(awal)
  const [pilihan, setPilihan] = useState('')
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const [bekerja, mulai] = useTransition()
  const nama = new Map(menu.map((m) => [m.id, m.name]))
  const belumDipilih = menu.filter((m) => !ids.includes(m.id))
  const galat = periksaMenuTerlaris(ids)
  const berubah = ids.join(',') !== awal.join(',')

  function simpan() {
    if (gagalMuat) {
      setPesan({ ok: false, teks: 'Data gagal dimuat — muat ulang halaman sebelum menyimpan.' })
      return
    }
    setPesan(null)
    mulai(async () => {
      try {
        await simpanMenuTerlaris(ids)
        setPesan({ ok: true, teks: 'Tersimpan. Berlaku di aplikasi paling lambat 1 menit.' })
      } catch (e) {
        setPesan({ ok: false, teks: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  const tombol = 'px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 cursor-pointer disabled:opacity-40 disabled:cursor-default'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div>
          <h2 className="font-bold text-slate-900">Menu Terlaris di Beranda</h2>
          <p className="text-xs text-slate-500">
            Beranda menampilkan 2 menu teratas yang tersedia di outlet pelanggan. Pilih sampai {MAKS_MENU_TERLARIS} menu:
            yang di bawah jadi cadangan bila yang di atas habis. Kosong = aplikasi memakai pilihan otomatis.
          </p>
        </div>

        {ids.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada menu dipilih.</p>
        ) : (
          <ol className="space-y-2">
            {ids.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <span className={`text-xs font-bold w-5 ${i < 2 ? 'text-amber-600' : 'text-slate-400'}`}>{i + 1}</span>
                <span className="flex-1 text-sm text-slate-800">
                  {nama.get(id) ?? <span className="text-red-600">Menu tidak tayang lagi (akan dibuang saat disimpan)</span>}
                  {i < 2 && <span className="ml-2 text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">tampil</span>}
                </span>
                <button type="button" className={tombol} disabled={i === 0} onClick={() => setIds(geserMenu(ids, i, -1))} aria-label="Naikkan">↑</button>
                <button type="button" className={tombol} disabled={i === ids.length - 1} onClick={() => setIds(geserMenu(ids, i, 1))} aria-label="Turunkan">↓</button>
                <button type="button" className={`${tombol} text-red-600`} onClick={() => setIds(ids.filter((x) => x !== id))}>Hapus</button>
              </li>
            ))}
          </ol>
        )}

        <div className="flex gap-2">
          <select
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={pilihan}
            onChange={(e) => setPilihan(e.target.value)}
            disabled={ids.length >= MAKS_MENU_TERLARIS}
          >
            <option value="">{ids.length >= MAKS_MENU_TERLARIS ? `Sudah ${MAKS_MENU_TERLARIS} menu` : 'Pilih menu…'}</option>
            {belumDipilih.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold cursor-pointer disabled:opacity-40"
            disabled={!pilihan}
            onClick={() => { setIds(tambahMenu(ids, pilihan)); setPilihan('') }}
          >
            Tambah
          </button>
        </div>

        {galat && <p className="text-sm text-red-600">{galat}</p>}
        {pesan && <p className={`text-sm ${pesan.ok ? 'text-emerald-700' : 'text-red-600'}`}>{pesan.teks}</p>}
        <button
          type="button"
          disabled={bekerja || gagalMuat || galat !== null || !berubah}
          onClick={simpan}
          className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer disabled:opacity-60"
        >
          Simpan menu terlaris
        </button>
    </div>
  )
}
