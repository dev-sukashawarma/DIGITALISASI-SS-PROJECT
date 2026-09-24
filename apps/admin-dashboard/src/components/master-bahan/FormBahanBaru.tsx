'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSuppliers } from '@/hooks/usePurchaseOrder'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc } from '@/lib/masterBahan/galatRpc'
import { bacaAngka } from '@/lib/masterBahan/angka'
import { pilihanSatuanBeli } from '@/lib/masterBahan/satuanBeli'
import { IsianSatuanFields, faktorTampilanDari, keDataSatuan, type NilaiSatuan } from './IsianSatuanFields'

const BELI_TUNAI = 'Beli Tunai / Tanpa Vendor'

export function FormBahanBaru({
  kategoriAda, onBatal, onSelesai,
}: { kategoriAda: string[]; onBatal: () => void; onSelesai: (id: string) => void }) {
  const { simpanBahan, simpanHargaVendor } = useMutasiMasterBahan()
  const { data: suppliers = [] } = useSuppliers()
  const aktif = useMemo(() => suppliers.filter((s) => s.is_active), [suppliers])

  const [nama, setNama] = useState('')
  const [kategori, setKategori] = useState('')
  const [peruntukan, setPeruntukan] = useState<'outlet' | 'gudang' | 'keduanya'>('outlet')
  const [isOpname, setIsOpname] = useState(true)
  const [batas, setBatas] = useState('0')
  const [satuan, setSatuan] = useState<NilaiSatuan>({ satuan: '', satuan_tengah: '', faktor_tengah: '', satuan_kecil: '', isi_kecil_per_tengah: '' })
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
  const vendorAwal = supplierId || aktif.find((s) => s.nama === BELI_TUNAI)?.id || ''
  const pilihanBeli = pilihan.find((p) => p.label === labelBeli) ?? pilihan[0]
  const memproses = simpanBahan.isPending || simpanHargaVendor.isPending

  // Batas minimum: kosong = 0 (bawaan); terisi tapi tak terbaca = tahan tombol, jangan diam-diam jadi 0.
  const batasTrim = batas.trim()
  const nilaiBatas = batasTrim === '' ? 0 : bacaAngka(batas)
  const batasInvalid = batasTrim !== '' && nilaiBatas === null

  // Harga awal opsional: kosong = tak ada harga awal sama sekali; terisi tapi tak terbaca = tahan tombol.
  const hargaTrim = harga.trim()
  const nilaiHarga = hargaTrim === '' ? null : bacaAngka(harga)
  const hargaInvalid = hargaTrim !== '' && nilaiHarga === null

  const lengkap = nama.trim() !== '' && kategori.trim() !== '' && satuan.satuan.trim() !== '' && !batasInvalid && !hargaInvalid

  async function simpan() {
    setGalat(null)
    let id: string
    try {
      id = await simpanBahan.mutateAsync({
        id: null,
        data: {
          nama: nama.trim(), kategori: kategori.trim(), peruntukan, is_opname: isOpname,
          default_reorder_point: nilaiBatas ?? 0, ...dataSatuan,
        },
        alasan: 'Bahan baru',
      })
    } catch (e) {
      setGalat(bacaGalatRpc(e).pesan)
      return
    }
    if (nilaiHarga !== null && nilaiHarga > 0 && vendorAwal && pilihanBeli) {
      try {
        await simpanHargaVendor.mutateAsync({
          bahanId: id, supplierId: vendorAwal, harga: nilaiHarga, satuanBeli: pilihanBeli.label,
          isi: pilihanBeli.isi, alasan: 'Harga awal saat bahan dibuat',
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

  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-extrabold text-suka-brown">Tambah bahan baku</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-semibold text-gray-600">Nama
            <input value={nama} onChange={(e) => setNama(e.target.value)} className={kelas} />
          </label>
          <label className="text-xs font-semibold text-gray-600">Kategori
            <input value={kategori} onChange={(e) => setKategori(e.target.value)} list="daftar-kategori" className={kelas} />
            <datalist id="daftar-kategori">{kategoriAda.map((k) => <option key={k} value={k} />)}</datalist>
          </label>
          <label className="text-xs font-semibold text-gray-600">Peruntukan
            <select value={peruntukan} onChange={(e) => setPeruntukan(e.target.value as typeof peruntukan)} className={kelas}>
              <option value="outlet">Outlet</option><option value="gudang">Gudang</option><option value="keduanya">Gudang & Outlet</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isOpname} onChange={(e) => setIsOpname(e.target.checked)} /> Ikut opname
          </label>
          <label className="text-xs font-semibold text-gray-600">Batas minimum bawaan (dalam satuan besar)
            <input value={batas} onChange={(e) => setBatas(e.target.value)} className={kelas} inputMode="decimal" />
            {batasInvalid && <p className="mt-1 text-xs text-red-600">Format angka tidak dikenali</p>}
          </label>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-suka-brown">Satuan</h3>
          <IsianSatuanFields nilai={satuan} onUbah={setSatuan} />
        </div>
        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <h3 className="text-sm font-bold text-suka-brown">Harga awal (opsional)</h3>
          <p className="text-xs text-gray-500">Dicatat sebagai harga vendor. Tanpa vendor tetap, pilih “{BELI_TUNAI}”.</p>
          <div className="grid grid-cols-3 gap-2">
            <select value={vendorAwal} onChange={(e) => setSupplierId(e.target.value)} className={kelas}>
              <option value="">— vendor —</option>
              {aktif.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
            <select value={pilihanBeli?.label ?? ''} onChange={(e) => setLabelBeli(e.target.value)} className={kelas}>
              {pilihan.map((p) => <option key={p.label} value={p.label}>per {p.label}</option>)}
            </select>
            <div>
              <input value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="Harga" className={kelas} inputMode="decimal" />
              {hargaInvalid && <p className="mt-1 text-xs text-red-600">Format angka tidak dikenali</p>}
            </div>
          </div>
        </div>
        {galat && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{galat}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onBatal} disabled={memproses} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Batal</button>
          <button onClick={simpan} disabled={!lengkap || memproses} className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {memproses ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
