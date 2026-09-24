'use client'
import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { useRole } from '@/components/layout/RoleContext'
import { useStatusHarga } from '@/hooks/masterBahan/useStatusHarga'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { bolehUbahHarga } from '@/lib/masterBahan/akses'
import { rupiah } from '@/lib/format'
import { FormHargaVendor } from './FormHargaVendor'
import {
  BarisKosong, BarisTabel, FilterCepat, InfoJumlah, KepalaTabel, KolomCari, Kosong, LebarKolom, Lencana, Tabel, Td, Th,
} from './Tabel'

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export function TabHarga() {
  const { role } = useRole()
  const bolehHarga = bolehUbahHarga(role)
  const { data: status = [], isLoading, error } = useStatusHarga()
  const { data: bahan = [] } = useDaftarBahan()
  const belum = status.filter((s) => s.status === 'belum_dikonfirmasi').length
  const [hanyaBelum, setHanyaBelum] = useState(true)
  const [cari, setCari] = useState('')
  const [isiId, setIsiId] = useState<string | null>(null)

  const dasar = useMemo(
    () => status.filter((s) => !hanyaBelum || s.status === 'belum_dikonfirmasi'),
    [status, hanyaBelum],
  )
  const tampil = useMemo(() => {
    const k = cari.trim().toLowerCase()
    return k ? dasar.filter((s) => s.nama.toLowerCase().includes(k)) : dasar
  }, [dasar, cari])
  const target = bahan.find((b) => b.id === isiId) ?? null

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error) return <p className="p-6 text-sm text-red-600">Gagal memuat status harga: {String((error as Error).message ?? error)}</p>

  return (
    <div className="space-y-3">
      {belum > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <p>
            <span className="font-bold">{belum} bahan belum punya harga vendor terpercaya.</span>{' '}
            Harga master mereka dibekukan di nilai terakhir sampai harga vendor diisi di sini atau lewat PO/nota.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterCepat<'belum' | 'semua'>
          label="Saring status harga"
          nilai={hanyaBelum ? 'belum' : 'semua'}
          onUbah={(v) => setHanyaBelum(v === 'belum')}
          pilihan={[
            { id: 'belum', label: 'Belum dikonfirmasi', jumlah: belum, nada: 'kuning' },
            { id: 'semua', label: 'Semua', jumlah: status.length },
          ]}
        />
        <KolomCari nilai={cari} onUbah={setCari} placeholder="Cari bahan…" />
        <div className="ml-auto"><InfoJumlah tampil={tampil.length} total={dasar.length} satuan="bahan" /></div>
      </div>

      <Tabel lebarMin={820}>
        <LebarKolom lebar={bolehHarga ? ['26%', '14%', '32%', '14%', '14%'] : ['28%', '16%', '38%', '18%']} />
        <KepalaTabel>
          <Th>Bahan</Th>
          <Th rata="kanan">Harga master</Th>
          <Th>Asal harga</Th>
          <Th>Status</Th>
          {bolehHarga && <Th><span className="sr-only">Aksi</span></Th>}
        </KepalaTabel>
        <tbody>
          {tampil.map((s) => (
            <BarisTabel key={s.bahan_baku_id} sorot={s.status !== 'terkonfirmasi' && !hanyaBelum}>
              <Td><span className="font-semibold text-suka-brown">{s.nama}</span></Td>
              <Td angka className="font-semibold text-stone-800">
                {s.harga_master ? rupiah(s.harga_master) : <Kosong />}
              </Td>
              <Td>
                {s.asal_catatan ? (
                  <>
                    <p className="truncate text-stone-700" title={s.asal_catatan}>{s.asal_catatan}</p>
                    {s.asal_waktu && (
                      <p className="mt-0.5 text-xs text-stone-500">
                        {tanggal(s.asal_waktu)} · oleh {s.asal_oleh ?? 'sistem'}
                      </p>
                    )}
                  </>
                ) : <Kosong />}
              </Td>
              <Td>
                {s.status === 'terkonfirmasi'
                  ? <Lencana nada="hijau">terkonfirmasi</Lencana>
                  : <Lencana nada="kuning">belum dikonfirmasi</Lencana>}
              </Td>
              {bolehHarga && (
                <Td rata="kanan">
                  <button
                    onClick={() => setIsiId(s.bahan_baku_id)}
                    className="whitespace-nowrap rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-bold text-suka-brown hover:border-suka-orange hover:bg-orange-50"
                  >
                    Isi harga vendor
                  </button>
                </Td>
              )}
            </BarisTabel>
          ))}
          {tampil.length === 0 && (
            <BarisKosong
              kolom={bolehHarga ? 5 : 4}
              pesan={hanyaBelum && !cari ? 'Semua bahan sudah punya harga vendor terpercaya.' : 'Tidak ada bahan yang cocok.'}
            />
          )}
        </tbody>
      </Tabel>

      {target && <FormHargaVendor bahan={target} onBatal={() => setIsiId(null)} onSelesai={() => setIsiId(null)} />}
    </div>
  )
}
