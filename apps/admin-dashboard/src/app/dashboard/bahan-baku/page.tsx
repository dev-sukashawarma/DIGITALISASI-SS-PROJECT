'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@suka/design-system'
import { useBahanBakuHarga } from '@/hooks/useBahanBakuHarga'
import { useBahanBakuHargaMutations } from '@/hooks/useBahanBakuHargaMutations'
import { filterBahanBaku } from '@/lib/bahanBaku'
import { BahanBakuFilters } from '@/components/BahanBakuFilters'
import { BahanBakuTable } from '@/components/BahanBakuTable'

export default function BahanBakuPage() {
  const { data: rows = [], isLoading } = useBahanBakuHarga()
  const { setHarga } = useBahanBakuHargaMutations()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => filterBahanBaku(rows, search), [rows, search])

  function handleSave(bahanBakuId: string, harga: number) {
    setHarga.mutate({ bahan_baku_id: bahanBakuId, harga_beli: harga }, {
      onSuccess: () => toast.success('Harga disimpan'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-suka-brown tracking-tight">Master Bahan Baku</h1>
        <p className="text-sm text-gray-500">Kelola harga beli bahan baku. Harga hanya terlihat oleh admin.</p>
      </div>

      <BahanBakuFilters search={search} onSearch={setSearch} />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <BahanBakuTable rows={filtered} onSave={handleSave} saving={setHarga.isPending} />
      )}
    </div>
  )
}
