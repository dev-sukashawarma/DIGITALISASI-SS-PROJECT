'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan, type DataBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { pilihanSatuanBeli } from '@/lib/masterBahan/satuanBeli'
import { DialogAlasan } from './DialogAlasan'
import { IsianSatuanFields, keDataSatuan, nilaiSatuanDari, satuanInvalid, type NilaiSatuan } from './IsianSatuanFields'

export function SeksiSatuan({ bahan, bolehData }: { bahan: BahanBakuWithHarga; bolehData: boolean }) {
  const { simpanBahan } = useMutasiMasterBahan()
  const awal = useMemo(() => nilaiSatuanDari(bahan), [bahan])
  const [nilai, setNilai] = useState<NilaiSatuan>(awal)
  const [satuanPo, setSatuanPo] = useState(bahan.satuan_po ?? '')
  const [satuanDist, setSatuanDist] = useState(bahan.satuan_distribusi ?? '')
  const [minta, setMinta] = useState(false)
  const [galat, setGalat] = useState<GalatRpc | null>(null)
  const pilihan = pilihanSatuanBeli(bahan).map((p) => p.label)
  // Label 'kg' tambahan (aturan kg→gram) hanya sah untuk DISTRIBUSI; trigger Tahap 1
  // menolaknya sebagai satuan PO kecuali Kg memang salah satu tingkat.
  const pilihanPo = pilihan.filter(
    (l) => l.toLowerCase() !== 'kg' || [bahan.satuan, bahan.satuan_tengah, bahan.satuan_kecil].some((t) => t?.toLowerCase() === 'kg'),
  )

  // Kunci satuan hanya dikirim bila isiannya berubah: menghitung ulang isi per tengah
  // dari faktor master bisa berbeda pecahan dan membuat RPC mengira satuan diubah.
  const satuanBerubah = (Object.keys(awal) as (keyof NilaiSatuan)[]).some((k) => nilai[k].trim() !== awal[k].trim())
  // Tak boleh kirim satuan baru yang isiannya tak lengkap/tak dikenali — hanya relevan
  // kalau memang diubah; satuan lama (belum disentuh) selalu dianggap valid.
  const satuanTidakValid = satuanBerubah && satuanInvalid(nilai)
  const ubahan: DataBahan = satuanBerubah ? { ...keDataSatuan(nilai) } : {}
  if ((satuanPo || null) !== (bahan.satuan_po ?? null)) ubahan.satuan_po = satuanPo || null
  if ((satuanDist || null) !== (bahan.satuan_distribusi ?? null)) ubahan.satuan_distribusi = satuanDist || null
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

  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50'
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-suka-brown">Satuan</h3>
      <IsianSatuanFields nilai={nilai} onUbah={setNilai} nonaktif={!bolehData} />
      <p className="text-xs text-amber-700">
        Bahan yang sudah punya riwayat stok belum bisa berganti isi satuan dari sini (fitur Ganti Satuan menyusul); sistem akan menolak.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-gray-600">Satuan PO
          <select value={satuanPo} onChange={(e) => setSatuanPo(e.target.value)} disabled={!bolehData} className={kelas}>
            <option value="">—</option>
            {pilihanPo.map((l) => <option key={l} value={l}>{l}</option>)}
            {satuanPo && !pilihanPo.includes(satuanPo) && <option value={satuanPo}>{satuanPo} (lama)</option>}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600">Satuan distribusi
          <select value={satuanDist} onChange={(e) => setSatuanDist(e.target.value)} disabled={!bolehData} className={kelas}>
            <option value="">—</option>
            {pilihan.map((l) => <option key={l} value={l}>{l}</option>)}
            {satuanDist && !pilihan.includes(satuanDist) && <option value={satuanDist}>{satuanDist} (lama)</option>}
          </select>
        </label>
      </div>
      {bolehData && (
        <button onClick={() => setMinta(true)} disabled={!adaUbahan || satuanTidakValid}
          className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Simpan satuan</button>
      )}
      {minta && (
        <DialogAlasan judul="Simpan perubahan satuan" wajib={false} galat={galat} memproses={simpanBahan.isPending}
          onBatal={() => { setMinta(false); setGalat(null) }} onKirim={simpan} />
      )}
    </section>
  )
}
