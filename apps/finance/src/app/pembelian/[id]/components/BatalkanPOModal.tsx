'use client'

import { useState } from 'react'
import { X, AlertTriangle, Ban } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import type { POWithItems } from '@/hooks/usePurchaseOrder'
import { useUpdatePOStatus } from '@/hooks/usePurchaseOrder'
import { toast } from 'sonner'

type Props = {
  po: POWithItems
  onClose: () => void
}

export function BatalkanPOModal({ po, onClose }: Props) {
  const [alasan, setAlasan] = useState('')
  const updateStatus = useUpdatePOStatus()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alasan.trim()) {
      toast.error('Alasan pembatalan PO wajib diisi')
      return
    }

    const prefix = po.catatan && po.catatan.trim() ? `${po.catatan.trim()}\n\n` : ''
    const waktuWIB = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    const updatedCatatan = `${prefix}[DIBATALKAN]: ${alasan.trim()} (dicatat pada ${waktuWIB} WIB)`

    updateStatus.mutate(
      { id: po.id, status: 'dibatalkan', catatan: updatedCatatan },
      {
        onSuccess: () => {
          toast.success(`Purchase Order ${po.nomor_po} berhasil dibatalkan`)
          onClose()
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-rose-200/60 animate-fade-in flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-rose-100 flex items-center justify-between bg-rose-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center shadow-xs">
              <Ban className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950">Batalkan Purchase Order</h2>
              <p className="text-xs text-rose-700/80 font-mono mt-0.5">{po.nomor_po}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={updateStatus.isPending}
            className="p-2 text-rose-400 hover:text-rose-700 rounded-xl hover:bg-rose-100/50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Konfirmasi Pembatalan PO</span>
            </div>
            <p className="leading-relaxed">
              Anda akan membatalkan PO untuk supplier <strong className="text-rose-950">{po.supplier_nama}</strong>. 
              Status PO akan berubah permanen menjadi <strong>Dibatalkan</strong> dan tidak ada stok bahan baku yang dimasukkan ke gudang.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-suka-brown mb-1.5">
              Alasan Pembatalan <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={alasan}
              onChange={e => setAlasan(e.target.value)}
              placeholder="Contoh: Supplier kehabisan stok / salah input kuantitas / diganti nomor PO baru..."
              rows={3}
              required
              className="w-full bg-white border border-suka-brown/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-2xl p-3 text-xs text-suka-brown placeholder:text-suka-brown/40 outline-none transition-all resize-none font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-suka-brown/10">
            <button
              type="button"
              onClick={onClose}
              disabled={updateStatus.isPending}
              className="px-4 py-2.5 rounded-2xl border border-suka-brown/20 text-suka-brown/70 hover:bg-suka-cream text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={updateStatus.isPending || !alasan.trim()}
              className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer"
            >
              {updateStatus.isPending ? (
                <>
                  <Spinner className="w-3.5 h-3.5" />
                  <span>Membatalkan...</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Ya, Batalkan PO</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
