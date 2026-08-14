'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@suka/design-system'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useBahanBakuHarga } from '@/hooks/useBahanBakuHarga'
import { useBahanBakuHargaMutations } from '@/hooks/useBahanBakuHargaMutations'
import { usePOPriceAlerts } from '@/hooks/usePOPriceAlerts'
import { filterAndSortBahanBaku, type SortOption } from '@/lib/bahanBaku'
import { BahanBakuFilters } from '@/components/BahanBakuFilters'
import { BahanBakuTable } from '@/components/BahanBakuTable'

export default function BahanBakuPage() {
  const { data: rows = [], isLoading } = useBahanBakuHarga()
  const { setHarga, setMerek, setNama, setSatuan, setThreshold, setImage, addSku, updateSku, deleteSku, setDefaultSku, setSkuImage } = useBahanBakuHargaMutations()
  const { data: priceAlerts = [] } = usePOPriceAlerts()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('nama-asc')
  const [alertDismissed, setAlertDismissed] = useState(false)

  const filtered = useMemo(() => filterAndSortBahanBaku(rows, search, sortBy), [rows, search, sortBy])

  function handleSave(bahanBakuId: string, harga: number) {
    setHarga.mutate({ bahan_baku_id: bahanBakuId, harga_beli: harga }, {
      onSuccess: () => toast.success('Harga disimpan'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleSaveMerek(bahanBakuId: string, merek: string | null) {
    setMerek.mutate({ bahan_baku_id: bahanBakuId, merek }, {
      onSuccess: () => toast.success('Merek disimpan'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleSaveNama(bahanBakuId: string, nama: string) {
    setNama.mutate({ bahan_baku_id: bahanBakuId, nama }, {
      onSuccess: () => toast.success('Nama berhasil diubah'),
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

      {/* Price Alert Banner */}
      {priceAlerts.length > 0 && !alertDismissed && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={15} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">
                {priceAlerts.length} bahan baku punya harga berbeda dari PO terakhir
              </p>
              <p className="text-xs text-amber-600 mt-0.5 mb-3">
                Harga aktual di PO yang sudah diterima berbeda &gt;5% dari harga master. Hover badge di kolom harga untuk detail.
              </p>
              <div className="flex flex-wrap gap-2">
                {priceAlerts.slice(0, 5).map(a => {
                  const naik = a.selisih_pct > 0
                  const pct = Math.abs(a.selisih_pct * 100).toFixed(1)
                  return (
                    <span key={a.bahan_baku_id} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${
                      naik ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {naik ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {a.nama}
                      <span className="font-bold">{naik ? '+' : '-'}{pct}%</span>
                    </span>
                  )
                })}
                {priceAlerts.length > 5 && (
                  <span className="text-xs text-amber-600 font-medium self-center">+{priceAlerts.length - 5} lainnya</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setAlertDismissed(true)}
              className="text-amber-400 hover:text-amber-600 transition-colors text-xs font-medium shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

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
            onSaveMerek={handleSaveMerek}
            onSaveNama={handleSaveNama}
            onSaveSatuan={handleSaveSatuan}
            onSaveThreshold={(id, type, pct, ideal) => setThreshold.mutate({ bahan_baku_id: id, threshold_type: type, threshold_persentase: pct, stok_ideal: ideal }, {
              onSuccess: () => toast.success('Pengaturan threshold berhasil disimpan'),
              onError: (e: any) => toast.error(e.message),
            })}
            saving={setHarga.isPending || setMerek.isPending || setNama.isPending || setSatuan.isPending || setThreshold.isPending} 
            onUploadImage={handleUploadImage}
            uploading={setImage.isPending}
            onAddSku={(vars) => addSku.mutate(vars, {
              onSuccess: () => toast.success('SKU ditambahkan'),
              onError: (e: any) => toast.error(e.message),
            })}
            onUpdateSku={(vars) => updateSku.mutate(vars, {
              onSuccess: () => toast.success('SKU diperbarui'),
              onError: (e: any) => toast.error(e.message),
            })}
            onDeleteSku={(id) => deleteSku.mutate(id, {
              onSuccess: () => toast.success('SKU dihapus'),
              onError: (e: any) => toast.error(e.message),
            })}
            onSetDefaultSku={(vars) => setDefaultSku.mutate(vars, {
              onSuccess: () => toast.success('SKU default diubah'),
              onError: (e: any) => toast.error(e.message),
            })}
            setSkuImage={(sku_id, file) => setSkuImage.mutate({ sku_id, file }, {
              onSuccess: () => toast.success('Gambar SKU berhasil diunggah'),
              onError: (e: any) => toast.error(e.message),
            })}
            skuSaving={addSku.isPending || updateSku.isPending || deleteSku.isPending || setDefaultSku.isPending || setSkuImage.isPending}
            priceAlerts={priceAlerts}
          />
        )}
      </div>
    </div>
  )
}
