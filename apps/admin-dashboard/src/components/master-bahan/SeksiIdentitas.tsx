'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan, type DataBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { bacaIsian, tulisAngka } from '@/lib/masterBahan/angka'
import { KATEGORI_RESMI, opsiPilihan } from '@/lib/masterBahan/daftarPilihan'
import { DialogAlasan } from './DialogAlasan'

export function SeksiIdentitas({
  bahan, bolehData, jumlahBatasOutlet,
}: { bahan: BahanBakuWithHarga; bolehData: boolean; jumlahBatasOutlet: number | null }) {
  const { simpanBahan } = useMutasiMasterBahan()
  const [nama, setNama] = useState(bahan.nama)
  const [merek, setMerek] = useState(bahan.merek ?? '')
  const [kategori, setKategori] = useState(bahan.kategori)
  const [peruntukan, setPeruntukan] = useState(bahan.peruntukan)
  const [isOpname, setIsOpname] = useState(bahan.is_opname)
  const [batas, setBatas] = useState(tulisAngka(bahan.default_reorder_point))
  const [minta, setMinta] = useState(false)
  const [galat, setGalat] = useState<GalatRpc | null>(null)

  // Batas minimum: kosong = 0 (bawaan); terisi tapi tak terbaca = tahan tombol simpan.
  const { nilai: nilaiBatas, invalid: batasInvalid } = bacaIsian(batas, 0)

  // Hanya kolom yang berubah yang dikirim — riwayat perubahan tetap bersih.
  const ubahan: DataBahan = {}
  if (nama.trim() !== bahan.nama) ubahan.nama = nama.trim()
  if ((merek.trim() || null) !== (bahan.merek ?? null)) ubahan.merek = merek.trim() || null
  if (kategori.trim() !== bahan.kategori) ubahan.kategori = kategori.trim()
  if (peruntukan !== bahan.peruntukan) ubahan.peruntukan = peruntukan
  if (isOpname !== bahan.is_opname) ubahan.is_opname = isOpname
  if (!batasInvalid && (nilaiBatas ?? 0) !== bahan.default_reorder_point) ubahan.default_reorder_point = nilaiBatas ?? 0
  const adaUbahan = Object.keys(ubahan).length > 0

  async function simpan({ alasan }: { alasan: string; paksa: boolean }) {
    setGalat(null)
    try {
      await simpanBahan.mutateAsync({ id: bahan.id, data: ubahan, alasan: alasan || null })
      toast.success('Data bahan disimpan')
      setMinta(false)
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50'
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-suka-brown">Identitas & operasional</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-xs font-semibold text-gray-600">Nama
          <input value={nama} onChange={(e) => setNama(e.target.value)} disabled={!bolehData} className={kelas} />
        </label>
        <label className="text-xs font-semibold text-gray-600">Merek
          <input value={merek} onChange={(e) => setMerek(e.target.value)} disabled={!bolehData} className={kelas} />
        </label>
        <label className="text-xs font-semibold text-gray-600">Kategori
          <select value={kategori} onChange={(e) => setKategori(e.target.value)} disabled={!bolehData} className={kelas}>
            {opsiPilihan(KATEGORI_RESMI, kategori).map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600">Peruntukan
          <select value={peruntukan} onChange={(e) => setPeruntukan(e.target.value as typeof peruntukan)} disabled={!bolehData} className={kelas}>
            <option value="outlet">Outlet</option><option value="gudang">Gudang</option><option value="keduanya">Gudang & Outlet</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600">Batas minimum bawaan (per {bahan.satuan})
          <input value={batas} onChange={(e) => setBatas(e.target.value)} disabled={!bolehData} className={kelas} inputMode="decimal" />
          {batasInvalid && <p className="mt-1 text-xs text-red-600">Format angka tidak dikenali</p>}
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isOpname} onChange={(e) => setIsOpname(e.target.checked)} disabled={!bolehData} /> Ikut opname
        </label>
      </div>
      {jumlahBatasOutlet !== null && jumlahBatasOutlet > 0 && (
        <p className="text-xs text-gray-500">{jumlahBatasOutlet} outlet punya batas khusus untuk bahan ini — diatur di app Stok.</p>
      )}
      {bolehData && (
        <button onClick={() => setMinta(true)} disabled={!adaUbahan || batasInvalid}
          className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Simpan perubahan</button>
      )}
      {minta && (
        <DialogAlasan judul="Simpan perubahan data bahan" wajib={false} galat={galat} memproses={simpanBahan.isPending}
          onBatal={() => { setMinta(false); setGalat(null) }} onKirim={simpan} />
      )}
    </section>
  )
}
