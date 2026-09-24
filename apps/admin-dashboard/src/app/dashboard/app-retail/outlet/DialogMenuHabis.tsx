'use client'
import { useState, useTransition } from 'react'
import { simpanMenuHabis } from '../pengamanActions'

export default function DialogMenuHabis({ outlet, menuAplikasi, habisSekarang, onTutup }: {
  outlet: { id: string; name: string }
  menuAplikasi: { id: string; name: string }[]
  habisSekarang: string[]
  onTutup: () => void
}) {
  const [habis, setHabis] = useState(() => new Set(habisSekarang.filter((id) => menuAplikasi.some((m) => m.id === id))))
  const [galat, setGalat] = useState('')
  const [bekerja, mulai] = useTransition()

  function balik(id: string) {
    setHabis((lama) => { const baru = new Set(lama); if (baru.has(id)) baru.delete(id); else baru.add(id); return baru })
  }
  function simpan() {
    setGalat('')
    mulai(async () => {
      try { await simpanMenuHabis(outlet.id, menuAplikasi.map((m) => m.id), [...habis]); onTutup() }
      catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan') }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 max-h-[80vh] flex flex-col">
        <p className="font-bold text-slate-900">Menu habis di {outlet.name}</p>
        <p className="text-[11px] text-slate-500">Daftar ini SAMA dengan yang dipakai kasir/kiosk outlet. Tidak kembali otomatis — nyalakan lagi saat stok ada.</p>
        <div className="overflow-y-auto divide-y divide-slate-100">
          {menuAplikasi.map((m) => (
            <label key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span>{m.name}</span>
              <input type="checkbox" checked={habis.has(m.id)} onChange={() => balik(m.id)} />
            </label>
          ))}
        </div>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">Batal</button>
          <button type="button" disabled={bekerja} onClick={simpan} className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer disabled:opacity-60">Simpan ({habis.size} habis)</button>
        </div>
      </div>
    </div>
  )
}
