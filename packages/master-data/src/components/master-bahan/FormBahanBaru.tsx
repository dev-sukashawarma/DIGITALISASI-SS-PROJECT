'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { useSuppliers } from '../../hooks/supplier'
import { useMutasiMasterBahan } from '../../hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc } from '../../lib/masterBahan/galatRpc'
import { bacaIsian } from '../../lib/masterBahan/angka'
import { pilihanSatuanBeli } from '../../lib/masterBahan/satuanBeli'
import { KATEGORI_RESMI } from '../../lib/masterBahan/daftarPilihan'
import { CustomSelect } from '../ui/CustomSelect'
import {
  IsianSatuanFields,
  faktorTampilanDari,
  keDataSatuan,
  satuanInvalid,
  type NilaiSatuan,
} from './IsianSatuanFields'

const BELI_TUNAI = 'Beli Tunai / Tanpa Vendor'

const OPSI_PERUNTUKAN = [
  { value: 'outlet', label: 'Outlet' },
  { value: 'gudang', label: 'Gudang' },
  { value: 'keduanya', label: 'Gudang & Outlet' },
]

export function FormBahanBaru({
  onBatal,
  onSelesai,
}: {
  onBatal: () => void
  onSelesai: (id: string) => void
}) {
  const { simpanBahan, simpanHargaVendor } = useMutasiMasterBahan()
  const { data: suppliers = [] } = useSuppliers()
  const aktif = useMemo(() => suppliers.filter((s) => s.is_active), [suppliers])

  const [nama, setNama] = useState('')
  const [kategori, setKategori] = useState('')
  const [peruntukan, setPeruntukan] = useState<'outlet' | 'gudang' | 'keduanya'>('outlet')
  const [isOpname, setIsOpname] = useState(true)
  const [batas, setBatas] = useState('0')
  const [satuan, setSatuan] = useState<NilaiSatuan>({
    satuan: '',
    satuan_tengah: '',
    faktor_tengah: '',
    satuan_kecil: '',
    isi_kecil_per_tengah: '',
  })
  const [satuanPo, setSatuanPo] = useState('')
  const [satuanDist, setSatuanDist] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [labelBeli, setLabelBeli] = useState('')
  const [harga, setHarga] = useState('')
  const [galat, setGalat] = useState<string | null>(null)

  const dataSatuan = keDataSatuan(satuan)
  const pilihan = pilihanSatuanBeli({
    satuan: dataSatuan.satuan ?? '',
    satuan_tengah: dataSatuan.satuan_tengah ?? null,
    faktor_tengah: dataSatuan.faktor_tengah ?? null,
    satuan_kecil: dataSatuan.satuan_kecil ?? null,
    faktor_tampilan: faktorTampilanDari(dataSatuan),
  })
  const opsiDist = pilihan.map((p) => p.label)
  const opsiPo = opsiDist.filter(
    (l) =>
      l.toLowerCase() !== 'kg' ||
      [dataSatuan.satuan, dataSatuan.satuan_tengah, dataSatuan.satuan_kecil].some(
        (t) => t?.toLowerCase() === 'kg',
      ),
  )

  const defaultPo = dataSatuan.satuan ?? ''
  const defaultDist = dataSatuan.satuan_tengah || dataSatuan.satuan || ''
  const nilaiSatuanPo = opsiPo.includes(satuanPo)
    ? satuanPo
    : opsiPo.find((l) => l.toLowerCase() === defaultPo.toLowerCase()) ?? opsiPo[0] ?? ''
  const nilaiSatuanDist = opsiDist.includes(satuanDist)
    ? satuanDist
    : opsiDist.find((l) => l.toLowerCase() === defaultDist.toLowerCase()) ?? opsiDist[0] ?? ''

  const pilihanBeli = pilihan.find((p) => p.label === labelBeli) ?? pilihan[0]
  const memproses = simpanBahan.isPending || simpanHargaVendor.isPending

  // Vendor awal: default ke "Beli Tunai" HANYA sekali saat daftar supplier termuat
  const diinisialisasi = useRef(false)
  useEffect(() => {
    if (diinisialisasi.current || aktif.length === 0) return
    diinisialisasi.current = true
    const beliTunai = aktif.find((s) => s.nama === BELI_TUNAI)
    if (beliTunai) setSupplierId(beliTunai.id)
  }, [aktif])

  const { nilai: nilaiBatas, invalid: batasInvalid } = bacaIsian(batas, 0)
  const { nilai: nilaiHarga, invalid: hargaInvalid } = bacaIsian(harga, null)

  const lengkap =
    nama.trim() !== '' &&
    kategori.trim() !== '' &&
    !satuanInvalid(satuan) &&
    nilaiSatuanPo !== '' &&
    nilaiSatuanDist !== '' &&
    !batasInvalid &&
    !hargaInvalid

  async function simpan() {
    setGalat(null)
    let id: string
    try {
      id = await simpanBahan.mutateAsync({
        id: null,
        data: {
          nama: nama.trim(),
          kategori: kategori.trim(),
          peruntukan,
          is_opname: isOpname,
          default_reorder_point: nilaiBatas ?? 0,
          ...dataSatuan,
          satuan_po: nilaiSatuanPo.toLowerCase(),
          satuan_distribusi: nilaiSatuanDist.toLowerCase(),
        },
        alasan: 'Bahan baru',
      })
    } catch (e) {
      setGalat(bacaGalatRpc(e).pesan)
      return
    }
    if (nilaiHarga !== null && nilaiHarga > 0 && supplierId && pilihanBeli) {
      try {
        await simpanHargaVendor.mutateAsync({
          bahanId: id,
          supplierId,
          harga: nilaiHarga,
          satuanBeli: pilihanBeli.label,
          isi: pilihanBeli.isi,
          alasan: 'Harga awal saat bahan dibuat',
        })
      } catch (e) {
        toast.error(`Bahan tersimpan, tetapi harga awal gagal: ${bacaGalatRpc(e).pesan}`)
        onSelesai(id)
        return
      }
    }
    toast.success('Bahan baku ditambahkan')
    onSelesai(id)
  }

  const kelasInput =
    'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-suka-orange focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-extrabold text-suka-brown">Tambah bahan baku</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-semibold text-gray-600">
            Nama
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className={kelasInput}
            />
          </label>

          <div className="text-xs font-semibold text-gray-600">
            <span>Kategori</span>
            <CustomSelect
              value={kategori}
              onChange={setKategori}
              placeholder="Pilih kategori"
              options={KATEGORI_RESMI.map((k) => ({ value: k, label: k }))}
            />
          </div>

          <div className="text-xs font-semibold text-gray-600">
            <span>Peruntukan</span>
            <CustomSelect
              value={peruntukan}
              onChange={(v) => setPeruntukan(v as typeof peruntukan)}
              options={OPSI_PERUNTUKAN}
            />
          </div>

          <div className="flex items-center pt-4">
            <button
              type="button"
              role="checkbox"
              aria-checked={isOpname}
              onClick={() => setIsOpname((prev) => !prev)}
              className="flex items-center gap-2 text-sm text-gray-700"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                  isOpname
                    ? 'border-suka-orange bg-suka-orange text-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {isOpname && <Check className="h-3 w-3" />}
              </span>
              <span>Ikut opname</span>
            </button>
          </div>

          <label className="text-xs font-semibold text-gray-600">
            Batas minimum bawaan (dalam satuan besar)
            <input
              value={batas}
              onChange={(e) => setBatas(e.target.value)}
              className={kelasInput}
              inputMode="decimal"
            />
            {batasInvalid && (
              <p className="mt-1 text-xs text-red-600">Format angka tidak dikenali</p>
            )}
          </label>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-suka-brown">Satuan</h3>
          <IsianSatuanFields nilai={satuan} onUbah={setSatuan} />

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="text-xs font-semibold text-gray-600">
              <span>Satuan PO</span>
              <CustomSelect
                value={nilaiSatuanPo}
                onChange={setSatuanPo}
                disabled={opsiPo.length === 0}
                placeholder="Isi satuan di atas dulu"
                options={opsiPo.map((l) => ({ value: l, label: l }))}
              />
            </div>

            <div className="text-xs font-semibold text-gray-600">
              <span>Satuan distribusi (kirim ke outlet)</span>
              <CustomSelect
                value={nilaiSatuanDist}
                onChange={setSatuanDist}
                disabled={opsiDist.length === 0}
                placeholder="Isi satuan di atas dulu"
                options={opsiDist.map((l) => ({ value: l, label: l }))}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <h3 className="text-sm font-bold text-suka-brown">Harga awal (opsional)</h3>
          <p className="text-xs text-gray-500">
            Dicatat sebagai harga vendor. Tanpa vendor tetap, pilih “{BELI_TUNAI}”.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <CustomSelect
              value={supplierId}
              onChange={setSupplierId}
              placeholder="Pilih vendor"
              options={[
                { value: '', label: 'Tanpa vendor awal' },
                ...aktif.map((s) => ({ value: s.id, label: s.nama })),
              ]}
            />
            <CustomSelect
              value={pilihanBeli?.label ?? ''}
              onChange={setLabelBeli}
              disabled={pilihan.length === 0}
              placeholder="Satuan beli"
              options={pilihan.map((p) => ({ value: p.label, label: `per ${p.label}` }))}
            />
            <div>
              <input
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                placeholder="Harga"
                className={kelasInput}
                inputMode="decimal"
              />
              {hargaInvalid && (
                <p className="mt-1 text-xs text-red-600">Format angka tidak dikenali</p>
              )}
            </div>
          </div>
        </div>

        {galat && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {galat}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onBatal}
            disabled={memproses}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={!lengkap || memproses}
            className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {memproses ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
