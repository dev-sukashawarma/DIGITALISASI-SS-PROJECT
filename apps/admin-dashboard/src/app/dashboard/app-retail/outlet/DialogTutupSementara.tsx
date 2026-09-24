'use client'
import { useState, useTransition } from 'react'
import { hitungSampai, type PilihanSampai } from '@/lib/appRetail/tutupSementara'
import { tutupSementara } from '../pengamanActions'

export default function DialogTutupSementara({ outlet, onTutup }: {
  outlet: { id: string; name: string; open_hour?: string | null; close_hour?: string | null } | null // null = semua outlet
  onTutup: () => void
}) {
  const [pilihan, setPilihan] = useState<PilihanSampai>('tutup_hari_ini')
  const [kustom, setKustom] = useState('')
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState('')
  const [bekerja, mulai] = useTransition()

  function simpan() {
    setGalat('')
    let sampai: Date
    try {
      // Untuk "semua outlet", jam tutup/buka memakai 22:00/14:00 (semua outlet sama per 2026-09-23);
      // pilihan kustom tetap tersedia bila berbeda.
      sampai = hitungSampai(
        pilihan, new Date(),
        outlet ? outlet.close_hour ?? null : '22:00:00',
        outlet ? outlet.open_hour ?? null : '14:00:00',
        kustom ? new Date(`${kustom}:00+07:00`) : null,
      )
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Waktu tidak sah'); return }
    mulai(async () => {
      try { await tutupSementara(outlet?.id ?? null, sampai.toISOString(), alasan); onTutup() }
      catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menutup outlet') }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
        <p className="font-bold text-slate-900">Tutup sementara {outlet ? outlet.name : 'SEMUA outlet'}</p>
        {(['tutup_hari_ini', 'besok_buka', 'kustom'] as const).map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm">
            <input type="radio" checked={pilihan === p} onChange={() => setPilihan(p)} />
            {p === 'tutup_hari_ini' ? 'Sampai jam tutup hari ini' : p === 'besok_buka' ? 'Sampai buka berikutnya' : 'Sampai tanggal & jam…'}
          </label>
        ))}
        {pilihan === 'kustom' && (
          <input type="datetime-local" value={kustom} onChange={(e) => setKustom(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        )}
        <input value={alasan} maxLength={120} onChange={(e) => setAlasan(e.target.value)}
          placeholder="Alasan untuk pelanggan (opsional), mis. Renovasi"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <p className="text-[11px] text-slate-500">Outlet akan aktif lagi otomatis setelah waktu ini.</p>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">Batal</button>
          <button type="button" disabled={bekerja} onClick={simpan} className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-sm cursor-pointer disabled:opacity-60">Tutup</button>
        </div>
      </div>
    </div>
  )
}
