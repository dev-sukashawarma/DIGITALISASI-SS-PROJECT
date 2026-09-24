'use client'
import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { rupiah } from '@/lib/format'
import { DialogAlasan } from './DialogAlasan'
import { SeksiIdentitas } from './SeksiIdentitas'
import { SeksiSatuan } from './SeksiSatuan'
import { SeksiFotoSku } from './SeksiFotoSku'

type Aksi = 'nonaktifkan' | 'aktifkan' | 'hapus'

const JUDUL: Record<Aksi, string> = { nonaktifkan: 'Nonaktifkan', aktifkan: 'Aktifkan', hapus: 'Hapus' }

export function PanelBahan({
  bahan, bolehData, jumlahBatasOutlet, onTutup,
}: { bahan: BahanBakuWithHarga; bolehData: boolean; jumlahBatasOutlet: number | null; onTutup: () => void }) {
  const mut = useMutasiMasterBahan()
  const [aksi, setAksi] = useState<Aksi | null>(null)
  const [galat, setGalat] = useState<GalatRpc | null>(null)

  async function jalankan({ alasan }: { alasan: string; paksa: boolean }) {
    if (!aksi) return
    setGalat(null)
    try {
      await mut[aksi].mutateAsync({ id: bahan.id, alasan })
      toast.success(aksi === 'hapus' ? 'Bahan dihapus' : aksi === 'aktifkan' ? 'Bahan diaktifkan' : 'Bahan dinonaktifkan')
      const tutup = aksi === 'hapus'
      setAksi(null)
      if (tutup) onTutup()
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-2xl space-y-6 overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-suka-brown">{bahan.nama}</h2>
            <p className="text-xs text-gray-500">{bahan.is_active ? 'Aktif' : 'Nonaktif'} · {bahan.kategori}</p>
          </div>
          <button onClick={onTutup} aria-label="Tutup" className="rounded-full p-2 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="rounded-xl bg-gray-50 p-4 text-sm">
          <p className="font-semibold text-gray-700">
            Harga master: {bahan.harga?.harga_beli ? `${rupiah(bahan.harga.harga_beli)} per ${bahan.satuan}` : 'belum ada'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Dihitung otomatis dari harga vendor terbaru.{' '}
            <Link href="/dashboard/bahan-baku?tab=harga" className="font-bold text-suka-orange hover:underline">Kelola di tab Harga</Link>
          </p>
        </div>

        <SeksiIdentitas bahan={bahan} bolehData={bolehData} jumlahBatasOutlet={jumlahBatasOutlet} />
        <SeksiSatuan bahan={bahan} bolehData={bolehData} />
        <SeksiFotoSku bahan={bahan} bolehData={bolehData} />

        {bolehData && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {bahan.is_active ? (
              <button onClick={() => setAksi('nonaktifkan')} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-700">Nonaktifkan</button>
            ) : (
              <button onClick={() => setAksi('aktifkan')} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-700">Aktifkan lagi</button>
            )}
            <button onClick={() => setAksi('hapus')} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Hapus</button>
            <p className="w-full text-xs text-gray-500">
              Hapus hanya bisa untuk bahan yang belum pernah dipakai. Bahan yang sudah punya riwayat dinonaktifkan saja.
            </p>
          </div>
        )}
      </div>

      {aksi && (
        <DialogAlasan
          judul={`${JUDUL[aksi]} ${bahan.nama}?`}
          keterangan={aksi === 'nonaktifkan' ? 'Ditolak bila masih dipakai resep aktif, dokumen berjalan, substitusi, atau stoknya belum nol.' : undefined}
          wajib galat={galat} memproses={mut[aksi].isPending} labelKirim={JUDUL[aksi]}
          onBatal={() => { setAksi(null); setGalat(null) }} onKirim={jalankan}
        />
      )}
    </div>
  )
}
