'use client'
import { useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { useRole } from '@/components/layout/RoleContext'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useJumlahBatasOutlet } from '@/hooks/masterBahan/useJumlahBatasOutlet'
import { filterAndSortBahanBaku, type SortOption } from '@/lib/bahanBaku'
import { bolehUbahData } from '@/lib/masterBahan/akses'
import { labelKategori, ringkasSatuan } from '@/lib/masterBahan/tampilan'
import { BahanBakuFilters } from '@/components/BahanBakuFilters'
import { rupiah } from '@/lib/format'
import { FormBahanBaru } from './FormBahanBaru'
import { PanelBahan } from './PanelBahan'
import {
  BarisKosong, BarisTabel, InfoJumlah, KepalaTabel, Kosong, LebarKolom, Lencana, Tabel, Td, Th,
} from './Tabel'

const PERUNTUKAN = {
  outlet: { label: 'Outlet', nada: 'biru' },
  gudang: { label: 'Gudang', nada: 'oranye' },
  keduanya: { label: 'Gudang & Outlet', nada: 'netral' },
} as const

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

  const dasar = useMemo(() => rows.filter((r) => tampilNonaktif || r.is_active), [rows, tampilNonaktif])
  const tampil = useMemo(() => filterAndSortBahanBaku(dasar, search, sortBy), [dasar, search, sortBy])
  const kategori = useMemo(() => Array.from(new Set(rows.map((r) => r.kategori))).sort(), [rows])
  const dipilih = rows.find((r) => r.id === dipilihId) ?? null

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error) return <p className="p-6 text-sm text-red-600">Gagal memuat bahan baku: {String((error as Error).message ?? error)}</p>

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BahanBakuFilters search={search} onSearch={setSearch} sortBy={sortBy} onSortBy={setSortBy} />
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={tampilNonaktif} onChange={(e) => setTampilNonaktif(e.target.checked)} />
            Tampilkan nonaktif
          </label>
          {bolehData && (
            <button onClick={() => setTambahBuka(true)}
              className="flex items-center gap-2 rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white hover:brightness-95">
              <Plus size={16} /> Tambah Bahan
            </button>
          )}
        </div>
      </div>

      <InfoJumlah tampil={tampil.length} total={dasar.length} satuan="bahan" />

      <Tabel lebarMin={880}>
        <LebarKolom lebar={['28%', '15%', '23%', '14%', '13%', '3.5rem']} />
        <KepalaTabel>
          <Th>Bahan</Th>
          <Th>Kategori</Th>
          <Th>Satuan</Th>
          <Th>Peruntukan</Th>
          <Th rata="kanan">Harga master</Th>
          <Th><span className="sr-only">Buka detail</span></Th>
        </KepalaTabel>
        <tbody>
          {tampil.map((r) => {
            const p = PERUNTUKAN[r.peruntukan]
            return (
              <BarisTabel key={r.id} onKlik={() => setDipilihId(r.id)} redup={!r.is_active}>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`font-semibold ${r.is_active ? 'text-suka-brown' : ''}`}>{r.nama}</span>
                    {!r.is_active && <Lencana nada="abu">nonaktif</Lencana>}
                    {!r.is_opname && <Lencana nada="biru">tanpa opname</Lencana>}
                  </div>
                  {r.merek && <p className="mt-0.5 truncate text-xs text-stone-500">{r.merek}</p>}
                </Td>
                <Td><span className="text-xs font-medium tracking-wide text-stone-600">{labelKategori(r.kategori)}</span></Td>
                <Td className="text-stone-700">{ringkasSatuan(r)}</Td>
                <Td><Lencana nada={p.nada}>{p.label}</Lencana></Td>
                <Td angka className="font-semibold text-stone-800">
                  {r.harga?.harga_beli ? rupiah(r.harga.harga_beli) : <Kosong />}
                </Td>
                <Td rata="kanan">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDipilihId(r.id) }}
                    aria-label={`Buka detail ${r.nama}`}
                    className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-suka-orange"
                  >
                    <ChevronRight size={18} />
                  </button>
                </Td>
              </BarisTabel>
            )
          })}
          {tampil.length === 0 && <BarisKosong kolom={6} pesan="Tidak ada bahan yang cocok." />}
        </tbody>
      </Tabel>

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
