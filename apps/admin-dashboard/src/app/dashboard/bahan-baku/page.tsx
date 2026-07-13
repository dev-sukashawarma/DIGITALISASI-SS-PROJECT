'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@suka/design-system'
import { useBahanBakuHarga } from '@/hooks/useBahanBakuHarga'
import { useBahanBakuHargaMutations } from '@/hooks/useBahanBakuHargaMutations'
import { filterAndSortBahanBaku, type SortOption } from '@/lib/bahanBaku'
import { BahanBakuFilters } from '@/components/BahanBakuFilters'
import { BahanBakuTable } from '@/components/BahanBakuTable'

export default function BahanBakuPage() {
  const { data: rows = [], isLoading } = useBahanBakuHarga()
  const { setHarga, setSatuan, setImage } = useBahanBakuHargaMutations()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('nama-asc')

  const filtered = useMemo(() => filterAndSortBahanBaku(rows, search, sortBy), [rows, search, sortBy])

  function handleSave(bahanBakuId: string, harga: number) {
    setHarga.mutate({ bahan_baku_id: bahanBakuId, harga_beli: harga }, {
      onSuccess: () => toast.success('Harga disimpan'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleSaveSatuan(id: string, s: string, st: string | null, ft: number | null, sk: string | null, fk: number | null) {
    setSatuan.mutate({ bahan_baku_id: id, satuan: s, satuan_tengah: st, faktor_tengah: ft, satuan_kecil: sk, faktor_tampilan: fk }, {
      onSuccess: () => toast.success('Satuan berhasil diperbarui'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleUploadImage(bahanBakuId: string, file: File, level: 'besar' | 'tengah' | 'kecil') {
    setImage.mutate({ bahan_baku_id: bahanBakuId, file, level }, {
      onSuccess: () => toast.success('Gambar berhasil diunggah'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-suka-brown tracking-tight">Master Bahan Baku</h1>
        <p className="text-sm text-gray-500">Kelola gambar, konversi satuan bertingkat, dan harga beli bahan baku.</p>
      </div>

      <div className="bg-white rounded-2xl border border-suka-gray-200 p-5 shadow-sm space-y-4">
        <BahanBakuFilters 
          search={search} onSearch={setSearch} 
          sortBy={sortBy} onSortBy={setSortBy}
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <BahanBakuTable 
            rows={filtered} 
            onSave={handleSave}
            onSaveSatuan={handleSaveSatuan}
            saving={setHarga.isPending || setSatuan.isPending} 
            onUploadImage={handleUploadImage}
            uploading={setImage.isPending}
          />
        )}
      </div>
    </div>
  )
}
