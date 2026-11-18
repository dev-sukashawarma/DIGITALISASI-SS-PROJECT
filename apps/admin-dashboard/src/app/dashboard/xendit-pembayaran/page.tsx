'use client'

import { useState } from 'react'
import { BadgeCheck, UploadCloud, Loader2, AlertTriangle } from 'lucide-react'
import { unggahFileXendit } from '@/app/actions/xenditPembayaran'

type Ringkasan = { baru: number; diperbarui: number; cocokId: number; cocokNominalJam: number; belumCocok: number; bukanPenjualan: number; tagihanProses: number; pembayaranBerbiayaProses: number }

export default function XenditPembayaranPage() {
  const [file, setFile] = useState<File | null>(null)
  const [proses, setProses] = useState(false)
  const [hasil, setHasil] = useState<Ringkasan | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  async function unggah() {
    if (!file) return
    setProses(true); setGalat(null); setHasil(null)
    const fd = new FormData()
    fd.append('file', file)
    const r = await unggahFileXendit(fd)
    setProses(false)
    if (r.success) setHasil(r.ringkasan)
    else setGalat(r.error)
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BadgeCheck className="w-6 h-6 text-emerald-600" /> Validasi Xendit (Website)
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Unggah file <strong>Balance History</strong> dari dashboard Xendit (CSV). Setiap pembayaran dicocokkan
          dengan pesanan website di POS; hasilnya tampil sebagai status Xendit di Histori Transaksi Rangkuman Penjualan.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={e => { setFile(e.target.files?.[0] ?? null); setHasil(null); setGalat(null) }}
          className="block w-full text-sm"
        />
        <button
          type="button"
          onClick={unggah}
          disabled={!file || proses}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          {proses ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {proses ? 'Memproses…' : 'Unggah & Cocokkan'}
        </button>
        <p className="text-xs text-gray-500">
          Balance History disusun per tanggal <em>settlement</em> (H+2 hari kerja), bukan tanggal bayar —
          pembayaran tanggal 29–31 ada di file bulan berikutnya. Unggah ulang file yang sama aman (tidak dobel).
        </p>
      </div>

      {galat && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {galat}
        </div>
      )}

      {hasil && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="font-bold text-gray-900 mb-3">Hasil</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-600">Pembayaran baru</dt><dd className="font-semibold">{hasil.baru}</dd>
            <dt className="text-gray-600">Sudah ada (diperbarui)</dt><dd className="font-semibold">{hasil.diperbarui}</dd>
            <dt className="text-gray-600">Cocok lewat ID</dt><dd className="font-semibold">{hasil.cocokId}</dd>
            <dt className="text-gray-600">Cocok lewat nominal & jam</dt><dd className="font-semibold">{hasil.cocokNominalJam}</dd>
            <dt className="text-gray-600">Belum cocok dengan pesanan</dt><dd className="font-semibold text-amber-700">{hasil.belumCocok}</dd>
            <dt className="text-gray-600">Bukan penjualan (diabaikan)</dt><dd className="font-semibold text-gray-500">{hasil.bukanPenjualan}</dd>
            <dt className="text-gray-500">Processing Fee di file</dt><dd className="text-gray-500">{hasil.tagihanProses} tagihan · {hasil.pembayaranBerbiayaProses} pembayaran sejak 1 Okt</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
