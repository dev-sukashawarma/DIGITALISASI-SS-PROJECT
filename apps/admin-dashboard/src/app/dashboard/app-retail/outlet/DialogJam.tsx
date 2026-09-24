'use client'
import { useState, useTransition } from 'react'
import { ubahJamOutlet } from '../pengamanActions'

export default function DialogJam({ outlet, onTutup }: {
  outlet: { id: string; name: string; open_hour?: string | null; close_hour?: string | null }
  onTutup: () => void
}) {
  const [buka, setBuka] = useState(outlet.open_hour?.slice(0, 5) ?? '14:00')
  const [tutup, setTutup] = useState(outlet.close_hour?.slice(0, 5) ?? '22:00')
  const [yakinMalam, setYakinMalam] = useState(false)
  const [galat, setGalat] = useState('')
  const [bekerja, mulai] = useTransition()
  const lewatMalam = tutup <= buka

  function simpan() {
    if (lewatMalam && !yakinMalam) { setGalat('Centang konfirmasi bila jam tutup memang lewat tengah malam.'); return }
    setGalat('')
    mulai(async () => {
      try { await ubahJamOutlet(outlet.id, buka, tutup); onTutup() }
      catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan jam') }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
        <p className="font-bold text-slate-900">Jam buka {outlet.name}</p>
        <p className="text-[11px] text-slate-500">Berlaku setiap hari. Pesan terakhir mengikuti setelan di Pengaturan Aplikasi.</p>
        <div className="flex gap-2 items-center text-sm">
          <input type="time" value={buka} onChange={(e) => setBuka(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1" />
          <span>–</span>
          <input type="time" value={tutup} onChange={(e) => setTutup(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1" />
        </div>
        {lewatMalam && (
          <label className="flex items-center gap-2 text-sm text-amber-700">
            <input type="checkbox" checked={yakinMalam} onChange={(e) => setYakinMalam(e.target.checked)} />
            Jam tutup melewati tengah malam
          </label>
        )}
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">Batal</button>
          <button type="button" disabled={bekerja} onClick={simpan} className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer disabled:opacity-60">Simpan</button>
        </div>
      </div>
    </div>
  )
}
