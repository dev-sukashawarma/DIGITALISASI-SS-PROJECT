'use client'
import { useState, useRef } from 'react'
import { Check, Pencil, X, ArrowRight, Camera, PackageSearch, FileText, AlertTriangle } from 'lucide-react'
import { rupiah } from '@/lib/format'
import { parsePriceInput } from '@/lib/bahanBaku'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { EmptyState, Badge, Avatar } from '@suka/design-system'
import { BahanBakuDetailModal } from './BahanBakuDetailModal'
import type { PriceAlert } from '@/hooks/usePOPriceAlerts'

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function BahanBakuTable({
  rows, onSave, onSaveMerek, onSaveNama, onSaveSatuan, saving, onUploadImage, uploading,
  onAddSku, onUpdateSku, onDeleteSku, onSetDefaultSku, skuSaving, priceAlerts = []
}: {
  rows: BahanBakuWithHarga[]
  onSave: (bahanBakuId: string, harga: number) => void
  onSaveMerek: (bahanBakuId: string, merek: string | null) => void
  onSaveNama: (bahanBakuId: string, nama: string) => void
  onSaveSatuan: (id: string, s: string, st: string | null, ft: number | null, sk: string | null, fk: number | null) => void
  saving: boolean
  onUploadImage: (bahanBakuId: string, file: File, level: 'besar' | 'tengah' | 'kecil') => void
  uploading: boolean
  onAddSku: (vars: { bahan_baku_id: string; nama_kemasan: string; qty_isi: number; harga_beli: number; is_default?: boolean }) => void
  onUpdateSku: (vars: { sku_id: string; nama_kemasan: string; qty_isi: number; harga_beli: number }) => void
  onDeleteSku: (sku_id: string) => void
  onSetDefaultSku: (vars: { bahan_baku_id: string; sku_id: string }) => void
  skuSaving: boolean
  priceAlerts?: PriceAlert[]
}) {
  // Build alert map: bahan_baku_id → alert
  const alertMap = new Map<string, PriceAlert>(priceAlerts.map(a => [a.bahan_baku_id, a]))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)

  const detailItem = rows.find(r => r.id === detailItemId) || null

  if (rows.length === 0) {
    return (
      <EmptyState 
        icon={<PackageSearch size={48} />}
        title="Tidak ada bahan baku" 
        description="Bahan baku yang Anda cari tidak ditemukan."
      />
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && uploadTargetId) {
      onUploadImage(uploadTargetId, file)
    }
    // reset
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploadTargetId(null)
  }

  function triggerUpload(id: string) {
    setUploadTargetId(id)
    fileInputRef.current?.click()
  }

  const inputCls = 'w-28 rounded-lg border border-suka-gray-300 px-2 py-1.5 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange shadow-sm'

  return (
    <div className="overflow-x-auto rounded-xl border border-suka-gray-200 bg-white">
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <table className="w-full text-sm">
        <thead className="bg-gray-50/80 text-left text-xs uppercase text-gray-500 font-semibold border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 whitespace-nowrap">Bahan Baku</th>
            <th className="px-4 py-3 whitespace-nowrap">Merek</th>
            <th className="px-4 py-3 whitespace-nowrap">Kategori</th>
            <th className="px-4 py-3 whitespace-nowrap">Satuan Bertingkat</th>
            <th className="px-4 py-3 whitespace-nowrap">Harga Beli</th>
            <th className="px-4 py-3 whitespace-nowrap">Terakhir Diubah</th>
            <th className="px-4 py-3 whitespace-nowrap text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => {
            return (
              <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-4 py-3">
                  <span className="font-semibold text-suka-ink whitespace-nowrap">{r.nama}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-600 whitespace-nowrap">{r.merek || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-100">{r.kategori}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">{r.satuan}</span>
                    
                    {r.faktor_tengah && r.satuan_tengah && (
                      <>
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {r.faktor_tengah} {r.satuan_tengah}
                        </span>
                      </>
                    )}
                    
                    {r.faktor_tampilan && r.satuan_kecil && (
                      <>
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {r.faktor_tampilan} {r.satuan_kecil}
                        </span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={r.harga ? 'font-medium text-suka-ink' : 'text-gray-400'}>
                      {r.harga ? rupiah(r.harga.harga_beli) : '—'}
                    </span>
                    {alertMap.has(r.id) && (() => {
                      const alert = alertMap.get(r.id)!
                      const naik = alert.selisih_pct > 0
                      const pct = Math.abs(alert.selisih_pct * 100).toFixed(1)
                      return (
                        <span
                          title={`Harga aktual di ${alert.nomor_po}: ${rupiah(alert.harga_terima)} (${naik ? '+' : '-'}${pct}%)`}
                          className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full cursor-help ${
                            naik ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'
                          }`}
                        >
                          <AlertTriangle size={9} />
                          {naik ? '+' : '-'}{pct}%
                        </span>
                      )
                    })()}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {formatUpdatedAt(r.harga?.harga_updated_at ?? null)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2 text-gray-500">
                    <button 
                      title="Lihat detail" 
                      onClick={() => setDetailItemId(r.id)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <FileText size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <BahanBakuDetailModal
        isOpen={detailItem !== null}
        onClose={() => setDetailItemId(null)}
        bahanBaku={detailItem}
        onUploadImage={onUploadImage}
        uploading={uploading}
        onSave={onSave}
        onSaveMerek={onSaveMerek}
        onSaveNama={onSaveNama}
        onSaveSatuan={onSaveSatuan}
        saving={saving}
        onAddSku={onAddSku}
        onUpdateSku={onUpdateSku}
        onDeleteSku={onDeleteSku}
        onSetDefaultSku={onSetDefaultSku}
        skuSaving={skuSaving}
      />
    </div>
  )
}
