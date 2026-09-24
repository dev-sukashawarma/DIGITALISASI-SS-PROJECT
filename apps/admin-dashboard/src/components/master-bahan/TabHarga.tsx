'use client'
import { useMemo, useState } from 'react'
import { Spinner } from '@suka/design-system'
import { useRole } from '@/components/layout/RoleContext'
import { useStatusHarga } from '@/hooks/masterBahan/useStatusHarga'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { bolehUbahHarga } from '@/lib/masterBahan/akses'
import { rupiah } from '@/lib/format'
import { FormHargaVendor } from './FormHargaVendor'

export function TabHarga() {
  const { role } = useRole()
  const bolehHarga = bolehUbahHarga(role)
  const { data: status = [], isLoading, error } = useStatusHarga()
  const { data: bahan = [] } = useDaftarBahan()
  const belum = status.filter((s) => s.status === 'belum_dikonfirmasi').length
  const [hanyaBelum, setHanyaBelum] = useState(true)
  const [cari, setCari] = useState('')
  const [isiId, setIsiId] = useState<string | null>(null)

  const tampil = useMemo(() => {
    const k = cari.trim().toLowerCase()
    return status.filter((s) => (!hanyaBelum || s.status === 'belum_dikonfirmasi') && (!k || s.nama.toLowerCase().includes(k)))
  }, [status, hanyaBelum, cari])
  const target = bahan.find((b) => b.id === isiId) ?? null

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error) return <p className="p-6 text-sm text-red-600">Gagal memuat status harga: {String((error as Error).message ?? error)}</p>

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-bold">{belum} bahan belum punya harga vendor terpercaya.</p>
        <p className="text-xs">Harga master mereka dibekukan di nilai terakhir sampai harga vendor diisi di sini atau lewat PO/nota.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari bahan…" className="min-w-[200px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={hanyaBelum} onChange={(e) => setHanyaBelum(e.target.checked)} /> Hanya yang belum dikonfirmasi
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-2">Bahan</th><th className="text-right">Harga master</th><th>Asal harga</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {tampil.map((s) => (
              <tr key={s.bahan_baku_id} className="border-b last:border-0">
                <td className="py-2 font-semibold text-suka-brown">{s.nama}</td>
                <td className="text-right">{s.harga_master ? rupiah(s.harga_master) : '—'}</td>
                <td className="max-w-xs text-xs text-gray-600">
                  {s.asal_catatan ?? '—'}
                  {s.asal_waktu && <span className="block text-gray-400">{new Date(s.asal_waktu).toLocaleString('id-ID')}</span>}
                </td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.status === 'terkonfirmasi' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {s.status === 'terkonfirmasi' ? 'terkonfirmasi' : 'belum dikonfirmasi'}
                  </span>
                </td>
                <td className="text-right">
                  {bolehHarga && (
                    <button onClick={() => setIsiId(s.bahan_baku_id)} className="text-sm font-bold text-suka-orange hover:underline">Isi harga vendor</button>
                  )}
                </td>
              </tr>
            ))}
            {tampil.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Tidak ada bahan.</td></tr>}
          </tbody>
        </table>
      </div>
      {target && <FormHargaVendor bahan={target} onBatal={() => setIsiId(null)} onSelesai={() => setIsiId(null)} />}
    </div>
  )
}
