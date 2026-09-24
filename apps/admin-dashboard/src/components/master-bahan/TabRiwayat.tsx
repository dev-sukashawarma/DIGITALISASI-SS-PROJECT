'use client'
import { useMemo, useState } from 'react'
import { Spinner } from '@suka/design-system'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useRiwayatMasterBahan, type FilterRiwayat } from '@/hooks/masterBahan/useRiwayatMasterBahan'
import { useSuppliers } from '@/hooks/usePurchaseOrder'
import { ringkasRiwayat } from '@/lib/masterBahan/riwayat'

const JENIS: { id: FilterRiwayat['jenis']; label: string }[] = [
  { id: 'semua', label: 'Semua' }, { id: 'data', label: 'Data' },
  { id: 'harga_master', label: 'Harga master' }, { id: 'harga_vendor', label: 'Harga vendor' },
]

export function TabRiwayat() {
  const { data: bahan = [] } = useDaftarBahan()
  const { data: suppliers = [] } = useSuppliers()
  const [bahanId, setBahanId] = useState<string | null>(null)
  const [jenis, setJenis] = useState<FilterRiwayat['jenis']>('semua')
  const { rows, namaPelaku, loading, error } = useRiwayatMasterBahan({ bahanId, jenis })
  const namaBahan = useMemo(() => new Map(bahan.map((b) => [b.id, b.nama])), [bahan])
  const namaSupplier = useMemo(() => new Map(suppliers.map((s) => [s.id, s.nama])), [suppliers])

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <select value={bahanId ?? ''} onChange={(e) => setBahanId(e.target.value || null)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="">Semua bahan</option>
          {bahan.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
        </select>
        {JENIS.map((j) => (
          <button key={j.id} onClick={() => setJenis(j.id)}
            className={`rounded-full px-3 py-1 text-sm ${jenis === j.id ? 'bg-suka-orange text-white' : 'bg-gray-100 text-gray-600'}`}>{j.label}</button>
        ))}
      </div>
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error != null && <p className="text-sm text-red-600">Gagal memuat riwayat: {String((error as Error).message ?? error)}</p>}
      <ol className="divide-y">
        {rows.map((r, i) => (
          <li key={`${r.changed_at}-${i}`} className="py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500">
              <span className="font-bold text-suka-brown">
                {r.bahan_baku_id ? namaBahan.get(r.bahan_baku_id) ?? '(bahan terhapus)' : '—'}
                {r.supplier_id ? ` · ${namaSupplier.get(r.supplier_id) ?? 'vendor'}` : ''}
              </span>
              <span>
                {new Date(r.changed_at).toLocaleString('id-ID')} · {r.changed_by ? namaPelaku.get(r.changed_by) ?? 'pengguna' : 'sistem'}
              </span>
            </div>
            <ul className="mt-1 list-disc pl-5 text-gray-700">
              {ringkasRiwayat(r).map((t, j) => <li key={j}>{t}</li>)}
            </ul>
            {r.alasan && <p className="mt-1 text-xs italic text-gray-500">Alasan: {r.alasan}</p>}
          </li>
        ))}
        {!loading && rows.length === 0 && <li className="py-8 text-center text-gray-500">Belum ada riwayat.</li>}
      </ol>
      {rows.length === 200 && <p className="text-xs text-gray-500">Menampilkan 200 perubahan terbaru. Saring per bahan untuk melihat lebih jauh.</p>}
    </div>
  )
}
