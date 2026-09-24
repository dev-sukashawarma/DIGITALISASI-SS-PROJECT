'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSuppliers } from '@/hooks/usePurchaseOrder'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { pilihanSatuanBeli, hargaPerSatuanBesar, type TingkatSatuan } from '@/lib/masterBahan/satuanBeli'
import { bacaIsian } from '@/lib/masterBahan/angka'
import { rupiah } from '@/lib/format'

const LAINNYA = '__lainnya__'

export function FormHargaVendor({
  bahan, supplierAwalId = null, onSelesai, onBatal,
}: {
  bahan: TingkatSatuan & { id: string; nama: string }
  supplierAwalId?: string | null
  onSelesai: () => void
  onBatal: () => void
}) {
  const { data: suppliers = [] } = useSuppliers()
  const aktif = useMemo(() => suppliers.filter((s) => s.is_active), [suppliers])
  const pilihan = useMemo(() => pilihanSatuanBeli(bahan), [bahan])
  const { simpanHargaVendor } = useMutasiMasterBahan()

  const [supplierId, setSupplierId] = useState<string>(supplierAwalId ?? '')
  const [labelPilihan, setLabelPilihan] = useState<string>(pilihan[0]?.label ?? LAINNYA)
  const [labelLain, setLabelLain] = useState('')
  const [isiLain, setIsiLain] = useState('')
  const [harga, setHarga] = useState('')
  const [alasan, setAlasan] = useState('')
  const [paksa, setPaksa] = useState(false)
  const [galat, setGalat] = useState<GalatRpc | null>(null)

  const lainnya = labelPilihan === LAINNYA
  const satuanBeli = lainnya ? labelLain.trim() : labelPilihan
  const { nilai: isiLainNilai, invalid: isiLainInvalid } = bacaIsian(isiLain, 0)
  const isi = lainnya ? (isiLainNilai ?? 0) : pilihan.find((p) => p.label === labelPilihan)?.isi ?? 0
  const { nilai: nilaiHargaBaca, invalid: hargaTakDikenali } = bacaIsian(harga, 0)
  const nilaiHarga = nilaiHargaBaca ?? 0
  const perBesar = hargaPerSatuanBesar(nilaiHarga, isi, bahan.faktor_tampilan)
  const lengkap = supplierId !== '' && satuanBeli !== '' && isi > 0 && nilaiHarga > 0 && alasan.trim() !== '' && !hargaTakDikenali

  async function simpan() {
    setGalat(null)
    try {
      await simpanHargaVendor.mutateAsync({
        bahanId: bahan.id, supplierId, harga: nilaiHarga, satuanBeli, isi, alasan: alasan.trim(), paksa,
      })
      toast.success('Harga vendor tersimpan; harga master menyesuaikan otomatis')
      onSelesai()
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div>
          <h3 className="text-base font-extrabold text-suka-brown">Harga vendor — {bahan.nama}</h3>
          <p className="text-xs text-gray-500">Harga master dihitung otomatis dari harga vendor terbaru.</p>
        </div>
        <label className="block text-xs font-semibold text-gray-600">Vendor
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={kelas}>
            <option value="">— pilih vendor —</option>
            {aktif.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-gray-600">Dibeli per
            <select value={labelPilihan} onChange={(e) => setLabelPilihan(e.target.value)} className={kelas}>
              {pilihan.map((p) => <option key={p.label} value={p.label}>{p.label} (isi {p.isi.toLocaleString('id-ID')})</option>)}
              <option value={LAINNYA}>Satuan lain…</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600">Harga per {satuanBeli || 'satuan'}
            <input value={harga} onChange={(e) => setHarga(e.target.value)} className={kelas} inputMode="decimal" placeholder="0" />
            {hargaTakDikenali && <span className="mt-1 block text-xs text-red-600">Format angka tidak dikenali</span>}
          </label>
          {lainnya && (
            <>
              <label className="text-xs font-semibold text-gray-600">Nama satuan
                <input value={labelLain} onChange={(e) => setLabelLain(e.target.value)} className={kelas} />
              </label>
              <label className="text-xs font-semibold text-gray-600">Isi {bahan.satuan_kecil ?? bahan.satuan} per satuan ini
                <input value={isiLain} onChange={(e) => setIsiLain(e.target.value)} className={kelas} inputMode="decimal" />
                {isiLainInvalid && <span className="mt-1 block text-xs text-red-600">Format angka tidak dikenali</span>}
              </label>
            </>
          )}
        </div>
        <p className="text-xs text-gray-600">
          {perBesar !== null ? `Setara ${rupiah(Math.round(perBesar))} per ${bahan.satuan}.` : 'Isi harga dan satuan untuk melihat setara per satuan besar.'}
        </p>
        <label className="block text-xs font-semibold text-gray-600">Alasan
          <input value={alasan} onChange={(e) => setAlasan(e.target.value)} className={kelas} placeholder="Mis. harga baru dari nota 24 Sep" />
        </label>
        {galat && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{galat.pesan}</div>}
        {galat?.bisaDipaksa && (
          <label className="flex items-start gap-2 text-sm text-amber-800">
            <input type="checkbox" checked={paksa} onChange={(e) => setPaksa(e.target.checked)} className="mt-1" />
            Saya sudah memeriksa satuan dan harganya; simpan paksa.
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onBatal} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Batal</button>
          <button onClick={simpan} disabled={!lengkap || simpanHargaVendor.isPending}
            className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {simpanHargaVendor.isPending ? 'Menyimpan…' : 'Simpan harga'}
          </button>
        </div>
      </div>
    </div>
  )
}
