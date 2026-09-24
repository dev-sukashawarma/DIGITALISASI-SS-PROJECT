'use client'
import { useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { useRole } from '@/components/layout/RoleContext'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useStatusHarga } from '@/hooks/masterBahan/useStatusHarga'
import { useJumlahBatasOutlet } from '@/hooks/masterBahan/useJumlahBatasOutlet'
import { filterAndSortBahanBaku, type SortOption } from '@/lib/bahanBaku'
import { bolehUbahData } from '@/lib/masterBahan/akses'
import { labelKategori, ringkasSatuan } from '@/lib/masterBahan/tampilan'
import { rupiah } from '@/lib/format'
import { FormBahanBaru } from './FormBahanBaru'
import { PanelBahan } from './PanelBahan'
import {
  BarisKosong, BarisTabel, FilterCepat, InfoJumlah, KepalaTabel, KolomCari, Kosong, LebarKolom, Lencana, Pilih, Tabel, Td, Th,
} from './Tabel'

const PERUNTUKAN = {
  outlet: { label: 'Outlet', nada: 'biru' },
  gudang: { label: 'Gudang', nada: 'oranye' },
  keduanya: { label: 'Gudang & Outlet', nada: 'netral' },
} as const

const URUTAN: { id: SortOption; label: string }[] = [
  { id: 'nama-asc', label: 'Nama A–Z' },
  { id: 'nama-desc', label: 'Nama Z–A' },
  { id: 'kategori-asc', label: 'Kategori A–Z' },
  { id: 'harga-desc', label: 'Harga tertinggi' },
  { id: 'harga-asc', label: 'Harga terendah' },
]

type Saringan = 'aktif' | 'belum_harga' | 'tanpa_opname' | 'nonaktif'

export function TabDataBahan() {
  const { role } = useRole()
  const bolehData = bolehUbahData(role)
  const { data: rows = [], isLoading, error } = useDaftarBahan()
  const { data: status = [] } = useStatusHarga()
  const batas = useJumlahBatasOutlet()
  const [cari, setCari] = useState('')
  const [urut, setUrut] = useState<SortOption>('nama-asc')
  const [saringan, setSaringan] = useState<Saringan>('aktif')
  const [kategoriPilih, setKategoriPilih] = useState('')
  const [dipilihId, setDipilihId] = useState<string | null>(null)
  const [tambahBuka, setTambahBuka] = useState(false)

  const belumPasti = useMemo(
    () => new Set(status.filter((s) => s.status === 'belum_dikonfirmasi').map((s) => s.bahan_baku_id)),
    [status],
  )
  const aktif = useMemo(() => rows.filter((r) => r.is_active), [rows])
  const jumlah = {
    aktif: aktif.length,
    belum_harga: aktif.filter((r) => belumPasti.has(r.id)).length,
    tanpa_opname: aktif.filter((r) => !r.is_opname).length,
    nonaktif: rows.length - aktif.length,
  }

  const dasar = useMemo(() => {
    const menurutSaringan =
      saringan === 'nonaktif' ? rows.filter((r) => !r.is_active)
      : saringan === 'belum_harga' ? aktif.filter((r) => belumPasti.has(r.id))
      : saringan === 'tanpa_opname' ? aktif.filter((r) => !r.is_opname)
      : aktif
    return kategoriPilih ? menurutSaringan.filter((r) => r.kategori === kategoriPilih) : menurutSaringan
  }, [rows, aktif, saringan, belumPasti, kategoriPilih])
  const tampil = useMemo(() => filterAndSortBahanBaku(dasar, cari, urut), [dasar, cari, urut])
  const kategori = useMemo(() => Array.from(new Set(rows.map((r) => r.kategori))).sort(), [rows])
  const dipilih = rows.find((r) => r.id === dipilihId) ?? null

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error) return <p className="p-6 text-sm text-red-600">Gagal memuat bahan baku: {String((error as Error).message ?? error)}</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterCepat<Saringan>
          label="Saringan cepat"
          nilai={saringan}
          onUbah={setSaringan}
          pilihan={[
            { id: 'aktif', label: 'Aktif', jumlah: jumlah.aktif },
            { id: 'belum_harga', label: 'Harga belum pasti', jumlah: jumlah.belum_harga, nada: 'kuning' },
            { id: 'tanpa_opname', label: 'Tanpa opname', jumlah: jumlah.tanpa_opname },
            { id: 'nonaktif', label: 'Nonaktif', jumlah: jumlah.nonaktif },
          ]}
        />
        {bolehData && (
          <button onClick={() => setTambahBuka(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-suka-orange px-3.5 text-sm font-bold text-white shadow-sm hover:brightness-95">
            <Plus size={16} /> Tambah Bahan
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <KolomCari nilai={cari} onUbah={setCari} placeholder="Cari nama atau merek…" />
        <Pilih nilai={kategoriPilih} onUbah={setKategoriPilih} label="Saring kategori">
          <option value="">Semua kategori</option>
          {kategori.map((k) => <option key={k} value={k}>{labelKategori(k)}</option>)}
        </Pilih>
        <Pilih nilai={urut} onUbah={(v) => setUrut(v as SortOption)} label="Urutkan">
          {URUTAN.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Pilih>
        <div className="ml-auto"><InfoJumlah tampil={tampil.length} total={dasar.length} satuan="bahan" /></div>
      </div>

      <Tabel lebarMin={900}>
        <LebarKolom lebar={['29%', '15%', '23%', '13%', '14%', '2.75rem']} />
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
            const hargaBelumPasti = belumPasti.has(r.id)
            return (
              <BarisTabel key={r.id} onKlik={() => setDipilihId(r.id)} redup={!r.is_active}>
                <Td>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate font-semibold ${r.is_active ? 'text-suka-brown' : ''}`} title={r.nama}>{r.nama}</span>
                    {r.merek && <span className="truncate text-xs text-stone-500">· {r.merek}</span>}
                    {!r.is_active && <Lencana nada="abu">nonaktif</Lencana>}
                    {!r.is_opname && <Lencana nada="biru">tanpa opname</Lencana>}
                  </div>
                </Td>
                <Td><span className="truncate text-[11.5px] font-semibold tracking-wide text-stone-600">{labelKategori(r.kategori)}</span></Td>
                <Td className="truncate text-stone-700">{ringkasSatuan(r)}</Td>
                <Td><Lencana nada={p.nada}>{p.label}</Lencana></Td>
                <Td angka>
                  {r.harga?.harga_beli ? (
                    <span className="inline-flex items-center gap-1.5">
                      {hargaBelumPasti && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Belum dikonfirmasi harga vendor terpercaya" aria-label="harga belum pasti" />
                      )}
                      <span className="font-semibold">{rupiah(r.harga.harga_beli)}</span>
                    </span>
                  ) : <Kosong />}
                </Td>
                <Td rata="kanan">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDipilihId(r.id) }}
                    aria-label={`Buka detail ${r.nama}`}
                    className="rounded p-0.5 text-stone-400 hover:bg-stone-200/60 hover:text-suka-brown"
                  >
                    <ChevronRight size={16} />
                  </button>
                </Td>
              </BarisTabel>
            )
          })}
          {tampil.length === 0 && <BarisKosong kolom={6} pesan="Tidak ada bahan yang cocok dengan saringan ini." />}
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
