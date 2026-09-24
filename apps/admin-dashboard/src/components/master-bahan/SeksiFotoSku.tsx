'use client'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan, type LevelFoto } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc } from '@/lib/masterBahan/galatRpc'
import { bacaAngka } from '@/lib/masterBahan/angka'
import { rupiah } from '@/lib/format'

const FOTO: { level: LevelFoto; label: string; kolom: 'image_url' | 'image_url_tengah' | 'image_url_kecil' }[] = [
  { level: 'besar', label: 'Besar', kolom: 'image_url' },
  { level: 'tengah', label: 'Tengah', kolom: 'image_url_tengah' },
  { level: 'kecil', label: 'Kecil', kolom: 'image_url_kecil' },
]

export function SeksiFotoSku({ bahan, bolehData }: { bahan: BahanBakuWithHarga; bolehData: boolean }) {
  const mut = useMutasiMasterBahan()
  const inputRef = useRef<HTMLInputElement>(null)
  const [levelAktif, setLevelAktif] = useState<LevelFoto>('besar')
  const [kemasan, setKemasan] = useState('')
  const [isi, setIsi] = useState('')
  const [hargaSku, setHargaSku] = useState('')

  // Isi SKU wajib terisi & terbaca (tak boleh diam-diam jadi 0). Harga SKU opsional: kosong = 0.
  const isiTrim = isi.trim()
  const nilaiIsi = bacaAngka(isi)
  const isiInvalid = isiTrim !== '' && nilaiIsi === null

  const hargaSkuTrim = hargaSku.trim()
  const nilaiHargaSku = hargaSkuTrim === '' ? 0 : bacaAngka(hargaSku)
  const hargaSkuInvalid = hargaSkuTrim !== '' && nilaiHargaSku === null

  async function beritahu(p: Promise<unknown>, sukses: string): Promise<boolean> {
    try {
      await p
      toast.success(sukses)
      return true
    } catch (e) {
      toast.error(bacaGalatRpc(e).pesan)
      return false
    }
  }

  function pilihFoto(level: LevelFoto) {
    setLevelAktif(level)
    inputRef.current?.click()
  }

  function unggah(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void beritahu(mut.unggahFoto.mutateAsync({ bahanId: bahan.id, file, level: levelAktif }), 'Foto diunggah')
    e.target.value = ''
  }

  async function tambahSku() {
    const qty = nilaiIsi ?? 0
    const h = nilaiHargaSku ?? 0
    const ok = await beritahu(
      mut.simpanSku.mutateAsync({ id: null, bahanId: bahan.id, data: { nama_kemasan: kemasan.trim(), qty_isi: qty, harga_beli: h } }),
      'SKU ditambahkan',
    )
    if (ok) { setKemasan(''); setIsi(''); setHargaSku('') }
  }

  const kelas = 'rounded-xl border border-gray-200 px-3 py-2 text-sm'
  const skus = bahan.skus ?? []
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold text-suka-brown">Foto & kemasan (SKU)</h3>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={unggah} />
      <div className="grid grid-cols-3 gap-3">
        {FOTO.map((f) => (
          <div key={f.level} className="space-y-1 text-center">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gray-50">
              {bahan[f.kolom]
                ? <img src={bahan[f.kolom] as string} alt={`Foto ${f.label.toLowerCase()} ${bahan.nama}`} className="h-full w-full object-cover" />
                : <span className="text-xs text-gray-400">Belum ada</span>}
            </div>
            {bolehData && (
              <button onClick={() => pilihFoto(f.level)} disabled={mut.unggahFoto.isPending} className="text-xs font-bold text-suka-orange hover:underline">
                Ganti foto {f.label.toLowerCase()}
              </button>
            )}
          </div>
        ))}
      </div>
      <ul className="divide-y rounded-xl border">
        {skus.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              {s.nama_kemasan} · isi {Number(s.qty_isi).toLocaleString('id-ID')} · {rupiah(Number(s.harga_beli ?? 0))}
              {s.is_default && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">default</span>}
            </span>
            {bolehData && (
              <span className="flex gap-3">
                {!s.is_default && (
                  <button onClick={() => void beritahu(mut.setDefaultSku.mutateAsync(s.id), 'SKU default diubah')} className="text-xs font-bold text-suka-orange">Jadikan default</button>
                )}
                <button onClick={() => void beritahu(mut.hapusSku.mutateAsync(s.id), 'SKU dihapus')} className="text-xs font-bold text-red-600">Hapus</button>
              </span>
            )}
          </li>
        ))}
        {skus.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">Belum ada SKU.</li>}
      </ul>
      {bolehData && (
        <div className="flex flex-wrap items-start gap-2">
          <input value={kemasan} onChange={(e) => setKemasan(e.target.value)} placeholder="Nama kemasan" className={kelas} />
          <div>
            <input value={isi} onChange={(e) => setIsi(e.target.value)} placeholder="Isi" className={`${kelas} w-24`} inputMode="decimal" />
            {isiInvalid && <p className="mt-1 text-xs text-red-600">Format angka tidak dikenali</p>}
          </div>
          <div>
            <input value={hargaSku} onChange={(e) => setHargaSku(e.target.value)} placeholder="Harga" className={`${kelas} w-32`} inputMode="decimal" />
            {hargaSkuInvalid && <p className="mt-1 text-xs text-red-600">Format angka tidak dikenali</p>}
          </div>
          <button onClick={() => void tambahSku()} disabled={kemasan.trim() === '' || isiInvalid || !((nilaiIsi ?? 0) > 0) || hargaSkuInvalid || mut.simpanSku.isPending}
            className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Tambah SKU</button>
        </div>
      )}
    </section>
  )
}
