'use client'

import { useMemo, useState } from 'react'
import { useKualitasVendor } from '@/hooks/useReturVendor'
import { LABEL_ALASAN } from '@/lib/returVendor/aturan'
import { rupiah } from '@/lib/format'

function tanggalWib(offsetHari = 0): string {
  const d = new Date(Date.now() + 7 * 3_600_000 + offsetHari * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/** Retur & penolakan saat terima per vendor, dirinci per alasan. Bawaan 30 hari terakhir. */
export function KualitasVendorPanel() {
  const [dari, setDari] = useState(() => tanggalWib(-30))
  const [sampai, setSampai] = useState(() => tanggalWib(0))
  const { data = [], isLoading, error } = useKualitasVendor(dari, sampai)

  const perVendor = useMemo(() => {
    const m = new Map<string, { nama: string; total: number; baris: typeof data }>()
    for (const b of data) {
      const v = m.get(b.vendor_induk) ?? { nama: b.vendor_nama ?? '-', total: 0, baris: [] }
      v.total += b.nilai_retur + b.nilai_tolak
      v.baris.push(b)
      m.set(b.vendor_induk, v)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [data])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="font-semibold text-suka-gray-600">
          Dari
          <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="ml-2 rounded-lg border border-suka-gray-200 px-2 py-1" />
        </label>
        <label className="font-semibold text-suka-gray-600">
          Sampai
          <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="ml-2 rounded-lg border border-suka-gray-200 px-2 py-1" />
        </label>
      </div>
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Gagal memuat: {error instanceof Error ? error.message : 'galat'}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-suka-gray-500">Memuat…</p>
      ) : perVendor.length === 0 ? (
        <p className="rounded-2xl border border-suka-gray-100 bg-white p-6 text-center text-sm text-suka-gray-500">
          Tidak ada retur atau penolakan di periode ini.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-suka-gray-100 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-suka-cream/50 text-left text-xs text-suka-gray-500">
              <tr>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Alasan</th>
                <th className="px-3 py-2 text-right">Retur (dok)</th>
                <th className="px-3 py-2 text-right">Nilai retur</th>
                <th className="px-3 py-2 text-right">Tak dikompensasi</th>
                <th className="px-3 py-2 text-right">Ditolak saat terima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {perVendor.flatMap((v) =>
                v.baris.map((b, i) => (
                  <tr key={`${b.vendor_induk}:${b.alasan}`}>
                    <td className="px-3 py-2 font-semibold text-suka-ink">{i === 0 ? v.nama : ''}</td>
                    <td className="px-3 py-2">{b.alasan ? LABEL_ALASAN[b.alasan] : '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.jumlah_retur}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rupiah(b.nilai_retur)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      {b.nilai_tidak_dikompensasi > 0 ? rupiah(b.nilai_tidak_dikompensasi) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {b.jumlah_baris_tolak > 0 ? `${b.jumlah_baris_tolak}× · ${rupiah(b.nilai_tolak)}` : '—'}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
