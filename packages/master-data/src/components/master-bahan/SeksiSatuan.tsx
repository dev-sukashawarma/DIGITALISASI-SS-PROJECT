'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '../../lib/bahanBaku'
import { useMutasiMasterBahan, type DataBahan } from '../../hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '../../lib/masterBahan/galatRpc'
import { pilihanSatuanBeli } from '../../lib/masterBahan/satuanBeli'
import { DialogAlasan } from './DialogAlasan'
import { ModalGantiSatuan } from './ModalGantiSatuan'
import { useRole } from '../../peran'
import { bolehGantiSatuan } from '../../lib/masterBahan/akses'
import { CustomSelect } from '../ui/CustomSelect'
import {
  IsianSatuanFields,
  keDataSatuan,
  nilaiSatuanDari,
  satuanInvalid,
  type NilaiSatuan,
} from './IsianSatuanFields'

export function SeksiSatuan({
  bahan,
  bolehData,
}: {
  bahan: BahanBakuWithHarga
  bolehData: boolean
}) {
  const { simpanBahan } = useMutasiMasterBahan()
  const awal = useMemo(() => nilaiSatuanDari(bahan), [bahan])
  const [nilai, setNilai] = useState<NilaiSatuan>(awal)
  const [satuanPo, setSatuanPo] = useState(bahan.satuan_po ?? '')
  const [satuanDist, setSatuanDist] = useState(bahan.satuan_distribusi ?? '')
  const [minta, setMinta] = useState(false)
  const [galat, setGalat] = useState<GalatRpc | null>(null)
  const [ganti, setGanti] = useState(false)
  const { role } = useRole()
  const bolehGanti = bolehGantiSatuan(role)

  const pilihan = pilihanSatuanBeli(bahan).map((p) => p.label)
  const pilihanPo = pilihan.filter(
    (l) =>
      l.toLowerCase() !== 'kg' ||
      [bahan.satuan, bahan.satuan_tengah, bahan.satuan_kecil].some(
        (t) => t?.toLowerCase() === 'kg',
      ),
  )

  const satuanBerubah = (Object.keys(awal) as (keyof NilaiSatuan)[]).some(
    (k) => nilai[k].trim() !== awal[k].trim(),
  )
  const satuanTidakValid = satuanBerubah && satuanInvalid(nilai)
  const ubahan: DataBahan = satuanBerubah ? { ...keDataSatuan(nilai) } : {}
  if ((satuanPo || null) !== (bahan.satuan_po ?? null)) ubahan.satuan_po = satuanPo || null
  if ((satuanDist || null) !== (bahan.satuan_distribusi ?? null))
    ubahan.satuan_distribusi = satuanDist || null
  const adaUbahan = Object.keys(ubahan).length > 0

  async function simpan({ alasan }: { alasan: string; paksa: boolean }) {
    setGalat(null)
    try {
      await simpanBahan.mutateAsync({ id: bahan.id, data: ubahan, alasan: alasan || null })
      toast.success('Satuan disimpan')
      setMinta(false)
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  const opsiSelectPo = [
    { value: '', label: 'Kosong' },
    ...pilihanPo.map((l) => ({ value: l, label: l })),
    ...(satuanPo && !pilihanPo.includes(satuanPo)
      ? [{ value: satuanPo, label: `${satuanPo} (lama)` }]
      : []),
  ]

  const opsiSelectDist = [
    { value: '', label: 'Kosong' },
    ...pilihan.map((l) => ({ value: l, label: l })),
    ...(satuanDist && !pilihan.includes(satuanDist)
      ? [{ value: satuanDist, label: `${satuanDist} (lama)` }]
      : []),
  ]

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-suka-brown">Satuan</h3>
      <IsianSatuanFields nilai={nilai} onUbah={setNilai} nonaktif={!bolehData} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3">
        <p className="text-xs text-amber-800">
          Bahan yang sudah punya riwayat stok diganti satuannya lewat tombol Ganti Satuan (stok,
          riwayat, dan dokumen ikut dikonversi).
        </p>
        {bolehGanti && (
          <button
            type="button"
            onClick={() => setGanti(true)}
            className="rounded-xl border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
          >
            Ganti Satuan
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-xs font-semibold text-gray-600">
          <span>Satuan PO</span>
          <CustomSelect
            value={satuanPo}
            onChange={setSatuanPo}
            disabled={!bolehData}
            placeholder="Pilih satuan PO"
            options={opsiSelectPo}
          />
        </div>
        <div className="text-xs font-semibold text-gray-600">
          <span>Satuan distribusi</span>
          <CustomSelect
            value={satuanDist}
            onChange={setSatuanDist}
            disabled={!bolehData}
            placeholder="Pilih satuan distribusi"
            options={opsiSelectDist}
          />
        </div>
      </div>
      {bolehData && (
        <button
          type="button"
          onClick={() => setMinta(true)}
          disabled={!adaUbahan || satuanTidakValid}
          className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          Simpan satuan
        </button>
      )}
      {minta && (
        <DialogAlasan
          judul="Simpan perubahan satuan"
          wajib={false}
          galat={galat}
          memproses={simpanBahan.isPending}
          onBatal={() => {
            setMinta(false)
            setGalat(null)
          }}
          onKirim={simpan}
        />
      )}
      {ganti && <ModalGantiSatuan bahan={bahan} onTutup={() => setGanti(false)} />}
    </section>
  )
}
