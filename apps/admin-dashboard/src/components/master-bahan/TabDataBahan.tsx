'use client'
import { Fragment, useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { useRole } from '@/components/layout/RoleContext'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useStatusHarga } from '@/hooks/masterBahan/useStatusHarga'
import { useJumlahBatasOutlet } from '@/hooks/masterBahan/useJumlahBatasOutlet'
import { filterAndSortBahanBaku, type SortOption } from '@/lib/bahanBaku'
import { bolehUbahData } from '@/lib/masterBahan/akses'
import {
  KELOMPOK_KATEGORI, kategoriResmi, kelompokKategori, labelKategori, ringkasSatuan, ringkasSatuanKirim, ringkasSatuanOpname,
  type KunciKelompok,
} from '@/lib/masterBahan/tampilan'
import { rupiah } from '@/lib/format'
import { FormBahanBaru } from './FormBahanBaru'
import { PanelBahan } from './PanelBahan'
import {
  BarisGrup, BarisKosong, BarisTabel, FilterCepat, InfoJumlah, KepalaTabel, KolomCari, Kosong, LebarKolom, Lencana, Pilih, Tabel, Td, Th,
} from './Tabel'

const PERUNTUKAN = {
  outlet: { label: 'Outlet', nada: 'biru' },
  gudang: { label: 'Gudang', nada: 'oranye' },
  keduanya: { label: 'Gudang & Outlet', nada: 'netral' },
} as const

const URUTAN: { id: SortOption; label: string }[] = [
  { id: 'nama-asc', label: 'Nama A–Z' },
  { id: 'nama-desc', label: 'Nama Z–A' },
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
  const [kategoriPilih, setKategoriPilih] = useState<KunciKelompok | ''>('')
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

  const menurutSaringan = useMemo(
    () =>
      saringan === 'nonaktif' ? rows.filter((r) => !r.is_active)
      : saringan === 'belum_harga' ? aktif.filter((r) => belumPasti.has(r.id))
      : saringan === 'tanpa_opname' ? aktif.filter((r) => !r.is_opname)
      : aktif,
    [rows, aktif, saringan, belumPasti],
  )
  const dasar = useMemo(
    () => kategoriPilih ? menurutSaringan.filter((r) => kelompokKategori(r.kategori) === kategoriPilih) : menurutSaringan,
    [menurutSaringan, kategoriPilih],
  )
  const tampil = useMemo(() => filterAndSortBahanBaku(dasar, cari, urut), [dasar, cari, urut])
  // Lima kategori besar, urutan tetap; kelompok kosong tidak ditampilkan. Urutan di dalam kelompok ikut `urut`.
  const grup = useMemo(
    () => KELOMPOK_KATEGORI
      .map((g) => ({ ...g, baris: tampil.filter((r) => kelompokKategori(r.kategori) === g.kunci) }))
      .filter((g) => g.baris.length > 0),
    [tampil],
  )
  const jumlahPerKelompok = useMemo(() => {
    const m = new Map<KunciKelompok, number>()
    for (const r of menurutSaringan) {
      const k = kelompokKategori(r.kategori)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [menurutSaringan])
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
        <Pilih nilai={kategoriPilih} onUbah={(v) => setKategoriPilih(v as KunciKelompok | '')} label="Saring kategori">
          <option value="">Semua kategori</option>
          {KELOMPOK_KATEGORI.map((g) => (
            <option key={g.kunci} value={g.kunci}>{g.label} ({jumlahPerKelompok.get(g.kunci) ?? 0})</option>
          ))}
        </Pilih>
        <Pilih nilai={urut} onUbah={(v) => setUrut(v as SortOption)} label="Urutkan">
          {URUTAN.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Pilih>
        <div className="ml-auto"><InfoJumlah tampil={tampil.length} total={dasar.length} satuan="bahan" /></div>
      </div>

      <Tabel lebarMin={1080}>
        <LebarKolom lebar={['24%', '20%', '14%', '14%', '12%', '13%', '2.75rem']} />
        <KepalaTabel>
          <Th>Bahan</Th>
          <Th>Satuan</Th>
          <Th>Satuan kirim</Th>
          <Th>Satuan opname</Th>
          <Th>Peruntukan</Th>
          <Th rata="kanan">Harga master</Th>
          <Th><span className="sr-only">Buka detail</span></Th>
        </KepalaTabel>
        <tbody>
          {grup.map((g) => (
            <Fragment key={g.kunci}>
              <BarisGrup kolom={7} label={g.label} jumlah={g.baris.length} />
              {g.baris.map((r) => {
                const p = PERUNTUKAN[r.peruntukan]
                const hargaBelumPasti = belumPasti.has(r.id)
                const kirim = ringkasSatuanKirim(r)
                const opname = ringkasSatuanOpname(r)
                return (
                  <BarisTabel key={r.id} onKlik={() => setDipilihId(r.id)} redup={!r.is_active}>
                    <Td>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className={`truncate font-semibold ${r.is_active ? 'text-suka-brown' : ''}`} title={r.nama}>{r.nama}</span>
                        {r.merek && <span className="truncate text-xs text-stone-500">· {r.merek}</span>}
                        {!r.is_active && <Lencana nada="abu">nonaktif</Lencana>}
                        {!r.is_opname && <Lencana nada="biru">tanpa opname</Lencana>}
                        {!kategoriResmi(r.kategori) && (
                          <span title={`Kategori di data tertulis "${r.kategori || '—'}", bukan salah satu dari 5 kategori besar`}>
                            <Lencana nada="abu">{labelKategori(r.kategori).toLowerCase()}</Lencana>
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="truncate text-stone-700">{ringkasSatuan(r)}</Td>
                    <Td>
                      {kirim.dikenal ? (
                        <div
                          className="truncate"
                          title={kirim.bawaan ? 'Satuan kirim belum diisi — ikut satuan besar' : undefined}
                        >
                          <span className={kirim.bawaan ? 'text-stone-500' : 'font-semibold text-stone-800'}>{kirim.label}</span>
                          {kirim.isi && <span className="text-stone-500"> = {kirim.isi}</span>}
                        </div>
                      ) : (
                        <span title={`"${kirim.label}" tidak cocok dengan tingkat satuan bahan ini — konversi kiriman dihitung 1×`}>
                          <Lencana nada="kuning">{kirim.label} · tak cocok</Lencana>
                        </span>
                      )}
                    </Td>
                    <Td className="truncate text-stone-700">
                      {opname ?? <span className="text-stone-500">tidak diopname</span>}
                    </Td>
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
            </Fragment>
          ))}
          {tampil.length === 0 && <BarisKosong kolom={7} pesan="Tidak ada bahan yang cocok dengan saringan ini." />}
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
