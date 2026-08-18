import React, { useState } from 'react'
import { X, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatRupiah } from './HargaBahanTable'
import type { FluktuasiHargaItem } from '@/hooks/useFluktuasiHarga'
import type { SyncMasterItemInput } from '@/app/actions/hargaBahan'
import { Spinner } from '@suka/design-system'

interface SyncMasterModalProps {
  itemsToSync: FluktuasiHargaItem[]
  isOpen: boolean
  onClose: () => void
  onConfirm: (inputs: SyncMasterItemInput[]) => Promise<any>
  isSubmitting?: boolean
}

export function SyncMasterModal({
  itemsToSync,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false
}: SyncMasterModalProps) {
  const [catatan, setCatatan] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen || itemsToSync.length === 0) return null

  const isSingle = itemsToSync.length === 1
  const singleItem = itemsToSync[0]

  const handleExecute = async () => {
    try {
      setErrorMessage(null)
      const inputs: SyncMasterItemInput[] = itemsToSync.map((it) => ({
        bahan_baku_id: it.bahan_baku_id,
        harga_baru: it.harga_terakhir || 0,
        ref_po_id: it.po_id_terakhir,
        catatan: catatan.trim() || undefined
      }))

      await onConfirm(inputs)
      setCatatan('')
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memperbarui harga master')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-3xl border border-suka-brown/15 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="p-5 border-b border-suka-brown/10 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-50 border border-orange-200 text-suka-orange">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-suka-brown font-display">
                {isSingle ? 'Sinkronkan Harga Master' : `Sinkronkan ${itemsToSync.length} Harga Master`}
              </h2>
              <p className="text-xs text-suka-brown/70">
                Menyelaraskan patokan harga master dengan harga pembelian vendor terbaru.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-suka-brown/50 hover:text-suka-brown hover:bg-suka-cream transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSingle ? (
            /* Single Item Preview Card */
            <div className="bg-suka-cream/30 rounded-2xl border border-suka-brown/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-suka-brown text-sm">{singleItem.nama}</span>
                <span className="text-[10px] font-mono font-bold text-suka-brown/60 px-2 py-0.5 rounded bg-white border border-suka-brown/10">
                  {singleItem.satuan?.toUpperCase() || 'PCS'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-suka-brown/10">
                <div className="bg-white/80 p-2.5 rounded-xl border border-suka-brown/5">
                  <div className="text-[10px] font-bold text-suka-brown/60 uppercase tracking-wider">
                    Harga Master Saat Ini
                  </div>
                  <div className="text-sm font-bold text-suka-brown/80 mt-0.5">
                    {singleItem.harga_master ? formatRupiah(singleItem.harga_master) : 'Belum Ada'}
                  </div>
                </div>

                <div className="bg-orange-50/80 p-2.5 rounded-xl border border-orange-200">
                  <div className="text-[10px] font-black text-suka-orange uppercase tracking-wider">
                    Harga Baru (PO Terakhir)
                  </div>
                  <div className="text-sm font-black text-suka-brown mt-0.5">
                    {formatRupiah(singleItem.harga_terakhir)}
                  </div>
                </div>
              </div>

              {singleItem.supplier_terakhir && (
                <div className="text-[11px] text-suka-brown/70 font-medium pt-1">
                  Vendor: <span className="font-bold text-suka-brown">{singleItem.supplier_terakhir}</span> (
                  {singleItem.nomor_po_terakhir})
                </div>
              )}
            </div>
          ) : (
            /* Batch Items Preview List */
            <div className="space-y-2">
              <div className="text-xs font-bold text-suka-brown/80">Daftar item yang akan disinkronkan:</div>
              <div className="max-h-48 overflow-y-auto border border-suka-brown/10 rounded-2xl divide-y divide-suka-brown/5 bg-suka-cream/10 p-1">
                {itemsToSync.map((it) => (
                  <div key={it.bahan_baku_id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-extrabold text-suka-brown">{it.nama}</div>
                      <div className="text-[10px] text-suka-brown/60">
                        Master: {formatRupiah(it.harga_master)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-suka-orange">
                        ➡️ {formatRupiah(it.harga_terakhir)}
                      </div>
                      <div className="text-[9px] text-suka-brown/50 font-mono">
                        {it.nomor_po_terakhir}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Catatan Perubahan Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-suka-brown">
              Catatan Penyesuaian (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Penyesuaian kenaikan harga daging dari vendor"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 text-xs font-bold text-suka-brown bg-suka-cream/30 border border-suka-brown/10 rounded-xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-suka-brown/10 bg-white flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-suka-brown/20 text-xs font-bold text-suka-brown hover:bg-suka-cream transition-all"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={isSubmitting}
            className="px-4 py-2 bg-suka-orange hover:bg-orange-600 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Spinner className="w-4 h-4 text-white" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Konfirmasi Simpan Master</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
