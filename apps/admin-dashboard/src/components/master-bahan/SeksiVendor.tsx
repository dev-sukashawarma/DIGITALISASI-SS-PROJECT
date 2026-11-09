'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useRole } from '@/components/layout/RoleContext'
import { bolehUbahHarga } from '@/lib/masterBahan/akses'
import { useVendorBahan, type VendorBahan } from '@/hooks/masterBahan/useVendorBahan'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { rupiah } from '@/lib/format'
import { DialogAlasan } from './DialogAlasan'
import { FormHargaVendor } from './FormHargaVendor'
import { Lencana } from './Tabel'

function status(v: VendorBahan) {
  if (!v.is_active) return <Lencana nada="abu">nonaktif</Lencana>
  if (v.perlu_ditinjau || !(v.harga > 0)) return <Lencana nada="kuning">perlu ditinjau</Lencana>
  return <Lencana nada="hijau">aktif</Lencana>
}

export function SeksiVendor({ bahan }: { bahan: BahanBakuWithHarga }) {
  const { role } = useRole()
  const boleh = bolehUbahHarga(role)
  const { data: vendor = [], isLoading, error } = useVendorBahan(bahan.id)
  const { nonaktifkanHargaVendor } = useMutasiMasterBahan()
  const [tambah, setTambah] = useState(false)
  const [matikan, setMatikan] = useState<VendorBahan | null>(null)
  const [galat, setGalat] = useState<GalatRpc | null>(null)

  async function nonaktifkan({ alasan }: { alasan: string; paksa: boolean }) {
    if (!matikan) return
    setGalat(null)
    try {
      await nonaktifkanHargaVendor.mutateAsync({ id: matikan.id, alasan })
      toast.success('Harga vendor dinonaktifkan')
      setMatikan(null)
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  const kecil = bahan.satuan_kecil ?? bahan.satuan
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-suka-brown">Vendor</h3>
        {boleh && (
          <button onClick={() => setTambah(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-suka-orange px-3 py-1.5 text-xs font-bold text-white hover:brightness-95">
            <Plus size={14} /> Tambah harga vendor
          </button>
        )}
      </div>
      <ul className="divide-y rounded-xl border border-gray-200">
        {isLoading && <li className="px-3 py-2 text-sm text-gray-500">Memuat…</li>}
        {error && <li className="px-3 py-2 text-sm text-red-600">Gagal memuat vendor.</li>}
        {!isLoading && !error && vendor.length === 0 && (
          <li className="px-3 py-2 text-sm text-gray-500">Belum ada vendor untuk bahan ini.</li>
        )}
        {vendor.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800">{v.supplier_nama} {status(v)}</p>
              <p className="text-xs text-gray-500">
                Dibeli per {v.satuan_beli} isi {v.isi_satuan_kecil.toLocaleString('id-ID')} {kecil}
                {v.harga > 0 ? ` · ${rupiah(v.harga)}` : ' · harga belum diisi'}
              </p>
            </div>
            {boleh && v.is_active && (
              <button onClick={() => setMatikan(v)} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                Nonaktifkan
              </button>
            )}
          </li>
        ))}
      </ul>
      {!boleh && <p className="text-xs text-gray-500">Hanya admin, owner, dan purchasing yang bisa mengubah harga vendor.</p>}
      {tambah && <FormHargaVendor bahan={bahan} onBatal={() => setTambah(false)} onSelesai={() => setTambah(false)} />}
      {matikan && (
        <DialogAlasan judul={`Nonaktifkan harga vendor ${matikan.supplier_nama}`} wajib galat={galat}
          memproses={nonaktifkanHargaVendor.isPending} labelKirim="Nonaktifkan"
          onBatal={() => { setMatikan(null); setGalat(null) }} onKirim={nonaktifkan} />
      )}
    </section>
  )
}
