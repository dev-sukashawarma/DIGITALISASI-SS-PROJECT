'use client'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { useRole } from '@/components/layout/RoleContext'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useJumlahBatasOutlet } from '@/hooks/masterBahan/useJumlahBatasOutlet'
import { filterAndSortBahanBaku, type SortOption } from '@/lib/bahanBaku'
import { bolehUbahData } from '@/lib/masterBahan/akses'
import { BahanBakuFilters } from '@/components/BahanBakuFilters'
import { rupiah } from '@/lib/format'
import { FormBahanBaru } from './FormBahanBaru'
import { PanelBahan } from './PanelBahan'

const LABEL_PERUNTUKAN = { outlet: 'Outlet', gudang: 'Gudang', keduanya: 'Gudang & Outlet' } as const

export function TabDataBahan() {
  const { role } = useRole()
  const bolehData = bolehUbahData(role)
  const { data: rows = [], isLoading, error } = useDaftarBahan()
  const batas = useJumlahBatasOutlet()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('nama-asc')
  const [tampilNonaktif, setTampilNonaktif] = useState(false)
  const [dipilihId, setDipilihId] = useState<string | null>(null)
  const [tambahBuka, setTambahBuka] = useState(false)

  const tampil = useMemo(
    () => filterAndSortBahanBaku(rows.filter((r) => tampilNonaktif || r.is_active), search, sortBy),
    [rows, tampilNonaktif, search, sortBy],
  )
  const kategori = useMemo(() => Array.from(new Set(rows.map((r) => r.kategori))).sort(), [rows])
  const dipilih = rows.find((r) => r.id === dipilihId) ?? null

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error) return <p className="p-6 text-sm text-red-600">Gagal memuat bahan baku: {String((error as Error).message ?? error)}</p>

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BahanBakuFilters search={search} onSearch={setSearch} sortBy={sortBy} onSortBy={setSortBy} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={tampilNonaktif} onChange={(e) => setTampilNonaktif(e.target.checked)} />
            Tampilkan nonaktif
          </label>
          {bolehData && (
            <button onClick={() => setTambahBuka(true)}
              className="flex items-center gap-2 rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white">
              <Plus size={16} /> Tambah Bahan
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-2">Bahan</th><th>Kategori</th><th>Satuan</th><th>Peruntukan</th><th className="text-right">Harga master</th><th />
            </tr>
          </thead>
          <tbody>
            {tampil.map((r) => (
              <tr key={r.id} className={`border-b last:border-0 ${r.is_active ? '' : 'opacity-50'}`}>
                <td className="py-2 font-semibold text-suka-brown">
                  {r.nama}{r.merek ? <span className="ml-1 text-xs font-normal text-gray-500">({r.merek})</span> : null}
                  {!r.is_active && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">nonaktif</span>}
                  {!r.is_opname && <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">tanpa opname</span>}
                </td>
                <td>{r.kategori}</td>
                <td className="text-gray-600">
                  {r.satuan}{r.satuan_kecil && r.faktor_tampilan ? ` = ${Number(r.faktor_tampilan).toLocaleString('id-ID')} ${r.satuan_kecil}` : ''}
                </td>
                <td>{LABEL_PERUNTUKAN[r.peruntukan]}</td>
                <td className="text-right">{r.harga?.harga_beli ? rupiah(r.harga.harga_beli) : '—'}</td>
                <td className="text-right">
                  <button onClick={() => setDipilihId(r.id)} className="text-sm font-bold text-suka-orange hover:underline">Detail</button>
                </td>
              </tr>
            ))}
            {tampil.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">Tidak ada bahan yang cocok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {tambahBuka && (
        <FormBahanBaru kategoriAda={kategori} onBatal={() => setTambahBuka(false)}
          onSelesai={(id) => { setTambahBuka(false); setDipilihId(id) }} />
      )}
      {dipilih && (
        <PanelBahan key={dipilih.id} bahan={dipilih} bolehData={bolehData}
          jumlahBatasOutlet={batas.tersedia ? batas.jumlah.get(dipilih.id) ?? 0 : null}
          onTutup={() => setDipilihId(null)} />
      )}
    </div>
  )
}
