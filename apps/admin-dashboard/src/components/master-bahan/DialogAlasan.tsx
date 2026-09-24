'use client'
import { useState } from 'react'
import type { GalatRpc } from '@/lib/masterBahan/galatRpc'

export function DialogAlasan({
  judul, keterangan, wajib, galat, memproses, labelKirim = 'Simpan', onBatal, onKirim,
}: {
  judul: string
  keterangan?: string
  wajib: boolean
  galat: GalatRpc | null
  memproses: boolean
  labelKirim?: string
  onBatal: () => void
  onKirim: (v: { alasan: string; paksa: boolean }) => void
}) {
  const [alasan, setAlasan] = useState('')
  const [paksa, setPaksa] = useState(false)
  const kosong = alasan.trim() === ''
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-extrabold text-suka-brown">{judul}</h3>
        {keterangan && <p className="text-sm text-gray-600">{keterangan}</p>}
        <label className="block text-sm font-semibold text-gray-700">
          Alasan{wajib ? '' : ' (opsional)'}
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder="Mis. koreksi salah ketik, harga baru dari vendor…"
          />
        </label>
        {galat && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{galat.pesan}</div>
        )}
        {galat?.bisaDipaksa && (
          <label className="flex items-start gap-2 text-sm text-amber-800">
            <input type="checkbox" checked={paksa} onChange={(e) => setPaksa(e.target.checked)} className="mt-1" />
            Saya sudah memeriksa satuan dan harganya; simpan paksa.
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onBatal} disabled={memproses} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Batal
          </button>
          <button
            onClick={() => onKirim({ alasan: alasan.trim(), paksa })}
            disabled={memproses || (wajib && kosong)}
            className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {memproses ? 'Menyimpan…' : labelKirim}
          </button>
        </div>
      </div>
    </div>
  )
}
